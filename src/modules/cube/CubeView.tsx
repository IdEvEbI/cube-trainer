import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { parseAlgorithm } from "../formula/formulas.ts";
import { scrambleDisplayAlgorithm } from "../scramble/scramble.ts";
import { CUBE_ORIENTATION_ALG, isLayerMove } from "./cube.ts";
import { LAYER_MOVES, type LayerMove } from "./types.ts";
import "./cube.css";

export type CubeHandle = {
  applyAlgorithm(moves: string): void;
  setAlgorithm(moves: string): void;
};

export function CubeView({ ref }: { ref?: Ref<CubeHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<TwistyPlayer | null>(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    const mount = host.current;
    if (!mount) {
      return;
    }
    const twisty = new TwistyPlayer({
      puzzle: "3x3x3",
      alg: "",
      experimentalSetupAlg: CUBE_ORIENTATION_ALG,
      visualization: "3D",
      background: "none",
      controlPanel: "none",
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
  }, []);

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
      const parsed = scrambleDisplayAlgorithm(moves);
      queue.current = queue.current.then(async () => {
        const twisty = player.current;
        if (!twisty) {
          return;
        }
        twisty.alg = parsed;
        twisty.timestamp = "end";
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
      <div className="cube-moves">
        {LAYER_MOVES.map((move) => (
          <button key={move} type="button" onClick={() => turn(move)}>
            {move}
          </button>
        ))}
      </div>
      <p className="cube-hint">拖动层面，或点击按钮转动</p>
    </section>
  );
}
