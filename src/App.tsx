import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import formulas from "./data/formula-catalog.json";
import { parseFormulaCatalog } from "./data/catalog.ts";
import { CubeView, type CubeHandle } from "./modules/cube/CubeView.tsx";
import { parseFormulaLibrary } from "./modules/formula/formulas.ts";
import type { Formula } from "./modules/formula/types.ts";
import { formulaGroup } from "./modules/practice/browser.ts";
import {
  defaultPracticeFormula,
  toPickerFormula,
} from "./modules/practice/formulaPicker.ts";
import {
  browserDefaultAlgorithmStorage,
  createDefaultAlgorithmPrefs,
} from "./modules/practice/defaultAlgorithm.ts";
import { PracticeControls } from "./modules/practice/PracticeControls.tsx";
import { PracticeFormulaPicker } from "./modules/practice/PracticeFormulaPicker.tsx";
import { PracticeHint } from "./modules/practice/PracticeHint.tsx";
import {
  PLAYBACK_STEP_MS,
  atStart,
  atTarget,
  createPracticeCursor,
  displayedMoves,
  isAtTarget,
  stepNext,
  stepPrevious,
  type PracticeCursor,
} from "./modules/practice/playback.ts";
import {
  back,
  showPractice,
  showTiming,
  type Focus,
} from "./modules/practice/focus.ts";
import { switchMode } from "./modules/practice/mode.ts";
import { modeSwitchPresentation } from "./modules/practice/practiceLayout.ts";
import {
  formulaAlgorithms,
  practiceCase,
  type PracticeCase,
} from "./modules/practice/setup.ts";
import { practiceStickering } from "./modules/practice/stickering.ts";
import { browserScoreStorage, createScoreLog } from "./modules/score/score.ts";
import { ScrambleNet } from "./modules/scramble/ScrambleNet.tsx";
import { ScramblePanel } from "./modules/scramble/ScramblePanel.tsx";
import { randomScramble3x3 } from "./modules/scramble/scramble.ts";
import {
  createPendingSolve,
  resolveResultConfirm,
  type PendingSolve,
} from "./modules/timer/resultConfirm.ts";
import { ResultConfirmDialog } from "./modules/timer/ResultConfirmDialog.tsx";
import {
  isTimingChromeHidden,
  isTimingPointerOnControl,
  keepElapsedOnScrambleRefresh,
  nextCubePreviewMode,
  releaseTimingFocus,
  showCubeLayerControls,
  timingPreviewExclusive,
  timingShellVisible,
  type CubePreviewMode,
  type SessionPhase,
} from "./modules/timer/session.ts";
import { TimerStats } from "./modules/timer/TimerStats.tsx";
import { TimerView, type TimerHandle } from "./modules/timer/TimerView.tsx";
import "./app.css";

const formulaLibrary = parseFormulaLibrary(formulas);
const formulaCatalog = parseFormulaCatalog(formulas);

function modeOf(focus: Focus) {
  return focus.kind === "计时" ? "打乱计时" : "公式练习";
}

export default function App() {
  const cube = useRef<CubeHandle>(null);
  const timer = useRef<TimerHandle>(null);
  const focusRef = useRef<Focus>({ kind: "计时" });
  const scoreLog = useMemo(() => createScoreLog(browserScoreStorage()), []);
  const defaultAlgPrefs = useMemo(
    () => createDefaultAlgorithmPrefs(browserDefaultAlgorithmStorage()),
    [],
  );
  const [scoreRevision, setScoreRevision] = useState(0);
  const [defaultAlgRevision, setDefaultAlgRevision] = useState(0);
  const [scrambleMoves, setScrambleMoves] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<CubePreviewMode>("cube");
  const [timerPhase, setTimerPhase] = useState<SessionPhase>("idle");
  const timerPhaseRef = useRef<SessionPhase>("idle");
  timerPhaseRef.current = timerPhase;
  const [pendingResult, setPendingResult] = useState<PendingSolve | null>(null);
  const [focus, setFocus] = useState<Focus>({ kind: "计时" });
  const [practice, setPractice] = useState<PracticeCase | null>(null);
  const [practiceNote, setPracticeNote] = useState<string | null>(null);
  const [algorithmIndex, setAlgorithmIndex] = useState(0);
  const [practiceFormulaId, setPracticeFormulaId] = useState<string | null>(
    null,
  );
  const [cursor, setCursor] = useState<PracticeCursor | null>(null);
  const [playing, setPlaying] = useState(false);
  const [f2lSimplified, setF2lSimplified] = useState(true);
  const cursorRef = useRef<PracticeCursor | null>(null);
  const playingRef = useRef(false);
  const playRun = useRef(0);
  focusRef.current = focus;

  const mode = modeOf(focus);
  const methodId = focus.kind === "练习" ? focus.methodId : null;
  const showCube = focus.kind === "计时" || focus.kind === "练习";
  const showScrambleTimer = focus.kind === "计时";
  const practiceGroup =
    methodId && practiceFormulaId
      ? formulaGroup(formulaLibrary, methodId, practiceFormulaId)
      : null;
  const practiceFormula =
    practiceGroup?.formulas.find(
      (formula) => formula.id === practiceFormulaId,
    ) ?? null;
  const algorithms = practiceFormula ? formulaAlgorithms(practiceFormula) : [];
  const preferredAlgorithmIndex = useMemo(() => {
    if (!practiceFormulaId || algorithms.length === 0) {
      return 0;
    }
    return defaultAlgPrefs.get(practiceFormulaId, algorithms.length);
  }, [
    practiceFormulaId,
    algorithms.length,
    defaultAlgPrefs,
    defaultAlgRevision,
  ]);
  const scoreSummary = useMemo(
    () => scoreLog.summary(),
    [scoreLog, scoreRevision],
  );

  function stopPlay() {
    playRun.current += 1;
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
    }
  }

  function showCursor(next: PracticeCursor) {
    cursorRef.current = next;
    setCursor(next);
    cube.current?.cancelAnimation();
    void cube.current?.showMoves(displayedMoves(next));
  }

  function moveCursor(
    update: (current: PracticeCursor) => PracticeCursor,
    motion: "snap" | "forward" | "back",
  ) {
    stopPlay();
    const current = cursorRef.current;
    if (!current) {
      return;
    }
    const next = update(current);
    if (motion === "snap" || next.index === current.index) {
      showCursor(next);
      return;
    }
    cursorRef.current = next;
    setCursor(next);
    cube.current?.cancelAnimation();
    void cube.current?.animateMove(
      displayedMoves(current),
      displayedMoves(next),
      motion,
      PLAYBACK_STEP_MS,
    );
  }

  useEffect(() => {
    stopPlay();
    if (!practice) {
      cursorRef.current = null;
      setCursor(null);
      return;
    }
    const next = createPracticeCursor(practice);
    cursorRef.current = next;
    setCursor(next);
  }, [practice]);

  useEffect(() => {
    if (focus.kind !== "练习") {
      stopPlay();
      const current = cursorRef.current;
      cube.current?.cancelAnimation();
      if (current) {
        void cube.current?.showMoves(displayedMoves(current));
      }
    }
  }, [focus]);

  useEffect(() => {
    const id = focus.kind === "练习" ? practice?.id : null;
    cube.current?.setStickering(practiceStickering(id, f2lSimplified));
  }, [focus.kind, practice?.id, f2lSimplified]);

  // Entering practice with no selection defaults to the first F2L formula.
  useEffect(() => {
    if (focus.kind !== "练习" || practiceFormulaId) {
      return;
    }
    const first = defaultPracticeFormula(formulaCatalog);
    if (!first) {
      return;
    }
    const formula = toPickerFormula(first);
    stopPlay();
    cube.current?.cancelAnimation();
    setPracticeFormulaId(formula.id);
    setAlgorithmIndex(0);
    const setup = practiceCase(formula);
    if (!setup) {
      setPractice(null);
      setPracticeNote(`${formula.name} 还不能练习。`);
      return;
    }
    setPracticeNote(null);
    setPractice(setup);
    cube.current?.showMoves(setup.inverse);
  }, [focus.kind, practiceFormulaId]);

  useEffect(
    () => () => {
      playRun.current += 1;
    },
    [],
  );

  async function onPlay() {
    if (playingRef.current) {
      stopPlay();
      return;
    }
    let current = cursorRef.current;
    if (!current) {
      return;
    }
    const run = playRun.current;
    try {
      if (isAtTarget(current)) {
        const start = atStart(current);
        cursorRef.current = start;
        setCursor(start);
        cube.current?.cancelAnimation();
        await cube.current?.showMoves(displayedMoves(start));
        if (playRun.current !== run) {
          return;
        }
        current = start;
      }
      playingRef.current = true;
      setPlaying(true);
      while (playRun.current === run && !isAtTarget(current)) {
        const next = stepNext(current);
        cursorRef.current = next;
        setCursor(next);
        await cube.current?.animateMove(
          displayedMoves(current),
          displayedMoves(next),
          "forward",
          PLAYBACK_STEP_MS,
        );
        if (playRun.current !== run) {
          return;
        }
        current = next;
      }
    } finally {
      if (playRun.current === run && playingRef.current) {
        playingRef.current = false;
        setPlaying(false);
      }
    }
  }

  function onFormula(formula: Formula) {
    if (focus.kind !== "练习") {
      return;
    }
    stopPlay();
    cube.current?.cancelAnimation();
    setPracticeFormulaId(formula.id);
    const algs = formulaAlgorithms(formula);
    const index = defaultAlgPrefs.get(formula.id, algs.length);
    setAlgorithmIndex(index);
    const setup = practiceCase(formula, index);
    if (!setup) {
      setPractice(null);
      setPracticeNote(`${formula.name} 还不能练习。`);
      return;
    }
    setPracticeNote(null);
    setPractice(setup);
    cube.current?.showMoves(setup.inverse);
  }

  function onAlgorithm(index: number) {
    const formula = practiceGroup?.formulas.find(
      (item) => item.id === practiceFormulaId,
    );
    if (!formula) {
      return;
    }
    const setup = practiceCase(formula, index);
    if (!setup) {
      return;
    }
    stopPlay();
    cube.current?.cancelAnimation();
    setAlgorithmIndex(index);
    setPractice(setup);
    cube.current?.showMoves(setup.inverse);
  }

  function onSetDefaultAlgorithm() {
    if (!practiceFormulaId || algorithms.length < 2) {
      return;
    }
    defaultAlgPrefs.set(practiceFormulaId, algorithmIndex, algorithms.length);
    setDefaultAlgRevision((current) => current + 1);
  }

  function applyScramble(moves: string, resetTimer: boolean) {
    cube.current?.setAlgorithm(moves);
    setScrambleMoves(moves);
    if (resetTimer) {
      timer.current?.prepare();
      setTimerPhase("idle");
      timerPhaseRef.current = "idle";
    }
  }

  function refreshScramble(resetTimer = true) {
    applyScramble(randomScramble3x3().moves, resetTimer);
  }

  function onTimerPhase(phase: SessionPhase) {
    timerPhaseRef.current = phase;
    setTimerPhase(phase);
  }

  useEffect(() => {
    if (focus.kind !== "计时") {
      return;
    }
    if (!scrambleMoves) {
      refreshScramble();
      return;
    }
    // Re-apply after CubeView remount (e.g. back from practice).
    cube.current?.setAlgorithm(scrambleMoves);
  }, [focus.kind, scrambleMoves]);

  function onMode(event: MouseEvent<HTMLButtonElement>) {
    const next = switchMode(mode).mode;
    setFocus(next === "公式练习" ? showPractice() : showTiming());
    event.currentTarget.blur();
  }

  function onBack(event: MouseEvent<HTMLButtonElement>) {
    setFocus((current) => back(current));
    event.currentTarget.blur();
  }

  function onTimerStop(timeMs: number) {
    const kind = focusRef.current.kind;
    if (kind !== "计时" || !scrambleMoves) {
      return;
    }
    // Ask keep/discard before recording or refreshing scramble.
    setPendingResult(createPendingSolve({ timeMs, scramble: scrambleMoves }));
  }

  function settlePendingResult(choice: "keep" | "discard") {
    if (!pendingResult) {
      return;
    }
    const decision = resolveResultConfirm(pendingResult, choice);
    if (decision.shouldRecord) {
      scoreLog.record({
        timeMs: decision.timeMs,
        scramble: decision.scramble,
      });
      setScoreRevision((current) => current + 1);
    }
    setPendingResult(null);
    // Keep the stopped time on screen; only refresh scramble / cube / net.
    refreshScramble(!keepElapsedOnScrambleRefresh(timerPhaseRef.current));
  }

  const timingHoldRef = useRef(false);

  function onTimingPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (focus.kind !== "计时" || event.button !== 0 || pendingResult) {
      return;
    }
    if (isTimingPointerOnControl(event.target)) {
      return;
    }
    event.preventDefault();
    timingHoldRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    timer.current?.pressDown();
  }

  function onTimingPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (focus.kind !== "计时") {
      return;
    }
    if (!timingHoldRef.current) {
      return;
    }
    timingHoldRef.current = false;
    timer.current?.pressUp();
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* already released */
    }
  }

  function onTimingPointerCancel() {
    if (focus.kind !== "计时") {
      return;
    }
    if (!timingHoldRef.current) {
      return;
    }
    timingHoldRef.current = false;
    timer.current?.pressCancel();
  }

  const timingRunning =
    focus.kind === "计时" && isTimingChromeHidden(timerPhase);
  const preview = timingPreviewExclusive(previewMode);
  const showTimingHome = focus.kind === "计时" && !timingRunning;
  const modeEntry = modeSwitchPresentation(mode);

  return (
    <div className="app">
      {pendingResult ? (
        <ResultConfirmDialog
          timeMs={pendingResult.timeMs}
          onKeep={() => settlePendingResult("keep")}
          onDiscard={() => settlePendingResult("discard")}
        />
      ) : null}
      <header
        className="topbar"
        hidden={
          focus.kind === "计时"
            ? !timingShellVisible(timerPhase, "topbar")
            : false
        }
      >
        {focus.kind === "练习" ? (
          <button
            type="button"
            className="nav-back nav-back-icon"
            aria-label="返回"
            title="返回"
            onClick={onBack}
          >
            <svg
              className="nav-back-svg"
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
        ) : (
          <button
            type="button"
            className={
              modeEntry.kind === "icon"
                ? "mode-switch mode-switch-practice"
                : "mode-switch"
            }
            aria-label={modeEntry.ariaLabel}
            title={modeEntry.ariaLabel}
            onClick={onMode}
          >
            {modeEntry.kind === "icon" ? (
              <svg
                className="mode-switch-icon"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2a8 8 0 1 1-8 8 8 8 0 0 1 8-8zm0 3a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 2a3 3 0 1 1-3 3 3 3 0 0 1 3-3zm0 2a1 1 0 1 0 1 1 1 1 0 0 0-1-1z"
                />
              </svg>
            ) : (
              <span className="mode-switch-label">{modeEntry.text}</span>
            )}
          </button>
        )}
      </header>
      <main
        className="focus"
        data-focus={focus.kind}
        data-timer-phase={focus.kind === "计时" ? timerPhase : undefined}
        data-preview={showTimingHome ? previewMode : undefined}
        onPointerDown={focus.kind === "计时" ? onTimingPointerDown : undefined}
        onPointerUp={focus.kind === "计时" ? onTimingPointerUp : undefined}
        onPointerCancel={
          focus.kind === "计时" ? onTimingPointerCancel : undefined
        }
      >
        <div
          className="slot-scramble"
          hidden={
            focus.kind !== "计时" || !timingShellVisible(timerPhase, "scramble")
          }
        >
          <ScramblePanel moves={scrambleMoves} onRescramble={refreshScramble} />
        </div>
        <div
          className="slot-cube"
          hidden={
            focus.kind === "计时"
              ? !timingShellVisible(timerPhase, "preview")
              : !showCube
          }
        >
          {focus.kind === "计时" ? (
            <>
              <div
                className="preview-stage"
                data-preview="cube"
                hidden={!preview.showCube}
              >
                <CubeView
                  ref={cube}
                  showLayerControls={showCubeLayerControls(focus.kind)}
                  viewOrientation="scramble"
                />
              </div>
              <div
                className="preview-stage preview-net"
                data-preview="net"
                hidden={!preview.showNet || !scrambleMoves}
              >
                {scrambleMoves ? <ScrambleNet moves={scrambleMoves} /> : null}
              </div>
              <button
                type="button"
                className="preview-toggle"
                aria-label={
                  previewMode === "cube" ? "切换到平面图" : "切换到 3D 魔方"
                }
                onClick={(event) => {
                  setPreviewMode((mode) => nextCubePreviewMode(mode));
                  releaseTimingFocus(event.currentTarget);
                }}
              >
                {previewMode === "cube" ? "平面图" : "3D"}
              </button>
            </>
          ) : (
            <CubeView ref={cube} showLayerControls={false} />
          )}
        </div>
        <div
          className="slot-tools"
          hidden={
            focus.kind !== "计时" || !timingShellVisible(timerPhase, "timer")
          }
        >
          {showScrambleTimer ? (
            <>
              <TimerView
                ref={timer}
                onStop={onTimerStop}
                onPhaseChange={onTimerPhase}
                showControls={false}
                showChrome={false}
                inputEnabled={!pendingResult}
              />
              {showTimingHome ? <TimerStats summary={scoreSummary} /> : null}
            </>
          ) : null}
        </div>
        <div className="slot-session" hidden={focus.kind !== "练习"}>
          <div className="practice-rail">
            <PracticeFormulaPicker
              methods={formulaCatalog}
              selectedId={practice?.id ?? null}
              onSelect={onFormula}
            />
          </div>
          <PracticeHint
            practice={practice}
            note={practiceNote}
            cursor={cursor}
            algorithms={algorithms}
            algorithmIndex={algorithmIndex}
            preferredAlgorithmIndex={preferredAlgorithmIndex}
            onAlgorithm={onAlgorithm}
            onSetDefaultAlgorithm={onSetDefaultAlgorithm}
            f2lSimplified={f2lSimplified}
            onF2lSimplified={setF2lSimplified}
          />
          {focus.kind === "练习" && practice && cursor ? (
            <PracticeControls
              atStart={cursor.index === 0}
              atTarget={isAtTarget(cursor)}
              playing={playing}
              onStart={() => moveCursor(atStart, "snap")}
              onPrevious={() => moveCursor(stepPrevious, "back")}
              onPlay={() => void onPlay()}
              onNext={() => moveCursor(stepNext, "forward")}
              onTarget={() => moveCursor(atTarget, "snap")}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
