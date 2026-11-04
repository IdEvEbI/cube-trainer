import { useState } from "react";
import { formatElapsed } from "../timer/timer.ts";
import { formatPauseRate, formatTps } from "./bluetoothSolveStats.ts";
import type { CfopPhaseId } from "./cfopSplit.ts";
import type { SolveReview } from "./solveReview.ts";
import "./solveReview.css";

function phaseTone(id: CfopPhaseId): "cross" | "f2l" | "oll" | "pll" {
  if (id === "cross") {
    return "cross";
  }
  if (id === "oll") {
    return "oll";
  }
  if (id === "pll") {
    return "pll";
  }
  return "f2l";
}

export function SolveReviewPage({
  review,
  onBack,
}: {
  review: SolveReview;
  onBack: () => void;
}) {
  const { overview, phases, scramble } = review;
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  function togglePhase(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div
      className="solve-review"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solve-review-title"
    >
      <header className="solve-review-topbar">
        <button
          type="button"
          className="solve-review-back"
          aria-label="返回"
          title="返回"
          onClick={onBack}
        >
          <svg
            className="solve-review-back-svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"
            />
          </svg>
        </button>
        <p id="solve-review-title" className="solve-review-eyebrow">
          成绩复盘
        </p>
        <span className="solve-review-topbar-spacer" aria-hidden="true" />
      </header>

      <div className="solve-review-body">
        <p className="solve-review-time">{formatElapsed(overview.timeMs)}</p>

        <section className="solve-review-section" aria-label="总览">
          <h2 className="solve-review-section-title">总览</h2>
          <dl className="solve-review-overview">
            <div>
              <dt>步数</dt>
              <dd>{overview.moves}</dd>
            </div>
            <div>
              <dt>TPS</dt>
              <dd>{formatTps(overview.tps)}</dd>
            </div>
            <div>
              <dt>转体</dt>
              <dd>{overview.rotations}</dd>
            </div>
            <div>
              <dt>停顿率</dt>
              <dd>{formatPauseRate(overview.pauseRate)}</dd>
            </div>
          </dl>
        </section>

        <section className="solve-review-section" aria-label="分段">
          <h2 className="solve-review-section-title">分段</h2>
          <ul className="solve-review-phases">
            {phases.map((phase) => {
              const open = openIds.has(phase.id);
              const tone = phaseTone(phase.id);
              const algText = phase.alg.trim() === "" ? "—" : phase.alg;
              const stats = `${formatElapsed(phase.timeMs)} · ${phase.moves} 步`;
              return (
                <li
                  key={phase.id}
                  className={`solve-review-phase solve-review-phase-${tone}`}
                >
                  <button
                    type="button"
                    className="solve-review-phase-toggle solve-review-phase-narrow"
                    aria-expanded={open}
                    onClick={() => togglePhase(phase.id)}
                  >
                    <span className="solve-review-phase-label">
                      {phase.label}
                    </span>
                    <span className="solve-review-phase-stats">{stats}</span>
                    <span
                      className="solve-review-phase-chevron"
                      aria-hidden="true"
                    >
                      {open ? "▾" : "▸"}
                    </span>
                  </button>
                  {open ? (
                    <p className="solve-review-phase-alg solve-review-phase-alg-narrow">
                      {algText}
                    </p>
                  ) : null}

                  <div className="solve-review-phase-wide">
                    <span className="solve-review-phase-label">
                      {phase.label}
                    </span>
                    <span className="solve-review-phase-stats">{stats}</span>
                    <p className="solve-review-phase-alg">{algText}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="solve-review-section" aria-label="打乱公式">
          <h2 className="solve-review-section-title">打乱公式</h2>
          <p className="solve-review-scramble">
            {scramble.trim() === "" ? "—" : scramble}
          </p>
        </section>
      </div>
    </div>
  );
}
