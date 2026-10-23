import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ARM_HOLD_MS,
  displayPhase,
  reduceSession,
  type SessionPhase,
} from "./session.ts";
import { createTimer, formatElapsed } from "./timer.ts";
import "./timer.css";

export type TimerHandle = {
  prepare(): void;
  pressDown(): void;
  pressUp(): void;
  pressCancel(): void;
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
}) {
  const timer = useRef(createTimer());
  const phaseRef = useRef<SessionPhase>("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreNextRelease = useRef(false);
  const onStopRef = useRef(onStop);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const inputEnabledRef = useRef(inputEnabled);
  onStopRef.current = onStop;
  onPhaseChangeRef.current = onPhaseChange;
  inputEnabledRef.current = inputEnabled;
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

  function beginHold() {
    const current = phaseRef.current;
    if (current === "running") {
      return;
    }
    if (current !== "idle" && current !== "stopped") {
      return;
    }
    clearHold();
    apply({ type: "hold_start" });
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      apply({ type: "hold_ready" });
    }, ARM_HOLD_MS);
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

  function pressDown() {
    if (!inputEnabledRef.current) {
      return;
    }
    if (phaseRef.current === "running") {
      finish();
      ignoreNextRelease.current = true;
      return;
    }
    beginHold();
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
      pressDown();
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
            ? "按住空格预备，松开开始，再按空格停止"
            : "长按预备，松手开始；计时中点击停止"}
        </p>
      ) : null}
    </section>
  );
}
