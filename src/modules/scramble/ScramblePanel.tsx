import { type MouseEvent } from "react";
import "./scramble.css";

export function ScramblePanel({
  moves,
  onRescramble,
}: {
  moves: string | null;
  onRescramble: () => void;
}) {
  function scramble(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onRescramble();
    event.currentTarget.blur();
  }

  return (
    <section className="scramble">
      <div className="scramble-bar">
        <p
          className={moves ? "scramble-moves" : "scramble-hint"}
          title={moves ?? undefined}
        >
          {moves ?? "点击右侧图标重新打乱"}
        </p>
        <button
          type="button"
          className="scramble-icon"
          aria-label="重新打乱"
          title="重新打乱"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={scramble}
        >
          <svg
            className="scramble-icon-svg"
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
    </section>
  );
}
