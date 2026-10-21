import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { switchMode } from "./mode.ts";

describe("switchMode", () => {
  it("从打乱计时切到公式练习", () => {
    assert.deepEqual(switchMode("打乱计时"), {
      mode: "公式练习",
      keepCube: true,
    });
  });

  it("从公式练习切回打乱计时", () => {
    assert.deepEqual(switchMode("公式练习"), {
      mode: "打乱计时",
      keepCube: true,
    });
  });

  it("来回切换后仍是原来的界面，并且保留魔方", () => {
    const practice = switchMode("打乱计时");
    const timing = switchMode(practice.mode);

    assert.equal(timing.mode, "打乱计时");
    assert.equal(practice.keepCube, true);
    assert.equal(timing.keepCube, true);
  });
});
