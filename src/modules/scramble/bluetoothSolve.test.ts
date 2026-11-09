import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  isSolvedAfterScramble,
  isSolvedFromSetup,
  joinAlgParts,
  patternFromSetup,
} from "./bluetoothSolve.ts";

describe("isSolvedFromSetup", () => {
  it("连接时已复原、无转动 → 复原", async () => {
    assert.equal(await isSolvedFromSetup("", []), true);
  });

  it("连接时已乱（setup=R），再转 R' → 复原", async () => {
    assert.equal(await isSolvedFromSetup("R", ["R'"]), true);
  });

  it("连接时已乱，仅按公式打乱而未真正还原 → 不复原", async () => {
    // 物理起点 R，再跟公式做 U → 状态为 R U，不是复原
    assert.equal(await isSolvedFromSetup("R", ["U"]), false);
  });

  it("连接乱序后：跟打乱再还原到白上绿前 → 复原", async () => {
    // 起点 R；公式 U；再 U' R' 回到复原
    assert.equal(await isSolvedFromSetup("R", ["U", "U'", "R'"]), true);
  });

  it("起点非还原：只跟打乱不还原 → 停表条件不成立", async () => {
    assert.equal(await isSolvedFromSetup("R U R'", ["U", "R"]), false);
  });
});

describe("joinAlgParts", () => {
  it("拼接 setup 与转动，丢弃空白", () => {
    assert.equal(joinAlgParts("R U", ["R'", "U'"]), "R U R' U'");
    assert.equal(joinAlgParts("  ", ["R", ""]), "R");
    assert.equal(joinAlgParts("", []), "");
  });
});

describe("patternFromSetup", () => {
  it("setup 叠逆转后与复原相同", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const pattern = await patternFromSetup("R", ["R'"]);
    assert.equal(pattern.isIdentical(puzzle.defaultPattern()), true);
  });
});

describe("isSolvedAfterScramble", () => {
  it("打乱后再执行逆序四分之一转回到复原", async () => {
    assert.equal(await isSolvedAfterScramble("R U", ["U'", "R'"]), true);
  });

  it("未还原时为 false", async () => {
    assert.equal(await isSolvedAfterScramble("R U", ["U'"]), false);
    assert.equal(await isSolvedAfterScramble("R", ["R"]), false);
  });

  it("空打乱且无转动视为复原", async () => {
    assert.equal(await isSolvedAfterScramble("", []), true);
  });

  it("R2 用两次 R 还原", async () => {
    assert.equal(await isSolvedAfterScramble("R2", ["R", "R"]), true);
    assert.equal(await isSolvedAfterScramble("R2", ["R'", "R'"]), true);
  });
});
