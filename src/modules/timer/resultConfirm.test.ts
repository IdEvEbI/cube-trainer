import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPendingSolve, resolveResultConfirm } from "./resultConfirm.ts";

describe("createPendingSolve", () => {
  it("截断毫秒并保留打乱快照", () => {
    assert.deepEqual(
      createPendingSolve({ timeMs: 5787.9, scramble: " R U R' " }),
      { timeMs: 5787, scramble: "R U R'" },
    );
  });

  it("拒绝无效时间或空打乱", () => {
    assert.throws(
      () => createPendingSolve({ timeMs: -1, scramble: "R" }),
      /时间无效/,
    );
    assert.throws(
      () => createPendingSolve({ timeMs: 1000, scramble: "  " }),
      /打乱是空的/,
    );
  });
});

describe("resolveResultConfirm", () => {
  const pending = createPendingSolve({
    timeMs: 12345,
    scramble: "F R U R' U' F'",
  });

  it("保留：应记录成绩", () => {
    assert.deepEqual(resolveResultConfirm(pending, "keep"), {
      shouldRecord: true,
      timeMs: 12345,
      scramble: "F R U R' U' F'",
    });
  });

  it("丢弃：不记录成绩", () => {
    assert.deepEqual(resolveResultConfirm(pending, "discard"), {
      shouldRecord: false,
      timeMs: 12345,
      scramble: "F R U R' U' F'",
    });
  });
});
