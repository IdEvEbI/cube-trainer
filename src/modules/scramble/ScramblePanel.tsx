import { useState } from "react";
import { randomScramble3x3 } from "./scramble.ts";
import type { Scramble } from "./types.ts";
import "./scramble.css";

export function ScramblePanel({
  onScramble,
}: {
  onScramble: (scramble: Scramble) => void;
}) {
  const [moves, setMoves] = useState<string | null>(null);

  function scramble() {
    const next = randomScramble3x3();
    setMoves(next.moves);
    onScramble(next);
  }

  return (
    <section className="scramble">
      <button type="button" onClick={scramble}>
        打乱
      </button>
      <p
        className={moves ? "scramble-moves" : "scramble-hint"}
        title={moves ?? undefined}
      >
        {moves ?? "打乱当前魔方，计时回到准备"}
      </p>
    </section>
  );
}
