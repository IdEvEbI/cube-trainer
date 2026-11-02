import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLUETOOTH_INSPECT_SECONDS,
  finishBluetoothInspect,
  formatInspectCountdown,
  nextInspectPhaseOnGuideDone,
  shouldEndInspectOnCubeTurn,
} from "./bluetoothInspect.ts";
import { shouldStartBluetoothTimer } from "../timer/session.ts";

describe("bluetoothInspect", () => {
  it("默认观察 15 秒", () => {
    assert.equal(BLUETOOTH_INSPECT_SECONDS, 15);
  });

  it("引导完成进入观察；已在观察 / 待转不重置", () => {
    assert.equal(nextInspectPhaseOnGuideDone("off"), "inspecting");
    assert.equal(nextInspectPhaseOnGuideDone("inspecting"), "inspecting");
    assert.equal(nextInspectPhaseOnGuideDone("ready"), "ready");
  });

  it("跳过、倒计时结束或观察中拧动进入待转", () => {
    assert.equal(finishBluetoothInspect("inspecting"), "ready");
    assert.equal(finishBluetoothInspect("ready"), "ready");
    assert.equal(finishBluetoothInspect("off"), "off");
  });

  it("仅观察中拧动应结束倒计时", () => {
    assert.equal(shouldEndInspectOnCubeTurn("inspecting"), true);
    assert.equal(shouldEndInspectOnCubeTurn("ready"), false);
    assert.equal(shouldEndInspectOnCubeTurn("off"), false);
  });

  it("倒计时文案按秒向上取整", () => {
    assert.equal(formatInspectCountdown(15_000), "15");
    assert.equal(formatInspectCountdown(14_001), "15");
    assert.equal(formatInspectCountdown(14_000), "14");
    assert.equal(formatInspectCountdown(0), "0");
  });
});

describe("shouldStartBluetoothTimer with inspect", () => {
  it("待转或观察中且引导完成时允许转动开表", () => {
    assert.equal(shouldStartBluetoothTimer(true, "idle", "ready"), true);
    assert.equal(shouldStartBluetoothTimer(true, "idle", "inspecting"), true);
    assert.equal(shouldStartBluetoothTimer(true, "idle", "off"), false);
    assert.equal(shouldStartBluetoothTimer(true, "running", "ready"), false);
    assert.equal(shouldStartBluetoothTimer(false, "idle", "ready"), false);
  });
});
