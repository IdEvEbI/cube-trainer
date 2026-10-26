import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDefaultAlgorithmPrefs,
  resolveDefaultAlgorithmIndex,
  type DefaultAlgorithmStorage,
} from "./defaultAlgorithm.ts";

function memoryStorage(initial: string | null = null): DefaultAlgorithmStorage {
  let value = initial;
  return {
    read() {
      return value;
    },
    write(next) {
      value = next;
    },
  };
}

describe("resolveDefaultAlgorithmIndex", () => {
  it("未标注或无效时回退到目录默认 0", () => {
    assert.equal(resolveDefaultAlgorithmIndex(2, undefined), 0);
    assert.equal(resolveDefaultAlgorithmIndex(2, -1), 0);
    assert.equal(resolveDefaultAlgorithmIndex(2, 2), 0);
    assert.equal(resolveDefaultAlgorithmIndex(2, 1.5), 0);
    assert.equal(resolveDefaultAlgorithmIndex(0, 1), 0);
  });

  it("合法下标原样返回", () => {
    assert.equal(resolveDefaultAlgorithmIndex(3, 0), 0);
    assert.equal(resolveDefaultAlgorithmIndex(3, 2), 2);
  });
});

describe("createDefaultAlgorithmPrefs", () => {
  it("记录与读取默认算法", () => {
    const prefs = createDefaultAlgorithmPrefs(memoryStorage());
    assert.equal(prefs.peek("oll-sune"), undefined);
    assert.equal(prefs.get("oll-sune", 2), 0);

    prefs.set("oll-sune", 1, 2);
    assert.equal(prefs.peek("oll-sune"), 1);
    assert.equal(prefs.get("oll-sune", 2), 1);
  });

  it("切换默认后覆盖旧值", () => {
    const prefs = createDefaultAlgorithmPrefs(memoryStorage());
    prefs.set("oll-sune", 1, 3);
    prefs.set("oll-sune", 2, 3);
    assert.equal(prefs.get("oll-sune", 3), 2);
  });

  it("设回 0 清除标注，未标注用目录默认", () => {
    const prefs = createDefaultAlgorithmPrefs(memoryStorage());
    prefs.set("oll-sune", 1, 2);
    prefs.set("oll-sune", 0, 2);
    assert.equal(prefs.peek("oll-sune"), undefined);
    assert.equal(prefs.get("oll-sune", 2), 0);
  });

  it("无效 id 或下标不写入；越界读取回退", () => {
    const storage = memoryStorage();
    const prefs = createDefaultAlgorithmPrefs(storage);
    prefs.set("  ", 1, 2);
    prefs.set("oll-sune", 5, 2);
    prefs.set("oll-sune", -1, 2);
    assert.equal(storage.read(), null);
    assert.equal(prefs.get("", 2), 0);

    prefs.set("oll-sune", 1, 2);
    assert.equal(prefs.get("oll-sune", 1), 0);
  });

  it("损坏的存储读作未标注", () => {
    const prefs = createDefaultAlgorithmPrefs(memoryStorage("{"));
    assert.equal(prefs.peek("oll-sune"), undefined);
    assert.equal(prefs.get("oll-sune", 2), 0);
  });
});
