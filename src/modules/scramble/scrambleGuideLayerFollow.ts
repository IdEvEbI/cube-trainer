/**
 * 打乱引导：面转 / 宽层 / 中层的对表与贴图。
 *
 * 对表：钉中心匹配，或忽略中心匹配（固件常报 restore 态）。
 * 展示字段仍算 pattern，但 App 引导过程中不据此重贴 3D（贴纸白名单：连接/步到位）。
 * 禁止播设备面转包。
 */

import type { KPattern } from "cubing/kpuzzle";
import {
  faceletsMidColumn,
  faceletsToKPattern,
  kpatternToFacelets,
} from "../bluetooth/moyu/pattern.ts";
import {
  expectedFixedCenterPattern,
  expectedRawPattern,
  findRestoreOrientationAlg,
  invertOrientationAlg,
  nailFixedCenters,
  nonRotationAlgPrefix,
  patternsMatchFixedCenters,
  patternsMatchIgnoringCenters,
  withRawSliceCenters,
} from "../game/algStateMatch.ts";
import { expectedBurstMovesForLayer } from "../bluetooth/moyu/moyuLayerGesture.ts";
import { joinAlgParts } from "./bluetoothSolve.ts";
import {
  classifyScrambleGuideStep,
  syntheticWrongMoveForExpected,
  type ScrambleGuideStepCheck,
} from "./scrambleGuideStep.ts";

/** 仅宽层 / 中层走 facelets 流水线；外层面转（含 R2）走转动包 + applyGuidedMove。 */
export type LayerFollowKind = "wide" | "slice";

export type LayerFollowDisplay =
  | { mode: "pattern"; pattern: KPattern; facelets: string }
  | { mode: "keep" };

export type LayerFollowDebug = {
  token: string;
  check: ScrambleGuideStepCheck;
  bleUF: string;
  /** 当前判定所用期望：at_start 用起点，其余用到位态 */
  expectUF: string;
  /** 画面实际贴的 UF（钉中心） */
  displayUF: string;
  equal: boolean;
};

export type LayerFollowTickInput = {
  facelets: string;
  /** 设备当前绝对 setup（live）。 */
  setupAlg: string;
  /**
   * 本轮打乱引导起点（连接/开局时实体态，可非复原）。
   * 期望 facelets = nail(scrambleSetup ⊕ 公式前缀)。
   */
  scrambleSetupAlg?: string;
  displayMoves: readonly string[];
  progress: number;
  token: string;
  kind: LayerFollowKind;
  lastFacelets: string | null;
  settledSameCount: number;
  hasWrongMark: boolean;
  /**
   * 进入本步时的设备 facelets。
   * 固件常漏报中层：已到位推进后 BLE 仍停在旧态（甚至还原），
   * 此时不得判 wrong，应视为仍在步起点等待拧动。
   */
  entryFacelets?: string | null;
};

export type LayerFollowTickResult = {
  check: ScrambleGuideStepCheck;
  display: LayerFollowDisplay;
  lastFacelets: string;
  settledSameCount: number;
  shouldAdvance: boolean;
  shouldMarkWrong: boolean;
  shouldClearWrong: boolean;
  trackSetupAlg: string;
  wrongToken: string;
  debug: LayerFollowDebug;
};

export const LAYER_FOLLOW_WRONG_SETTLE_POLLS = 8;

/**
 * 宽层/中层双步的半步记号：`E2→E`、`E'2`/`E2'→E'`、`r'2`/`r2'→r'`。
 * 半步态既非起点也非终点，不得判 wrong（手势还在收第二记/四包）。
 */
export function layerDoubleHalfToken(token: string): string | null {
  const raw = token.trim();
  if (/^[MESrldfub](?:'2|2')$/.test(raw)) {
    return `${raw[0]}'`;
  }
  if (/^[MESrldfub]2$/.test(raw)) {
    return raw.slice(0, -1);
  }
  return null;
}

export function resolveLayerFollowKind(
  token: string | null | undefined,
): LayerFollowKind | null {
  const kind = classifyScrambleGuideStep(token);
  if (kind === "wide" || kind === "slice") {
    return kind;
  }
  return null;
}

/**
 * 是否播固件拆开的外层包做层转动画。
 * 魔域中层/宽层会报 `R+L` / 对面包；若直接播这些包，画面会先错成外层再跳到钉中心层转，观感混乱。
 * 改为 false：由 {@link layerGuideVisualToken} + `animateGuideStep` 播整步 M/E/S/r…。
 */
export function shouldPlayBluetoothMoveAnim(_kind: LayerFollowKind): boolean {
  return false;
}

/**
 * 根据已收包数决定本步该播哪一记整步动画（`*2` 拆成两记四分之一）。
 * `sampleCount===0` 时返回 null（尚未拧）。
 */
export function layerGuideVisualToken(
  stepToken: string,
  sampleCount: number,
): { animToken: string; phaseKey: string } | null {
  if (sampleCount <= 0) {
    return null;
  }
  const half = layerDoubleHalfToken(stepToken);
  if (!half) {
    return { animToken: stepToken.trim(), phaseKey: "1" };
  }
  const expected = expectedBurstMovesForLayer(stepToken);
  const total = expected?.length ?? 4;
  const phaseSize = Math.max(1, total / 2);
  const phase = Math.min(2, Math.max(1, Math.ceil(sampleCount / phaseSize)));
  return { animToken: half, phaseKey: String(phase) };
}

export type LayerGuideAnimPlan = {
  animToken: string;
  phaseKey: string;
  /** 相对 90° 时间轴的墙钟毫秒；整步 `*2` 约 2×。 */
  quarterTurnMs: number;
  /**
   * 快拧追上：先取消排队动画并贴回本步起点，再播整步 `*2`，
   * 避免半步+半步串行滞后。
   */
  resetToStepStart: boolean;
};

/** 常速四分之一兜底时长（无墙钟时）。 */
export const LAYER_GUIDE_QUARTER_MS = 240;
/** 慢拧 `*2` 第一相。 */
export const LAYER_GUIDE_DOUBLE_PHASE1_MS = 200;
/** 慢拧 `*2` 第二相。 */
export const LAYER_GUIDE_DOUBLE_PHASE2_MS = 180;
/** 快拧一次收齐 / 追上整步（按 90° 单位；180° 约 2×）。 */
export const LAYER_GUIDE_FAST_FULL_MS = 130;
/** 常速到位后最多再等动画多久再钉终态（毫秒）。 */
export const LAYER_GUIDE_MATCH_IDLE_MS = 420;
/** 快拧 full/catch 到位后等待上限。 */
export const LAYER_GUIDE_FAST_MATCH_IDLE_MS = 280;

/**
 * 根据本批收包前后的样本数决定动画。
 * - 四分之一（含中层双包）：凑齐期望包数再播，时长跟手势墙钟。
 * - 一次收齐 / 需追上：整步 `r2`/`r'2` 一气播完（更快）。
 * - 慢拧 `*2`：仍按半步两相。
 */
export function planLayerGuideAnim(
  stepToken: string,
  beforeCount: number,
  afterCount: number,
): LayerGuideAnimPlan | null {
  if (afterCount <= 0 || afterCount <= beforeCount) {
    return null;
  }
  const half = layerDoubleHalfToken(stepToken);
  if (!half) {
    const want = expectedBurstMovesForLayer(stepToken);
    const need = Math.max(1, want?.length ?? 1);
    // 中层等双包齐了再播，避免首包就用固定时长跑完、与手速脱节。
    if (afterCount < need || beforeCount >= need) {
      return null;
    }
    return {
      animToken: stepToken.trim(),
      phaseKey: "1",
      quarterTurnMs: LAYER_GUIDE_QUARTER_MS,
      resetToStepStart: false,
    };
  }
  const expected = expectedBurstMovesForLayer(stepToken);
  const total = expected?.length ?? 4;
  const phaseSize = Math.max(1, Math.floor(total / 2));
  const fullToken = stepToken.trim();
  const beforePhase =
    beforeCount <= 0 ? 0 : Math.min(2, Math.ceil(beforeCount / phaseSize));
  const afterPhase = Math.min(2, Math.ceil(afterCount / phaseSize));

  // 从 0 一次收齐全部包（快拧常见）：整步双转，勿拆成两记排队。
  if (beforeCount === 0 && afterCount >= total) {
    return {
      animToken: fullToken,
      phaseKey: "full",
      quarterTurnMs: LAYER_GUIDE_FAST_FULL_MS,
      resetToStepStart: false,
    };
  }

  if (afterPhase <= beforePhase) {
    return null;
  }

  return {
    animToken: half,
    phaseKey: String(afterPhase),
    quarterTurnMs:
      afterPhase === 2
        ? LAYER_GUIDE_DOUBLE_PHASE2_MS
        : LAYER_GUIDE_DOUBLE_PHASE1_MS,
    resetToStepStart: false,
  };
}

/**
 * 第二相到来时若第一相动画仍在排队，改为整步追上（由调用方 cancel + 贴起点后播）。
 */
export function catchUpLayerGuideAnimIfPending(
  stepToken: string,
  plan: LayerGuideAnimPlan,
  hasPendingAnim: boolean,
): LayerGuideAnimPlan {
  if (!hasPendingAnim || plan.phaseKey !== "2") {
    return plan;
  }
  const half = layerDoubleHalfToken(stepToken);
  if (!half) {
    return plan;
  }
  return {
    animToken: stepToken.trim(),
    phaseKey: "catch-full",
    quarterTurnMs: LAYER_GUIDE_FAST_FULL_MS,
    resetToStepStart: true,
  };
}

/**
 * 动画时长：优先用手势墙钟（首包→凑齐），与实体拧速同量级；
 * 快拧 full/catch 仍用 plan 短时长。
 */
export function resolveLayerGuideAnimMs(
  plan: LayerGuideAnimPlan,
  newSamples: readonly { intervalMs: number }[],
  gestureElapsedMs?: number | null,
): number {
  if (plan.phaseKey === "full" || plan.phaseKey === "catch-full") {
    return plan.quarterTurnMs;
  }
  if (
    gestureElapsedMs != null &&
    Number.isFinite(gestureElapsedMs) &&
    gestureElapsedMs > 0
  ) {
    // 凑齐后再播：用略短于已发生墙钟，避免「手停了动画还在拖」。
    return Math.min(400, Math.max(160, Math.round(gestureElapsedMs * 0.9)));
  }
  const positive = newSamples
    .map((sample) => sample.intervalMs)
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  if (positive.length === 0) {
    return plan.quarterTurnMs;
  }
  const span =
    positive.length >= 2
      ? positive.reduce((sum, ms) => sum + ms, 0)
      : positive[0]!;
  return Math.min(400, Math.max(plan.quarterTurnMs, Math.round(span)));
}

/** 手势 matched 后等待层转动画的上限：快拧短等，常速让动画播完再钉终态。 */
export function layerGuideMatchIdleMs(animPhaseKey: string): number {
  if (animPhaseKey === "full" || animPhaseKey === "catch-full") {
    return LAYER_GUIDE_FAST_MATCH_IDLE_MS;
  }
  return LAYER_GUIDE_MATCH_IDLE_MS;
}

function formatUF(facelets: string): string {
  if (facelets.length !== 54) {
    return `U? F?`;
  }
  // F 面中列 + 赤道左右（E 步会改左右，中列 alone 看不出 E'）
  const fMid = faceletsMidColumn(facelets, "F");
  const fEq = `${facelets[21]!}${facelets[23]!}`;
  return `U${faceletsMidColumn(facelets, "U")} F${fMid}/${fEq}`;
}

async function safeFaceletsPattern(facelets: string) {
  try {
    return await faceletsToKPattern(facelets);
  } catch {
    return null;
  }
}

function layerReached(
  ble: NonNullable<Awaited<ReturnType<typeof safeFaceletsPattern>>>,
  nailReached: Awaited<ReturnType<typeof expectedFixedCenterPattern>>,
  rawReached: Awaited<ReturnType<typeof expectedRawPattern>>,
): boolean {
  if (patternsMatchFixedCenters(ble, nailReached)) {
    return true;
  }
  return patternsMatchIgnoringCenters(ble, rawReached);
}

function layerAtStart(
  ble: NonNullable<Awaited<ReturnType<typeof safeFaceletsPattern>>>,
  nailStart: Awaited<ReturnType<typeof expectedFixedCenterPattern>>,
  rawStart: Awaited<ReturnType<typeof expectedRawPattern>>,
): boolean {
  if (patternsMatchFixedCenters(ble, nailStart)) {
    return true;
  }
  return patternsMatchIgnoringCenters(ble, rawStart);
}

/**
 * 设备 facelets（常为 restore）→ 固定色心展示 pattern。
 * 用参考 raw 的 restore 朝向 O 做 ble·O'，再钉中心；与实体同构。
 */
export async function deviceToFixedCenterPattern(
  deviceFacelets: string,
  referenceRaw: KPattern,
): Promise<KPattern> {
  const ble = await faceletsToKPattern(deviceFacelets);
  const restoreAlg = findRestoreOrientationAlg(referenceRaw);
  if (!restoreAlg) {
    return nailFixedCenters(ble);
  }
  const inverse = invertOrientationAlg(restoreAlg);
  return nailFixedCenters(ble.applyAlg(inverse));
}

function asDisplay(
  pattern: KPattern,
  rawReference: KPattern,
): LayerFollowDisplay {
  // 角棱钉中心 + raw 色心（Twisty xf 需要，否则 M 后顶心仍白）；mesh 锁单位。
  const painted = withRawSliceCenters(pattern, rawReference);
  return {
    mode: "pattern",
    pattern: painted,
    facelets: kpatternToFacelets(nailFixedCenters(pattern)),
  };
}

export async function tickScrambleGuideLayerFollow(
  input: LayerFollowTickInput,
): Promise<LayerFollowTickResult> {
  const faceletsChanged = input.facelets !== input.lastFacelets;
  const settledSameCount = faceletsChanged ? 0 : input.settledSameCount + 1;
  const lastFacelets = input.facelets;

  const scrambleSetup = (input.scrambleSetupAlg ?? "").trim();
  const startPattern = await expectedFixedCenterPattern(
    input.displayMoves,
    input.progress,
    scrambleSetup,
  );
  const reachedPattern = await expectedFixedCenterPattern(
    input.displayMoves,
    input.progress + 1,
    scrambleSetup,
  );
  const rawStart = await expectedRawPattern(
    input.displayMoves,
    input.progress,
    scrambleSetup,
  );
  const rawReached = await expectedRawPattern(
    input.displayMoves,
    input.progress + 1,
    scrambleSetup,
  );
  const startFacelets = kpatternToFacelets(startPattern);
  const reachedFacelets = kpatternToFacelets(reachedPattern);
  const ble = await safeFaceletsPattern(input.facelets);

  const isLayer = input.kind === "wide" || input.kind === "slice";
  const wrongSettle = isLayer ? LAYER_FOLLOW_WRONG_SETTLE_POLLS : 2;

  const heldAtEntry =
    Boolean(input.entryFacelets) && input.facelets === input.entryFacelets;

  const halfToken = layerDoubleHalfToken(input.token);
  let halfPattern: Awaited<
    ReturnType<typeof expectedFixedCenterPattern>
  > | null = null;
  let rawHalf: Awaited<ReturnType<typeof expectedRawPattern>> | null = null;
  let atHalf = false;
  if (halfToken && ble) {
    const halfMoves = [
      ...input.displayMoves.slice(0, input.progress),
      halfToken,
    ];
    halfPattern = await expectedFixedCenterPattern(
      halfMoves,
      halfMoves.length,
      scrambleSetup,
    );
    rawHalf = await expectedRawPattern(
      halfMoves,
      halfMoves.length,
      scrambleSetup,
    );
    atHalf = layerReached(ble, halfPattern, rawHalf);
  }

  let check: ScrambleGuideStepCheck;
  if (ble && layerReached(ble, reachedPattern, rawReached)) {
    check = "reached";
  } else if (
    (ble && layerAtStart(ble, startPattern, rawStart)) ||
    heldAtEntry
  ) {
    // 公式起点，或「进本步后设备串未变」（漏报中层 / 已到位逃生后）。
    check = "at_start";
  } else if (atHalf) {
    // 双步拧到一半（如 E2 的第一记 E）：不推进、不报错，贴半步钉中心态。
    check = "in_progress";
  } else if (settledSameCount >= wrongSettle) {
    check = "wrong";
  } else {
    check = "in_progress";
  }

  // 展示：半步/到位钉中心；拧动中 keep 交给面转包动画；错步锁起点。
  let display: LayerFollowDisplay;
  if (check === "reached") {
    const formulaPattern = reachedPattern;
    try {
      const fromDevice = ble
        ? await deviceToFixedCenterPattern(input.facelets, rawReached)
        : null;
      if (fromDevice && patternsMatchFixedCenters(fromDevice, formulaPattern)) {
        display = asDisplay(fromDevice, rawReached);
      } else {
        display = asDisplay(formulaPattern, rawReached);
      }
    } catch {
      display = asDisplay(formulaPattern, rawReached);
    }
  } else if (check === "in_progress" && atHalf) {
    // *2 半步：画面交给 animateGuideStep 第一记；勿硬贴半步 pattern。
    // 硬贴会 bump CubeView generation，掐掉第二记动画 → 用户见「拧完第一记后不跟随」。
    display = { mode: "keep" };
  } else if (check === "in_progress") {
    display = { mode: "keep" };
  } else if (check === "at_start" && ble) {
    try {
      const fromDevice = await deviceToFixedCenterPattern(
        input.facelets,
        rawStart,
      );
      if (patternsMatchFixedCenters(fromDevice, startPattern)) {
        display = asDisplay(fromDevice, rawStart);
      } else {
        display = asDisplay(startPattern, rawStart);
      }
    } catch {
      display = asDisplay(startPattern, rawStart);
    }
  } else {
    // wrong / 无 ble：锁公式起点，避免错步乱闪
    display = asDisplay(startPattern, rawStart);
  }

  const logicalAfter = nonRotationAlgPrefix(
    input.displayMoves,
    input.progress + 1,
  );
  const trackSetupAlg =
    check === "reached"
      ? joinAlgParts(scrambleSetup, logicalAfter.split(/\s+/).filter(Boolean))
      : input.setupAlg.trim() ||
        joinAlgParts(
          scrambleSetup,
          nonRotationAlgPrefix(input.displayMoves, input.progress)
            .split(/\s+/)
            .filter(Boolean),
        );

  const expectFacelets =
    check === "at_start"
      ? startFacelets
      : atHalf && halfPattern
        ? kpatternToFacelets(halfPattern)
        : reachedFacelets;
  const displayFacelets =
    display.mode === "pattern" ? display.facelets : startFacelets;

  return {
    check,
    display,
    lastFacelets,
    settledSameCount,
    shouldAdvance: check === "reached",
    shouldMarkWrong: check === "wrong" && !input.hasWrongMark,
    shouldClearWrong: check === "at_start" && input.hasWrongMark,
    trackSetupAlg,
    wrongToken: syntheticWrongMoveForExpected(input.token),
    debug: {
      token: input.token,
      check,
      bleUF: formatUF(input.facelets),
      expectUF: formatUF(expectFacelets),
      displayUF: formatUF(displayFacelets),
      equal: check === "reached" || check === "at_start",
    },
  };
}
