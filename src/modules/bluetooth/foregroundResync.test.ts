import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldAbandonTimingAfterForegroundSolvedResync,
  shouldRequestStatusOnForeground,
} from "./foregroundResync.ts";

describe("shouldRequestStatusOnForeground", () => {
  it("仅在可见、已连接且空闲时请求", () => {
    assert.equal(
      shouldRequestStatusOnForeground({
        visibilityState: "visible",
        connected: true,
        busy: false,
        resyncInFlight: false,
      }),
      true,
    );
  });

  it("隐藏、未连接、忙或已在对表中则跳过", () => {
    assert.equal(
      shouldRequestStatusOnForeground({
        visibilityState: "hidden",
        connected: true,
        busy: false,
        resyncInFlight: false,
      }),
      false,
    );
    assert.equal(
      shouldRequestStatusOnForeground({
        visibilityState: "visible",
        connected: false,
        busy: false,
        resyncInFlight: false,
      }),
      false,
    );
    assert.equal(
      shouldRequestStatusOnForeground({
        visibilityState: "visible",
        connected: true,
        busy: true,
        resyncInFlight: false,
      }),
      false,
    );
    assert.equal(
      shouldRequestStatusOnForeground({
        visibilityState: "visible",
        connected: true,
        busy: false,
        resyncInFlight: true,
      }),
      false,
    );
  });
});

describe("shouldAbandonTimingAfterForegroundSolvedResync", () => {
  it("仅 running 且无待确认 UI 时作废（不对表后的复原记成绩）", () => {
    assert.equal(
      shouldAbandonTimingAfterForegroundSolvedResync({
        timerPhase: "running",
        hasPendingSolveUi: false,
      }),
      true,
    );
    assert.equal(
      shouldAbandonTimingAfterForegroundSolvedResync({
        timerPhase: "idle",
        hasPendingSolveUi: false,
      }),
      false,
    );
    assert.equal(
      shouldAbandonTimingAfterForegroundSolvedResync({
        timerPhase: "running",
        hasPendingSolveUi: true,
      }),
      false,
    );
  });
});
