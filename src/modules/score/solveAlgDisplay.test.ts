import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absoluteFaceMoveToGrip,
  cancelRedundantRotations,
  countFaceMovesHtm,
  countRotationsDisplay,
  formatGripRelativeAlg,
  gripAbsoluteRoundTrip,
  mergeQuarterMoves,
} from "./solveAlgDisplay.ts";

describe("absoluteFaceMoveToGrip", () => {
  it("z2 后绝对 L/U 映回握持 R/D（黄上绿前）", () => {
    assert.equal(absoluteFaceMoveToGrip("L", ["z2"]), "R");
    assert.equal(absoluteFaceMoveToGrip("L2", ["z2"]), "R2");
    assert.equal(absoluteFaceMoveToGrip("U'", ["z2"]), "D'");
    assert.equal(absoluteFaceMoveToGrip("B2", ["z2"]), "B2");
  });

  it("与握持→绝对互逆", () => {
    for (const grip of ["R", "R'", "R2", "U", "F'", "D2", "L", "B"]) {
      assert.equal(gripAbsoluteRoundTrip(grip, ["z2"]), grip);
      assert.equal(gripAbsoluteRoundTrip(grip, ["z2", "y"]), grip);
      assert.equal(gripAbsoluteRoundTrip(grip, ["y"]), grip);
    }
  });
});

describe("mergeQuarterMoves", () => {
  it("合并同层连续四分之一转", () => {
    assert.deepEqual(mergeQuarterMoves(["L", "L", "B'", "B'", "U'", "L"]), [
      "L2",
      "B2",
      "U'",
      "L",
    ]);
    assert.deepEqual(mergeQuarterMoves(["R", "R'"]), []);
  });
});

describe("formatGripRelativeAlg", () => {
  it("观察 z2 + 绝对十字 → 握持公式 z2 R2 B2 D' R", () => {
    const alg = formatGripRelativeAlg(["z2", "L", "L", "B'", "B'", "U'", "L"]);
    assert.equal(alg, "z2 R2 B2 D' R");
  });

  it("夹杂误检转体时仍尽量还原握持面转", () => {
    // 理想情况无 x'；有噪声时至少面转字母应对
    const alg = formatGripRelativeAlg([
      "z2",
      "L",
      "x'",
      "L",
      "B'",
      "B'",
      "x",
      "U'",
      "L",
    ]);
    assert.match(alg, /\bz2\b/);
    assert.match(alg, /\bR\b/);
    assert.doesNotMatch(alg, /\bL2\b/);
  });

  it("消去 y y' / z z' 空转", () => {
    assert.deepEqual(cancelRedundantRotations(["y", "y'", "R"]), ["R"]);
    assert.deepEqual(cancelRedundantRotations(["z", "z'", "U"]), ["U"]);
    assert.deepEqual(cancelRedundantRotations(["y", "y"]), ["y2"]);
  });

  it("HTM：R2 计 1 步", () => {
    assert.equal(countFaceMovesHtm(["L", "L", "B'", "B'", "U'", "L"]), 4);
    assert.equal(countFaceMovesHtm(["R2", "B2", "D'", "R"]), 4);
  });

  it("转体按公式记号计次：面转隔开的 y 不合并", () => {
    assert.equal(
      countRotationsDisplay([
        "z2",
        "y2",
        "R",
        "D'",
        "y",
        "R'",
        "y'",
        "R",
        "U",
        "y",
        "R",
      ]),
      5,
    );
    // 真正相邻的空转仍消去
    assert.equal(countRotationsDisplay(["y", "y'", "R"]), 0);
  });
});
