import {
  useCallback,
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
  showGame,
  showLayerCapture,
  showPractice,
  showScores,
  showTiming,
  type Focus,
} from "./modules/practice/focus.ts";
import { LayerCapturePage } from "./modules/bluetooth/moyu/LayerCapturePage.tsx";
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
  type Score,
} from "./modules/score/score.ts";
import { ScoreListPage } from "./modules/score/ScoreList.tsx";
import {
  buildSolveReviewFromScore,
  canOpenScoreReview,
} from "./modules/score/scoreList.ts";
import {
  clearOrientationHoldPending,
  createOrientationHoldState,
  midSolveOrientationCandidate,
  nearestCubeOrientationAlg,
  orientationRotationPath,
  ORIENTATION_FACE_QUIET_MS,
  scrambleGuideRotationSatisfied,
  scrambleToHeldPrepRotations,
  tickOrientationHold,
  type OrientationHoldState,
} from "./modules/score/cubeOrientation.ts";
import {
  buildSolveReview,
  type SolveReview,
} from "./modules/score/solveReview.ts";
import { SolveReviewPage } from "./modules/score/SolveReviewPage.tsx";
import { planSolveReviewRetry } from "./modules/score/solveReviewRetry.ts";
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
import {
  isSolvedFromSetup,
  joinAlgParts,
} from "./modules/scramble/bluetoothSolve.ts";
import {
  relativeOrientationAlg,
  relativeOrientationQuat,
} from "./modules/game/guideOrientation.ts";
import {
  applyGuidedMove,
  confirmGuidedFaceletsStep,
  confirmGuidedManualStep,
  createGuidedScramble,
  guidedScrambleView,
  isFaceGuideToken,
  isHintableManualToken,
  isRotationGuideToken,
  type GuidedScramble,
  type GuidedScrambleView,
} from "./modules/scramble/guided.ts";
import {
  resolveLayerFollowKind,
  shouldPlayBluetoothMoveAnim,
  tickScrambleGuideLayerFollow,
} from "./modules/scramble/scrambleGuideLayerFollow.ts";
import { layerGuideVisualProgress } from "./modules/scramble/layerGuideGyroFollow.ts";
import { resolveGuideBleFaceMove } from "./modules/scramble/layerGuideDualPaint.ts";
import { reconcileFaceMoveWithFacelets } from "./modules/scramble/scrambleGuideStep.ts";
import {
  appendGuideLayerGestureMoves,
  evaluateGuideLayerGesture,
  syncGuideLayerGestureTracker,
  type GuideLayerGestureTracker,
} from "./modules/scramble/scrambleGuideLayerGesture.ts";
import {
  guidePaintAlgPrefix,
  guideTokenToCubingAlg,
  nonRotationAlgPrefix,
} from "./modules/game/algStateMatch.ts";
import { nextHomeScrambleMoves } from "./modules/scramble/scramble.ts";
import {
  SCRAMBLE_PLAYBACK_STEP_MS,
  createScrambleCursor,
  isScrambleAtEnd,
  isScrambleAtStart,
  scrambleAtEnd,
  scrambleAtStart,
  scrambleDisplayedMoves,
  scrambleStepNext,
  scrambleStepPrevious,
  type ScrambleCursor,
} from "./modules/scramble/playback.ts";
import { ScrambleControls } from "./modules/scramble/ScrambleControls.tsx";
import { ScramblePanel } from "./modules/scramble/ScramblePanel.tsx";
import { GamePage, type GamePageBluetooth } from "./modules/game/GamePage.tsx";
import { shouldClearGameOnLeaveGame } from "./modules/game/gameNav.ts";
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
  inferSmartCubeBrand,
  requestSmartCubeDevice,
  type SmartCubeBrand,
} from "./modules/bluetooth/brand.ts";
import {
  bluetoothCubeAbsoluteAlg,
  shouldSyncCubeAfterBluetoothAbandon,
} from "./modules/bluetooth/cubeSync.ts";
import {
  shouldAbandonTimingAfterForegroundSolvedResync,
  shouldRequestStatusOnForeground,
} from "./modules/bluetooth/foregroundResync.ts";
import {
  connectGanCubeSession,
  formatGanConnectError,
  ganMacStorageKey,
  normalizeGanMacAddress,
} from "./modules/bluetooth/gan/index.ts";
import { connectGanCubeWithDevice } from "./modules/bluetooth/gan/vendorConnect.ts";
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
  return focus.kind === "练习" ? "公式练习" : "打乱计时";
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
  /** 从成绩列表打开的复盘（不重复保存）。 */
  const [browseReview, setBrowseReview] = useState<SolveReview | null>(null);
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
  /** 当前连接品牌；断开后清空。Gan 本阶段仅状态同步。 */
  const [btBrand, setBtBrand] = useState<SmartCubeBrand | null>(null);
  const btBrandRef = useRef<SmartCubeBrand | null>(null);
  btBrandRef.current = btBrand;
  const [moyuBusy, setMoyuBusy] = useState(false);
  const moyuBusyRef = useRef(false);
  moyuBusyRef.current = moyuBusy;
  const bluetoothResyncInFlightRef = useRef(false);
  const resyncBluetoothOnForegroundRef = useRef<() => Promise<void>>(
    async () => undefined,
  );
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
  /** 宽层步收到面转包时立刻拉 facelets（由引导轮询 effect 挂载）。 */
  const scrambleGuideLayerKickRef = useRef<(() => void) | null>(null);
  /** 宽层 / 中层：转动包 + 陀螺手势跟踪。 */
  const layerGestureTrackerRef = useRef<GuideLayerGestureTracker | null>(null);
  /** 本步已播过的整步层转动画相位（`progress:phase`），避免拆包重播。 */
  const layerGuideAnimKeyRef = useRef("");
  const confirmScrambleGuideLayerStepRef = useRef<() => void>(() => undefined);
  /** 游戏页跟转：由 GamePage 注册，仅 focus=游戏 时转发。 */
  const gameBluetoothMovesRef = useRef<
    ((samples: readonly MoyuMoveSample[]) => void) | null
  >(null);
  const gameBluetoothOrientationRef = useRef<((quat: MoyuQuat) => void) | null>(
    null,
  );
  /** 临时层转采集页：转发转动包。 */
  const layerCaptureMovesRef = useRef<
    ((samples: readonly MoyuMoveSample[]) => void) | null
  >(null);
  const [layerCaptureQuat, setLayerCaptureQuat] = useState<MoyuQuat | null>(
    null,
  );
  const btInspectPhaseRef = useRef<BluetoothInspectPhase>("off");
  btInspectPhaseRef.current = btInspectPhase;
  /** 连接时 facelets 对应的 setupAlg（从复原到当时状态）。 */
  const bluetoothSetupAlgRef = useRef("");
  /** 连接后全部实体转动，用于白上绿前复原判定。 */
  const bluetoothStateMovesRef = useRef<string[]>([]);
  /**
   * 本轮跟打乱起点（连接 setup，或刷新打乱时的当前绝对状态）。
   * 复盘回放从此起步再播打乱公式；不要求用户先手动还原。
   */
  const bluetoothScrambleSetupAlgRef = useRef("");
  /** 开表瞬间相对复原的 setup（不含开表当次转动）。 */
  const bluetoothSolveStartSetupRef = useRef("");
  /** 计时中转动轨迹（复盘 / 分段）。 */
  const bluetoothSolveTraceRef = useRef<SolveTraceSession | null>(null);
  /** 计时中已提交的手持朝向（含稳定防抖）。 */
  const bluetoothSolveOrientHoldRef = useRef<OrientationHoldState>(
    createOrientationHoldState(),
  );
  /** 打乱引导转体步：手持朝向稳定防抖。 */
  const scrambleGuideOrientHoldRef = useRef<OrientationHoldState>(
    createOrientationHoldState(),
  );
  /** 进入当前转体步时的手持四元数（相对增量判定，避免两端吸附后轴漂）。 */
  const scrambleGuideRotationFromQuatRef = useRef<MoyuQuat>(IDENTITY_QUAT);
  /**
   * 引导面转 BLE→公式帧的朝向基准（开局 / 对齐时采）。
   * 用 live 相对此基准吸附，避免长序列「表内期望 Δ」与真机漂移后 R/L 对调。
   */
  const scrambleGuideFaceRemapHomeQuatRef = useRef<MoyuQuat>(IDENTITY_QUAT);
  /** 当前转体步键：`${progress}:${token}`，变了才重采 from。 */
  const scrambleGuideRotationStepRef = useRef<string | null>(null);
  /** 引导步转动动画进行中：暂停 facelets 轮询贴图，避免冲掉中间帧。 */
  const scrambleGuideAnimatingRef = useRef(false);
  /**
   * 手势已 matched、正在等层转动画：挡住 facelets 抢跑硬切。
   * 与 {@link scrambleGuideAnimatingRef} 分开，避免 confirm 入口因 animating 早退导致永不推进。
   */
  const scrambleGuideMatchHoldRef = useRef(false);
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

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void resyncBluetoothOnForegroundRef.current();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void resyncBluetoothOnForegroundRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
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
  const scores = useMemo(() => scoreLog.list(), [scoreLog, scoreRevision]);

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
          // 含 M/r 时 animateMove 走 Twisty.alg；结束钉回与蓝牙引导一致。
          void cube.current?.showMoves(scrambleDisplayedMoves(next));
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
    bluetoothScrambleSetupAlgRef.current = setupAlg.trim();
    bluetoothSolveStartSetupRef.current = "";
    bluetoothSolveTraceRef.current = null;
    bluetoothSolveCheckGen.current += 1;
  }

  /**
   * 用设备绝对状态对表本地跟踪；保留解题轨迹，不清空计时中的复盘序列。
   * 优先用 facelets 贴 3D（固定色心）；无 facelets 时回退 setupAlg。
   * 打乱引导中层 / 宽层请用 {@link trackBluetoothSetupOnly}，避免 setAbsoluteAlg("M")。
   */
  function applyBluetoothStatusToCube(setupAlg: string, facelets?: string) {
    bluetoothSetupAlgRef.current = setupAlg;
    bluetoothStateMovesRef.current = [];
    bluetoothSolveCheckGen.current += 1;
    if (facelets) {
      cube.current?.setAbsoluteFromFacelets(facelets);
    } else {
      cube.current?.setAbsoluteAlg(setupAlg);
    }
  }

  /** 只更新蓝牙跟踪串，不改 3D（引导层跟随已贴公式 pattern / facelets）。 */
  function trackBluetoothSetupOnly(setupAlg: string) {
    bluetoothSetupAlgRef.current = setupAlg;
    bluetoothStateMovesRef.current = [];
    bluetoothSolveCheckGen.current += 1;
  }

  async function resyncBluetoothCubeOnForeground() {
    const visibilityState =
      document.visibilityState === "visible" ? "visible" : "hidden";
    if (
      !shouldRequestStatusOnForeground({
        visibilityState,
        connected: Boolean(moyuSessionRef.current),
        busy: moyuBusyRef.current,
        resyncInFlight: bluetoothResyncInFlightRef.current,
      })
    ) {
      return;
    }
    const session = moyuSessionRef.current;
    if (!session) {
      return;
    }
    bluetoothResyncInFlightRef.current = true;
    try {
      const status = await session.requestStatus();
      if (moyuSessionRef.current !== session) {
        return;
      }
      applyBluetoothStatusToCube(status.setupAlg);
      if (
        !shouldAbandonTimingAfterForegroundSolvedResync({
          timerPhase: timerPhaseRef.current,
          hasPendingSolveUi: hasPendingSolveUi(),
        })
      ) {
        return;
      }
      const checkGen = bluetoothSolveCheckGen.current;
      void isSolvedFromSetup(status.setupAlg, []).then((solved) => {
        if (!solved || checkGen !== bluetoothSolveCheckGen.current) {
          return;
        }
        if (
          !shouldAbandonTimingAfterForegroundSolvedResync({
            timerPhase: timerPhaseRef.current,
            hasPendingSolveUi: hasPendingSolveUi(),
          })
        ) {
          return;
        }
        // 息屏丢步，轨迹不完整：作废本局，不记成绩、不进复盘。
        abandonTimingAfterForegroundResync();
      });
    } catch {
      // 息屏后 GATT 偶发不可用；保留会话，下次可见或转动再试。
    } finally {
      bluetoothResyncInFlightRef.current = false;
    }
  }
  resyncBluetoothOnForegroundRef.current = resyncBluetoothCubeOnForeground;

  function bluetoothSetupBeforeMoves(): string {
    return bluetoothCubeAbsoluteAlg(
      bluetoothSetupAlgRef.current,
      bluetoothStateMovesRef.current,
    );
  }

  /** 蓝牙放弃 / 对表：按内存绝对状态重绘 3D，避免误显示复原态。 */
  function syncBluetoothCubeFromTrackedState() {
    cube.current?.cancelAnimation();
    cube.current?.setAbsoluteAlg(bluetoothSetupBeforeMoves());
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

  /** 引导中 BLE 面转映到公式帧所用朝向（相对开局 / 对齐基准）。 */
  function scrambleGuideLiveFaceOrientAlg(): string {
    return relativeOrientationAlg(
      scrambleGuideFaceRemapHomeQuatRef.current,
      currentBluetoothRelativeQuat(),
    );
  }

  function remapGuideBleFaceMove(
    bleMove: string,
    expectedToken?: string | null,
  ): string {
    return resolveGuideBleFaceMove(
      bleMove,
      expectedToken ??
        scrambleGuideRef.current?.displayMoves[
          scrambleGuideRef.current.progress
        ] ??
        null,
      scrambleGuideLiveFaceOrientAlg(),
    );
  }

  function beginBluetoothSolveTrace(startSetupAlg: string) {
    bluetoothSolveStartSetupRef.current = startSetupAlg;
    const session = createSolveTraceSession({
      scramble: scrambleMovesRef.current ?? "",
      scrambleSetupAlg: bluetoothScrambleSetupAlgRef.current,
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

  /**
   * 打乱引导转体（x/y/z）：固定中心魔方面转包不上报整机转，靠陀螺仪朝向到位后自动确认。
   * 以「进入该步时」的连续四元数为起点，吸附相对增量——避免绝对两端吸附后 z' 被认成 x'。
   */
  function syncScrambleGuideRotationsFromGyro(): void {
    if (
      focusRef.current.kind !== "计时" ||
      btInspectPhaseRef.current !== "off"
    ) {
      return;
    }
    const guide = scrambleGuideRef.current;
    if (!guide || guide.phase === "done" || guide.wrongStack.length > 0) {
      return;
    }
    const view = guidedScrambleView(guide);
    const manual = view.manualMove;
    const liveQuat = currentBluetoothRelativeQuat();
    if (!manual || !isRotationGuideToken(manual) || view.correction) {
      scrambleGuideOrientHoldRef.current = createOrientationHoldState(
        relativeOrientationAlg(
          scrambleGuideRotationFromQuatRef.current,
          liveQuat,
        ),
      );
      scrambleGuideRotationStepRef.current = null;
      return;
    }
    const stepKey = `${guide.progress}:${manual}`;
    if (scrambleGuideRotationStepRef.current !== stepKey) {
      scrambleGuideRotationStepRef.current = stepKey;
      scrambleGuideRotationFromQuatRef.current = liveQuat;
      scrambleGuideOrientHoldRef.current = createOrientationHoldState("");
    }
    const relativeAlg = relativeOrientationAlg(
      scrambleGuideRotationFromQuatRef.current,
      liveQuat,
    );
    const now = performance.now();
    const tick = tickOrientationHold(
      scrambleGuideOrientHoldRef.current,
      relativeAlg,
      now,
    );
    scrambleGuideOrientHoldRef.current = tick.state;
    if (!scrambleGuideRotationSatisfied("", tick.state.committed, manual)) {
      return;
    }
    const result = confirmGuidedManualStep(guide);
    if (result.kind === "need_manual") {
      return;
    }
    scrambleGuideRotationStepRef.current = null;
    scrambleGuideRotationFromQuatRef.current = IDENTITY_QUAT;
    scrambleGuideRef.current = result.guide;
    flushSync(() => {
      setScrambleGuide(guidedScrambleView(result.guide));
    });
    void paintScrambleGuideCube(result.guide);
    if (result.guide.phase === "done") {
      beginBluetoothInspect();
    }
  }

  /**
   * 引导已完成前缀（含连接 setup），供贴图与陀螺轨道基座共用。
   * 层转保持宽层/中层记号（与 scrub 终态一致）；alg 未变则 setAbsoluteAlg 跳过，避免到位闪切。
   */
  function scrambleGuidePaintAlg(guide: GuidedScramble): string {
    return joinAlgParts(
      bluetoothScrambleSetupAlgRef.current,
      guidePaintAlgPrefix(guide.displayMoves, guide.progress)
        .split(/\s+/)
        .filter(Boolean),
    );
  }

  /**
   * 引导贴纸写入（白名单）：仅步到位后钉公式前缀，或连接态已由
   * {@link applyBluetoothStatusToCube} 处理。过程中禁止用 facelets 重刷整盘。
   * 层转勿把 Δ 打进 mesh（否则 U' 高亮跑到背面像 B'）；对表用
   * {@link remapBleFaceMoveAfterLayerGyro}。
   * `setAbsoluteAlg` 在 alg 未变时会跳过，避免陀螺已到位再闪切。
   */
  function paintScrambleGuideCube(
    guide: GuidedScramble,
    _options?: { force?: boolean },
  ): Promise<void> {
    const paintAlg = scrambleGuidePaintAlg(guide);
    cube.current?.setOrientation(IDENTITY_QUAT);
    cube.current?.setAbsoluteAlg(paintAlg);
    return Promise.resolve();
  }

  /** 按引导视图挂/清 3D 高亮盒（确认推进后也要显式调用，避免与层转动画竞态丢盒）。 */
  function applyBluetoothGuideMoveHint(view: GuidedScrambleView | null): void {
    if (
      focusRef.current.kind !== "计时" ||
      !moyuSessionRef.current ||
      !view ||
      btInspectPhaseRef.current !== "off"
    ) {
      cube.current?.setMoveHint(null);
      return;
    }
    if (view.correction) {
      cube.current?.setMoveHint(guideTokenToCubingAlg(view.correction), {
        tone: "error",
      });
      return;
    }
    if (view.done) {
      cube.current?.setMoveHint(null);
      return;
    }
    if (view.expectedMove) {
      cube.current?.setMoveHint(guideTokenToCubingAlg(view.expectedMove), {
        tone: "guide",
        double: view.currentIsDouble,
        half: view.partial,
      });
      return;
    }
    if (view.manualMove && isHintableManualToken(view.manualMove)) {
      cube.current?.setMoveHint(guideTokenToCubingAlg(view.manualMove), {
        tone: "guide",
        double: /2/.test(view.manualMove),
      });
      return;
    }
    cube.current?.setMoveHint(null);
  }

  /** 宽层 / 中层 / 转体自动对表失败时的逃生：手动确认已到位并推进。 */
  function confirmScrambleGuideLayerStep(): void {
    // 先释放 matchHold，避免早退时 hold 永真、公式卡死。
    scrambleGuideMatchHoldRef.current = false;
    const guide = scrambleGuideRef.current;
    if (!guide || guide.phase === "done" || scrambleGuideAnimatingRef.current) {
      return;
    }
    const token = guide.displayMoves[guide.progress] ?? null;
    const kind = resolveLayerFollowKind(token);
    const isRotation = Boolean(token && isRotationGuideToken(token));
    if (kind !== "wide" && kind !== "slice" && !isRotation) {
      return;
    }
    const result = isRotation
      ? confirmGuidedManualStep(guide)
      : confirmGuidedFaceletsStep(guide);
    if (result.kind === "need_manual") {
      scrambleGuideAnimatingRef.current = false;
      return;
    }
    const logical = nonRotationAlgPrefix(
      result.guide.displayMoves,
      result.guide.progress,
    );
    trackBluetoothSetupOnly(
      joinAlgParts(
        bluetoothScrambleSetupAlgRef.current,
        logical.split(/\s+/).filter(Boolean),
      ),
    );
    scrambleGuideRotationStepRef.current = null;
    scrambleGuideRotationFromQuatRef.current = IDENTITY_QUAT;
    layerGestureTrackerRef.current = null;
    layerGuideAnimKeyRef.current = "";
    scrambleGuideAnimatingRef.current = true;
    // 调用方应已 await 动画空闲；此处只钉终态，避免 cancel 把可见动画掐成秒切。
    void paintScrambleGuideCube(result.guide, { force: true })
      .catch(() => undefined)
      .finally(() => {
        scrambleGuideAnimatingRef.current = false;
        scrambleGuideRef.current = result.guide;
        const view = guidedScrambleView(result.guide);
        flushSync(() => {
          setScrambleGuide(view);
        });
        // 贴图队列可能晚于 effect；推进后强制按新步重挂，避免快拧后高亮盒丢失。
        applyBluetoothGuideMoveHint(view);
        if (result.guide.phase === "done") {
          beginBluetoothInspect();
        }
      });
  }
  confirmScrambleGuideLayerStepRef.current = confirmScrambleGuideLayerStep;

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
      // 贴纸已含转体；观察期锁单位朝向，勿再叠绝对手持。
      cube.current?.setOrientation(IDENTITY_QUAT);
      return;
    }
    btInspectPhaseRef.current = "inspecting";
    setBtInspectPhase("inspecting");
    inspectEndsAtRef.current = Date.now() + BLUETOOTH_INSPECT_MS;
    setInspectRemainingMs(BLUETOOTH_INSPECT_MS);
    cube.current?.setMoveHint(null);
    cube.current?.setOrientation(IDENTITY_QUAT);
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
      scrambleGuideOrientHoldRef.current = createOrientationHoldState();
      scrambleGuideRotationStepRef.current = null;
      scrambleGuideRotationFromQuatRef.current = IDENTITY_QUAT;
      scrambleGuideFaceRemapHomeQuatRef.current = IDENTITY_QUAT;
      resetBluetoothInspect();
      return;
    }
    try {
      // 新一轮引导：以当前实体绝对状态为打乱起点（可不从还原态开始）。
      bluetoothScrambleSetupAlgRef.current = bluetoothSetupBeforeMoves();
      const guide = createGuidedScramble(moves);
      scrambleGuideRef.current = guide;
      scrambleGuideOrientHoldRef.current = createOrientationHoldState("");
      scrambleGuideRotationStepRef.current = null;
      const live = currentBluetoothRelativeQuat();
      scrambleGuideRotationFromQuatRef.current = live;
      scrambleGuideFaceRemapHomeQuatRef.current = live;
      setScrambleGuide(guidedScrambleView(guide));
      resetBluetoothInspect();
      // 贴纸已在连接时 facelets 写入；引导开始勿重贴（避免闪切 / 色序被 alg 覆盖）。
    } catch {
      scrambleGuideRef.current = null;
      setScrambleGuide(null);
      scrambleGuideOrientHoldRef.current = createOrientationHoldState();
      scrambleGuideRotationStepRef.current = null;
      scrambleGuideRotationFromQuatRef.current = IDENTITY_QUAT;
      scrambleGuideFaceRemapHomeQuatRef.current = IDENTITY_QUAT;
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

  /** 串行化面转引导，避免错包 reconcile 与正确包并发互相覆盖。 */
  const bluetoothGuideMovesChainRef = useRef(Promise.resolve());

  function applyBluetoothGuideMoves(samples: readonly MoyuMoveSample[]) {
    bluetoothGuideMovesChainRef.current = bluetoothGuideMovesChainRef.current
      .then(() => applyBluetoothGuideMovesAsync(samples))
      .catch(() => undefined);
  }

  async function applyBluetoothGuideMovesAsync(
    samples: readonly MoyuMoveSample[],
  ) {
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
        bluetoothScrambleSetupAlgRef.current = bluetoothSetupBeforeMoves();
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
      /** 字母错但 facelets 到位：3D 可能被错包带偏，步确认后钉一次公式前缀。 */
      let needStickerNail = false;
      for (; sampleIndex < samples.length; sampleIndex += 1) {
        const sample = samples[sampleIndex]!;
        // 色心已对上期望则不映；否则按 live 朝向映回（防噪声把 L→F，又保留未摆正 F'→U'）。
        const guideMove = remapGuideBleFaceMove(
          sample.move,
          next.displayMoves[next.progress] ?? null,
        );
        const result = applyGuidedMove(next, guideMove);
        if (result.kind === "wrong") {
          // 层转后偶发错面字母：以 facelets 为准，避免「期望 U 却提示转 F'」。
          const session = moyuSessionRef.current;
          if (session) {
            try {
              const status = await session.requestStatus();
              const reconcile = await reconcileFaceMoveWithFacelets({
                facelets: status.facelets,
                displayMoves: next.displayMoves,
                progress: next.progress,
                scrambleSetupAlg: bluetoothScrambleSetupAlgRef.current,
                readFacelets: async () => {
                  const again = await session.requestStatus();
                  return again.facelets;
                },
              });
              if (reconcile === "ignore_packet") {
                continue;
              }
              if (reconcile === "accept_progress") {
                const confirmed = confirmGuidedFaceletsStep(next);
                if (confirmed.kind !== "need_manual") {
                  next = confirmed.guide;
                  needStickerNail = true;
                  if (next.phase === "done") {
                    sampleIndex += 1;
                    break;
                  }
                  continue;
                }
              }
            } catch {
              // GATT 失败时仍按字母判错
            }
          }
        }
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
      const view = guidedScrambleView(next);
      // GATT 异步回调里强制同步刷新，避免部分 WebKit / Bluefy 丢更新。
      flushSync(() => {
        setScrambleGuide(view);
      });
      applyBluetoothGuideMoveHint(view);
      // 字母匹配的面转已由 playBluetoothMoves 跟手；勿每包重贴。
      // 仅 facelets 兜底推进时钉一次（3D 可能被错字母动画带偏）。
      if (needStickerNail) {
        void paintScrambleGuideCube(next);
      }
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

  function applyScramble(
    moves: string,
    resetTimer: boolean,
    options?: { startGuide?: boolean },
  ) {
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
    const connected = Boolean(moyuSessionRef.current);
    const startGuide = options?.startGuide ?? connected;
    if (connected && !startGuide) {
      syncScrambleGuide(null, false);
    } else {
      syncScrambleGuide(moves, connected);
    }
    if (resetTimer) {
      timer.current?.prepare();
      setTimerPhase("idle");
      timerPhaseRef.current = "idle";
    }
  }

  async function refreshScramble(resetTimer = true) {
    const moves = nextHomeScrambleMoves();
    // 未还原：以当前实体态为新一轮打乱起点，继续引导（不要求先还原）。
    if (moyuSessionRef.current) {
      try {
        const status = await moyuSessionRef.current.requestStatus();
        applyBluetoothStatusToCube(status.setupAlg, status.facelets);
        cube.current?.setOrbit(MOYU_REST_ORBIT);
      } catch {
        setToastMessage("无法读取魔方状态，请重连后再试");
        applyScramble(moves, resetTimer, { startGuide: false });
        return;
      }
    }
    applyScramble(moves, resetTimer, { startGuide: true });
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
      void refreshScramble();
    }
    // 计时首页默认还原态；非蓝牙由播放条跟播，不在刷新公式时写回 3D。
  }, [focus.kind, scrambleMoves]);

  // 蓝牙引导：3D 贴面弯箭头（VisualCube 风格；仅计时 + 已连接 + 引导中）
  useEffect(() => {
    applyBluetoothGuideMoveHint(scrambleGuide);
  }, [focus.kind, moyuSession, scrambleGuide, btInspectPhase]);

  // 打乱引导：宽层/中层 facelets 只对表；3D 跟手靠陀螺 scrub，禁止 poll 重贴贴纸。
  useEffect(() => {
    if (focus.kind !== "计时" || !moyuSession || !scrambleGuide) {
      return;
    }
    if (btInspectPhase !== "off" || scrambleGuide.done) {
      return;
    }
    const idx = scrambleGuide.currentIndex;
    if (idx == null) {
      return;
    }
    const stepToken = scrambleGuide.displayMoves[idx] ?? null;
    // 进入 z'/y 等转体步：停 facelets 轮询；贴纸沿用上步终态，勿重贴。
    if (stepToken && isRotationGuideToken(stepToken)) {
      return;
    }
    if (!resolveLayerFollowKind(stepToken) || !stepToken) {
      return;
    }
    layerGestureTrackerRef.current = syncGuideLayerGestureTracker(
      layerGestureTrackerRef.current,
      {
        progress: idx,
        expectedToken: stepToken,
        gyroBefore: currentBluetoothRelativeQuat(),
      },
    );
    layerGuideAnimKeyRef.current = "";
    const session = moyuSession;
    let cancelled = false;
    let lastFacelets: string | null = null;
    let settledSameCount = 0;
    /** 进入当前 progress 时的设备 facelets；漏报中层时用于避免误标 wrong。 */
    let entryFacelets: string | null = null;
    let entryProgress = -1;
    // facelets 只对表推进，不刷 3D 贴纸；间隔略密，转动包 kick 时补一拍。
    const pollMs = 140;
    const poll = async () => {
      if (
        cancelled ||
        moyuBusyRef.current ||
        scrambleGuideAnimatingRef.current
      ) {
        return;
      }
      const guide = scrambleGuideRef.current;
      if (!guide) {
        return;
      }
      const token = guide.displayMoves[guide.progress] ?? null;
      const kind = resolveLayerFollowKind(token);
      if (!token || !kind) {
        return;
      }
      try {
        const status = await session.requestStatus();
        if (
          cancelled ||
          moyuSessionRef.current !== session ||
          scrambleGuideAnimatingRef.current
        ) {
          return;
        }
        if (entryProgress !== guide.progress || entryFacelets === null) {
          entryFacelets = status.facelets;
          entryProgress = guide.progress;
        }
        const tick = await tickScrambleGuideLayerFollow({
          facelets: status.facelets,
          setupAlg: status.setupAlg,
          scrambleSetupAlg: bluetoothScrambleSetupAlgRef.current,
          displayMoves: guide.displayMoves,
          progress: guide.progress,
          token,
          kind,
          lastFacelets,
          settledSameCount,
          hasWrongMark: guide.wrongStack.length > 0,
          entryFacelets,
        });
        lastFacelets = tick.lastFacelets;
        settledSameCount = tick.settledSameCount;

        if (tick.shouldAdvance) {
          // 手势路径已在等层转动画：勿抢跑硬切，否则动画会被秒掐掉 / confirm 被堵死。
          if (
            scrambleGuideAnimatingRef.current ||
            scrambleGuideMatchHoldRef.current
          ) {
            return;
          }
          if (cube.current?.hasPendingBluetoothMoves()) {
            scrambleGuideAnimatingRef.current = true;
            // 陀螺跟手：收口补间后再等 pending 清空。
            await cube.current.finishGuideStepGyroTrack();
            await cube.current.awaitBluetoothMovesIdle(280);
            scrambleGuideAnimatingRef.current = false;
            if (
              cancelled ||
              scrambleGuideMatchHoldRef.current ||
              scrambleGuideAnimatingRef.current
            ) {
              return;
            }
          }
          const result = confirmGuidedFaceletsStep(guide);
          if (result.kind === "need_manual") {
            return;
          }
          layerGestureTrackerRef.current = null;
          trackBluetoothSetupOnly(tick.trackSetupAlg);
          // 陀螺/手势已跟到终点；alg 未变时 paint 会跳过。无轨道时钉一次公式前缀。
          await paintScrambleGuideCube(result.guide);
          if (cancelled) {
            return;
          }
          scrambleGuideRef.current = result.guide;
          const advancedView = guidedScrambleView(result.guide);
          flushSync(() => {
            setScrambleGuide(advancedView);
          });
          applyBluetoothGuideMoveHint(advancedView);
          scrambleGuideRotationStepRef.current = null;
          lastFacelets = null;
          settledSameCount = 0;
          entryFacelets = null;
          entryProgress = result.guide.progress;
          if (result.guide.phase === "done") {
            beginBluetoothInspect();
          }
          return;
        }

        // 动画中 / 拧动中：不对表结果重贴贴纸（避免闪切与色序乱）。
        if (cube.current?.hasPendingBluetoothMoves()) {
          return;
        }
        if (tick.shouldMarkWrong) {
          // 手势已在收包（E2 四包只到一半等）时，facelets 中间态勿误标 wrong。
          const tracker = layerGestureTrackerRef.current;
          if (
            tracker &&
            tracker.progress === guide.progress &&
            tracker.expectedToken === token &&
            tracker.samples.length > 0
          ) {
            return;
          }
          const next: GuidedScramble = {
            ...guide,
            wrongStack: [tick.wrongToken],
          };
          scrambleGuideRef.current = next;
          flushSync(() => {
            setScrambleGuide(guidedScrambleView(next));
          });
          return;
        }
        if (tick.shouldClearWrong) {
          const next: GuidedScramble = { ...guide, wrongStack: [] };
          scrambleGuideRef.current = next;
          flushSync(() => {
            setScrambleGuide(guidedScrambleView(next));
          });
        }
      } catch {
        // GATT 偶发失败时下一轮再试
      }
    };
    scrambleGuideLayerKickRef.current = () => {
      void poll();
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      scrambleGuideLayerKickRef.current = null;
    };
  }, [
    focus.kind,
    moyuSession,
    scrambleGuide?.manualMove,
    scrambleGuide?.expectedMove,
    scrambleGuide?.done,
    scrambleGuide?.currentIndex,
    btInspectPhase,
  ]);

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
    const from = focus.kind;
    const nextFocus = back(focus);
    setFocus(nextFocus);
    if (shouldClearGameOnLeaveGame(from, nextFocus.kind)) {
      // 游戏页卸载即清空；计时打乱保持原样。
      stopScramblePlay();
    }
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
    const bluetoothConnected = Boolean(moyuSessionRef.current);
    bluetoothSolveTraceRef.current = null;
    bluetoothSolveStartSetupRef.current = "";
    bluetoothSolveCheckGen.current += 1;
    resetBluetoothInspect();
    void refreshScramble(true);
    if (shouldSyncCubeAfterBluetoothAbandon(bluetoothConnected)) {
      // 蓝牙：3D 跟实体；先按本地跟踪重绘，再异步 requestStatus 对表。
      syncBluetoothCubeFromTrackedState();
      void resyncBluetoothCubeOnForeground();
    } else {
      resetNonBluetoothCubeToSolved();
    }
  }

  /** 回前台对表发现已复原：轨迹缺步，作废本局且不进成绩页。 */
  function abandonTimingAfterForegroundResync() {
    abandonTiming();
    setToastMessage("息屏期间转动未完整记录，本局未计成绩");
  }

  function resetCubeToSolvedPreview() {
    bluetoothSolveTraceRef.current = null;
    bluetoothSolveStartSetupRef.current = "";
    bluetoothScrambleSetupAlgRef.current = "";
    bluetoothSolveCheckGen.current += 1;
    bluetoothSetupAlgRef.current = "";
    bluetoothStateMovesRef.current = [];
    restoreCubeToWhiteUpGreenFront();
  }

  /** 断开蓝牙 / 预览复位：复原态 + 白上绿前朝向与默认相机。 */
  function restoreCubeToWhiteUpGreenFront() {
    cube.current?.cancelAnimation();
    cube.current?.setAbsoluteAlg("");
    cube.current?.setOrientation(IDENTITY_QUAT);
    cube.current?.setOrbit(MOYU_REST_ORBIT);
  }

  function openScoresPage() {
    setBrowseReview(null);
    setFocus(showScores());
  }

  function openGamePage() {
    stopScramblePlay();
    setFocus(showGame());
  }

  function openLayerCapturePage() {
    stopScramblePlay();
    setLayerCaptureQuat(null);
    setFocus(showLayerCapture());
  }

  function closeLayerCapturePage() {
    layerCaptureMovesRef.current = null;
    setLayerCaptureQuat(null);
    setFocus(showTiming());
  }

  const registerLayerCaptureMoves = useCallback(
    (sink: ((samples: readonly MoyuMoveSample[]) => void) | null) => {
      layerCaptureMovesRef.current = sink;
    },
    [],
  );

  function closeGamePage() {
    gameBluetoothMovesRef.current = null;
    gameBluetoothOrientationRef.current = null;
    setFocus(showTiming());
    stopScramblePlay();
    if (moyuSessionRef.current) {
      // 回首页后 3D 跟实体对表，避免游戏页跟转造成视觉脱节。
      syncBluetoothCubeFromTrackedState();
      void resyncBluetoothCubeOnForeground();
    }
  }

  const gamePageBluetooth = useMemo<GamePageBluetooth | null>(() => {
    if (!moyuSession) {
      return null;
    }
    return {
      registerMoves: (handler) => {
        gameBluetoothMovesRef.current = handler;
        return () => {
          if (gameBluetoothMovesRef.current === handler) {
            gameBluetoothMovesRef.current = null;
          }
        };
      },
      registerOrientation: (handler) => {
        gameBluetoothOrientationRef.current = handler;
        return () => {
          if (gameBluetoothOrientationRef.current === handler) {
            gameBluetoothOrientationRef.current = null;
          }
        };
      },
      requestSetupAlg: async () => {
        const session = moyuSessionRef.current;
        if (!session) {
          return null;
        }
        try {
          const status = await session.requestStatus();
          // 只读实体态给游戏页；不要清空首页 bluetoothStateMoves。
          // 否则 Cross 逐步对表会刷 requestStatus，丢步且回家后打乱 R' 对不上。
          return status.setupAlg;
        } catch {
          return null;
        }
      },
    };
  }, [moyuSession]);

  function deleteScore(scoreId: string) {
    if (!scoreLog.removeById(scoreId)) {
      return;
    }
    setScoreRevision((current) => current + 1);
    setLastSolveTimeMs(latestSolveTimeMs(scoreLog.list()));
  }

  function openScoreReview(score: Score) {
    if (!canOpenScoreReview(score)) {
      setToastMessage("该成绩无可复盘数据");
      return;
    }
    void buildSolveReviewFromScore(score).then((review) => {
      if (!review) {
        setToastMessage("该成绩无可复盘数据");
        return;
      }
      if (focusRef.current.kind !== "成绩") {
        return;
      }
      setBrowseReview(review);
    });
  }

  function closeBrowseReview() {
    setBrowseReview(null);
  }

  /** 用已有打乱回到计时首页再练；保留成绩，不撤销。 */
  function retryWithStoredScramble(scrambleRaw: string) {
    const scramble = scrambleRaw.trim();
    if (scramble === "") {
      setToastMessage("该成绩没有打乱公式");
      return;
    }
    setBrowseReview(null);
    // 先切回计时并挂载 scramble 朝向的 3D，再复位 / 刷引导，避免箭头画在旧 player 上。
    flushSync(() => {
      setFocus(showTiming());
    });
    resetCubeToSolvedPreview();
    applyScramble(scramble, true);
  }

  function retrySameScrambleFromList(score: Score) {
    retryWithStoredScramble(score.scramble);
  }

  function retryFromBrowseReview() {
    const review = browseReview;
    if (!review) {
      return;
    }
    retryWithStoredScramble(review.scramble);
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
        alg: phase.alg,
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
      trace: review.trace,
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
    void refreshScramble(!keepElapsedOnScrambleRefresh(timerPhaseRef.current));
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
          scrambleSetupAlg: bluetoothScrambleSetupAlgRef.current,
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
    void refreshScramble(!keepElapsedOnScrambleRefresh(timerPhaseRef.current));
  }

  /** 关闭复盘查看：不重复保存，刷新打乱进入下一轮。 */
  function closeSolveReviewView() {
    if (!pendingSolveReviewRef.current) {
      return;
    }
    setPendingSolveReview(null);
    void refreshScramble(!keepElapsedOnScrambleRefresh(timerPhaseRef.current));
  }

  /**
   * 再练一次：撤销进入复盘时写入的成绩，保留打乱，3D 复位白上绿前，
   * 蓝牙引导用户按公式重打实体。
   */
  function retrySolveReviewSameScramble() {
    const review = pendingSolveReviewRef.current;
    if (!review) {
      return;
    }
    let plan;
    try {
      plan = planSolveReviewRetry(review);
    } catch {
      return;
    }
    if (plan.discardPersistedScore) {
      scoreLog.removeNewest();
      setScoreRevision((current) => current + 1);
      setLastSolveTimeMs(latestSolveTimeMs(scoreLog.list()));
    }
    // 抬高 epoch，避免关闭时 popstate / cleanup 再走「刷新打乱」。
    solveReviewHistoryEpochRef.current += 1;
    pendingSolveReviewRef.current = null;
    setPendingSolveReview(null);
    // 先复位 3D，再刷引导；箭头与 setAbsoluteAlg 串行，避免第一拍无高亮。
    resetCubeToSolvedPreview();
    applyScramble(plan.scramble, true);
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

  /**
   * 打乱引导 3D 朝向：
   * - 面转 / 宽层 / 中层：mesh 锁单位（贴纸含层转记号；非 live 跟手）。
   * - 转体步：相对步起点增量跟手；确认后烘焙贴纸。
   */
  function syncScrambleGuideDisplayOrientation(
    guide: GuidedScramble | null = scrambleGuideRef.current,
    liveQuat: MoyuQuat | null = null,
  ): void {
    if (!guide || guide.phase === "done") {
      return;
    }
    const token = guide.displayMoves[guide.progress] ?? "";
    if (liveQuat && isRotationGuideToken(token)) {
      const stepKey = `${guide.progress}:${token}`;
      if (scrambleGuideRotationStepRef.current !== stepKey) {
        cube.current?.setOrientation(IDENTITY_QUAT);
        return;
      }
      cube.current?.setOrientation(
        relativeOrientationQuat(
          scrambleGuideRotationFromQuatRef.current,
          liveQuat,
        ),
      );
      return;
    }
    cube.current?.setOrientation(IDENTITY_QUAT);
  }

  function flushMoyuOrientation() {
    moyuOrbitRaf.current = 0;
    const quat = moyuPendingQuat.current;
    if (!quat) {
      return;
    }
    const orientation = moyuOrientation.current.toOrientation(quat);
    if (focusRef.current.kind === "采集") {
      setLayerCaptureQuat(orientation);
      return;
    }
    const guide = scrambleGuideRef.current;
    if (
      focusRef.current.kind === "计时" &&
      guide &&
      guide.phase !== "done" &&
      btInspectPhaseRef.current === "off"
    ) {
      // 先登记转体步起点，再跟手，避免首帧 from 仍是上一步。
      syncScrambleGuideRotationsFromGyro();
      syncScrambleGuideDisplayOrientation(guide, orientation);
      // 层转步：用陀螺相对转角驱动 3D 进度（与实体拧速同步）。
      const stepToken = guide.displayMoves[guide.progress] ?? "";
      const layerTracker = layerGestureTrackerRef.current;
      if (
        resolveLayerFollowKind(stepToken) &&
        layerTracker &&
        layerTracker.progress === guide.progress &&
        layerTracker.expectedToken === stepToken &&
        layerTracker.samples.length > 0
      ) {
        cube.current?.setGuideStepGyroProgress(
          layerGuideVisualProgress(
            stepToken,
            layerTracker.samples.length,
            layerTracker.gyroBefore,
            orientation,
          ),
        );
      }
      syncBluetoothSolveRotationsFromGyro();
      gameBluetoothOrientationRef.current?.(orientation);
      return;
    } else if (focusRef.current.kind === "计时" && guide?.phase === "done") {
      // 引导结束：贴纸已含转体，mesh 锁单位（与 paintScrambleGuideCube 一致）。
      cube.current?.setOrientation(IDENTITY_QUAT);
    } else {
      cube.current?.setOrientation(orientation);
    }
    // 游戏页自有 CubeView：同步陀螺仪朝向，使 z2 等整机转体跟上实体。
    gameBluetoothOrientationRef.current?.(orientation);
    syncScrambleGuideRotationsFromGyro();
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
    setBtBrand(null);
    btBrandRef.current = null;
    resetBluetoothCubeStateTracking();
    syncScrambleGuide(null, false);
    setMoyuNote(null);
    setBtDisconnectConfirmOpen(false);
    // 断开后回到白上绿前复原预览，不写回打乱目标。
    restoreCubeToWhiteUpGreenFront();
  }

  function onMoyuAlignOrientation() {
    try {
      const orientation = moyuOrientation.current.alignToCurrent();
      scrambleGuideRotationFromQuatRef.current = IDENTITY_QUAT;
      // 对齐后 tracker 相对当前为身份，面转 remap 基准同步归零。
      scrambleGuideFaceRemapHomeQuatRef.current = IDENTITY_QUAT;
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

  function onMoyuConnectClick() {
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
    void connectSmartCube();
  }

  function onBluetoothDisconnected() {
    resetMoyuOrientationFollow();
    setMoyuSession(null);
    moyuSessionRef.current = null;
    setBtBrand(null);
    btBrandRef.current = null;
    resetBluetoothCubeStateTracking();
    syncScrambleGuide(null, false);
    setBtDisconnectConfirmOpen(false);
    setMoyuNote("魔方已断开");
    restoreCubeToWhiteUpGreenFront();
  }

  async function connectSmartCube() {
    setMoyuBusy(true);
    setMoyuNote("正在选择魔方…");
    resetMoyuOrientationFollow();
    let brand: SmartCubeBrand | null = null;
    try {
      // 用户手势内立刻弹出系统选择窗；按设备名自动匹配品牌。
      const device = await requestSmartCubeDevice();
      brand = inferSmartCubeBrand(device.name);
      if (!brand) {
        throw new Error(
          "无法识别魔方品牌（设备名需为 WCU_MY3 / GAN / MG / AiCube 开头）",
        );
      }
      setMoyuNote(
        brand === "gan" ? "正在连接 Gan（优先自动读取地址）…" : "正在连接魔域…",
      );

      const askMacAddress = (deviceName: string) => {
        const entered = window.prompt(
          brand === "gan"
            ? `当前浏览器无法自动读地址（需 Chrome 实验特性，或手输一次）。\n可开 chrome://flags/#enable-experimental-web-platform-features 后重试；\n也可在官方 App 查看 MAC 后填入（之后会记住）。\n设备：${deviceName}`
            : `请输入魔方 MAC（可在官方 App 查看）\n设备：${deviceName}`,
          brand === "moyu" ? "CF:30:16:00:00:00" : "AA:BB:CC:DD:EE:FF",
        );
        return entered;
      };

      const onBluetoothMoves = (samples: readonly MoyuMoveSample[]) => {
        if (focusRef.current.kind === "游戏") {
          // 游戏页自有 CubeView + 跟转；仍记账，便于回首页对表。
          recordBluetoothStateMoves(samples);
          gameBluetoothMovesRef.current?.(samples);
          return;
        }
        if (focusRef.current.kind === "采集") {
          layerCaptureMovesRef.current?.(samples);
          return;
        }
        const guide = scrambleGuideRef.current;
        if (
          guide &&
          guide.phase !== "done" &&
          btInspectPhaseRef.current === "off"
        ) {
          const kind = resolveLayerFollowKind(
            guide.displayMoves[guide.progress] ?? null,
          );
          const stepToken = guide.displayMoves[guide.progress] ?? "";
          if (kind) {
            // 宽层 / 中层：不播固件外层拆包；3D 由陀螺进度跟手（无速度字段）。
            if (shouldPlayBluetoothMoveAnim(kind)) {
              cube.current?.playBluetoothMoves(samples);
            }
            const token = guide.displayMoves[guide.progress] ?? "";
            let tracker = layerGestureTrackerRef.current;
            if (
              tracker &&
              tracker.progress === guide.progress &&
              tracker.expectedToken === token
            ) {
              const beforeCount = tracker.samples.length;
              const newSamples = samples.map((sample) => ({
                move: sample.move,
                intervalMs: sample.intervalMs,
              }));
              tracker = appendGuideLayerGestureMoves(
                tracker,
                newSamples,
                performance.now(),
              );
              layerGestureTrackerRef.current = tracker;
              // 首包即开陀螺轨道，后续 orientation 帧按转角 scrub。
              if (beforeCount === 0 && tracker.samples.length > 0) {
                const animKey = `${guide.progress}:gyro`;
                if (layerGuideAnimKeyRef.current !== animKey) {
                  layerGuideAnimKeyRef.current = animKey;
                  void cube.current?.startGuideStepGyroTrack(
                    guideTokenToCubingAlg(token),
                    scrambleGuidePaintAlg(guide),
                  );
                }
              }
              const live = (() => {
                const last = moyuOrientation.current.lastQuat();
                return last
                  ? moyuOrientation.current.toOrientation(last)
                  : null;
              })();
              cube.current?.setGuideStepGyroProgress(
                layerGuideVisualProgress(
                  token,
                  tracker.samples.length,
                  tracker.gyroBefore,
                  live,
                ),
              );
              const ev = evaluateGuideLayerGesture(tracker, live);
              if (ev.status === "matched") {
                scrambleGuideMatchHoldRef.current = true;
                void (async () => {
                  try {
                    // 先补间到终点（跟手进度常被包齐软封顶），再确认推进。
                    await cube.current?.finishGuideStepGyroTrack();
                    confirmScrambleGuideLayerStepRef.current();
                  } catch {
                    scrambleGuideMatchHoldRef.current = false;
                  }
                })();
                return;
              }
            }
            scrambleGuideLayerKickRef.current?.();
            return;
          }
          if (isFaceGuideToken(stepToken)) {
            // 外层面转（含 R2）：转动包推进 + 动画；半步走 applyGuidedMove，勿走 facelets wrong。
            // 3D 播公式帧字母（live 朝向映射后），与高亮一致；记账仍用原始色心包。
            const playSamples = samples.map((sample) => ({
              ...sample,
              move: remapGuideBleFaceMove(sample.move, stepToken),
            }));
            cube.current?.playBluetoothMoves(playSamples);
            applyBluetoothGuideMovesRef.current(samples);
            return;
          }
          return;
        }
        cube.current?.playBluetoothMoves(samples);
        applyBluetoothGuideMovesRef.current(samples);
      };

      const session =
        brand === "moyu"
          ? await connectMoyuCube({
              device,
              onDisconnected: onBluetoothDisconnected,
              onMoves: onBluetoothMoves,
              onOrientation: onMoyuOrientation,
              askMacAddress,
            })
          : await connectGanCubeSession({
              onDisconnected: onBluetoothDisconnected,
              onMoves: onBluetoothMoves,
              onOrientation: onMoyuOrientation,
              askMacAddress,
              getCachedMac: (selected) => {
                if (!selected.id) {
                  return null;
                }
                try {
                  return localStorage.getItem(ganMacStorageKey(selected.id));
                } catch {
                  return null;
                }
              },
              rememberMac: (selected, mac) => {
                if (!selected.id) {
                  return;
                }
                const normalized = normalizeGanMacAddress(mac);
                if (!normalized) {
                  return;
                }
                try {
                  localStorage.setItem(
                    ganMacStorageKey(selected.id),
                    normalized,
                  );
                } catch {
                  // 隐私模式等写失败时忽略。
                }
              },
              connectImpl: (askMac) =>
                connectGanCubeWithDevice(device, async (selected, isFallback) =>
                  askMac(selected, isFallback),
                ),
            });

      // 在 await 间隙也视为已连接，避免 applyScramble 误清引导。
      moyuSessionRef.current = session;
      setMoyuSession(session);
      setBtBrand(brand);
      btBrandRef.current = brand;
      setMoyuNote(null);
      const status = await session.requestStatus();
      resetBluetoothCubeStateTracking(status.setupAlg);
      // 必须用 facelets 贴实体；勿先用公式复原态盖住已打乱的魔方。
      // 未还原：以当前态为打乱起点，立刻开引导。
      applyBluetoothStatusToCube(status.setupAlg, status.facelets);
      cube.current?.setOrbit(MOYU_REST_ORBIT);
      syncScrambleGuide(scrambleMovesRef.current, true);
      await session.enableGyro();
    } catch (error) {
      resetMoyuOrientationFollow();
      setMoyuSession(null);
      moyuSessionRef.current = null;
      setBtBrand(null);
      btBrandRef.current = null;
      resetBluetoothCubeStateTracking();
      syncScrambleGuide(null, false);
      setMoyuNote(
        brand === "gan"
          ? formatGanConnectError(error)
          : formatMoyuConnectError(error),
      );
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
          onRetrySameScramble={retrySolveReviewSameScramble}
        />
      ) : null}
      {browseReview ? (
        <SolveReviewPage
          review={browseReview}
          onBack={closeBrowseReview}
          onRetrySameScramble={retryFromBrowseReview}
        />
      ) : null}
      {focus.kind === "游戏" ? (
        <GamePage
          onBack={closeGamePage}
          initialScramble={scrambleMoves}
          bluetooth={gamePageBluetooth}
        />
      ) : null}
      {focus.kind === "采集" ? (
        <LayerCapturePage
          connected={Boolean(moyuSession)}
          liveQuat={layerCaptureQuat}
          onBack={closeLayerCapturePage}
          registerMovesSink={registerLayerCaptureMoves}
        />
      ) : null}
      <header
        className={focus.kind === "计时" ? "topbar topbar-timing" : "topbar"}
        hidden={
          focus.kind === "游戏" || focus.kind === "采集"
            ? true
            : focus.kind === "计时"
              ? !timingShellVisible(timerPhase, "topbar", timingShellOpts)
              : false
        }
      >
        {focus.kind === "练习" || focus.kind === "成绩" ? (
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
          <div className="topbar-start">
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
            <button
              type="button"
              className="scores-entry game-entry"
              aria-label="游戏"
              title="游戏"
              onClick={openGamePage}
            >
              <svg
                className="scores-entry-svg"
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
                <rect x="3.5" y="7.5" width="17" height="11" rx="3" />
                <path d="M8 11v5M5.5 13.5h5" />
                <circle cx="15.25" cy="12" r="1.1" />
                <circle cx="17.75" cy="14.5" r="1.1" />
              </svg>
            </button>
            <button
              type="button"
              className="scores-entry"
              aria-label="成绩"
              title="成绩"
              onClick={openScoresPage}
            >
              <svg
                className="scores-entry-svg"
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
                <path d="M4 19V5" />
                <path d="M4 19h16" />
                <path d="M7 15l4-5 3 2.5 5-7" />
              </svg>
            </button>
          </div>
        )}
        {focus.kind === "计时" && moyuSession ? (
          <button
            type="button"
            className="bt-align bt-align-icon topbar-align"
            disabled={moyuBusy}
            aria-label="层转采集"
            title="层转采集（临时）"
            onClick={openLayerCapturePage}
          >
            <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>采</span>
          </button>
        ) : null}
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
        hidden={focus.kind === "游戏" || focus.kind === "采集"}
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
              onConfirmLayerStep={
                moyuSession ? confirmScrambleGuideLayerStep : undefined
              }
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
                    onStart={() => moveScrambleCursor(scrambleAtStart, "snap")}
                    onPrevious={() =>
                      moveScrambleCursor(scrambleStepPrevious, "back")
                    }
                    onPlay={() => void onScramblePlay()}
                    onNext={() =>
                      moveScrambleCursor(scrambleStepNext, "forward")
                    }
                    onTarget={() => moveScrambleCursor(scrambleAtEnd, "snap")}
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
              onPlayScramble={() => {
                void onScramblePlay();
              }}
            />
          ) : null}
        </div>
        {focus.kind === "计时" && shouldShowAbandonTimingControl(timerPhase) ? (
          <TimingAbandonButton onAbandon={abandonTiming} />
        ) : null}
        <div className="slot-scores" hidden={focus.kind !== "成绩"}>
          <ScoreListPage
            scores={scores}
            onOpenReview={openScoreReview}
            onRetrySameScramble={retrySameScrambleFromList}
            onDelete={deleteScore}
          />
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
