import { useMemo } from "react";
import type { ScoreSummary } from "../score/score.ts";
import { formatElapsed } from "./timer.ts";
import "./timer.css";

function formatStat(ms: number | null): string {
  return ms === null ? "—" : formatElapsed(ms);
}

export function TimerStats({ summary }: { summary: ScoreSummary }) {
  const lines = useMemo(
    () => [
      { label: "次数", value: String(summary.count) },
      { label: "最好", value: formatStat(summary.bestMs) },
      { label: "最差", value: formatStat(summary.worstMs) },
      { label: "平均", value: formatStat(summary.avgMs) },
      { label: "Ao5", value: formatStat(summary.ao5Ms) },
    ],
    [summary],
  );

  return (
    <section className="timer-stats" aria-label="计时统计">
      <ul className="timer-stats-list">
        {lines.map((line) => (
          <li key={line.label}>
            <span className="timer-stats-label">{line.label}</span>
            <span className="timer-stats-value">{line.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
