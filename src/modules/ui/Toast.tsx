import { useEffect } from "react";
import "./toast.css";

export const TOAST_WEB_BLUETOOTH_UNSUPPORTED = "当前浏览器不支持蓝牙";

export function Toast({
  message,
  durationMs = 2500,
  onDone,
}: {
  message: string;
  durationMs?: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, message, onDone]);

  return (
    <div className="app-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
