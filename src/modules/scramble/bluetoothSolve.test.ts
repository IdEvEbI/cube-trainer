import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSolvedAfterScramble } from "./bluetoothSolve.ts";

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
