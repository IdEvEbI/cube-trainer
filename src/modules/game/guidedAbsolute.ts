import {
  applyGuidedMove,
  guidedScrambleView,
  isFaceGuideToken,
  parseFaceTurn,
  type ApplyGuidedMoveResult,
  type GuidedScramble,
} from "../scramble/guided.ts";
import { resolveGuideBleFaceMoveWithCandidates } from "../scramble/guideBleFaceRemap.ts";
import {
  completedOrientationMoves,
  remapGripTokenToPuzzleHint,
} from "./guideOrientation.ts";

/**
 * 按朝向候选串依次映面（match → hint → …），命中期望即停。
 */
export function resolveWithOrientFallback(
  absoluteMove: string,
  expected: string | null | undefined,
  matchOrients: readonly string[],
  hintOrients: readonly string[],
  extraOrientAlgs: readonly string[] = [],
): string {
  return resolveGuideBleFaceMoveWithCandidates(absoluteMove, expected, [
    matchOrients.join(" "),
    hintOrients.join(" "),
    ...extraOrientAlgs,
  ]);
}

function resolveWithOrientAlgs(
  absoluteMove: string,
  expected: string | null | undefined,
  orientAlgs: readonly string[],
): string {
  return resolveGuideBleFaceMoveWithCandidates(
    absoluteMove,
    expected,
    orientAlgs,
  );
}

/**
 * 蓝牙绝对面转 → 引导握持四分之一（与 {@link applyGuidedBleAbsoluteMoveWithOrientAlgs} 记账同一串）。
 * 双步首半：按候选朝向把绝对面匹配到正/反握持，勿用 expected 正转字母单独 resolve。
 */
export function resolveGuidedBleAbsoluteGripMove(
  guide: GuidedScramble,
  absoluteMove: string,
  orientAlgs: readonly string[],
): string {
  const token =
    guide.phase === "done" || guide.progress >= guide.displayMoves.length
      ? null
      : (guide.displayMoves[guide.progress] ?? null);

  if (!token || !isFaceGuideToken(token)) {
    return absoluteMove.trim();
  }

  const view = guidedScrambleView(guide);
  // 公式已含 z2 y/y' 时置前，避免脏首项 relative 抢映（#180）；裸 z2 不置前。
  const formulaAlg = completedOrientationMoves(
    guide.displayMoves,
    guide.progress,
  ).join(" ");
  const prependFormulaYaw = formulaAlg === "z2 y" || formulaAlg === "z2 y'";
  const algs =
    orientAlgs.length > 0
      ? prependFormulaYaw && !orientAlgs.includes(formulaAlg)
        ? [formulaAlg, ...orientAlgs]
        : [...orientAlgs]
      : prependFormulaYaw
        ? [formulaAlg]
        : [""];

  if (view.correction) {
    return resolveWithOrientAlgs(absoluteMove, view.correction, algs);
  }

  if (view.currentIsDouble && !view.partial) {
    const { face } = parseFaceTurn(token);
    for (const alg of algs) {
      const orients = alg.split(/\s+/).filter(Boolean);
      const absCw = remapGripTokenToPuzzleHint(face, orients);
      const absCcw = remapGripTokenToPuzzleHint(`${face}'`, orients);
      if (absoluteMove === absCw) {
        return face;
      }
      if (absoluteMove === absCcw) {
        return `${face}'`;
      }
    }
    return resolveWithOrientAlgs(absoluteMove, face, algs);
  }

  if (view.expectedMove) {
    return resolveWithOrientAlgs(absoluteMove, view.expectedMove, algs);
  }

  return resolveWithOrientAlgs(absoluteMove, null, algs);
}

/**
 * 用蓝牙绝对面转推进引导（朝向候选串，与 {@link resolveGuideBleFaceMoveWithCandidates} 一致）。
 */
export function applyGuidedBleAbsoluteMoveWithOrientAlgs(
  guide: GuidedScramble,
  absoluteMove: string,
  orientAlgs: readonly string[],
): ApplyGuidedMoveResult {
  const token =
    guide.phase === "done" || guide.progress >= guide.displayMoves.length
      ? null
      : (guide.displayMoves[guide.progress] ?? null);

  if (!token || !isFaceGuideToken(token)) {
    return { guide, kind: "need_manual" };
  }

  return applyGuidedMove(
    guide,
    resolveGuidedBleAbsoluteGripMove(guide, absoluteMove, orientAlgs),
  );
}

/**
 * 用蓝牙绝对面转推进引导：match + hint（及可选额外朝向串）。
 */
export function applyGuidedBleAbsoluteMove(
  guide: GuidedScramble,
  absoluteMove: string,
  matchOrients: readonly string[],
  hintOrients: readonly string[] = matchOrients,
  extraOrientAlgs: readonly string[] = [],
): ApplyGuidedMoveResult {
  return applyGuidedBleAbsoluteMoveWithOrientAlgs(guide, absoluteMove, [
    matchOrients.join(" "),
    hintOrients.join(" "),
    ...extraOrientAlgs,
  ]);
}
