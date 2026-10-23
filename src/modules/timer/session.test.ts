import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARM_HOLD_MS,
  TIMER_HOME_TOOLS_GAP_PX,
  armHoldDelayMs,
  displayPhase,
  isTimerHomeToolsGapComfortable,
  isTimingChromeHidden,
  isTimingPointerOnControl,
  keepElapsedOnScrambleRefresh,
  nextCubePreviewMode,
  reduceHoldStart,
  reduceSession,
  releaseTimingFocus,
  showCubeLayerControls,
  timerHomeToolsLayout,
  timingPreviewExclusive,
  timingShellVisible,
  type SessionPhase,
} from "./session.ts";

describe("reduceSession", () => {
  it("长按达到延迟后进入准备（armed）", () => {
    let phase: SessionPhase = "idle";
    phase = reduceSession(phase, { type: "hold_start" });
    assert.equal(phase, "arming");
    assert.equal(displayPhase(phase), "idle");
    assert.equal(ARM_HOLD_MS, 300);

    phase = reduceSession(phase, { type: "hold_ready" });
    assert.equal(phase, "armed");
    assert.equal(displayPhase(phase), "armed");
  });

  it("未满延迟松手则取消，不进入准备", () => {
    let phase: SessionPhase = "idle";
    phase = reduceSession(phase, { type: "hold_start" });
    phase = reduceSession(phase, { type: "hold_cancel" });
    assert.equal(phase, "idle");
  });

  it("空格一次启动：keydown 即 armed，keyup 进入计时中", () => {
    assert.equal(armHoldDelayMs("keyboard"), 0);
    assert.equal(armHoldDelayMs("pointer"), ARM_HOLD_MS);

    let phase: SessionPhase = "idle";
    phase = reduceHoldStart(phase, "keyboard");
    assert.equal(phase, "armed");
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");

    // stopped 后同样一次空格即可再开
    phase = reduceSession(phase, { type: "stop" });
    phase = reduceHoldStart(phase, "keyboard");
    assert.equal(phase, "armed");
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");
  });

  it("触控仍需长按预备，短按不启动", () => {
    let phase: SessionPhase = "idle";
    phase = reduceHoldStart(phase, "pointer");
    assert.equal(phase, "arming");
    phase = reduceSession(phase, { type: "hold_cancel" });
    assert.equal(phase, "idle");
  });

  it("准备后松手进入计时中", () => {
    let phase: SessionPhase = "armed";
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");
    assert.equal(isTimingChromeHidden(phase), true);
  });

  it("计时中停止回到 stopped，并隐藏结束", () => {
    let phase: SessionPhase = "running";
    phase = reduceSession(phase, { type: "stop" });
    assert.equal(phase, "stopped");
    assert.equal(isTimingChromeHidden(phase), false);
  });

  it("stopped 后可再次长按进入准备", () => {
    let phase: SessionPhase = "stopped";
    phase = reduceSession(phase, { type: "hold_start" });
    phase = reduceSession(phase, { type: "hold_ready" });
    assert.equal(phase, "armed");
  });

  it("reset 回到 idle", () => {
    assert.equal(reduceSession("stopped", { type: "reset" }), "idle");
    assert.equal(reduceSession("running", { type: "reset" }), "idle");
    assert.equal(reduceSession("armed", { type: "reset" }), "idle");
  });

  it("完整闭环：准备 → 计时中 → 停止", () => {
    let phase: SessionPhase = "idle";
    phase = reduceSession(phase, { type: "hold_start" });
    phase = reduceSession(phase, { type: "hold_ready" });
    assert.equal(phase, "armed");
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");
    phase = reduceSession(phase, { type: "stop" });
    assert.equal(phase, "stopped");
  });
});

describe("showCubeLayerControls", () => {
  it("打乱计时首屏不显示转面按钮", () => {
    assert.equal(showCubeLayerControls("计时"), false);
  });

  it("练习模式也不显示转面按钮", () => {
    assert.equal(showCubeLayerControls("练习"), false);
  });

  it("去掉转面后交互状态闭环仍正常", () => {
    assert.equal(showCubeLayerControls("计时"), false);
    let phase: SessionPhase = "idle";
    phase = reduceSession(phase, { type: "hold_start" });
    phase = reduceSession(phase, { type: "hold_ready" });
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");
    phase = reduceSession(phase, { type: "stop" });
    assert.equal(phase, "stopped");
  });
});

describe("keepElapsedOnScrambleRefresh", () => {
  it("停止后刷新打乱仍保留本次时长显示", () => {
    let phase: SessionPhase = "running";
    phase = reduceSession(phase, { type: "stop" });
    assert.equal(phase, "stopped");
    assert.equal(keepElapsedOnScrambleRefresh(phase), true);
  });

  it("准备或计时中刷新打乱会重置时长", () => {
    assert.equal(keepElapsedOnScrambleRefresh("idle"), false);
    assert.equal(keepElapsedOnScrambleRefresh("running"), false);
  });
});

describe("nextCubePreviewMode", () => {
  it("可在 3D 魔方与平面图之间切换", () => {
    assert.equal(nextCubePreviewMode("cube"), "net");
    assert.equal(nextCubePreviewMode("net"), "cube");
    assert.equal(nextCubePreviewMode(nextCubePreviewMode("cube")), "cube");
  });
});

describe("timingPreviewExclusive", () => {
  it("宽屏初始只显示一种视图：默认 3D，不与平面图并存", () => {
    assert.deepEqual(timingPreviewExclusive("cube"), {
      showCube: true,
      showNet: false,
    });
    assert.deepEqual(timingPreviewExclusive("net"), {
      showCube: false,
      showNet: true,
    });
  });
});

describe("timingShellVisible", () => {
  it("计时中只显示计时器", () => {
    assert.equal(timingShellVisible("running", "timer"), true);
    assert.equal(timingShellVisible("running", "scramble"), false);
    assert.equal(timingShellVisible("running", "preview"), false);
    assert.equal(timingShellVisible("running", "topbar"), false);
    assert.equal(isTimingChromeHidden("running"), true);
  });

  it("计时中隐藏打乱、魔方/平面图与顶栏（宽窄屏同一规则）", () => {
    const slots = ["scramble", "preview", "timer", "topbar"] as const;
    const visible = Object.fromEntries(
      slots.map((slot) => [slot, timingShellVisible("running", slot)]),
    );
    assert.deepEqual(visible, {
      scramble: false,
      preview: false,
      timer: true,
      topbar: false,
    });
  });

  it("初始与停止后显示完整首屏", () => {
    for (const phase of ["idle", "stopped", "armed"] as const) {
      assert.equal(timingShellVisible(phase, "scramble"), true);
      assert.equal(timingShellVisible(phase, "preview"), true);
      assert.equal(timingShellVisible(phase, "timer"), true);
      assert.equal(timingShellVisible(phase, "topbar"), true);
    }
  });

  it("窄屏与宽屏共用：计时中只显示计时器", () => {
    // Shell visibility is viewport-independent; narrow layout only restyles.
    assert.equal(timingShellVisible("running", "timer"), true);
    assert.equal(timingShellVisible("running", "preview"), false);
    assert.equal(timingShellVisible("running", "scramble"), false);
  });
});

describe("releaseTimingFocus", () => {
  it("切换视图后释放按钮焦点，空格仍可用于计时", () => {
    let blurred = false;
    releaseTimingFocus({
      blur() {
        blurred = true;
      },
    });
    assert.equal(blurred, true);

    const mode = nextCubePreviewMode("cube");
    assert.equal(mode, "net");
    releaseTimingFocus({
      blur() {
        blurred = true;
      },
    });
    let phase: SessionPhase = "idle";
    phase = reduceSession(phase, { type: "hold_start" });
    phase = reduceSession(phase, { type: "hold_ready" });
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");
    phase = reduceSession(phase, { type: "stop" });
    assert.equal(phase, "stopped");
  });

  it("窄屏切换 3D/平面图后空格仍可开始/停止", () => {
    // Same focus release as wide; narrow only changes CSS.
    let blurred = 0;
    const toggle = {
      blur() {
        blurred += 1;
      },
    };
    assert.equal(nextCubePreviewMode("cube"), "net");
    releaseTimingFocus(toggle);
    assert.equal(nextCubePreviewMode("net"), "cube");
    releaseTimingFocus(toggle);
    assert.equal(blurred, 2);

    let phase: SessionPhase = "idle";
    phase = reduceSession(phase, { type: "hold_start" });
    phase = reduceSession(phase, { type: "hold_ready" });
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");
    phase = reduceSession(phase, { type: "stop" });
    assert.equal(phase, "stopped");
  });
});

describe("timerHomeToolsLayout", () => {
  it("间距调整后布局正常：计时器与成绩有舒适间距且靠上", () => {
    const layout = timerHomeToolsLayout();
    assert.equal(layout.gapPx, TIMER_HOME_TOOLS_GAP_PX);
    assert.equal(layout.alignContent, "start");
    assert.equal(isTimerHomeToolsGapComfortable(layout.gapPx), true);
    assert.equal(isTimerHomeToolsGapComfortable(2), false);
  });
});

describe("isTimingPointerOnControl", () => {
  it("识别按钮及内部 SVG，避免误触发计时长按", () => {
    assert.equal(isTimingPointerOnControl(null), false);
    assert.equal(isTimingPointerOnControl({} as EventTarget), false);

    const button = {
      closest(selector: string) {
        return selector.includes("button") ? this : null;
      },
    };
    assert.equal(
      isTimingPointerOnControl(button as unknown as EventTarget),
      true,
    );

    const path = {
      closest(selector: string) {
        return selector.includes("button") ? button : null;
      },
    };
    assert.equal(
      isTimingPointerOnControl(path as unknown as EventTarget),
      true,
    );
  });

  it("拖动三维魔方不启动计时", () => {
    const cube = {
      closest(selector: string) {
        return selector.includes(".cube-view") ||
          selector.includes("twisty-player")
          ? this
          : null;
      },
    };
    assert.equal(
      isTimingPointerOnControl(cube as unknown as EventTarget),
      true,
    );
  });
});
