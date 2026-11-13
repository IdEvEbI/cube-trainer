import { joinAlgParts } from "../scramble/bluetoothSolve.ts";
import { isSliceGuideToken, isWideGuideToken } from "../scramble/guided.ts";
import { algStatesMatch } from "./algStateMatch.ts";
import { remapGripTokenToPuzzleHint } from "./guideOrientation.ts";

/**
 * 当前手动步的对表期望。
 *
 * `syncSetupAlg` 必须是公式侧前缀（可含 z2/E/M/u 等），不能用 facelets 解出的纯面转
 *（如 E → D' U）：否则再拼 M' 会变成 D' U M'，与实物 E M' 归中心后不等价。
 *
 * 前缀已含转体/层转时优先拼**握持记号本身**（`… f R2` + `u`，勿再 z2 映成 `d`，
 * 否则 PLL 的 `u` 会永远对不上而卡死）。无转体的白上前缀仍可按 orientation 映绝对面。
 */
export function expectedSetupAfterManualStep(
  syncSetupAlg: string,
  gripToken: string,
  orientationMoves: readonly string[],
): string {
  const token = gripToken.trim();
  if (!token) {
    return syncSetupAlg.trim();
  }
  // 公式前缀路径：直接拼握持记号
  if (formulaPrefixKeepsGripToken(syncSetupAlg)) {
    return joinAlgParts(syncSetupAlg, [token]);
  }
  const absolute = remapGripTokenToPuzzleHint(token, orientationMoves);
  return joinAlgParts(syncSetupAlg, absolute ? [absolute] : []);
}

/** 前缀里已有 x/y/z 或宽层/中层时，后续步应保持握持记号。 */
export function formulaPrefixKeepsGripToken(setupAlg: string): boolean {
  return /(?:^|\s)(?:[xyz](?:2'|2|')?|[udlrfbMES](?:2'|2|')?)(?:\s|$)/.test(
    setupAlg.trim(),
  );
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
  const token = gripToken.trim();
  if (!token) {
    return false;
  }
  const expected = expectedSetupAfterManualStep(
    syncSetupAlg,
    token,
    orientationMoves,
  );
  if (await algStatesMatch(bleSetupAlg, expected)) {
    return true;
  }
  // 兼容：公式前缀路径未命中时，再试朝向映绝对面（旧白上 sync）。
  if (formulaPrefixKeepsGripToken(syncSetupAlg)) {
    const absolute = remapGripTokenToPuzzleHint(token, orientationMoves);
    if (
      absolute &&
      absolute !== token &&
      (await algStatesMatch(
        bleSetupAlg,
        joinAlgParts(syncSetupAlg, [absolute]),
      ))
    ) {
      return true;
    }
  }
  // 中层 / 宽层：对不上则未到位（E≡D'U 等由 algStatesMatch 归中心处理）。
  if (isWideGuideToken(token) || isSliceGuideToken(token)) {
    return false;
  }
  const absolute = remapGripTokenToPuzzleHint(token, orientationMoves);
  if (absolute && (isWideGuideToken(absolute) || isSliceGuideToken(absolute))) {
    return false;
  }
  return false;
}
