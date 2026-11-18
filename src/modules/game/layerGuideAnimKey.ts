/**
 * 层转 gyro 跟手轨道 key（跟拧共用，不为某一中层记号单开分支）。
 */

export function layerGuideGyroAnimKey(
  progress: number,
  trackMove: string,
): string {
  return `${progress}:gyro:${trackMove.trim()}`;
}

/** 同 key 不重开；避免拧对确认后重复 startGuideStepGyroTrack。 */
export function shouldRestartLayerGuideGyroTrack(
  currentAnimKey: string | null,
  nextAnimKey: string,
): boolean {
  return currentAnimKey !== nextAnimKey;
}
