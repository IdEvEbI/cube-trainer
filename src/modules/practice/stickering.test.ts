import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  F2L_SIMPLIFIED_MASK,
  practiceStickering,
  stickeringChar,
} from "./stickering.ts";

describe("practiceStickering", () => {
  it("简化显示开启时顶面只显示相关块，底层白色块不被置灰", () => {
    const active = practiceStickering("f2l-paired", true);
    assert.equal(active.mode, "mask");
    if (active.mode !== "mask") {
      return;
    }
    assert.equal(active.mask, F2L_SIMPLIFIED_MASK);

    // 默认白上编号：U 层 0–3 为白层块，D 层 4–7 为黄层块
    for (const index of [0, 1, 2, 3]) {
      assert.equal(stickeringChar(active.mask, "EDGES", index), "-");
      assert.equal(stickeringChar(active.mask, "CORNERS", index), "-");
    }
    for (const index of [4, 5, 6, 7]) {
      assert.equal(stickeringChar(active.mask, "EDGES", index), "I");
      assert.equal(stickeringChar(active.mask, "CORNERS", index), "I");
    }
    // 白心（默认 U=0）与黄心（默认 D=5）均保持可见，便于辨认朝向
    assert.equal(stickeringChar(active.mask, "CENTERS", 0), "-");
    assert.equal(stickeringChar(active.mask, "CENTERS", 5), "-");
    // FR 角棱在默认编号下不在黄层，保持正常上色
    assert.equal(stickeringChar(active.mask, "CORNERS", 3), "-");
    assert.equal(stickeringChar(active.mask, "EDGES", 9), "-");
  });

  it("关闭简化或非 F2L 时恢复全色", () => {
    assert.deepEqual(practiceStickering("f2l-paired", false), { mode: "full" });
    assert.deepEqual(practiceStickering("oll-sune", true), { mode: "full" });
    assert.deepEqual(practiceStickering("pll-t", true), { mode: "full" });
    assert.deepEqual(practiceStickering(null, true), { mode: "full" });
    assert.deepEqual(practiceStickering(undefined, true), { mode: "full" });
  });
});
