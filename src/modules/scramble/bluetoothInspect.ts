/** 蓝牙观察倒计时默认时长（秒）。 */
export const BLUETOOTH_INSPECT_SECONDS = 15;

export const BLUETOOTH_INSPECT_MS = BLUETOOTH_INSPECT_SECONDS * 1000;

/** 蓝牙打乱计时在引导之外的观察 / 待转阶段。 */
export type BluetoothInspectPhase = "off" | "inspecting" | "ready";

export function formatInspectCountdown(remainingMs: number): string {
  const safe = Math.max(0, Math.ceil(remainingMs / 1000));
  return String(safe);
}

/**
 * 打乱引导刚完成时应进入观察；已在观察 / 待转则保持。
 */
export function nextInspectPhaseOnGuideDone(
  current: BluetoothInspectPhase,
): BluetoothInspectPhase {
  if (current === "inspecting" || current === "ready") {
    return current;
  }
  return "inspecting";
}

/** 跳过或倒计时结束 → 等待首转。 */
export function finishBluetoothInspect(
  current: BluetoothInspectPhase,
): BluetoothInspectPhase {
  if (current === "inspecting") {
    return "ready";
  }
  return current;
}
