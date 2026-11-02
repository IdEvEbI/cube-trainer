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
    const shareSum = stats.phases.reduce(
      (sum, phase) => sum + phase.timeShare,
      0,
    );
    assert.ok(shareSum > 0.9 && shareSum < 1.1);
  });
});
