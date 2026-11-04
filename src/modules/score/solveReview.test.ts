import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSolveReview } from "./solveReview.ts";
import { createSolveTraceSession } from "./solveTrace.ts";

describe("buildSolveReview", () => {
  it("从 solveTrace 切分分段并带上每段公式", async () => {
    const session = createSolveTraceSession({
      scramble: "R U R' U'",
      startSetupAlg: "R U R' U'",
    });
    session.appendAt("U", 100);
    session.appendAt("R", 200);
    session.appendAt("U'", 300);
    session.appendAt("R'", 400);
    const review = await buildSolveReview({
      trace: session.snapshot(),
      totalTimeMs: 500,
    });
    assert.equal(review.scramble, "R U R' U'");
    assert.equal(review.trace.steps.length, 4);
    assert.equal(review.overview.moves, 4);
    assert.equal(review.phases.length, 7);
    assert.equal(review.phases[6]?.label, "PLL");
    assert.equal(
      review.phases
        .map((phase) => phase.alg)
        .filter(Boolean)
        .join(" "),
      "U R U' R'",
    );
    assert.ok(review.phases.every((phase) => typeof phase.alg === "string"));
  });

  it("转体写入对应段公式", async () => {
    const session = createSolveTraceSession({
      scramble: "U",
      startSetupAlg: "",
    });
    session.appendAt("y", 50);
    session.appendAt("R", 100);
    session.appendAt("R'", 150);
    const review = await buildSolveReview({
      trace: session.snapshot(),
      totalTimeMs: 200,
    });
    const joined = review.phases.map((phase) => phase.alg).join(" ");
    assert.match(joined, /\by\b/);
    assert.ok(review.overview.rotations >= 1);
  });
});
