import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Alg } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";
import { TwistyPlayer, type ExperimentalStickering } from "cubing/twisty";
import type { Group } from "three";
import {
  MOYU_MOVE_ANIM_DEFAULTS,
  planMoveAnimations,
  shouldForceInstantForPending,
  type MoyuMoveAnimConfig,
} from "../bluetooth/moyu/animation.ts";
import {
  IDENTITY_QUAT,
  quatAngle,
  quatSlerp,
  type MoyuQuat,
} from "../bluetooth/moyu/orientation.ts";
import { faceletsToKPattern } from "../bluetooth/moyu/pattern.ts";
import { parseAlgorithm } from "../formula/formulas.ts";
import {
  absoluteAlgToFixedCenterPattern,
  algNeedsFixedCenterPaint,
} from "../scramble/fixedCenterLayer.ts";
import {
  scrambleDisplayAlgorithm,
  scrambleViewAlgorithm,
} from "../scramble/scramble.ts";
import { CUBE_ORIENTATION_ALG, isLayerMove } from "./cube.ts";
import { applyMoveHint, type MoveHintOptions } from "./moveHint.ts";
import { LAYER_MOVES, type LayerMove } from "./types.ts";
import "./cube.css";

/** 回放 / 练习动画：层转 + 整步转体（复盘含 x/y/z）。 */
const PLAYBACK_MOVE = /^(?:[UDLRFBudlrfbxyz]|[MES])(?:2'|'2|2|')?$/;

export type CubeMotion = "forward" | "back";

/** scramble = white U (timer); solve = yellow U (practice). */
export type CubeViewOrientation = "scramble" | "solve";

export type CubeOrbit = {
  latitude: number;
  longitude: number;
};

export type CubeOrientationQuat = {
  x: number;
  y: number;
  z: number;
  w: number;
};

type TwistyPuzzle3D = {
  quaternion: {
    set(x: number, y: number, z: number, w: number): unknown;
  };
  add(object: Group): void;
  remove(object: Group): void;
  scheduleRenderCallback?: () => void;
};

export type CubeHandle = {
  applyAlgorithm(moves: string): void;
  setAlgorithm(moves: string): void;
  /**
   * 直接设置展示算法（可为空表示复原），不做打乱校验。
   * 供蓝牙状态同步：朝向与当前 viewOrientation 的 setup 一致。
   */
  setAbsoluteAlg(moves: string): void;
  /**
   * 用蓝牙 facelets 直接贴 3D（固定色心，不经 setupAlg 解算）。
   * 中层 / 宽层对表与跟随用此路径，避免 E→D'U 画错顶面。
   * `orientation` 与贴图同一队列写入，避免先贴后改朝向的竞态。
   */
  setAbsoluteFromFacelets(
    facelets: string,
    orientation?: CubeOrientationQuat,
  ): void;
  /**
   * 用已钉中心的 KPattern 贴 3D（公式期望态）。
   * `orientation` 与贴图同一队列写入；缺省保留上次朝向。
   */
  setAbsoluteFromPattern(
    pattern: KPattern,
    orientation?: CubeOrientationQuat,
  ): void;
  /**
   * 把相对姿态四元数乘到 Twisty Cube3D 上（真·三自由度跟随，含垂直翻转）。
   */
  setOrientation(quat: CubeOrientationQuat): void;
  /** 复位相机球面坐标（对齐朝向时清掉拖动残留）。 */
  setOrbit(coords: CubeOrbit): void;
  /**
   * 蓝牙转动：按协议 interval 播放旋转动画；过快或积压则瞬切。
   * 不改练习页 / 打乱计时逻辑，仅追加到当前 alg。
   */
  playBluetoothMoves(
    samples: readonly { move: string; intervalMs: number }[],
    config?: Partial<MoyuMoveAnimConfig>,
  ): void;
  showMoves(moves: string): Promise<void>;
  animateMove(
    before: string,
    after: string,
    direction: CubeMotion,
    quarterTurnMs: number,
  ): Promise<void>;
  /**
   * 手持朝向球面插值（复盘 x/y/z 转体）；时长按夹角相对 90° 缩放 quarterTurnMs。
   */
  animateOrientation(
    from: CubeOrientationQuat,
    to: CubeOrientationQuat,
    quarterTurnMs: number,
  ): Promise<void>;
  cancelAnimation(): void;
  /**
   * Twisty 贴纸：full 全色；或传入序列化 mask（黄上 F2L 简化时忽略黄层块）。
   */
  setStickering(
    stickering: { mode: "full" } | { mode: "mask"; mask: string },
  ): void;
  /**
   * 蓝牙打乱引导：在立体魔方对应面上画旋转箭头；传 null 清除。
   * 仅计时首屏引导使用，练习页不调用。
   */
  setMoveHint(move: string | null, options?: MoveHintOptions): void;
};

const QUARTER_TURN_TIMELINE_MS = 1000;

type TimelineMs = Awaited<
  ReturnType<TwistyPlayer["experimentalGet"]["timestamp"]>
>;

function place(twisty: TwistyPlayer, ms: number) {
  twisty.experimentalModel.timestampRequest.set(ms as TimelineMs);
}

type MoveIndexer = {
  numAnimatedLeaves(): number;
  moveDuration(index: number): number;
  indexToMoveStartTimestamp(index: number): number;
};

function scrubOrientation(
  apply: (quat: MoyuQuat) => void,
  from: MoyuQuat,
  to: MoyuQuat,
  durationMs: number,
  isCurrent: () => boolean,
) {
  if (!isCurrent() || durationMs <= 0) {
    if (isCurrent()) {
      apply(to);
    }
    return Promise.resolve();
  }
  if (quatAngle(from, to) < 1e-5) {
    apply(to);
    return Promise.resolve();
  }
  let last = performance.now();
  let elapsed = 0;
  return new Promise<void>((resolve) => {
    const frame = (now: number) => {
      if (!isCurrent()) {
        resolve();
        return;
      }
      elapsed += Math.min(32, now - last);
      last = now;
      const progress = Math.min(1, elapsed / durationMs);
      apply(quatSlerp(from, to, progress));
      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }
      apply(to);
      resolve();
    };
    requestAnimationFrame(frame);
  });
}

function scrub(
  twisty: TwistyPlayer,
  from: number,
  to: number,
  durationMs: number,
  isCurrent: () => boolean,
) {
  if (!isCurrent() || durationMs <= 0 || from === to) {
    if (isCurrent()) {
      place(twisty, to);
    }
    return Promise.resolve();
  }
  let last = performance.now();
  let elapsed = 0;
  return new Promise<void>((resolve) => {
    const frame = (now: number) => {
      if (!isCurrent()) {
        resolve();
        return;
      }
      elapsed += Math.min(32, now - last);
      last = now;
      const progress = Math.min(1, elapsed / durationMs);
      place(twisty, from + (to - from) * progress);
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

async function moveSpan(twisty: TwistyPlayer) {
  const indexer = (await twisty.experimentalModel.indexer.get()) as MoveIndexer;
  const count = indexer.numAnimatedLeaves();
  if (count <= 0) {
    return null;
  }
  const index = count - 1;
  const duration = indexer.moveDuration(index);
  const start = indexer.indexToMoveStartTimestamp(index);
  return { start, end: start + duration, duration };
}

/** 在当前 alg 末尾追加一步并 scrub 动画；durationMs 为墙钟毫秒。 */
async function animateAppendMove(
  twisty: TwistyPlayer | null,
  move: string,
  durationMs: number,
  isCurrent: () => boolean,
) {
  if (!twisty || !isCurrent()) {
    return;
  }
  const current = (await twisty.experimentalGet.alg()).toString().trim();
  const before = current;
  const after = `${before} ${move}`.trim();
  twisty.pause();
  twisty.alg = before;
  twisty.timestamp = "end";
  await twisty.experimentalModel.indexer.get();
  if (!isCurrent()) {
    return;
  }
  const atBoundary = await twisty.experimentalGet.timestamp();
  twisty.timestamp = atBoundary;
  await twisty.experimentalModel.timestampRequest.get();
  if (!isCurrent()) {
    return;
  }
  twisty.alg = after;
  const span = await moveSpan(twisty);
  if (!isCurrent()) {
    return;
  }
  if (!span) {
    twisty.alg = after;
    twisty.timestamp = "end";
    return;
  }
  const wallMs = (span.duration / QUARTER_TURN_TIMELINE_MS) * durationMs;
  place(twisty, span.start);
  await scrub(twisty, span.start, span.end, wallMs, isCurrent);
  if (!isCurrent()) {
    return;
  }
  twisty.alg = after;
  twisty.timestamp = "end";
}

async function appendMovesInstant(
  twisty: TwistyPlayer | null,
  moves: readonly string[],
) {
  if (!twisty || moves.length === 0) {
    return;
  }
  const current = (await twisty.experimentalGet.alg()).toString().trim();
  const added = moves.join(" ").trim();
  twisty.alg = `${current} ${added}`.trim();
  twisty.timestamp = "end";
}

/** Allow empty alg (solved cube) for scramble / review playback from white-up start. */
function algText(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return "";
  }
  const moves = [...new Alg(trimmed).experimentalLeafMoves()].map((move) =>
    move.toString(),
  );
  const invalid = moves.find((move) => !PLAYBACK_MOVE.test(move));
  if (invalid) {
    throw new Error(`无法播放转动：${invalid}`);
  }
  return moves.join(" ");
}

async function animatePracticeMove(
  twisty: TwistyPlayer | null,
  before: string,
  after: string,
  direction: CubeMotion,
  quarterTurnMs: number,
  isCurrent: () => boolean,
) {
  if (!twisty || !isCurrent()) {
    return;
  }
  const fromMoves = algText(before);
  const toMoves = algText(after);
  twisty.pause();
  twisty.alg = fromMoves;
  twisty.timestamp = "end";
  await twisty.experimentalModel.indexer.get();
  if (!isCurrent()) {
    return;
  }
  if (direction === "forward") {
    const atBoundary = await twisty.experimentalGet.timestamp();
    twisty.timestamp = atBoundary;
    await twisty.experimentalModel.timestampRequest.get();
    if (!isCurrent()) {
      return;
    }
    twisty.alg = toMoves;
  }
  const span = await moveSpan(twisty);
  if (!isCurrent()) {
    return;
  }
  if (!span) {
    twisty.alg = toMoves;
    twisty.timestamp = "end";
    return;
  }
  const wallMs = (span.duration / QUARTER_TURN_TIMELINE_MS) * quarterTurnMs;
  if (direction === "forward") {
    place(twisty, span.start);
    await scrub(twisty, span.start, span.end, wallMs, isCurrent);
  } else {
    place(twisty, span.end);
    await scrub(twisty, span.end, span.start, wallMs, isCurrent);
  }
  if (!isCurrent()) {
    return;
  }
  twisty.alg = toMoves;
  twisty.timestamp = "end";
}

export function CubeView({
  ref,
  showLayerControls = true,
  viewOrientation = "solve",
}: {
  ref?: Ref<CubeHandle>;
  /** Scramble-timer home hides the U/D/… pad; practice keeps it. */
  showLayerControls?: boolean;
  /** Timer first screen: white-up; practice: yellow-up. */
  viewOrientation?: CubeViewOrientation;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<TwistyPlayer | null>(null);
  const puzzle3D = useRef<TwistyPuzzle3D | null>(null);
  const puzzle3DWait = useRef<Promise<TwistyPuzzle3D | null> | null>(null);
  const lastOrientation = useRef<CubeOrientationQuat | null>(null);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  /** 队列中尚未播完的蓝牙动画步数（用于积压瞬切）。 */
  const bluetoothPending = useRef(0);
  const moveHintGroup = useRef<Group | null>(null);
  /** 与 alg 队列串行，避免 setAbsoluteAlg 重建场景后箭头画在旧 puzzle 上。 */
  const moveHintToken = useRef(0);
  /** 上次写入的绝对态；相同则跳过，避免宽层轮询打断箭头动画。 */
  const lastAbsoluteAlg = useRef<string | null>(null);
  /** facelets 展示缓存键：`facelets:${facelets}`。 */
  const lastAbsoluteFacelets = useRef<string | null>(null);

  async function rebindAfterAbsoluteChange(
    twisty: TwistyPlayer,
    hintToken: number,
    orient: CubeOrientationQuat = IDENTITY_QUAT,
  ) {
    const puzzle = await resolvePuzzle3D(twisty);
    if (
      !puzzle ||
      hintToken !== moveHintToken.current ||
      player.current !== twisty
    ) {
      return;
    }
    lastOrientation.current = orient;
    applyOrientationToPuzzle(puzzle, orient);
    // 不在此复位 orbit：鼠标拖动观察应保留；对齐 / 连接才显式 setOrbit。
    const pending = pendingMoveHint.current;
    if (!pending?.move || pendingMoveHint.current !== pending) {
      return;
    }
    moveHintGroup.current = applyMoveHint(
      puzzle,
      null,
      pending.move,
      pending.options,
    );
  }

  function applyOrientationOnly(orient: CubeOrientationQuat) {
    lastOrientation.current = orient;
    const twisty = player.current;
    if (!twisty) {
      return;
    }
    void resolvePuzzle3D(twisty).then((puzzle) => {
      if (!puzzle || player.current !== twisty) {
        return;
      }
      if (lastOrientation.current !== orient) {
        return;
      }
      applyOrientationToPuzzle(puzzle, orient);
    });
  }

  function sameOrientation(
    a: CubeOrientationQuat | null | undefined,
    b: CubeOrientationQuat,
  ): boolean {
    if (!a) {
      return false;
    }
    return a.x === b.x && a.y === b.y && a.z === b.z && a.w === b.w;
  }

  async function applyPatternToTwisty(
    twisty: TwistyPlayer,
    pattern: KPattern,
    hintToken: number,
    orientation: CubeOrientationQuat,
  ) {
    if (moveHintGroup.current) {
      applyMoveHint({ add() {}, remove() {} }, moveHintGroup.current, null);
      moveHintGroup.current = null;
    }
    invalidatePuzzle3DCache();
    const xf = pattern.experimentalToTransformation();
    if (!xf) {
      throw new Error("pattern 无法转为 transformation");
    }
    twisty.experimentalModel.setupTransformation.set(null);
    twisty.alg = "";
    twisty.experimentalModel.setupTransformation.set(xf);
    twisty.timestamp = "end";
    // 朝向与 setupTransformation 同队列写入，避免 App 先 setOrientation 再被这里覆盖。
    await rebindAfterAbsoluteChange(twisty, hintToken, orientation);
  }
  const pendingMoveHint = useRef<{
    move: string | null;
    options?: MoveHintOptions;
  } | null>(null);
  const viewOrientationRef = useRef(viewOrientation);
  viewOrientationRef.current = viewOrientation;

  function invalidatePuzzle3DCache() {
    puzzle3D.current = null;
    puzzle3DWait.current = null;
  }

  async function resolvePuzzle3D(
    twisty: TwistyPlayer,
  ): Promise<TwistyPuzzle3D | null> {
    if (puzzle3D.current) {
      return puzzle3D.current;
    }
    if (!puzzle3DWait.current) {
      puzzle3DWait.current = twisty
        .experimentalCurrentThreeJSPuzzleObject()
        .then((obj) => {
          const puzzle = obj as TwistyPuzzle3D;
          puzzle3D.current = puzzle;
          return puzzle;
        })
        .catch(() => null);
    }
    return puzzle3DWait.current;
  }

  /** alg 变更后重取 3D 宿主，并把 pending 高亮挂回去。 */
  async function rebindPendingMoveHint(twisty: TwistyPlayer) {
    if (moveHintGroup.current) {
      applyMoveHint({ add() {}, remove() {} }, moveHintGroup.current, null);
      moveHintGroup.current = null;
    }
    invalidatePuzzle3DCache();
    const pending = pendingMoveHint.current;
    if (!pending?.move) {
      return;
    }
    const puzzle = await resolvePuzzle3D(twisty);
    if (!puzzle || player.current !== twisty) {
      return;
    }
    if (pendingMoveHint.current !== pending) {
      return;
    }
    const orient = lastOrientation.current;
    if (orient) {
      applyOrientationToPuzzle(puzzle, orient);
    }
    moveHintGroup.current = applyMoveHint(
      puzzle,
      null,
      pending.move,
      pending.options,
    );
  }

  function applyOrientationToPuzzle(
    puzzle: TwistyPuzzle3D,
    quat: CubeOrientationQuat,
  ) {
    puzzle.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    puzzle.scheduleRenderCallback?.();
  }

  useEffect(() => {
    const mount = host.current;
    if (!mount) {
      return;
    }
    const twisty = new TwistyPlayer({
      puzzle: "3x3x3",
      alg: "",
      experimentalSetupAlg:
        viewOrientation === "scramble" ? "" : CUBE_ORIENTATION_ALG,
      visualization: "3D",
      background: "none",
      controlPanel: "none",
      // 关闭背面浮动提示面，避免「散架」和多余色块干扰 F2L 观察
      hintFacelets: "none",
      experimentalDragInput: "auto",
      cameraLatitude: 35,
      cameraLongitude: 28,
    });
    twisty.classList.add("cube-player");
    mount.replaceChildren(twisty);
    player.current = twisty;
    puzzle3D.current = null;
    puzzle3DWait.current = null;
    // 再练一次从成绩页切回时，父组件可能先于 player 就绪调用 setMoveHint。
    const pending = pendingMoveHint.current;
    if (pending) {
      const token = (moveHintToken.current += 1);
      queue.current = queue.current.then(async () => {
        if (token !== moveHintToken.current || player.current !== twisty) {
          return;
        }
        const puzzle = await resolvePuzzle3D(twisty);
        if (
          !puzzle ||
          token !== moveHintToken.current ||
          player.current !== twisty
        ) {
          return;
        }
        const latest = pendingMoveHint.current;
        moveHintGroup.current = applyMoveHint(
          puzzle,
          moveHintGroup.current,
          latest?.move ?? null,
          latest?.options,
        );
      });
    }
    return () => {
      moveHintGroup.current = null;
      lastAbsoluteAlg.current = null;
      twisty.remove();
      player.current = null;
      puzzle3D.current = null;
      puzzle3DWait.current = null;
    };
  }, [viewOrientation]);

  useImperativeHandle(ref, () => ({
    applyAlgorithm(moves: string) {
      const parsed = parseAlgorithm(moves).join(" ");
      lastAbsoluteAlg.current = null;
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        const current = await twisty.experimentalGet.alg();
        twisty.alg = `${current.toString()} ${parsed}`.trim();
        twisty.timestamp = "end";
      });
    },
    setAlgorithm(moves: string) {
      const parsed =
        viewOrientationRef.current === "scramble"
          ? scrambleViewAlgorithm(moves)
          : scrambleDisplayAlgorithm(moves);
      lastAbsoluteAlg.current = null;
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        twisty.alg = parsed;
        twisty.timestamp = "end";
      });
    },
    setAbsoluteAlg(moves: string) {
      const alg = moves.trim();
      // 宽层 / 中层 facelets 轮询很勤；alg 未变（含重建进行中）直接跳过，避免箭头闪烁、轨迹被截短。
      if (
        lastAbsoluteAlg.current === alg &&
        lastAbsoluteFacelets.current === null
      ) {
        return;
      }
      lastAbsoluteAlg.current = alg;
      lastAbsoluteFacelets.current = null;
      generation.current += 1;
      bluetoothPending.current = 0;
      const hintToken = (moveHintToken.current += 1);
      const orient = lastOrientation.current ?? IDENTITY_QUAT;
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        // 含 M/E/S/u… 时禁止走 Twisty.alg（色心被带走 → 绿上黄前）；钉中心后贴 pattern。
        if (algNeedsFixedCenterPaint(alg)) {
          try {
            const pattern = await absoluteAlgToFixedCenterPattern(alg);
            await applyPatternToTwisty(twisty, pattern, hintToken, orient);
          } catch {
            // 保持上次画面
          }
          return;
        }
        // alg 变更后 Three 场景可能重建，丢掉旧 puzzle / 箭头缓存。
        if (moveHintGroup.current) {
          applyMoveHint({ add() {}, remove() {} }, moveHintGroup.current, null);
          moveHintGroup.current = null;
        }
        invalidatePuzzle3DCache();
        twisty.experimentalModel.setupTransformation.set(null);
        twisty.alg = alg;
        twisty.timestamp = "end";
        await rebindAfterAbsoluteChange(twisty, hintToken, orient);
      });
    },
    setAbsoluteFromFacelets(
      facelets: string,
      orientation?: CubeOrientationQuat,
    ) {
      const key = `facelets:${facelets}`;
      const orient = orientation ?? lastOrientation.current ?? IDENTITY_QUAT;
      // 内容未变：勿重建场景 / 高亮（轮询会每拍打一次，否则箭头狂抖、拖动被打断）。
      if (lastAbsoluteFacelets.current === key) {
        if (orientation && !sameOrientation(lastOrientation.current, orient)) {
          applyOrientationOnly(orient);
        }
        return;
      }
      lastAbsoluteFacelets.current = key;
      lastAbsoluteAlg.current = null;
      generation.current += 1;
      bluetoothPending.current = 0;
      const hintToken = (moveHintToken.current += 1);
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        try {
          const pattern = await faceletsToKPattern(facelets);
          await applyPatternToTwisty(twisty, pattern, hintToken, orient);
        } catch {
          // 回退：保持上次画面，避免空白
        }
      });
    },
    setAbsoluteFromPattern(
      pattern: KPattern,
      orientation?: CubeOrientationQuat,
    ) {
      // 缓存键带上色心置换：仅角棱相同、色心不同（M→M E'）也必须重贴。
      const key = `pattern:${JSON.stringify(pattern.patternData.EDGES)}:${JSON.stringify(pattern.patternData.CORNERS)}:${JSON.stringify(pattern.patternData.CENTERS)}`;
      const orient = orientation ?? lastOrientation.current ?? IDENTITY_QUAT;
      if (lastAbsoluteFacelets.current === key) {
        if (orientation && !sameOrientation(lastOrientation.current, orient)) {
          applyOrientationOnly(orient);
        }
        return;
      }
      lastAbsoluteFacelets.current = key;
      lastAbsoluteAlg.current = null;
      generation.current += 1;
      bluetoothPending.current = 0;
      const hintToken = (moveHintToken.current += 1);
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        await applyPatternToTwisty(twisty, pattern, hintToken, orient);
      });
    },
    setOrientation(quat) {
      applyOrientationOnly(quat);
    },
    setOrbit(coords) {
      const twisty = player.current;
      if (!twisty) {
        return;
      }
      twisty.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    playBluetoothMoves(samples, config) {
      if (samples.length === 0) {
        return;
      }
      const merged: MoyuMoveAnimConfig = {
        ...MOYU_MOVE_ANIM_DEFAULTS,
        ...config,
      };
      // 积压时只让本批瞬切，不打断队列里已在播的动画（避免停在半步）
      const forceInstant = shouldForceInstantForPending(
        bluetoothPending.current,
        merged,
      );
      const plan = planMoveAnimations(samples, merged, forceInstant);
      let remainingAnimated = plan.filter(
        (step) => step.durationMs !== null,
      ).length;
      bluetoothPending.current += remainingAnimated;
      const token = generation.current;

      const dropRemaining = () => {
        bluetoothPending.current = Math.max(
          0,
          bluetoothPending.current - remainingAnimated,
        );
        remainingAnimated = 0;
      };

      const task = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          dropRemaining();
          return;
        }
        const instantBatch: string[] = [];
        const flushInstant = async () => {
          if (instantBatch.length === 0) {
            return;
          }
          await appendMovesInstant(twisty, instantBatch);
          instantBatch.length = 0;
        };
        for (const step of plan) {
          if (generation.current !== token) {
            dropRemaining();
            return;
          }
          if (step.durationMs === null) {
            instantBatch.push(step.move);
            continue;
          }
          await flushInstant();
          if (generation.current !== token) {
            dropRemaining();
            return;
          }
          await animateAppendMove(
            twisty,
            step.move,
            step.durationMs,
            () => generation.current === token,
          );
          remainingAnimated = Math.max(0, remainingAnimated - 1);
          bluetoothPending.current = Math.max(0, bluetoothPending.current - 1);
        }
        await flushInstant();
        // 追加 alg 后旧 Three 宿主可能失效；重挂 pending 高亮（否则下一步 x 等会消失）。
        if (generation.current === token && player.current === twisty) {
          lastAbsoluteAlg.current = null;
          await rebindPendingMoveHint(twisty);
        }
      });
      queue.current = task.then(
        () => undefined,
        () => undefined,
      );
    },
    showMoves(moves: string) {
      const parsed = algText(moves);
      lastAbsoluteAlg.current = null;
      const task = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        twisty.pause();
        twisty.alg = parsed;
        twisty.timestamp = "end";
      });
      queue.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    animateMove(before, after, direction, quarterTurnMs) {
      const token = generation.current;
      const task = queue.current.then(() =>
        animatePracticeMove(
          player.current,
          before,
          after,
          direction,
          quarterTurnMs,
          () => generation.current === token,
        ),
      );
      queue.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    animateOrientation(from, to, quarterTurnMs) {
      const token = generation.current;
      const task = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty || generation.current !== token) {
          return;
        }
        const puzzle = await resolvePuzzle3D(twisty);
        if (!puzzle || generation.current !== token) {
          return;
        }
        const start = { x: from.x, y: from.y, z: from.z, w: from.w };
        const end = { x: to.x, y: to.y, z: to.z, w: to.w };
        const turns = quatAngle(start, end) / (Math.PI / 2);
        const durationMs = Math.max(120, turns * quarterTurnMs);
        await scrubOrientation(
          (quat) => {
            lastOrientation.current = quat;
            applyOrientationToPuzzle(puzzle, quat);
          },
          start,
          end,
          durationMs,
          () => generation.current === token,
        );
        if (generation.current === token) {
          lastOrientation.current = end;
          applyOrientationToPuzzle(puzzle, end);
        }
      });
      queue.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    cancelAnimation() {
      generation.current += 1;
    },
    setStickering(stickering) {
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        if (stickering.mode === "mask") {
          twisty.experimentalStickeringMaskOrbits = stickering.mask;
          return;
        }
        // 全 Regular 遮罩，避免残留自定义 mask
        twisty.experimentalStickeringMaskOrbits =
          "EDGES:------------,CORNERS:--------,CENTERS:------";
        twisty.experimentalStickering = "full" as ExperimentalStickering;
      });
    },
    setMoveHint(move, options) {
      pendingMoveHint.current = { move, options };
      const token = (moveHintToken.current += 1);
      const twisty = player.current;
      if (!twisty) {
        return;
      }
      queue.current = queue.current.then(async () => {
        if (token !== moveHintToken.current || player.current !== twisty) {
          return;
        }
        // 不复用可能已脱离场景的缓存，避免 x / 宽层高亮画在旧 puzzle 上。
        invalidatePuzzle3DCache();
        const puzzle = await resolvePuzzle3D(twisty);
        if (
          !puzzle ||
          token !== moveHintToken.current ||
          player.current !== twisty
        ) {
          return;
        }
        const pending = pendingMoveHint.current;
        const orient = lastOrientation.current;
        if (orient) {
          applyOrientationToPuzzle(puzzle, orient);
        }
        moveHintGroup.current = applyMoveHint(
          puzzle,
          moveHintGroup.current,
          pending?.move ?? null,
          pending?.options,
        );
      });
    },
  }));

  function turn(move: LayerMove) {
    if (!isLayerMove(move)) {
      return;
    }
    player.current?.experimentalAddMove(move);
  }

  return (
    <section className="cube-view">
      <h2>三阶魔方</h2>
      <div className="cube-stage" ref={host} />
      {showLayerControls ? (
        <>
          <div className="cube-moves">
            {LAYER_MOVES.map((move) => (
              <button key={move} type="button" onClick={() => turn(move)}>
                {move}
              </button>
            ))}
          </div>
          <p className="cube-hint">拖动层面，或点击按钮转动</p>
        </>
      ) : null}
    </section>
  );
}
