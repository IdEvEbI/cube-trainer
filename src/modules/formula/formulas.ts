import { Alg } from "cubing/alg";
import type { Formula } from "./types.ts";

const LAYER_MOVE = /^(?:[UDLRFB]|[MES])(?:2'|2|')?$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isFormula(value: unknown): value is Formula {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.name) &&
    item.puzzle === "3x3" &&
    isNonEmptyString(item.moves)
  );
}

export function parseFormulas(input: unknown): Formula[] {
  if (!Array.isArray(input)) {
    throw new Error("公式数据必须是数组");
  }
  return input.map((item, index) => {
    if (!isFormula(item)) {
      throw new Error(`第 ${index + 1} 条公式无效`);
    }
    return {
      id: item.id,
      name: item.name,
      puzzle: item.puzzle,
      moves: item.moves,
    };
  });
}

export function formulaNames(formulas: Formula[]): string[] {
  return formulas.map((formula) => formula.name);
}

export function parseAlgorithm(source: string): string[] {
  const moves = [...new Alg(source).experimentalLeafMoves()].map((move) =>
    move.toString(),
  );
  if (moves.length === 0) {
    throw new Error("算法是空的");
  }
  const invalid = moves.find((move) => !LAYER_MOVE.test(move));
  if (invalid) {
    throw new Error(`无法按层转动：${invalid}`);
  }
  return moves;
}
