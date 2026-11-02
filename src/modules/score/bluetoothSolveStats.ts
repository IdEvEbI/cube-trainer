import {
  CFOP_PHASE_LABELS,
  CFOP_PHASE_ORDER,
  type CfopPhaseId,
  splitCfopPhaseEnds,
} from "./cfopSplit.ts";
import {
  computeOverviewMetrics,
  computePauseRate,
  computeTps,
  countFaceMoves,
  countRotations,
  type SolveOverviewMetrics,
  type TimedSolveMove,
} from "./solveMetrics.ts";

export type CfopPhaseStats = {
  id: CfopPhaseId;
  label: string;
  timeMs: number;
  timeShare: number;
  moves: number;
  rotations: number;
  tps: number;
  pauseRate: number;
};

export type BluetoothSolveStats = {
  overview: SolveOverviewMetrics;
  phases: CfopPhaseStats[];
  scramble: string;
  /** 开表时相对复原的 setup（连接 setup + 此前转动）。 */
  startSetupAlg: string;
  timedMoves: TimedSolveMove[];
};

function sliceTimedMoves(
  timedMoves: readonly TimedSolveMove[],
  startIndex: number,
  endExclusive: number,
): TimedSolveMove[] {
  const localStart =
    startIndex === 0 ? 0 : (timedMoves[startIndex - 1]?.atMs ?? 0);
  return timedMoves.slice(startIndex, endExclusive).map((step) => ({
    move: step.move,
    atMs: Math.max(0, step.atMs - localStart),
  }));
}

function phaseTimeMs(
  timedMoves: readonly TimedSolveMove[],
  startIndex: number,
  endExclusive: number,
  totalTimeMs: number,
): number {
  if (endExclusive <= startIndex) {
    return 0;
  }
  const startAt =
    startIndex === 0 ? 0 : (timedMoves[startIndex - 1]?.atMs ?? 0);
  const endAt =
    endExclusive >= timedMoves.length
      ? totalTimeMs
      : (timedMoves[endExclusive - 1]?.atMs ?? totalTimeMs);
  return Math.max(0, Math.trunc(endAt - startAt));
}

/**
 * 由开表状态 + 计时中转动生成总览与 CFOP 分段（基础切分）。
 */
export async function buildBluetoothSolveStats(input: {
  scramble: string;
  startSetupAlg: string;
  timedMoves: readonly TimedSolveMove[];
  totalTimeMs: number;
}): Promise<BluetoothSolveStats> {
  const totalTimeMs = Math.max(0, Math.trunc(input.totalTimeMs));
  const timedMoves = input.timedMoves.map((step) => ({
    move: step.move.trim(),
    atMs: Math.max(0, Math.trunc(step.atMs)),
  }));
  const overview = computeOverviewMetrics(timedMoves, totalTimeMs);
  const solveTokens = timedMoves.map((step) => step.move);
  const ends = await splitCfopPhaseEnds(input.startSetupAlg, solveTokens);

  const phases: CfopPhaseStats[] = [];
  let prev = 0;
  for (let i = 0; i < CFOP_PHASE_ORDER.length; i += 1) {
    const id = CFOP_PHASE_ORDER[i]!;
    const end = ends[i] ?? solveTokens.length;
    const start = prev;
    const span = Math.max(start, end);
    const timeMs = phaseTimeMs(timedMoves, start, span, totalTimeMs);
    const slice = sliceTimedMoves(timedMoves, start, span);
    const tokens = slice.map((step) => step.move);
    const moves = countFaceMoves(tokens);
    const rotations = countRotations(tokens);
    phases.push({
      id,
      label: CFOP_PHASE_LABELS[id],
      timeMs,
      timeShare: totalTimeMs > 0 ? timeMs / totalTimeMs : 0,
      moves,
      rotations,
      tps: computeTps(moves, timeMs),
      pauseRate: computePauseRate(slice, timeMs),
    });
    prev = span;
  }

  return {
    overview,
    phases,
    scramble: input.scramble.trim(),
    startSetupAlg: input.startSetupAlg.trim(),
    timedMoves,
  };
}

export function formatShare(share: number): string {
  return `${Math.round(share * 1000) / 10}%`;
}

export function formatTps(tps: number): string {
  return tps.toFixed(2);
}

export function formatPauseRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
