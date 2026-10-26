import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decryptMoyuPacket,
  deriveMoyuKeyIv,
  encryptMoyuPacket,
  macFromMoyuDeviceName,
  parseMacAddress,
} from "./crypto.ts";
import { buildStatusPacket, parseMoyuPacket } from "./packets.ts";
import { solvedFaceletColors, SOLVED_FACELETS_URFDLB } from "./facelets.ts";

describe("moyu crypto", () => {
  it("MAC 解析与设备名推断", () => {
    assert.deepEqual(
      [...parseMacAddress("cf:30:16:00:ab:cd")],
      [0xcf, 0x30, 0x16, 0x00, 0xab, 0xcd],
    );
    assert.equal(macFromMoyuDeviceName("WCU_MY32_ABCD"), "CF:30:16:00:AB:CD");
    assert.equal(macFromMoyuDeviceName("other"), null);
  });

  it("加解密往返：明文 A3 状态包", async () => {
    const keyIv = deriveMoyuKeyIv(parseMacAddress("CF:30:16:00:11:22"));
    const plain = buildStatusPacket(solvedFaceletColors(), 3);
    const cipher = await encryptMoyuPacket(keyIv, plain);
    assert.notDeepEqual([...cipher], [...plain]);
    const back = await decryptMoyuPacket(keyIv, cipher);
    const parsed = parseMoyuPacket(back);
    assert.equal(parsed.type, "status");
    if (parsed.type === "status") {
      assert.equal(parsed.facelets, SOLVED_FACELETS_URFDLB);
      assert.equal(parsed.moveCounter, 3);
    }
  });
});
