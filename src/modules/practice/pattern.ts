import { F2L_PATTERNS } from "./f2l-patterns.ts";
import { OLL_PATTERNS } from "./oll-patterns.ts";
import { PLL_PATTERNS } from "./pll-patterns.ts";
import type { FormulaPattern } from "./pattern-types.ts";

export type {
  CubeFaces,
  FormulaPattern,
  PatternPaint,
  TopSticker,
} from "./pattern-types.ts";

const PATTERNS: Record<string, FormulaPattern> = {
  ...OLL_PATTERNS,
  ...PLL_PATTERNS,
  ...F2L_PATTERNS,
};

export function formulaPattern(id: string): FormulaPattern | null {
  return PATTERNS[id] ?? null;
}

export function hasOllPattern(id: string): boolean {
  return Object.hasOwn(OLL_PATTERNS, id);
}

export function hasPllPattern(id: string): boolean {
  return Object.hasOwn(PLL_PATTERNS, id);
}

export function hasF2lPattern(id: string): boolean {
  return Object.hasOwn(F2L_PATTERNS, id);
}
