/** Choice after stopping a scramble-timer solve. */
export type ResultConfirmChoice = "keep" | "discard";

/** Snapshot captured at stop; scramble must not change until the user chooses. */
export type PendingSolve = {
  timeMs: number;
  scramble: string;
};

/** Build a pending solve for the keep/discard dialog. */
export function createPendingSolve(input: {
  timeMs: number;
  scramble: string;
}): PendingSolve {
  if (!Number.isFinite(input.timeMs) || input.timeMs < 0) {
    throw new Error("时间无效");
  }
  const scramble = input.scramble.trim();
  if (scramble === "") {
    throw new Error("打乱是空的");
  }
  return {
    timeMs: Math.trunc(input.timeMs),
    scramble,
  };
}

/**
 * Resolve keep / discard. Only "keep" should write to the score log;
 * both choices still refresh scramble and return to the home screen.
 */
export function resolveResultConfirm(
  pending: PendingSolve,
  choice: ResultConfirmChoice,
): { shouldRecord: boolean; timeMs: number; scramble: string } {
  return {
    shouldRecord: choice === "keep",
    timeMs: pending.timeMs,
    scramble: pending.scramble,
  };
}

/**
 * 蓝牙还原停表：展示分段成绩弹层（确认后保存）。
 * 非蓝牙仍走保留/丢弃确认。
 */
export function shouldShowBluetoothSolveStats(
  bluetoothConnected: boolean,
): boolean {
  return bluetoothConnected;
}

/** @deprecated 使用 shouldShowBluetoothSolveStats */
export function shouldAutoKeepBluetoothResult(
  bluetoothConnected: boolean,
): boolean {
  return shouldShowBluetoothSolveStats(bluetoothConnected);
}
