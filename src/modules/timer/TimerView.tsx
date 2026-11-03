import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ARM_HOLD_MS,
  armHoldDelayMs,
  displayPhase,
  nonBluetoothHoldReadyAction,
  nonBluetoothShortReleaseAction,
  reduceHoldStart,
  reduceSession,
  shouldEndHoldOnRelease,
  type SessionPhase,
  type TimingInputSource,
} from "./session.ts";
import { createTimer, formatElapsedParts, timerDisplayScale } from "./timer.ts";
import "./timer.css";

export type TimerHandle = {
  prepare(): void;
  /** 非蓝牙：长按达标后进入倒计时（浅绿闪烁 0.00）。 */
  enterArmed(): void;
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
  allowManualStop = true,
  scrambleHomeGestures = false,
  scramblePlaying = false,
  scrambleComplete = false,
  onPlayScramble,
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
   * 为 false 时禁止长按 / 空格开表（蓝牙模式用首转启动）。
   */
  allowHoldStart?: boolean;
  /**
   * 为 false 时禁止点击 / 空格手动停表（蓝牙仅还原自动停）。
   * `stopRunning()` 仍可用。
   */
  allowManualStop?: boolean;
  /**
   * 非蓝牙首页：短按播打乱 / 直接开表；长按进入浅绿倒计时。
   */
  scrambleHomeGestures?: boolean;
  /** 打乱自动播放中；空格 / 点击应暂停而非开表。 */
  scramblePlaying?: boolean;
  /** 打乱游标是否已到末步（与播放条进度一致）。 */
  scrambleComplete?: boolean;
  /** 短按且未打乱完时触发自动播放；播放中再调则暂停。 */
  onPlayScramble?: () => void;
}) {
  const timer = useRef(createTimer());
  const phaseRef = useRef<SessionPhase>("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreNextRelease = useRef(false);
  const onStopRef = useRef(onStop);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const inputEnabledRef = useRef(inputEnabled);
  const allowHoldStartRef = useRef(allowHoldStart);
  const allowManualStopRef = useRef(allowManualStop);
  const scrambleHomeGesturesRef = useRef(scrambleHomeGestures);
  const scramblePlayingRef = useRef(scramblePlaying);
  const scrambleCompleteRef = useRef(scrambleComplete);
  const onPlayScrambleRef = useRef(onPlayScramble);
  onStopRef.current = onStop;
  onPhaseChangeRef.current = onPhaseChange;
  inputEnabledRef.current = inputEnabled;
  allowHoldStartRef.current = allowHoldStart;
  allowManualStopRef.current = allowManualStop;
  scrambleHomeGesturesRef.current = scrambleHomeGestures;
  scramblePlayingRef.current = scramblePlaying;
  scrambleCompleteRef.current = scrambleComplete;
  onPlayScrambleRef.current = onPlayScramble;
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const shown = displayPhase(phase);

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  function goRunning() {
    timer.current.start();
    setElapsed(timer.current.current());
    apply({ type: "hold_release" });
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
    // 每次进入准备都复位显示，避免仍停在上一次成绩。
    timer.current.reset();
    setElapsed(0);

    if (scrambleHomeGesturesRef.current) {
      // 空格 / 触控统一延迟，区分短按与长按。
      apply({ type: "hold_start" });
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        if (
          nonBluetoothHoldReadyAction(scrambleCompleteRef.current) ===
          "enter_armed"
        ) {
          apply({ type: "hold_ready" });
        }
      }, ARM_HOLD_MS);
      return;
    }

    const next = reduceHoldStart(current, source);
    moveTo(next);
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
      if (scrambleHomeGesturesRef.current) {
        const action = nonBluetoothShortReleaseAction(
          scrambleCompleteRef.current,
        );
        apply({ type: "hold_cancel" });
        if (action === "play_scramble") {
          onPlayScrambleRef.current?.();
        } else {
          timer.current.start();
          setElapsed(timer.current.current());
          apply({ type: "bt_start" });
        }
        return;
      }
      apply({ type: "hold_cancel" });
      return;
    }
    if (current === "armed") {
      goRunning();
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

  function enterArmed() {
    if (phaseRef.current === "running" || phaseRef.current === "armed") {
      return;
    }
    clearHold();
    ignoreNextRelease.current = false;
    timer.current.reset();
    setElapsed(0);
    apply({ type: "arm" });
  }

  function pressDown(source: TimingInputSource = "pointer") {
    if (!inputEnabledRef.current) {
      return;
    }
    if (phaseRef.current === "running") {
      if (!allowManualStopRef.current) {
        return;
      }
      finish();
      ignoreNextRelease.current = true;
      return;
    }
    // 打乱播放中：空格只暂停，不进入开表 / 倒计时手势。
    if (scrambleHomeGesturesRef.current && scramblePlayingRef.current) {
      onPlayScrambleRef.current?.();
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
    const decision = shouldEndHoldOnRelease(
      ignoreNextRelease.current,
      inputEnabledRef.current,
    );
    ignoreNextRelease.current = decision.nextIgnore;
    if (decision.endHold) {
      endHold();
    }
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
    enterArmed,
    pressDown,
    pressUp,
    pressCancel: cancelHold,
    startRunning,
    stopRunning,
  }));

  const parts = formatElapsedParts(elapsed);
  const scale = timerDisplayScale(elapsed, viewportWidth);

  return (
    <section
      className={showControls ? "timer" : "timer timer-surface"}
      data-phase={shown}
      data-scale={scale}
    >
      {showChrome ? <p className="timer-status">{statusLabel[shown]}</p> : null}
      <p className={shown === "armed" ? "timer-time is-armed" : "timer-time"}>
        <span className="timer-time-main">{parts.main}</span>
        <span className="timer-time-dot" aria-hidden="true" />
        <span className="timer-time-frac">{parts.fraction}</span>
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
            复位
          </button>
        </div>
      ) : null}
      {showChrome ? (
        <p className="timer-hint">
          {scrambleHomeGestures
            ? "短按播打乱或开表；长按进入倒计时，松手开表；计时中再按停止"
            : "打乱完成后自动进入倒计时；空格或点击开始 / 停止"}
        </p>
      ) : null}
    </section>
  );
}
