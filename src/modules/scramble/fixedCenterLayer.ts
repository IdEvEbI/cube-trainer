/**
 * 固定色心语义下的中层 / 宽层：期望 facelets 与「禁止 Twisty.alg 直接播切片」判定。
 * CubeView / 引导对表共用，避免 UI 与单测各写一套。
 */

import { Alg } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import {
  faceletsMidColumn,
  kpatternToFacelets,
} from "../bluetooth/moyu/pattern.ts";
import {
  expectedFixedCenterPattern,
  guideAlgToCubingAlg,
  nailFixedCenters,
  withRawSliceCenters,
} from "../game/algStateMatch.ts";

export {
  guideAlgToCubingAlg,
  guideTokenToCubingAlg,
} from "../game/algStateMatch.ts";

/** 含中层 / 宽层的绝对 alg 不能交给 Twisty.alg（会带走色心）。 */
export function algNeedsFixedCenterPaint(alg: string): boolean {
  const trimmed = alg.trim();
  if (!trimmed) {
    return false;
  }
  try {
    for (const leaf of new Alg(trimmed).experimentalLeafMoves()) {
      if (/^[MESudlrfb]/.test(leaf.toString())) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * 绝对 alg → 3D 贴图：角棱钉中心置换 + cubing raw 色心。
 * facelets 字母串对 nail/raw 相同，但 Twisty transformation 不同——钉死色心会把
 * `M` 后顶心画成白，与实体不符；必须带 raw 色心。mesh 仍锁单位（勿跟手双计）。
 */
export async function absoluteAlgToFixedCenterPattern(
  alg: string,
): Promise<KPattern> {
  const puzzle = await cube3x3x3.kpuzzle();
  const id = puzzle.defaultPattern();
  const trimmed = guideAlgToCubingAlg(alg);
  if (!trimmed) {
    return id;
  }
  const raw = id.applyAlg(trimmed);
  return withRawSliceCenters(raw, raw);
}

/**
 * 绝对 alg → 蓝牙同构 facelets（钉中心字母，供对表）。
 * 注意：与 {@link absoluteAlgToFixedCenterPattern} 色心处理不同。
 */
export async function absoluteAlgToFixedCenterFacelets(
  alg: string,
): Promise<string> {
  const puzzle = await cube3x3x3.kpuzzle();
  const id = puzzle.defaultPattern();
  const trimmed = guideAlgToCubingAlg(alg);
  if (!trimmed) {
    return kpatternToFacelets(id);
  }
  return kpatternToFacelets(nailFixedCenters(id.applyAlg(trimmed)));
}

/** 公式前缀步数 → 期望 facelets（引导对表用）。 */
export async function expectedFixedCenterFacelets(
  moves: readonly string[],
  count: number,
): Promise<string> {
  return kpatternToFacelets(await expectedFixedCenterPattern(moves, count));
}

export type LayerFaceFingerprint = {
  /** U 面中列（上中下） */
  uMid: string;
  /** F 面中列（上中下） */
  fMid: string;
  /** U 面中心色字母 */
  uCenter: string;
  /** F 面中心色字母 */
  fCenter: string;
};

export function faceletsLayerFingerprint(
  facelets: string,
): LayerFaceFingerprint {
  return {
    uMid: faceletsMidColumn(facelets, "U"),
    fMid: faceletsMidColumn(facelets, "F"),
    uCenter: facelets.length === 54 ? facelets[4]! : "?",
    fCenter: facelets.length === 54 ? facelets[22]! : "?",
  };
}
