/**
 * 打乱引导层转：3D 进度跟手。
 * 魔域无角速度；中层 `*2` 途中整机夹角常平台，单靠陀螺会卡在半步。
 * 因此用「已收包 / 期望包数」作下限，陀螺夹角作细跟手，取较大值。
 */

import {
  expectedBurstMovesForLayer,
  gyroDeltaQuarterTurns,
  parseLayerGestureToken,
} from "../bluetooth/moyu/moyuLayerGesture.ts";
import type { MoyuQuat } from "../bluetooth/moyu/orientation.ts";

/** 本步期望的相对整机转角（四分之一圈数）：普通 1，`*2` 为 2。 */
export function layerGuideExpectedGyroTurns(token: string): number {
  const parsed = parseLayerGestureToken(token);
  if (!parsed) {
    return 1;
  }
  return parsed.suffix === "2" ? 2 : 1;
}

/** 本步期望转动包数（宽层 1/2，中层 2/4）。 */
export function layerGuideExpectedPacketCount(token: string): number {
  const want = expectedBurstMovesForLayer(token);
  return want?.length ?? 1;
}

/**
 * 仅陀螺相对转角 → 进度 ∈ [0,1]。
 * `*2` 途中夹角可能停在 ~0.5，需与包进度合成，勿单独驱动画面。
 */
export function layerGuideGyroProgress(
  expectedToken: string,
  gyroBefore: MoyuQuat,
  gyroAfter: MoyuQuat,
): number {
  const expectTurns = layerGuideExpectedGyroTurns(expectedToken);
  if (expectTurns <= 0) {
    return 0;
  }
  const turns = gyroDeltaQuarterTurns(gyroBefore, gyroAfter);
  if (!Number.isFinite(turns) || turns <= 0) {
    return 0;
  }
  return Math.min(1, turns / expectTurns);
}

/** 已收包比例 ∈ [0,1]。 */
export function layerGuidePacketProgress(
  expectedToken: string,
  sampleCount: number,
): number {
  const expect = layerGuideExpectedPacketCount(expectedToken);
  if (expect <= 0 || sampleCount <= 0) {
    return 0;
  }
  return Math.min(1, sampleCount / expect);
}

/**
 * 层转跟手进度：以陀螺为主，包作下限。
 *
 * - 未收齐包：max(包, 陀螺)，保证 `M2` 途中夹角平台时仍能往前走。
 * - 已收齐包：勿把包进度打到 1（中层双包常同一帧到齐 → 闪切）；只保留
 *   `(expect-1)/expect` 地板，其余跟陀螺；终点由 `finishGuideStepGyroTrack` 钉死。
 */
export function layerGuideVisualProgress(
  expectedToken: string,
  sampleCount: number,
  gyroBefore: MoyuQuat | null,
  gyroAfter: MoyuQuat | null,
): number {
  const expect = layerGuideExpectedPacketCount(expectedToken);
  const byPacket = layerGuidePacketProgress(expectedToken, sampleCount);
  const byGyro =
    gyroBefore && gyroAfter
      ? layerGuideGyroProgress(expectedToken, gyroBefore, gyroAfter)
      : 0;
  if (expect > 0 && sampleCount >= expect) {
    const packetFloor = Math.max(0, (expect - 1) / expect);
    return Math.min(1, Math.max(byGyro, packetFloor));
  }
  if (!gyroBefore || !gyroAfter) {
    return byPacket;
  }
  return Math.min(1, Math.max(byPacket, byGyro));
}
