import type { Clock, Timer } from "./types.ts";

type Phase = "idle" | "running" | "stopped";

export function createTimer(clock: Clock = Date.now): Timer {
  let phase: Phase = "idle";
  let startedAt = 0;
  let elapsed = 0;

  return {
    start() {
      if (phase === "running") {
        return;
      }
      elapsed = 0;
      startedAt = clock();
      phase = "running";
    },
    stop() {
      if (phase !== "running") {
        return;
      }
      elapsed = clock() - startedAt;
      phase = "stopped";
    },
    reset() {
      phase = "idle";
      startedAt = 0;
      elapsed = 0;
    },
    current() {
      if (phase === "running") {
        return clock() - startedAt;
      }
      return elapsed;
    },
  };
}

export function formatElapsed(ms: number): string {
  const safe = Math.max(0, Math.trunc(ms));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const fraction = String(safe % 1_000).padStart(3, "0");
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${fraction}`;
  }
  return `${seconds}.${fraction}`;
}
