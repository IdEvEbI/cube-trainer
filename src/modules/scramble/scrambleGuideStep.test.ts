import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import {
  expectedFixedCenterPattern,
  nailFixedCenters,
  patternsMatchFixedCenters,
} from "../game/algStateMatch.ts";
import {
  checkScrambleGuideStepByFacelets,
  classifyScrambleGuideStep,
  SCRAMBLE_GUIDE_WRONG_SETTLE_POLLS,
  syntheticWrongMoveForExpected,
} from "./scrambleGuideStep.ts";

const FACE_ORDER = "URFDLB";
const CORNER_FACELETS = [
  [8, 20, 9],
  [2, 11, 45],
  [0, 47, 36],
  [6, 38, 18],
  [29, 15, 26],
  [27, 24, 44],
  [33, 42, 53],
  [35, 51, 17],
] as const;
const EDGE_FACELETS = [
  [7, 19],
  [5, 10],
  [1, 46],
  [3, 37],
  [28, 25],
  [32, 16],
  [34, 52],
  [30, 43],
  [23, 12],
  [21, 41],
  [48, 14],
  [50, 39],
] as const;
const REID_EDGES = "UF UR UB UL DF DR DB DL FR FL BR BL".split(" ");
const REID_CORNERS = "UFR URB UBL ULF DRF DFL DLB DBR".split(" ");

function patternToFacelets(pattern: KPattern): string {
  const stickers = Array<string>(54).fill("");
  for (let f = 0; f < 6; f += 1) {
    stickers[f * 9 + 4] = FACE_ORDER[f]!;
  }
  const corners = pattern.patternData.CORNERS;
  for (let slot = 0; slot < 8; slot += 1) {
    const name = REID_CORNERS[corners.pieces[slot]!]!;
    const ori = corners.orientation[slot]!;
    const rotated = name.slice(ori) + name.slice(0, ori);
    for (let i = 0; i < 3; i += 1) {
      stickers[CORNER_FACELETS[slot]![i]!] = rotated[i]!;
    }
  }
  const edges = pattern.patternData.EDGES;
  for (let slot = 0; slot < 12; slot += 1) {
    const name = REID_EDGES[edges.pieces[slot]!]!;
    const ori = edges.orientation[slot]!;
    const rotated = name.slice(ori) + name.slice(0, ori);
    for (let i = 0; i < 2; i += 1) {
      stickers[EDGE_FACELETS[slot]![i]!] = rotated[i]!;
    }
  }
  return stickers.join("");
}

describe("classifyScrambleGuideStep", () => {
  it("区分面转 / 宽层 / 中层 / 转体", () => {
    assert.equal(classifyScrambleGuideStep("D"), "face");
    assert.equal(classifyScrambleGuideStep("f'"), "wide");
    assert.equal(classifyScrambleGuideStep("M"), "slice");
    assert.equal(classifyScrambleGuideStep("z'"), "rotation");
  });
});

describe("syntheticWrongMoveForExpected", () => {
  it("使 correction 显示期望面转", () => {
    assert.equal(syntheticWrongMoveForExpected("D"), "D'");
    assert.equal(syntheticWrongMoveForExpected("L'"), "L");
  });
});

describe("checkScrambleGuideStepByFacelets", () => {
  const moves = ["M", "E'", "S", "r", "l", "f'", "D", "B'", "z'", "y"];

  it("固定色心：E 到位可识别，且不等于 D' U 整机归心", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const id = puzzle.defaultPattern();
    const afterE = nailFixedCenters(id.applyAlg("E"));
    const afterDU = id.applyAlg("D' U");
    assert.equal(patternsMatchFixedCenters(afterE, afterDU), false);

    const facelets = patternToFacelets(afterE);
    assert.equal(
      await checkScrambleGuideStepByFacelets({
        facelets,
        displayMoves: ["E", "M'"],
        progress: 0,
        settledSameCount: 0,
      }),
      "reached",
    );
  });

  it("固定公式前缀到 f' 后，D 到位可识别", async () => {
    const start = await expectedFixedCenterPattern(moves, 6);
    const reached = await expectedFixedCenterPattern(moves, 7);
    assert.equal(patternsMatchFixedCenters(start, reached), false);

    assert.equal(
      await checkScrambleGuideStepByFacelets({
        facelets: patternToFacelets(start),
        displayMoves: moves,
        progress: 6,
        settledSameCount: 0,
      }),
      "at_start",
    );
    assert.equal(
      await checkScrambleGuideStepByFacelets({
        facelets: patternToFacelets(reached),
        displayMoves: moves,
        progress: 6,
        settledSameCount: 0,
      }),
      "reached",
    );
  });

  it("停在非起点非终点足够久判错", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const id = puzzle.defaultPattern();
    const wrong = nailFixedCenters(id.applyAlg("R"));
    assert.equal(
      await checkScrambleGuideStepByFacelets({
        facelets: patternToFacelets(wrong),
        displayMoves: ["M", "E'"],
        progress: 0,
        settledSameCount: SCRAMBLE_GUIDE_WRONG_SETTLE_POLLS,
      }),
      "wrong",
    );
    assert.equal(
      await checkScrambleGuideStepByFacelets({
        facelets: patternToFacelets(wrong),
        displayMoves: ["M", "E'"],
        progress: 0,
        settledSameCount: 0,
      }),
      "in_progress",
    );
  });
});
