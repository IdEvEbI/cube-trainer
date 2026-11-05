import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Score, ScoreSplit } from "./score.ts";
import {
  buildSolveReviewFromScore,
  buildSolveReviewFromStoredSplit,
  canExpandScoreListItem,
  canOpenScoreReview,
  formatScoreListDate,
  formatScorePhaseShare,
  scoreListScrambleText,
  scoreOverviewStats,
  scorePhaseBarPrimaryStats,
  scorePhaseBarSecondaryStats,
  scorePhaseBars,
  scoreTrendPoints,
} from "./scoreList.ts";

function sampleSplit(
  overrides?: Partial<ScoreSplit["phases"][number]>[],
): ScoreSplit {
  const base = [
    {
      id: "cross",
      label: "Cross",
      alg: "R2 U' F",
      timeMs: 2500,
      timeShare: 0.2,
      moves: 6,
      rotations: 1,
      tps: 2,
      pauseRate: 0,
    },
    {
      id: "f2l1",
      label: "F2L 1",
      alg: "U R U' R'",
      timeMs: 1000,
      timeShare: 0.1,
      moves: 4,
      rotations: 0,
      tps: 4,
      pauseRate: 0,
    },
    {
      id: "f2l2",
      label: "F2L 2",
      alg: "U' L' U L",
      timeMs: 1500,
      timeShare: 0.1,
      moves: 5,
      rotations: 0,
      tps: 3,
      pauseRate: 0,
    },
    {
      id: "f2l3",
      label: "F2L 3",
      alg: "R U R'",
      timeMs: 2000,
      timeShare: 0.15,
      moves: 6,
      rotations: 0,
      tps: 3,
      pauseRate: 0,
    },
    {
      id: "f2l4",
      label: "F2L 4",
      alg: "U R U' R'",
      timeMs: 1800,
      timeShare: 0.15,
      moves: 5,
      rotations: 1,
      tps: 2,
      pauseRate: 0,
    },
    {
      id: "oll",
      label: "OLL",
      alg: "R U R' U R U2 R'",
      timeMs: 3200,
      timeShare: 0.2,
      moves: 8,
      rotations: 0,
      tps: 2.5,
      pauseRate: 0,
    },
    {
      id: "pll",
      label: "PLL",
      alg: "R U R' F' R U R' U' R' F R2 U' R'",
      timeMs: 2100,
      timeShare: 0.1,
      moves: 10,
      rotations: 0,
      tps: 4,
      pauseRate: 0,
    },
  ];
  if (overrides) {
    for (let i = 0; i < overrides.length; i += 1) {
      const patch = overrides[i];
      if (patch && base[i]) {
        Object.assign(base[i]!, patch);
      }
    }
  }
  return {
    overview: { moves: 40, rotations: 2, tps: 3, pauseRate: 0.1 },
    phases: base,
  };
}

describe("scoreTrendPoints", () => {
  it("按旧到新输出，最多取最新 limit 条", () => {
    const scores: Score[] = [1, 2, 3].map((n) => ({
      id: `id${n}`,
      timeMs: n * 1000,
      scramble: "R",
      recordedAt: `2026-11-0${n}T00:00:00.000Z`,
      mode: "非蓝牙",
      split: false,
      trace: false,
    }));
    assert.deepEqual(scoreTrendPoints(scores, 2), [
      { id: "id2", timeMs: 2000 },
      { id: "id1", timeMs: 1000 },
    ]);
  });
});

describe("scorePhaseBars", () => {
  it("给出四段色条时间、步数、转体与占比，并带主次行展示字段", () => {
    const bars = scorePhaseBars(sampleSplit());
    assert.ok(bars);
    assert.deepEqual(
      bars.map((bar) => [bar.id, bar.timeMs, bar.moves, bar.rotations]),
      [
        ["cross", 2500, 6, 1],
        ["f2l", 6300, 20, 1],
        ["oll", 3200, 8, 0],
        ["pll", 2100, 10, 0],
      ],
    );
    assert.equal(bars[0]?.tps.toFixed(2), "2.40");
    const shareSum = bars.reduce((sum, bar) => sum + bar.share, 0);
    assert.ok(Math.abs(shareSum - 1) < 1e-9);
    assert.equal(formatScorePhaseShare(bars[0]!.share), "17.73%");
    assert.deepEqual(scorePhaseBarPrimaryStats(bars[0]!), [
      { label: "时间", value: "2.50" },
      { label: "占比", value: "17.73%" },
    ]);
    assert.deepEqual(scorePhaseBarSecondaryStats(bars[0]!), [
      { label: "TPS", value: "2.40" },
      { label: "步数", value: "6" },
      { label: "转体", value: "1" },
    ]);
  });
});

describe("scoreOverviewStats", () => {
  it("展开详情四项", () => {
    assert.deepEqual(scoreOverviewStats(sampleSplit()), [
      { label: "步数", value: "40" },
      { label: "TPS", value: "3.00" },
      { label: "转体", value: "2" },
      { label: "停顿", value: "10%" },
    ]);
  });
});

describe("formatScoreListDate", () => {
  it("格式化为本地日期时间", () => {
    const text = formatScoreListDate("2026-11-04T08:05:00.000Z");
    assert.match(text, /^2026-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("非法 ISO 原样返回", () => {
    assert.equal(formatScoreListDate("not-a-date"), "not-a-date");
  });
});

describe("canExpandScoreListItem / scoreListScrambleText", () => {
  it("非蓝牙不展开；空白打乱返回 null", () => {
    const score: Score = {
      id: "a",
      timeMs: 1000,
      scramble: "R U",
      recordedAt: "2026-11-04T00:00:00.000Z",
      mode: "非蓝牙",
      split: false,
      trace: false,
    };
    assert.equal(canExpandScoreListItem(score), false);
    assert.equal(scoreListScrambleText(score), "R U");
    assert.equal(scoreListScrambleText({ ...score, scramble: "   " }), null);
  });

  it("仅蓝牙有分段时可展开", () => {
    const bluetooth: Score = {
      id: "b",
      timeMs: 1000,
      scramble: "R U",
      recordedAt: "2026-11-04T00:00:00.000Z",
      mode: "蓝牙",
      split: false,
      trace: false,
    };
    assert.equal(canExpandScoreListItem(bluetooth), false);
    assert.equal(
      canExpandScoreListItem({ ...bluetooth, split: sampleSplit() }),
      true,
    );
  });
});

describe("canOpenScoreReview", () => {
  it("有 trace 或蓝牙分段均可打开；非蓝牙不可", () => {
    const base: Score = {
      id: "a",
      timeMs: 1000,
      scramble: "R U",
      recordedAt: "2026-11-04T00:00:00.000Z",
      mode: "非蓝牙",
      split: false,
      trace: false,
    };
    assert.equal(canOpenScoreReview(base), false);
    assert.equal(
      canOpenScoreReview({
        ...base,
        mode: "蓝牙",
        split: sampleSplit(),
        trace: false,
      }),
      true,
    );
    assert.equal(
      canOpenScoreReview({
        ...base,
        mode: "蓝牙",
        split: sampleSplit(),
        trace: {
          version: 1,
          scramble: "R U",
          startSetupAlg: "R U",
          steps: [],
        },
      }),
      true,
    );
  });
});

describe("buildSolveReviewFromStoredSplit", () => {
  it("用已存分段拼出复盘，保留各段公式", () => {
    const score: Score = {
      id: "b",
      timeMs: 12340,
      scramble: "R U R'",
      recordedAt: "2026-11-04T00:00:00.000Z",
      mode: "蓝牙",
      split: sampleSplit(),
      trace: false,
    };
    const review = buildSolveReviewFromStoredSplit(score);
    assert.ok(review);
    assert.equal(review.overview.timeMs, 12340);
    assert.equal(review.overview.moves, 40);
    assert.equal(review.phases.length, 7);
    assert.equal(review.phases[0]?.alg, "R2 U' F");
    assert.equal(review.phases[6]?.alg, "R U R' F' R U R' U' R' F R2 U' R'");
    assert.equal(review.trace.steps.length, 0);
    assert.equal(review.scramble, "R U R'");
  });
});

describe("buildSolveReviewFromScore", () => {
  it("有轨迹时走完整复盘构建", async () => {
    const score: Score = {
      id: "c",
      timeMs: 1000,
      scramble: "R U",
      recordedAt: "2026-11-04T00:00:00.000Z",
      mode: "蓝牙",
      split: sampleSplit(),
      trace: {
        version: 1,
        scramble: "R U",
        startSetupAlg: "R U",
        steps: [
          {
            move: "U'",
            rawMove: "U'",
            atMs: 10,
            kind: "face",
            orientationAfter: "",
          },
          {
            move: "R'",
            rawMove: "R'",
            atMs: 20,
            kind: "face",
            orientationAfter: "",
          },
        ],
      },
    };
    const review = await buildSolveReviewFromScore(score);
    assert.ok(review);
    assert.equal(review.trace.steps.length, 2);
    assert.ok(review.phases.some((phase) => phase.alg.trim() !== ""));
  });
});
