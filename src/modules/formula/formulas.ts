import { Alg } from "cubing/alg";
import type { Formula, FormulaMethod, FormulaStep } from "./types.ts";

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

function readFormula(value: unknown, label: string): Formula {
  if (!isFormula(value)) {
    throw new Error(`${label}无效`);
  }
  return {
    id: value.id,
    name: value.name,
    puzzle: value.puzzle,
    moves: value.moves,
  };
}

function readStep(value: unknown, label: string): FormulaStep {
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
  const seen = new Set<string>();
  return input.map((value, methodIndex) => {
    const methodLabel = `第 ${methodIndex + 1} 个方法`;
    if (typeof value !== "object" || value === null) {
      throw new Error(`${methodLabel}无效`);
    }
    const item = value as Record<string, unknown>;
    if (!isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
      throw new Error(`${methodLabel}无效`);
    }
    if (!Array.isArray(item.steps)) {
      throw new Error(`${methodLabel}无效`);
    }
    const steps = item.steps.map((step, stepIndex) =>
      readStep(step, `${methodLabel}的第 ${stepIndex + 1} 个步骤`),
    );
    for (const step of steps) {
      for (const formula of step.formulas) {
        if (seen.has(formula.id)) {
          throw new Error(`公式 id 重复：${formula.id}`);
        }
        seen.add(formula.id);
      }
    }
    return {
      id: item.id,
      name: item.name,
      steps,
    };
  });
}

export function collectFormulas(methods: FormulaMethod[]): Formula[] {
  return methods.flatMap((method) =>
    method.steps.flatMap((step) => step.formulas),
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
