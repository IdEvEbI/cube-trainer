import { formatInspectCountdown } from "./bluetoothInspect.ts";
import "./scramble.css";

export function BluetoothInspectPanel({
  remainingMs,
  onSkip,
}: {
  remainingMs: number;
  onSkip: () => void;
}) {
  return (
    <section className="scramble scramble-inspect" aria-label="观察">
      <p className="scramble-inspect-label">观察</p>
      <p className="scramble-inspect-count" role="timer" aria-live="polite">
        {formatInspectCountdown(remainingMs)}
      </p>
      <button
        type="button"
        className="scramble-inspect-skip"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onSkip();
          event.currentTarget.blur();
        }}
      >
        跳过观察
      </button>
    </section>
  );
}
