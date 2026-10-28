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
  /** 蓝牙：打乱完成后实体首次转动直接进入计时（跳过长按预备）。 */
  | { type: "bt_start" }
  | { type: "stop" }
  | { type: "reset" };

/**
 * Keyboard Space must arm on keydown so one press (down + up) starts.
 * Soft-key taps are shorter than {@link ARM_HOLD_MS} and would cancel otherwise.
 */
export function armHoldDelayMs(source: TimingInputSource): number {
  return source === "keyboard" ? 0 : ARM_HOLD_MS;
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

/** 打乱引导已完成、观察结束进入待转、且非计时中时，可用蓝牙首转启动。 */
export function shouldStartBluetoothTimer(
  guideDone: boolean,
  phase: SessionPhase,
  inspectPhase: "off" | "inspecting" | "ready" = "ready",
): boolean {
  return guideDone && phase !== "running" && inspectPhase === "ready";
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

export function isTimingChromeHidden(phase: SessionPhase): boolean {
  return phase === "running";
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

/** Running keeps only the timer; home phases show the full first screen. */
export function timingShellVisible(
  phase: SessionPhase,
  slot: TimingShellSlot,
): boolean {
  if (isTimingChromeHidden(phase)) {
    return slot === "timer";
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
 * After preview / scramble controls, drop focus so Space still arms the timer.
 */
export function releaseTimingFocus(target: { blur(): void } | null): void {
  target?.blur();
}

/** Selector for UI that must not arm/stop the timer (buttons, 3D cube drag, etc.). */
export const TIMING_POINTER_IGNORE =
  "button, summary, a, input, textarea, select, .cube-view, twisty-player";

/**
 * Pointer targets inside controls must not start a hold.
 * Includes SVG inside buttons and the 3D cube (drag to inspect, not to time).
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
