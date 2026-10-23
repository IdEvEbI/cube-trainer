import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TARGET_FACE_COLORS } from "../cube/types.ts";
import {
  DISPLAY_NET_CENTER,
  FACE_COLOR_HEX,
  NET_FACES,
  SCRAMBLE_NET_CENTER,
  SOLVED_NET_COLOR,
  scrambleDisplayNet,
  scrambleNet,
} from "./net.ts";

function sameColor(color: string): string[] {
  return Array.from({ length: 9 }, () => color);
}

describe("scrambleNet", () => {
  it("复原展开图是白上、绿前、橙左、红右、蓝后、黄下", async () => {
    const net = await scrambleNet("U U'");

    for (const face of NET_FACES) {
      assert.deepEqual(net[face], sameColor(SOLVED_NET_COLOR[face]));
    }
  });

  it("U 把右面的上一行转到前面", async () => {
    const net = await scrambleNet("U");

    assert.deepEqual(net.F.slice(0, 3), ["红", "红", "红"]);
    assert.deepEqual(net.L.slice(0, 3), ["绿", "绿", "绿"]);
    assert.equal(net.U[4], "白");
    assert.equal(net.F[4], "绿");
  });

  it("R 把前面的右列转到上面，中心块不动", async () => {
    const net = await scrambleNet("R");

    assert.deepEqual([net.U[2], net.U[5], net.U[8]], ["绿", "绿", "绿"]);
    assert.equal(net.U[4], "白");
    assert.equal(net.R[4], "红");
    assert.equal(net.F[4], "绿");
  });

  it("面上的颜色会随下一步转动", async () => {
    const net = await scrambleNet("U F");

    assert.deepEqual(net.F, [
      "绿",
      "绿",
      "红",
      "绿",
      "绿",
      "红",
      "绿",
      "绿",
      "红",
    ]);
  });

  it("转四次后回到复原", async () => {
    const net = await scrambleNet("R2 R2");
    const solved = await scrambleNet("F F'");

    assert.deepEqual(net, solved);
  });

  it("拒绝空打乱和整颗转动", async () => {
    await assert.rejects(() => scrambleNet("   "), /打乱是空的/);
    await assert.rejects(() => scrambleNet("R U x"), /无法打乱：x/);
  });
});

describe("scrambleNet 与计时首屏朝向", () => {
  it("打乱后平面图白上绿前，与 CSTimer / 3D 打乱核对朝向一致", async () => {
    const net = await scrambleNet("U U'");

    for (const face of NET_FACES) {
      assert.equal(net[face][4], SCRAMBLE_NET_CENTER[face]);
      assert.equal(net[face][4], SOLVED_NET_COLOR[face]);
    }
  });

  it("同一打乱下中心色保持白上、橙左、绿前、红右", async () => {
    const net = await scrambleNet("R U R'");
    assert.equal(net.U[4], "白");
    assert.equal(net.D[4], "黄");
    assert.equal(net.F[4], "绿");
    assert.equal(net.B[4], "蓝");
    assert.equal(net.L[4], "橙");
    assert.equal(net.R[4], "红");
  });
});

describe("scrambleDisplayNet", () => {
  it("黄上还原朝向仍可用（练习用，计时首屏不用）", async () => {
    const net = await scrambleDisplayNet("U U'");

    for (const face of NET_FACES) {
      assert.equal(net[face][4], DISPLAY_NET_CENTER[face]);
      assert.equal(net[face][4], TARGET_FACE_COLORS[face]);
    }
  });
});

describe("FACE_COLOR_HEX", () => {
  it("平面图色值与 Twisty PGColors 一致", () => {
    assert.equal(FACE_COLOR_HEX.白, "#ffffff");
    assert.equal(FACE_COLOR_HEX.橙, "#ff8000");
    assert.equal(FACE_COLOR_HEX.绿, "#44ee00");
    assert.equal(FACE_COLOR_HEX.红, "#ff0000");
    assert.equal(FACE_COLOR_HEX.蓝, "#2266ff");
    assert.equal(FACE_COLOR_HEX.黄, "#f4f400");
  });
});
