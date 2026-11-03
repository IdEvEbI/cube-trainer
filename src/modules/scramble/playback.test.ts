import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAYBACK_STEP_MS } from "../practice/playback.ts";
import {
  SCRAMBLE_PLAYBACK_STEP_MS,
  createScrambleCursor,
  isScrambleAtEnd,
  isScrambleAtStart,
  scrambleAtEnd,
  scrambleAtStart,
  scrambleCurrentStepIndex,
  scrambleDisplayedMoves,
  scrambleHighlightedStep,
  scrambleStepNext,
  scrambleStepPrevious,
} from "./playback.ts";

describe("scramble playback", () => {
  it("打乱自动播放步进慢于练习，便于手跟拧", () => {
    assert.equal(SCRAMBLE_PLAYBACK_STEP_MS, 1000);
    assert.ok(SCRAMBLE_PLAYBACK_STEP_MS > PLAYBACK_STEP_MS);
  });

  it("从还原态按公式逐步前进与后退", () => {
    const start = createScrambleCursor("R U R'");
    assert.equal(isScrambleAtStart(start), true);
    assert.equal(isScrambleAtEnd(start), false);
    assert.equal(scrambleDisplayedMoves(start), "");
    assert.equal(scrambleHighlightedStep(start), null);

    const one = scrambleStepNext(start);
    assert.equal(scrambleDisplayedMoves(one), "R");
    assert.equal(scrambleHighlightedStep(one), 0);
    assert.equal(isScrambleAtStart(one), false);

    const two = scrambleStepNext(one);
    assert.equal(scrambleDisplayedMoves(two), "R U");
    assert.equal(scrambleHighlightedStep(two), 1);

    const end = scrambleStepNext(two);
    assert.equal(scrambleDisplayedMoves(end), "R U R'");
    assert.equal(isScrambleAtEnd(end), true);
    assert.equal(scrambleHighlightedStep(end), 2);

    assert.deepEqual(scrambleStepNext(end), end);
    assert.equal(scrambleDisplayedMoves(scrambleStepPrevious(end)), "R U");
    assert.equal(scrambleDisplayedMoves(scrambleAtStart(end)), "");
    assert.equal(scrambleDisplayedMoves(scrambleAtEnd(start)), "R U R'");
  });

  it("拒绝非法打乱", () => {
    assert.throws(() => createScrambleCursor(""), /打乱是空的/);
    assert.throws(() => createScrambleCursor("R x"), /无法打乱：x/);
  });

  it("当前步高亮对着即将执行的步，播完一步再前进", () => {
    const start = createScrambleCursor("L2 F2 B'");
    assert.equal(scrambleCurrentStepIndex(start), 0);
    // 执行 L2 期间游标仍为 0，高亮 L2；结束后再 next
    const afterL2 = scrambleStepNext(start);
    assert.equal(scrambleCurrentStepIndex(afterL2), 1);
    assert.equal(scrambleHighlightedStep(afterL2), 0);
    const afterF2 = scrambleStepNext(afterL2);
    assert.equal(scrambleCurrentStepIndex(afterF2), 2);
    const done = scrambleStepNext(afterF2);
    assert.equal(scrambleCurrentStepIndex(done), null);
    assert.equal(isScrambleAtEnd(done), true);
  });
});
