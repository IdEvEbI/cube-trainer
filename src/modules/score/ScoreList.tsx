import { useMemo, useState } from "react";
import { formatElapsed } from "../timer/timer.ts";
import type { Score } from "./score.ts";
import {
  canExpandScoreListItem,
  canOpenScoreReview,
  formatScoreListDate,
  formatScorePhaseShare,
  scoreListScrambleText,
  scoreListSummary,
  scoreOverviewStats,
  scorePhaseBarPrimaryStats,
  scorePhaseBarSecondaryStats,
  scorePhaseBars,
  scoreTrendPoints,
} from "./scoreList.ts";
import "./score.css";

function formatStat(ms: number | null): string {
  return ms === null ? "—" : formatElapsed(ms);
}

function ReviewIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 12h8l1-12" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function BluetoothModeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 7l10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}

function ManualModeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3z" />
      <path d="M12 12 20 7.5" />
      <path d="M12 12v9" />
      <path d="m12 12-8-4.5" />
    </svg>
  );
}

function ScoreModeBadge({ mode }: { mode: Score["mode"] }) {
  const bluetooth = mode === "蓝牙";
  return (
    <span
      className={`score-list-mode ${
        bluetooth ? "score-list-mode-bluetooth" : "score-list-mode-manual"
      }`}
      title={mode}
    >
      {bluetooth ? <BluetoothModeIcon /> : <ManualModeIcon />}
      <span>{mode}</span>
    </span>
  );
}

function formatTrendSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} 秒`;
}

function formatTrendHover(attemptNo: number, ms: number): string {
  return `第 ${attemptNo} 次 · ${(ms / 1000).toFixed(2)} 秒`;
}

function ScoreTrendChart({ scores }: { scores: readonly Score[] }) {
  const trendLimit = 20;
  const points = useMemo(() => scoreTrendPoints(scores, trendLimit), [scores]);
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.timeMs);
  const max = Math.max(...values, 1);
  const width = 640;
  const height = 160;
  const padLeft = 8;
  const padRight = 12;
  const padTop = 10;
  const padBottom = 36;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const step = points.length <= 1 ? 0 : innerW / (points.length - 1);
  const clipped = scores.length > trendLimit;
  const title = clipped ? "最近成绩趋势 · 最近 20 次" : "最近成绩趋势";
  const yTicks = [
    { ratio: 1, label: formatTrendSeconds(max) },
    { ratio: 0.5, label: formatTrendSeconds(max / 2) },
    { ratio: 0, label: "0 秒" },
  ];
  const baseAttempt =
    scores.length > points.length ? scores.length - points.length + 1 : 1;
  const coords = points.map((point, index) => {
    const x = padLeft + index * step;
    const y = padTop + innerH - (point.timeMs / max) * innerH;
    return {
      ...point,
      x,
      y,
      attemptNo: baseAttempt + index,
    };
  });
  const linePath = coords
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const areaPath =
    coords.length === 0
      ? ""
      : [
          `M${coords[0]!.x.toFixed(1)} ${(padTop + innerH).toFixed(1)}`,
          ...coords.map(
            (point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
          ),
          `L${coords[coords.length - 1]!.x.toFixed(1)} ${(padTop + innerH).toFixed(1)}`,
          "Z",
        ].join(" ");

  return (
    <div className="score-trend" aria-label={title}>
      <p className="score-trend-title">{title}</p>
      <div className="score-trend-frame">
        <ul className="score-trend-y-axis" aria-hidden="true">
          {yTicks.map((tick) => {
            const yRatio = (padTop + innerH * (1 - tick.ratio)) / height;
            return (
              <li
                key={tick.ratio}
                style={{ top: `${(yRatio * 100).toFixed(2)}%` }}
              >
                {tick.label}
              </li>
            );
          })}
        </ul>
        <svg
          className="score-trend-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient
              id="score-trend-area-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#9ec9e8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#4a7eb5" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const y = padTop + innerH * (1 - tick.ratio);
            return (
              <line
                key={tick.ratio}
                className="score-trend-grid"
                x1={padLeft}
                y1={y}
                x2={padLeft + innerW}
                y2={y}
              />
            );
          })}
          {areaPath ? <path className="score-trend-area" d={areaPath} /> : null}
          <path className="score-trend-line" d={linePath} />
          {coords.map((point) => (
            <circle
              key={point.id}
              className="score-trend-dot"
              cx={point.x}
              cy={point.y}
              r="4.5"
            >
              <title>{formatTrendHover(point.attemptNo, point.timeMs)}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function ScoreListPage({
  scores,
  onOpenReview,
  onRetrySameScramble,
  onDelete,
}: {
  scores: readonly Score[];
  onOpenReview: (score: Score) => void;
  onRetrySameScramble: (score: Score) => void;
  onDelete: (scoreId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const summary = useMemo(() => scoreListSummary(scores), [scores]);
  const summaryLines = useMemo(
    () => [
      { label: "总盘数", value: String(summary.count) },
      { label: "最好", value: formatStat(summary.bestMs) },
      { label: "Ao5", value: formatStat(summary.ao5Ms) },
      { label: "Ao12", value: formatStat(summary.ao12Ms) },
      { label: "Ao100", value: formatStat(summary.ao100Ms) },
      { label: "AVG", value: formatStat(summary.avgMs) },
    ],
    [summary],
  );

  function toggleExpanded(scoreId: string) {
    setExpandedId((current) => (current === scoreId ? null : scoreId));
  }

  return (
    <section className="score-list-page" aria-label="成绩列表">
      <div className="score-list-scroll">
        <header className="score-list-dashboard">
          <h1 className="score-list-title">成绩</h1>
          <ul className="score-list-summary-stats" aria-label="成绩汇总">
            {summaryLines.map((line) => (
              <li key={line.label}>
                <span className="score-list-summary-label">{line.label}</span>
                <span className="score-list-summary-value">{line.value}</span>
              </li>
            ))}
          </ul>
          <ScoreTrendChart scores={scores} />
        </header>

        {scores.length === 0 ? (
          <p className="score-list-empty">还没有成绩</p>
        ) : (
          <ol className="score-list">
            {scores.map((score) => {
              const expandable = canExpandScoreListItem(score);
              const expanded = expandable && expandedId === score.id;
              const overview = scoreOverviewStats(score.split);
              const bars = scorePhaseBars(score.split);
              const scrambleText = scoreListScrambleText(score);
              const openable = canOpenScoreReview(score);
              const retryable = scrambleText !== null;
              const showScrambleAlways =
                score.mode === "非蓝牙" && scrambleText !== null;
              const showDetail = expanded || showScrambleAlways;
              return (
                <li
                  key={score.id}
                  className={`score-list-item${expanded ? " is-expanded" : ""}${
                    expandable ? "" : " is-static"
                  }`}
                >
                  {expandable ? (
                    <button
                      type="button"
                      className="score-list-row"
                      aria-expanded={expanded}
                      onClick={() => toggleExpanded(score.id)}
                    >
                      <span className="score-list-time">
                        {formatElapsed(score.timeMs)}
                      </span>
                      <span className="score-list-meta">
                        <ScoreModeBadge mode={score.mode} />
                        <span className="score-list-date">
                          {formatScoreListDate(score.recordedAt)}
                        </span>
                      </span>
                      <span className="score-list-chevron" aria-hidden="true">
                        {expanded ? "▾" : "▸"}
                      </span>
                    </button>
                  ) : (
                    <div className="score-list-row is-static">
                      <span className="score-list-time">
                        {formatElapsed(score.timeMs)}
                      </span>
                      <span className="score-list-meta">
                        <ScoreModeBadge mode={score.mode} />
                        <span className="score-list-date">
                          {formatScoreListDate(score.recordedAt)}
                        </span>
                      </span>
                    </div>
                  )}

                  {showDetail ? (
                    <div className="score-list-detail">
                      {expanded && overview ? (
                        <dl className="score-list-overview-grid">
                          {overview.map((stat) => (
                            <div
                              key={stat.label}
                              className="score-list-stat-card"
                            >
                              <dt>{stat.label}</dt>
                              <dd>{stat.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}

                      {expanded && bars ? (
                        <ul
                          className="score-list-bars"
                          aria-label="分段时间占比"
                        >
                          {bars.map((bar) => {
                            const primary = scorePhaseBarPrimaryStats(bar);
                            const timePart = primary[0]!;
                            const sharePart = primary[1]!;
                            const secondary = scorePhaseBarSecondaryStats(bar);
                            const secondaryTitle = secondary
                              .map((part) => `${part.label} ${part.value}`)
                              .join(" · ");
                            const barWidth = Math.max(
                              bar.share * 100,
                              bar.timeMs > 0 ? 4 : 0,
                            );
                            return (
                              <li
                                key={bar.id}
                                className={`score-list-bar score-list-bar-${bar.id}`}
                                title={secondaryTitle}
                              >
                                <div className="score-list-bar-head">
                                  <span className="score-list-bar-label">
                                    <span
                                      className="score-list-bar-swatch"
                                      aria-hidden="true"
                                    />
                                    {bar.label}
                                  </span>
                                  <div className="score-list-bar-meta">
                                    <p className="score-list-bar-meta-primary">
                                      <span className="score-list-bar-time">
                                        <strong className="score-list-bar-meta-label">
                                          {timePart.label}
                                        </strong>{" "}
                                        {timePart.value}
                                      </span>
                                      <span className="score-list-bar-share">
                                        {sharePart.value}
                                      </span>
                                    </p>
                                    <p className="score-list-bar-meta-secondary">
                                      {secondary.map((part, index) => (
                                        <span key={part.label}>
                                          {index > 0 ? " · " : null}
                                          <strong className="score-list-bar-meta-label">
                                            {part.label}
                                          </strong>{" "}
                                          {part.value}
                                        </span>
                                      ))}
                                    </p>
                                  </div>
                                </div>
                                <div
                                  className="score-list-bar-track"
                                  title={`${bar.label} 用时 ${formatElapsed(bar.timeMs)} · 占比 ${formatScorePhaseShare(bar.share)} · ${secondaryTitle}`}
                                >
                                  <span
                                    className="score-list-bar-fill"
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}

                      {showScrambleAlways ? (
                        <p className="score-list-scramble">
                          <span className="score-list-scramble-label">
                            打乱
                          </span>
                          <span className="score-list-scramble-text">
                            {scrambleText}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="score-list-actions">
                    {openable ? (
                      <button
                        type="button"
                        className="score-list-icon-btn score-list-icon-review"
                        aria-label="查看复盘"
                        title="查看复盘"
                        onClick={() => onOpenReview(score)}
                      >
                        <ReviewIcon />
                      </button>
                    ) : null}
                    {retryable ? (
                      <button
                        type="button"
                        className="score-list-icon-btn score-list-icon-retry"
                        aria-label="再练一次"
                        title="再练一次"
                        onClick={() => onRetrySameScramble(score)}
                      >
                        <RetryIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="score-list-icon-btn score-list-icon-delete"
                      aria-label="删除"
                      title="删除"
                      onClick={() => {
                        onDelete(score.id);
                        setExpandedId(null);
                      }}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
