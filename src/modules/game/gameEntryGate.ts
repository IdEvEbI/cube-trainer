/** 进游戏页前：魔方须还原（未还原求解已停用）。 */
export const GAME_ENTRY_RESTORED_TOAST = "请先还原魔方";

export type GamePageEntryGate = {
  allow: boolean;
  toast: string | null;
};

/**
 * 进游戏页闸。
 * - 蓝牙且未还原（或读不到态）：提示并留在首页。
 * - 非蓝牙：只提示，不阻止。
 * - 蓝牙且已还原：放行、无提示。
 */
export function gateGamePageEntry(options: {
  bluetoothConnected: boolean;
  /** true 已还原；false 未还原；null 未知（读失败）。 */
  cubeRestored: boolean | null;
}): GamePageEntryGate {
  if (!options.bluetoothConnected) {
    return { allow: true, toast: GAME_ENTRY_RESTORED_TOAST };
  }
  if (options.cubeRestored === true) {
    return { allow: true, toast: null };
  }
  return { allow: false, toast: GAME_ENTRY_RESTORED_TOAST };
}
