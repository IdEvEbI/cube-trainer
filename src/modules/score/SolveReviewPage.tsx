import { useEffect, useMemo, useRef, useState } from "react";
import { IDENTITY_QUAT } from "../bluetooth/moyu/orientation.ts";
import { CubeView, type CubeHandle } from "../cube/CubeView.tsx";
import { PracticeControls } from "../practice/PracticeControls.tsx";
import { formatElapsed } from "../timer/timer.ts";
import { formatPauseRate, formatTps } from "./bluetoothSolveStats.ts";
import { quatFromOrientationAlg } from "./cubeOrientation.ts";
import type { SolveReview } from "./solveReview.ts";
import {
  buildSolveReviewSegmentRanges,
  createSolveReviewCursor,
  isSolveReviewAtEnd,
  isSolveReviewAtStart,
  nextSolveReviewPlayRange,
  SOLVE_REVIEW_PLAYBACK_STEP_MS,
  solveReviewActiveSegmentId,
  solveReviewAtEnd,
  solveReviewAtIndex,
  solveReviewCubeAlg,
  solveReviewOrientationAlg,
  solveReviewPhaseProgress,
  solveReviewStepNext,
  solveReviewStepPrevious,
  type SolveReviewCursor,
  type SolveReviewSegmentId,
  type SolveReviewSegmentRange,
} from "./solveReviewPlayback.ts";
import "./solveReview.css";
import "../practice/practice.css";

function orientationQuat(alg: string) {
  return alg ? quatFromOrientationAlg(alg) : IDENTITY_QUAT;
}

function phaseTone(
  id: SolveReviewSegmentId,
): "scramble" | "cross" | "f2l" | "oll" | "pll" {
  if (id === "scramble") {
    return "scramble";
  }
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

function progressLabel(
  cursor: SolveReviewCursor,
  ranges: readonly SolveReviewSegmentRange[],
  focusId: SolveReviewSegmentId | null,
) {
  const activeId = focusId ?? solveReviewActiveSegmentId(ranges, cursor.index);
  const range = ranges.find((item) => item.id === activeId);
  if (!range || range.end <= range.start) {
    const progress = solveReviewPhaseProgress(cursor);
    const phaseLabel = progress.phase === "scramble" ? "打乱" : "还原";
    return `${phaseLabel} ${progress.current}/${progress.total}`;
  }
  const local = Math.min(
    range.end - range.start,
    Math.max(0, cursor.index - range.start),
  );
  return `${range.label} ${local}/${Math.max(range.end - range.start, 1)}`;
}

function applyCursorToCube(
  handle: CubeHandle | null,
  cursor: SolveReviewCursor,
) {
  if (!handle) {
    return;
  }
  handle.setOrientation(orientationQuat(solveReviewOrientationAlg(cursor)));
  void handle.showMoves(solveReviewCubeAlg(cursor));
}

export function SolveReviewPage({
  review,
  onBack,
  onRetrySameScramble,
}: {
  review: SolveReview;
  onBack: () => void;
  onRetrySameScramble: () => void;
}) {
  const { overview, phases, scramble } = review;
  const cube = useRef<CubeHandle | null>(null);
  const focusSegmentIdRef = useRef<SolveReviewSegmentId | null>(null);
  const phaseSpans = useMemo(
    () =>
      phases.map((phase) => ({
        startIndex: phase.startIndex,
        endIndex: phase.endIndex,
      })),
    [phases],
  );

  const [cursor, setCursor] = useState<SolveReviewCursor>(() =>
    createSolveReviewCursor(review.trace, phaseSpans),
  );
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const playRun = useRef(0);
  const motionGen = useRef(0);
  const [focusSegmentId, setFocusSegmentId] =
    useState<SolveReviewSegmentId | null>(null);
  focusSegmentIdRef.current = focusSegmentId;

  const segmentRanges = useMemo(
    () => buildSolveReviewSegmentRanges(review.trace, phases),
    [review.trace, phases],
  );

  const segmentById = useMemo(() => {
    const map = new Map<SolveReviewSegmentId, SolveReviewSegmentRange>();
    for (const range of segmentRanges) {
      map.set(range.id, range);
    }
    return map;
  }, [segmentRanges]);

  useEffect(() => {
    const next = createSolveReviewCursor(review.trace, phaseSpans);
    playRun.current += 1;
    motionGen.current += 1;
    playingRef.current = false;
    setPlaying(false);
    focusSegmentIdRef.current = null;
    setFocusSegmentId(null);
    cursorRef.current = next;
    setCursor(next);
    cube.current?.cancelAnimation();
    applyCursorToCube(cube.current, next);
  }, [review.trace, phaseSpans]);

  function stopPlay() {
    playRun.current += 1;
    motionGen.current += 1;
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      cube.current?.cancelAnimation();
      applyCursorToCube(cube.current, cursorRef.current);
    }
  }

  function showCursor(next: SolveReviewCursor) {
    motionGen.current += 1;
    cursorRef.current = next;
    setCursor(next);
    cube.current?.cancelAnimation();
    applyCursorToCube(cube.current, next);
  }

  async function animateTo(
    current: SolveReviewCursor,
    next: SolveReviewCursor,
    motion: "forward" | "back",
    motionId: number,
  ) {
    const beforeAlg = solveReviewCubeAlg(current);
    const afterAlg = solveReviewCubeAlg(next);
    const beforeOri = orientationQuat(solveReviewOrientationAlg(current));
    const afterOri = orientationQuat(solveReviewOrientationAlg(next));
    if (beforeAlg === afterAlg) {
      await cube.current?.animateOrientation(
        beforeOri,
        afterOri,
        SOLVE_REVIEW_PLAYBACK_STEP_MS,
      );
      return motionGen.current === motionId;
    }
    await cube.current?.animateMove(
      beforeAlg,
      afterAlg,
      motion,
      SOLVE_REVIEW_PLAYBACK_STEP_MS,
    );
    if (motionGen.current !== motionId) {
      return false;
    }
    cube.current?.setOrientation(afterOri);
    return true;
  }

  function moveCursor(
    update: (current: SolveReviewCursor) => SolveReviewCursor,
    motion: "snap" | "forward" | "back",
  ) {
    stopPlay();
    setFocusSegmentId(null);
    const current = cursorRef.current;
    const next = update(current);
    if (motion === "snap" || next.index === current.index) {
      showCursor(next);
      return;
    }
    if (motion === "back") {
      cursorRef.current = next;
      setCursor(next);
    }
    const motionId = ++motionGen.current;
    cube.current?.cancelAnimation();
    void animateTo(current, next, motion, motionId).then((ok) => {
      if (!ok) {
        return;
      }
      if (motion === "forward") {
        cursorRef.current = next;
        setCursor(next);
      }
    });
  }

  async function playForwardUntil(
    stopExclusive: number,
    run: number,
  ): Promise<SolveReviewCursor | null> {
    let current = cursorRef.current;
    const limit = Math.min(stopExclusive, current.steps.length);
    while (playRun.current === run && current.index < limit) {
      const next = solveReviewStepNext(current);
      const motionId = ++motionGen.current;
      const ok = await animateTo(current, next, "forward", motionId);
      if (playRun.current !== run || !ok) {
        return null;
      }
      current = next;
      cursorRef.current = next;
      setCursor(next);
    }
    return current;
  }

  async function onPlay() {
    if (playingRef.current) {
      stopPlay();
      return;
    }
    let current = cursorRef.current;
    const run = playRun.current;
    const plan = nextSolveReviewPlayRange(
      segmentRanges,
      focusSegmentIdRef.current,
      current.index,
      current.steps.length,
    );
    setFocusSegmentId(plan.focusId);
    focusSegmentIdRef.current = plan.focusId;
    try {
      if (current.index !== plan.resumeAt) {
        const start = solveReviewAtIndex(current, plan.resumeAt);
        cursorRef.current = start;
        setCursor(start);
        cube.current?.cancelAnimation();
        applyCursorToCube(cube.current, start);
        if (playRun.current !== run) {
          return;
        }
        current = start;
      }
      playingRef.current = true;
      setPlaying(true);
      await playForwardUntil(plan.end, run);
    } finally {
      if (playRun.current === run && playingRef.current) {
        playingRef.current = false;
        setPlaying(false);
      }
    }
  }

  /**
   * 点击分段：无动画跳到该段起点（前面公式瞬切完成），等待播放该段。
   */
  function onSegmentJump(segmentId: SolveReviewSegmentId) {
    const range = segmentById.get(segmentId);
    if (!range) {
      return;
    }
    stopPlay();
    const base = createSolveReviewCursor(review.trace, phaseSpans);
    focusSegmentIdRef.current = segmentId;
    setFocusSegmentId(segmentId);
    showCursor(solveReviewAtIndex(base, range.start));
  }

  const activeSegmentId =
    focusSegmentId ?? solveReviewActiveSegmentId(segmentRanges, cursor.index);

  const scrambleRange = segmentById.get("scramble");

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
          onClick={() => {
            stopPlay();
            onBack();
          }}
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

        <div className="solve-review-main">
          <div className="solve-review-formulas">
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
              <p className="solve-review-segment-hint">
                点击分段瞬切到起点；播放只播当前段，播完再点则播下一段
              </p>
              <ul className="solve-review-phases">
                {scrambleRange ? (
                  <li
                    className={`solve-review-phase solve-review-phase-scramble${
                      activeSegmentId === "scramble"
                        ? " solve-review-phase-active"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="solve-review-phase-play solve-review-phase-scramble-play"
                      aria-current={
                        activeSegmentId === "scramble" ? "true" : undefined
                      }
                      onClick={() => onSegmentJump("scramble")}
                    >
                      <span className="solve-review-phase-label">打乱</span>
                      <span className="solve-review-phase-stats">
                        {Math.max(scrambleRange.end - scrambleRange.start, 0)}{" "}
                        步
                      </span>
                      <p className="solve-review-phase-alg">
                        {scramble.trim() === "" ? "—" : scramble}
                      </p>
                    </button>
                  </li>
                ) : null}
                {phases.map((phase) => {
                  const tone = phaseTone(phase.id);
                  const algText = phase.alg.trim() === "" ? "—" : phase.alg;
                  const stats = `${formatElapsed(phase.timeMs)} · ${phase.moves} 步`;
                  const active = activeSegmentId === phase.id;
                  return (
                    <li
                      key={phase.id}
                      className={`solve-review-phase solve-review-phase-${tone}${
                        active ? " solve-review-phase-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="solve-review-phase-play solve-review-phase-narrow-play"
                        aria-current={active ? "true" : undefined}
                        onClick={() => onSegmentJump(phase.id)}
                      >
                        <span className="solve-review-phase-label">
                          {phase.label}
                        </span>
                        <span className="solve-review-phase-stats">
                          {stats}
                        </span>
                        <p className="solve-review-phase-alg">{algText}</p>
                      </button>

                      <button
                        type="button"
                        className="solve-review-phase-wide solve-review-phase-play"
                        aria-current={active ? "true" : undefined}
                        onClick={() => onSegmentJump(phase.id)}
                      >
                        <span className="solve-review-phase-label">
                          {phase.label}
                        </span>
                        <span className="solve-review-phase-stats">
                          {stats}
                        </span>
                        <p className="solve-review-phase-alg">{algText}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className="solve-review-playback" aria-label="回放">
            <h2 className="solve-review-section-title">回放</h2>
            <div className="solve-review-playback-body">
              <p className="solve-review-playback-progress" aria-live="polite">
                {progressLabel(cursor, segmentRanges, focusSegmentId)}
              </p>
              <div className="solve-review-cube">
                <CubeView
                  ref={cube}
                  showLayerControls={false}
                  viewOrientation="scramble"
                />
              </div>
              <div className="solve-review-playback-bar">
                <PracticeControls
                  atStart={isSolveReviewAtStart(cursor)}
                  atTarget={isSolveReviewAtEnd(cursor)}
                  playing={playing}
                  onStart={() => {
                    stopPlay();
                    focusSegmentIdRef.current = null;
                    setFocusSegmentId(null);
                    showCursor(
                      createSolveReviewCursor(review.trace, phaseSpans),
                    );
                  }}
                  onPrevious={() => moveCursor(solveReviewStepPrevious, "back")}
                  onPlay={() => void onPlay()}
                  onNext={() => moveCursor(solveReviewStepNext, "forward")}
                  onTarget={() => {
                    stopPlay();
                    focusSegmentIdRef.current = null;
                    setFocusSegmentId(null);
                    const fresh = createSolveReviewCursor(
                      review.trace,
                      phaseSpans,
                    );
                    showCursor(solveReviewAtEnd(fresh));
                  }}
                />
                <button
                  type="button"
                  className="solve-review-retry"
                  aria-label="再练一次"
                  title="再练一次"
                  onClick={() => {
                    stopPlay();
                    onRetrySameScramble();
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
