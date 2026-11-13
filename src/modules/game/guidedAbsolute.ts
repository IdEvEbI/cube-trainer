import {
  applyGuidedMove,
  guidedScrambleView,
  isFaceGuideToken,
  parseFaceTurn,
  type ApplyGuidedMoveResult,
  type GuidedScramble,
} from "../scramble/guided.ts";
import { resolveGuideBleFaceMoveWithCandidates } from "../scramble/guideBleFaceRemap.ts";
import { remapGripTokenToPuzzleHint } from "./guideOrientation.ts";

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

  const view = guidedScrambleView(guide);
  const algs = orientAlgs.length > 0 ? orientAlgs : [""];

  if (view.correction) {
    return applyGuidedMove(
      guide,
      resolveWithOrientAlgs(absoluteMove, view.correction, algs),
    );
  }

  if (view.currentIsDouble && !view.partial) {
    const { face } = parseFaceTurn(token);
    for (const alg of algs) {
      const orients = alg.split(/\s+/).filter(Boolean);
      const absCw = remapGripTokenToPuzzleHint(face, orients);
      const absCcw = remapGripTokenToPuzzleHint(`${face}'`, orients);
      if (absoluteMove === absCw) {
        return applyGuidedMove(guide, face);
      }
      if (absoluteMove === absCcw) {
        return applyGuidedMove(guide, `${face}'`);
      }
    }
    return applyGuidedMove(
      guide,
      resolveWithOrientAlgs(absoluteMove, face, algs),
    );
  }

  if (view.expectedMove) {
    return applyGuidedMove(
      guide,
      resolveWithOrientAlgs(absoluteMove, view.expectedMove, algs),
    );
  }

  return applyGuidedMove(
    guide,
    resolveWithOrientAlgs(absoluteMove, null, algs),
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
