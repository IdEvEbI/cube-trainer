import type { MoyuMove } from "./constants.ts";
import type { MoyuMoveMessage } from "./packets.ts";

/**
 * 根据 move counter 差量，从 A5 历史中取出需要新应用的转动（时间正序）。
 * history[0] 为最新一步；与 csTimer moyu32 一致。
 *
 * @returns nextCounter 与按时间顺序的新步；无新步时 moves 为空。
 */
export function takeNewMoves(
  prevCounter: number,
  message: MoyuMoveMessage,
): { nextCounter: number; moves: MoyuMove[] } {
  if (prevCounter < 0) {
    // 尚未完成状态同步，忽略转动，避免错步
    return { nextCounter: prevCounter, moves: [] };
  }
  if (message.moveCounter === prevCounter) {
    return { nextCounter: prevCounter, moves: [] };
  }

  let diff = (message.moveCounter - prevCounter) & 0xff;
  if (diff === 0) {
    return { nextCounter: prevCounter, moves: [] };
  }
  if (diff > message.history.length) {
    diff = message.history.length;
  }

  const moves: MoyuMove[] = [];
  for (let i = diff - 1; i >= 0; i -= 1) {
    const sample = message.history[i];
    if (sample) {
      moves.push(sample.move);
    }
  }
  return { nextCounter: message.moveCounter, moves };
}
