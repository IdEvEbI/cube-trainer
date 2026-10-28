import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
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
import {
  applyGuidedMove,
  createGuidedScramble,
  guidedScrambleView,
  type GuidedScramble,
  type GuidedScrambleView,
} from "./modules/scramble/guided.ts";
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
import {
  connectMoyuCube,
  formatMoyuConnectError,
  formatMoyuConnectedLabel,
  MOYU_REST_ORBIT,
  MoyuOrientationTracker,
  type MoyuBleConnection,
  type MoyuMoveSample,
  type MoyuQuat,
} from "./modules/bluetooth/moyu/index.ts";
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
  const scrambleMovesRef = useRef<string | null>(null);
  scrambleMovesRef.current = scrambleMoves;
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
  const [moyuSession, setMoyuSession] = useState<MoyuBleConnection | null>(
    null,
  );
  const [moyuBusy, setMoyuBusy] = useState(false);
  const [moyuNote, setMoyuNote] = useState<string | null>(null);
  const [scrambleGuide, setScrambleGuide] = useState<GuidedScrambleView | null>(
    null,
  );
  const moyuSessionRef = useRef<MoyuBleConnection | null>(null);
  moyuSessionRef.current = moyuSession;
  const scrambleGuideRef = useRef<GuidedScramble | null>(null);
  const moyuOrientation = useRef(new MoyuOrientationTracker());
  const moyuOrbitRaf = useRef(0);
  const moyuPendingQuat = useRef<MoyuQuat | null>(null);
  const cursorRef = useRef<PracticeCursor | null>(null);
  const playingRef = useRef(false);
  const playRun = useRef(0);
  focusRef.current = focus;

  useEffect(() => {
    return () => {
      moyuSessionRef.current?.disconnect();
    };
  }, []);

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

  function syncScrambleGuide(moves: string | null, connected: boolean) {
    if (!connected || !moves) {
      scrambleGuideRef.current = null;
      setScrambleGuide(null);
      return;
    }
    try {
      const guide = createGuidedScramble(moves);
      scrambleGuideRef.current = guide;
      setScrambleGuide(guidedScrambleView(guide));
    } catch {
      scrambleGuideRef.current = null;
      setScrambleGuide(null);
    }
  }

  function applyBluetoothGuideMoves(samples: readonly MoyuMoveSample[]) {
    if (focusRef.current.kind !== "计时") {
      return;
    }
    let guide: GuidedScramble | null = scrambleGuideRef.current;
    if (!guide) {
      const moves = scrambleMovesRef.current;
      if (!moves || !moyuSessionRef.current) {
        return;
      }
      try {
        guide = createGuidedScramble(moves);
        scrambleGuideRef.current = guide;
      } catch {
        return;
      }
    }
    if (guide.phase === "done") {
      return;
    }
    try {
      let next: GuidedScramble = guide;
      for (const sample of samples) {
        const result = applyGuidedMove(next, sample.move);
        next = result.guide;
        if (next.phase === "done") {
          break;
        }
      }
      scrambleGuideRef.current = next;
      // GATT 异步回调里强制同步刷新，避免部分 WebKit / Bluefy 丢更新。
      flushSync(() => {
        setScrambleGuide(guidedScrambleView(next));
      });
    } catch {
      // 单步解析失败时不打断跟转动画
    }
  }

  const applyBluetoothGuideMovesRef = useRef(applyBluetoothGuideMoves);
  applyBluetoothGuideMovesRef.current = applyBluetoothGuideMoves;

  function applyScramble(moves: string, resetTimer: boolean) {
    // 蓝牙跟随实体状态时，不把打乱目标写回 3D。
    if (!moyuSessionRef.current) {
      cube.current?.setAlgorithm(moves);
    }
    setScrambleMoves(moves);
    syncScrambleGuide(moves, Boolean(moyuSessionRef.current));
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
    // 蓝牙连接中由实体状态驱动，跳过目标打乱写回。
    if (!moyuSessionRef.current) {
      cube.current?.setAlgorithm(scrambleMoves);
    }
  }, [focus.kind, scrambleMoves]);

  // 蓝牙引导：立体魔方旋转箭头（仅计时 + 已连接）
  useEffect(() => {
    if (focus.kind !== "计时" || !moyuSession || !scrambleGuide) {
      cube.current?.setMoveHint(null);
      return;
    }
    if (scrambleGuide.correction) {
      cube.current?.setMoveHint(scrambleGuide.correction, { tone: "error" });
      return;
    }
    if (scrambleGuide.done || !scrambleGuide.expectedMove) {
      cube.current?.setMoveHint(null);
      return;
    }
    cube.current?.setMoveHint(scrambleGuide.expectedMove, {
      tone: "guide",
      double: scrambleGuide.currentIsDouble,
      half: scrambleGuide.partial,
    });
  }, [focus.kind, moyuSession, scrambleGuide]);

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

  function flushMoyuOrientation() {
    moyuOrbitRaf.current = 0;
    const quat = moyuPendingQuat.current;
    if (!quat) {
      return;
    }
    cube.current?.setOrientation(moyuOrientation.current.toOrientation(quat));
  }

  function onMoyuOrientation(quat: MoyuQuat) {
    moyuPendingQuat.current = quat;
    if (moyuOrbitRaf.current) {
      return;
    }
    moyuOrbitRaf.current = requestAnimationFrame(flushMoyuOrientation);
  }

  function resetMoyuOrientationFollow() {
    if (moyuOrbitRaf.current) {
      cancelAnimationFrame(moyuOrbitRaf.current);
      moyuOrbitRaf.current = 0;
    }
    moyuPendingQuat.current = null;
    moyuOrientation.current.reset();
  }

  function onMoyuAlignOrientation() {
    try {
      const orientation = moyuOrientation.current.alignToCurrent();
      cube.current?.setOrientation(orientation);
      cube.current?.setOrbit(MOYU_REST_ORBIT);
      setMoyuNote(
        moyuSession
          ? `${formatMoyuConnectedLabel(moyuSession.name)} · 已对齐朝向`
          : "已对齐朝向",
      );
    } catch (error) {
      setMoyuNote(
        error instanceof Error ? error.message : "尚无朝向数据，请稍候再对齐",
      );
    }
  }

  async function onMoyuConnectClick() {
    if (moyuBusy) {
      return;
    }
    if (moyuSession) {
      void moyuSession.disableGyro().catch(() => undefined);
      moyuSession.disconnect();
      resetMoyuOrientationFollow();
      setMoyuSession(null);
      syncScrambleGuide(null, false);
      setMoyuNote(null);
      if (scrambleMoves) {
        cube.current?.setAlgorithm(scrambleMoves);
      }
      return;
    }
    setMoyuBusy(true);
    setMoyuNote(null);
    resetMoyuOrientationFollow();
    try {
      const session = await connectMoyuCube({
        onDisconnected: () => {
          resetMoyuOrientationFollow();
          setMoyuSession(null);
          syncScrambleGuide(null, false);
          setMoyuNote("魔方已断开");
          const moves = scrambleMovesRef.current;
          if (moves) {
            cube.current?.setAlgorithm(moves);
          }
        },
        onMoves: (samples) => {
          // 连续转动：按 interval 播动画；过快则瞬切
          cube.current?.playBluetoothMoves(samples);
          applyBluetoothGuideMovesRef.current(samples);
        },
        onOrientation: onMoyuOrientation,
        askMacAddress: (deviceName) => {
          const entered = window.prompt(
            `请输入魔方 MAC（可在官方 App 查看）\n设备：${deviceName}`,
            "CF:30:16:00:00:00",
          );
          return entered;
        },
      });
      // 在 await 间隙也视为已连接，避免 applyScramble 误清引导。
      moyuSessionRef.current = session;
      setMoyuSession(session);
      setMoyuNote(`${formatMoyuConnectedLabel(session.name)} · 同步中…`);
      const status = await session.requestStatus();
      // 计时首屏白上：setupAlg 可直接展示物理魔方状态（不改打乱公式文案）
      cube.current?.setAbsoluteAlg(status.setupAlg);
      cube.current?.setOrbit(MOYU_REST_ORBIT);
      syncScrambleGuide(scrambleMovesRef.current, true);
      await session.enableGyro();
      setMoyuNote(
        `${formatMoyuConnectedLabel(session.name)} · 已同步 · 朝向跟随`,
      );
    } catch (error) {
      resetMoyuOrientationFollow();
      setMoyuSession(null);
      syncScrambleGuide(null, false);
      setMoyuNote(formatMoyuConnectError(error));
    } finally {
      setMoyuBusy(false);
    }
  }

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
        {focus.kind === "计时" ? (
          <div className="topbar-bt">
            <button
              type="button"
              className="bt-connect"
              disabled={moyuBusy}
              aria-busy={moyuBusy}
              onClick={() => {
                void onMoyuConnectClick();
              }}
            >
              {moyuBusy ? "连接中…" : moyuSession ? "断开魔方" : "连接魔方"}
            </button>
            {moyuSession ? (
              <button
                type="button"
                className="bt-align"
                disabled={moyuBusy}
                onClick={onMoyuAlignOrientation}
              >
                对齐朝向
              </button>
            ) : null}
            {moyuNote ? (
              <span
                className={
                  moyuSession ? "bt-status is-connected" : "bt-status is-note"
                }
                role="status"
              >
                {moyuNote}
              </span>
            ) : null}
          </div>
        ) : null}
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
          <ScramblePanel
            moves={scrambleMoves}
            onRescramble={refreshScramble}
            guide={scrambleGuide}
          />
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
