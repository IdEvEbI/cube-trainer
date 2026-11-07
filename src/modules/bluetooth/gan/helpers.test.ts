import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGanConnectError,
  formatGanConnectedLabel,
  ganMacStorageKey,
  ganRequestDeviceOptions,
  GAN_GATT_SERVICES,
  GAN_NAME_PREFIXES,
  macFromGanDeviceName,
  normalizeGanMacAddress,
  resolveGanMacProviderStep,
} from "./helpers.ts";

describe("gan helpers", () => {
  it("请求选项覆盖 GAN / MG / AiCube 与三代服务", () => {
    const options = ganRequestDeviceOptions();
    assert.deepEqual(options.filters, [
      ...GAN_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
    ]);
    assert.deepEqual(options.optionalServices, [...GAN_GATT_SERVICES]);
    assert.equal(options.optionalManufacturerData.length, 256);
  });

  it("连接文案与错误文案", () => {
    assert.equal(formatGanConnectedLabel("GAN12ui"), "已连接 · GAN12ui");
    assert.equal(
      formatGanConnectError(new DOMException("x", "NotFoundError")),
      "未选择魔方，或附近没有 Gan 设备",
    );
    assert.match(
      formatGanConnectError(new Error("Unable to determine cube MAC address")),
      /地址|官方 App/,
    );
  });

  it("设备名可解析完整 MAC；短后缀不猜测", () => {
    assert.equal(
      macFromGanDeviceName("GAN-356i-AABBCCDDEEFF"),
      "AA:BB:CC:DD:EE:FF",
    );
    assert.equal(macFromGanDeviceName("GAN12ui"), null);
    assert.equal(macFromGanDeviceName("GAN-ABCD"), null);
  });

  it("normalizeGanMacAddress 接受纯十六进制或冒号分隔", () => {
    assert.equal(normalizeGanMacAddress("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
    assert.equal(
      normalizeGanMacAddress("AA:BB:CC:DD:EE:FF"),
      "AA:BB:CC:DD:EE:FF",
    );
    assert.equal(normalizeGanMacAddress("AABB"), null);
  });

  it("首次无 MAC 时 defer，末次才 prompt；缓存可跳过询问", () => {
    assert.deepEqual(
      resolveGanMacProviderStep({
        deviceName: "GANi3XXX",
        isFallback: false,
      }),
      { action: "defer" },
    );
    assert.deepEqual(
      resolveGanMacProviderStep({
        deviceName: "GANi3XXX",
        isFallback: false,
        canWatchAdvertisements: false,
      }),
      { action: "prompt" },
    );
    assert.deepEqual(
      resolveGanMacProviderStep({
        deviceName: "GANi3XXX",
        isFallback: true,
      }),
      { action: "prompt" },
    );
    assert.deepEqual(
      resolveGanMacProviderStep({
        deviceName: "GANi3XXX",
        isFallback: true,
        cachedMac: "aabbccddeeff",
      }),
      { action: "use", mac: "AA:BB:CC:DD:EE:FF" },
    );
    assert.equal(ganMacStorageKey("dev-1"), "cube-trainer.gan-mac.dev-1");
  });
});
