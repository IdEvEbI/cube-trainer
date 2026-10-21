import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createScoreLog, type ScoreStorage } from "./score.ts";

function memoryStorage(): ScoreStorage {
  let raw: string | null = null;
  return {
    read: () => raw,
    write: (value) => {
      raw = value;
    },
  };
}

describe("createScoreLog", () => {
  it("停止后把时间、打乱、日期和模式存到本机", () => {
    const storage = memoryStorage();
    const log = createScoreLog(
      storage,
      () => new Date("2026-10-21T07:38:00.000Z"),
    );

    const score = log.record({ timeMs: 12345.6, scramble: "R U R' U'" });

    assert.deepEqual(score, {
      timeMs: 12345,
      scramble: "R U R' U'",
      recordedAt: "2026-10-21T07:38:00.000Z",
      mode: "非蓝牙",
      split: false,
    });
    assert.deepEqual(log.list(), [score]);
  });

  it("列表能读到已保存的成绩，新的排在前面", () => {
    const storage = memoryStorage();
    let tick = 0;
    const log = createScoreLog(storage, () => {
      tick += 1;
      return new Date(`2026-10-21T07:38:0${tick}.000Z`);
    });

    log.record({ timeMs: 1000, scramble: "R U" });
    log.record({ timeMs: 2000, scramble: "F' D" });

    const again = createScoreLog(storage);
    const scores = again.list();

    assert.equal(scores.length, 2);
    assert.equal(scores[0]?.scramble, "F' D");
    assert.equal(scores[0]?.timeMs, 2000);
    assert.equal(scores[1]?.scramble, "R U");
    assert.equal(scores[1]?.mode, "非蓝牙");
  });

  it("损坏的记录读出来是空的", () => {
    const storage = memoryStorage();
    storage.write("{");
    assert.deepEqual(createScoreLog(storage).list(), []);
  });

  it("没有打乱或时间无效时不保存", () => {
    const log = createScoreLog(memoryStorage());

    assert.throws(
      () => log.record({ timeMs: 1000, scramble: "   " }),
      /打乱是空的/,
    );
    assert.throws(() => log.record({ timeMs: -1, scramble: "R" }), /时间无效/);
  });
});
