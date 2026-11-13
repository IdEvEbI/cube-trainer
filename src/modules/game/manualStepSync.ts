import { joinAlgParts } from "../scramble/bluetoothSolve.ts";
import { isSliceGuideToken, isWideGuideToken } from "../scramble/guided.ts";
import { algStatesMatch } from "./algStateMatch.ts";
import { remapGripTokenToPuzzleHint } from "./guideOrientation.ts";

/**
 * 当前手动步的对表期望：在「进入该步时的逻辑前缀」上再做一个 remapped 记号。
 *
 * `syncSetupAlg` 必须是公式侧前缀（可含 E/M/u 等），不能用 facelets 解出的纯面转
 *（如 E → D' U）：否则再拼 M' 会变成 D' U M'，与实物 E M' 归中心后不等价。
 */
export function expectedSetupAfterManualStep(
  syncSetupAlg: string,
  gripToken: string,
  orientationMoves: readonly string[],
): string {
  const absolute = remapGripTokenToPuzzleHint(gripToken, orientationMoves);
  return joinAlgParts(syncSetupAlg, absolute ? [absolute] : []);
}

/** 宽层对应外层（魔域常只跟上外层转动）。 */
export function wideOuterFaceToken(absoluteWide: string): string | null {
  const match = /^([udlrfb])(2'|2|')?$/.exec(absoluteWide.trim());
  if (!match) {
    return null;
  }
  return `${match[1]!.toUpperCase()}${match[2] ?? ""}`;
}

/**
 * 判断当前手动步是否已在实物上到位（facelets / setupAlg）。
 * 宽层 / 中层必须整步贴纸到位；不再接受「只转外层」以免方向漂。
 *
 * `syncSetupAlg` 见 {@link expectedSetupAfterManualStep}：用公式逻辑前缀拼接。
 */
export async function manualStepReachedOnCube(
  bleSetupAlg: string,
  syncSetupAlg: string,
  gripToken: string,
  orientationMoves: readonly string[],
): Promise<boolean> {
  const absolute = remapGripTokenToPuzzleHint(gripToken, orientationMoves);
  if (!absolute) {
    return false;
  }
  const expected = joinAlgParts(syncSetupAlg, [absolute]);
  if (await algStatesMatch(bleSetupAlg, expected)) {
    return true;
  }
  // 中层 / 宽层：对不上则未到位（E≡D'U 等由 algStatesMatch 归中心处理）。
  if (
    isWideGuideToken(gripToken) ||
    isWideGuideToken(absolute) ||
    isSliceGuideToken(gripToken) ||
    isSliceGuideToken(absolute)
  ) {
    return false;
  }
  return false;
}
