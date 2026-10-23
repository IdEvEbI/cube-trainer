import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averageOf5,
  createScoreLog,
  summarizeAttempts,
  type ScoreStorage,
} from "./score.ts";

function memoryStorage(initial: string | null = null): ScoreStorage {
  let raw: string | null = initial;
  return {
    read: () => raw,
    write: (value) => {
      raw = value;
    },
  };
}

describe("averageOf5", () => {
  it("不足 5 次时没有 Ao5", () => {
    assert.equal(averageOf5([1000, 2000, 3000, 4000]), null);
  });

  it("去掉最好与最差后对中间三次取平均", () => {
    // newest first: 3, 1, 5, 2, 4 → sorted 1,2,3,4,5 → mid 2+3+4 = 3
    assert.equal(averageOf5([3000, 1000, 5000, 2000, 4000]), 3000);
  });
});

describe("summarizeAttempts", () => {
  it("空列表统计为空", () => {
    assert.deepEqual(summarizeAttempts([]), {
      count: 0,
      bestMs: null,
      worstMs: null,
      avgMs: null,
      ao5Ms: null,
    });
  });

  it("记录后最好 / 最差 / 平均 / Ao5 计算正确", () => {
    const times = [2500, 1000, 4000, 2000, 3000, 9000];
    const summary = summarizeAttempts(times);
    assert.equal(summary.count, 6);
    assert.equal(summary.bestMs, 1000);
    assert.equal(summary.worstMs, 9000);
    assert.equal(
      summary.avgMs,
      Math.round((2500 + 1000 + 4000 + 2000 + 3000 + 9000) / 6),
    );
    assert.equal(summary.ao5Ms, averageOf5(times));
  });
});

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

  it("记录后 summary 最好 / 最差 / 平均 / Ao5 正确", () => {
    const log = createScoreLog(
      memoryStorage(),
      () => new Date("2026-10-23T00:00:00.000Z"),
    );
    for (const timeMs of [9000, 3000, 2000, 4000, 1000, 2500]) {
      log.record({ timeMs, scramble: "R U" });
    }
    // newest first after records: 2500, 1000, 4000, 2000, 3000, 9000
    const summary = log.summary();
    assert.equal(summary.count, 6);
    assert.equal(summary.bestMs, 1000);
    assert.equal(summary.worstMs, 9000);
    assert.equal(summary.avgMs, Math.round(21500 / 6));
    assert.equal(summary.ao5Ms, averageOf5([2500, 1000, 4000, 2000, 3000]));
  });

  it("损坏的记录读出来是空的", () => {
    const storage = memoryStorage();
    storage.write("{");
    assert.deepEqual(createScoreLog(storage).list(), []);
    assert.deepEqual(createScoreLog(storage).summary(), {
      count: 0,
      bestMs: null,
      worstMs: null,
      avgMs: null,
      ao5Ms: null,
    });
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
