import { type MouseEvent } from "react";
import type { GuidedScrambleView } from "./guided.ts";
import "./scramble.css";

export function ScramblePanel({
  moves,
  onRescramble,
  guide = null,
}: {
  moves: string | null;
  onRescramble: () => void;
  /** 蓝牙引导态；未连接时为 null，保持纯文本展示。 */
  guide?: GuidedScrambleView | null;
}) {
  function scramble(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onRescramble();
    event.currentTarget.blur();
  }

  const guided = Boolean(guide && moves);
  const title = guide?.displayMoves.join(" ") ?? moves ?? undefined;

  return (
    <section className="scramble">
      <div className="scramble-bar">
        {guided && guide ? (
          <p className="scramble-moves scramble-moves-guided" title={title}>
            {guide.displayMoves.map((move, index) => {
              let stepClass = "scramble-step";
              if (index < guide.completedCount) {
                stepClass += " is-done";
              } else if (index === guide.currentIndex) {
                stepClass += guide.partial
                  ? " is-current is-partial"
                  : " is-current";
              }
              return (
                <span
                  key={`${index}-${move}`}
                  className={stepClass}
                  aria-current={
                    index === guide.currentIndex ? "step" : undefined
                  }
                >
                  {move}
                </span>
              );
            })}
          </p>
        ) : (
          <p
            className={moves ? "scramble-moves" : "scramble-hint"}
            title={moves ?? undefined}
          >
            {moves ?? "点击右侧图标重新打乱"}
          </p>
        )}
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
      {guided && guide?.correction ? (
        <p className="scramble-guide-note scramble-guide-fix" role="status">
          转错了，请转 {guide.correction}
        </p>
      ) : null}
      {guided &&
      guide &&
      !guide.done &&
      !guide.correction &&
      guide.expectedMove ? (
        <p className="scramble-guide-note scramble-guide-next" role="status">
          下一步 {guide.displayMoves[guide.currentIndex ?? 0]}
          {guide.partial ? "（再转半步）" : ""}
          <span className="scramble-guide-progress">
            {" "}
            · {guide.completedCount}/{guide.displayMoves.length}
          </span>
        </p>
      ) : null}
      {guided && guide?.done ? (
        <p className="scramble-guide-note scramble-guide-done" role="status">
          打乱完成
        </p>
      ) : null}
    </section>
  );
}
