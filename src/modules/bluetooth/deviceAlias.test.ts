import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDeviceAlias,
  resolveDeviceDisplayName,
  setDeviceAlias,
  type DeviceAliasStorage,
} from "./deviceAlias.ts";

function memoryStorage(initial: string | null = null): DeviceAliasStorage {
  let value = initial;
  return {
    getItem() {
      return value;
    },
    setItem(_key, next) {
      value = next;
    },
  };
}

describe("deviceAlias", () => {
  it("读写本地别名，空串清除", () => {
    const storage = memoryStorage();
    assert.equal(getDeviceAlias(storage, "dev-1"), null);
    setDeviceAlias(storage, "dev-1", " 书房魔方 ");
    assert.equal(getDeviceAlias(storage, "dev-1"), "书房魔方");
    setDeviceAlias(storage, "dev-1", "   ");
    assert.equal(getDeviceAlias(storage, "dev-1"), null);
  });

  it("展示名优先别名，否则原始设备名", () => {
    const storage = memoryStorage();
    assert.equal(
      resolveDeviceDisplayName(storage, "dev-1", "WCU_MY32_ABCD"),
      "WCU_MY32_ABCD",
    );
    setDeviceAlias(storage, "dev-1", "黑魔方");
    assert.equal(
      resolveDeviceDisplayName(storage, "dev-1", "WCU_MY32_ABCD"),
      "黑魔方",
    );
    assert.equal(resolveDeviceDisplayName(storage, "dev-2", ""), "魔方");
  });

  it("损坏的存储视为无别名", () => {
    const storage = memoryStorage("{");
    assert.equal(getDeviceAlias(storage, "dev-1"), null);
    assert.equal(
      resolveDeviceDisplayName(storage, "dev-1", "WCU_MY32_ABCD"),
      "WCU_MY32_ABCD",
    );
  });
});
