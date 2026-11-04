/** 一次计时过程中的带时刻转动（atMs 相对开表）。 */
export type TimedSolveMove = {
  move: string;
  atMs: number;
};

const FACE_MOVE = /^[URFDLB](?:2|')?$/i;
const ROTATION_MOVE = /^[xyz](?:2|')?$/i;

/** 停顿阈值：间隔超过该值计入停顿（毫秒）。 */
export const SOLVE_PAUSE_THRESHOLD_MS = 500;

export function isFaceMove(move: string): boolean {
  return FACE_MOVE.test(move.trim());
}

export function isRotationMove(move: string): boolean {
  return ROTATION_MOVE.test(move.trim());
}

/** 面转记号条数（未合并；R 与 R2 各计 1）。蓝牙原始四分之一转请用 HTM。 */
export function countFaceMoves(moves: readonly string[]): number {
  let n = 0;
  for (const move of moves) {
    if (isFaceMove(move)) {
      n += 1;
    }
  }
  return n;
}

export function countRotations(moves: readonly string[]): number {
  let n = 0;
  for (const move of moves) {
    if (isRotationMove(move)) {
      n += 1;
    }
  }
  return n;
}

/** TPS = 步进数 / 秒；时间为 0 时返回 0。 */
export function computeTps(faceMoves: number, timeMs: number): number {
  if (timeMs <= 0 || faceMoves <= 0) {
    return 0;
  }
  return faceMoves / (timeMs / 1000);
}

/**
 * 停顿率：开表→首转、转与转、末转→停表 的间隔中，
 * 超过阈值的间隔之和 / 总时间。
 */
export function computePauseRate(
  timedMoves: readonly TimedSolveMove[],
  totalTimeMs: number,
  thresholdMs: number = SOLVE_PAUSE_THRESHOLD_MS,
): number {
  if (totalTimeMs <= 0) {
    return 0;
  }
  const gaps: number[] = [];
  let prev = 0;
  for (const step of timedMoves) {
    gaps.push(Math.max(0, step.atMs - prev));
    prev = step.atMs;
  }
  gaps.push(Math.max(0, totalTimeMs - prev));
  let pauseMs = 0;
  for (const gap of gaps) {
    if (gap > thresholdMs) {
      pauseMs += gap;
    }
  }
  return Math.min(1, pauseMs / totalTimeMs);
}

export type SolveOverviewMetrics = {
  timeMs: number;
  moves: number;
  rotations: number;
  tps: number;
  pauseRate: number;
};

export function computeOverviewMetrics(
  timedMoves: readonly TimedSolveMove[],
  totalTimeMs: number,
  options: {
    /** 面转步数；默认按记号条数。复盘应传入 HTM（R2=1）。 */
    faceMoves?: number;
    rotations?: number;
  } = {},
): SolveOverviewMetrics {
  const tokens = timedMoves.map((step) => step.move);
  const moves = options.faceMoves ?? countFaceMoves(tokens);
  const rotations = options.rotations ?? countRotations(tokens);
  return {
    timeMs: Math.max(0, Math.trunc(totalTimeMs)),
    moves,
    rotations,
    tps: computeTps(moves, totalTimeMs),
    pauseRate: computePauseRate(timedMoves, totalTimeMs),
  };
}
