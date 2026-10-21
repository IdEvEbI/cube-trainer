import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { createTimer, formatElapsed } from "./timer.ts";
import "./timer.css";

export type TimerHandle = {
  prepare(): void;
};

type Phase = "idle" | "armed" | "running" | "stopped";

const statusLabel: Record<Phase, string> = {
  idle: "准备",
  armed: "预备",
  running: "计时中",
  stopped: "已停止",
};

export function TimerView({
  ref,
  onStop,
}: {
  ref?: Ref<TimerHandle>;
  onStop?: (timeMs: number) => void;
}) {
  const timer = useRef(createTimer());
  const phaseRef = useRef<Phase>("idle");
  const stopKeyHeld = useRef(false);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);

  function moveTo(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("button, summary")
      ) {
        return;
      }
      event.preventDefault();
      if (phaseRef.current === "running") {
        finish();
        stopKeyHeld.current = true;
        return;
      }
      if (phaseRef.current === "armed") {
        return;
      }
      moveTo("armed");
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }
      if (stopKeyHeld.current) {
        stopKeyHeld.current = false;
        return;
      }
      if (phaseRef.current !== "armed") {
        return;
      }
      event.preventDefault();
      timer.current.start();
      setElapsed(timer.current.current());
      moveTo("running");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function start() {
    timer.current.start();
    setElapsed(timer.current.current());
    moveTo("running");
  }

  function finish() {
    if (phaseRef.current !== "running") {
      return;
    }
    timer.current.stop();
    const timeMs = timer.current.current();
    setElapsed(timeMs);
    moveTo("stopped");
    onStopRef.current?.(timeMs);
  }

  function stop() {
    finish();
  }

  function reset() {
    stopKeyHeld.current = false;
    timer.current.reset();
    setElapsed(0);
    moveTo("idle");
  }

  useImperativeHandle(ref, () => ({
    prepare: reset,
  }));

  return (
    <section className="timer">
      <p className="timer-status">{statusLabel[phase]}</p>
      <p className={phase === "armed" ? "timer-time is-armed" : "timer-time"}>
        {formatElapsed(elapsed)}
      </p>
      <div className="timer-actions">
        <button type="button" onClick={start} disabled={phase === "running"}>
          开始
        </button>
        <button type="button" onClick={stop} disabled={phase !== "running"}>
          停止
        </button>
        <button type="button" onClick={reset}>
          重置
        </button>
      </div>
      <p className="timer-hint">按住空格预备，松开开始，再按空格停止</p>
    </section>
  );
}
