import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  connectMoyuCube,
  formatMoyuConnectError,
  formatMoyuConnectedLabel,
  isWebBluetoothAvailable,
  MOYU_GATT,
  MOYU_NAME_PREFIX,
  moyuRequestDeviceOptions,
  type MoyuBluetoothRequestApi,
  type MoyuBleCharacteristicLike,
  type MoyuBleDeviceLike,
} from "./ble.ts";
import {
  encryptMoyuPacket,
  deriveMoyuKeyIv,
  parseMacAddress,
} from "./crypto.ts";
import { buildStatusPacket } from "./packets.ts";
import { solvedFaceletColors } from "./facelets.ts";
import { SOLVED_FACELETS_URFDLB } from "./facelets.ts";
import { macFromMoyuDeviceName } from "./crypto.ts";

describe("moyu BLE helpers", () => {
  it("请求选项指向魔域前缀与主服务", () => {
    assert.deepEqual(moyuRequestDeviceOptions(), {
      filters: [{ namePrefix: MOYU_NAME_PREFIX }],
      optionalServices: [MOYU_GATT.service],
    });
  });

  it("连接文案与错误文案", () => {
    assert.equal(
      formatMoyuConnectedLabel("WCU_MY32_ABCD"),
      "已连接 · WCU_MY32_ABCD",
    );
    assert.equal(
      formatMoyuConnectError(new DOMException("x", "NotFoundError")),
      "未选择魔方，或附近没有魔域设备",
    );
  });

  it("检测 Web Bluetooth 是否可用", () => {
    assert.equal(isWebBluetoothAvailable(undefined), false);
    assert.equal(
      isWebBluetoothAvailable({
        requestDevice: async () => ({}) as MoyuBleDeviceLike,
      }),
      true,
    );
  });

  it("设备名可推断 MAC", () => {
    assert.equal(macFromMoyuDeviceName("WCU_MY32_E1F2"), "CF:30:16:00:E1:F2");
  });
});

describe("connectMoyuCube", () => {
  it("无 API 时拒绝", async () => {
    await assert.rejects(
      () => connectMoyuCube({ bluetooth: undefined }),
      /不支持 Web Bluetooth/,
    );
  });

  it("模拟连接后 requestStatus 得到复原 facelets", async () => {
    const mac = parseMacAddress("CF:30:16:00:E1:F2");
    const keyIv = deriveMoyuKeyIv(mac);
    let notifyListener: ((event: Event) => void) | undefined;

    const notifyChar: MoyuBleCharacteristicLike = {
      async startNotifications() {
        return undefined;
      },
      addEventListener(_type, listener) {
        notifyListener = listener;
      },
      removeEventListener() {
        notifyListener = undefined;
      },
    };

    const writeChar: MoyuBleCharacteristicLike = {
      async startNotifications() {
        return undefined;
      },
      async writeValueWithoutResponse(data) {
        // 解密请求不在此测；收到写后推一条加密 A3
        void data;
        const plain = buildStatusPacket(solvedFaceletColors(), 0);
        const cipher = await encryptMoyuPacket(keyIv, plain);
        const value = new DataView(
          cipher.buffer,
          cipher.byteOffset,
          cipher.byteLength,
        );
        setTimeout(() => {
          notifyListener?.({
            target: { value },
          } as unknown as Event);
        }, 5);
      },
      addEventListener() {},
      removeEventListener() {},
    };

    const api: MoyuBluetoothRequestApi = {
      async requestDevice() {
        return {
          name: "WCU_MY32_E1F2",
          gatt: {
            connected: true,
            async connect() {
              return {
                async getPrimaryService() {
                  return {
                    async getCharacteristic(uuid: string) {
                      if (uuid === MOYU_GATT.notify) {
                        return notifyChar;
                      }
                      if (uuid === MOYU_GATT.write) {
                        return writeChar;
                      }
                      throw new Error("unknown char");
                    },
                  };
                },
                disconnect() {},
              };
            },
            disconnect() {},
          },
          addEventListener() {},
          removeEventListener() {},
        };
      },
    };

    const session = await connectMoyuCube({
      bluetooth: api,
      statusTimeoutMs: 2000,
    });
    const status = await session.requestStatus();
    assert.equal(status.facelets, SOLVED_FACELETS_URFDLB);
    assert.equal(status.setupAlg, "");
    session.disconnect();
  });
});
