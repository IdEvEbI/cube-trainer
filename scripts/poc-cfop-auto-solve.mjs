/**
 * 离线 PoC：固定打乱 → 观察 z2 + 黄上 CFOP 分段。
 * 运行：npm run poc:cfop
 */

import { cube3x3x3 } from "cubing/puzzles";
import { solveCfopGame } from "../src/modules/game/cfopSolve.ts";

const FIXED_SCRAMBLE = "R U2 F' L D B2 R' U F2 D' L2 B R2 U' F D2 B' L U2 R'";

async function main() {
  const scramble = FIXED_SCRAMBLE;
  console.log("=== CFOP 自动还原离线 PoC ===");
  console.log("打乱（白上绿前，固定）:", scramble);
  console.log("");

  const phases = await solveCfopGame(scramble);
  const solution = phases.flatMap((phase) => phase.moves).join(" ");

  console.log("完整解:", solution);
  console.log("");
  console.log("--- 分段 ---");
  for (const phase of phases) {
    console.log(`${phase.id.padEnd(6)}  ${phase.moves.join(" ") || "(空)"}`);
  }
  console.log("");

  const puzzle = await cube3x3x3.kpuzzle();
  const identity = puzzle.defaultPattern();
  const yellowUpSolved = identity.applyAlg("z2");
  const ok = identity
    .applyAlg(scramble)
    .applyAlg(solution)
    .isIdentical(yellowUpSolved);
  console.log("打乱(白上) · (z2 + 黄上解) → 黄上复原?", ok);
  if (!ok) {
    process.exitCode = 1;
  }
}

await main();
