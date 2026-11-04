import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBluetoothSolveStats } from "./bluetoothSolveStats.ts";

describe("buildBluetoothSolveStats", () => {
  it("生成总览与 7 段", async () => {
    const stats = await buildBluetoothSolveStats({
      scramble: "R U R' U'",
      startSetupAlg: "R U R' U'",
      timedMoves: [
        { move: "U", atMs: 200 },
        { move: "R", atMs: 400 },
        { move: "U'", atMs: 600 },
        { move: "R'", atMs: 800 },
      ],
      totalTimeMs: 1000,
    });
    assert.equal(stats.overview.moves, 4);
    assert.equal(stats.phases.length, 7);
    assert.equal(stats.phases[0]?.label, "Cross");
    assert.equal(stats.phases[6]?.label, "PLL");
    // 各段公式拼接应还原计时中的完整序列
    assert.equal(
      stats.phases
        .map((phase) => phase.alg)
        .filter(Boolean)
        .join(" "),
      "U R U' R'",
    );
    const shareSum = stats.phases.reduce(
      (sum, phase) => sum + phase.timeShare,
      0,
    );
    assert.ok(shareSum > 0.9 && shareSum < 1.1);
  });

  it("观察 z2 后绝对面转展示为握持公式", async () => {
    // 黄上绿前握持 R2 B2 D' R；z2 后魔域色心绝对为 L2 B2 U' L（四分之一转展开）
    const stats = await buildBluetoothSolveStats({
      scramble: "D2 L2 D L U B' R' D L' R U' L D2 R2 L2 B R2 B' F U",
      startSetupAlg: "D2 L2 D L U B' R' D L' R U' L D2 R2 L2 B R2 B' F U",
      timedMoves: [
        { move: "z2", atMs: 0 },
        { move: "L", atMs: 100 },
        { move: "L", atMs: 200 },
        { move: "B'", atMs: 300 },
        { move: "B'", atMs: 400 },
        { move: "U'", atMs: 500 },
        { move: "L", atMs: 600 },
      ],
      totalTimeMs: 800,
    });
    assert.equal(stats.phases[0]?.alg, "z2 R2 B2 D' R");
    // HTM：R2/B2 各 1，十字面转 4 步（不含 z2）
    assert.equal(stats.phases[0]?.moves, 4);
    assert.equal(stats.overview.moves, 4);
  });
});
