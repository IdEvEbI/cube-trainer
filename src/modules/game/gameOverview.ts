import { isRotationMove } from "../score/solveMetrics.ts";
import { countRotationsDisplay } from "../score/solveAlgDisplay.ts";
import type { CfopPhaseSolution } from "./cfopSolve.ts";

export type GameSolveOverview = {
  /** 还原公式总步数（不含 x/y/z 转体；宽层 / 中层计入）。 */
  moves: number;
  /** 转体次数（与复盘展示口径一致，消相邻空转）。 */
  rotations: number;
};

/** 由 CFOP 分段公式汇总总览（不含打乱）。 */
export function buildGameSolveOverview(
  phases: readonly CfopPhaseSolution[],
): GameSolveOverview {
  const tokens = phases.flatMap((phase) => phase.moves);
  let moves = 0;
  for (const token of tokens) {
    if (!isRotationMove(token)) {
      moves += 1;
    }
  }
  return {
    moves,
    rotations: countRotationsDisplay(tokens),
  };
}
