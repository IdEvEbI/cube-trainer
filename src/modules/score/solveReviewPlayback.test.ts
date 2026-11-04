import assert from "node:assert/strict";
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { describe, it } from "node:test";
import {
  buildSolveReviewSegmentRanges,
  coalesceRawSolvePrefixLength,
  createSolveReviewCursor,
  isSolveReviewAtEnd,
  isSolveReviewAtStart,
  nextSolveReviewPlayRange,
  solveReviewActiveSegmentId,
  solveReviewAtEnd,
  solveReviewAtStart,
  solveReviewCubeAlg,
  solveReviewOrientationAlg,
  solveReviewPhase,
  solveReviewPhaseProgress,
  solveReviewStepNext,
  solveReviewStepPrevious,
  type SolveReviewSegmentRange,
} from "./solveReviewPlayback.ts";
import { createSolveTraceSession } from "./solveTrace.ts";
import { buildSolveReview } from "./solveReview.ts";

async function isSolvedWhiteUp(alg: string): Promise<boolean> {
  const puzzle = await cube3x3x3.kpuzzle();
  const pattern = puzzle.defaultPattern().applyAlg(new Alg(alg));
  return pattern.isIdentical(puzzle.defaultPattern());
}

describe("solveReviewPlayback", () => {
  it("转体不进 Twisty alg：绝对面转播完回到复原", async () => {
    const session = createSolveTraceSession({
      scramble: "R U",
      startSetupAlg: "R U",
    });
    // 蓝牙：转体只改朝向；面转仍是色心绝对。还原 R U 只需绝对 U' R'。
    session.appendAt("z2", 10);
    session.appendAt("U'", 20, { remapFace: false });
    session.appendAt("R'", 30, { remapFace: false });
    const cursor = createSolveReviewCursor(session.snapshot());

    assert.deepEqual(
      cursor.steps.map((step) => [step.kind, step.token]),
      [
        ["scramble", "R"],
        ["scramble", "U"],
        ["rotation", "z2"],
        ["face", "U'"],
        ["face", "R'"],
      ],
    );
    assert.equal(cursor.scrambleLen, 2);
    assert.equal(isSolveReviewAtStart(cursor), true);
    assert.equal(solveReviewCubeAlg(cursor), "");
    assert.equal(solveReviewOrientationAlg(cursor), "");
    assert.equal(solveReviewPhase(cursor), "scramble");

    const afterScramble = solveReviewStepNext(solveReviewStepNext(cursor));
    assert.equal(solveReviewCubeAlg(afterScramble), "R U");
    assert.equal(solveReviewPhase(afterScramble), "solve");
    assert.deepEqual(solveReviewPhaseProgress(afterScramble), {
      phase: "solve",
      current: 1,
      total: 3,
    });

    const afterZ2 = solveReviewStepNext(afterScramble);
    assert.equal(solveReviewCubeAlg(afterZ2), "R U");
    assert.equal(solveReviewOrientationAlg(afterZ2), "z2");
    assert.equal(afterZ2.index, 3);

    const end = solveReviewAtEnd(cursor);
    assert.equal(isSolveReviewAtEnd(end), true);
    assert.equal(solveReviewCubeAlg(end), "R U U' R'");
    assert.equal(solveReviewOrientationAlg(end), "z2");
    assert.equal(end.index, end.steps.length);
    assert.equal(await isSolvedWhiteUp(solveReviewCubeAlg(end)), true);

    assert.equal(solveReviewCubeAlg(solveReviewStepPrevious(end)), "R U U'");
    assert.equal(solveReviewCubeAlg(solveReviewAtStart(end)), "");
    assert.deepEqual(solveReviewStepNext(end), end);
  });

  it("仅还原 steps、无打乱时整段属 solve", () => {
    const session = createSolveTraceSession({
      scramble: "",
      startSetupAlg: "",
    });
    session.appendAt("y", 1);
    session.appendAt("R", 2, { remapFace: false });
    const cursor = createSolveReviewCursor({
      ...session.snapshot(),
      scramble: "",
    });
    assert.deepEqual(
      cursor.steps.map((step) => [step.kind, step.token]),
      [
        ["rotation", "y"],
        ["face", "R"],
      ],
    );
    assert.equal(cursor.scrambleLen, 0);
    assert.equal(solveReviewPhase(cursor), "solve");
    const afterY = solveReviewStepNext(cursor);
    assert.equal(solveReviewCubeAlg(afterY), "");
    assert.equal(solveReviewOrientationAlg(afterY), "y");
    assert.equal(solveReviewCubeAlg(solveReviewStepNext(afterY)), "R");
  });

  it("打乱与 steps 皆空则拒绝", () => {
    assert.throws(
      () =>
        createSolveReviewCursor({
          version: 1,
          scramble: "",
          startSetupAlg: "",
          steps: [],
        }),
      /回放序列为空/,
    );
  });

  it("相邻四分之一转合并为 R2 / z2，一次回放步进", () => {
    const session = createSolveTraceSession({
      scramble: "U",
      startSetupAlg: "U",
    });
    session.appendAt("z", 5);
    session.appendAt("z", 6);
    session.appendAt("R", 10, { remapFace: false });
    session.appendAt("R", 20, { remapFace: false });
    session.appendAt("U'", 30, { remapFace: false });
    session.appendAt("U'", 40, { remapFace: false });
    const cursor = createSolveReviewCursor(session.snapshot());
    assert.deepEqual(
      cursor.steps.map((step) => [step.kind, step.token]),
      [
        ["scramble", "U"],
        ["rotation", "z2"],
        ["face", "R2"],
        ["face", "U2"],
      ],
    );
    const afterR2 = solveReviewStepNext(
      solveReviewStepNext(solveReviewStepNext(cursor)),
    );
    assert.equal(solveReviewCubeAlg(afterR2), "U R2");
    assert.equal(solveReviewOrientationAlg(afterR2), "z2");
  });

  it("raw 前缀合并长度与分段区间对齐", async () => {
    const session = createSolveTraceSession({
      scramble: "R U",
      startSetupAlg: "R U",
    });
    session.appendAt("z2", 0);
    session.appendAt("R", 10, { remapFace: false });
    session.appendAt("R", 20, { remapFace: false });
    session.appendAt("U'", 30, { remapFace: false });
    session.appendAt("U'", 40, { remapFace: false });
    const trace = session.snapshot();
    assert.equal(coalesceRawSolvePrefixLength(trace.steps, 0), 0);
    assert.equal(coalesceRawSolvePrefixLength(trace.steps, 1), 1); // z2
    assert.equal(coalesceRawSolvePrefixLength(trace.steps, 3), 2); // z2 R2
    assert.equal(coalesceRawSolvePrefixLength(trace.steps, 5), 3); // z2 R2 U2

    const review = await buildSolveReview({ trace, totalTimeMs: 50 });
    const ranges = buildSolveReviewSegmentRanges(trace, review.phases);
    assert.equal(ranges[0]?.id, "scramble");
    assert.deepEqual([ranges[0]?.start, ranges[0]?.end], [0, 2]);
    const cross = ranges.find((range) => range.id === "cross");
    assert.ok(cross);
    assert.equal(cross.start, 2);
    assert.ok(cross.end >= cross.start);
    assert.equal(solveReviewActiveSegmentId(ranges, 0), "scramble");
    assert.equal(solveReviewActiveSegmentId(ranges, 2), cross.id);
  });

  it("跨 CFOP 段的同层 R 不合并", () => {
    const session = createSolveTraceSession({
      scramble: "U",
      startSetupAlg: "U",
    });
    // 段 A: R；段 B: R U' —— 两段交界的 R 不得合成 R2
    session.appendAt("R", 10, { remapFace: false });
    session.appendAt("R", 20, { remapFace: false });
    session.appendAt("U'", 30, { remapFace: false });
    const trace = session.snapshot();
    const phases = [
      { startIndex: 0, endIndex: 1 },
      { startIndex: 1, endIndex: 3 },
    ];
    const cursor = createSolveReviewCursor(trace, phases);
    assert.deepEqual(
      cursor.steps.map((step) => [step.kind, step.token]),
      [
        ["scramble", "U"],
        ["face", "R"],
        ["face", "R"],
        ["face", "U'"],
      ],
    );
    const ranges = buildSolveReviewSegmentRanges(trace, [
      { id: "f2l4", label: "F2L 4", startIndex: 0, endIndex: 1 },
      { id: "oll", label: "OLL", startIndex: 1, endIndex: 3 },
    ]);
    assert.deepEqual([ranges[1]?.start, ranges[1]?.end], [1, 2]);
    assert.deepEqual([ranges[2]?.start, ranges[2]?.end], [2, 4]);
  });

  it("播完当前段后再播放切到下一段", () => {
    const ranges: SolveReviewSegmentRange[] = [
      { id: "scramble", label: "打乱", start: 0, end: 2 },
      { id: "cross", label: "Cross", start: 2, end: 5 },
      { id: "oll", label: "OLL", start: 5, end: 8 },
      { id: "pll", label: "PLL", start: 8, end: 10 },
    ];
    assert.deepEqual(nextSolveReviewPlayRange(ranges, "oll", 5, 10), {
      focusId: "oll",
      resumeAt: 5,
      end: 8,
    });
    assert.deepEqual(nextSolveReviewPlayRange(ranges, "oll", 8, 10), {
      focusId: "pll",
      resumeAt: 8,
      end: 10,
    });
    assert.deepEqual(nextSolveReviewPlayRange(ranges, "pll", 10, 10), {
      focusId: null,
      resumeAt: 0,
      end: 10,
    });
    assert.deepEqual(nextSolveReviewPlayRange(ranges, null, 10, 10), {
      focusId: null,
      resumeAt: 0,
      end: 10,
    });
  });
});
