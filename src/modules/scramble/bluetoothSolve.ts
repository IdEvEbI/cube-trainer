import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";

/**
 * 白上绿前：从 setup 起叠转动，得到当前图案。
 * 供停表判定与 CFOP 分段共用，避免两处手写 applyAlg 漂移。
 */
export async function patternFromSetup(
  setupAlg: string,
  moves: readonly string[],
): Promise<KPattern> {
  const puzzle = await cube3x3x3.kpuzzle();
  let pattern = puzzle.defaultPattern();
  const setup = setupAlg.trim();
  if (setup !== "") {
    pattern = pattern.applyAlg(setup);
  }
  for (const move of moves) {
    const token = move.trim();
    if (token !== "") {
      pattern = pattern.applyAlg(token);
    }
  }
  return pattern;
}

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
  const pattern = await patternFromSetup(setupAlg, movesSinceSetup);
  return pattern.isIdentical(puzzle.defaultPattern());
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

/** 拼接 setup 与后续记号为空格分隔算法串；空段与空白丢弃。 */
export function joinAlgParts(
  setupAlg: string,
  moves: readonly string[],
): string {
  return [setupAlg, ...moves]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}
