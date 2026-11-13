import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quatFromOrientationAlg } from "../score/cubeOrientation.ts";
import {
  appendGuideLayerGestureMoves,
  createGuideLayerGestureTracker,
  evaluateGuideLayerGesture,
  syncGuideLayerGestureTracker,
} from "./scrambleGuideLayerGesture.ts";

describe("scrambleGuideLayerGesture", () => {
  it("步变更时重置样本；同一步保留", () => {
    let tracker = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "M",
      gyroBefore: quatFromOrientationAlg(""),
    });
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "R", intervalMs: 0 },
    ]);
    const same = syncGuideLayerGestureTracker(tracker, {
      progress: 0,
      expectedToken: "M",
      gyroBefore: quatFromOrientationAlg("x"),
    });
    assert.equal(same.samples.length, 1);
    const next = syncGuideLayerGestureTracker(tracker, {
      progress: 1,
      expectedToken: "E'",
      gyroBefore: quatFromOrientationAlg("x"),
    });
    assert.equal(next.samples.length, 0);
    assert.equal(next.expectedToken, "E'");
  });

  it("中层双包未齐 → pending；齐且陀螺对 → matched", () => {
    let tracker = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "M",
      gyroBefore: quatFromOrientationAlg(""),
    });
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "R", intervalMs: 0 },
    ]);
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("x")).status,
      "pending",
    );
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "L'", intervalMs: 20 },
    ]);
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("x")).status,
      "matched",
    );
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("z2 y2"))
        .status,
      "pending",
    );
  });

  it("E/E2 同包：转角软匹配可推进 E；间隔偏大仍用最近两步", () => {
    let tracker = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "E",
      gyroBefore: quatFromOrientationAlg(""),
    });
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "D'", intervalMs: 0 },
      { move: "U", intervalMs: 700 },
    ]);
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("y")).status,
      "matched",
    );
  });

  it("宽层无陀螺不推进（含唯一包 r'）；中层唯一包 E' 可只靠包", () => {
    let wide = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "r'",
      gyroBefore: null,
    });
    wide = appendGuideLayerGestureMoves(wide, [{ move: "L'", intervalMs: 0 }]);
    assert.equal(evaluateGuideLayerGesture(wide, null).status, "pending");

    let unique = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "E'",
      gyroBefore: null,
    });
    unique = appendGuideLayerGestureMoves(unique, [
      { move: "D", intervalMs: 0 },
      { move: "U'", intervalMs: 10 },
    ]);
    assert.equal(evaluateGuideLayerGesture(unique, null).status, "matched");
  });

  it("宽层：同包 L 但陀螺静默 → 不当成 r（那是外层 L）", () => {
    let tracker = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "r",
      gyroBefore: quatFromOrientationAlg(""),
    });
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "L", intervalMs: 0 },
    ]);
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("")).status,
      "pending",
    );
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("x'")).status,
      "matched",
    );
  });

  it("r2：两下 L + 180° 陀螺；单包不够则 pending", () => {
    let tracker = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "r2",
      gyroBefore: quatFromOrientationAlg(""),
    });
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "L", intervalMs: 0 },
    ]);
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("z2 y2"))
        .status,
      "pending",
    );
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "L", intervalMs: 80 },
    ]);
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("x'")).status,
      "pending",
    );
    assert.equal(
      evaluateGuideLayerGesture(tracker, quatFromOrientationAlg("z2 y2"))
        .status,
      "matched",
    );
  });

  it("包像别的记号 → other", () => {
    let tracker = createGuideLayerGestureTracker({
      progress: 0,
      expectedToken: "M",
      gyroBefore: quatFromOrientationAlg(""),
    });
    tracker = appendGuideLayerGestureMoves(tracker, [
      { move: "D'", intervalMs: 0 },
      { move: "U", intervalMs: 12 },
    ]);
    const evalResult = evaluateGuideLayerGesture(
      tracker,
      quatFromOrientationAlg("y"),
    );
    assert.equal(evalResult.status, "other");
    if (evalResult.status === "other") {
      assert.equal(evalResult.classified, "E");
    }
  });
});
