import {
  buildBluetoothSolveStats,
  type BluetoothSolveStats,
} from "./bluetoothSolveStats.ts";
import type { SolveTrace } from "./solveTrace.ts";

/**
 * 全屏复盘页数据：在分段统计上保留完整 trace，供回放等后续步骤使用。
 */
export type SolveReview = BluetoothSolveStats & {
  trace: SolveTrace;
};

/**
 * 由 solveTrace 快照 + 停表时长生成复盘数据（含每段公式）。
 */
export async function buildSolveReview(input: {
  trace: SolveTrace;
  totalTimeMs: number;
}): Promise<SolveReview> {
  const timedMoves = input.trace.steps.map((step) => ({
    move: step.move,
    atMs: step.atMs,
  }));
  const stats = await buildBluetoothSolveStats({
    scramble: input.trace.scramble,
    startSetupAlg: input.trace.startSetupAlg,
    timedMoves,
    totalTimeMs: input.totalTimeMs,
  });
  return {
    ...stats,
    trace: {
      version: input.trace.version,
      scramble: input.trace.scramble,
      startSetupAlg: input.trace.startSetupAlg,
      steps: input.trace.steps.map((step) => ({ ...step })),
    },
  };
}
