import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createScrambleCursor,
  isScrambleAtEnd,
  isScrambleAtStart,
  scrambleAtEnd,
  scrambleAtStart,
  scrambleDisplayedMoves,
  scrambleHighlightedStep,
  scrambleStepNext,
  scrambleStepPrevious,
} from "./playback.ts";

describe("scramble playback", () => {
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
});
