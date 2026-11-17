/**
 * 对齐 docs/research-moyu-layer-capture.md「层转后交接」最小矩阵。
 * 改残留 / 静默 / 转体确认行为前须先改本表（或文档），禁止只修真机。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guideRotationStepConfirmable,
  orientationHoldStableMsForMove,
} from "../score/cubeOrientation.ts";
import {
  createGuideFollowController,
  GUIDE_FOLLOW_MOVE_QUIET_MS,
  isResidualLayerDualFaceMove,
  layerEchoFaceMoves,
} from "./guideFollowController.ts";

const CANDS = ["z2"] as const;

describe("层转后交接矩阵 · 对偶残留 / 静默", () => {
  it("E1: f' → L'，ble B' reject", () => {
    assert.equal(isResidualLayerDualFaceMove("B'", "L'", CANDS, "f'"), true);
  });

  it("E2: f' → L'，ble L' accept", () => {
    assert.equal(isResidualLayerDualFaceMove("L'", "L'", CANDS, "f'"), false);
  });

  it("E3: M' → F'，ble L' reject（回声假命中）", () => {
    assert.equal(isResidualLayerDualFaceMove("L'", "F'", CANDS, "M'"), true);
  });

  it("E4: S' → F'，ble F' accept（原包即期望）", () => {
    assert.equal(isResidualLayerDualFaceMove("F'", "F'", CANDS, "S'"), false);
    const ctrl = createGuideFollowController();
    const t0 = 50_000;
    ctrl.beginLayerEchoQuiet(t0, "S'");
    assert.equal(ctrl.shouldSwallowGuideFaceMove("F'", t0 + 1, "F'"), false);
    assert.equal(ctrl.shouldDiscardResidualLayerDual("F'", "F'", CANDS), false);
  });

  it("E5: S' → F'，ble B' reject", () => {
    assert.equal(isResidualLayerDualFaceMove("B'", "F'", CANDS, "S'"), true);
  });

  it("E10: E → U，ble U accept（原包∈echo 且===期望）", () => {
    assert.ok(layerEchoFaceMoves("E").includes("U"));
    assert.equal(isResidualLayerDualFaceMove("U", "U", CANDS, "E"), false);
  });

  it("E11: r' → U，ble U accept（U∉echo）", () => {
    assert.equal(layerEchoFaceMoves("r'").includes("U"), false);
    assert.equal(isResidualLayerDualFaceMove("U", "U", CANDS, "r'"), false);
    const ctrl = createGuideFollowController();
    const t0 = 60_000;
    ctrl.beginLayerEchoQuiet(t0, "r'");
    assert.equal(ctrl.shouldSwallowGuideFaceMove("U", t0 + 1, "U"), false);
    assert.equal(ctrl.shouldSwallowGuideFaceMove("L'", t0 + 1, "U"), true);
  });

  it("E12: b → R'，ble F reject；ble R' accept", () => {
    assert.equal(isResidualLayerDualFaceMove("F", "R'", CANDS, "b"), true);
    assert.equal(isResidualLayerDualFaceMove("R'", "R'", CANDS, "b"), false);
  });

  it("E14: r → R（黄上）：绝对 L 经公式映面为 R 则放行", () => {
    const z2 = ["z2"] as const;
    assert.equal(isResidualLayerDualFaceMove("L", "R", z2, "r"), false);
    assert.equal(isResidualLayerDualFaceMove("L'", "R", z2, "r"), true);
    const ctrl = createGuideFollowController();
    const t0 = 80_000;
    ctrl.beginLayerEchoQuiet(t0, "r");
    assert.equal(ctrl.shouldSwallowGuideFaceMove("L", t0 + 1, "R", z2), false);
    assert.equal(ctrl.shouldDiscardResidualLayerDual("L", "R", z2), false);
  });

  it("静默窗超时后对偶残留仍丢；推进后清空", () => {
    const ctrl = createGuideFollowController();
    const t0 = 70_000;
    ctrl.beginLayerEchoQuiet(t0, "f'");
    const after = t0 + GUIDE_FOLLOW_MOVE_QUIET_MS + 1;
    assert.equal(ctrl.shouldSwallowGuideFaceMove("B'", after, "L'"), false);
    assert.equal(ctrl.shouldDiscardResidualLayerDual("B'", "L'", CANDS), true);
    ctrl.clearResidualLayerDual();
    assert.equal(ctrl.shouldDiscardResidualLayerDual("B'", "L'", CANDS), false);
  });
});

describe("层转后交接矩阵 · 转体确认", () => {
  const holdMs = orientationHoldStableMsForMove("y'");
  const movesAfterD = ["z2", "d'", "y'", "U'"] as const;

  it("E6: d' → y'，进入 0ms 且无相对 hold → reject", () => {
    assert.equal(
      guideRotationStepConfirmable({
        expectedMove: "y'",
        relativeCommittedAlg: "",
        heldAlg: "z2 y'",
        displayMoves: movesAfterD,
        progress: 2,
        msSinceStepEnter: 0,
        holdMs,
      }),
      false,
    );
  });

  it("E7: d' → y'，满 hold 窗且绝对仍到位 → accept", () => {
    assert.equal(
      guideRotationStepConfirmable({
        expectedMove: "y'",
        relativeCommittedAlg: "",
        heldAlg: "z2 y'",
        displayMoves: movesAfterD,
        progress: 2,
        msSinceStepEnter: holdMs,
        holdMs,
      }),
      true,
    );
  });

  it("E8: d' → y'，相对 committed 满足（握持 y' 时 Δ 常记为 y）→ accept", () => {
    // relativeOrientationAlg(z2 → z2 y') === "y"；scrambleGuideRotationSatisfied 对非 z 取反对表。
    assert.equal(
      guideRotationStepConfirmable({
        expectedMove: "y'",
        relativeCommittedAlg: "y",
        heldAlg: "z2",
        displayMoves: movesAfterD,
        progress: 2,
        msSinceStepEnter: 100,
        holdMs,
      }),
      true,
    );
  });

  it("E9: u → y，进入 0ms → reject", () => {
    const moves = ["z2", "u", "y", "R"] as const;
    assert.equal(
      guideRotationStepConfirmable({
        expectedMove: "y",
        relativeCommittedAlg: "",
        heldAlg: "z2 y",
        displayMoves: moves,
        progress: 2,
        msSinceStepEnter: 0,
        holdMs: orientationHoldStableMsForMove("y"),
      }),
      false,
    );
  });
});
