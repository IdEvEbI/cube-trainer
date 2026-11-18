/**
 * E20 / #181：同面反转×3 ≡ 期望一步；中间态提示还差；正转抵消不推进。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { stepGamePageBleAbsoluteFace } from "../game/guidedAbsolute.ts";
import { remapGripTokenToPuzzleHint } from "../game/guideOrientation.ts";
import {
  applyGuidedMove,
  confirmGuidedFaceletsStep,
  createGuidedMoves,
  guidedScrambleView,
  remainingAfterSameFaceInverse,
  resolveGuideExpectedHintPaint,
} from "./guided.ts";
import { replayGuideSession, type GuideReplayFixture } from "./guideReplay.ts";

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/guide-replay",
);

function loadFixture(name: string): GuideReplayFixture {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf8"),
  ) as GuideReplayFixture;
}

describe("E20 · 同面反转×3 ≡ 期望步（#181）", () => {
  const fixture = loadFixture("bug-R-prime-x3-not-recognized.json");
  const absRPrime = remapGripTokenToPuzzleHint("R'", ["z2"]);

  it("期望 U + U' → 不推进，剩余 U2", () => {
    const guide = createGuidedMoves(["U", "R"]);
    const step = applyGuidedMove(guide, "U'");
    assert.equal(step.kind, "absorb");
    assert.equal(step.guide.progress, 0);
    assert.equal(step.guide.sameFaceInverseCount, 1);
    assert.equal(step.guide.wrongStack.length, 0);
    assert.equal(guidedScrambleView(step.guide).correction, null);
    assert.equal(guidedScrambleView(step.guide).expectedMove, "U2");
  });

  it("期望 U + U' + U → 不推进，回到期望 U", () => {
    let guide = createGuidedMoves(["U", "R"]);
    guide = applyGuidedMove(guide, "U'").guide;
    assert.equal(guidedScrambleView(guide).expectedMove, "U2");
    const back = applyGuidedMove(guide, "U");
    assert.equal(back.kind, "absorb");
    assert.equal(back.guide.progress, 0);
    assert.equal(back.guide.sameFaceInverseCount, 0);
    assert.equal(back.guide.wrongStack.length, 0);
    assert.equal(guidedScrambleView(back.guide).correction, null);
    assert.equal(guidedScrambleView(back.guide).expectedMove, "U");
  });

  it("期望 U + U'×3 → 推进", () => {
    let guide = createGuidedMoves(["U", "R"]);
    guide = applyGuidedMove(guide, "U'").guide;
    assert.equal(guidedScrambleView(guide).expectedMove, "U2");
    guide = applyGuidedMove(guide, "U'").guide;
    assert.equal(guidedScrambleView(guide).expectedMove, "U'");
    assert.equal(guide.progress, 0);
    const done = applyGuidedMove(guide, "U'");
    assert.equal(done.kind, "progress");
    assert.equal(done.guide.progress, 1);
    assert.equal(done.guide.sameFaceInverseCount, 0);
    assert.equal(guidedScrambleView(done.guide).expectedMove, "R");
    assert.equal(guidedScrambleView(done.guide).correction, null);
  });

  it("期望 B'：三包 B → 进度推进，无纠错", () => {
    let guide = createGuidedMoves(["B'", "U"]);
    assert.equal(guidedScrambleView(guide).expectedMove, "B'");
    guide = applyGuidedMove(guide, "B").guide;
    assert.equal(guidedScrambleView(guide).expectedMove, "B2");
    guide = applyGuidedMove(guide, "B").guide;
    // 期望 B' 时 2 下反转后还差 B（期望的逆）
    assert.equal(guidedScrambleView(guide).expectedMove, "B");
    const done = applyGuidedMove(guide, "B");
    assert.equal(done.kind, "progress");
    assert.equal(done.guide.progress, 1);
    assert.equal(done.guide.wrongStack.length, 0);
    assert.equal(guidedScrambleView(done.guide).correction, null);
  });

  it("期望 R：三包握持 R'（绝对 L' @ z2）→ 进度推进，无纠错", () => {
    assert.equal(absRPrime, "L'");
    let guide = { ...createGuidedMoves(["z2", "R"]), progress: 1 };
    assert.equal(guidedScrambleView(guide).expectedMove, "R");
    const logs: { kind: string; expected: string | null }[] = [];
    for (const absolute of ["L'", "L'", "L'"]) {
      const step = stepGamePageBleAbsoluteFace(guide, absolute, ["z2"]);
      logs.push({
        kind: step.kind,
        expected: guidedScrambleView(step.guide).expectedMove,
      });
      guide = step.guide;
    }
    assert.deepEqual(
      logs.map((row) => row.kind),
      ["absorb", "absorb", "done"],
    );
    assert.deepEqual(
      logs.map((row) => row.expected),
      ["R2", "R'", null],
    );
    assert.equal(guide.progress, 2);
    assert.equal(guide.wrongStack.length, 0);
  });

  it("replay：三包绝对 L' 后推进且 sawWrong=false", () => {
    const result = replayGuideSession(fixture);
    assert.equal(result.progress, fixture.expect.progress);
    assert.equal(result.done, fixture.expect.done);
    assert.equal(result.sawWrong, fixture.expect.sawWrong);
    assert.equal(result.guide.wrongStack.length, 0);
    assert.equal(guidedScrambleView(result.guide).correction, null);
  });

  it("期望 M'：中层对面包不进 absorb，facelets 确认可推进", () => {
    const guide = { ...createGuidedMoves(["z2", "M'", "U"]), progress: 1 };
    assert.equal(guidedScrambleView(guide).manualMove, "M'");
    const face = stepGamePageBleAbsoluteFace(guide, "L'", ["z2"]);
    assert.equal(face.kind, "need_manual");
    assert.equal(face.guide.progress, 1);
    assert.equal(face.guide.sameFaceInverseCount ?? 0, 0);
    assert.equal(face.guide.wrongStack.length, 0);
    assert.equal(guidedScrambleView(face.guide).manualMove, "M'");
    assert.equal(guidedScrambleView(face.guide).correction, null);
    const confirmed = confirmGuidedFaceletsStep(face.guide);
    assert.equal(confirmed.kind, "progress");
    assert.equal(confirmed.guide.progress, 2);
    assert.equal(guidedScrambleView(confirmed.guide).expectedMove, "U");
  });

  it("还差 B2 时高亮 paint token 非空（面字母 + double）", () => {
    let guide = createGuidedMoves(["B", "U"]);
    guide = applyGuidedMove(guide, "B'").guide;
    const view = guidedScrambleView(guide);
    assert.equal(view.expectedMove, "B2");
    const paint = resolveGuideExpectedHintPaint(
      view.expectedMove!,
      view.currentIsDouble,
    );
    assert.equal(paint.token, "B");
    assert.equal(paint.double, true);
    assert.ok(paint.token.length > 0);
  });

  it("宽边 l + l'：还差文案含 l2", () => {
    assert.equal(remainingAfterSameFaceInverse("l", 1), "l2");
    const guide = {
      ...createGuidedMoves(["l", "U"]),
      sameFaceInverseCount: 1,
    };
    const view = guidedScrambleView(guide);
    assert.equal(view.manualMove, "l");
    assert.equal(view.expectedMove, "l2");
    assert.match(view.expectedMove ?? "", /l2/);
  });

  it("中层 M' + 一反：还差 M2", () => {
    assert.equal(remainingAfterSameFaceInverse("M'", 1), "M2");
    const guide = {
      ...createGuidedMoves(["M'", "U"]),
      sameFaceInverseCount: 1,
    };
    assert.equal(guidedScrambleView(guide).expectedMove, "M2");
  });
});
