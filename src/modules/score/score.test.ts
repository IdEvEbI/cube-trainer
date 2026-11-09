import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averageOf5,
  createScoreLog,
  latestSolveTimeMs,
  summarizeAttempts,
  trimmedAverage,
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

describe("trimmedAverage", () => {
  it("不足窗口时没有均值", () => {
    assert.equal(trimmedAverage([1, 2, 3, 4], 5), null);
  });

  it("Ao12 去掉最好最差后平均中间 10 次", () => {
    const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => n * 1000);
    // sorted 1..12 → mid 2..11 → sum 65 → 6500
    assert.equal(trimmedAverage(times, 12), 6500);
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
      ao12Ms: null,
      ao100Ms: null,
    });
  });

  it("记录后最好 / 最差 / 平均 / Ao5 / Ao12 / Ao100 计算正确", () => {
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
    assert.equal(summary.ao12Ms, null);
    assert.equal(summary.ao100Ms, null);
  });
});

describe("latestSolveTimeMs", () => {
  it("取列表首条为上一把；空列表为 null", () => {
    assert.equal(latestSolveTimeMs([]), null);
    assert.equal(
      latestSolveTimeMs([
        {
          timeMs: 12340,
          scramble: "R",
          recordedAt: "2026-01-01T00:00:00.000Z",
          mode: "非蓝牙",
          split: false,
        },
      ]),
      12340,
    );
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

    assert.equal(score.timeMs, 12345);
    assert.equal(score.scramble, "R U R' U'");
    assert.equal(score.recordedAt, "2026-10-21T07:38:00.000Z");
    assert.equal(score.mode, "非蓝牙");
    assert.equal(score.split, false);
    assert.equal(score.trace, false);
    assert.ok(score.id.length > 0);
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
    assert.equal(summary.ao12Ms, null);
    assert.equal(summary.ao100Ms, null);
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
      ao12Ms: null,
      ao100Ms: null,
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

  it("removeNewest 去掉最新一条；空列表为 null", () => {
    const storage = memoryStorage();
    let tick = 0;
    const log = createScoreLog(storage, () => {
      tick += 1;
      return new Date(`2026-10-21T07:38:0${tick}.000Z`);
    });
    assert.equal(log.removeNewest(), null);
    log.record({ timeMs: 1000, scramble: "R U" });
    log.record({ timeMs: 2000, scramble: "F' D" });
    const removed = log.removeNewest();
    assert.equal(removed?.timeMs, 2000);
    assert.equal(removed?.scramble, "F' D");
    assert.equal(log.list().length, 1);
    assert.equal(log.list()[0]?.scramble, "R U");
  });

  it("removeById 删除指定成绩；旧记录无 id 也能合成主键", () => {
    const storage = memoryStorage(
      JSON.stringify([
        {
          timeMs: 1500,
          scramble: "R U",
          recordedAt: "2026-10-21T07:38:00.000Z",
          mode: "非蓝牙",
          split: false,
        },
        {
          timeMs: 2500,
          scramble: "F",
          recordedAt: "2026-10-20T07:38:00.000Z",
          mode: "非蓝牙",
          split: false,
        },
      ]),
    );
    const log = createScoreLog(storage);
    const [newest, older] = log.list();
    assert.ok(newest && older);
    assert.equal(log.removeById(older.id)?.timeMs, 2500);
    assert.deepEqual(
      log.list().map((score) => score.timeMs),
      [1500],
    );
    assert.equal(log.removeById("missing"), null);
  });

  it("蓝牙成绩可保存 trace，供列表打开复盘", () => {
    const log = createScoreLog(
      memoryStorage(),
      () => new Date("2026-10-21T07:38:00.000Z"),
    );
    const trace = {
      version: 1 as const,
      scramble: "R U",
      scrambleSetupAlg: "",
      startSetupAlg: "R U",
      steps: [
        {
          move: "U'",
          rawMove: "U'",
          atMs: 10,
          kind: "face" as const,
          orientationAfter: "",
        },
      ],
    };
    const score = log.record({
      timeMs: 3000,
      scramble: "R U",
      mode: "蓝牙",
      split: {
        overview: { moves: 1, rotations: 0, tps: 1, pauseRate: 0 },
        phases: [
          {
            id: "cross",
            label: "Cross",
            alg: "R2",
            timeMs: 3000,
            timeShare: 1,
            moves: 1,
            rotations: 0,
            tps: 1,
            pauseRate: 0,
          },
        ],
      },
      trace,
    });
    assert.deepEqual(log.list()[0]?.trace, trace);
    assert.equal(
      log.list()[0]?.split && log.list()[0].split.phases[0]?.alg,
      "R2",
    );
    assert.equal(score.mode, "蓝牙");
  });

  it("旧分段无 alg 读出时补空串", () => {
    const storage = memoryStorage(
      JSON.stringify([
        {
          timeMs: 2000,
          scramble: "R U",
          recordedAt: "2026-10-21T07:38:00.000Z",
          mode: "蓝牙",
          split: {
            overview: { moves: 2, rotations: 0, tps: 1, pauseRate: 0 },
            phases: [
              {
                id: "cross",
                label: "Cross",
                timeMs: 2000,
                timeShare: 1,
                moves: 2,
                rotations: 0,
                tps: 1,
                pauseRate: 0,
              },
            ],
          },
        },
      ]),
    );
    const score = createScoreLog(storage).list()[0];
    assert.ok(score && score.split);
    assert.equal(score.split.phases[0]?.alg, "");
  });
});
