/**
 * 首页打乱引导与游戏页跟拧共用的接线状态：
 * faceRemapHome、层转 tracker、手动步基线 / 静默窗、映面候选、转体步相对 Δ 起点。
 *
 * 不包含计时页轨迹（计时只跟色心面转包）。
 * 核心算法仍在 guideBleFaceRemap / scrambleGuideLayerGesture。
 */

import type { LayerCaptureMoveSample } from "../bluetooth/moyu/layerCapture.ts";
import { IDENTITY_QUAT, type MoyuQuat } from "../bluetooth/moyu/orientation.ts";
import { relativeOrientationAlg } from "../game/guideOrientation.ts";
import {
  applyGuideFaceRemapHomeLive,
  captureGuideFaceRemapHome,
  clearGuideFaceRemapHome,
  createGuideFaceRemapHomeState,
  guideBleFaceOrientCandidates,
  syncGuideFaceRemapHome,
  type GuideFaceRemapHomeState,
} from "./guideBleFaceRemap.ts";
import { guideLayerGyroOrientationAlgLast } from "./layerGuideDualPaint.ts";
import {
  appendGuideLayerGestureMoves,
  syncGuideLayerGestureTracker,
  type GuideLayerGestureTracker,
} from "./scrambleGuideLayerGesture.ts";

/** 层转 / 手动步确认后吞残留对面色心包的静默窗。 */
export const GUIDE_FOLLOW_MOVE_QUIET_MS = 550;

export type GuideFollowFaceOrientInput = {
  formulaOrients: readonly string[];
  displayMoves: readonly string[];
  progress: number;
  liveQuat: MoyuQuat | null;
  /**
   * 游戏页：尚无 z2 黄上时只回 `[""]`（色心绝对面）。
   * 首页打乱：公式常空，传 false。
   */
  requireYellowUp?: boolean;
};

export type GuideFollowController = {
  /** 当前映面 home（只读快照；写入走下方方法）。 */
  readonly faceRemapHome: GuideFaceRemapHomeState;
  layerGestureTracker: GuideLayerGestureTracker | null;
  /** 本步层转动画相位键（如 `progress:gyro`）。 */
  layerGuideAnimKey: string | null;
  /** 手势已 matched、等待动画 / 确认。 */
  layerMatchHold: boolean;
  /** 进入当前手动步时的公式前缀基线。 */
  readonly manualSyncSetup: string | null;
  readonly quietUntilMs: number;
  readonly rotationStepKey: string | null;
  readonly rotationFromQuat: MoyuQuat;

  reset(): void;
  captureFaceRemapHome(liveQuat: MoyuQuat, orientsKey?: string): void;
  clearFaceRemapHome(): void;
  syncFaceRemapHome(options: {
    orientsKey: string;
    active: boolean;
    liveQuat: MoyuQuat | null;
  }): void;
  applyFaceRemapHomeLive(liveQuat: MoyuQuat): void;
  faceOrientCandidates(input: GuideFollowFaceOrientInput): string[];

  beginQuiet(nowMs: number, durationMs?: number): void;
  isInQuiet(nowMs: number): boolean;

  /**
   * 进入层转 / 手动步：登记对表基线与 tracker。
   * 同一步复用已有 setup；换步则换 tracker。
   */
  ensureManualSync(options: {
    guideKey: string;
    syncSetup: string;
    progress: number;
    expectedToken: string;
    gyroBefore: MoyuQuat | null;
  }): string;
  clearManualSync(): void;

  syncLayerTracker(input: {
    progress: number;
    expectedToken: string;
    gyroBefore: MoyuQuat | null;
  }): GuideLayerGestureTracker;
  appendLayerMoves(
    samples: readonly LayerCaptureMoveSample[],
    nowMs?: number,
  ): GuideLayerGestureTracker | null;
  clearLayerGesture(): void;

  /**
   * 转体步：步键变则重采 from。
   * @returns relativeAlg；`isNewStep` 表示刚进入该步。
   */
  beginOrContinueRotationStep(
    stepKey: string,
    liveQuat: MoyuQuat,
  ): { relativeAlg: string; isNewStep: boolean };
  clearRotationStep(): void;
  relativeRotationAlg(liveQuat: MoyuQuat): string;
};

function formulaHasYellowUp(formula: readonly string[]): boolean {
  return formula.some((move) => {
    const token = move.trim();
    return token === "z2" || token === "z2'" || token.startsWith("z2 ");
  });
}

export function createGuideFollowController(): GuideFollowController {
  let faceRemapHome = createGuideFaceRemapHomeState();
  let layerGestureTracker: GuideLayerGestureTracker | null = null;
  let layerGuideAnimKey: string | null = null;
  let layerMatchHold = false;
  let manualSyncKey: string | null = null;
  let manualSyncSetup: string | null = null;
  let quietUntilMs = 0;
  let rotationStepKey: string | null = null;
  let rotationFromQuat: MoyuQuat = IDENTITY_QUAT;

  const api: GuideFollowController = {
    get faceRemapHome() {
      return faceRemapHome;
    },
    get layerGestureTracker() {
      return layerGestureTracker;
    },
    set layerGestureTracker(next) {
      layerGestureTracker = next;
    },
    get layerGuideAnimKey() {
      return layerGuideAnimKey;
    },
    set layerGuideAnimKey(next) {
      layerGuideAnimKey = next;
    },
    get layerMatchHold() {
      return layerMatchHold;
    },
    set layerMatchHold(next) {
      layerMatchHold = next;
    },
    get manualSyncSetup() {
      return manualSyncSetup;
    },
    get quietUntilMs() {
      return quietUntilMs;
    },
    get rotationStepKey() {
      return rotationStepKey;
    },
    get rotationFromQuat() {
      return rotationFromQuat;
    },

    reset() {
      faceRemapHome = createGuideFaceRemapHomeState();
      layerGestureTracker = null;
      layerGuideAnimKey = null;
      layerMatchHold = false;
      manualSyncKey = null;
      manualSyncSetup = null;
      quietUntilMs = 0;
      rotationStepKey = null;
      rotationFromQuat = IDENTITY_QUAT;
    },

    captureFaceRemapHome(liveQuat, orientsKey = "") {
      faceRemapHome = captureGuideFaceRemapHome(liveQuat, orientsKey);
    },

    clearFaceRemapHome() {
      faceRemapHome = clearGuideFaceRemapHome();
    },

    syncFaceRemapHome(options) {
      faceRemapHome = syncGuideFaceRemapHome(faceRemapHome, options);
    },

    applyFaceRemapHomeLive(liveQuat) {
      faceRemapHome = applyGuideFaceRemapHomeLive(faceRemapHome, liveQuat);
    },

    faceOrientCandidates(input) {
      const formula = input.formulaOrients;
      const requireYellowUp = input.requireYellowUp === true;
      if (requireYellowUp && !formulaHasYellowUp(formula)) {
        return [""];
      }
      if (requireYellowUp) {
        api.syncFaceRemapHome({
          orientsKey: formula.join(" "),
          active: true,
          liveQuat: input.liveQuat,
        });
      }
      if (input.liveQuat) {
        api.applyFaceRemapHomeLive(input.liveQuat);
      }
      const layerGyroAlg = guideLayerGyroOrientationAlgLast(
        input.displayMoves,
        input.progress,
      );
      return guideBleFaceOrientCandidates({
        formulaOrients: formula,
        homeQuat: faceRemapHome.homeQuat,
        liveQuat: input.liveQuat,
        layerGyroAlg,
      });
    },

    beginQuiet(nowMs, durationMs = GUIDE_FOLLOW_MOVE_QUIET_MS) {
      quietUntilMs = nowMs + durationMs;
    },

    isInQuiet(nowMs) {
      return nowMs < quietUntilMs;
    },

    ensureManualSync(options) {
      if (manualSyncKey === options.guideKey && manualSyncSetup !== null) {
        return manualSyncSetup;
      }
      manualSyncKey = options.guideKey;
      manualSyncSetup = options.syncSetup;
      layerGuideAnimKey = null;
      layerGestureTracker = syncGuideLayerGestureTracker(null, {
        progress: options.progress,
        expectedToken: options.expectedToken,
        gyroBefore: options.gyroBefore,
      });
      return manualSyncSetup;
    },

    clearManualSync() {
      manualSyncKey = null;
      manualSyncSetup = null;
    },

    syncLayerTracker(input) {
      layerGestureTracker = syncGuideLayerGestureTracker(
        layerGestureTracker,
        input,
      );
      return layerGestureTracker;
    },

    appendLayerMoves(samples, nowMs) {
      if (!layerGestureTracker) {
        return null;
      }
      layerGestureTracker = appendGuideLayerGestureMoves(
        layerGestureTracker,
        samples,
        nowMs,
      );
      return layerGestureTracker;
    },

    clearLayerGesture() {
      layerGestureTracker = null;
      layerGuideAnimKey = null;
      layerMatchHold = false;
    },

    beginOrContinueRotationStep(stepKey, liveQuat) {
      const isNewStep = rotationStepKey !== stepKey;
      if (isNewStep) {
        rotationStepKey = stepKey;
        rotationFromQuat = liveQuat;
      }
      return {
        relativeAlg: relativeOrientationAlg(rotationFromQuat, liveQuat),
        isNewStep,
      };
    },

    clearRotationStep() {
      rotationStepKey = null;
      rotationFromQuat = IDENTITY_QUAT;
    },

    relativeRotationAlg(liveQuat) {
      return relativeOrientationAlg(rotationFromQuat, liveQuat);
    },
  };

  return api;
}
