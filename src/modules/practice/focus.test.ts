import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { back, showPractice, showTiming } from "./focus.ts";

describe("practice focus", () => {
  it("删除方法页与卡片列表后，入口仍是计时 ↔ CFOP 练习", () => {
    assert.deepEqual(showTiming(), { kind: "计时" });
    assert.deepEqual(showPractice(), { kind: "练习", methodId: "cfop" });
    assert.deepEqual(back(showPractice()), { kind: "计时" });
  });
});
