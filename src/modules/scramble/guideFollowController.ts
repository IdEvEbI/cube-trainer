/**
 * 首页打乱引导与游戏页跟拧共用的接线状态：
 * faceRemapHome、层转 tracker、手动步基线 / 静默窗、映面候选、转体步相对 Δ 起点。
 *
 * 不包含计时页轨迹（计时只跟色心面转包）。
 * 核心算法仍在 guideBleFaceRemap / scrambleGuideLayerGesture。
 */

import type { LayerCaptureMoveSample } from "../bluetooth/moyu/layerCapture.ts";
import { expectedBurstMovesForLayer } from "../bluetooth/moyu/moyuLayerGesture.ts";
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
import { invertGuideToken } from "./guided.ts";
import {
  guideLayerCenterOrientationAlg,
  resolveGuideBleFaceMove,
} from "./layerGuideDualPaint.ts";
import {
  appendGuideLayerGestureMoves,
  syncGuideLayerGestureTracker,
  type GuideLayerGestureTracker,
} from "./scrambleGuideLayerGesture.ts";

/** 层转 / 手动步确认后吞残留对面色心包的静默窗。 */
export const GUIDE_FOLLOW_MOVE_QUIET_MS = 550;

/**
 * 刚完成的宽层 / 中层，其固件对面包（及取逆）在静默窗 / 残留过滤中应丢弃。
 * 例：`M'` → `L`/`R'`（及 `L'`/`R`）；勿整窗吞掉下一步真面转（如 `F'`）。
 */
export function layerEchoFaceMoves(layerToken: string): readonly string[] {
  const burst = expectedBurstMovesForLayer(layerToken.trim());
  if (!burst || burst.length === 0) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (token: string) => {
    const t = token.trim();
    if (!t || seen.has(t)) {
      return;
    }
    seen.add(t);
    out.push(t);
  };
  for (const move of burst) {
    push(move);
    try {
      push(invertGuideToken(move));
    } catch {
      // 非面转对偶时忽略
    }
  }
  return out;
}

/** 候选里只含公式转体（或空）的朝向串；勿用层转 Δ，以免 M' 回声假放行。 */
export function formulaOrientAlgFromCandidates(
  orientAlgs: readonly string[],
): string {
  for (const alg of orientAlgs) {
    const parts = alg.trim().split(/\s+/).filter(Boolean);
    if (parts.every((part) => /^([xyz])(2'|2|')?$/.test(part))) {
      return parts.join(" ");
    }
  }
  return (orientAlgs[0] ?? "").trim();
}

/**
 * 已完成层转的对偶色心包：属于该层转本身，不是下一步面转。
 * - 色心原字母已是下一步期望（如 `S'` 后真拧 `F'`）：放行。
 * - **公式朝向**映面后等于期望（如 Cross `r` 后握持 `R` 报绝对 `L`）：放行。
 * - 仅靠层转 Δ 才映成期望（如 `M'` 回声）：仍丢弃。
 */
export function isResidualLayerDualFaceMove(
  bleMove: string,
  expectedOrCorrection: string | null | undefined,
  orientAlgs: readonly string[],
  completedLayerToken: string,
): boolean {
  const raw = bleMove.trim();
  const echo = layerEchoFaceMoves(completedLayerToken);
  if (echo.length === 0 || !echo.includes(raw)) {
    return false;
  }
  const expected = (expectedOrCorrection ?? "").trim();
  if (expected && raw === expected) {
    return false;
  }
  if (expected) {
    const formulaOrient = formulaOrientAlgFromCandidates(orientAlgs);
    const viaFormula = resolveGuideBleFaceMove(raw, expected, formulaOrient);
    if (viaFormula === expected) {
      return false;
    }
  }
  return true;
}

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
  /** 进入当前转体步的 performance.now；无转体步为 0。 */
  readonly rotationStepEnteredAtMs: number;

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
  /**
   * 层转确认后：登记对偶残留过滤器，并开短静默窗少播动画。
   * 正确性靠 {@link shouldDiscardResidualLayerDual}，不靠窗长。
   */
  /**
   * @param liveQuat 层转刚确认时的手持姿态；有则重采 faceRemap home，
   *   避免把本步陀螺 Δ（如 `S'`→`z'`）再读进 relative 变成 `x'` 脏候选（#159）。
   */
  beginLayerEchoQuiet(
    nowMs: number,
    layerToken: string,
    durationMs?: number,
    liveQuat?: MoyuQuat | null,
  ): void;
  /** 下一步面转已推进：清对偶残留过滤。 */
  clearResidualLayerDual(): void;
  isInQuiet(nowMs: number): boolean;
  /** 无对偶表时整窗吞包；有对偶表时仅 {@link shouldSwallowGuideFaceMove}。 */
  swallowsAllFaceMoves(nowMs: number): boolean;
  /**
   * 静默窗内是否应丢弃该色心面转（对面包回声）。
   * 原包===期望，或公式朝向映面===期望时不吞（`S'`→`F'` / `r`→握持 `R` 报 `L`）。
   */
  shouldSwallowGuideFaceMove(
    bleMove: string,
    nowMs: number,
    expectedOrCorrection?: string | null,
    orientAlgs?: readonly string[],
  ): boolean;
  shouldDiscardResidualLayerDual(
    bleMove: string,
    expectedOrCorrection: string | null | undefined,
    orientAlgs: readonly string[],
  ): boolean;

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
    nowMs?: number,
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
  let residualLayerToken: string | null = null;
  let echoFaceMoves: ReadonlySet<string> | null = null;
  let rotationStepEnteredAtMs = 0;
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
    get rotationStepEnteredAtMs() {
      return rotationStepEnteredAtMs;
    },

    reset() {
      faceRemapHome = createGuideFaceRemapHomeState();
      layerGestureTracker = null;
      layerGuideAnimKey = null;
      layerMatchHold = false;
      manualSyncKey = null;
      manualSyncSetup = null;
      residualLayerToken = null;
      echoFaceMoves = null;
      quietUntilMs = 0;
      rotationStepKey = null;
      rotationFromQuat = IDENTITY_QUAT;
      rotationStepEnteredAtMs = 0;
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
      // 映面用公式色心 Δ 累积（r'≡x' 非陀螺 x）；勿只用 Last 陀螺（r' b' 会丢 r'）。
      const layerCenterAlg = guideLayerCenterOrientationAlg(
        input.displayMoves,
        input.progress,
      );
      // 游戏黄上 relative 基准是公式姿态（非 captured home）。层转后 live 仍含本步
      // Δ（S'→z'），相对 z2 y 会吸附成 x'，D/U 误收成 L。残留未清时勿叠 live relative。
      const liveForRelative =
        residualLayerToken !== null ? null : input.liveQuat;
      return guideBleFaceOrientCandidates({
        formulaOrients: formula,
        homeQuat: faceRemapHome.homeQuat,
        liveQuat: liveForRelative,
        layerGyroAlg: layerCenterAlg,
      });
    },

    beginQuiet(nowMs, durationMs = GUIDE_FOLLOW_MOVE_QUIET_MS) {
      quietUntilMs = nowMs + durationMs;
      echoFaceMoves = null;
    },

    beginLayerEchoQuiet(
      nowMs,
      layerToken,
      durationMs = GUIDE_FOLLOW_MOVE_QUIET_MS,
      liveQuat = null,
    ) {
      quietUntilMs = nowMs + durationMs;
      const trimmed = layerToken.trim();
      residualLayerToken = trimmed || null;
      const echo = layerEchoFaceMoves(trimmed);
      echoFaceMoves = echo.length > 0 ? new Set(echo) : null;
      // 层转倾斜已写入 live；若不重采 home，relative(basis→live) 会把本步 Δ
      // 再叠进候选（`z2 y z'` 吸附成 `x y'` → relative `x'`），S' 后 D/U 误收成 L。
      if (liveQuat) {
        faceRemapHome = captureGuideFaceRemapHome(
          liveQuat,
          faceRemapHome.orientsKey,
        );
      }
    },

    clearResidualLayerDual() {
      residualLayerToken = null;
      echoFaceMoves = null;
      quietUntilMs = 0;
    },

    isInQuiet(nowMs) {
      return nowMs < quietUntilMs;
    },

    swallowsAllFaceMoves(nowMs) {
      return nowMs < quietUntilMs && echoFaceMoves === null;
    },

    shouldSwallowGuideFaceMove(
      bleMove,
      nowMs,
      expectedOrCorrection,
      orientAlgs = [],
    ) {
      const raw = bleMove.trim();
      const expected = (expectedOrCorrection ?? "").trim();
      if (expected && raw === expected) {
        return false;
      }
      if (expected && orientAlgs.length > 0) {
        const formulaOrient = formulaOrientAlgFromCandidates(orientAlgs);
        if (
          resolveGuideBleFaceMove(raw, expected, formulaOrient) === expected
        ) {
          return false;
        }
      }
      if (nowMs >= quietUntilMs) {
        echoFaceMoves = null;
        return false;
      }
      if (echoFaceMoves === null) {
        return true;
      }
      return echoFaceMoves.has(raw);
    },

    shouldDiscardResidualLayerDual(bleMove, expectedOrCorrection, orientAlgs) {
      if (!residualLayerToken) {
        return false;
      }
      return isResidualLayerDualFaceMove(
        bleMove,
        expectedOrCorrection,
        orientAlgs,
        residualLayerToken,
      );
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

    beginOrContinueRotationStep(stepKey, liveQuat, nowMs = 0) {
      const isNewStep = rotationStepKey !== stepKey;
      if (isNewStep) {
        rotationStepKey = stepKey;
        rotationFromQuat = liveQuat;
        rotationStepEnteredAtMs = nowMs;
      }
      return {
        relativeAlg: relativeOrientationAlg(rotationFromQuat, liveQuat),
        isNewStep,
      };
    },

    clearRotationStep() {
      rotationStepKey = null;
      rotationFromQuat = IDENTITY_QUAT;
      rotationStepEnteredAtMs = 0;
    },

    relativeRotationAlg(liveQuat) {
      return relativeOrientationAlg(rotationFromQuat, liveQuat);
    },
  };

  return api;
}
