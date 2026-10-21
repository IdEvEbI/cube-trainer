import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readCube } from "../cube/cube.ts";
import { cube3x3x3 } from "cubing/puzzles";
import {
  parseScramble,
  randomScramble3x3,
  scrambleDisplayAlgorithm,
} from "./scramble.ts";

const FACE_TURN = /^[UDLRFB](?:2'|2|')?$/;

function axisOf(move: string): string {
  const face = move[0];
  if (face === "U" || face === "D") {
    return "UD";
  }
  if (face === "L" || face === "R") {
    return "LR";
  }
  return "FB";
}

describe("parseScramble", () => {
  it("拆开正转、逆转和转两层", () => {
    assert.deepEqual(parseScramble("R U R' U R U2 R'"), [
      "R",
      "U",
      "R'",
      "U",
      "R",
      "U2",
      "R'",
    ]);
  });

  it("拒绝空打乱、中层和整颗转动", () => {
    assert.throws(() => parseScramble("   "), /打乱是空的/);
    assert.throws(() => parseScramble("R U M"), /无法打乱：M/);
    assert.throws(() => parseScramble("R U x"), /无法打乱：x/);
  });
});

describe("scrambleDisplayAlgorithm", () => {
  it("打乱前先 z2，打乱后再 z2", () => {
    assert.equal(scrambleDisplayAlgorithm("R U R'"), "z2 R U R' z2");
  });

  it("按白上执行打乱，再转回黄上观看", async () => {
    const moves = "R U";
    const puzzle = await cube3x3x3.kpuzzle();
    const shown = puzzle
      .defaultPattern()
      .applyAlg("z2")
      .applyAlg(scrambleDisplayAlgorithm(moves));
    const whiteUpThenYellow = puzzle
      .defaultPattern()
      .applyAlg(moves)
      .applyAlg("z2");
    const yellowUpDirect = puzzle.defaultPattern().applyAlg(`z2 ${moves}`);

    assert.deepEqual(
      shown.patternData.CORNERS,
      whiteUpThenYellow.patternData.CORNERS,
    );
    assert.deepEqual(
      shown.patternData.EDGES,
      whiteUpThenYellow.patternData.EDGES,
    );
    assert.notDeepEqual(
      shown.patternData.CORNERS?.pieces,
      yellowUpDirect.patternData.CORNERS?.pieces,
    );
  });

  it("拒绝整颗转动", () => {
    assert.throws(() => scrambleDisplayAlgorithm("R x"), /无法打乱：x/);
  });
});

describe("randomScramble3x3", () => {
  it("固定随机源得到 20 步三阶面转", () => {
    const scramble = randomScramble3x3(() => 0);
    const moves = parseScramble(scramble.moves);

    assert.equal(scramble.puzzle, "3x3");
    assert.equal(moves.length, 20);
    assert.ok(moves.every((move) => FACE_TURN.test(move)));

    let axisStreak = 1;
    for (let index = 1; index < moves.length; index += 1) {
      const current = moves[index];
      const previous = moves[index - 1];
      assert.ok(current !== undefined && previous !== undefined);
      assert.notEqual(current[0], previous[0]);
      if (axisOf(current) === axisOf(previous)) {
        axisStreak += 1;
        assert.ok(axisStreak < 3);
      } else {
        axisStreak = 1;
      }
    }
  });

  it("同一随机源两次结果相同", () => {
    assert.equal(
      randomScramble3x3(() => 0.4).moves,
      randomScramble3x3(() => 0.4).moves,
    );
  });

  it("随机源越界时拒绝", () => {
    assert.throws(() => randomScramble3x3(() => 2), /随机源无效/);
  });

  it("打乱应用到复原状态后角块会变化", async () => {
    let step = 0;
    const scramble = randomScramble3x3(() => {
      step += 1;
      return ((step * 17) % 100) / 100;
    });
    const solved = await readCube();
    const turned = await readCube(scramble.moves);

    assert.notDeepEqual(turned.corners, solved.corners);
    assert.deepEqual(turned.centers, solved.centers);
  });
});
