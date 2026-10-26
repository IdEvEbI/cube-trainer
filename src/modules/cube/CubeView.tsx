import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { TwistyPlayer, type ExperimentalStickering } from "cubing/twisty";
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

export type CubeHandle = {
  applyAlgorithm(moves: string): void;
  setAlgorithm(moves: string): void;
  /**
   * 直接设置展示算法（可为空表示复原），不做打乱校验。
   * 供蓝牙状态同步：朝向与当前 viewOrientation 的 setup 一致。
   */
  setAbsoluteAlg(moves: string): void;
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
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const viewOrientationRef = useRef(viewOrientation);
  viewOrientationRef.current = viewOrientation;

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
    return () => {
      twisty.remove();
      player.current = null;
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
