/** 蓝牙转动跟随：动画时长与过快跳过策略（可配置，默认值供真机再调）。 */

export type MoyuMoveAnimConfig = {
  /**
   * 协议 interval（相对上一步毫秒）低于此值则跳过动画、瞬切。
   * 调高 → 更容易跳过；调低 → 更多动画。
   */
  skipBelowMs: number;
  /** 动画时长下限（毫秒）。 */
  minDurationMs: number;
  /** 动画时长上限（毫秒），避免慢转拖太久。 */
  maxDurationMs: number;
  /** interval 为 0 / 缺失时的默认动画时长。 */
  fallbackDurationMs: number;
  /**
   * 单次回调内步数超过此值，整批瞬切（连打/丢包追赶）。
   */
  maxBatchAnimate: number;
  /**
   * 播放队列里尚未播完的动画步数超过此值时，新来的与积压一并瞬切。
   */
  maxPendingAnimated: number;
};

export const MOYU_MOVE_ANIM_DEFAULTS: MoyuMoveAnimConfig = {
  skipBelowMs: 90,
  minDurationMs: 60,
  maxDurationMs: 220,
  fallbackDurationMs: 150,
  maxBatchAnimate: 3,
  maxPendingAnimated: 3,
};

export type PlannedMoveAnim = {
  move: string;
  /** null = 跳过动画，直接落到结果。 */
  durationMs: number | null;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 根据协议 interval 决定本步是否动画、播多久。
 * interval 越小表示转得越快。
 */
export function decideMoveAnimation(
  intervalMs: number,
  config: MoyuMoveAnimConfig = MOYU_MOVE_ANIM_DEFAULTS,
): { durationMs: number | null } {
  if (intervalMs > 0 && intervalMs < config.skipBelowMs) {
    return { durationMs: null };
  }
  const raw = intervalMs > 0 ? intervalMs : config.fallbackDurationMs;
  return {
    durationMs: clamp(raw, config.minDurationMs, config.maxDurationMs),
  };
}

/**
 * 为一批新转动生成播放计划。
 * @param forceInstant 队列积压或外部要求时整批瞬切。
 */
export function planMoveAnimations(
  samples: readonly { move: string; intervalMs: number }[],
  config: MoyuMoveAnimConfig = MOYU_MOVE_ANIM_DEFAULTS,
  forceInstant = false,
): PlannedMoveAnim[] {
  if (samples.length === 0) {
    return [];
  }
  const snapAll = forceInstant || samples.length > config.maxBatchAnimate;
  return samples.map((sample) => {
    if (snapAll) {
      return { move: sample.move, durationMs: null };
    }
    const { durationMs } = decideMoveAnimation(sample.intervalMs, config);
    return { move: sample.move, durationMs };
  });
}

/** 是否应因积压而强制瞬切本批。 */
export function shouldForceInstantForPending(
  pendingAnimated: number,
  config: MoyuMoveAnimConfig = MOYU_MOVE_ANIM_DEFAULTS,
): boolean {
  return pendingAnimated > config.maxPendingAnimated;
}
