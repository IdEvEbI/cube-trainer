/**
 * 页面回前台时：是否应向蓝牙魔方 requestStatus，以及对表后如何更新本地跟踪。
 * 息屏期间通知可能丢失，仅靠增量转动会与实体不同步。
 */

export type ForegroundVisibility = "visible" | "hidden" | "prerender";

/** 是否发起一次 requestStatus 对表。 */
export function shouldRequestStatusOnForeground(input: {
  visibilityState: ForegroundVisibility;
  connected: boolean;
  busy: boolean;
  resyncInFlight: boolean;
}): boolean {
  if (input.visibilityState !== "visible") {
    return false;
  }
  if (!input.connected || input.busy || input.resyncInFlight) {
    return false;
  }
  return true;
}

/**
 * 对表后发现已复原且仍在计时：应作废本局，不走正常停表记成绩。
 * 息屏丢步后轨迹不完整，保存无意义。
 */
export function shouldAbandonTimingAfterForegroundSolvedResync(input: {
  timerPhase: string;
  hasPendingSolveUi: boolean;
}): boolean {
  return input.timerPhase === "running" && !input.hasPendingSolveUi;
}
