import { parseScramble } from "./scramble.ts";

/**
 * 非蓝牙打乱自动播放：单步墙钟毫秒（含转动动画）。
 * 偏慢，方便对照实体魔方跟拧；练习页仍用 `PLAYBACK_STEP_MS`。
 */
export const SCRAMBLE_PLAYBACK_STEP_MS = 800;

/** Cursor over a face-turn scramble: index 0 = solved, length = fully scrambled. */
export type ScrambleCursor = {
  moves: string[];
  index: number;
};

export function createScrambleCursor(source: string): ScrambleCursor {
  return {
    moves: parseScramble(source),
    index: 0,
  };
}

export function isScrambleAtStart(cursor: ScrambleCursor): boolean {
  return cursor.index <= 0;
}

export function isScrambleAtEnd(cursor: ScrambleCursor): boolean {
  return cursor.index >= cursor.moves.length;
}

export function scrambleAtStart(cursor: ScrambleCursor): ScrambleCursor {
  return { ...cursor, index: 0 };
}

export function scrambleAtEnd(cursor: ScrambleCursor): ScrambleCursor {
  return { ...cursor, index: cursor.moves.length };
}

export function scrambleStepNext(cursor: ScrambleCursor): ScrambleCursor {
  return {
    ...cursor,
    index: Math.min(cursor.moves.length, cursor.index + 1),
  };
}

export function scrambleStepPrevious(cursor: ScrambleCursor): ScrambleCursor {
  return { ...cursor, index: Math.max(0, cursor.index - 1) };
}

/** Prefix of the scramble applied so far (empty = white-up green-front solved). */
export function scrambleDisplayedMoves(cursor: ScrambleCursor): string {
  return cursor.moves.slice(0, cursor.index).join(" ");
}

/** Index of the step just applied, or null at solved. */
export function scrambleHighlightedStep(cursor: ScrambleCursor): number | null {
  if (cursor.index <= 0 || cursor.moves.length === 0) {
    return null;
  }
  return Math.min(cursor.index, cursor.moves.length) - 1;
}

/**
 * 公式条「当前步」高亮：游标停在「即将 / 正在执行」的步上。
 * 播放时须等该步动画结束后再 `scrambleStepNext`，否则会快一拍。
 */
export function scrambleCurrentStepIndex(
  cursor: ScrambleCursor,
): number | null {
  if (cursor.moves.length === 0 || isScrambleAtEnd(cursor)) {
    return null;
  }
  return cursor.index;
}
