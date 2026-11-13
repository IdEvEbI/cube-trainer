import { Alg } from "cubing/alg";
import {
  guideAlgToCubingAlg,
  guideTokenToCubingAlg,
} from "../scramble/fixedCenterLayer.ts";

/** 回放 / 练习动画：层转 + 整步转体（复盘含 x/y/z）。 */
export const PLAYBACK_MOVE = /^(?:[UDLRFBudlrfbxyz]|[MES])(?:2'|'2|2|')?$/;

/**
 * 非蓝牙 / Twisty 播放用 alg 文本。
 * 采集式双步撇（`E'2`）须先改成 cubing 写法（`E2'`），否则 `Alg` 直接抛错、步进停住。
 */
export function playbackAlgText(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = guideAlgToCubingAlg(trimmed);
  const moves = [...new Alg(normalized).experimentalLeafMoves()].map((move) =>
    move.toString(),
  );
  const invalid = moves.find((move) => !PLAYBACK_MOVE.test(move));
  if (invalid) {
    throw new Error(`无法播放转动：${invalid}`);
  }
  return moves.join(" ");
}

/** 单步追加到 Twisty 前规范化（`M'2` → `M2'`）。 */
export function playbackMoveToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = guideTokenToCubingAlg(trimmed);
  if (!PLAYBACK_MOVE.test(normalized) && !PLAYBACK_MOVE.test(trimmed)) {
    throw new Error(`无法播放转动：${trimmed}`);
  }
  return normalized;
}
