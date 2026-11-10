import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGuidedMoves } from "../scramble/guided.ts";
import { applyGuidedBleAbsoluteMove } from "./guidedAbsolute.ts";

describe("applyGuidedBleAbsoluteMove", () => {
  it("z2 后按绝对面匹配握持 L'（蓝牙 R'），不因 yaw 误读", () => {
    const guide = createGuidedMoves(["z2", "L'", "d", "L'"]);
    // 已过 z2
    const afterZ2 = {
      ...guide,
      progress: 1,
    };
    const orients = ["z2"];
    // 握持 L' → 绝对 R'
    const ok = applyGuidedBleAbsoluteMove(afterZ2, "R'", orients);
    assert.equal(ok.kind, "progress");
    assert.equal(ok.guide.progress, 2);
  });

  it("绝对面不对则进纠错", () => {
    const guide = {
      ...createGuidedMoves(["z2", "L'"]),
      progress: 1,
    };
    const bad = applyGuidedBleAbsoluteMove(guide, "F'", ["z2"]);
    assert.equal(bad.kind, "wrong");
  });
});
