import { cube3x3x3 } from "cubing/puzzles";

/**
 * 白上绿前：打乱后接还原转动，是否回到复原。
 * 供蓝牙计时「还原自动停表」；与 Moyu facelets / 计时打乱朝向一致。
 */
export async function isSolvedAfterScramble(
  scramble: string,
  solveMoves: readonly string[],
): Promise<boolean> {
  const puzzle = await cube3x3x3.kpuzzle();
  const identity = puzzle.defaultPattern();
  let pattern = identity;
  const scrambleAlg = scramble.trim();
  if (scrambleAlg !== "") {
    pattern = pattern.applyAlg(scrambleAlg);
  }
  for (const move of solveMoves) {
    const token = move.trim();
    if (token === "") {
      continue;
    }
    pattern = pattern.applyAlg(token);
  }
  return pattern.isIdentical(identity);
}
