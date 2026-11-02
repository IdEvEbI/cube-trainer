import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSolvedAfterScramble, isSolvedFromSetup } from "./bluetoothSolve.ts";

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
