import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CfopPhaseSolution } from "./cfopSolve.ts";
import {
  createGamePageCursor,
  gamePageActiveSegmentId,
  gamePageAtEnd,
  gamePageDisplayedAlg,
  gamePageStepNext,
  gamePageStepPrevious,
  isGamePageAtEnd,
  isGamePageAtStart,
  nextGamePagePlayRange,
} from "./gamePlayback.ts";

const phases: CfopPhaseSolution[] = [
  { id: "Cross", moves: ["z2", "R", "U"] },
  { id: "F2L1", moves: ["F"] },
  { id: "F2L2", moves: [] },
  { id: "F2L3", moves: ["L"] },
  { id: "F2L4", moves: ["D"] },
  { id: "OLL", moves: ["U"] },
  { id: "PLL", moves: ["R'"] },
];

describe("gamePageCursor", () => {
  it("从复原起先打乱再 Cross（含 z2）", () => {
    let cursor = createGamePageCursor(["U", "R"], phases);
    assert.equal(isGamePageAtStart(cursor), true);
    assert.equal(gamePageDisplayedAlg(cursor), "");
    assert.equal(gamePageActiveSegmentId(cursor), "scramble");
    assert.equal(cursor.segments[0]?.label, "打乱");
    assert.equal(cursor.segments[1]?.id, "Cross");
    assert.deepEqual(cursor.segments[1]?.moves.slice(0, 1), ["z2"]);

    cursor = gamePageStepNext(cursor);
    assert.equal(gamePageDisplayedAlg(cursor), "U");
    assert.equal(gamePageActiveSegmentId(cursor), "scramble");

    cursor = gamePageStepNext(cursor);
    assert.equal(gamePageDisplayedAlg(cursor), "U R");
    assert.equal(gamePageActiveSegmentId(cursor), "Cross");

    cursor = gamePageStepNext(cursor);
    assert.equal(gamePageDisplayedAlg(cursor), "U R z2");
    assert.equal(gamePageActiveSegmentId(cursor), "Cross");

    cursor = gamePageAtEnd(cursor);
    assert.equal(isGamePageAtEnd(cursor), true);
    assert.equal(gamePageActiveSegmentId(cursor), "PLL");

    cursor = gamePageStepPrevious(cursor);
    assert.equal(gamePageDisplayedAlg(cursor).endsWith("U"), true);
  });

  it("分段播放到段末后切下一段", () => {
    const cursor = createGamePageCursor(["U", "R"], phases);
    assert.deepEqual(
      nextGamePagePlayRange(
        cursor.segments,
        "scramble",
        2,
        cursor.flatMoves.length,
      ),
      { focusId: "Cross", resumeAt: 2, end: 5 },
    );
  });
});
