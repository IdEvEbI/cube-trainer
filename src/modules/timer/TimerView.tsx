import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  armHoldDelayMs,
  displayPhase,
  reduceHoldStart,
  reduceSession,
  type SessionPhase,
  type TimingInputSource,
} from "./session.ts";
import { createTimer, formatElapsed } from "./timer.ts";
import "./timer.css";

export type TimerHandle = {
  prepare(): void;
  pressDown(source?: TimingInputSource): void;
  pressUp(): void;
  pressCancel(): void;
  /** 蓝牙打乱完成后，实体首转直接开表（跳过长按预备）。 */
  startRunning(): void;
  /** 蓝牙检测到还原后停表（走与点击停止相同的 onStop）。 */
  stopRunning(): void;
};

const statusLabel: Record<ReturnType<typeof displayPhase>, string> = {
  idle: "准备",
  armed: "预备",
  running: "计时中",
  stopped: "已停止",
};

export function TimerView({
  ref,
  onStop,
  onPhaseChange,
  showControls = true,
  showChrome = true,
  inputEnabled = true,
  allowHoldStart = true,
}: {
  ref?: Ref<TimerHandle>;
  onStop?: (timeMs: number) => void;
  onPhaseChange?: (phase: SessionPhase) => void;
  /** Practice panel keeps start/stop buttons; scramble first screen hides them. */
  showControls?: boolean;
  /** Scramble first screen shows only the time digits. */
  showChrome?: boolean;
  /** When false, Space / press helpers are ignored (e.g. result confirm open). */
  inputEnabled?: boolean;
  /**
   * 为 false 时禁止长按 / 空格开表（蓝牙模式用首转启动），
   * 计时中点击 / 空格仍可停止。
   */
  allowHoldStart?: boolean;
}) {
  const timer = useRef(createTimer());
  const phaseRef = useRef<SessionPhase>("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreNextRelease = useRef(false);
  const onStopRef = useRef(onStop);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const inputEnabledRef = useRef(inputEnabled);
  const allowHoldStartRef = useRef(allowHoldStart);
  onStopRef.current = onStop;
  onPhaseChangeRef.current = onPhaseChange;
  inputEnabledRef.current = inputEnabled;
  allowHoldStartRef.current = allowHoldStart;
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const shown = displayPhase(phase);

  function moveTo(next: SessionPhase) {
    if (phaseRef.current === next) {
      return;
    }
    phaseRef.current = next;
    setPhase(next);
    onPhaseChangeRef.current?.(next);
  }

  function apply(event: Parameters<typeof reduceSession>[1]) {
    moveTo(reduceSession(phaseRef.current, event));
  }

  function clearHold() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function beginHold(source: TimingInputSource) {
    const current = phaseRef.current;
    if (current === "running") {
      return;
    }
    if (current !== "idle" && current !== "stopped") {
      return;
    }
    clearHold();
    const next = reduceHoldStart(current, source);
    moveTo(next);
    // Keyboard arms synchronously; pointer still waits out the hold delay.
    const delayMs = armHoldDelayMs(source);
    if (delayMs > 0 && next === "arming") {
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        apply({ type: "hold_ready" });
      }, delayMs);
    }
  }

  function endHold() {
    clearHold();
    const current = phaseRef.current;
    if (current === "arming") {
      apply({ type: "hold_cancel" });
      return;
    }
    if (current === "armed") {
      timer.current.start();
      setElapsed(timer.current.current());
      apply({ type: "hold_release" });
    }
  }

  function cancelHold() {
    clearHold();
    if (phaseRef.current === "arming") {
      apply({ type: "hold_cancel" });
      return;
    }
    if (phaseRef.current === "armed") {
      apply({ type: "reset" });
    }
  }

  function finish() {
    if (phaseRef.current !== "running") {
      return;
    }
    timer.current.stop();
    const timeMs = timer.current.current();
    setElapsed(timeMs);
    apply({ type: "stop" });
    onStopRef.current?.(timeMs);
  }

  function reset() {
    clearHold();
    ignoreNextRelease.current = false;
    timer.current.reset();
    setElapsed(0);
    apply({ type: "reset" });
  }

  function pressDown(source: TimingInputSource = "pointer") {
    if (!inputEnabledRef.current) {
      return;
    }
    if (phaseRef.current === "running") {
      finish();
      ignoreNextRelease.current = true;
      return;
    }
    if (!allowHoldStartRef.current) {
      return;
    }
    beginHold(source);
  }

  function startRunning() {
    if (phaseRef.current === "running") {
      return;
    }
    clearHold();
    ignoreNextRelease.current = false;
    timer.current.start();
    setElapsed(timer.current.current());
    apply({ type: "bt_start" });
  }

  function stopRunning() {
    finish();
  }

  function pressUp() {
    if (!inputEnabledRef.current) {
      return;
    }
    if (ignoreNextRelease.current) {
      ignoreNextRelease.current = false;
      return;
    }
    endHold();
  }

  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    let frame = 0;
    const tick = () => {
      setElapsed(timer.current.current());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    const interactive = (target: EventTarget | null) => {
      if (
        !target ||
        typeof (target as { closest?: unknown }).closest !== "function"
      ) {
        return false;
      }
      return Boolean(
        (target as Element).closest(
          "button, summary, a, input, textarea, select",
        ),
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }
      if (interactive(event.target)) {
        return;
      }
      event.preventDefault();
      pressDown("keyboard");
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }
      event.preventDefault();
      pressUp();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      clearHold();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    prepare: reset,
    pressDown,
    pressUp,
    pressCancel: cancelHold,
    startRunning,
    stopRunning,
  }));

  return (
    <section
      className={showControls ? "timer" : "timer timer-surface"}
      data-phase={shown}
    >
      {showChrome ? <p className="timer-status">{statusLabel[shown]}</p> : null}
      <p className={shown === "armed" ? "timer-time is-armed" : "timer-time"}>
        {formatElapsed(elapsed)}
      </p>
      {showControls ? (
        <div className="timer-actions">
          <button
            type="button"
            onClick={() => {
              timer.current.start();
              setElapsed(timer.current.current());
              moveTo("running");
            }}
            disabled={phase === "running"}
          >
            开始
          </button>
          <button type="button" onClick={finish} disabled={phase !== "running"}>
            停止
          </button>
          <button type="button" onClick={reset}>
            重置
          </button>
        </div>
      ) : null}
      {showChrome ? (
        <p className="timer-hint">
          {showControls
            ? "空格开始，再按空格停止；触控仍长按预备"
            : "长按预备，松手开始；计时中点击停止"}
        </p>
      ) : null}
    </section>
  );
}
