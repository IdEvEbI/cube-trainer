import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NET_FACES, SOLVED_NET_COLOR, scrambleNet } from "./net.ts";

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
