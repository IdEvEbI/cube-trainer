import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGameSolveOverview } from "./gameOverview.ts";

describe("buildGameSolveOverview", () => {
  it("counts non-rotation moves and display rotations", () => {
    assert.deepEqual(
      buildGameSolveOverview([
        { id: "Cross", moves: ["z2", "R", "U"] },
        { id: "F2L1", moves: ["r", "U", "r'"] },
        { id: "OLL", moves: ["y", "R", "U", "R'"] },
        { id: "PLL", moves: ["y'", "R2"] },
      ]),
      // 面/宽层 9；转体 z2 + y + y'（中间有面转，不合并）= 3
      { moves: 9, rotations: 3 },
    );
  });

  it("empty phases → zeros", () => {
    assert.deepEqual(buildGameSolveOverview([]), { moves: 0, rotations: 0 });
  });
});
