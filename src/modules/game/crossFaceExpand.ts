/**
 * 把 Cross 段里的宽层 / 中层展开成「固定色心」下的面转。
 *
 * @moishy/cfop 输出在黄上握持帧（打乱经 z2 共轭后求解），cubing 的 M/E/S / 宽层会带走中心；
 * 实体蓝牙魔方中心固定，后续 L' 等会整段错位。按逐步状态差拆成白上绝对面转，再映回握持记号。
 */

import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { isRotationGuideToken } from "../scramble/guided.ts";
import { absoluteFaceMoveToGrip } from "../score/solveAlgDisplay.ts";
import {
  patternsMatchIgnoringCenters,
  restoreFixedCenters,
} from "./algStateMatch.ts";
import type { CfopPhaseSolution } from "./cfopSolve.ts";

const FACE_FAMILIES = ["U", "D", "L", "R", "F", "B"] as const;
const FACE_SUFFIXES = ["", "'", "2"] as const;

function faceTokensBetween(
  fromPattern: KPattern,
  toPattern: KPattern,
): string[] | null {
  const from = restoreFixedCenters(fromPattern);
  const to = restoreFixedCenters(toPattern);
  if (patternsMatchIgnoringCenters(from, to)) {
    return [];
  }
  for (const face of FACE_FAMILIES) {
    for (const suffix of FACE_SUFFIXES) {
      const token = `${face}${suffix}`;
      if (patternsMatchIgnoringCenters(from.applyAlg(token), to)) {
        return [token];
      }
    }
  }
  for (const face1 of FACE_FAMILIES) {
    for (const suffix1 of FACE_SUFFIXES) {
      for (const face2 of FACE_FAMILIES) {
        for (const suffix2 of FACE_SUFFIXES) {
          const a = `${face1}${suffix1}`;
          const b = `${face2}${suffix2}`;
          if (patternsMatchIgnoringCenters(from.applyAlg(`${a} ${b}`), to)) {
            return [a, b];
          }
        }
      }
    }
  }
  return null;
}

/**
 * 将一段（通常是 Cross）公式展开为 z/x/y + 纯面转，贴纸效果与原式在固定色心下一致。
 */
export async function expandMovesToFixedCenterFaces(
  scramble: string,
  phaseMoves: readonly string[],
): Promise<string[]> {
  const puzzle = await cube3x3x3.kpuzzle();
  let state = puzzle.defaultPattern();
  const scrambleTrim = scramble.trim();
  if (scrambleTrim !== "") {
    state = state.applyAlg(scrambleTrim);
  }
  const out: string[] = [];
  const orientation: string[] = [];

  for (const raw of phaseMoves) {
    const move = raw.trim();
    if (!move) {
      continue;
    }
    const next = state.applyAlg(move);
    if (isRotationGuideToken(move)) {
      out.push(move);
      orientation.push(move);
      state = next;
      continue;
    }
    const absoluteFaces = faceTokensBetween(state, next);
    if (absoluteFaces === null) {
      throw new Error(`无法把 ${move} 展开为固定色心面转`);
    }
    for (const abs of absoluteFaces) {
      out.push(absoluteFaceMoveToGrip(abs, orientation));
    }
    state = next;
  }
  return out;
}

/** 只改 Cross 段；F2L / OLL / PLL 原样。 */
export async function expandCrossPhaseToFaceMoves(
  scramble: string,
  phases: readonly CfopPhaseSolution[],
): Promise<CfopPhaseSolution[]> {
  const next: CfopPhaseSolution[] = phases.map((phase) => ({
    id: phase.id,
    moves: [...phase.moves],
  }));
  const cross = next.find((phase) => phase.id === "Cross");
  if (!cross || cross.moves.length === 0) {
    return next;
  }
  cross.moves = await expandMovesToFixedCenterFaces(scramble, cross.moves);
  return next;
}
