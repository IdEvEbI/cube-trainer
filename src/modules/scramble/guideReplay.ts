/**
 * 离线回放跟拧会话（第 2 层安全网骨架）。
 * 用 GuidedScramble + GuideFollowController 重放有序事件；不改生产接线。
 *
 * 非面转步：当陀螺快照 alg 等于「完成当前步后」的期望姿态串时自动 confirm
 * （对应真机层转 / 转体到位）。面转：经残留 / 映面后再 applyGuidedMove。
 */
import { expectedGyroDeltaAlg } from "../bluetooth/moyu/moyuLayerGesture.ts";
import { IDENTITY_QUAT, type MoyuQuat } from "../bluetooth/moyu/orientation.ts";
import { completedOrientationMoves } from "../game/guideOrientation.ts";
import { quatFromOrientationAlg } from "../score/cubeOrientation.ts";
import { resolveGuideBleFaceMoveWithCandidates } from "./guideBleFaceRemap.ts";
import {
  applyGuidedMove,
  confirmGuidedManualStep,
  createGuidedMoves,
  guidedScrambleView,
  isFaceGuideToken,
  isRotationGuideToken,
  isSliceGuideToken,
  isWideGuideToken,
  scrambleGuideEchoAcceptedMoves,
  type GuidedScramble,
} from "./guided.ts";
import {
  createGuideFollowController,
  type GuideFollowController,
} from "./guideFollowController.ts";

export type GuideReplayOrientEvent = {
  type: "orient";
  /** 单调时间戳（ms），仅用于静默窗。 */
  t: number;
  /** 白上起算的姿态 alg，如 `z2` / `z2 x z`（手写，对齐文档陀螺 Δ）。 */
  alg: string;
};

export type GuideReplayFaceEvent = {
  type: "face";
  t: number;
  /** 色心绝对面转（固件包）。 */
  move: string;
};

export type GuideReplayEvent = GuideReplayOrientEvent | GuideReplayFaceEvent;

export type GuideReplayFixture = {
  id: string;
  description?: string;
  displayMoves: string[];
  /** 游戏页黄上对表；默认 true。 */
  requireYellowUp?: boolean;
  events: GuideReplayEvent[];
  expect: {
    progress: number;
    done: boolean;
    sawWrong: boolean;
  };
};

export type GuideReplayResult = {
  progress: number;
  done: boolean;
  sawWrong: boolean;
  /** 映面后等于期望并推进的色心包。 */
  acceptedFaceMoves: string[];
  /** 未收成期望、未推进的色心包。 */
  rejectedFaceMoves: string[];
  guide: GuidedScramble;
};

function normalizeAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).join(" ");
}

/**
 * 完成 `displayMoves[0..indexInclusive]` 后的期望 live 姿态串：
 * 转体原样；宽层 / 中层叠 {@link expectedGyroDeltaAlg}（文档陀螺 Δ）。
 */
export function expectedLiveOrientAlgAfterStep(
  displayMoves: readonly string[],
  indexInclusive: number,
): string {
  const parts: string[] = [];
  const end = Math.max(
    -1,
    Math.min(displayMoves.length - 1, Math.trunc(indexInclusive)),
  );
  for (let i = 0; i <= end; i += 1) {
    const token = (displayMoves[i] ?? "").trim();
    if (!token) {
      continue;
    }
    if (isRotationGuideToken(token)) {
      parts.push(token);
      continue;
    }
    if (isWideGuideToken(token) || isSliceGuideToken(token)) {
      const delta = expectedGyroDeltaAlg(token);
      if (delta) {
        for (const p of delta.split(/\s+/).filter(Boolean)) {
          parts.push(p);
        }
      }
    }
  }
  return parts.join(" ");
}

function formulaOrientsAt(
  displayMoves: readonly string[],
  progress: number,
): string[] {
  return completedOrientationMoves(displayMoves, progress);
}

function tryConfirmManualMatchingOrient(
  guide: GuidedScramble,
  ctrl: GuideFollowController,
  liveAlg: string,
  nowMs: number,
  liveQuat: MoyuQuat,
): GuidedScramble {
  let next = guide;
  // 同一快照可能连续确认多步（少见）；通常一步一帧。
  for (let guard = 0; guard < 8; guard += 1) {
    if (next.phase === "done") {
      break;
    }
    const token = next.displayMoves[next.progress]?.trim() ?? "";
    if (!token || isFaceGuideToken(token)) {
      break;
    }
    const want = expectedLiveOrientAlgAfterStep(
      next.displayMoves,
      next.progress,
    );
    if (normalizeAlg(liveAlg) !== normalizeAlg(want)) {
      break;
    }
    const result = confirmGuidedManualStep(next);
    next = result.guide;
    if (result.kind === "progress" || result.kind === "done") {
      if (isWideGuideToken(token) || isSliceGuideToken(token)) {
        ctrl.beginLayerEchoQuiet(nowMs, token, undefined, liveQuat);
      }
    } else {
      break;
    }
  }
  return next;
}

function handleFaceEvent(
  guide: GuidedScramble,
  ctrl: GuideFollowController,
  event: GuideReplayFaceEvent,
  requireYellowUp: boolean,
  liveQuat: MoyuQuat,
  accepted: string[],
  rejected: string[],
): { guide: GuidedScramble; sawWrong: boolean } {
  let sawWrong = false;
  const view = guidedScrambleView(guide);
  const expected = (view.correction ?? view.expectedMove)?.trim() ?? "";
  const formulaOrients = formulaOrientsAt(guide.displayMoves, guide.progress);
  const cands = ctrl.faceOrientCandidates({
    formulaOrients,
    displayMoves: guide.displayMoves,
    progress: guide.progress,
    liveQuat,
    requireYellowUp,
  });

  if (
    ctrl.shouldSwallowGuideFaceMove(
      event.move,
      event.t,
      expected || null,
      cands,
    )
  ) {
    rejected.push(event.move);
    return { guide, sawWrong };
  }
  if (ctrl.shouldDiscardResidualLayerDual(event.move, expected, cands)) {
    rejected.push(event.move);
    return { guide, sawWrong };
  }

  if (!expected || !view.expectedMove) {
    rejected.push(event.move);
    return { guide, sawWrong };
  }

  const resolved = resolveGuideBleFaceMoveWithCandidates(
    event.move,
    expected,
    cands,
  );
  // 双步首半：正反均可（L2≡L'2）；须按握持四分之一记账，不能只收 expected 正转字母。
  const stepToken = guide.displayMoves[guide.progress] ?? "";
  let matches = resolved === expected;
  if (!view.correction && view.currentIsDouble && isFaceGuideToken(stepToken)) {
    const quarters = scrambleGuideEchoAcceptedMoves(
      stepToken,
      guide.halfDone,
      guide.halfDir,
    );
    matches = quarters?.includes(resolved) ?? false;
  }
  // #181 / E20：同面反转走 apply（×3≡期望步 / absorb）；异面仍静默丢（保 E17）。
  if (!matches) {
    const expectFace = expected[0]?.toUpperCase() ?? "";
    const resolvedFace = resolved[0]?.toUpperCase() ?? "";
    const sameFaceQuarter =
      Boolean(expectFace) &&
      expectFace === resolvedFace &&
      /^[UDLRFB](?:')?$/.test(resolved);
    if (!sameFaceQuarter) {
      rejected.push(event.move);
      return { guide, sawWrong };
    }
    const inverseResult = applyGuidedMove(guide, resolved);
    if (inverseResult.kind === "progress" || inverseResult.kind === "done") {
      accepted.push(event.move);
      ctrl.clearResidualLayerDual();
      return { guide: inverseResult.guide, sawWrong };
    }
    if (inverseResult.kind === "absorb" || inverseResult.kind === "partial") {
      return { guide: inverseResult.guide, sawWrong };
    }
    if (inverseResult.kind === "wrong") {
      sawWrong = true;
      rejected.push(event.move);
      return { guide: inverseResult.guide, sawWrong };
    }
    if (inverseResult.kind === "recover") {
      rejected.push(event.move);
      return { guide: inverseResult.guide, sawWrong };
    }
    rejected.push(event.move);
    return { guide, sawWrong };
  }

  const result = applyGuidedMove(guide, resolved);
  if (result.kind === "wrong") {
    sawWrong = true;
    rejected.push(event.move);
    return { guide: result.guide, sawWrong };
  }
  if (
    result.kind === "progress" ||
    result.kind === "partial" ||
    result.kind === "done"
  ) {
    accepted.push(event.move);
    ctrl.clearResidualLayerDual();
  } else {
    rejected.push(event.move);
  }
  return { guide: result.guide, sawWrong };
}

/**
 * 回放一条会话。`fixture.events` 须已按 `t` 排序（调用方负责）。
 */
export function replayGuideSession(
  fixture: Pick<
    GuideReplayFixture,
    "displayMoves" | "events" | "requireYellowUp"
  >,
): GuideReplayResult {
  const requireYellowUp = fixture.requireYellowUp !== false;
  const ctrl = createGuideFollowController();
  let guide = createGuidedMoves(fixture.displayMoves);
  let liveQuat: MoyuQuat = IDENTITY_QUAT;
  let liveAlg = "";
  let sawWrong = false;
  const acceptedFaceMoves: string[] = [];
  const rejectedFaceMoves: string[] = [];

  for (const event of fixture.events) {
    if (event.type === "orient") {
      liveAlg = normalizeAlg(event.alg);
      liveQuat = liveAlg ? quatFromOrientationAlg(liveAlg) : IDENTITY_QUAT;
      const formulaOrients = formulaOrientsAt(
        guide.displayMoves,
        guide.progress,
      );
      if (requireYellowUp && formulaOrients.some((m) => /\bz2'?\b/.test(m))) {
        ctrl.syncFaceRemapHome({
          orientsKey: formulaOrients.join(" "),
          active: true,
          liveQuat,
        });
      }
      guide = tryConfirmManualMatchingOrient(
        guide,
        ctrl,
        liveAlg,
        event.t,
        liveQuat,
      );
      continue;
    }

    const faceResult = handleFaceEvent(
      guide,
      ctrl,
      event,
      requireYellowUp,
      liveQuat,
      acceptedFaceMoves,
      rejectedFaceMoves,
    );
    guide = faceResult.guide;
    if (faceResult.sawWrong) {
      sawWrong = true;
    }
  }

  return {
    progress: guide.progress,
    done: guide.phase === "done",
    sawWrong,
    acceptedFaceMoves,
    rejectedFaceMoves,
    guide,
  };
}
