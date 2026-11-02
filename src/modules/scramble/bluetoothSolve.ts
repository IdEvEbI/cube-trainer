import { cube3x3x3 } from "cubing/puzzles";

/**
 * 白上绿前：从某一起始 setup（连接时 facelets 反解算法）起，
 * 叠加此后全部实体转动，是否回到复原。
 * 不假设连接时已是复原态；供蓝牙计时「还原自动停表」。
 */
export async function isSolvedFromSetup(
  setupAlg: string,
  movesSinceSetup: readonly string[],
): Promise<boolean> {
  const puzzle = await cube3x3x3.kpuzzle();
  const identity = puzzle.defaultPattern();
  let pattern = identity;
  const setup = setupAlg.trim();
  if (setup !== "") {
    pattern = pattern.applyAlg(setup);
  }
  for (const move of movesSinceSetup) {
    const token = move.trim();
    if (token === "") {
      continue;
    }
    pattern = pattern.applyAlg(token);
  }
  return pattern.isIdentical(identity);
}

/**
 * 白上绿前：打乱后接还原转动，是否回到复原。
 * 等价于起点为复原时的 `isSolvedFromSetup(scramble, solveMoves)`。
 */
export async function isSolvedAfterScramble(
  scramble: string,
  solveMoves: readonly string[],
): Promise<boolean> {
  return isSolvedFromSetup(scramble, solveMoves);
}
