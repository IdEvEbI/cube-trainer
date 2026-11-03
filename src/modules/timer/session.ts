/** Hold delay before arming, to reduce accidental starts. */
export const ARM_HOLD_MS = 300;

/** Pointer / touch keep the hold delay; keyboard Space arms immediately. */
export type TimingInputSource = "keyboard" | "pointer";

/**
 * Home tools stack: gap between time digits and local stats.
 * Keep in sync with `.focus[data-focus="计时"] .slot-tools` in app.css.
 */
export const TIMER_HOME_TOOLS_GAP_PX = 20;

/** Align tools to the top of the slot so the timer sits higher on the home screen. */
export const TIMER_HOME_TOOLS_ALIGN = "start" as const;

export type SessionPhase = "idle" | "arming" | "armed" | "running" | "stopped";

export type SessionEvent =
  | { type: "hold_start" }
  | { type: "hold_ready" }
  | { type: "hold_cancel" }
  | { type: "hold_release" }
  /** 非蓝牙：长按达标后进入倒计时（准备态）。 */
  | { type: "arm" }
  /** 蓝牙：打乱完成后实体首次转动直接进入计时（跳过长按预备）。 */
  | { type: "bt_start" }
  | { type: "stop" }
  | { type: "reset" };

/** 非蓝牙短按松手：未打乱完 → 播放打乱；已打乱完 → 直接开表。 */
export type NonBluetoothShortReleaseAction = "play_scramble" | "start_now";

export function nonBluetoothShortReleaseAction(
  scrambleComplete: boolean,
): NonBluetoothShortReleaseAction {
  return scrambleComplete ? "start_now" : "play_scramble";
}

/** 非蓝牙长按达标：仅打乱已完成才进入浅绿倒计时。 */
export function nonBluetoothHoldReadyAction(
  scrambleComplete: boolean,
): "enter_armed" | "stay_arming" {
  return scrambleComplete ? "enter_armed" : "stay_arming";
}

/**
 * Keyboard Space must arm on keydown so one press (down + up) starts.
 * Soft-key taps are shorter than {@link ARM_HOLD_MS} and would cancel otherwise.
 * 非蓝牙首页手势需区分短按 / 长按，空格与触控统一用 {@link ARM_HOLD_MS}。
 */
export function armHoldDelayMs(
  source: TimingInputSource,
  options: { uniformHold?: boolean } = {},
): number {
  if (options.uniformHold) {
    return ARM_HOLD_MS;
  }
  return source === "keyboard" ? 0 : ARM_HOLD_MS;
}

/**
 * Decide whether a press-up should end the hold.
 * The ignore flag (set when stopping on down) must be consumed even if input is
 * already disabled by the result dialog — otherwise the next solve's release is swallowed.
 */
export function shouldEndHoldOnRelease(
  ignoreNextRelease: boolean,
  inputEnabled: boolean,
): { endHold: boolean; nextIgnore: boolean } {
  if (ignoreNextRelease) {
    return { endHold: false, nextIgnore: false };
  }
  if (!inputEnabled) {
    return { endHold: false, nextIgnore: false };
  }
  return { endHold: true, nextIgnore: false };
}

/**
 * Apply hold_start, and for keyboard immediately hold_ready (armed).
 * Pointer stays in arming until the hold timer fires.
 */
export function reduceHoldStart(
  phase: SessionPhase,
  source: TimingInputSource,
): SessionPhase {
  let next = reduceSession(phase, { type: "hold_start" });
  if (source === "keyboard" && next === "arming") {
    next = reduceSession(next, { type: "hold_ready" });
  }
  return next;
}

/** Comfortable gap between timer and stats (wide + narrow home). */
export function isTimerHomeToolsGapComfortable(gapPx: number): boolean {
  return gapPx >= 16;
}

export function timerHomeToolsLayout(): {
  gapPx: number;
  alignContent: typeof TIMER_HOME_TOOLS_ALIGN;
} {
  return {
    gapPx: TIMER_HOME_TOOLS_GAP_PX,
    alignContent: TIMER_HOME_TOOLS_ALIGN,
  };
}

/** Pure phase transitions for scramble-timer session (prepare → run → stop). */
export function reduceSession(
  phase: SessionPhase,
  event: SessionEvent,
): SessionPhase {
  switch (event.type) {
    case "hold_start":
      if (phase === "idle" || phase === "stopped") {
        return "arming";
      }
      return phase;
    case "hold_ready":
      if (phase === "arming") {
        return "armed";
      }
      return phase;
    case "hold_cancel":
      if (phase === "arming") {
        return "idle";
      }
      return phase;
    case "hold_release":
      if (phase === "armed") {
        return "running";
      }
      if (phase === "arming") {
        return "idle";
      }
      return phase;
    case "arm":
      if (phase === "idle" || phase === "stopped" || phase === "arming") {
        return "armed";
      }
      return phase;
    case "bt_start":
      if (
        phase === "idle" ||
        phase === "stopped" ||
        phase === "arming" ||
        phase === "armed"
      ) {
        return "running";
      }
      return phase;
    case "stop":
      if (phase === "running") {
        return "stopped";
      }
      return phase;
    case "reset":
      return "idle";
  }
}

/**
 * 打乱引导已完成、且非计时中时，可用蓝牙转动开表。
 * 观察中（inspecting）或待转（ready）均可；观察中由调用方先结束倒计时。
 */
export function shouldStartBluetoothTimer(
  guideDone: boolean,
  phase: SessionPhase,
  inspectPhase: "off" | "inspecting" | "ready" = "ready",
): boolean {
  return (
    guideDone &&
    phase !== "running" &&
    (inspectPhase === "ready" || inspectPhase === "inspecting")
  );
}

/** Display phase for chrome: arming looks like idle until hold is ready. */
export function displayPhase(
  phase: SessionPhase,
): "idle" | "armed" | "running" | "stopped" {
  if (phase === "arming") {
    return "idle";
  }
  return phase;
}

/** 准备态与计时中均进入计时画面（只留计时器）。 */
export function isTimingChromeHidden(phase: SessionPhase): boolean {
  return phase === "armed" || phase === "running";
}

/**
 * 计时画面显示「放弃」：准备态 / 计时中均可退出，避免蓝牙无法还原时卡死。
 */
export function shouldShowAbandonTimingControl(phase: SessionPhase): boolean {
  return phase === "armed" || phase === "running";
}

/** Timing and practice both hide the manual layer turn pad. */
export function showCubeLayerControls(focusKind: string): boolean {
  return focusKind !== "计时" && focusKind !== "练习";
}

export type CubePreviewMode = "cube" | "net";

export function nextCubePreviewMode(mode: CubePreviewMode): CubePreviewMode {
  return mode === "cube" ? "net" : "cube";
}

/** Idle home shows exactly one of 3D / net; never both. */
export function timingPreviewExclusive(mode: CubePreviewMode): {
  showCube: boolean;
  showNet: boolean;
} {
  return {
    showCube: mode === "cube",
    showNet: mode === "net",
  };
}

export type TimingShellSlot = "scramble" | "preview" | "timer" | "topbar";

export type TimingShellOptions = {
  /** 已连接蓝牙时，计时中（running）保留 3D 魔方跟随。 */
  bluetoothConnected?: boolean;
};

/**
 * armed / running：计时画面。
 * - 非蓝牙：只显示计时器。
 * - 蓝牙 running：计时器 + 3D 预览；顶栏 / 打乱 / 统计仍隐藏。
 * 首页（idle / stopped / arming）：顶栏、魔方、打乱、统计；计时器不常驻。
 * arming 仍停在首页（触控未满 300ms）；进入 armed 后再切计时画面。
 */
export function timingShellVisible(
  phase: SessionPhase,
  slot: TimingShellSlot,
  options: TimingShellOptions = {},
): boolean {
  if (isTimingChromeHidden(phase)) {
    if (slot === "timer") {
      return true;
    }
    if (
      slot === "preview" &&
      options.bluetoothConnected &&
      phase === "running"
    ) {
      return true;
    }
    return false;
  }
  if (slot === "timer") {
    return false;
  }
  return true;
}

/**
 * After stop, refresh scramble / cube without clearing the shown solve time.
 * Manual / initial scramble still resets the timer display.
 */
export function keepElapsedOnScrambleRefresh(phase: SessionPhase): boolean {
  return phase === "stopped";
}

/**
 * 首页上次成绩槽：计时首页常驻占位（避免有无成绩时魔方高度跳动）；
 * 有成绩则显示数字，无成绩则占位隐藏数字。
 */
export function shouldShowLastSolveSlotOnHome(timingHome: boolean): boolean {
  return timingHome;
}

/** 非蓝牙停表回首页时复位白上绿前复原态；蓝牙跟实体，不复位。 */
export function shouldResetCubeOnTimingHome(
  bluetoothConnected: boolean,
): boolean {
  return !bluetoothConnected;
}

/**
 * 蓝牙计时中禁止点击 / 空格手动停表，仅还原自动停。
 * 非蓝牙仍允许手动停。
 */
export function allowManualTimerStop(bluetoothConnected: boolean): boolean {
  return !bluetoothConnected;
}

/**
 * After preview / scramble controls, drop focus so Space still arms the timer.
 */
export function releaseTimingFocus(target: { blur(): void } | null): void {
  target?.blur();
}

/** Selector for UI that must not arm/stop the timer（按钮等；不含 3D，短按可开表）。 */
export const TIMING_POINTER_IGNORE =
  "button, summary, a, input, textarea, select";

/** 3D 魔方区域：短按走计时手势，拖过阈值则取消并交给旋转。 */
export const TIMING_POINTER_CUBE = ".cube-view, twisty-player";

/** 魔方上按下后移动超过该像素，视为旋转而非点按开表。 */
export const CUBE_ORBIT_MOVE_PX = 12;

/**
 * Pointer targets inside controls must not start a hold.
 * Includes SVG inside buttons；3D 见 {@link isTimingPointerOnCube}。
 */
export function isTimingPointerOnControl(target: EventTarget | null): boolean {
  if (
    !target ||
    typeof (target as { closest?: unknown }).closest !== "function"
  ) {
    return false;
  }
  return Boolean((target as Element).closest(TIMING_POINTER_IGNORE));
}

export function isTimingPointerOnCube(target: EventTarget | null): boolean {
  if (
    !target ||
    typeof (target as { closest?: unknown }).closest !== "function"
  ) {
    return false;
  }
  return Boolean((target as Element).closest(TIMING_POINTER_CUBE));
}

/** 魔方指针移动是否已超出点按范围，应取消计时手势、保留旋转。 */
export function shouldCancelTimingHoldForCubeDrag(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  thresholdPx: number = CUBE_ORBIT_MOVE_PX,
): boolean {
  const dx = clientX - startX;
  const dy = clientY - startY;
  return dx * dx + dy * dy >= thresholdPx * thresholdPx;
}
