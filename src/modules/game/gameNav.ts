/** 游戏页导航：返回首页即卸载页面，清空游戏状态。 */

export type AppNavKind = "计时" | "练习" | "成绩" | "游戏" | "采集";

/** 从游戏页返回计时时，应视为清空游戏会话（页面卸载）。 */
export function shouldClearGameOnLeaveGame(
  from: AppNavKind,
  to: AppNavKind,
): boolean {
  return from === "游戏" && to === "计时";
}
