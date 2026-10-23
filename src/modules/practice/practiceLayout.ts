/**
 * Practice shell (wide-first for this pass): formula picker → 3D cube →
 * formula + controls. Timer stays secondary; no plane/net.
 */

export type PracticeShellSlot = "rail" | "cube" | "hint" | "controls";

/** Vertical slot order for the practice session screen (no practice timer). */
export function practiceShellOrder(): PracticeShellSlot[] {
  return ["rail", "cube", "hint", "controls"];
}

/** Practice observes the 3D cube only; no scramble-style net toggle. */
export function practiceShowsNet(): boolean {
  return false;
}

/**
 * Non-bluetooth practice keeps cube + steps visible while timing.
 * Unlike scramble-timer home, do not hide chrome for a fullscreen clock.
 */
export function practiceFullscreenTimerOnly(): boolean {
  return false;
}

export type ModeSwitchPresentation =
  | { kind: "icon"; name: "practice"; ariaLabel: string }
  | { kind: "text"; text: string; ariaLabel: string };

/** Timing home shows a practice icon; practice flows show text back to timing. */
export function modeSwitchPresentation(
  currentMode: "打乱计时" | "公式练习",
): ModeSwitchPresentation {
  if (currentMode === "打乱计时") {
    return { kind: "icon", name: "practice", ariaLabel: "练习" };
  }
  return { kind: "text", text: "打乱计时", ariaLabel: "打乱计时" };
}
