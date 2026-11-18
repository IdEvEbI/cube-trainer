import {
  applyGuidedMove,
  formulaExpectedFaceQuarter,
  guidedScrambleView,
  isFaceGuideToken,
  isOuterFaceQuarterGuideToken,
  isSameFaceInverseQuarter,
  parseFaceTurn,
  type ApplyGuidedMoveResult,
  type GuidedScramble,
} from "../scramble/guided.ts";
import { resolveGuideBleFaceMoveWithCandidates } from "../scramble/guideBleFaceRemap.ts";
import {
  completedOrientationMoves,
  remapGripTokenToPuzzleHint,
} from "./guideOrientation.ts";

function guideFaceLetter(move: string): string {
  return (move.trim()[0] ?? "").toUpperCase();
}

export { isSameFaceInverseQuarter };

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
 * 双步外面转：两半共用同一张握持→绝对映面。
 * 命中返回握持四分之一；未命中返回 null（勿回落成异面纠错）。
 */
export function matchDoubleFaceAbsoluteGripMove(
  absoluteMove: string,
  face: string,
  dirs: ReadonlyArray<"" | "'">,
  orientAlgs: readonly string[],
): string | null {
  const absolute = absoluteMove.trim();
  if (!absolute || !face) {
    return null;
  }
  const algs = orientAlgs.length > 0 ? orientAlgs : [""];
  for (const alg of algs) {
    const orients = alg.split(/\s+/).filter(Boolean);
    for (const dir of dirs) {
      const grip = `${face}${dir}`;
      if (absolute === remapGripTokenToPuzzleHint(grip, orients)) {
        return grip;
      }
    }
  }
  return null;
}

/**
 * 蓝牙绝对面转 → 引导握持四分之一（与 {@link applyGuidedBleAbsoluteMoveWithOrientAlgs} 记账同一串）。
 * 双步两半：按候选朝向把绝对面匹配到正/反握持，勿用 expected 正转字母单独 resolve。
 * 未命中双步绝对映面时返回 null（调用方须 need_manual，禁止异面进 wrongStack）。
 */
export function resolveGuidedBleAbsoluteGripMove(
  guide: GuidedScramble,
  absoluteMove: string,
  orientAlgs: readonly string[],
): string | null {
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

  if (view.currentIsDouble) {
    const { face } = parseFaceTurn(token);
    const dirs: Array<"" | "'"> = view.partial
      ? [guide.halfDir ?? ""]
      : ["", "'"];
    // 公式朝向优先，再试其余候选；两半同一匹配，不为某一双步记号单开。
    const ordered = formulaAlg
      ? [formulaAlg, ...algs.filter((alg) => alg.trim() !== formulaAlg)]
      : algs;
    return matchDoubleFaceAbsoluteGripMove(absoluteMove, face, dirs, ordered);
  }

  // 映面须用公式期望（U），勿用 UI「还差」文案（U2），以免干扰中层/宽边。
  const stepExpected = formulaExpectedFaceQuarter(guide);
  if (stepExpected) {
    // 外面转且候选里已有公式朝向、又夹着脏 relative/层转时：若纯公式映面已与
    // 期望同面（握持 R vs 期望 R'），优先公式，勿被 z2 y 把 L 收成 F、R 收成 B。
    if (isOuterFaceQuarterGuideToken(stepExpected) && formulaAlg) {
      const formulaInAlgs = algs.some((alg) => {
        const t = alg.trim();
        return t === formulaAlg || t.startsWith(`${formulaAlg} `);
      });
      const dirtyBesideFormula = algs.some((alg) => {
        const t = alg.trim();
        return Boolean(t) && t !== formulaAlg;
      });
      if (formulaInAlgs && dirtyBesideFormula) {
        const viaFormula = resolveWithOrientAlgs(absoluteMove, stepExpected, [
          formulaAlg,
        ]);
        if (
          viaFormula === stepExpected ||
          guideFaceLetter(viaFormula) === guideFaceLetter(stepExpected)
        ) {
          return viaFormula;
        }
      }
    }
    return resolveWithOrientAlgs(absoluteMove, stepExpected, algs);
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

  const resolved = resolveGuidedBleAbsoluteGripMove(
    guide,
    absoluteMove,
    orientAlgs,
  );
  if (resolved === null) {
    return { guide, kind: "need_manual" };
  }

  return applyGuidedMove(guide, resolved);
}
export type GamePageBleFaceStep = {
  absolute: string;
  resolved: string;
  kind: ApplyGuidedMoveResult["kind"];
  guide: GuidedScramble;
  correction: string | null;
  enteredCorrection: boolean;
  playMove: string;
};

/**
 * 游戏页跟转单包：resolve + apply 同一握持串。
 * #181：同面反转×3 ≡ 期望步推进；不满 3 为 absorb，不进纠错展示。
 */
export function stepGamePageBleAbsoluteFace(
  guide: GuidedScramble,
  absoluteMove: string,
  orientAlgs: readonly string[],
): GamePageBleFaceStep {
  const absolute = absoluteMove.trim();
  const resolved =
    resolveGuidedBleAbsoluteGripMove(guide, absolute, orientAlgs) ?? absolute;
  const result = applyGuidedBleAbsoluteMoveWithOrientAlgs(
    guide,
    absolute,
    orientAlgs,
  );
  const view = guidedScrambleView(result.guide);
  return {
    absolute,
    resolved: result.kind === "need_manual" ? absolute : resolved,
    kind: result.kind,
    guide: result.guide,
    correction: view.correction,
    enteredCorrection:
      result.kind === "wrong" ||
      (result.guide.wrongStack.length > 0 && Boolean(view.correction)),
    playMove: result.kind === "need_manual" ? absolute : resolved,
  };
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
