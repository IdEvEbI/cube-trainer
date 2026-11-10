import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldClearGameOnLeaveGame } from "./gameNav.ts";

describe("gameNav", () => {
  it("leaving game for timing clears the game session", () => {
    assert.equal(shouldClearGameOnLeaveGame("游戏", "计时"), true);
    assert.equal(shouldClearGameOnLeaveGame("游戏", "练习"), false);
    assert.equal(shouldClearGameOnLeaveGame("计时", "游戏"), false);
  });
});
