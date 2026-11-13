import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  guideLayerGyroOrientationAlg,
  layerTokenDualParts,
  remapBleFaceMoveAfterLayerGyro,
  remapBleFaceMoveThroughOrientationAlg,
  resolveGuideBleFaceMove,
} from "./layerGuideDualPaint.ts";

describe("layerTokenDualParts", () => {
  it("r → L + x'", () => {
    assert.deepEqual(layerTokenDualParts("r"), {
      outerMoves: ["L"],
      orientationAlg: "x'",
    });
  });

  it("r' → L' + x", () => {
    assert.deepEqual(layerTokenDualParts("r'"), {
      outerMoves: ["L'"],
      orientationAlg: "x",
    });
  });

  it("M → L' R + x", () => {
    assert.deepEqual(layerTokenDualParts("M"), {
      outerMoves: ["L'", "R"],
      orientationAlg: "x",
    });
  });

  it("面转不是层转对偶", () => {
    assert.equal(layerTokenDualParts("D"), null);
    assert.equal(layerTokenDualParts("x'"), null);
  });
});

describe("guideLayerGyroOrientationAlg", () => {
  it("r 到位累积 x'", () => {
    assert.equal(guideLayerGyroOrientationAlg(["r", "U'", "r'", "L"], 1), "x'");
  });

  it("外面转不追加 Δ", () => {
    assert.equal(guideLayerGyroOrientationAlg(["r", "U'", "r'", "L"], 2), "x'");
  });

  it("空前缀", () => {
    assert.equal(guideLayerGyroOrientationAlg(["r", "U'"], 0), "");
  });
});

describe("remapBleFaceMoveThroughOrientationAlg", () => {
  it("r 后 Δ=x'：空间顶面 F' → 公式 U'", () => {
    assert.equal(remapBleFaceMoveThroughOrientationAlg("F'", "x'"), "U'");
  });

  it("z2 时 BLE R → 公式 L（长序列漂移典型）", () => {
    assert.equal(remapBleFaceMoveThroughOrientationAlg("R", "z2"), "L");
    assert.equal(remapBleFaceMoveThroughOrientationAlg("L", "z2"), "R");
  });

  it("空朝向原样", () => {
    assert.equal(remapBleFaceMoveThroughOrientationAlg("U'", ""), "U'");
  });
});

describe("resolveGuideBleFaceMove", () => {
  it("色心已是期望 L：即使朝向噪声 y 也不映成 F", () => {
    assert.equal(resolveGuideBleFaceMove("L", "L", "y"), "L");
    assert.equal(remapBleFaceMoveThroughOrientationAlg("L", "y"), "F");
  });

  it("未摆正：色心 F' + Δ x' 且期望 U' → 采纳映射", () => {
    assert.equal(resolveGuideBleFaceMove("F'", "U'", "x'"), "U'");
  });

  it("真错面：色心 F、期望 L、无有效映射 → 仍 F", () => {
    assert.equal(resolveGuideBleFaceMove("F", "L", ""), "F");
  });

  it("z2 漂移：色心 R 已是期望则不映成 L", () => {
    assert.equal(resolveGuideBleFaceMove("R", "R", "z2"), "R");
  });
});

describe("remapBleFaceMoveAfterLayerGyro", () => {
  it("r 后空间顶面 F' → 公式 U'", () => {
    assert.equal(
      remapBleFaceMoveAfterLayerGyro("F'", ["r", "U'", "r'", "L"], 1),
      "U'",
    );
  });

  it("对偶代数：r = L x；r x' = L", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const id = puzzle.defaultPattern();
    assert.deepEqual(
      id.applyAlg("r").patternData,
      id.applyAlg("L x").patternData,
    );
    assert.deepEqual(
      id.applyAlg("r x'").patternData,
      id.applyAlg("L").patternData,
    );
  });
});
