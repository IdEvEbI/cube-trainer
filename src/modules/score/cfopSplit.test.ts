import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  assignPhaseEndsOnAdvance,
  cfopStageIndex,
  patternFromSetup,
  referenceWithSameCenters,
  splitCfopPhaseEnds,
} from "./cfopSplit.ts";

describe("assignPhaseEndsOnAdvance", () => {
  it("首次识别：Cross 吸收此前步数，同刻更高阶段为 0 步", () => {
    const ends = [0, 0, 0, 0, 0, 0, 0];
    const reached = assignPhaseEndsOnAdvance(ends, -1, 4, 20);
    assert.equal(reached, 4);
    assert.deepEqual(ends, [20, 20, 20, 20, 20, 0, 0]);
  });

  it("后续推进：跳过的中间阶段不吞步", () => {
    const ends = [5, 0, 0, 0, 0, 0, 0];
    const reached = assignPhaseEndsOnAdvance(ends, 0, 4, 20);
    assert.equal(reached, 4);
    assert.deepEqual(ends, [5, 5, 5, 5, 20, 0, 0]);
  });
});

describe("cfopStageIndex", () => {
  it("复原为 PLL；白下仅差 U 层排列时为 OLL", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const identity = puzzle.defaultPattern();
    assert.equal(cfopStageIndex(identity, identity), 6);

    const whiteD = identity.applyAlg("z");
    assert.equal(cfopStageIndex(whiteD, identity), 6);
    const ollDone = whiteD.applyAlg("U");
    assert.equal(cfopStageIndex(ollDone, identity), 5);
  });

  it("打断一对 F2L 后停在未满 4 对", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const identity = puzzle.defaultPattern();
    const whiteD = identity.applyAlg("z");
    const broken = whiteD.applyAlg("R U R'");
    const stage = cfopStageIndex(broken, identity);
    assert.equal(stage, 3);
  });

  it("手持转体（整体朝向变）仍能识别复原", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const identity = puzzle.defaultPattern();
    const turned = identity.applyAlg("x y");
    assert.equal(cfopStageIndex(turned, identity), 6);
    assert.ok(referenceWithSameCenters(identity, turned));
  });
});

describe("splitCfopPhaseEnds", () => {
  it("开表已有 Cross+3F2L：插入最后一对的步数不进 Cross", async () => {
    // z R U R' → 白下且 3 对 F2L；再 R U' R' 还原
    const ends = await splitCfopPhaseEnds("z R U R'", ["R", "U'", "R'"]);
    assert.equal(ends.length, 7);
    assert.equal(ends[0], 0, "Cross 应在开表前完成");
    assert.equal(ends[3], 0, "F2L1–3 应在开表前完成");
    // 最后一对及 OLL/PLL 步数在后面阶段
    assert.ok(ends[6] === 3 || ends[5] === 3 || ends[4] === 3);
    assert.ok(ends[4]! > 0 || ends[5]! > 0 || ends[6]! > 0);
  });

  it("完整逆序小序列最终落到 PLL", async () => {
    const ends = await splitCfopPhaseEnds("R U R' U'", ["U", "R", "U'", "R'"]);
    assert.equal(ends[6], 4);
  });

  it("开表已是复原时后续步数不堆进 Cross", async () => {
    const ends = await splitCfopPhaseEnds("", ["R", "R'"]);
    // 开表即 PLL：Cross..OLL 界为 0；还原步数归 PLL
    assert.equal(ends[0], 0);
    assert.equal(ends[6], 2);
  });

  it("patternFromSetup 可叠转动", async () => {
    const pattern = await patternFromSetup("R", ["R'"]);
    assert.equal(
      pattern.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
      true,
    );
  });
});
