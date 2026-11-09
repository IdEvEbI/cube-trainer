import { formatElapsed } from "../timer/timer.ts";
import {
  formatPauseRate,
  formatTps,
  type CfopPhaseStats,
} from "./bluetoothSolveStats.ts";
import { CFOP_PHASE_ORDER, type CfopPhaseId } from "./cfopSplit.ts";
import {
  summarizeAttempts,
  type Score,
  type ScoreSplit,
  type ScoreSummary,
} from "./score.ts";
import { buildSolveReview, type SolveReview } from "./solveReview.ts";
import { SOLVE_TRACE_VERSION, type SolveTrace } from "./solveTrace.ts";

/** 成绩页顶栏汇总（总盘数 / 最好 / Ao5 / …）。 */
export function scoreListSummary(scores: readonly Score[]): ScoreSummary {
  return summarizeAttempts(scores.map((score) => score.timeMs));
}

export type ScoreTrendPoint = {
  id: string;
  timeMs: number;
};

/**
 * 时间趋势点：按时间旧→新，最多取最新 limit 条。
 * 供柱状 / 折线共用。
 */
export function scoreTrendPoints(
  scores: readonly Score[],
  limit = 20,
): ScoreTrendPoint[] {
  if (limit <= 0 || scores.length === 0) {
    return [];
  }
  return scores
    .slice(0, limit)
    .map((score) => ({ id: score.id, timeMs: score.timeMs }))
    .reverse();
}

export type ScorePhaseBarId = "cross" | "f2l" | "oll" | "pll";

export type ScorePhaseBar = {
  id: ScorePhaseBarId;
  label: string;
  timeMs: number;
  moves: number;
  rotations: number;
  tps: number;
  /** 相对 Cross+F2L+OLL+PLL 总时长的占比，0…1。 */
  share: number;
};

function phaseFieldSum(
  phases: ScoreSplit["phases"],
  ids: readonly string[],
  field: "timeMs" | "moves" | "rotations",
): number {
  let sum = 0;
  for (const phase of phases) {
    if (ids.includes(phase.id)) {
      sum += phase[field];
    }
  }
  return sum;
}

function phaseGroupTps(moves: number, timeMs: number): number {
  if (timeMs <= 0 || moves <= 0) {
    return 0;
  }
  return moves / (timeMs / 1000);
}

export type ScorePhaseBarStatPart = {
  label: string;
  value: string;
};

/** 占比两位小数，如 12.29%。 */
export function formatScorePhaseShare(share: number): string {
  return `${(share * 100).toFixed(2)}%`;
}

/** 分段主行：时间 + 占比。 */
export function scorePhaseBarPrimaryStats(
  bar: ScorePhaseBar,
): ScorePhaseBarStatPart[] {
  return [
    { label: "时间", value: formatElapsed(bar.timeMs) },
    { label: "占比", value: formatScorePhaseShare(bar.share) },
  ];
}

/** 分段次行：TPS · 步数 · 转体。 */
export function scorePhaseBarSecondaryStats(
  bar: ScorePhaseBar,
): ScorePhaseBarStatPart[] {
  return [
    { label: "TPS", value: formatTps(bar.tps) },
    { label: "步数", value: String(bar.moves) },
    { label: "转体", value: String(bar.rotations) },
  ];
}

/** 列表色条用的四段时间；无分段则 null。 */
export function scorePhaseBars(
  split: false | ScoreSplit,
): ScorePhaseBar[] | null {
  if (!split || split.phases.length === 0) {
    return null;
  }
  const { phases } = split;
  const groups: { id: ScorePhaseBarId; label: string; ids: string[] }[] = [
    { id: "cross", label: "Cross", ids: ["cross"] },
    { id: "f2l", label: "F2L", ids: ["f2l1", "f2l2", "f2l3", "f2l4"] },
    { id: "oll", label: "OLL", ids: ["oll"] },
    { id: "pll", label: "PLL", ids: ["pll"] },
  ];
  const rows = groups.map((group) => {
    const timeMs = phaseFieldSum(phases, group.ids, "timeMs");
    const moves = phaseFieldSum(phases, group.ids, "moves");
    const rotations = phaseFieldSum(phases, group.ids, "rotations");
    return {
      id: group.id,
      label: group.label,
      timeMs,
      moves,
      rotations,
      tps: phaseGroupTps(moves, timeMs),
    };
  });
  const total = rows.reduce((sum, row) => sum + row.timeMs, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.timeMs / total : 0,
  }));
}

export type ScoreOverviewStat = {
  label: string;
  value: string;
};

/** 展开详情用的总览四项；无 split 则 null。 */
export function scoreOverviewStats(
  split: false | ScoreSplit,
): ScoreOverviewStat[] | null {
  if (!split) {
    return null;
  }
  const { moves, tps, rotations, pauseRate } = split.overview;
  return [
    { label: "步数", value: String(moves) },
    { label: "TPS", value: formatTps(tps) },
    { label: "转体", value: String(rotations) },
    { label: "停顿", value: formatPauseRate(pauseRate) },
  ];
}

/** 列表日期展示：本地 YYYY-MM-DD HH:mm。 */
export function formatScoreListDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
}

/** 列表展示用的打乱公式；空白则 null。 */
export function scoreListScrambleText(score: Score): string | null {
  const scramble = score.scramble.trim();
  return scramble === "" ? null : scramble;
}

/**
 * 成绩行是否可展开：仅蓝牙有分段时可展开总览与分段。
 * 非蓝牙直接展示打乱公式与操作，不折叠。
 */
export function canExpandScoreListItem(score: Score): boolean {
  return score.mode === "蓝牙" && score.split !== false;
}

/** 是否可打开复盘页：有轨迹，或至少有蓝牙分段快照。 */
export function canOpenScoreReview(score: Score): boolean {
  if (score.trace !== false) {
    return true;
  }
  return score.mode === "蓝牙" && score.split !== false;
}

function isCfopPhaseId(id: string): id is CfopPhaseId {
  return (CFOP_PHASE_ORDER as readonly string[]).includes(id);
}

/** 无轨迹时用已存 split 拼出可查看的复盘（回放仅打乱，无还原步进）。 */
export function buildSolveReviewFromStoredSplit(
  score: Score,
): SolveReview | null {
  if (score.mode !== "蓝牙" || score.split === false) {
    return null;
  }
  const phases: CfopPhaseStats[] = [];
  for (const phase of score.split.phases) {
    if (!isCfopPhaseId(phase.id)) {
      continue;
    }
    phases.push({
      id: phase.id,
      label: phase.label,
      alg: phase.alg.trim(),
      timeMs: phase.timeMs,
      timeShare: phase.timeShare,
      moves: phase.moves,
      rotations: phase.rotations,
      tps: phase.tps,
      pauseRate: phase.pauseRate,
      startIndex: 0,
      endIndex: 0,
    });
  }
  if (phases.length === 0) {
    return null;
  }
  const scramble = score.scramble.trim();
  const trace: SolveTrace = {
    version: SOLVE_TRACE_VERSION,
    scramble,
    scrambleSetupAlg: "",
    startSetupAlg: "",
    steps: [],
  };
  return {
    overview: {
      timeMs: score.timeMs,
      moves: score.split.overview.moves,
      rotations: score.split.overview.rotations,
      tps: score.split.overview.tps,
      pauseRate: score.split.overview.pauseRate,
    },
    phases,
    scramble,
    startSetupAlg: "",
    timedMoves: [],
    trace,
  };
}

/** 从本机成绩打开复盘：优先完整轨迹，否则用分段快照。 */
export async function buildSolveReviewFromScore(
  score: Score,
): Promise<SolveReview | null> {
  if (score.trace !== false) {
    return buildSolveReview({
      trace: score.trace,
      totalTimeMs: score.timeMs,
    });
  }
  return buildSolveReviewFromStoredSplit(score);
}
