import { Alg } from "cubing/alg";
import type {
  Formula,
  FormulaMethod,
  FormulaSubclass,
  Puzzle,
} from "./types.ts";

const LAYER_MOVE = /^(?:[UDLRFB]|[MES])(?:2'|2|')?$/;
const PUZZLES = new Set<Puzzle>(["2x2", "3x3", "4x4", "5x5"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function readPuzzle(value: unknown, label: string): Puzzle {
  if (value === undefined) {
    return "3x3";
  }
  if (typeof value === "string" && PUZZLES.has(value as Puzzle)) {
    return value as Puzzle;
  }
  throw new Error(`${label}无效`);
}

function readFormula(value: unknown, label: string): Formula {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label}无效`);
  }
  const item = value as Record<string, unknown>;
  if (
    !isNonEmptyString(item.id) ||
    !isNonEmptyString(item.name) ||
    !isNonEmptyString(item.moves)
  ) {
    throw new Error(`${label}无效`);
  }
  parseAlgorithm(item.moves);
  return {
    id: item.id,
    name: item.name,
    puzzle: readPuzzle(item.puzzle, label),
    moves: item.moves,
  };
}

function readSubclass(value: unknown, label: string): FormulaSubclass {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label}无效`);
  }
  const item = value as Record<string, unknown>;
  if (!isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
    throw new Error(`${label}无效`);
  }
  if (item.note !== undefined && !isNonEmptyString(item.note)) {
    throw new Error(`${label}无效`);
  }
  if (!Array.isArray(item.formulas)) {
    throw new Error(`${label}无效`);
  }
  return {
    id: item.id,
    name: item.name,
    note: item.note,
    formulas: item.formulas.map((formula, index) =>
      readFormula(formula, `${label}的第 ${index + 1} 条公式`),
    ),
  };
}

export function parseFormulaLibrary(input: unknown): FormulaMethod[] {
  if (!Array.isArray(input)) {
    throw new Error("公式数据必须是数组");
  }
  const methodIds = new Set<string>();
  const subclassIds = new Set<string>();
  const formulaIds = new Set<string>();
  return input.map((value, methodIndex) => {
    const methodLabel = `第 ${methodIndex + 1} 个方法`;
    if (typeof value !== "object" || value === null) {
      throw new Error(`${methodLabel}无效`);
    }
    const item = value as Record<string, unknown>;
    if (!isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
      throw new Error(`${methodLabel}无效`);
    }
    if (methodIds.has(item.id)) {
      throw new Error(`方法 id 重复：${item.id}`);
    }
    methodIds.add(item.id);
    if (!Array.isArray(item.subclasses)) {
      throw new Error(`${methodLabel}无效`);
    }
    const subclasses = item.subclasses.map((subclass, subclassIndex) =>
      readSubclass(subclass, `${methodLabel}的第 ${subclassIndex + 1} 个子类`),
    );
    for (const subclass of subclasses) {
      if (subclassIds.has(subclass.id)) {
        throw new Error(`子类 id 重复：${subclass.id}`);
      }
      subclassIds.add(subclass.id);
      for (const formula of subclass.formulas) {
        if (formulaIds.has(formula.id)) {
          throw new Error(`公式 id 重复：${formula.id}`);
        }
        formulaIds.add(formula.id);
      }
    }
    return {
      id: item.id,
      name: item.name,
      subclasses,
    };
  });
}

export function collectFormulas(methods: FormulaMethod[]): Formula[] {
  return methods.flatMap((method) =>
    method.subclasses.flatMap((subclass) => subclass.formulas),
  );
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
