/**
 * 固定色心语义下的中层 / 宽层：期望 facelets 与「禁止 Twisty.alg 直接播切片」判定。
 * CubeView / 引导对表共用，避免 UI 与单测各写一套。
 */

import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
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
import { isRotationGuideToken } from "./guided.ts";

export {
  guideAlgToCubingAlg,
  guideTokenToCubingAlg,
} from "../game/algStateMatch.ts";

/** 绝对 alg 中的公式转体（x/y/z），供钉色心后恢复黄上等姿态。 */
export function orientationAlgFromAbsolute(alg: string): string {
  return alg
    .trim()
    .split(/\s+/)
    .filter((token) => token && isRotationGuideToken(token))
    .join(" ");
}

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
 * 绝对 alg → 层转跟手参考 pattern（角棱钉中心 + cubing raw 色心）。
 * 仅供 `scrambleGuideLayerFollow` 等 XF 参考；**静态 3D 贴图**用
 * {@link absoluteAlgToNailedDisplayPattern}（魔域固定色心）。
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
 * 绝对 alg → 钉色心 pattern（facelets/对表等非跟转 3D 用途）。
 * - 角棱：整段 alg 后钉死切片/宽层对色心的偷换
 * - 色心：只保留公式 x/y/z（如 Cross `z2` 黄上）
 * **蓝牙跟转 3D 不要用**：跟转走 `setAbsoluteAlg` 公式旋转（宽层 `l` 顶心为蓝等公式语义）。
 */
export async function absoluteAlgToNailedDisplayPattern(
  alg: string,
): Promise<KPattern> {
  const puzzle = await cube3x3x3.kpuzzle();
  const id = puzzle.defaultPattern();
  const trimmed = guideAlgToCubingAlg(alg);
  if (!trimmed) {
    return id;
  }
  const nailed = nailFixedCenters(id.applyAlg(trimmed));
  const orientAlg = orientationAlgFromAbsolute(trimmed);
  if (!orientAlg) {
    return nailed;
  }
  const orientCenters = id.applyAlg(orientAlg).patternData.CENTERS;
  return new KPattern(nailed.kpuzzle, {
    CORNERS: nailed.patternData.CORNERS,
    EDGES: nailed.patternData.EDGES,
    CENTERS: {
      pieces: [...orientCenters.pieces],
      orientation: [...orientCenters.orientation],
      orientationMod: [...(orientCenters.orientationMod ?? [1, 1, 1, 1, 1, 1])],
    },
  });
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
