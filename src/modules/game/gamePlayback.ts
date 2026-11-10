import type { CfopPhaseId, CfopPhaseSolution } from "./cfopSolve.ts";

/** 游戏页分段：打乱 + CFOP 各段。 */
export type GameSegmentId = "scramble" | CfopPhaseId;

export type GameSegmentRange = {
  id: GameSegmentId;
  label: string;
  moves: string[];
  /** flatMoves 上 [start, end) */
  start: number;
  end: number;
};

/**
 * 游戏页回放游标。
 * index 0 = 复原起点；index === flatMoves.length = 打乱+解全部播完。
 */
export type GamePageCursor = {
  scrambleMoves: string[];
  phases: CfopPhaseSolution[];
  segments: GameSegmentRange[];
  flatMoves: string[];
  index: number;
};

export function createGamePageCursor(
  scrambleMoves: readonly string[],
  phases: readonly CfopPhaseSolution[],
): GamePageCursor {
  const scramble = [...scrambleMoves];
  const flatMoves: string[] = [];
  const segments: GameSegmentRange[] = [];

  segments.push({
    id: "scramble",
    label: "打乱",
    moves: scramble,
    start: 0,
    end: scramble.length,
  });
  flatMoves.push(...scramble);

  for (const phase of phases) {
    const start = flatMoves.length;
    const moves = [...phase.moves];
    flatMoves.push(...moves);
    segments.push({
      id: phase.id,
      label: phase.id,
      moves,
      start,
      end: flatMoves.length,
    });
  }

  return {
    scrambleMoves: scramble,
    phases: phases.map((phase) => ({
      id: phase.id,
      moves: [...phase.moves],
    })),
    segments,
    flatMoves,
    index: 0,
  };
}

export function isGamePageAtStart(cursor: GamePageCursor): boolean {
  return cursor.index <= 0;
}

export function isGamePageAtEnd(cursor: GamePageCursor): boolean {
  return cursor.index >= cursor.flatMoves.length;
}

export function gamePageAtStart(cursor: GamePageCursor): GamePageCursor {
  return { ...cursor, index: 0 };
}

export function gamePageAtEnd(cursor: GamePageCursor): GamePageCursor {
  return { ...cursor, index: cursor.flatMoves.length };
}

export function gamePageAtIndex(
  cursor: GamePageCursor,
  index: number,
): GamePageCursor {
  return {
    ...cursor,
    index: Math.max(0, Math.min(cursor.flatMoves.length, Math.trunc(index))),
  };
}

export function gamePageStepNext(cursor: GamePageCursor): GamePageCursor {
  return {
    ...cursor,
    index: Math.min(cursor.flatMoves.length, cursor.index + 1),
  };
}

export function gamePageStepPrevious(cursor: GamePageCursor): GamePageCursor {
  return { ...cursor, index: Math.max(0, cursor.index - 1) };
}

/** 当前绝对展示算法：已执行的打乱 + 还原步（白上绿前）。 */
export function gamePageDisplayedAlg(cursor: GamePageCursor): string {
  return cursor.flatMoves.slice(0, cursor.index).join(" ").trim();
}

export function gamePageActiveSegmentId(
  cursor: GamePageCursor,
): GameSegmentId | null {
  const { segments, index } = cursor;
  if (segments.length === 0) {
    return null;
  }
  for (const range of segments) {
    if (index >= range.start && index < range.end) {
      return range.id;
    }
  }
  if (isGamePageAtEnd(cursor)) {
    return segments[segments.length - 1]!.id;
  }
  for (const range of segments) {
    if (index === range.start) {
      return range.id;
    }
  }
  return segments[0]?.id ?? null;
}

export function gamePageProgressLabel(
  cursor: GamePageCursor,
  focusId: GameSegmentId | null,
): string {
  const activeId = focusId ?? gamePageActiveSegmentId(cursor);
  const range = cursor.segments.find((item) => item.id === activeId);
  if (!range) {
    return `${cursor.index}/${cursor.flatMoves.length}`;
  }
  const local = Math.min(
    range.end - range.start,
    Math.max(0, cursor.index - range.start),
  );
  return `${range.label} ${local}/${Math.max(range.end - range.start, 1)}`;
}

/**
 * 分段焦点下若已停在段末，则切到下一段；无下一段则整段重播。
 */
export function nextGamePagePlayRange(
  segments: readonly GameSegmentRange[],
  focusId: GameSegmentId | null,
  index: number,
  totalSteps: number,
): {
  focusId: GameSegmentId | null;
  resumeAt: number;
  end: number;
} {
  const total = Math.max(0, Math.trunc(totalSteps));
  const at = Math.max(0, Math.min(total, Math.trunc(index)));
  const focused = focusId
    ? segments.find((range) => range.id === focusId)
    : undefined;

  if (focused) {
    if (at < focused.end) {
      return { focusId, resumeAt: at, end: focused.end };
    }
    const nextIndex = segments.findIndex((range) => range.id === focusId) + 1;
    const next = segments[nextIndex];
    if (next) {
      return { focusId: next.id, resumeAt: next.start, end: next.end };
    }
    return { focusId: null, resumeAt: 0, end: total };
  }

  if (at >= total) {
    return { focusId: null, resumeAt: 0, end: total };
  }
  return { focusId: null, resumeAt: at, end: total };
}
