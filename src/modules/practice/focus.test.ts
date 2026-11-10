import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  back,
  showGame,
  showPractice,
  showScores,
  showTiming,
} from "./focus.ts";

describe("practice focus", () => {
  it("删除方法页与卡片列表后，入口仍是计时 ↔ CFOP 练习", () => {
    assert.deepEqual(showTiming(), { kind: "计时" });
    assert.deepEqual(showPractice(), { kind: "练习", methodId: "cfop" });
    assert.deepEqual(back(showPractice()), { kind: "计时" });
  });

  it("成绩列表可从首页进入，返回计时", () => {
    assert.deepEqual(showScores(), { kind: "成绩" });
    assert.deepEqual(back(showScores()), { kind: "计时" });
  });

  it("游戏页可从首页进入，返回计时即离开游戏", () => {
    assert.deepEqual(showGame(), { kind: "游戏" });
    assert.deepEqual(back(showGame()), { kind: "计时" });
  });
});
