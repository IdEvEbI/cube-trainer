import {
  applyGuidedMove,
  guidedScrambleView,
  isFaceGuideToken,
  parseFaceTurn,
  type ApplyGuidedMoveResult,
  type GuidedScramble,
} from "../scramble/guided.ts";
import { remapGripTokenToPuzzleHint } from "./guideOrientation.ts";
import { absoluteMoveToGripGuide } from "./guideOrientation.ts";

/**
 * 用蓝牙绝对面转推进引导：与公式握持记号在「公式转体」下的绝对面比较，
 * 避免实体略微 yaw 后 abs→grip 把 L' 读成 F'。
 */
export function applyGuidedBleAbsoluteMove(
  guide: GuidedScramble,
  absoluteMove: string,
  formulaOrients: readonly string[],
): ApplyGuidedMoveResult {
  const token =
    guide.phase === "done" || guide.progress >= guide.displayMoves.length
      ? null
      : (guide.displayMoves[guide.progress] ?? null);

  if (!token || !isFaceGuideToken(token)) {
    return { guide, kind: "need_manual" };
  }

  const view = guidedScrambleView(guide);
  if (view.correction) {
    // 纠错栈里是握持记号；绝对步先映回握持再交给原逻辑。
    return applyGuidedMove(
      guide,
      absoluteMoveToGripGuide(absoluteMove, formulaOrients),
    );
  }

  if (view.currentIsDouble && !view.partial) {
    const { face } = parseFaceTurn(token);
    const absCw = remapGripTokenToPuzzleHint(face, formulaOrients);
    const absCcw = remapGripTokenToPuzzleHint(`${face}'`, formulaOrients);
    if (absoluteMove === absCw) {
      return applyGuidedMove(guide, face);
    }
    if (absoluteMove === absCcw) {
      return applyGuidedMove(guide, `${face}'`);
    }
  } else if (view.expectedMove) {
    const expectedAbs = remapGripTokenToPuzzleHint(
      view.expectedMove,
      formulaOrients,
    );
    if (absoluteMove === expectedAbs) {
      return applyGuidedMove(guide, view.expectedMove);
    }
  }

  return applyGuidedMove(
    guide,
    absoluteMoveToGripGuide(absoluteMove, formulaOrients),
  );
}
