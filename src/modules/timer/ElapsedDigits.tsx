import { formatElapsedParts } from "./timer.ts";

/**
 * 分/秒大、厘秒小的数码显示；与计时器 / 首页上次成绩共用样式类。
 */
export function ElapsedDigits({
  ms,
  armed = false,
  className = "timer-time",
}: {
  ms: number;
  armed?: boolean;
  className?: string;
}) {
  const parts = formatElapsedParts(ms);
  const timeClass = armed ? `${className} is-armed` : className;

  return (
    <p className={timeClass}>
      <span className="timer-time-main">{parts.main}</span>
      <span className="timer-time-dot" aria-hidden="true" />
      <span className="timer-time-frac">{parts.fraction}</span>
    </p>
  );
}
