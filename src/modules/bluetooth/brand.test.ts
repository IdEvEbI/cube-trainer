import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferSmartCubeBrand,
  requestSmartCubeDevice,
  SMART_CUBE_BRANDS,
  smartCubeBrandHint,
  smartCubeBrandLabel,
  smartCubeRequestDeviceOptions,
} from "./brand.ts";
import { GAN_NAME_PREFIXES } from "./gan/helpers.ts";
import { MOYU_GATT, MOYU_NAME_PREFIX } from "./moyu/ble.ts";

describe("smartCubeBrand", () => {
  it("列出魔域与 Gan", () => {
    assert.deepEqual(SMART_CUBE_BRANDS, ["moyu", "gan"]);
    assert.equal(smartCubeBrandLabel("moyu"), "魔域");
    assert.equal(smartCubeBrandLabel("gan"), "Gan");
    assert.match(smartCubeBrandHint("moyu"), /Weilong|WCU/);
    assert.match(smartCubeBrandHint("gan"), /GAN/);
  });

  it("按设备名推断品牌；统一选择窗合并过滤条件", () => {
    assert.equal(inferSmartCubeBrand("WCU_MY32_ABCD"), "moyu");
    assert.equal(inferSmartCubeBrand("GANi3XXX"), "gan");
    assert.equal(inferSmartCubeBrand("MG3Ai"), "gan");
    assert.equal(inferSmartCubeBrand("AiCube12"), "gan");
    assert.equal(inferSmartCubeBrand("unknown"), null);
    const options = smartCubeRequestDeviceOptions();
    assert.deepEqual(options.filters, [
      { namePrefix: MOYU_NAME_PREFIX },
      ...GAN_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
    ]);
    assert.ok(options.optionalServices.includes(MOYU_GATT.service));
    assert.equal(options.optionalManufacturerData.length, 256);
  });

  it("无 Web Bluetooth 时 requestSmartCubeDevice 拒绝", async () => {
    await assert.rejects(
      () => requestSmartCubeDevice(),
      /不支持 Web Bluetooth/,
    );
  });
});
