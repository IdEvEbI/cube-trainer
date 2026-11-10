/**
 * 打乱引导：面转 / 宽层 / 中层的对表与贴图。
 *
 * 对表：钉中心匹配，或忽略中心匹配（固件常报 restore 态）。
 * 展示：角棱按钉中心 / 设备反解；色心用公式 raw（拧 M 顶蓝前白）。
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
import {
  classifyScrambleGuideStep,
  isFaceletsGuideStepKind,
  syntheticWrongMoveForExpected,
  type ScrambleGuideStepCheck,
  type ScrambleGuideStepKind,
} from "./scrambleGuideStep.ts";

export type LayerFollowKind = Exclude<ScrambleGuideStepKind, "rotation">;

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
  setupAlg: string;
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

export function resolveLayerFollowKind(
  token: string | null | undefined,
): LayerFollowKind | null {
  const kind = classifyScrambleGuideStep(token);
  if (!isFaceletsGuideStepKind(kind) || kind === "rotation") {
    return null;
  }
  return kind;
}

/**
 * 引导中禁止播设备面转包：中层之后固件坐标系会偏，实体 D 会上报成 F。
 * 一律 facelets 对表 + 钉中心贴图。
 */
export function shouldPlayBluetoothMoveAnim(_kind: LayerFollowKind): boolean {
  return false;
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
  const painted = withRawSliceCenters(pattern, rawReference);
  return {
    mode: "pattern",
    pattern: painted,
    facelets: kpatternToFacelets(painted),
  };
}

export async function tickScrambleGuideLayerFollow(
  input: LayerFollowTickInput,
): Promise<LayerFollowTickResult> {
  const faceletsChanged = input.facelets !== input.lastFacelets;
  const settledSameCount = faceletsChanged ? 0 : input.settledSameCount + 1;
  const lastFacelets = input.facelets;

  const startPattern = await expectedFixedCenterPattern(
    input.displayMoves,
    input.progress,
  );
  const reachedPattern = await expectedFixedCenterPattern(
    input.displayMoves,
    input.progress + 1,
  );
  const rawStart = await expectedRawPattern(input.displayMoves, input.progress);
  const rawReached = await expectedRawPattern(
    input.displayMoves,
    input.progress + 1,
  );
  const startFacelets = kpatternToFacelets(startPattern);
  const reachedFacelets = kpatternToFacelets(reachedPattern);
  const ble = await safeFaceletsPattern(input.facelets);

  const isLayer = input.kind === "wide" || input.kind === "slice";
  const wrongSettle = isLayer ? LAYER_FOLLOW_WRONG_SETTLE_POLLS : 2;

  const heldAtEntry =
    Boolean(input.entryFacelets) && input.facelets === input.entryFacelets;

  let check: ScrambleGuideStepCheck;
  if (ble && layerReached(ble, reachedPattern, rawReached)) {
    check = "reached";
  } else if (
    (ble && layerAtStart(ble, startPattern, rawStart)) ||
    heldAtEntry
  ) {
    // 公式起点，或「进本步后设备串未变」（漏报中层 / 已到位逃生后）。
    check = "at_start";
  } else if (settledSameCount >= wrongSettle) {
    check = "wrong";
  } else {
    check = "in_progress";
  }

  // 展示：角棱用设备反解 / 公式 nail；色心用公式 raw（与实体拧 M 同貌）。
  const rawForDisplay = check === "reached" ? rawReached : rawStart;
  let display: LayerFollowDisplay;
  const formulaPattern = check === "reached" ? reachedPattern : startPattern;
  if (ble && (check === "reached" || check === "at_start")) {
    const referenceRaw = check === "reached" ? rawReached : rawStart;
    try {
      const fromDevice = await deviceToFixedCenterPattern(
        input.facelets,
        referenceRaw,
      );
      // 反解结果须与公式钉中心同构，否则回退公式态（防止错步乱贴）
      if (patternsMatchFixedCenters(fromDevice, formulaPattern)) {
        display = asDisplay(fromDevice, rawForDisplay);
      } else {
        display = asDisplay(formulaPattern, rawForDisplay);
      }
    } catch {
      display = asDisplay(formulaPattern, rawForDisplay);
    }
  } else {
    display = asDisplay(startPattern, rawForDisplay);
  }

  const logicalAfter = nonRotationAlgPrefix(
    input.displayMoves,
    input.progress + 1,
  );
  const trackSetupAlg =
    check === "reached" ? logicalAfter : input.setupAlg.trim() || logicalAfter;

  const expectFacelets = check === "at_start" ? startFacelets : reachedFacelets;
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
