/** Hold delay before arming, to reduce accidental starts. */
export const ARM_HOLD_MS = 300;

export type SessionPhase = "idle" | "arming" | "armed" | "running" | "stopped";

export type SessionEvent =
  | { type: "hold_start" }
  | { type: "hold_ready" }
  | { type: "hold_cancel" }
  | { type: "hold_release" }
  | { type: "stop" }
  | { type: "reset" };

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
    case "stop":
      if (phase === "running") {
        return "stopped";
      }
      return phase;
    case "reset":
      return "idle";
  }
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

/** Scramble-timer home has no manual layer turn pad; practice keeps it. */
export function showCubeLayerControls(focusKind: string): boolean {
  return focusKind !== "计时";
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
