import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeOverviewMetrics,
  computePauseRate,
  computeTps,
  countFaceMoves,
  countRotations,
} from "./solveMetrics.ts";

describe("solveMetrics", () => {
  it("区分步进与转体", () => {
    assert.equal(countFaceMoves(["R", "U'", "x", "R2", "y2"]), 3);
    assert.equal(countRotations(["R", "U'", "x", "R2", "y2"]), 2);
  });

  it("计算 TPS 与停顿率", () => {
    assert.equal(computeTps(10, 2000), 5);
    assert.equal(computeTps(0, 2000), 0);
    const rate = computePauseRate(
      [
        { move: "R", atMs: 100 },
        { move: "U", atMs: 200 },
        { move: "R'", atMs: 1500 },
      ],
      2000,
      500,
    );
    // gaps: 100, 100, 1300, 500 → pause 1300 / 2000
    assert.ok(Math.abs(rate - 0.65) < 1e-9);
  });

  it("总览汇总", () => {
    const overview = computeOverviewMetrics(
      [
        { move: "R", atMs: 200 },
        { move: "x", atMs: 400 },
        { move: "U", atMs: 600 },
      ],
      1000,
    );
    assert.equal(overview.moves, 2);
    assert.equal(overview.rotations, 1);
    assert.equal(overview.timeMs, 1000);
  });
});
