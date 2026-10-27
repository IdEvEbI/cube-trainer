import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDENTITY_QUAT,
  MoyuOrientationTracker,
  quatInvert,
  quatMultiply,
  quatNormalize,
  toTwistyOrientation,
  type MoyuQuat,
} from "./orientation.ts";
import {
  parseGyroQuaternion,
  parseMoyuPacket,
  requestGyroControl,
} from "./packets.ts";
import { MOYU_MSG, MOYU_PACKET_LENGTH } from "./constants.ts";

/** Weilong 文档示例明文：AB47882CFFF873493FA2B87509ECB43AFF000000 */
const SAMPLE_GYRO_HEX = "AB47882CFFF873493FA2B87509ECB43AFF000000";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function almostEqualQuat(a: MoyuQuat, b: MoyuQuat, eps = 1e-9) {
  assert.ok(Math.abs(a.x - b.x) < eps, `x ${a.x} vs ${b.x}`);
  assert.ok(Math.abs(a.y - b.y) < eps, `y ${a.y} vs ${b.y}`);
  assert.ok(Math.abs(a.z - b.z) < eps, `z ${a.z} vs ${b.z}`);
  assert.ok(Math.abs(a.w - b.w) < eps, `w ${a.w} vs ${b.w}`);
}

describe("parseGyroQuaternion", () => {
  it("解析文档示例四元数 (w,x,-z,y) / 2^30", () => {
    const bytes = hexToBytes(SAMPLE_GYRO_HEX);
    const q = parseGyroQuaternion(bytes);
    assert.ok(Math.abs(q.w - -0.012906962) < 1e-6);
    assert.ok(Math.abs(q.x - 0.9888582) < 1e-5);
    assert.ok(Math.abs(q.z - -0.14780989475548267) < 1e-6);
    assert.ok(Math.abs(q.y - -0.012041826) < 1e-6);
  });

  it("parseMoyuPacket 识别 0xAB", () => {
    const parsed = parseMoyuPacket(hexToBytes(SAMPLE_GYRO_HEX));
    assert.equal(parsed.type, "gyro");
    if (parsed.type !== "gyro") {
      return;
    }
    assert.ok(Math.abs(parsed.quaternion.x - 0.9888582) < 1e-5);
  });
});

describe("requestGyroControl", () => {
  it("开启时第三字节为 1", () => {
    const on = requestGyroControl(true);
    assert.equal(on.length, MOYU_PACKET_LENGTH);
    assert.equal(on[0], MOYU_MSG.gyroControl);
    assert.equal(on[2], 1);
  });

  it("关闭时第三字节为 0", () => {
    const off = requestGyroControl(false);
    assert.equal(off[0], MOYU_MSG.gyroControl);
    assert.equal(off[2], 0);
  });
});

describe("orientation math", () => {
  it("toTwistyOrientation 归一化，不改轴序（Weilong 已对齐 Twisty）", () => {
    const mapped = toTwistyOrientation({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 });
    const expected = quatNormalize({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 });
    almostEqualQuat(mapped, expected);
  });

  it("quatMultiply / invert 互逆", () => {
    const q: MoyuQuat = { x: 0.1, y: -0.2, z: 0.3, w: 0.9 };
    const u = quatNormalize(q);
    const id = quatMultiply(u, quatInvert(u));
    almostEqualQuat(id, IDENTITY_QUAT);
  });
});

describe("MoyuOrientationTracker", () => {
  it("对齐后相对姿态为单位四元数", () => {
    const tracker = new MoyuOrientationTracker();
    const held = quatNormalize({ x: 0.2, y: 0.1, z: -0.3, w: 0.9 });
    assert.deepEqual(tracker.alignToCurrent(held), IDENTITY_QUAT);
    almostEqualQuat(tracker.toOrientation(held), IDENTITY_QUAT);
  });

  it("对齐后同一姿态保持单位；再旋转则左乘 basis⊗mapped", () => {
    const tracker = new MoyuOrientationTracker();
    tracker.alignToCurrent(IDENTITY_QUAT);
    almostEqualQuat(tracker.toOrientation(IDENTITY_QUAT), IDENTITY_QUAT);

    const tilted = quatNormalize({
      x: 0,
      y: Math.SQRT1_2,
      z: 0,
      w: Math.SQRT1_2,
    });
    const ori = tracker.toOrientation(tilted);
    // home=I → basis=I → result = tilted（绕 Y = U/D）
    almostEqualQuat(ori, tilted);
  });

  it("尚无数据时对齐抛错", () => {
    const tracker = new MoyuOrientationTracker();
    assert.throws(() => tracker.alignToCurrent(), /尚无陀螺仪数据/);
  });
});
