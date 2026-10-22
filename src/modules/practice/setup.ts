import { parseAlgorithm } from "../formula/formulas.ts";
import type { Formula } from "../formula/types.ts";

const OLL_PRACTICE_IDS = new Set([
  "oll-line",
  "oll-l",
  "oll-sune",
  "oll-antisune",
]);

export type PracticeCase = {
  id: string;
  name: string;
  forward: string;
  inverse: string;
};

function invertMove(move: string): string {
  if (move.endsWith("2'") || move.endsWith("2")) {
    return `${move[0]}2`;
  }
  if (move.endsWith("'")) {
    return move.slice(0, -1);
  }
  return `${move}'`;
}

export function invertAlgorithm(moves: string): string {
  return parseAlgorithm(moves).reverse().map(invertMove).join(" ");
}

function canPractice(formula: Formula): boolean {
  return (
    formula.practice === true ||
    OLL_PRACTICE_IDS.has(formula.id) ||
    formula.id.startsWith("f2l-") ||
    formula.id.startsWith("pll-")
  );
}

export function formulaAlgorithms(formula: Formula): string[] {
  return formula.algs ?? [formula.moves];
}

export function practiceCase(
  formula: Formula,
  algorithmIndex = 0,
): PracticeCase | null {
  if (!canPractice(formula)) {
    return null;
  }
  const algorithms = formulaAlgorithms(formula);
  if (
    !Number.isInteger(algorithmIndex) ||
    algorithmIndex < 0 ||
    algorithmIndex >= algorithms.length
  ) {
    return null;
  }
  const source =
    algorithmIndex === 0 ? formula.moves : algorithms[algorithmIndex];
  if (!source) {
    return null;
  }
  const forward = parseAlgorithm(source).join(" ");
  return {
    id: formula.id,
    name: formula.name,
    forward,
    inverse: invertAlgorithm(forward),
  };
}
