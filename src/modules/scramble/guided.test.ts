import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGuidedMove,
  createGuidedScramble,
  expandFaceMoveToQuarters,
  guidedScrambleView,
  invertFaceMove,
  isDoubleMove,
} from "./guided.ts";

describe("expandFaceMoveToQuarters", () => {
  it("正转与逆转保持一步", () => {
    assert.deepEqual(expandFaceMoveToQuarters("R"), ["R"]);
    assert.deepEqual(expandFaceMoveToQuarters("U'"), ["U'"]);
  });

  it("两层转默认拆成两次正转", () => {
    assert.deepEqual(expandFaceMoveToQuarters("U2"), ["U", "U"]);
    assert.deepEqual(expandFaceMoveToQuarters("R2'"), ["R", "R"]);
  });
});

describe("isDoubleMove / invertFaceMove", () => {
  it("识别双步并归一化取逆", () => {
    assert.equal(isDoubleMove("R2"), true);
    assert.equal(isDoubleMove("R2'"), true);
    assert.equal(isDoubleMove("R"), false);
    assert.equal(invertFaceMove("R"), "R'");
    assert.equal(invertFaceMove("R'"), "R");
    assert.equal(invertFaceMove("U2"), "U2");
    assert.equal(invertFaceMove("U2'"), "U2");
  });
});

describe("createGuidedScramble", () => {
  it("保留展示整步", () => {
    const guide = createGuidedScramble("R U2 F'");
    assert.deepEqual(guide.displayMoves, ["R", "U2", "F'"]);
    assert.equal(guide.progress, 0);
    assert.equal(guide.halfDone, false);
    assert.equal(guide.phase, "guiding");
  });
});

describe("applyGuidedMove", () => {
  it("单步匹配推进；双步半高亮", () => {
    let guide = createGuidedScramble("R U2");
    let view = guidedScrambleView(guide);
    assert.deepEqual(view.displayMoves, ["R", "U2"]);
    assert.equal(view.expectedMove, "R");
    assert.equal(view.partial, false);

    let result = applyGuidedMove(guide, "R");
    assert.equal(result.kind, "progress");
    guide = result.guide;
    view = guidedScrambleView(guide);
    assert.equal(view.completedCount, 1);
    assert.equal(view.currentIndex, 1);
    assert.equal(view.currentIsDouble, true);
    assert.equal(view.partial, false);
    assert.equal(view.expectedMove, "U");

    result = applyGuidedMove(guide, "U");
    assert.equal(result.kind, "partial");
    guide = result.guide;
    view = guidedScrambleView(guide);
    assert.equal(view.completedCount, 1);
    assert.equal(view.currentIndex, 1);
    assert.equal(view.partial, true);
    assert.equal(view.expectedMove, "U");

    result = applyGuidedMove(guide, "U");
    assert.equal(result.kind, "done");
    guide = result.guide;
    view = guidedScrambleView(guide);
    assert.equal(view.done, true);
    assert.equal(view.completedCount, 2);
    assert.equal(view.partial, false);
  });

  it("双步可用逆转两下：R2 ≡ R'2", () => {
    let guide = createGuidedScramble("R2");
    let result = applyGuidedMove(guide, "R'");
    assert.equal(result.kind, "partial");
    guide = result.guide;
    assert.equal(guidedScrambleView(guide).partial, true);
    assert.equal(guidedScrambleView(guide).expectedMove, "R'");

    result = applyGuidedMove(guide, "R'");
    assert.equal(result.kind, "done");
  });

  it("双步公式为 R2' 时同样接受正转两下", () => {
    let guide = createGuidedScramble("R2'");
    guide = applyGuidedMove(guide, "R").guide;
    assert.equal(guidedScrambleView(guide).partial, true);
    const done = applyGuidedMove(guide, "R");
    assert.equal(done.kind, "done");
  });

  it("双步前后半方向不一致则判错", () => {
    let guide = createGuidedScramble("U2");
    guide = applyGuidedMove(guide, "U").guide;
    const wrong = applyGuidedMove(guide, "U'");
    assert.equal(wrong.kind, "wrong");
    assert.equal(guidedScrambleView(wrong.guide).correction, "U");
  });

  it("转错时给出修正步，撤销后继续", () => {
    let guide = createGuidedScramble("R U");
    let result = applyGuidedMove(guide, "F");
    assert.equal(result.kind, "wrong");
    guide = result.guide;
    assert.equal(guidedScrambleView(guide).correction, "F'");
    assert.equal(guidedScrambleView(guide).completedCount, 0);

    result = applyGuidedMove(guide, "F'");
    assert.equal(result.kind, "recover");
    guide = result.guide;
    assert.equal(guidedScrambleView(guide).correction, null);

    result = applyGuidedMove(guide, "R");
    assert.equal(result.kind, "progress");
    guide = result.guide;
    assert.equal(guidedScrambleView(guide).completedCount, 1);
  });

  it("连续转错按栈撤销", () => {
    let guide = createGuidedScramble("R");
    guide = applyGuidedMove(guide, "U").guide;
    guide = applyGuidedMove(guide, "F").guide;
    assert.equal(guidedScrambleView(guide).correction, "F'");
    guide = applyGuidedMove(guide, "F'").guide;
    assert.equal(guidedScrambleView(guide).correction, "U'");
    guide = applyGuidedMove(guide, "U'").guide;
    assert.equal(guidedScrambleView(guide).correction, null);
    const done = applyGuidedMove(guide, "R");
    assert.equal(done.kind, "done");
  });
});
