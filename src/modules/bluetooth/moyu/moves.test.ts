import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { takeNewMoves } from "./moves.ts";
import type { MoyuMoveMessage } from "./packets.ts";

function moveMsg(
  moveCounter: number,
  history: MoyuMoveMessage["history"],
): MoyuMoveMessage {
  return { type: "move", moveCounter, history };
}

describe("takeNewMoves", () => {
  it("未同步前忽略转动", () => {
    const result = takeNewMoves(
      -1,
      moveMsg(1, [{ move: "R", intervalMs: 10 }]),
    );
    assert.deepEqual(result, { nextCounter: -1, moves: [] });
  });

  it("counter 未变则无新步", () => {
    const result = takeNewMoves(5, moveMsg(5, [{ move: "U", intervalMs: 10 }]));
    assert.deepEqual(result, { nextCounter: 5, moves: [] });
  });

  it("单步：应用 history[0]", () => {
    const result = takeNewMoves(
      10,
      moveMsg(11, [
        { move: "R", intervalMs: 20 },
        { move: "U'", intervalMs: 15 },
      ]),
    );
    assert.deepEqual(result.moves, ["R"]);
    assert.equal(result.nextCounter, 11);
  });

  it("多步：按时间正序（旧→新）", () => {
    // counter 10→13，diff=3；history[0] 最新
    const result = takeNewMoves(
      10,
      moveMsg(13, [
        { move: "F", intervalMs: 5 },
        { move: "U", intervalMs: 5 },
        { move: "R", intervalMs: 5 },
      ]),
    );
    assert.deepEqual(result.moves, ["R", "U", "F"]);
    assert.equal(result.nextCounter, 13);
  });

  it("丢包时 diff 大于历史长度则只应用已有历史", () => {
    const result = takeNewMoves(
      1,
      moveMsg(10, [
        { move: "L", intervalMs: 1 },
        { move: "L'", intervalMs: 1 },
      ]),
    );
    assert.deepEqual(result.moves, ["L'", "L"]);
    assert.equal(result.nextCounter, 10);
  });
});
