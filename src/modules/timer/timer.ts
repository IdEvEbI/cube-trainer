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

/** 计时显示拆分：主段（分:秒 / 秒）大号，厘秒两位小号，减轻闪烁。 */
export type ElapsedParts = {
  main: string;
  fraction: string;
};

/**
 * 按厘秒（两位小数）格式化；向下截断到 10ms。
 * 例：`0.00` / `1.50` / `1:05.00`。
 */
export function formatElapsedParts(ms: number): ElapsedParts {
  const safe = Math.max(0, Math.trunc(ms));
  const centis = Math.floor(safe / 10);
  const minutes = Math.floor(centis / 6_000);
  const seconds = Math.floor((centis % 6_000) / 100);
  const fraction = String(centis % 100).padStart(2, "0");
  if (minutes > 0) {
    return {
      main: `${minutes}:${String(seconds).padStart(2, "0")}`,
      fraction,
    };
  }
  return { main: String(seconds), fraction };
}

export function formatElapsed(ms: number): string {
  const { main, fraction } = formatElapsedParts(ms);
  return `${main}.${fraction}`;
}

/** 窄屏阈值：低于此宽度时 ≥10 分钟改用更紧的字号。 */
export const TIMER_NARROW_VIEWPORT_PX = 480;

export type TimerDisplayScale = "normal" | "compact" | "tight";

/**
 * 长时显示缩放：避免 `10:00.00` / `100:00.00` 在窄屏溢出。
 * - `<10` 分：normal
 * - `≥10` 分：宽屏 compact，窄屏 tight
 * - `≥100` 分：一律 tight
 */
export function timerDisplayScale(
  ms: number,
  viewportWidthPx: number = Number.POSITIVE_INFINITY,
): TimerDisplayScale {
  const minutes = Math.floor(Math.max(0, Math.trunc(ms)) / 60_000);
  const narrow = viewportWidthPx <= TIMER_NARROW_VIEWPORT_PX;
  if (minutes >= 100) {
    return "tight";
  }
  if (minutes >= 10) {
    return narrow ? "tight" : "compact";
  }
  return "normal";
}
