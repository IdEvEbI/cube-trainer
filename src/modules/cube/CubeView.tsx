import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { TwistyPlayer, type ExperimentalStickering } from "cubing/twisty";
import {
  MOYU_MOVE_ANIM_DEFAULTS,
  planMoveAnimations,
  shouldForceInstantForPending,
  type MoyuMoveAnimConfig,
} from "../bluetooth/moyu/animation.ts";
import { parseAlgorithm } from "../formula/formulas.ts";
import {
  scrambleDisplayAlgorithm,
  scrambleViewAlgorithm,
} from "../scramble/scramble.ts";
import { CUBE_ORIENTATION_ALG, isLayerMove } from "./cube.ts";
import { LAYER_MOVES, type LayerMove } from "./types.ts";
import "./cube.css";

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
  cancelAnimation(): void;
  /**
   * Twisty 贴纸：full 全色；或传入序列化 mask（黄上 F2L 简化时忽略黄层块）。
   */
  setStickering(
    stickering: { mode: "full" } | { mode: "mask"; mask: string },
  ): void;
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
  const fromMoves = parseAlgorithm(before).join(" ");
  const toMoves = parseAlgorithm(after).join(" ");
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
  const viewOrientationRef = useRef(viewOrientation);
  viewOrientationRef.current = viewOrientation;

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
    return () => {
      twisty.remove();
      player.current = null;
      puzzle3D.current = null;
      puzzle3DWait.current = null;
    };
  }, [viewOrientation]);

  useImperativeHandle(ref, () => ({
    applyAlgorithm(moves: string) {
      const parsed = parseAlgorithm(moves).join(" ");
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
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        twisty.alg = alg;
        twisty.timestamp = "end";
      });
    },
    setOrientation(quat) {
      lastOrientation.current = quat;
      const twisty = player.current;
      if (!twisty) {
        return;
      }
      void resolvePuzzle3D(twisty).then((puzzle) => {
        if (!puzzle || player.current !== twisty) {
          return;
        }
        const latest = lastOrientation.current;
        if (!latest) {
          return;
        }
        applyOrientationToPuzzle(puzzle, latest);
      });
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
      });
      queue.current = task.then(
        () => undefined,
        () => undefined,
      );
    },
    showMoves(moves: string) {
      const parsed = parseAlgorithm(moves).join(" ");
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
