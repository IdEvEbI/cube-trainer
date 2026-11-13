import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IDENTITY_QUAT, type MoyuQuat } from "../bluetooth/moyu/orientation.ts";
import type { MoyuMoveSample } from "../bluetooth/moyu/packets.ts";
import { CubeView, type CubeHandle } from "../cube/CubeView.tsx";
import { PracticeControls } from "../practice/PracticeControls.tsx";
import {
  createOrientationHoldState,
  nearestCubeOrientationAlg,
  scrambleGuideRotationSatisfied,
  tickOrientationHold,
  type OrientationHoldState,
} from "../score/cubeOrientation.ts";
import {
  applyGuidedMove,
  confirmGuidedManualStep,
  createGuidedMoves,
  guidedScrambleView,
  isHintableManualToken,
  isRotationGuideToken,
  isSliceGuideToken,
  isWideGuideToken,
  seekGuidedProgress,
  type GuidedScramble,
  type GuidedScrambleView,
} from "../scramble/guided.ts";
import { joinAlgParts } from "../scramble/bluetoothSolve.ts";
import { layerGuideVisualProgress } from "../scramble/layerGuideGyroFollow.ts";
import { SCRAMBLE_PLAYBACK_STEP_MS } from "../scramble/playback.ts";
import { randomScramble3x3 } from "../scramble/scramble.ts";
import {
  resolveLayerFollowKind,
  shouldPlayBluetoothMoveAnim,
} from "../scramble/scrambleGuideLayerFollow.ts";
import {
  appendGuideLayerGestureMoves,
  evaluateGuideLayerGesture,
  syncGuideLayerGestureTracker,
  type GuideLayerGestureTracker,
} from "../scramble/scrambleGuideLayerGesture.ts";
import {
  guidePaintAlgPrefix,
  guideProgressMatchesCube,
  guideTokenToCubingAlg,
} from "./algStateMatch.ts";
import { tokenizeAlg, type CfopPhaseSolution } from "./cfopSolve.ts";
import { solveCfopGame } from "./cfopSolve.ts";
import {
  applyGuideFaceRemapHomeLive,
  clearGuideFaceRemapHome,
  createGuideFaceRemapHomeState,
  guideBleFaceOrientCandidates,
  resolveGuideBleFaceMoveWithCandidates,
  syncGuideFaceRemapHome,
} from "../scramble/guideBleFaceRemap.ts";
import {
  absoluteMoveToGripGuide,
  completedOrientationMoves,
  relativeOrientationAlg,
} from "./guideOrientation.ts";
import { applyGuidedBleAbsoluteMoveWithOrientAlgs } from "./guidedAbsolute.ts";
import { manualStepReachedOnCube } from "./manualStepSync.ts";
import {
  buildGameSolveOverview,
  type GameSolveOverview,
} from "./gameOverview.ts";
import {
  createGamePageCursor,
  gamePageActiveSegmentId,
  gamePageAtEnd,
  gamePageAtIndex,
  gamePageDisplayedAlg,
  gamePageProgressLabel,
  gamePageStepNext,
  gamePageStepPrevious,
  isGamePageAtEnd,
  isGamePageAtStart,
  nextGamePagePlayRange,
  type GamePageCursor,
  type GameSegmentId,
} from "./gamePlayback.ts";
import "../score/solveReview.css";
import "../practice/practice.css";
import "../scramble/scramble.css";
import "./gamePage.css";

/** 宽层 / 中层对表轮询间隔，避免刷爆 BLE requestStatus。 */
const MANUAL_STATE_POLL_MS = 450;
/** 宽层 / 中层确认后忽略面转包，避免同一次拧转的 U/D 冲进后续 L' 等步。 */
const MANUAL_STEP_QUIET_MS = 550;

/** Cross 段内（含刚完成 Cross 最后一步）才启用活朝向映射与逐步对表。 */
function isCrossGuideProgress(
  cursor: GamePageCursor,
  progress: number,
): boolean {
  const cross = cursor.segments.find((segment) => segment.id === "Cross");
  if (!cross) {
    return false;
  }
  return progress >= cross.start && progress <= cross.end;
}

export type GamePageBluetooth = {
  /** 注册跟转回调；返回注销函数。 */
  registerMoves: (
    handler: (samples: readonly MoyuMoveSample[]) => void,
  ) => () => void;
  /** 注册陀螺仪朝向（已校准到 Twisty）；返回注销函数。 */
  registerOrientation: (handler: (quat: MoyuQuat) => void) => () => void;
  /** 读实体当前绝对 setupAlg；失败返回 null。 */
  requestSetupAlg: () => Promise<string | null>;
};

function phaseTone(
  id: GameSegmentId,
): "scramble" | "cross" | "f2l" | "oll" | "pll" {
  if (id === "scramble") {
    return "scramble";
  }
  if (id === "Cross") {
    return "cross";
  }
  if (id === "OLL") {
    return "oll";
  }
  if (id === "PLL") {
    return "pll";
  }
  return "f2l";
}

function applyCursorToCube(handle: CubeHandle | null, cursor: GamePageCursor) {
  if (!handle) {
    return;
  }
  void handle.showMoves(gamePageDisplayedAlg(cursor));
}

function applyMoveHint(
  handle: CubeHandle | null,
  view: GuidedScrambleView | null,
  bluetooth: boolean,
) {
  if (!handle || !bluetooth || !view) {
    handle?.setMoveHint(null);
    return;
  }
  /**
   * mesh 锁单位、公式 alg 已含 z2 等转体时，高亮直接画握持记号（与首页一致）。
   * 勿再按 z2 映到绝对面，否则会与 alg 内转体叠成白上。
   */
  const toPuzzle = (token: string) => guideTokenToCubingAlg(token);
  if (view.correction) {
    handle.setMoveHint(toPuzzle(view.correction), { tone: "error" });
    return;
  }
  if (view.done) {
    handle.setMoveHint(null);
    return;
  }
  if (view.expectedMove) {
    handle.setMoveHint(toPuzzle(view.expectedMove), {
      tone: "guide",
      double: view.currentIsDouble,
      half: view.partial,
    });
    return;
  }
  // 转体 / 宽层 / 中层：画高亮盒（蓝牙通常不按单步面转上报）。
  if (view.manualMove && isHintableManualToken(view.manualMove)) {
    const double = /2/.test(view.manualMove);
    handle.setMoveHint(toPuzzle(view.manualMove), { tone: "guide", double });
    return;
  }
  handle.setMoveHint(null);
}

function manualStepHintText(token: string): string {
  if (isRotationGuideToken(token)) {
    return `下一步 ${token}（整机转体，到位后自动继续）`;
  }
  if (isWideGuideToken(token)) {
    return `请完成宽层：${token}（到位后自动继续）`;
  }
  if (isSliceGuideToken(token)) {
    return `请完成中层：${token}（到位后自动继续）`;
  }
  return `请完成：${token}`;
}

function renderPhaseMoves(
  moves: readonly string[],
  segmentStart: number,
  currentIndex: number | null,
) {
  if (moves.length === 0) {
    return <span className="game-phase-empty">—</span>;
  }
  return moves.map((move, offset) => {
    const flatIndex = segmentStart + offset;
    let stepClass = "scramble-step game-step";
    if (currentIndex !== null && flatIndex < currentIndex) {
      stepClass += " is-done";
    } else if (currentIndex !== null && flatIndex === currentIndex) {
      stepClass += " is-current";
    }
    return (
      <span
        key={`${segmentStart}-${offset}-${move}`}
        className={stepClass}
        aria-current={currentIndex === flatIndex ? "step" : undefined}
      >
        {move}
      </span>
    );
  });
}

export function GamePage({
  onBack,
  initialScramble = null,
  bluetooth = null,
}: {
  onBack: () => void;
  /** 首页当前打乱；空则进入时自行生成。 */
  initialScramble?: string | null;
  /** 已连接蓝牙时传入；未连接为 null，走非蓝牙回放。 */
  bluetooth?: GamePageBluetooth | null;
}) {
  const cube = useRef<CubeHandle | null>(null);
  const focusSegmentIdRef = useRef<GameSegmentId | null>(null);
  const cursorRef = useRef<GamePageCursor | null>(null);
  const guideRef = useRef<GuidedScramble | null>(null);
  const playingRef = useRef(false);
  const playRun = useRef(0);
  const motionGen = useRef(0);
  const requestGen = useRef(0);
  const bluetoothRef = useRef(bluetooth);
  bluetoothRef.current = bluetooth;
  const orientHoldRef = useRef<OrientationHoldState>(
    createOrientationHoldState(),
  );
  /** 最近一帧陀螺仪；转体步与匹配用；3D 显示锁公式朝向。 */
  const lastLiveOrientRef = useRef<MoyuQuat | null>(null);
  /**
   * 逻辑绝对态（公式前缀），供 Cross 校验；不跟 facelets 对偶串。
   * 贴纸白名单：过程中禁止用 BLE setup 重刷 3D。
   */
  const bleAbsSetupRef = useRef("");
  /** 进游戏时的连接 setup（通常 "" 或当前实体态）；钉公式前缀时作前缀。 */
  const gameGuidePaintBaseRef = useRef("");
  /** Cross 活朝向映射变化时才重画高亮，避免每帧重建箭头抖动。 */
  const crossHintOrientKeyRef = useRef("");
  /** 转体步：进入该步时的手持，用作相对 Δ（与首页打乱引导一致）。 */
  const rotationStepKeyRef = useRef<string | null>(null);
  const rotationFromQuatRef = useRef<MoyuQuat>(IDENTITY_QUAT);
  /**
   * 面转映面 home（与首页共用 {@link syncGuideFaceRemapHome}）：
   * 公式 x/y/z 键变时采 live；层转不更新。
   */
  const faceRemapHomeRef = useRef(createGuideFaceRemapHomeState());
  const statePollBusyRef = useRef(false);
  const statePollKickRef = useRef<(() => void) | null>(null);
  /** 进入当前手动步时的公式前缀（非 facelets），供增量对表。 */
  const manualSyncSetupRef = useRef<string | null>(null);
  const manualSyncKeyRef = useRef<string | null>(null);
  const manualQuietUntilRef = useRef(0);
  /** 宽层 / 中层：手势 tracker + 陀螺 scrub（与首页 L0–L9 同路径）。 */
  const layerGuideAnimKeyRef = useRef<string | null>(null);
  const layerGestureTrackerRef = useRef<GuideLayerGestureTracker | null>(null);
  const layerMatchHoldRef = useRef(false);

  const [scramble, setScramble] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [phases, setPhases] = useState<CfopPhaseSolution[]>([]);
  const [overview, setOverview] = useState<GameSolveOverview>({
    moves: 0,
    rotations: 0,
  });
  const [cursor, setCursor] = useState<GamePageCursor | null>(null);
  const [playing, setPlaying] = useState(false);
  const [focusSegmentId, setFocusSegmentId] = useState<GameSegmentId | null>(
    null,
  );
  const [guideView, setGuideView] = useState<GuidedScrambleView | null>(null);
  focusSegmentIdRef.current = focusSegmentId;

  const bluetoothOn = Boolean(bluetooth);

  function stopPlay() {
    playRun.current += 1;
    motionGen.current += 1;
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      cube.current?.cancelAnimation();
      if (cursorRef.current && !bluetoothRef.current) {
        applyCursorToCube(cube.current, cursorRef.current);
      }
    }
  }

  /**
   * 公式已完成转体（x/y/z）。打乱段为空；Cross 起含 z2。
   */
  function formulaOrientationMovesForGuide(guide: GuidedScramble): string[] {
    return completedOrientationMoves(guide.displayMoves, guide.progress);
  }

  function formulaHasYellowUp(formula: readonly string[]): boolean {
    return formula.some((move) => {
      const token = move.trim();
      return token === "z2" || token === "z2'" || token.startsWith("z2 ");
    });
  }

  /** 公式转体键 → 共用 home 状态机。 */
  function syncFaceRemapHome(guide: GuidedScramble) {
    const formula = formulaOrientationMovesForGuide(guide);
    faceRemapHomeRef.current = syncGuideFaceRemapHome(
      faceRemapHomeRef.current,
      {
        orientsKey: formula.join(" "),
        active: formulaHasYellowUp(formula),
        liveQuat: lastLiveOrientRef.current,
      },
    );
  }

  /**
   * 跟拧映面候选：共用 {@link guideBleFaceOrientCandidates}。
   * 打乱段（尚无 z2）：只返回空串（色心绝对面）。
   * 含 z2：公式姿态作 relative 基准（防 z2 双计），并回退相对取反 / 仅公式 / 层转期望 Δ。
   */
  function faceOrientCandidatesForGuide(guide: GuidedScramble): string[] {
    const formula = formulaOrientationMovesForGuide(guide);
    if (!formulaHasYellowUp(formula)) {
      return [""];
    }
    syncFaceRemapHome(guide);
    const live = lastLiveOrientRef.current;
    if (live) {
      faceRemapHomeRef.current = applyGuideFaceRemapHomeLive(
        faceRemapHomeRef.current,
        live,
      );
    }
    return guideBleFaceOrientCandidates({
      formulaOrients: formula,
      homeQuat: faceRemapHomeRef.current.homeQuat,
      liveQuat: live,
    });
  }

  /** 高亮 / 公式帧：仅公式转体，不含实况 yaw。 */
  function hintOrientationMovesForGuide(guide: GuidedScramble): string[] {
    return formulaOrientationMovesForGuide(guide);
  }

  /** 公式已完成前缀（不含当前步），作层转对表基线与钉贴纸。 */
  function formulaPaintAlg(guide: GuidedScramble): string {
    const base = cursorRef.current;
    if (!base) {
      return gameGuidePaintBaseRef.current;
    }
    return joinAlgParts(
      gameGuidePaintBaseRef.current,
      guidePaintAlgPrefix(base.flatMoves, guide.progress)
        .split(/\s+/)
        .filter(Boolean),
    );
  }

  /**
   * 3D 朝向（与首页打乱引导一致）：
   * - 转体步：跟手持，用户能看见 z2 翻转；
   * - 其余：mesh 锁单位，黄上/转体只写在公式 alg 里（避免 alg⊕mesh 双计仍白上）。
   */
  function syncGuideDisplayOrientation(
    guide: GuidedScramble,
    liveQuat: MoyuQuat | null = lastLiveOrientRef.current,
  ) {
    const view = guidedScrambleView(guide);
    const onRotation = Boolean(
      view.manualMove &&
        isRotationGuideToken(view.manualMove) &&
        !view.correction,
    );
    if (onRotation && liveQuat) {
      cube.current?.setOrientation(liveQuat);
      return;
    }
    cube.current?.setOrientation(IDENTITY_QUAT);
  }

  /**
   * 步到位后写公式前缀（与首页打乱引导同一路径）：`setAbsoluteAlg` 旋转，
   * 勿改 pattern 贴图。宽层/中层色心跟 Twisty 公式语义（如 z2…l 后顶心蓝）。
   * mesh 单位；过程中禁止用 facelets 重刷整盘。
   */
  function paintGameGuideCube(guide: GuidedScramble): Promise<void> {
    const paintAlg = formulaPaintAlg(guide);
    bleAbsSetupRef.current = paintAlg;
    cube.current?.setOrientation(IDENTITY_QUAT);
    cube.current?.setAbsoluteAlg(paintAlg);
    return Promise.resolve();
  }

  function publishGuide(guide: GuidedScramble) {
    guideRef.current = guide;
    syncFaceRemapHome(guide);
    const view = guidedScrambleView(guide);
    flushSync(() => {
      setGuideView(view);
    });
    const hintOrients = hintOrientationMovesForGuide(guide);
    crossHintOrientKeyRef.current = [
      hintOrients.join(" "),
      view.correction ?? "",
      view.expectedMove ?? "",
      view.manualMove ?? "",
      view.partial ? "1" : "0",
      view.currentIsDouble ? "1" : "0",
    ].join("|");
    applyMoveHint(cube.current, view, Boolean(bluetoothRef.current));
    syncGuideDisplayOrientation(guide);
    const base = cursorRef.current;
    if (base) {
      const next = gamePageAtIndex(base, guide.progress);
      cursorRef.current = next;
      setCursor(next);
    }
  }

  async function rejectCrossProgressIfStateMismatch(
    before: GuidedScramble,
    after: GuidedScramble,
    absoluteMove: string,
    orientation: readonly string[],
  ): Promise<GuidedScramble> {
    const base = cursorRef.current;
    if (!base || !isCrossGuideProgress(base, after.progress)) {
      return after;
    }
    // 本地绝对态校验（无 GATT），避免逐步 requestStatus 丢步、回家后 R' 失灵。
    if (
      await guideProgressMatchesCube(
        base.flatMoves,
        after.progress,
        bleAbsSetupRef.current,
      )
    ) {
      return after;
    }
    const gripWrong = absoluteMoveToGripGuide(absoluteMove, orientation);
    return applyGuidedMove(before, gripWrong).guide;
  }

  function tryConfirmManualFromGuide() {
    const guide = guideRef.current;
    if (!guide || !bluetoothRef.current) {
      return;
    }
    const result = confirmGuidedManualStep(guide);
    if (result.kind === "need_manual") {
      return;
    }
    // 下一步手动对表基线待进入时重采。
    manualSyncKeyRef.current = null;
    manualSyncSetupRef.current = null;
    layerGuideAnimKeyRef.current = null;
    layerGestureTrackerRef.current = null;
    layerMatchHoldRef.current = false;
    // 吞掉宽层拧转残留的面转包，防止 d 之后的 U/D 被当成 L'。
    manualQuietUntilRef.current = performance.now() + MANUAL_STEP_QUIET_MS;
    const beforeProgress = guide.progress;
    void (async () => {
      try {
        await cube.current?.finishGuideStepGyroTrack();
      } catch {
        // 无轨道时忽略
      }
      // 钉公式前缀（含 S'/f），勿用 facelets 对偶重贴；须 await 以免丢贴。
      await paintGameGuideCube(result.guide);
      publishGuide(result.guide);
      const base = cursorRef.current;
      if (!base || !isCrossGuideProgress(base, result.guide.progress)) {
        return;
      }
      void guideProgressMatchesCube(
        base.flatMoves,
        result.guide.progress,
        bleAbsSetupRef.current,
      ).then((ok) => {
        if (ok || !guideRef.current) {
          return;
        }
        publishGuide(seekGuidedProgress(guideRef.current, beforeProgress));
      });
    })();
  }

  /** 进入层转步：用公式前缀作对表基线；登记陀螺起点（勿等首包，否则 scrub 卡半程）。 */
  function ensureManualSyncSetup(
    guideKey: string,
    guide: GuidedScramble,
  ): string {
    if (
      manualSyncKeyRef.current === guideKey &&
      manualSyncSetupRef.current !== null
    ) {
      return manualSyncSetupRef.current;
    }
    const syncSetup = formulaPaintAlg(guide);
    const token = guide.displayMoves[guide.progress] ?? "";
    manualSyncKeyRef.current = guideKey;
    manualSyncSetupRef.current = syncSetup;
    layerGuideAnimKeyRef.current = null;
    layerGestureTrackerRef.current = syncGuideLayerGestureTracker(null, {
      progress: guide.progress,
      expectedToken: token,
      gyroBefore: lastLiveOrientRef.current,
    });
    return syncSetup;
  }

  function showCursor(next: GamePageCursor) {
    motionGen.current += 1;
    cursorRef.current = next;
    setCursor(next);
    cube.current?.cancelAnimation();
    if (!bluetoothRef.current) {
      applyCursorToCube(cube.current, next);
    }
  }

  function resetGuideFromCursor(next: GamePageCursor, progress = 0) {
    const guide = seekGuidedProgress(
      createGuidedMoves(next.flatMoves),
      progress,
    );
    publishGuide(guide);
  }

  function loadScramble(nextScramble: string) {
    const tokens = tokenizeAlg(nextScramble);
    const requestId = ++requestGen.current;
    stopPlay();
    focusSegmentIdRef.current = null;
    setFocusSegmentId(null);
    setScramble(nextScramble);
    setPhases([]);
    setOverview({ moves: 0, rotations: 0 });
    cursorRef.current = null;
    setCursor(null);
    guideRef.current = null;
    setGuideView(null);
    faceRemapHomeRef.current = clearGuideFaceRemapHome();
    cube.current?.setMoveHint(null);
    setStatus("loading");
    setError(null);
    void cube.current?.showMoves("");
    void solveCfopGame(nextScramble)
      .then(async (solved) => {
        if (requestGen.current !== requestId) {
          return;
        }
        const next = createGamePageCursor(tokens, solved);
        setPhases(solved);
        setOverview(buildGameSolveOverview(solved));
        setStatus("ready");
        cursorRef.current = next;
        setCursor(next);
        const bt = bluetoothRef.current;
        if (bt) {
          const setupAlg = await bt.requestSetupAlg();
          if (requestGen.current !== requestId) {
            return;
          }
          // 连接态可贴一次；之后跟转只钉公式前缀 / 播转动包。
          gameGuidePaintBaseRef.current = setupAlg ?? "";
          bleAbsSetupRef.current = gameGuidePaintBaseRef.current;
          if (setupAlg !== null) {
            cube.current?.setAbsoluteAlg(setupAlg);
          } else {
            void cube.current?.showMoves("");
          }
          resetGuideFromCursor(next, 0);
        } else {
          applyCursorToCube(cube.current, next);
          guideRef.current = null;
          setGuideView(null);
          cube.current?.setMoveHint(null);
        }
      })
      .catch((err: unknown) => {
        if (requestGen.current !== requestId) {
          return;
        }
        setStatus("error");
        setError(err instanceof Error ? err.message : "CFOP 求解失败");
      });
  }

  useEffect(() => {
    const fromHome = initialScramble?.trim() ?? "";
    loadScramble(fromHome === "" ? randomScramble3x3().moves : fromHome);
    return () => {
      requestGen.current += 1;
      playRun.current += 1;
      motionGen.current += 1;
      cube.current?.setMoveHint(null);
    };
    // 进入时用首页打乱；卸载即清空。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  useEffect(() => {
    if (!bluetooth || status !== "ready" || !cursorRef.current) {
      return;
    }
    let movesCancelled = false;
    const unregisterMoves = bluetooth.registerMoves((samples) => {
      // 宽层刚确认后的残留对面包（f→B）不可播、不可记账。
      if (performance.now() < manualQuietUntilRef.current) {
        return;
      }
      let guide = guideRef.current;
      const base = cursorRef.current;
      if (!guide) {
        if (!base) {
          return;
        }
        guide = createGuidedMoves(base.flatMoves);
        guideRef.current = guide;
      }
      const view = guidedScrambleView(guide);
      const layerKind = resolveLayerFollowKind(view.manualMove);
      // 宽层 / 中层：固件报对面包或双包（f→B），禁止 playBluetoothMoves，否则中心与实体脱节。
      if (layerKind && !view.correction) {
        if (layerMatchHoldRef.current) {
          return;
        }
        if (!shouldPlayBluetoothMoveAnim(layerKind)) {
          const token = view.manualMove!;
          const baseAlg = ensureManualSyncSetup(
            `${guide.progress}:${token}`,
            guide,
          );
          let tracker = syncGuideLayerGestureTracker(
            layerGestureTrackerRef.current,
            {
              progress: guide.progress,
              expectedToken: token,
              gyroBefore:
                layerGestureTrackerRef.current?.gyroBefore ??
                lastLiveOrientRef.current,
            },
          );
          tracker = appendGuideLayerGestureMoves(
            tracker,
            samples.map((sample) => ({
              move: sample.move,
              intervalMs: sample.intervalMs,
            })),
          );
          layerGestureTrackerRef.current = tracker;
          const animKey = `${guide.progress}:gyro`;
          if (layerGuideAnimKeyRef.current !== animKey) {
            layerGuideAnimKeyRef.current = animKey;
            void cube.current?.startGuideStepGyroTrack(
              guideTokenToCubingAlg(token),
              baseAlg,
            );
          }
          const live = lastLiveOrientRef.current;
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
            layerMatchHoldRef.current = true;
            void (async () => {
              try {
                await cube.current?.finishGuideStepGyroTrack();
                tryConfirmManualFromGuide();
              } catch {
                layerMatchHoldRef.current = false;
              }
            })();
            return;
          }
        }
        statePollKickRef.current?.();
        return;
      }
      void (async () => {
        if (movesCancelled) {
          return;
        }
        try {
          let next = guideRef.current ?? guide;
          const playSamples: { move: string; intervalMs: number }[] = [];
          for (const sample of samples) {
            if (movesCancelled || next.phase === "done") {
              break;
            }
            const orientAlgs = faceOrientCandidatesForGuide(next);
            const hintOrients = hintOrientationMovesForGuide(next);
            const stepView = guidedScrambleView(next);
            // 3D 播公式帧字母（与高亮一致）；匹配走共用候选链。
            const forPlay = resolveGuideBleFaceMoveWithCandidates(
              sample.move,
              stepView.correction ?? stepView.expectedMove,
              orientAlgs,
            );
            playSamples.push({ ...sample, move: forPlay });
            const before = next;
            const result = applyGuidedBleAbsoluteMoveWithOrientAlgs(
              next,
              sample.move,
              orientAlgs,
            );
            next = result.guide;
            if (result.kind === "need_manual") {
              statePollKickRef.current?.();
              break;
            }
            if (result.kind === "progress" || result.kind === "done") {
              bleAbsSetupRef.current = formulaPaintAlg(next);
              next = await rejectCrossProgressIfStateMismatch(
                before,
                next,
                sample.move,
                hintOrients,
              );
            }
          }
          if (playSamples.length > 0) {
            cube.current?.playBluetoothMoves(playSamples);
          }
          if (movesCancelled) {
            return;
          }
          bleAbsSetupRef.current = formulaPaintAlg(next);
          publishGuide(next);
          if (focusSegmentIdRef.current) {
            focusSegmentIdRef.current = null;
            setFocusSegmentId(null);
          }
        } catch {
          // 单步解析失败时不打断跟转
        }
      })();
    });

    const unregisterOrientation = bluetooth.registerOrientation((quat) => {
      lastLiveOrientRef.current = quat;
      faceRemapHomeRef.current = applyGuideFaceRemapHomeLive(
        faceRemapHomeRef.current,
        quat,
      );
      const guide = guideRef.current;
      const base = cursorRef.current;
      const view = guide ? guidedScrambleView(guide) : null;
      const manual = view?.manualMove;
      if (guide) {
        syncGuideDisplayOrientation(guide, quat);
        // Cross：朝向吸附结果变了才重画高亮，避免陀螺仪每帧重建箭头抖动。
        if (base && isCrossGuideProgress(base, guide.progress) && view) {
          const hintOrients = hintOrientationMovesForGuide(guide);
          const key = [
            hintOrients.join(" "),
            view.correction ?? "",
            view.expectedMove ?? "",
            view.manualMove ?? "",
            view.partial ? "1" : "0",
            view.currentIsDouble ? "1" : "0",
          ].join("|");
          if (key !== crossHintOrientKeyRef.current) {
            crossHintOrientKeyRef.current = key;
            applyMoveHint(cube.current, view, true);
          }
        }
        // 宽层 / 中层：陀螺 scrub 整步 f/r/M…，不跟固件对面包。
        if (
          manual &&
          resolveLayerFollowKind(manual) &&
          !view?.correction &&
          layerGuideAnimKeyRef.current === `${guide.progress}:gyro` &&
          layerGestureTrackerRef.current
        ) {
          const tracker = layerGestureTrackerRef.current;
          cube.current?.setGuideStepGyroProgress(
            layerGuideVisualProgress(
              manual,
              Math.max(tracker.samples.length, 1),
              tracker.gyroBefore,
              quat,
            ),
          );
          if (!layerMatchHoldRef.current) {
            const ev = evaluateGuideLayerGesture(tracker, quat);
            if (ev.status === "matched") {
              layerMatchHoldRef.current = true;
              void (async () => {
                try {
                  await cube.current?.finishGuideStepGyroTrack();
                  tryConfirmManualFromGuide();
                } catch {
                  layerMatchHoldRef.current = false;
                }
              })();
            }
          }
        }
      } else {
        cube.current?.setOrientation(quat);
      }
      if (
        !manual ||
        !isRotationGuideToken(manual) ||
        view?.correction ||
        !base ||
        !guide
      ) {
        rotationStepKeyRef.current = null;
        orientHoldRef.current = createOrientationHoldState(
          nearestCubeOrientationAlg(quat),
        );
        return;
      }
      // 与首页打乱引导相同：相对进入该步的手持 Δ，避免绝对朝向漂了认不出 z2。
      const stepKey = `${guide.progress}:${manual}`;
      if (rotationStepKeyRef.current !== stepKey) {
        rotationStepKeyRef.current = stepKey;
        rotationFromQuatRef.current = quat;
        orientHoldRef.current = createOrientationHoldState("");
      }
      const relativeAlg = relativeOrientationAlg(
        rotationFromQuatRef.current,
        quat,
      );
      const tick = tickOrientationHold(
        orientHoldRef.current,
        relativeAlg,
        performance.now(),
      );
      orientHoldRef.current = tick.state;
      if (scrambleGuideRotationSatisfied("", tick.state.committed, manual)) {
        rotationStepKeyRef.current = null;
        tryConfirmManualFromGuide();
      }
    });

    return () => {
      movesCancelled = true;
      unregisterMoves();
      unregisterOrientation();
    };
  }, [bluetooth, status]);

  // 宽层 / 中层：相对「进入该步时」的实物态做增量对表（支持跳过前序手动步）。
  useEffect(() => {
    if (!bluetooth || status !== "ready") {
      return;
    }
    const manual = guideView?.manualMove;
    if (
      !manual ||
      guideView?.correction ||
      isRotationGuideToken(manual) ||
      !isHintableManualToken(manual)
    ) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      if (cancelled || statePollBusyRef.current) {
        return;
      }
      const guide = guideRef.current;
      const base = cursorRef.current;
      if (!guide || !base || guide.wrongStack.length > 0) {
        return;
      }
      const token = guide.displayMoves[guide.progress];
      if (
        !token ||
        isRotationGuideToken(token) ||
        !isHintableManualToken(token)
      ) {
        return;
      }
      statePollBusyRef.current = true;
      try {
        // facelets 只对表，禁止 setAbsoluteAlg 重刷（S' 等对偶会贴错中心）。
        const syncSetup = ensureManualSyncSetup(
          `${guide.progress}:${token}`,
          guide,
        );
        const setupAlg = await bluetooth.requestSetupAlg();
        if (cancelled || setupAlg === null) {
          return;
        }
        if (layerMatchHoldRef.current) {
          return;
        }
        const orientation = hintOrientationMovesForGuide(guide);
        if (
          await manualStepReachedOnCube(setupAlg, syncSetup, token, orientation)
        ) {
          tryConfirmManualFromGuide();
        }
      } finally {
        statePollBusyRef.current = false;
      }
    };
    statePollKickRef.current = () => {
      void poll();
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, MANUAL_STATE_POLL_MS);
    return () => {
      cancelled = true;
      statePollKickRef.current = null;
      window.clearInterval(timer);
    };
  }, [
    bluetooth,
    status,
    guideView?.manualMove,
    guideView?.correction,
    guideView?.currentIndex,
  ]);

  // 中途连上 / 断开蓝牙：同步引导或回到公式回放。
  useEffect(() => {
    if (status !== "ready" || !cursorRef.current) {
      return;
    }
    if (bluetooth) {
      void bluetooth.requestSetupAlg().then((setupAlg) => {
        if (!bluetoothRef.current || !cursorRef.current) {
          return;
        }
        // 仅中途连上时贴一次连接态；跟转中不再用 facelets 刷盘。
        gameGuidePaintBaseRef.current = setupAlg ?? "";
        bleAbsSetupRef.current = gameGuidePaintBaseRef.current;
        if (setupAlg !== null) {
          cube.current?.setAbsoluteAlg(setupAlg);
        }
        const progress = cursorRef.current.index;
        resetGuideFromCursor(cursorRef.current, progress);
      });
      return;
    }
    guideRef.current = null;
    setGuideView(null);
    faceRemapHomeRef.current = clearGuideFaceRemapHome();
    cube.current?.setMoveHint(null);
    applyCursorToCube(cube.current, cursorRef.current);
  }, [bluetooth, status]);

  async function animateTo(
    current: GamePageCursor,
    next: GamePageCursor,
    motion: "forward" | "back",
    motionId: number,
  ) {
    await cube.current?.animateMove(
      gamePageDisplayedAlg(current),
      gamePageDisplayedAlg(next),
      motion,
      SCRAMBLE_PLAYBACK_STEP_MS,
    );
    return motionGen.current === motionId;
  }

  function moveCursor(
    update: (current: GamePageCursor) => GamePageCursor,
    motion: "snap" | "forward" | "back",
  ) {
    if (bluetoothRef.current) {
      return;
    }
    const current = cursorRef.current;
    if (!current) {
      return;
    }
    stopPlay();
    setFocusSegmentId(null);
    focusSegmentIdRef.current = null;
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
  ): Promise<GamePageCursor | null> {
    let current = cursorRef.current;
    if (!current) {
      return null;
    }
    const limit = Math.min(stopExclusive, current.flatMoves.length);
    while (playRun.current === run && current.index < limit) {
      const next = gamePageStepNext(current);
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
    if (bluetoothRef.current) {
      return;
    }
    const current = cursorRef.current;
    if (!current) {
      return;
    }
    if (playingRef.current) {
      stopPlay();
      return;
    }
    const run = playRun.current;
    const plan = nextGamePagePlayRange(
      current.segments,
      focusSegmentIdRef.current,
      current.index,
      current.flatMoves.length,
    );
    setFocusSegmentId(plan.focusId);
    focusSegmentIdRef.current = plan.focusId;
    try {
      let head = current;
      if (head.index !== plan.resumeAt) {
        const start = gamePageAtIndex(head, plan.resumeAt);
        showCursor(start);
        if (playRun.current !== run) {
          return;
        }
        head = start;
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

  function onSegmentJump(segmentId: GameSegmentId) {
    const current = cursorRef.current;
    if (!current) {
      return;
    }
    const range = current.segments.find((item) => item.id === segmentId);
    if (!range) {
      return;
    }
    stopPlay();
    focusSegmentIdRef.current = segmentId;
    setFocusSegmentId(segmentId);
    if (bluetoothRef.current && guideRef.current) {
      publishGuide(seekGuidedProgress(guideRef.current, range.start));
      return;
    }
    if (bluetoothRef.current) {
      resetGuideFromCursor(current, range.start);
      return;
    }
    showCursor(gamePageAtIndex(current, range.start));
  }

  function onConfirmManualStep() {
    const guide = guideRef.current;
    if (!guide || !bluetoothRef.current) {
      return;
    }
    const result = confirmGuidedManualStep(guide);
    if (result.kind === "need_manual") {
      return;
    }
    // 跳过：钉公式前缀（与自动确认相同），不刷 facelets。
    manualSyncKeyRef.current = null;
    manualSyncSetupRef.current = null;
    layerGuideAnimKeyRef.current = null;
    layerGestureTrackerRef.current = null;
    layerMatchHoldRef.current = false;
    manualQuietUntilRef.current = performance.now() + MANUAL_STEP_QUIET_MS;
    void (async () => {
      try {
        await cube.current?.finishGuideStepGyroTrack();
      } catch {
        // 无轨道
      }
      await paintGameGuideCube(result.guide);
      publishGuide(result.guide);
    })();
  }

  const activeSegmentId =
    focusSegmentId ?? (cursor ? gamePageActiveSegmentId(cursor) : null);
  const segments = cursor?.segments ?? [];
  const highlightIndex = bluetoothOn
    ? guideView?.done
      ? (cursor?.flatMoves.length ?? null)
      : (guideView?.currentIndex ?? null)
    : (cursor?.index ?? null);

  return (
    <div
      className="solve-review game-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-page-title"
    >
      <header className="solve-review-topbar">
        <button
          type="button"
          className="solve-review-back"
          aria-label="返回"
          title="返回"
          onClick={() => {
            stopPlay();
            cube.current?.setMoveHint(null);
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
        <p id="game-page-title" className="solve-review-eyebrow">
          游戏
        </p>
        <span className="solve-review-topbar-spacer" aria-hidden="true" />
      </header>

      <div className="solve-review-body">
        <p
          className={
            scramble.trim()
              ? "game-page-scramble"
              : "game-page-scramble is-empty"
          }
          aria-label="打乱公式"
        >
          {scramble.trim() === "" ? "正在生成打乱…" : scramble}
        </p>

        {status === "loading" ? (
          <p className="game-page-status" aria-busy="true">
            正在生成 CFOP 解法…
          </p>
        ) : null}
        {status === "error" ? (
          <p className="game-page-status is-error" role="alert">
            {error ?? "求解失败"}
          </p>
        ) : null}

        <div className="solve-review-main">
          <div className="solve-review-formulas">
            <section className="solve-review-section" aria-label="总览">
              <h2 className="solve-review-section-title">总览</h2>
              <dl className="solve-review-overview">
                <div>
                  <dt>总步数</dt>
                  <dd>{status === "ready" ? overview.moves : "—"}</dd>
                </div>
                <div>
                  <dt>转体</dt>
                  <dd>{status === "ready" ? overview.rotations : "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="solve-review-section" aria-label="分段">
              <h2 className="solve-review-section-title">分段</h2>
              <p className="solve-review-segment-hint">
                {bluetoothOn
                  ? "蓝牙跟转：按高亮方向拧实体；转错会提示修正。转体 / 宽层 / 中层到位后自动继续。"
                  : "点击分段瞬切到起点；播放只播当前段，播完再点则播下一段"}
              </p>
              <ul className="solve-review-phases">
                {segments.map((segment) => {
                  const tone = phaseTone(segment.id);
                  const active = activeSegmentId === segment.id;
                  const stats = `${Math.max(segment.end - segment.start, 0)} 步`;
                  const phaseMoves = renderPhaseMoves(
                    segment.moves,
                    segment.start,
                    highlightIndex,
                  );
                  return (
                    <li
                      key={segment.id}
                      className={`solve-review-phase solve-review-phase-${tone}${
                        active ? " solve-review-phase-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={
                          segment.id === "scramble"
                            ? "solve-review-phase-play solve-review-phase-scramble-play"
                            : "solve-review-phase-play solve-review-phase-narrow-play"
                        }
                        aria-current={active ? "true" : undefined}
                        disabled={status !== "ready"}
                        onClick={() => onSegmentJump(segment.id)}
                      >
                        <span className="solve-review-phase-label">
                          {segment.label}
                        </span>
                        <span className="solve-review-phase-stats">
                          {stats}
                        </span>
                        <p className="solve-review-phase-alg scramble-moves-guided">
                          {phaseMoves}
                        </p>
                      </button>
                      {segment.id !== "scramble" ? (
                        <button
                          type="button"
                          className="solve-review-phase-wide solve-review-phase-play"
                          aria-current={active ? "true" : undefined}
                          disabled={status !== "ready"}
                          onClick={() => onSegmentJump(segment.id)}
                        >
                          <span className="solve-review-phase-label">
                            {segment.label}
                          </span>
                          <span className="solve-review-phase-stats">
                            {stats}
                          </span>
                          <p className="solve-review-phase-alg scramble-moves-guided">
                            {renderPhaseMoves(
                              segment.moves,
                              segment.start,
                              highlightIndex,
                            )}
                          </p>
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {status === "ready" && phases.length === 0 ? (
                <p className="game-page-status">暂无分段</p>
              ) : null}
            </section>
          </div>

          <section className="solve-review-playback" aria-label="回放">
            <h2 className="solve-review-section-title">
              {bluetoothOn ? "跟转" : "回放"}
            </h2>
            <div className="solve-review-playback-body">
              <p className="solve-review-playback-progress" aria-live="polite">
                {cursor ? gamePageProgressLabel(cursor, focusSegmentId) : "—"}
              </p>
              {bluetoothOn && guideView?.correction ? (
                <p className="game-page-guide-note is-error" role="status">
                  转错了，请转 {guideView.correction}
                </p>
              ) : null}
              {bluetoothOn &&
              guideView &&
              !guideView.correction &&
              guideView.manualMove ? (
                <div className="game-page-manual-step">
                  <p className="game-page-guide-note" role="status">
                    {manualStepHintText(guideView.manualMove)}
                  </p>
                  <button
                    type="button"
                    className="game-page-manual-confirm"
                    onClick={onConfirmManualStep}
                  >
                    跳过此步
                  </button>
                </div>
              ) : null}
              {bluetoothOn &&
              guideView &&
              !guideView.correction &&
              !guideView.manualMove &&
              guideView.expectedMove &&
              !guideView.done ? (
                <p className="game-page-guide-note" role="status">
                  下一步 {guideView.expectedMove}
                  {guideView.partial ? "（再转半步）" : ""}
                </p>
              ) : null}
              {bluetoothOn && guideView?.done ? (
                <p className="game-page-guide-note is-done" role="status">
                  跟转完成
                </p>
              ) : null}
              <div className="solve-review-cube">
                <CubeView
                  ref={cube}
                  showLayerControls={false}
                  viewOrientation="scramble"
                />
              </div>
              <div className="solve-review-playback-bar">
                {!bluetoothOn ? (
                  <PracticeControls
                    atStart={!cursor || isGamePageAtStart(cursor)}
                    atTarget={!cursor || isGamePageAtEnd(cursor)}
                    playing={playing}
                    onStart={() => {
                      if (!cursorRef.current) {
                        return;
                      }
                      stopPlay();
                      focusSegmentIdRef.current = null;
                      setFocusSegmentId(null);
                      showCursor(
                        createGamePageCursor(
                          cursorRef.current.scrambleMoves,
                          cursorRef.current.phases,
                        ),
                      );
                    }}
                    onPrevious={() => moveCursor(gamePageStepPrevious, "back")}
                    onPlay={() => void onPlay()}
                    onNext={() => moveCursor(gamePageStepNext, "forward")}
                    onTarget={() => {
                      if (!cursorRef.current) {
                        return;
                      }
                      stopPlay();
                      focusSegmentIdRef.current = null;
                      setFocusSegmentId(null);
                      showCursor(gamePageAtEnd(cursorRef.current));
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  className="solve-review-retry game-page-rescramble"
                  aria-label="重新打乱"
                  title="重新打乱"
                  onClick={() => {
                    loadScramble(randomScramble3x3().moves);
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"
                    />
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
