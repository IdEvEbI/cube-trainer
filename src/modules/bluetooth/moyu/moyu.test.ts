import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOYU_MOVES, MOYU_MSG, MOYU_PACKET_LENGTH } from "./constants.ts";
import {
  decodeFaceletColors,
  encodeFaceletBits,
  faceletsToUrfDlB,
  moyuColorToZh,
  SOLVED_FACELETS_URFDLB,
  solvedFaceletColors,
  type MoyuColor,
} from "./facelets.ts";
import {
  buildInfoPacket,
  buildMovePacket,
  buildPowerPacket,
  buildStatusPacket,
  parseMoyuPacket,
  requestCubeInfo,
  requestCubePower,
  requestCubeStatus,
} from "./packets.ts";

describe("moyu facelets", () => {
  it("复原 48 色压包再解包不变", () => {
    const colors = solvedFaceletColors();
    assert.deepEqual(decodeFaceletColors(encodeFaceletBits(colors)), colors);
  });

  it("复原态展开为标准 URFDLB facelet 串", () => {
    assert.equal(
      faceletsToUrfDlB(solvedFaceletColors()),
      SOLVED_FACELETS_URFDLB,
    );
  });

  it("色号映射到中文色名", () => {
    assert.equal(moyuColorToZh(0), "绿");
    assert.equal(moyuColorToZh(2), "白");
    assert.equal(moyuColorToZh(5), "红");
  });

  it("拒绝非法色号", () => {
    assert.throws(() => decodeFaceletColors("111".repeat(48)), /无效贴纸色号/);
  });
});

describe("moyu request packets", () => {
  it("请求包为 20 字节且首字节为操作码", () => {
    assert.equal(requestCubeInfo()[0], MOYU_MSG.info);
    assert.equal(requestCubeStatus()[0], MOYU_MSG.status);
    assert.equal(requestCubePower()[0], MOYU_MSG.power);
    assert.equal(requestCubeInfo().length, MOYU_PACKET_LENGTH);
  });
});

describe("parseMoyuPacket with simulated plaintext", () => {
  it("解析 A1 设备信息", () => {
    const packet = buildInfoPacket({
      model: "WCU_MY32",
      hardwareMajor: 1,
      hardwareMinor: 2,
      softwareMajor: 3,
      softwareMinor: 4,
      moveCounter: 17,
    });
    const parsed = parseMoyuPacket(packet);
    assert.equal(parsed.type, "info");
    if (parsed.type !== "info") {
      return;
    }
    assert.equal(parsed.model, "WCU_MY32");
    assert.equal(parsed.hardwareMajor, 1);
    assert.equal(parsed.hardwareMinor, 2);
    assert.equal(parsed.softwareMajor, 3);
    assert.equal(parsed.softwareMinor, 4);
    assert.equal(parsed.moveCounter, 17);
  });

  it("解析 A3 复原态 → facelets", () => {
    const packet = buildStatusPacket(solvedFaceletColors(), 0);
    const parsed = parseMoyuPacket(packet);
    assert.equal(parsed.type, "status");
    if (parsed.type !== "status") {
      return;
    }
    assert.equal(parsed.facelets, SOLVED_FACELETS_URFDLB);
    assert.equal(parsed.moveCounter, 0);
    assert.equal(parsed.colors.length, 48);
  });

  it("解析 A3 非复原态（仅 U 面贴纸变色）", () => {
    const colors = solvedFaceletColors();
    // U 在 FBUDLR 中为第 3 面（index 2），把第一枚贴纸改成绿
    colors[16] = 0;
    const parsed = parseMoyuPacket(buildStatusPacket(colors, 9));
    assert.equal(parsed.type, "status");
    if (parsed.type !== "status") {
      return;
    }
    assert.notEqual(parsed.facelets, SOLVED_FACELETS_URFDLB);
    assert.equal(parsed.facelets[0], "F");
    assert.equal(parsed.moveCounter, 9);
  });

  it("解析 A4 电量", () => {
    const parsed = parseMoyuPacket(buildPowerPacket(87));
    assert.equal(parsed.type, "power");
    if (parsed.type !== "power") {
      return;
    }
    assert.equal(parsed.batteryPercent, 87);
  });

  it("解析 A5 转动历史（最新在前）", () => {
    const packet = buildMovePacket(42, [
      { move: "R", intervalMs: 120 },
      { move: "U'", intervalMs: 80 },
      { move: "F", intervalMs: 200 },
    ]);
    const parsed = parseMoyuPacket(packet);
    assert.equal(parsed.type, "move");
    if (parsed.type !== "move") {
      return;
    }
    assert.equal(parsed.moveCounter, 42);
    assert.deepEqual(
      parsed.history.map((item) => item.move),
      ["R", "U'", "F"],
    );
    assert.equal(parsed.history[0]?.intervalMs, 120);
    assert.equal(parsed.history[1]?.intervalMs, 80);
  });

  it("A5 覆盖全部 12 种单层转动编码", () => {
    for (let code = 0; code < MOYU_MOVES.length; code += 1) {
      const move = MOYU_MOVES[code]!;
      const parsed = parseMoyuPacket(
        buildMovePacket(code + 1, [{ move, intervalMs: 1 }]),
      );
      assert.equal(parsed.type, "move");
      if (parsed.type !== "move") {
        return;
      }
      assert.equal(parsed.history[0]?.move, move);
    }
  });

  it("未知操作码返回 unknown", () => {
    const packet = new Uint8Array(MOYU_PACKET_LENGTH);
    packet[0] = 0xee;
    const parsed = parseMoyuPacket(packet);
    assert.deepEqual(parsed, { type: "unknown", opcode: 0xee });
  });

  it("空包抛错", () => {
    assert.throws(() => parseMoyuPacket([]), /空/);
  });
});

describe("moyu simulated solve pipeline", () => {
  it("收包序列：信息 → 状态 → 转动，得到可跟踪状态", () => {
    const info = parseMoyuPacket(
      buildInfoPacket({
        model: "WCU_MY32",
        hardwareMajor: 1,
        hardwareMinor: 0,
        softwareMajor: 2,
        softwareMinor: 1,
        moveCounter: 0,
      }),
    );
    const status = parseMoyuPacket(buildStatusPacket(solvedFaceletColors(), 0));
    const move = parseMoyuPacket(
      buildMovePacket(1, [{ move: "R", intervalMs: 50 }]),
    );

    assert.equal(info.type, "info");
    assert.equal(status.type, "status");
    assert.equal(move.type, "move");
    if (status.type !== "status" || move.type !== "move") {
      return;
    }
    assert.equal(status.facelets, SOLVED_FACELETS_URFDLB);
    assert.equal(move.history[0]?.move, "R");
  });

  it("自定义 48 色可还原中文色名序列", () => {
    const colors: MoyuColor[] = solvedFaceletColors();
    assert.equal(
      colors.map(moyuColorToZh).slice(0, 8).join(""),
      "绿".repeat(8),
    );
    assert.equal(
      colors.map(moyuColorToZh).slice(16, 24).join(""),
      "白".repeat(8),
    );
  });
});
