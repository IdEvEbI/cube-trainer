/**
 * 打乱引导：宽层 / 中层用手势（转动包 + 可选陀螺）判定到位。
 * facelets 轮询仍作展示与边界校准；本模块只负责「这一步像不像期望记号」。
 */

import {
  lastMoveBurst,
  type LayerCaptureLabel,
  type LayerCaptureMoveSample,
} from "../bluetooth/moyu/layerCapture.ts";
import {
  classifyMoyuLayerGestureMoves,
  expectedBurstMovesForLayer,
  matchMoyuLayerGesture,
  matchMoyuLayerGestureMoves,
  parseLayerGestureToken,
} from "../bluetooth/moyu/moyuLayerGesture.ts";
import type { MoyuQuat } from "../bluetooth/moyu/orientation.ts";

/** 引导用手势间隔：中层两外层常慢于采集页的 400ms。 */
export const GUIDE_LAYER_BURST_GAP_MS = 900;

export type GuideLayerGestureTracker = {
  progress: number;
  expectedToken: string;
  gyroBefore: MoyuQuat | null;
  samples: LayerCaptureMoveSample[];
  /** 本步首包墙钟（performance.now），供动画时长跟手势。 */
  firstSampleAtMs: number | null;
};

export type GuideLayerGestureEval =
  | { status: "pending" }
  | { status: "matched" }
  | { status: "other"; classified: LayerCaptureLabel | null };

export function createGuideLayerGestureTracker(input: {
  progress: number;
  expectedToken: string;
  gyroBefore: MoyuQuat | null;
}): GuideLayerGestureTracker {
  return {
    progress: input.progress,
    expectedToken: input.expectedToken,
    gyroBefore: input.gyroBefore,
    samples: [],
    firstSampleAtMs: null,
  };
}

/** 步变更时换新 tracker；同一步复用并保留已采包。 */
export function syncGuideLayerGestureTracker(
  current: GuideLayerGestureTracker | null,
  input: {
    progress: number;
    expectedToken: string;
    gyroBefore: MoyuQuat | null;
  },
): GuideLayerGestureTracker {
  if (
    current &&
    current.progress === input.progress &&
    current.expectedToken === input.expectedToken
  ) {
    return current;
  }
  return createGuideLayerGestureTracker(input);
}

export function appendGuideLayerGestureMoves(
  tracker: GuideLayerGestureTracker,
  samples: readonly LayerCaptureMoveSample[],
  nowMs: number = performance.now(),
): GuideLayerGestureTracker {
  if (samples.length === 0) {
    return tracker;
  }
  return {
    ...tracker,
    firstSampleAtMs:
      tracker.firstSampleAtMs ??
      (tracker.samples.length === 0 ? nowMs : tracker.firstSampleAtMs),
    samples: [
      ...tracker.samples,
      ...samples.map((sample) => ({
        move: sample.move,
        intervalMs: sample.intervalMs,
      })),
    ],
  };
}

function burstMovesForEval(tracker: GuideLayerGestureTracker): string[] {
  return lastMoveBurst(tracker.samples, GUIDE_LAYER_BURST_GAP_MS).map(
    (sample) => sample.move,
  );
}

/** 候选包序列：最后一段手势，外加最近 2/4 步（慢拧中层 / `*2` 间隔可能偏大）。 */
function candidateMoveLists(tracker: GuideLayerGestureTracker): string[][] {
  const lists: string[][] = [burstMovesForEval(tracker)];
  if (tracker.samples.length >= 2) {
    lists.push(
      tracker.samples
        .slice(-2)
        .map((sample) => sample.move.trim())
        .filter(Boolean),
    );
  }
  if (tracker.samples.length >= 4) {
    lists.push(
      tracker.samples
        .slice(-4)
        .map((sample) => sample.move.trim())
        .filter(Boolean),
    );
  }
  return lists;
}

function hasEnoughMovesForToken(
  expectedToken: string,
  moves: readonly string[],
): boolean {
  const want = expectedBurstMovesForLayer(expectedToken);
  if (!want) {
    return false;
  }
  return moves.length >= want.length;
}

/**
 * 用当前步已采包 + 此刻陀螺判断是否到位。
 * 宽层一律要陀螺（`r` 与外层 `L` 同包）；中层唯一包可无陀螺，否则包+陀螺。
 */
export function evaluateGuideLayerGesture(
  tracker: GuideLayerGestureTracker,
  gyroAfter: MoyuQuat | null,
): GuideLayerGestureEval {
  const parsed = parseLayerGestureToken(tracker.expectedToken);
  let sawOther: LayerCaptureLabel | null = null;
  for (const moves of candidateMoveLists(tracker)) {
    if (!hasEnoughMovesForToken(tracker.expectedToken, moves)) {
      continue;
    }
    if (!matchMoyuLayerGestureMoves(tracker.expectedToken, moves)) {
      const classified = classifyMoyuLayerGestureMoves(moves);
      if (classified[0]) {
        sawOther = classified[0];
      }
      continue;
    }
    if (
      matchMoyuLayerGesture({
        expectedToken: tracker.expectedToken,
        burstMoves: moves,
        gyroBefore: tracker.gyroBefore ?? undefined,
        gyroAfter: gyroAfter ?? undefined,
      })
    ) {
      return { status: "matched" };
    }
    // 宽层：包对但陀螺静默/不对 → 继续等，勿当成外层误推进。
    if (parsed?.kind === "wide") {
      continue;
    }
  }
  if (sawOther) {
    return { status: "other", classified: sawOther };
  }
  return { status: "pending" };
}
