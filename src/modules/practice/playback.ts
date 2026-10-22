import { parseAlgorithm } from "../formula/formulas.ts";
import type { PracticeCase } from "./setup.ts";

export const PLAYBACK_STEP_MS = 500;

export type PracticeCursor = {
  forward: string[];
  inverse: string[];
  index: number;
};

export function createPracticeCursor(practice: PracticeCase): PracticeCursor {
  return {
    forward: parseAlgorithm(practice.forward),
    inverse: parseAlgorithm(practice.inverse),
    index: 0,
  };
}

export function isAtTarget(cursor: PracticeCursor): boolean {
  return cursor.index >= cursor.forward.length;
}

export function atStart(cursor: PracticeCursor): PracticeCursor {
  return { ...cursor, index: 0 };
}

export function atTarget(cursor: PracticeCursor): PracticeCursor {
  return { ...cursor, index: cursor.forward.length };
}

export function stepNext(cursor: PracticeCursor): PracticeCursor {
  return {
    ...cursor,
    index: Math.min(cursor.forward.length, cursor.index + 1),
  };
}

export function stepPrevious(cursor: PracticeCursor): PracticeCursor {
  return { ...cursor, index: Math.max(0, cursor.index - 1) };
}

export function displayedMoves(cursor: PracticeCursor): string {
  return [...cursor.inverse, ...cursor.forward.slice(0, cursor.index)].join(
    " ",
  );
}

export function highlightedStep(cursor: PracticeCursor): number | null {
  if (cursor.index <= 0 || cursor.forward.length === 0) {
    return null;
  }
  return Math.min(cursor.index, cursor.forward.length) - 1;
}

export function playbackSteps(cursor: PracticeCursor): PracticeCursor[] {
  let current = isAtTarget(cursor) ? atStart(cursor) : cursor;
  const steps: PracticeCursor[] = [];
  while (!isAtTarget(current)) {
    current = stepNext(current);
    steps.push(current);
  }
  return steps;
}
