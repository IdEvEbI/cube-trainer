import type { MouseEvent, ReactNode } from "react";
import "./practice.css";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function StartIcon() {
  return (
    <Glyph>
      <path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
      <path d="M3 20V4" />
    </Glyph>
  );
}

function PreviousIcon() {
  return (
    <Glyph>
      <path d="M13.971 4.285A2 2 0 0 1 17 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
      <path d="M21 20V4" />
    </Glyph>
  );
}

function PlayIcon() {
  return (
    <Glyph>
      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
    </Glyph>
  );
}

function PauseIcon() {
  return (
    <Glyph>
      <rect x="14" y="3" width="5" height="18" rx="1" />
      <rect x="5" y="3" width="5" height="18" rx="1" />
    </Glyph>
  );
}

function NextIcon() {
  return (
    <Glyph>
      <path d="M10.029 4.285A2 2 0 0 0 7 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
      <path d="M3 4v16" />
    </Glyph>
  );
}

function TargetIcon() {
  return (
    <Glyph>
      <path d="M21 4v16" />
      <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
    </Glyph>
  );
}

export function PracticeControls({
  atStart,
  atTarget,
  playing,
  onStart,
  onPrevious,
  onPlay,
  onNext,
  onTarget,
}: {
  atStart: boolean;
  atTarget: boolean;
  playing: boolean;
  onStart: () => void;
  onPrevious: () => void;
  onPlay: () => void;
  onNext: () => void;
  onTarget: () => void;
}) {
  function press(action: () => void, event: MouseEvent<HTMLButtonElement>) {
    action();
    event.currentTarget.blur();
  }

  return (
    <section className="practice-controls" aria-label="练习控制">
      <button
        type="button"
        aria-label="初始状态"
        title="初始状态"
        onClick={(event) => press(onStart, event)}
      >
        <StartIcon />
      </button>
      <button
        type="button"
        aria-label="上一步"
        title="上一步"
        disabled={atStart}
        onClick={(event) => press(onPrevious, event)}
      >
        <PreviousIcon />
      </button>
      <button
        type="button"
        aria-label={playing ? "停止播放" : "自动播放"}
        title={playing ? "停止播放" : "自动播放"}
        aria-pressed={playing}
        onClick={(event) => press(onPlay, event)}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        aria-label="下一步"
        title="下一步"
        disabled={atTarget}
        onClick={(event) => press(onNext, event)}
      >
        <NextIcon />
      </button>
      <button
        type="button"
        aria-label="目标状态"
        title="目标状态"
        disabled={atTarget}
        onClick={(event) => press(onTarget, event)}
      >
        <TargetIcon />
      </button>
    </section>
  );
}
