import { parseAlgorithm } from "../formula/formulas.ts";
import type { Formula } from "../formula/types.ts";

const PRACTICE_IDS = new Set(["oll-line", "oll-l", "oll-sune", "oll-antisune"]);

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

export function practiceCase(formula: Formula): PracticeCase | null {
  if (!PRACTICE_IDS.has(formula.id)) {
    return null;
  }
  const forward = parseAlgorithm(formula.moves).join(" ");
  return {
    id: formula.id,
    name: formula.name,
    forward,
    inverse: invertAlgorithm(forward),
  };
}
