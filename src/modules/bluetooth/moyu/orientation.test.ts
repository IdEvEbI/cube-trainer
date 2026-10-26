import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDENTITY_QUAT,
  MoyuOrientationTracker,
  quatInvert,
  quatMultiply,
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
  it("toTwistyOrientation 翻转 y", () => {
    assert.deepEqual(toTwistyOrientation({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 }), {
      x: 0.1,
      y: -0.2,
      z: 0.3,
      w: 0.9,
    });
  });

  it("quatMultiply / invert 互逆", () => {
    const q: MoyuQuat = { x: 0.1, y: -0.2, z: 0.3, w: 0.9 };
    const norm = Math.hypot(q.x, q.y, q.z, q.w);
    const u = {
      x: q.x / norm,
      y: q.y / norm,
      z: q.z / norm,
      w: q.w / norm,
    };
    const id = quatMultiply(u, quatInvert(u));
    assert.ok(Math.abs(id.w - 1) < 1e-9);
    assert.ok(Math.abs(id.x) < 1e-9);
    assert.ok(Math.abs(id.y) < 1e-9);
    assert.ok(Math.abs(id.z) < 1e-9);
  });

  it("绕 Z 轴 180°（z2）相对姿态保留 z 轴分量", () => {
    // 180° about Z: (0,0,1,0) — 对应实体 z2（黄上绿前）
    const z2: MoyuQuat = { x: 0, y: 0, z: 1, w: 0 };
    const twisty = toTwistyOrientation(z2);
    assert.ok(Math.abs(twisty.x) < 1e-12);
    assert.ok(Math.abs(twisty.y) < 1e-12);
    assert.ok(Math.abs(twisty.z - 1) < 1e-12);
    assert.ok(Math.abs(twisty.w) < 1e-12);
  });
});

describe("MoyuOrientationTracker", () => {
  it("对齐后相对姿态为单位四元数", () => {
    const tracker = new MoyuOrientationTracker();
    const held: MoyuQuat = { x: 0.2, y: 0.1, z: -0.3, w: 0.9 };
    const n = Math.hypot(held.x, held.y, held.z, held.w);
    const q = {
      x: held.x / n,
      y: held.y / n,
      z: held.z / n,
      w: held.w / n,
    };
    assert.deepEqual(tracker.alignToCurrent(q), IDENTITY_QUAT);
    const ori = tracker.toOrientation(q);
    assert.ok(Math.abs(ori.x) < 1e-9);
    assert.ok(Math.abs(ori.y) < 1e-9);
    assert.ok(Math.abs(ori.z) < 1e-9);
    assert.ok(Math.abs(ori.w - 1) < 1e-9);
  });

  it("对齐后做 z2，输出接近绕 Z 180°", () => {
    const tracker = new MoyuOrientationTracker();
    const home = IDENTITY_QUAT;
    tracker.alignToCurrent(home);
    // 相对 home 的 z2
    const afterZ2: MoyuQuat = { x: 0, y: 0, z: 1, w: 0 };
    const ori = tracker.toOrientation(afterZ2);
    assert.ok(Math.abs(ori.x) < 1e-9);
    assert.ok(Math.abs(ori.y) < 1e-9);
    assert.ok(Math.abs(Math.abs(ori.z) - 1) < 1e-9);
    assert.ok(Math.abs(ori.w) < 1e-9);
  });

  it("尚无数据时对齐抛错", () => {
    const tracker = new MoyuOrientationTracker();
    assert.throws(() => tracker.alignToCurrent(), /尚无陀螺仪数据/);
  });
});
