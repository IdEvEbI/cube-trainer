import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readCube } from "../cube/cube.ts";
import { practiceCase } from "./setup.ts";
import {
  atStart,
  atTarget,
  createPracticeCursor,
  displayedMoves,
  highlightedStep,
  isAtTarget,
  playbackSteps,
  stepNext,
  stepPrevious,
} from "./playback.ts";

const sune = practiceCase({
  id: "oll-sune",
  name: "右手小鱼",
  puzzle: "3x3",
  moves: "R U R' U R U2 R'",
});

describe("practice playback", () => {
  it("括号不改变上一步、下一步和自动播放的步骤", () => {
    const grouped = practiceCase({
      id: "oll-sune",
      name: "右手小鱼",
      puzzle: "3x3",
      moves: "(R U R' U)(R U2 R')",
    });

    assert.ok(sune);
    assert.ok(grouped);
    assert.equal(grouped.forward, sune.forward);
    assert.equal(grouped.inverse, sune.inverse);
    const plainCursor = createPracticeCursor(sune);
    const groupedCursor = createPracticeCursor(grouped);
    assert.deepEqual(groupedCursor.forward, plainCursor.forward);
    assert.deepEqual(
      playbackSteps(groupedCursor).map((step) => displayedMoves(step)),
      playbackSteps(plainCursor).map((step) => displayedMoves(step)),
    );
    assert.deepEqual(
      playbackSteps(groupedCursor).map((step) => highlightedStep(step)),
      playbackSteps(plainCursor).map((step) => highlightedStep(step)),
    );
  });

  it("下一步执行后状态正确，上一步可以退回", async () => {
    assert.ok(sune);
    const cursor = createPracticeCursor(sune);
    const startMoves = displayedMoves(cursor);
    const next = stepNext(cursor);
    const back = stepPrevious(next);

    assert.equal(cursor.index, 0);
    assert.equal(startMoves, sune.inverse);
    assert.equal(next.index, 1);
    assert.equal(displayedMoves(next), `${sune.inverse} R`);
    assert.equal(displayedMoves(back), startMoves);
    assert.equal(stepPrevious(cursor).index, 0);
    assert.equal(
      stepNext(atTarget(cursor)).index,
      sune.forward.split(" ").length,
    );

    const start = await readCube(startMoves);
    const stepped = await readCube(displayedMoves(next));
    const returned = await readCube(displayedMoves(back));
    assert.notDeepEqual(stepped.corners, start.corners);
    assert.deepEqual(returned.corners, start.corners);
    assert.deepEqual(returned.centers, start.centers);
  });

  it("下一步后高亮对应的步骤", () => {
    assert.ok(sune);
    const cursor = createPracticeCursor(sune);
    const moves = cursor.forward;
    const next = stepNext(cursor);
    const second = stepNext(next);

    assert.equal(highlightedStep(cursor), null);
    assert.equal(highlightedStep(next), 0);
    assert.equal(moves[highlightedStep(next) ?? -1], "R");
    assert.equal(highlightedStep(second), 1);
    assert.equal(moves[1], "U");
    assert.equal(highlightedStep(stepPrevious(second)), 0);
    assert.equal(highlightedStep(atTarget(cursor)), moves.length - 1);
    assert.equal(moves.at(-1), "R'");
    assert.equal(highlightedStep(atStart(second)), null);
  });

  it("自动播放能执行到目标状态", async () => {
    assert.ok(sune);
    const cursor = createPracticeCursor(sune);
    const steps = playbackSteps(cursor);
    const last = steps.at(-1);
    const solved = await readCube("");

    assert.deepEqual(
      steps.map((step) => step.index),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.deepEqual(
      steps.map((step) => highlightedStep(step)),
      [0, 1, 2, 3, 4, 5, 6],
    );
    assert.equal(
      steps.map((step) => step.forward[step.index - 1]).join(" "),
      sune.forward,
    );
    assert.ok(last);
    assert.equal(isAtTarget(last), true);
    assert.equal(displayedMoves(last), `${sune.inverse} ${sune.forward}`);
    const target = await readCube(displayedMoves(last));
    assert.deepEqual(target.corners, solved.corners);
    assert.deepEqual(target.centers, solved.centers);

    const middle = playbackSteps({ ...cursor, index: 3 });
    assert.equal(middle[0]?.index, 4);
    assert.equal(isAtTarget(middle.at(-1) ?? cursor), true);
    const restarted = playbackSteps(atTarget(cursor));
    assert.equal(restarted[0]?.index, 1);
    assert.equal(displayedMoves(atStart(cursor)), sune.inverse);
  });
});
