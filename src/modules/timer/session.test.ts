import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARM_HOLD_MS,
  TIMER_HOME_TOOLS_GAP_PX,
  armHoldDelayMs,
  displayPhase,
  isTimerHomeToolsGapComfortable,
  isTimingChromeHidden,
  CUBE_ORBIT_MOVE_PX,
  isTimingPointerOnControl,
  isTimingPointerOnCube,
  keepElapsedOnScrambleRefresh,
  nextCubePreviewMode,
  nonBluetoothHoldReadyAction,
  nonBluetoothShortReleaseAction,
  reduceHoldStart,
  reduceSession,
  releaseTimingFocus,
  allowManualTimerStop,
  shouldCancelTimingHoldForCubeDrag,
  shouldEndHoldOnRelease,
  shouldResetCubeOnTimingHome,
  shouldShowAbandonTimingControl,
  shouldShowLastSolveSlotOnHome,
  shouldStartBluetoothTimer,
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

  it("停表后的配对松手即使 input 已禁用也要清掉 ignore，否则下一轮卡在准备态", () => {
    // 空格停表：keydown 停表并设 ignore；弹层立刻禁用 input；keyup 仍须消费 ignore。
    let ignore = true;
    let decision = shouldEndHoldOnRelease(ignore, false);
    assert.deepEqual(decision, { endHold: false, nextIgnore: false });
    ignore = decision.nextIgnore;

    // 下一轮：keydown 进入 armed，keyup 应能开表
    decision = shouldEndHoldOnRelease(ignore, true);
    assert.deepEqual(decision, { endHold: true, nextIgnore: false });
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

  it("蓝牙首转：idle / stopped 直接进入计时中，运行中忽略", () => {
    assert.equal(reduceSession("idle", { type: "bt_start" }), "running");
    assert.equal(reduceSession("stopped", { type: "bt_start" }), "running");
    assert.equal(reduceSession("arming", { type: "bt_start" }), "running");
    assert.equal(reduceSession("armed", { type: "bt_start" }), "running");
    assert.equal(reduceSession("running", { type: "bt_start" }), "running");
    assert.equal(isTimingChromeHidden("running"), true);
  });

  it("非蓝牙打乱完成后可 arm 直接进入倒计时，按下开表", () => {
    let phase: SessionPhase = "idle";
    phase = reduceSession(phase, { type: "arm" });
    assert.equal(phase, "armed");
    phase = reduceSession(phase, { type: "hold_release" });
    assert.equal(phase, "running");
    phase = reduceSession(phase, { type: "stop" });
    assert.equal(phase, "stopped");
  });
});

describe("nonBluetooth home gestures", () => {
  it("短按：未打乱完播打乱，已打乱完直接开表", () => {
    assert.equal(nonBluetoothShortReleaseAction(false), "play_scramble");
    assert.equal(nonBluetoothShortReleaseAction(true), "start_now");
  });

  it("长按达标：仅打乱完成后进入倒计时；空格与触控统一延迟", () => {
    assert.equal(nonBluetoothHoldReadyAction(false), "stay_arming");
    assert.equal(nonBluetoothHoldReadyAction(true), "enter_armed");
    assert.equal(
      armHoldDelayMs("keyboard", { uniformHold: true }),
      ARM_HOLD_MS,
    );
    assert.equal(armHoldDelayMs("pointer", { uniformHold: true }), ARM_HOLD_MS);
  });
});

describe("shouldStartBluetoothTimer", () => {
  it("默认视为待转：引导完成且未计时允许首转启动", () => {
    assert.equal(shouldStartBluetoothTimer(true, "idle"), true);
    assert.equal(shouldStartBluetoothTimer(true, "stopped"), true);
    assert.equal(shouldStartBluetoothTimer(true, "running"), false);
    assert.equal(shouldStartBluetoothTimer(false, "idle"), false);
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

describe("shouldShowLastSolveSlotOnHome", () => {
  it("计时首页常驻上次成绩槽，避免有无成绩时布局跳动", () => {
    assert.equal(shouldShowLastSolveSlotOnHome(true), true);
    assert.equal(shouldShowLastSolveSlotOnHome(false), false);
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

describe("shouldResetCubeOnTimingHome", () => {
  it("非蓝牙停表回首页复位复原态；蓝牙不复位", () => {
    assert.equal(shouldResetCubeOnTimingHome(false), true);
    assert.equal(shouldResetCubeOnTimingHome(true), false);
  });
});

describe("allowManualTimerStop", () => {
  it("非蓝牙可手动停；蓝牙仅还原自动停", () => {
    assert.equal(allowManualTimerStop(false), true);
    assert.equal(allowManualTimerStop(true), false);
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
  it("准备态与计时中显示放弃按钮", () => {
    assert.equal(shouldShowAbandonTimingControl("armed"), true);
    assert.equal(shouldShowAbandonTimingControl("running"), true);
    assert.equal(shouldShowAbandonTimingControl("idle"), false);
    assert.equal(shouldShowAbandonTimingControl("arming"), false);
    assert.equal(shouldShowAbandonTimingControl("stopped"), false);
  });

  it("非蓝牙计时中只显示计时器", () => {
    assert.equal(timingShellVisible("running", "timer"), true);
    assert.equal(timingShellVisible("running", "scramble"), false);
    assert.equal(timingShellVisible("running", "preview"), false);
    assert.equal(timingShellVisible("running", "topbar"), false);
    assert.equal(isTimingChromeHidden("running"), true);
  });

  it("非蓝牙计时中隐藏打乱、魔方与顶栏（宽窄屏同一规则）", () => {
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

  it("蓝牙计时中保留计时器与 3D，仍隐藏顶栏与打乱", () => {
    const opts = { bluetoothConnected: true };
    assert.equal(timingShellVisible("running", "timer", opts), true);
    assert.equal(timingShellVisible("running", "preview", opts), true);
    assert.equal(timingShellVisible("running", "scramble", opts), false);
    assert.equal(timingShellVisible("running", "topbar", opts), false);
  });

  it("蓝牙准备态（armed）仍不显示魔方（蓝牙实际不走 armed）", () => {
    const opts = { bluetoothConnected: true };
    assert.equal(timingShellVisible("armed", "timer", opts), true);
    assert.equal(timingShellVisible("armed", "preview", opts), false);
  });

  it("首页显示顶栏 / 魔方 / 打乱，计时器不常驻", () => {
    for (const phase of ["idle", "stopped"] as const) {
      assert.equal(timingShellVisible(phase, "scramble"), true);
      assert.equal(timingShellVisible(phase, "preview"), true);
      assert.equal(timingShellVisible(phase, "timer"), false);
      assert.equal(timingShellVisible(phase, "topbar"), true);
    }
  });

  it("触控未满延迟（arming）仍停在首页，不计时器", () => {
    assert.equal(timingShellVisible("arming", "scramble"), true);
    assert.equal(timingShellVisible("arming", "preview"), true);
    assert.equal(timingShellVisible("arming", "timer"), false);
    assert.equal(timingShellVisible("arming", "topbar"), true);
    assert.equal(isTimingChromeHidden("arming"), false);
  });

  it("准备态（armed）进入计时画面，只显示闪烁计时器", () => {
    assert.equal(timingShellVisible("armed", "timer"), true);
    assert.equal(timingShellVisible("armed", "scramble"), false);
    assert.equal(timingShellVisible("armed", "preview"), false);
    assert.equal(timingShellVisible("armed", "topbar"), false);
    assert.equal(isTimingChromeHidden("armed"), true);
  });

  it("窄屏与宽屏共用：非蓝牙计时中只显示计时器", () => {
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

  it("三维魔方不算控件：短可开表，拖过阈值才取消", () => {
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
      false,
    );
    assert.equal(isTimingPointerOnCube(cube as unknown as EventTarget), true);
    assert.equal(CUBE_ORBIT_MOVE_PX, 12);
    assert.equal(shouldCancelTimingHoldForCubeDrag(0, 0, 5, 5), false);
    assert.equal(shouldCancelTimingHoldForCubeDrag(0, 0, 12, 0), true);
  });
});
