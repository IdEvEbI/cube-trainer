import { formatElapsed } from "./timer.ts";
import "./resultConfirm.css";

export function ResultConfirmDialog({
  timeMs,
  onKeep,
  onDiscard,
}: {
  timeMs: number;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className="result-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-confirm-title"
    >
      <div className="result-confirm-card">
        <p id="result-confirm-title" className="result-confirm-label">
          本次成绩
        </p>
        <p className="result-confirm-time">{formatElapsed(timeMs)}</p>
        <div className="result-confirm-actions">
          <button
            type="button"
            className="result-confirm-keep"
            onClick={onKeep}
          >
            保留
          </button>
          <button
            type="button"
            className="result-confirm-discard"
            onClick={onDiscard}
          >
            丢弃
          </button>
        </div>
      </div>
    </div>
  );
}
