import { formatElapsed } from "../timer/timer.ts";
import type { Score } from "./score.ts";
import "./score.css";

export function ScoreList({
  scores,
  open,
  onToggle,
}: {
  scores: readonly Score[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="scores">
      <button
        type="button"
        className="scores-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        成绩
      </button>
      {open ? (
        scores.length === 0 ? (
          <p className="scores-empty">还没有成绩</p>
        ) : (
          <ol className="scores-list">
            {scores.map((score) => (
              <li key={`${score.recordedAt}-${score.timeMs}-${score.scramble}`}>
                <span className="score-time">
                  {formatElapsed(score.timeMs)}
                </span>
                <span className="score-date">
                  {formatScoreDate(score.recordedAt)}
                </span>
                <span className="score-mode">{score.mode}</span>
                <span className="score-scramble" title={score.scramble}>
                  {score.scramble}
                </span>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </section>
  );
}

function formatScoreDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
}
