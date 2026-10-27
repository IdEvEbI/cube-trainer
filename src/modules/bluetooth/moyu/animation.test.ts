import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOYU_MOVE_ANIM_DEFAULTS,
  decideMoveAnimation,
  planMoveAnimations,
  shouldForceInstantForPending,
} from "./animation.ts";

describe("decideMoveAnimation", () => {
  it("interval 低于阈值则跳过动画", () => {
    assert.deepEqual(decideMoveAnimation(50), { durationMs: null });
    assert.deepEqual(decideMoveAnimation(89), { durationMs: null });
  });

  it("interval 达阈值则钳制到 [min, max]", () => {
    assert.deepEqual(decideMoveAnimation(90), {
      durationMs: 90,
    });
    assert.deepEqual(
      decideMoveAnimation(40, {
        ...MOYU_MOVE_ANIM_DEFAULTS,
        skipBelowMs: 30,
        minDurationMs: 60,
      }),
      { durationMs: 60 },
    );
    assert.deepEqual(decideMoveAnimation(500), {
      durationMs: MOYU_MOVE_ANIM_DEFAULTS.maxDurationMs,
    });
  });

  it("interval 为 0 用 fallback", () => {
    assert.deepEqual(decideMoveAnimation(0), {
      durationMs: MOYU_MOVE_ANIM_DEFAULTS.fallbackDurationMs,
    });
  });
});

describe("planMoveAnimations", () => {
  it("逐步规划", () => {
    const plan = planMoveAnimations([
      { move: "R", intervalMs: 120 },
      { move: "U", intervalMs: 40 },
    ]);
    assert.deepEqual(plan, [
      { move: "R", durationMs: 120 },
      { move: "U", durationMs: null },
    ]);
  });

  it("单批步数过多则整批瞬切", () => {
    const plan = planMoveAnimations([
      { move: "R", intervalMs: 200 },
      { move: "U", intervalMs: 200 },
      { move: "F", intervalMs: 200 },
      { move: "D", intervalMs: 200 },
    ]);
    assert.equal(plan.length, 4);
    assert.ok(plan.every((p) => p.durationMs === null));
  });

  it("forceInstant 整批瞬切", () => {
    const plan = planMoveAnimations(
      [{ move: "R", intervalMs: 200 }],
      MOYU_MOVE_ANIM_DEFAULTS,
      true,
    );
    assert.deepEqual(plan, [{ move: "R", durationMs: null }]);
  });
});

describe("shouldForceInstantForPending", () => {
  it("积压超过阈值才强制瞬切", () => {
    assert.equal(shouldForceInstantForPending(3), false);
    assert.equal(shouldForceInstantForPending(4), true);
  });
});
