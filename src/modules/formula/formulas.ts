import type { Formula } from "./types.ts";

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
