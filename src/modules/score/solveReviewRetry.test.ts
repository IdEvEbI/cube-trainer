import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planSolveReviewRetry } from "./solveReviewRetry.ts";

describe("planSolveReviewRetry", () => {
  it("保留打乱并标记撤销已保存成绩", () => {
    assert.deepEqual(planSolveReviewRetry({ scramble: " R U R' " }), {
      scramble: "R U R'",
      discardPersistedScore: true,
    });
  });

  it("空打乱拒绝", () => {
    assert.throws(() => planSolveReviewRetry({ scramble: "  " }), /打乱是空的/);
  });
});
