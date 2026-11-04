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
import type { BluetoothSolveStats } from "./modules/score/bluetoothSolveStats.ts";
import {
  browserScoreStorage,
  createScoreLog,
  latestSolveTimeMs,
} from "./modules/score/score.ts";
import {
  clearOrientationHoldPending,
  createOrientationHoldState,
  midSolveOrientationCandidate,
  nearestCubeOrientationAlg,
  orientationRotationPath,
  ORIENTATION_FACE_QUIET_MS,
  scrambleToHeldPrepRotations,
  tickOrientationHold,
  type OrientationHoldState,
} from "./modules/score/cubeOrientation.ts";
import {
  buildSolveReview,
  type SolveReview,
} from "./modules/score/solveReview.ts";
import { SolveReviewPage } from "./modules/score/SolveReviewPage.tsx";
import {
  createSolveTraceSession,
  type SolveTraceSession,
} from "./modules/score/solveTrace.ts";
import {
  BLUETOOTH_INSPECT_MS,
  finishBluetoothInspect,
  nextInspectPhaseOnGuideDone,
  shouldAutoStartTimerOnInspectTimeout,
  shouldEndInspectOnCubeTurn,
  type BluetoothInspectPhase,
} from "./modules/scramble/bluetoothInspect.ts";
import { BluetoothInspectPanel } from "./modules/scramble/BluetoothInspectPanel.tsx";
import { isSolvedFromSetup } from "./modules/scramble/bluetoothSolve.ts";
import {
  applyGuidedMove,
  createGuidedScramble,
  guidedScrambleView,
  type GuidedScramble,
  type GuidedScrambleView,
} from "./modules/scramble/guided.ts";
import {
  SCRAMBLE_PLAYBACK_STEP_MS,
  createScrambleCursor,
  isScrambleAtEnd,
  isScrambleAtStart,
  scrambleDisplayedMoves,
  scrambleStepNext,
  scrambleStepPrevious,
  type ScrambleCursor,
} from "./modules/scramble/playback.ts";
import { ScrambleControls } from "./modules/scramble/ScrambleControls.tsx";
import { ScramblePanel } from "./modules/scramble/ScramblePanel.tsx";
import { randomScramble3x3 } from "./modules/scramble/scramble.ts";
import {
  createPendingSolve,
  resolveResultConfirm,
  shouldShowBluetoothSolveStats,
  type PendingSolve,
} from "./modules/timer/resultConfirm.ts";
import { ResultConfirmDialog } from "./modules/timer/ResultConfirmDialog.tsx";
import {
  allowManualTimerStop,
  isTimingChromeHidden,
  isTimingPointerOnControl,
  isTimingPointerOnCube,
  keepElapsedOnScrambleRefresh,
  shouldCancelTimingHoldForCubeDrag,
  shouldResetCubeOnTimingHome,
  shouldShowAbandonTimingControl,
  shouldShowLastSolveSlotOnHome,
  shouldStartBluetoothTimer,
  showCubeLayerControls,
  timingShellVisible,
  type SessionPhase,
} from "./modules/timer/session.ts";
import { ElapsedDigits } from "./modules/timer/ElapsedDigits.tsx";
import { TimingAbandonButton } from "./modules/timer/TimingAbandonButton.tsx";
import { TimerStats } from "./modules/timer/TimerStats.tsx";
import { TimerView, type TimerHandle } from "./modules/timer/TimerView.tsx";
import { BluetoothDisconnectDialog } from "./modules/bluetooth/BluetoothDisconnectDialog.tsx";
import {
  connectMoyuCube,
  formatMoyuConnectError,
  IDENTITY_QUAT,
  isWebBluetoothAvailable,
  MOYU_REST_ORBIT,
  MoyuOrientationTracker,
  type MoyuBleConnection,
  type MoyuMoveSample,
  type MoyuQuat,
} from "./modules/bluetooth/moyu/index.ts";
import { Toast, TOAST_WEB_BLUETOOTH_UNSUPPORTED } from "./modules/ui/Toast.tsx";
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
  const webBluetoothOk = useMemo(() => isWebBluetoothAvailable(), []);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [btDisconnectConfirmOpen, setBtDisconnectConfirmOpen] = useState(false);
  const [scoreRevision, setScoreRevision] = useState(0);
  const [defaultAlgRevision, setDefaultAlgRevision] = useState(0);
  const [scrambleMoves, setScrambleMoves] = useState<string | null>(null);
  const scrambleMovesRef = useRef<string | null>(null);
  scrambleMovesRef.current = scrambleMoves;
  const [timerPhase, setTimerPhase] = useState<SessionPhase>("idle");
  const timerPhaseRef = useRef<SessionPhase>("idle");
  timerPhaseRef.current = timerPhase;
  const [pendingResult, setPendingResult] = useState<PendingSolve | null>(null);
  const pendingResultRef = useRef<PendingSolve | null>(null);
  pendingResultRef.current = pendingResult;
  /** 首页大字上次成绩：启动时从本机成绩恢复，停表后再更新。 */
  const [lastSolveTimeMs, setLastSolveTimeMs] = useState<number | null>(() =>
    latestSolveTimeMs(scoreLog.list()),
  );
  const [pendingSolveReview, setPendingSolveReview] =
    useState<SolveReview | null>(null);
  const pendingSolveReviewRef = useRef<SolveReview | null>(null);
  pendingSolveReviewRef.current = pendingSolveReview;
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
  const [btInspectPhase, setBtInspectPhase] =
    useState<BluetoothInspectPhase>("off");
  const [inspectRemainingMs, setInspectRemainingMs] =
    useState(BLUETOOTH_INSPECT_MS);
  const moyuSessionRef = useRef<MoyuBleConnection | null>(null);
  moyuSessionRef.current = moyuSession;
  const scrambleGuideRef = useRef<GuidedScramble | null>(null);
  const btInspectPhaseRef = useRef<BluetoothInspectPhase>("off");
  btInspectPhaseRef.current = btInspectPhase;
  /** 连接时 facelets 对应的 setupAlg（从复原到当时状态）。 */
  const bluetoothSetupAlgRef = useRef("");
  /** 连接后全部实体转动，用于白上绿前复原判定。 */
  const bluetoothStateMovesRef = useRef<string[]>([]);
  /** 开表瞬间相对复原的 setup（不含开表当次转动）。 */
  const bluetoothSolveStartSetupRef = useRef("");
  /** 计时中转动轨迹（复盘 / 分段）。 */
  const bluetoothSolveTraceRef = useRef<SolveTraceSession | null>(null);
  /** 计时中已提交的手持朝向（含稳定防抖）。 */
  const bluetoothSolveOrientHoldRef = useRef<OrientationHoldState>(
    createOrientationHoldState(),
  );
  /** 面转后此时间戳前忽略陀螺仪转体推断。 */
  const bluetoothSolveOrientQuietUntilRef = useRef(0);
  /** 复盘页 history 标记，供滑动返回保存。 */
  const solveReviewHistoryEpochRef = useRef(0);
  const bluetoothSolveCheckGen = useRef(0);
  const inspectEndsAtRef = useRef(0);
  const moyuOrientation = useRef(new MoyuOrientationTracker());
  const moyuOrbitRaf = useRef(0);
  const moyuPendingQuat = useRef<MoyuQuat | null>(null);
  const cursorRef = useRef<PracticeCursor | null>(null);
  const playingRef = useRef(false);
  const playRun = useRef(0);
  const [scrambleCursor, setScrambleCursor] = useState<ScrambleCursor | null>(
    null,
  );
  const scrambleCursorRef = useRef<ScrambleCursor | null>(null);
  const [scramblePlaying, setScramblePlaying] = useState(false);
  const scramblePlayingRef = useRef(false);
  const scramblePlayRun = useRef(0);
  /** 作废进行中的单步打乱动画回调（暂停 / 改游标时 +1）。 */
  const scrambleMotionGen = useRef(0);
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

  function stopScramblePlay() {
    scramblePlayRun.current += 1;
    scrambleMotionGen.current += 1;
    if (scramblePlayingRef.current) {
      scramblePlayingRef.current = false;
      setScramblePlaying(false);
      // 暂停时停在「当前步」：游标未前进，魔方回到该步执行前的状态。
      cube.current?.cancelAnimation();
      const cur = scrambleCursorRef.current;
      if (cur) {
        void cube.current?.showMoves(scrambleDisplayedMoves(cur));
      }
    }
  }

  function showScrambleCursor(next: ScrambleCursor) {
    scrambleMotionGen.current += 1;
    scrambleCursorRef.current = next;
    setScrambleCursor(next);
    cube.current?.cancelAnimation();
    void cube.current?.showMoves(scrambleDisplayedMoves(next));
  }

  function moveScrambleCursor(
    update: (current: ScrambleCursor) => ScrambleCursor,
    motion: "snap" | "forward" | "back",
  ) {
    stopScramblePlay();
    const current = scrambleCursorRef.current;
    if (!current) {
      return;
    }
    const next = update(current);
    if (motion === "snap" || next.index === current.index) {
      showScrambleCursor(next);
      return;
    }
    cube.current?.cancelAnimation();
    const motionId = ++scrambleMotionGen.current;
    // 后退：先更新游标；前进：等动画结束再前进，避免高亮快一拍。
    if (motion === "back") {
      scrambleCursorRef.current = next;
      setScrambleCursor(next);
    }
    void cube.current
      ?.animateMove(
        scrambleDisplayedMoves(current),
        scrambleDisplayedMoves(next),
        motion,
        SCRAMBLE_PLAYBACK_STEP_MS,
      )
      .then(() => {
        if (scrambleMotionGen.current !== motionId) {
          return;
        }
        if (motion === "forward") {
          scrambleCursorRef.current = next;
          setScrambleCursor(next);
        }
      });
  }

  async function onScramblePlay() {
    if (scramblePlayingRef.current) {
      stopScramblePlay();
      return;
    }
    let current = scrambleCursorRef.current;
    if (!current) {
      return;
    }
    const run = scramblePlayRun.current;
    try {
      if (isScrambleAtEnd(current)) {
        const start = { ...current, index: 0 };
        scrambleCursorRef.current = start;
        setScrambleCursor(start);
        cube.current?.cancelAnimation();
        await cube.current?.showMoves(scrambleDisplayedMoves(start));
        if (scramblePlayRun.current !== run) {
          return;
        }
        current = start;
      }
      scramblePlayingRef.current = true;
      setScramblePlaying(true);
      while (scramblePlayRun.current === run && !isScrambleAtEnd(current)) {
        // 高亮停在 current.index（正在执行的步），动画结束后再 next。
        const next = scrambleStepNext(current);
        await cube.current?.animateMove(
          scrambleDisplayedMoves(current),
          scrambleDisplayedMoves(next),
          "forward",
          SCRAMBLE_PLAYBACK_STEP_MS,
        );
        if (scramblePlayRun.current !== run) {
          return;
        }
        current = next;
        scrambleCursorRef.current = next;
        setScrambleCursor(next);
      }
    } finally {
      if (scramblePlayRun.current === run && scramblePlayingRef.current) {
        scramblePlayingRef.current = false;
        setScramblePlaying(false);
      }
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
      scramblePlayRun.current += 1;
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

  function resetBluetoothInspect() {
    btInspectPhaseRef.current = "off";
    setBtInspectPhase("off");
    setInspectRemainingMs(BLUETOOTH_INSPECT_MS);
    inspectEndsAtRef.current = 0;
  }

  function resetBluetoothCubeStateTracking(setupAlg = "") {
    bluetoothSetupAlgRef.current = setupAlg;
    bluetoothStateMovesRef.current = [];
    bluetoothSolveStartSetupRef.current = "";
    bluetoothSolveTraceRef.current = null;
    bluetoothSolveCheckGen.current += 1;
  }

  function bluetoothSetupBeforeMoves(): string {
    const parts = [
      bluetoothSetupAlgRef.current,
      ...bluetoothStateMovesRef.current,
    ]
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.join(" ");
  }

  function hasPendingSolveUi(): boolean {
    return Boolean(pendingResultRef.current || pendingSolveReviewRef.current);
  }

  function currentBluetoothRelativeQuat(): typeof IDENTITY_QUAT {
    const last = moyuOrientation.current.lastQuat();
    if (!last) {
      return IDENTITY_QUAT;
    }
    return moyuOrientation.current.toOrientation(last);
  }

  function beginBluetoothSolveTrace(startSetupAlg: string) {
    bluetoothSolveStartSetupRef.current = startSetupAlg;
    const session = createSolveTraceSession({
      scramble: scrambleMovesRef.current ?? "",
      startSetupAlg,
    });
    // 观察阶段常先 z2（黄上）再 y 选十字；开表前未记轨迹，这里补相对白上绿前的准备转体。
    const held = nearestCubeOrientationAlg(currentBluetoothRelativeQuat());
    const prep = scrambleToHeldPrepRotations(held);
    for (const move of prep) {
      session.appendAt(move, 0);
    }
    bluetoothSolveOrientHoldRef.current = createOrientationHoldState(held);
    bluetoothSolveTraceRef.current = session;
  }

  /** 陀螺仪朝向变化 → 写入 x/y/z（需稳定片刻，避免 z z' 抖动）。 */
  function syncBluetoothSolveRotationsFromGyro(): void {
    const session = bluetoothSolveTraceRef.current;
    if (!session || timerPhaseRef.current !== "running") {
      return;
    }
    const now = performance.now();
    if (now < bluetoothSolveOrientQuietUntilRef.current) {
      return;
    }
    const candidate = midSolveOrientationCandidate(
      currentBluetoothRelativeQuat(),
      bluetoothSolveOrientHoldRef.current.committed,
    );
    // 稳定判定只需单调时钟；写入时刻仍由 session.append 的开表时钟负责。
    const tick = tickOrientationHold(
      bluetoothSolveOrientHoldRef.current,
      candidate,
      now,
    );
    bluetoothSolveOrientHoldRef.current = tick.state;
    for (const move of tick.path) {
      session.append(move);
    }
  }

  function appendBluetoothSolveTraceMoves(
    samples: readonly MoyuMoveSample[],
  ): void {
    const session = bluetoothSolveTraceRef.current;
    if (!session) {
      return;
    }
    const now = performance.now();
    if (now >= bluetoothSolveOrientQuietUntilRef.current) {
      // 停顿后再拧：先按当前手持朝向补记 y 等（F2L 换槽），再记面转。
      const held = midSolveOrientationCandidate(
        currentBluetoothRelativeQuat(),
        bluetoothSolveOrientHoldRef.current.committed,
      );
      const path = orientationRotationPath(
        bluetoothSolveOrientHoldRef.current.committed,
        held,
      );
      for (const move of path) {
        session.append(move);
      }
      bluetoothSolveOrientHoldRef.current = createOrientationHoldState(held);
    } else {
      // 连拧中：取消未稳定的陀螺仪候选，避免打断 R2。
      bluetoothSolveOrientHoldRef.current = clearOrientationHoldPending(
        bluetoothSolveOrientHoldRef.current,
        now,
      );
    }
    bluetoothSolveOrientQuietUntilRef.current = now + ORIENTATION_FACE_QUIET_MS;
    for (const sample of samples) {
      // 魔域面转是色心绝对坐标；展示时再按累积转体映成握持公式。
      session.append(sample.move, { remapFace: false });
    }
  }

  function beginBluetoothInspect() {
    const next = nextInspectPhaseOnGuideDone(btInspectPhaseRef.current);
    if (next !== "inspecting") {
      btInspectPhaseRef.current = next;
      setBtInspectPhase(next);
      return;
    }
    btInspectPhaseRef.current = "inspecting";
    setBtInspectPhase("inspecting");
    inspectEndsAtRef.current = Date.now() + BLUETOOTH_INSPECT_MS;
    setInspectRemainingMs(BLUETOOTH_INSPECT_MS);
    cube.current?.setMoveHint(null);
  }

  function skipOrFinishBluetoothInspect() {
    const next = finishBluetoothInspect(btInspectPhaseRef.current);
    btInspectPhaseRef.current = next;
    setBtInspectPhase(next);
  }

  /** 观察倒计时归零：进入计时画面并立刻开表（无待转旁注）。 */
  function startBluetoothTimerAfterInspectTimeout() {
    if (
      !shouldAutoStartTimerOnInspectTimeout(btInspectPhaseRef.current) ||
      timerPhaseRef.current === "running" ||
      hasPendingSolveUi()
    ) {
      return;
    }
    beginBluetoothSolveTrace(bluetoothSetupBeforeMoves());
    cube.current?.setMoveHint(null);
    resetBluetoothInspect();
    timer.current?.startRunning();
  }

  function syncScrambleGuide(moves: string | null, connected: boolean) {
    if (!connected || !moves) {
      scrambleGuideRef.current = null;
      setScrambleGuide(null);
      resetBluetoothInspect();
      return;
    }
    try {
      const guide = createGuidedScramble(moves);
      scrambleGuideRef.current = guide;
      setScrambleGuide(guidedScrambleView(guide));
      resetBluetoothInspect();
    } catch {
      scrambleGuideRef.current = null;
      setScrambleGuide(null);
      resetBluetoothInspect();
    }
  }

  function recordBluetoothStateMoves(samples: readonly MoyuMoveSample[]) {
    for (const sample of samples) {
      bluetoothStateMovesRef.current.push(sample.move);
    }
  }

  function maybeStopBluetoothTimerOnSolved() {
    if (
      !moyuSessionRef.current ||
      hasPendingSolveUi() ||
      timerPhaseRef.current !== "running"
    ) {
      return;
    }
    const movesSnapshot = bluetoothStateMovesRef.current.slice();
    const setupAlg = bluetoothSetupAlgRef.current;
    const checkGen = bluetoothSolveCheckGen.current;
    void isSolvedFromSetup(setupAlg, movesSnapshot).then((solved) => {
      if (!solved || checkGen !== bluetoothSolveCheckGen.current) {
        return;
      }
      if (hasPendingSolveUi() || timerPhaseRef.current !== "running") {
        return;
      }
      timer.current?.stopRunning();
    });
  }

  /**
   * 打乱完成后的实体转动：观察中拧动开表；计时中记账并检测还原。
   * 开表前快照 setup，开表当次转动计入解题序列。
   */
  function handlePostGuideBluetoothMoves(
    samples: readonly MoyuMoveSample[],
  ): void {
    if (samples.length === 0) {
      return;
    }
    if (btInspectPhaseRef.current === "off") {
      beginBluetoothInspect();
    }
    if (shouldEndInspectOnCubeTurn(btInspectPhaseRef.current)) {
      const next = finishBluetoothInspect(btInspectPhaseRef.current);
      btInspectPhaseRef.current = next;
      setBtInspectPhase(next);
    }
    if (hasPendingSolveUi()) {
      recordBluetoothStateMoves(samples);
      return;
    }
    if (timerPhaseRef.current === "running") {
      recordBluetoothStateMoves(samples);
      appendBluetoothSolveTraceMoves(samples);
      maybeStopBluetoothTimerOnSolved();
      return;
    }
    const guideDone = scrambleGuideRef.current?.phase === "done";
    if (
      !shouldStartBluetoothTimer(
        Boolean(guideDone),
        timerPhaseRef.current,
        btInspectPhaseRef.current,
      )
    ) {
      recordBluetoothStateMoves(samples);
      return;
    }
    beginBluetoothSolveTrace(bluetoothSetupBeforeMoves());
    cube.current?.setMoveHint(null);
    recordBluetoothStateMoves(samples);
    timer.current?.startRunning();
    appendBluetoothSolveTraceMoves(samples);
    maybeStopBluetoothTimerOnSolved();
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
    // 打乱已完成：观察中拧动即结束倒计时并开表；待转首转开表；计时中检测还原。
    if (guide.phase === "done") {
      handlePostGuideBluetoothMoves(samples);
      return;
    }
    try {
      let next: GuidedScramble = guide;
      let sampleIndex = 0;
      for (; sampleIndex < samples.length; sampleIndex += 1) {
        const sample = samples[sampleIndex]!;
        const result = applyGuidedMove(next, sample.move);
        next = result.guide;
        if (next.phase === "done") {
          sampleIndex += 1;
          break;
        }
      }
      const guideSamples = samples.slice(0, sampleIndex);
      const extraSamples = samples.slice(sampleIndex);
      recordBluetoothStateMoves(guideSamples);
      scrambleGuideRef.current = next;
      // GATT 异步回调里强制同步刷新，避免部分 WebKit / Bluefy 丢更新。
      flushSync(() => {
        setScrambleGuide(guidedScrambleView(next));
      });
      if (next.phase === "done") {
        beginBluetoothInspect();
        if (extraSamples.length > 0) {
          handlePostGuideBluetoothMoves(extraSamples);
        }
      }
    } catch {
      // 单步解析失败时不打断跟转动画
    }
  }

  const applyBluetoothGuideMovesRef = useRef(applyBluetoothGuideMoves);
  applyBluetoothGuideMovesRef.current = applyBluetoothGuideMoves;

  function applyScramble(moves: string, resetTimer: boolean) {
    // 只刷新打乱文案与播放游标；不改写当前 3D 状态（下一轮 / 重新打乱）。
    // 蓝牙跟随实体，也不写打乱目标。
    stopScramblePlay();
    setScrambleMoves(moves);
    try {
      const next = createScrambleCursor(moves);
      scrambleCursorRef.current = next;
      setScrambleCursor(next);
    } catch {
      scrambleCursorRef.current = null;
      setScrambleCursor(null);
    }
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
    if (phase === "arming" || phase === "armed" || phase === "running") {
      stopScramblePlay();
    }
  }

  useEffect(() => {
    if (focus.kind !== "计时") {
      stopScramblePlay();
      return;
    }
    if (!scrambleMoves) {
      refreshScramble();
    }
    // 计时首页默认还原态；非蓝牙由播放条跟播，不在刷新公式时写回 3D。
  }, [focus.kind, scrambleMoves]);

  // 蓝牙引导：3D 贴面弯箭头（VisualCube 风格；仅计时 + 已连接 + 引导中）
  useEffect(() => {
    if (focus.kind !== "计时" || !moyuSession || !scrambleGuide) {
      cube.current?.setMoveHint(null);
      return;
    }
    if (btInspectPhase !== "off") {
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
  }, [focus.kind, moyuSession, scrambleGuide, btInspectPhase]);

  // 蓝牙观察倒计时：到期直接进入计时并开表
  useEffect(() => {
    if (btInspectPhase !== "inspecting") {
      return;
    }
    const id = window.setInterval(() => {
      const remaining = Math.max(0, inspectEndsAtRef.current - Date.now());
      setInspectRemainingMs(remaining);
      if (remaining <= 0) {
        startBluetoothTimerAfterInspectTimeout();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [btInspectPhase]);

  function onMode(event: MouseEvent<HTMLButtonElement>) {
    const next = switchMode(mode).mode;
    setFocus(next === "公式练习" ? showPractice() : showTiming());
    event.currentTarget.blur();
  }

  function onBack(event: MouseEvent<HTMLButtonElement>) {
    setFocus((current) => back(current));
    event.currentTarget.blur();
  }

  function resetNonBluetoothCubeToSolved() {
    if (!shouldResetCubeOnTimingHome(Boolean(moyuSessionRef.current))) {
      return;
    }
    stopScramblePlay();
    const current = scrambleCursorRef.current;
    if (current) {
      const start = { ...current, index: 0 };
      scrambleCursorRef.current = start;
      setScrambleCursor(start);
    }
    cube.current?.cancelAnimation();
    void cube.current?.showMoves("");
  }

  /** 放弃准备 / 计时：不记成绩，回首页并刷新打乱。 */
  function abandonTiming() {
    if (!shouldShowAbandonTimingControl(timerPhaseRef.current)) {
      return;
    }
    bluetoothSolveTraceRef.current = null;
    bluetoothSolveStartSetupRef.current = "";
    bluetoothSolveCheckGen.current += 1;
    resetBluetoothInspect();
    refreshScramble(true);
    resetNonBluetoothCubeToSolved();
  }

  function toScoreSplit(
    stats: BluetoothSolveStats,
  ): NonNullable<Parameters<typeof scoreLog.record>[0]["split"]> {
    return {
      overview: {
        moves: stats.overview.moves,
        rotations: stats.overview.rotations,
        tps: stats.overview.tps,
        pauseRate: stats.overview.pauseRate,
      },
      phases: stats.phases.map((phase) => ({
        id: phase.id,
        label: phase.label,
        timeMs: phase.timeMs,
        timeShare: phase.timeShare,
        moves: phase.moves,
        rotations: phase.rotations,
        tps: phase.tps,
        pauseRate: phase.pauseRate,
      })),
    };
  }

  /** 写入本机成绩；不关闭复盘、不刷新打乱。 */
  function persistBluetoothSolveReview(review: SolveReview) {
    scoreLog.record({
      timeMs: review.overview.timeMs,
      scramble: review.scramble,
      mode: "蓝牙",
      split: toScoreSplit(review),
    });
    setScoreRevision((current) => current + 1);
  }

  function recordSolveAndRefresh(
    timeMs: number,
    scramble: string,
    options: {
      mode?: "非蓝牙" | "蓝牙";
      split?: false | BluetoothSolveStats;
    } = {},
  ) {
    const split =
      options.split === undefined || options.split === false
        ? false
        : toScoreSplit(options.split);
    scoreLog.record({
      timeMs,
      scramble,
      mode: options.mode ?? "非蓝牙",
      split,
    });
    setScoreRevision((current) => current + 1);
    setPendingResult(null);
    setPendingSolveReview(null);
    // Keep the stopped time on screen; only refresh scramble / cube / net.
    refreshScramble(!keepElapsedOnScrambleRefresh(timerPhaseRef.current));
  }

  function onTimerStop(timeMs: number) {
    const kind = focusRef.current.kind;
    if (kind !== "计时" || !scrambleMoves) {
      return;
    }
    setLastSolveTimeMs(timeMs);
    // 非蓝牙：停表回首页时魔方回到白上绿前复原态；蓝牙继续跟实体。
    resetNonBluetoothCubeToSolved();
    const pending = createPendingSolve({ timeMs, scramble: scrambleMoves });
    // 蓝牙还原：先弹成绩统计，确认后再保存。
    if (shouldShowBluetoothSolveStats(Boolean(moyuSessionRef.current))) {
      const session = bluetoothSolveTraceRef.current;
      const trace =
        session?.snapshot() ??
        createSolveTraceSession({
          scramble: pending.scramble,
          startSetupAlg: bluetoothSolveStartSetupRef.current,
        }).snapshot();
      void buildSolveReview({
        trace,
        totalTimeMs: pending.timeMs,
      }).then((review) => {
        if (focusRef.current.kind !== "计时") {
          return;
        }
        // 进入复盘即保存；返回只退出查看。
        persistBluetoothSolveReview(review);
        setPendingSolveReview(review);
      });
      return;
    }
    setPendingResult(pending);
  }

  function settlePendingResult(choice: "keep" | "discard") {
    if (!pendingResult) {
      return;
    }
    const decision = resolveResultConfirm(pendingResult, choice);
    if (decision.shouldRecord) {
      recordSolveAndRefresh(decision.timeMs, decision.scramble);
      return;
    }
    setPendingResult(null);
    refreshScramble(!keepElapsedOnScrambleRefresh(timerPhaseRef.current));
  }

  /** 关闭复盘查看：不重复保存，刷新打乱进入下一轮。 */
  function closeSolveReviewView() {
    if (!pendingSolveReviewRef.current) {
      return;
    }
    setPendingSolveReview(null);
    refreshScramble(!keepElapsedOnScrambleRefresh(timerPhaseRef.current));
  }

  /** 左上角返回：走 history.back，与手机滑动返回同一路径。 */
  function dismissSolveReview() {
    if (!pendingSolveReviewRef.current) {
      return;
    }
    const epoch = solveReviewHistoryEpochRef.current;
    if (
      epoch > 0 &&
      window.history.state &&
      typeof window.history.state === "object" &&
      "cubeTrainerSolveReview" in window.history.state &&
      (window.history.state as { cubeTrainerSolveReview?: number })
        .cubeTrainerSolveReview === epoch
    ) {
      window.history.back();
      return;
    }
    closeSolveReviewView();
  }

  useEffect(() => {
    if (!pendingSolveReview) {
      return;
    }
    const epoch = solveReviewHistoryEpochRef.current + 1;
    solveReviewHistoryEpochRef.current = epoch;
    window.history.pushState({ cubeTrainerSolveReview: epoch }, "");
    const onPopState = () => {
      if (!pendingSolveReviewRef.current) {
        return;
      }
      if (solveReviewHistoryEpochRef.current !== epoch) {
        return;
      }
      closeSolveReviewView();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      const state = window.history.state;
      if (
        state &&
        typeof state === "object" &&
        "cubeTrainerSolveReview" in state &&
        (state as { cubeTrainerSolveReview?: number })
          .cubeTrainerSolveReview === epoch
      ) {
        window.history.back();
      }
    };
  }, [pendingSolveReview]);

  const timingHoldRef = useRef(false);
  /** 从 3D 上按下：记录起点，拖过阈值则取消开表、交给旋转。 */
  const cubeTimingPointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  function onTimingPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (
      focus.kind !== "计时" ||
      event.button !== 0 ||
      pendingResult ||
      pendingSolveReview
    ) {
      return;
    }
    if (isTimingPointerOnControl(event.target)) {
      return;
    }
    // 蓝牙：仅还原自动停，点击不开关表。
    if (moyuSessionRef.current) {
      return;
    }
    // 打乱播放中：点按只暂停，不进入开表手势。
    if (scramblePlayingRef.current) {
      event.preventDefault();
      stopScramblePlay();
      return;
    }
    const onCube = isTimingPointerOnCube(event.target);
    timingHoldRef.current = true;
    if (onCube) {
      // 不 preventDefault / capture，以便拖动时 twisty 仍能旋转。
      cubeTimingPointerRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      timer.current?.pressDown();
      return;
    }
    cubeTimingPointerRef.current = null;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    timer.current?.pressDown();
  }

  function onTimingPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (focus.kind !== "计时") {
      return;
    }
    const pending = cubeTimingPointerRef.current;
    if (!pending || pending.pointerId !== event.pointerId) {
      return;
    }
    if (
      !shouldCancelTimingHoldForCubeDrag(
        pending.x,
        pending.y,
        event.clientX,
        event.clientY,
      )
    ) {
      return;
    }
    // 拖动旋转：取消计时手势，后续事件交给魔方。
    cubeTimingPointerRef.current = null;
    timingHoldRef.current = false;
    timer.current?.pressCancel();
  }

  function onTimingPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (focus.kind !== "计时") {
      return;
    }
    if (cubeTimingPointerRef.current?.pointerId === event.pointerId) {
      cubeTimingPointerRef.current = null;
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
    cubeTimingPointerRef.current = null;
    if (!timingHoldRef.current) {
      return;
    }
    timingHoldRef.current = false;
    timer.current?.pressCancel();
  }

  const timingRunning =
    focus.kind === "计时" && isTimingChromeHidden(timerPhase);
  const showTimingHome = focus.kind === "计时" && !timingRunning;
  const showLastSolveSlot = shouldShowLastSolveSlotOnHome(showTimingHome);
  const timingShellOpts = { bluetoothConnected: Boolean(moyuSession) };
  const modeEntry = modeSwitchPresentation(mode);

  function flushMoyuOrientation() {
    moyuOrbitRaf.current = 0;
    const quat = moyuPendingQuat.current;
    if (!quat) {
      return;
    }
    cube.current?.setOrientation(moyuOrientation.current.toOrientation(quat));
    syncBluetoothSolveRotationsFromGyro();
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

  function disconnectMoyuSession() {
    const session = moyuSessionRef.current;
    if (!session) {
      return;
    }
    void session.disableGyro().catch(() => undefined);
    session.disconnect();
    resetMoyuOrientationFollow();
    setMoyuSession(null);
    moyuSessionRef.current = null;
    syncScrambleGuide(null, false);
    setMoyuNote(null);
    setBtDisconnectConfirmOpen(false);
    // 断开后回到首页还原态预览，不写回打乱目标。
    cube.current?.setAbsoluteAlg("");
  }

  function onMoyuAlignOrientation() {
    try {
      const orientation = moyuOrientation.current.alignToCurrent();
      cube.current?.setOrientation(orientation);
      cube.current?.setOrbit(MOYU_REST_ORBIT);
      // 首页不展示设备名；对齐成功用短 Toast。
      setToastMessage("已对齐朝向");
      setMoyuNote(null);
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
    if (!webBluetoothOk) {
      setToastMessage(TOAST_WEB_BLUETOOTH_UNSUPPORTED);
      return;
    }
    if (moyuSession) {
      setBtDisconnectConfirmOpen(true);
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
          moyuSessionRef.current = null;
          resetBluetoothCubeStateTracking();
          syncScrambleGuide(null, false);
          setBtDisconnectConfirmOpen(false);
          setMoyuNote("魔方已断开");
          cube.current?.setAbsoluteAlg("");
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
      // 首页不显示设备名；别名仅在设备弹层中编辑。
      setMoyuNote(null);
      const status = await session.requestStatus();
      // 计时首屏白上：setupAlg 可直接展示物理魔方状态（不改打乱公式文案）
      resetBluetoothCubeStateTracking(status.setupAlg);
      cube.current?.setAbsoluteAlg(status.setupAlg);
      cube.current?.setOrbit(MOYU_REST_ORBIT);
      syncScrambleGuide(scrambleMovesRef.current, true);
      await session.enableGyro();
    } catch (error) {
      resetMoyuOrientationFollow();
      setMoyuSession(null);
      moyuSessionRef.current = null;
      resetBluetoothCubeStateTracking();
      syncScrambleGuide(null, false);
      setMoyuNote(formatMoyuConnectError(error));
    } finally {
      setMoyuBusy(false);
    }
  }

  return (
    <div className="app">
      {toastMessage ? (
        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      ) : null}
      {btDisconnectConfirmOpen && moyuSession ? (
        <BluetoothDisconnectDialog
          onConfirm={disconnectMoyuSession}
          onCancel={() => setBtDisconnectConfirmOpen(false)}
        />
      ) : null}
      {pendingResult ? (
        <ResultConfirmDialog
          timeMs={pendingResult.timeMs}
          onKeep={() => settlePendingResult("keep")}
          onDiscard={() => settlePendingResult("discard")}
        />
      ) : null}
      {pendingSolveReview ? (
        <SolveReviewPage
          review={pendingSolveReview}
          onBack={dismissSolveReview}
        />
      ) : null}
      <header
        className={focus.kind === "计时" ? "topbar topbar-timing" : "topbar"}
        hidden={
          focus.kind === "计时"
            ? !timingShellVisible(timerPhase, "topbar", timingShellOpts)
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
        {focus.kind === "计时" && moyuSession ? (
          <button
            type="button"
            className="bt-align bt-align-icon topbar-align"
            disabled={moyuBusy}
            aria-label="对齐朝向"
            title="对齐朝向"
            onClick={onMoyuAlignOrientation}
          >
            <svg
              className="bt-align-icon-svg"
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
              {/* 立体魔方：表示朝向 */}
              <path d="M12 3 19 7v10l-7 4-7-4V7l7-4z" />
              <path d="M12 3v10" />
              <path d="M5 7 12 11l7-4" />
              {/* 环绕箭头：表示对齐 / 重定向 */}
              <path d="M18.2 4.2a3 3 0 0 1 2.4 3.6" />
              <path d="m21.2 5.5-.2 2.2-2.1-.7" />
            </svg>
          </button>
        ) : null}
        {focus.kind === "计时" ? (
          <div className="topbar-bt">
            <button
              type="button"
              className={
                moyuSession
                  ? "bt-connect bt-connect-icon is-connected"
                  : "bt-connect bt-connect-icon"
              }
              disabled={moyuBusy}
              aria-busy={moyuBusy}
              aria-label={
                moyuBusy
                  ? "连接中…"
                  : moyuSession
                    ? "已连接，点击断开"
                    : "连接魔方"
              }
              title={
                moyuBusy
                  ? "连接中…"
                  : moyuSession
                    ? "已连接，点击断开"
                    : "连接魔方"
              }
              onClick={() => {
                void onMoyuConnectClick();
              }}
            >
              <svg
                className="bt-connect-icon-svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M17.71 7.71 12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"
                />
              </svg>
            </button>
            {moyuNote && !moyuSession ? (
              <span className="bt-status is-note" role="status">
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
        data-bt={focus.kind === "计时" && moyuSession ? "1" : undefined}
        onPointerDown={focus.kind === "计时" ? onTimingPointerDown : undefined}
        onPointerMove={focus.kind === "计时" ? onTimingPointerMove : undefined}
        onPointerUp={focus.kind === "计时" ? onTimingPointerUp : undefined}
        onPointerCancel={
          focus.kind === "计时" ? onTimingPointerCancel : undefined
        }
      >
        <div
          className="slot-cube"
          hidden={
            focus.kind === "计时"
              ? !timingShellVisible(timerPhase, "preview", timingShellOpts)
              : !showCube
          }
        >
          {focus.kind === "计时" ? (
            <div className="preview-stage" data-preview="cube">
              <CubeView
                ref={cube}
                showLayerControls={showCubeLayerControls(focus.kind)}
                viewOrientation="scramble"
              />
            </div>
          ) : (
            <CubeView ref={cube} showLayerControls={false} />
          )}
        </div>
        <div className="slot-last-time" hidden={!showLastSolveSlot}>
          {lastSolveTimeMs !== null ? (
            <ElapsedDigits ms={lastSolveTimeMs} className="last-solve-time" />
          ) : (
            <p
              className="last-solve-time last-solve-time-placeholder"
              aria-hidden="true"
            >
              <span className="timer-time-main">0</span>
              <span className="timer-time-dot" />
              <span className="timer-time-frac">00</span>
            </p>
          )}
        </div>
        <div
          className="slot-scramble"
          hidden={
            focus.kind !== "计时" ||
            !timingShellVisible(timerPhase, "scramble", timingShellOpts)
          }
        >
          {btInspectPhase === "inspecting" ? (
            <BluetoothInspectPanel
              remainingMs={inspectRemainingMs}
              onSkip={skipOrFinishBluetoothInspect}
            />
          ) : (
            <ScramblePanel
              moves={scrambleMoves}
              onRescramble={refreshScramble}
              guide={scrambleGuide}
              waitingForStart={btInspectPhase === "ready"}
              playbackSteps={
                !moyuSession && scrambleCursor ? scrambleCursor.moves : null
              }
              playbackIndex={scrambleCursor?.index ?? 0}
              footer={
                !moyuSession && scrambleCursor ? (
                  <ScrambleControls
                    atStart={isScrambleAtStart(scrambleCursor)}
                    atEnd={isScrambleAtEnd(scrambleCursor)}
                    playing={scramblePlaying}
                    onPrevious={() =>
                      moveScrambleCursor(scrambleStepPrevious, "back")
                    }
                    onPlay={() => void onScramblePlay()}
                    onNext={() =>
                      moveScrambleCursor(scrambleStepNext, "forward")
                    }
                  />
                ) : null
              }
            />
          )}
        </div>
        <div
          className="slot-stats"
          hidden={
            !showTimingHome ||
            !timingShellVisible(timerPhase, "scramble", timingShellOpts)
          }
        >
          <TimerStats summary={scoreSummary} />
        </div>
        <div
          className="slot-tools"
          hidden={
            focus.kind !== "计时" ||
            !timingShellVisible(timerPhase, "timer", timingShellOpts)
          }
        >
          {showScrambleTimer ? (
            <TimerView
              ref={timer}
              onStop={onTimerStop}
              onPhaseChange={onTimerPhase}
              showControls={false}
              showChrome={false}
              inputEnabled={!pendingResult && !pendingSolveReview}
              allowHoldStart={!moyuSession}
              allowManualStop={allowManualTimerStop(Boolean(moyuSession))}
              scrambleHomeGestures={!moyuSession}
              scramblePlaying={scramblePlaying}
              scrambleComplete={Boolean(
                scrambleCursor && isScrambleAtEnd(scrambleCursor),
              )}
              onPlayScramble={() => void onScramblePlay()}
            />
          ) : null}
        </div>
        {focus.kind === "计时" && shouldShowAbandonTimingControl(timerPhase) ? (
          <TimingAbandonButton onAbandon={abandonTiming} />
        ) : null}
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
