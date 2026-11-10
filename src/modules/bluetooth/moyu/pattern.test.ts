import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { nailFixedCenters } from "../../game/algStateMatch.ts";
import { SOLVED_FACELETS_URFDLB } from "./facelets.ts";
import {
  faceletsToKPattern,
  faceletsToSetupAlg,
  tryFaceletsToSetupAlg,
} from "./pattern.ts";

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

describe("moyu pattern", () => {
  it("复原 facelets → 空 setup 算法", async () => {
    assert.equal(await faceletsToSetupAlg(SOLVED_FACELETS_URFDLB), "");
  });

  it("复原 facelets 可建成 KPattern", async () => {
    const pattern = await faceletsToKPattern(SOLVED_FACELETS_URFDLB);
    assert.deepEqual(
      pattern.patternData.CORNERS?.pieces,
      [0, 1, 2, 3, 4, 5, 6, 7],
    );
    assert.deepEqual(
      pattern.patternData.EDGES?.pieces,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
  });

  it("非法 facelets 拒绝", async () => {
    await assert.rejects(() => faceletsToKPattern("F".repeat(54)), /无法识别/);
  });

  it("纯中层态 tryFaceletsToSetupAlg 不抛，便于轮询继续", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const afterM = nailFixedCenters(puzzle.defaultPattern().applyAlg("M"));
    const facelets = patternToFacelets(afterM);
    assert.equal(await tryFaceletsToSetupAlg(facelets), null);
    await assert.rejects(() => faceletsToSetupAlg(facelets));
  });
});
