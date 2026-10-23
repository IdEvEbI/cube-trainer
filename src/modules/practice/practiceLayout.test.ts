import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { showPractice, showTiming } from "./focus.ts";
import {
  modeSwitchPresentation,
  practiceFullscreenTimerOnly,
  practiceShellOrder,
  practiceShowsNet,
} from "./practiceLayout.ts";

describe("practiceShellOrder", () => {
  it("宽屏练习：公式选择 → 魔方 → 公式与控制条", () => {
    assert.deepEqual(practiceShellOrder(), [
      "rail",
      "cube",
      "hint",
      "controls",
    ]);
  });

  it("练习不展示平面图，也不强制全屏只显示计时器", () => {
    assert.equal(practiceShowsNet(), false);
    assert.equal(practiceFullscreenTimerOnly(), false);
  });
});

describe("modeSwitchPresentation", () => {
  it("首页练习入口用图标并直接进入练习", () => {
    assert.deepEqual(modeSwitchPresentation("打乱计时"), {
      kind: "icon",
      name: "practice",
      ariaLabel: "练习",
    });
    assert.deepEqual(showPractice(), { kind: "练习", methodId: "cfop" });
    assert.deepEqual(showTiming(), { kind: "计时" });
  });

  it("练习流回打乱计时仍用文字", () => {
    assert.deepEqual(modeSwitchPresentation("公式练习"), {
      kind: "text",
      text: "打乱计时",
      ariaLabel: "打乱计时",
    });
  });
});
