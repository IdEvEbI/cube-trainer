import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readCube } from "../cube/cube.ts";
import { cube3x3x3 } from "cubing/puzzles";
import {
  GUIDED_HOME_TEST_FOCUS,
  nextHomeScrambleMoves,
  parseGuidedAlg,
  parseScramble,
  randomGuidedTestScramble,
  randomScramble3x3,
  scrambleDisplayAlgorithm,
  scrambleViewAlgorithm,
  USE_TEMP_WIDE_SLICE_HOME_SCRAMBLE,
} from "./scramble.ts";

const FACE_TURN = /^[UDLRFB](?:2'|2|')?$/;
const SLICE_TURN = /^[MES](?:2'|2|')?$/;
const WIDE_TURN = /^[udlrfb](?:2'|2|')?$/;
const WIDE_DOUBLE = /^[udlrfb](?:2'|'2|2)$/;
const SLICE_QUARTER = /^[MES]'?$/;
const SLICE_DOUBLE = /^[MES](?:2'|'2|2)$/;
const ROTATION_TURN = /^[xyz](?:2'|2|')?$/;

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

describe("parseGuidedAlg", () => {
  it("允许宽层与中层，界面可保留 u", () => {
    assert.deepEqual(parseGuidedAlg("R u M' d2"), ["R", "u", "M'", "d2"]);
  });

  it("保留采集式双步撇 r'2（不经 Alg 改写成 r2'）", () => {
    assert.deepEqual(parseGuidedAlg("r2 r'2 l2"), ["r2", "r'2", "l2"]);
  });

  it("仍拒绝非法记号", () => {
    assert.throws(() => parseGuidedAlg("R Q"), /无法引导/);
  });
});

describe("randomGuidedTestScramble", () => {
  it("当前焦点 slice-quarter：默认只出中层四分之一", () => {
    assert.equal(GUIDED_HOME_TEST_FOCUS, "slice-quarter");
    const moves = parseGuidedAlg(randomGuidedTestScramble(() => 0.2));
    assert.ok(moves.every((move) => SLICE_QUARTER.test(move)));
    assert.ok(moves.length >= 5);
    assert.ok(moves.length <= 6);
  });

  it("layer-then-face 焦点：层转与外面转交错", () => {
    const moves = parseGuidedAlg(
      randomGuidedTestScramble(() => 0.2, "layer-then-face"),
    );
    assert.ok(moves.length >= 4);
    assert.ok(moves.length <= 5);
    assert.ok(
      SLICE_QUARTER.test(moves[0]!) || WIDE_TURN.test(moves[0]!),
      `首步应是层转，实际 ${moves[0]}`,
    );
    assert.ok(FACE_TURN.test(moves[1]!), `第二步应是外面转，实际 ${moves[1]}`);
    assert.ok(moves.some((move) => FACE_TURN.test(move)));
    assert.ok(
      moves.some((move) => SLICE_TURN.test(move) || WIDE_TURN.test(move)),
    );
  });

  it("slice-double 焦点：前两步 M2/M'2，其余中层双步", () => {
    const moves = parseGuidedAlg(
      randomGuidedTestScramble(() => 0.2, "slice-double"),
    );
    assert.deepEqual(new Set(moves.slice(0, 2)), new Set(["M2", "M'2"]));
    assert.ok(moves.every((move) => SLICE_DOUBLE.test(move)));
    assert.ok(moves.length >= 4);
    assert.ok(moves.length <= 5);
  });

  it("slice-quarter 焦点：只含中层四分之一", () => {
    const moves = parseGuidedAlg(
      randomGuidedTestScramble(() => 0.2, "slice-quarter"),
    );
    assert.ok(moves.every((move) => SLICE_QUARTER.test(move)));
    assert.ok(moves.length >= 5);
    assert.ok(moves.length <= 6);
  });

  it("wide-double 焦点：前两步为 r2/r'2", () => {
    const moves = parseGuidedAlg(
      randomGuidedTestScramble(() => 0.2, "wide-double"),
    );
    assert.deepEqual(new Set(moves.slice(0, 2)), new Set(["r2", "r'2"]));
    assert.ok(moves.every((move) => WIDE_DOUBLE.test(move)));
  });

  it("wide-slice 混测：含中层与宽层", () => {
    const moves = parseGuidedAlg(
      randomGuidedTestScramble(() => 0.2, "wide-slice"),
    );
    assert.ok(moves.some((move) => SLICE_TURN.test(move)));
    assert.ok(moves.some((move) => WIDE_TURN.test(move)));
    assert.ok(
      moves.every((move) => SLICE_TURN.test(move) || WIDE_TURN.test(move)),
    );
  });

  it("同一随机源两次结果相同；不同种子结果不同", () => {
    assert.equal(
      randomGuidedTestScramble(() => 0.3),
      randomGuidedTestScramble(() => 0.3),
    );
    assert.notEqual(
      randomGuidedTestScramble(() => 0.1),
      randomGuidedTestScramble(() => 0.7),
    );
  });
});

describe("nextHomeScrambleMoves", () => {
  it("联调开关打开时走随机引导式（下一打乱会变）", () => {
    assert.equal(USE_TEMP_WIDE_SLICE_HOME_SCRAMBLE, true);
    assert.equal(
      nextHomeScrambleMoves(() => 0.2),
      randomGuidedTestScramble(() => 0.2),
    );
    assert.notEqual(
      nextHomeScrambleMoves(() => 0.1),
      nextHomeScrambleMoves(() => 0.8),
    );
  });
});

describe("scrambleViewAlgorithm", () => {
  it("计时首屏按白上展示打乱，不加 z2", () => {
    assert.equal(scrambleViewAlgorithm("R U R'"), "R U R'");
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
