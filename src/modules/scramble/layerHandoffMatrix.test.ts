/**
 * 对齐 docs/research-moyu-layer-capture.md「层转后交接」最小矩阵。
 * 改残留 / 静默 / 转体确认行为前须先改本表（或文档），禁止只修真机。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guideRotationStepConfirmable,
  orientationHoldStableMsForMove,
  quatFromOrientationAlg,
} from "../score/cubeOrientation.ts";
import { resolveGuideBleFaceMoveWithCandidates } from "./guideBleFaceRemap.ts";
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

  it("E15: S' → L（黄上 z2 y）：绝对 F 经公式映面为 L 则放行", () => {
    const zy = ["z2 y"] as const;
    assert.equal(isResidualLayerDualFaceMove("F", "L", zy, "S'"), false);
    const ctrl = createGuideFollowController();
    const t0 = 90_000;
    ctrl.beginLayerEchoQuiet(t0, "S'");
    assert.equal(ctrl.shouldSwallowGuideFaceMove("F", t0 + 1, "L", zy), false);
    assert.equal(ctrl.shouldDiscardResidualLayerDual("F", "L", zy), false);
  });

  it("E17: r' b' → R（黄上）：色心累积映面，绝对 D 收成 R；勿停在 B", () => {
    const formula = ["z2"] as const;
    const moves = ["z2", "r'", "b'", "R", "u'", "L", "S'"] as const;
    const progress = 3;
    const ctrl = createGuideFollowController();
    const z2 = quatFromOrientationAlg("z2");
    ctrl.syncFaceRemapHome({
      orientsKey: "z2",
      active: true,
      liveQuat: z2,
    });
    // 刚完成 b'：残留窗抑制 relative
    ctrl.beginLayerEchoQuiet(
      110_000,
      "b'",
      undefined,
      quatFromOrientationAlg("z2 x z"),
    );
    const cands = ctrl.faceOrientCandidates({
      formulaOrients: formula,
      displayMoves: moves,
      progress,
      liveQuat: quatFromOrientationAlg("z2 x z"),
      requireYellowUp: true,
    });
    assert.ok(
      cands.some((alg) => alg.includes("x'") && alg.includes("z")),
      `应含色心累积 x' z: ${cands.join(" | ")}`,
    );
    // 公式帧握持 R ≡ 色心 D（黄上 + r' b' 后）
    assert.equal(resolveGuideBleFaceMoveWithCandidates("D", "R", cands), "R");
    // 绝对 B 不得误收成 R（旧 Last-only 回落曾把 B 收成错步）
    assert.notEqual(
      resolveGuideBleFaceMoveWithCandidates("B", "R", cands),
      "R",
    );
  });

  it("E16: S' → L：残留窗内勿叠 live relative，D 不得收成 L", () => {
    const formula = ["z2", "y"] as const;
    const beforeSlice = quatFromOrientationAlg("z2 y");
    const afterSlice = quatFromOrientationAlg("z2 y z'");
    const moves = ["z2", "y", "L", "U", "L'", "U", "S'", "L", "S"] as const;
    const progress = 7; // 指向 L

    const poisoned = createGuideFollowController();
    poisoned.syncFaceRemapHome({
      orientsKey: "z2 y",
      active: true,
      liveQuat: beforeSlice,
    });
    // 无残留标记时：relative 把 z' 读成 x'，D 误命中 L
    const bad = poisoned.faceOrientCandidates({
      formulaOrients: formula,
      displayMoves: moves,
      progress,
      liveQuat: afterSlice,
      requireYellowUp: true,
    });
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("D", "L", bad),
      "L",
      "无残留抑制时应能复现误命中",
    );

    const fixed = createGuideFollowController();
    fixed.syncFaceRemapHome({
      orientsKey: "z2 y",
      active: true,
      liveQuat: beforeSlice,
    });
    fixed.beginLayerEchoQuiet(100_000, "S'", undefined, afterSlice);
    const good = fixed.faceOrientCandidates({
      formulaOrients: formula,
      displayMoves: moves,
      progress,
      liveQuat: afterSlice,
      requireYellowUp: true,
    });
    assert.ok(
      !good.some((alg) => /(^|\s)x'?(\s|$)/.test(alg)),
      `残留窗内不应含 relative x: ${good.join(" | ")}`,
    );
    assert.notEqual(resolveGuideBleFaceMoveWithCandidates("D", "L", good), "L");
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("F", "L", good),
      "L",
      "握持 L 的色心 F 仍应命中",
    );
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
