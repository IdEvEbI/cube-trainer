import { parseScramble } from "../scramble/scramble.ts";
import type { CfopPhaseId } from "./cfopSplit.ts";
import {
  cancelRedundantRotations,
  mergeQuarterMoves,
} from "./solveAlgDisplay.ts";
import type { SolveTrace, SolveTraceStep } from "./solveTrace.ts";

/** 复盘回放单步墙钟毫秒（含转动动画）。 */
export const SOLVE_REVIEW_PLAYBACK_STEP_MS = 650;

export type SolveReviewPlaybackPhase = "scramble" | "solve";

/**
 * 回放一步：打乱面转 / 还原面转 / 转体。
 * 魔方贴纸状态只吃 scramble+face（色心绝对，与直播蓝牙 alg 一致）；
 * 转体只改变手持朝向展示，不写入 Twisty alg，否则绝对面转会被二次旋转。
 */
export type SolveReviewPlaybackStep = {
  token: string;
  kind: "scramble" | "face" | "rotation";
};

/**
 * 复盘回放游标。
 * index 0 = 打乱起点（connect setup，未必复原）；index === steps.length = 播完。
 */
export type SolveReviewCursor = {
  steps: SolveReviewPlaybackStep[];
  scrambleLen: number;
  index: number;
  /** 跟打乱前的绝对 setup；空串 = 从还原态起步。 */
  scrambleSetupAlg: string;
};

/** 拼接绝对 setup 与已执行的打乱 / 面转记号。 */
export function composeReviewCubeAlg(
  scrambleSetupAlg: string,
  executedTokens: readonly string[],
): string {
  return [
    scrambleSetupAlg.trim(),
    ...executedTokens.map((token) => token.trim()),
  ]
    .filter(Boolean)
    .join(" ");
}

function scrambleTokens(source: string): string[] {
  const trimmed = source.trim();
  if (!trimmed) {
    return [];
  }
  return parseScramble(trimmed);
}

/**
 * 相邻同层 / 同轴四分之一转合并为 R2、z2 等，便于一次动画播完。
 * 打乱与还原不跨段合并；对面空转、对轴空转直接消掉。
 */
export function coalescePlaybackSteps(
  steps: readonly SolveReviewPlaybackStep[],
): SolveReviewPlaybackStep[] {
  const out: SolveReviewPlaybackStep[] = [];
  for (const step of steps) {
    const prev = out[out.length - 1];
    if (
      (step.kind === "face" || step.kind === "scramble") &&
      prev &&
      prev.kind === step.kind
    ) {
      const merged = mergeQuarterMoves([prev.token, step.token]);
      if (merged.length === 0) {
        out.pop();
        continue;
      }
      if (merged.length === 1) {
        out[out.length - 1] = { kind: step.kind, token: merged[0]! };
        continue;
      }
      out.push(step);
      continue;
    }
    if (step.kind === "rotation" && prev?.kind === "rotation") {
      const merged = cancelRedundantRotations([prev.token, step.token]);
      if (merged.length === 0) {
        out.pop();
        continue;
      }
      if (merged.length === 1) {
        out[out.length - 1] = { kind: "rotation", token: merged[0]! };
        continue;
      }
      out.push(step);
      continue;
    }
    out.push(step);
  }
  return out;
}

/** CFOP 段在 trace.steps 上的区间（左闭右开），用于禁止跨段合并。 */
export type SolveReviewPhaseSpan = {
  startIndex: number;
  endIndex: number;
};

function mapTraceSteps(
  steps: readonly SolveTraceStep[],
): SolveReviewPlaybackStep[] {
  const mapped: SolveReviewPlaybackStep[] = [];
  for (const step of steps) {
    const token = step.move.trim();
    if (!token) {
      continue;
    }
    mapped.push({
      token,
      kind: step.kind === "rotation" ? "rotation" : "face",
    });
  }
  return mapped;
}

/**
 * 按 CFOP 分段分别合并四分之一转。
 * 段与段交界处不合并（F2L4 末 R + OLL 首 R 保持两步）。
 */
export function coalesceSolveStepsByPhases(
  steps: readonly SolveTraceStep[],
  phases?: readonly SolveReviewPhaseSpan[],
): SolveReviewPlaybackStep[] {
  const spans =
    phases && phases.length > 0
      ? [...phases].sort((a, b) => a.startIndex - b.startIndex)
      : [{ startIndex: 0, endIndex: steps.length }];
  const out: SolveReviewPlaybackStep[] = [];
  let cursor = 0;
  for (const span of spans) {
    const start = Math.max(
      0,
      Math.min(steps.length, Math.trunc(span.startIndex)),
    );
    const end = Math.max(
      start,
      Math.min(steps.length, Math.trunc(span.endIndex)),
    );
    if (start > cursor) {
      out.push(
        ...coalescePlaybackSteps(mapTraceSteps(steps.slice(cursor, start))),
      );
    }
    if (end > start) {
      out.push(
        ...coalescePlaybackSteps(mapTraceSteps(steps.slice(start, end))),
      );
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < steps.length) {
    out.push(...coalescePlaybackSteps(mapTraceSteps(steps.slice(cursor))));
  }
  return out;
}

/**
 * 由 trace 生成回放序列：打乱面转 + steps（面转保持绝对记号，转体单独标记）。
 * 段内相邻同层 / 同轴四分之一转合并为双转（R2 / z2）；不跨 CFOP 段合并。
 */
export function createSolveReviewCursor(
  trace: SolveTrace,
  phases?: readonly SolveReviewPhaseSpan[],
): SolveReviewCursor {
  const scrambleSteps: SolveReviewPlaybackStep[] = scrambleTokens(
    trace.scramble,
  ).map((token) => ({ token, kind: "scramble" }));
  const solveSteps = coalesceSolveStepsByPhases(trace.steps, phases);
  const steps = [...scrambleSteps, ...solveSteps];
  if (steps.length === 0) {
    throw new Error("回放序列为空");
  }
  return {
    steps,
    scrambleLen: scrambleSteps.length,
    index: 0,
    scrambleSetupAlg: (trace.scrambleSetupAlg ?? "").trim(),
  };
}

export function isSolveReviewAtStart(cursor: SolveReviewCursor): boolean {
  return cursor.index <= 0;
}

export function isSolveReviewAtEnd(cursor: SolveReviewCursor): boolean {
  return cursor.index >= cursor.steps.length;
}

export function solveReviewAtStart(
  cursor: SolveReviewCursor,
): SolveReviewCursor {
  return { ...cursor, index: 0 };
}

export function solveReviewAtEnd(cursor: SolveReviewCursor): SolveReviewCursor {
  return { ...cursor, index: cursor.steps.length };
}

export function solveReviewStepNext(
  cursor: SolveReviewCursor,
): SolveReviewCursor {
  return {
    ...cursor,
    index: Math.min(cursor.steps.length, cursor.index + 1),
  };
}

export function solveReviewStepPrevious(
  cursor: SolveReviewCursor,
): SolveReviewCursor {
  return { ...cursor, index: Math.max(0, cursor.index - 1) };
}

/**
 * Twisty alg：打乱起点 setup + 已播打乱 / 绝对面转（跳过转体）。
 * 起点可以不是还原态（连接时实体已乱）。
 */
export function solveReviewCubeAlg(cursor: SolveReviewCursor): string {
  const executed = cursor.steps
    .slice(0, cursor.index)
    .filter((step) => step.kind === "scramble" || step.kind === "face")
    .map((step) => step.token);
  return composeReviewCubeAlg(cursor.scrambleSetupAlg, executed);
}

/** 已执行转体累积（供手持朝向展示）。 */
export function solveReviewOrientationAlg(cursor: SolveReviewCursor): string {
  return cursor.steps
    .slice(0, cursor.index)
    .filter((step) => step.kind === "rotation")
    .map((step) => step.token)
    .join(" ");
}

/** 当前步所属阶段（打乱 / 还原）；播完按最后一步归属。 */
export function solveReviewPhase(
  cursor: SolveReviewCursor,
): SolveReviewPlaybackPhase {
  if (cursor.scrambleLen <= 0) {
    return "solve";
  }
  if (cursor.index < cursor.scrambleLen) {
    return "scramble";
  }
  if (isSolveReviewAtEnd(cursor)) {
    return cursor.scrambleLen >= cursor.steps.length ? "scramble" : "solve";
  }
  return "solve";
}

/** 阶段内进度：当前步序号（1-based）与该阶段总步数；播完为满值。 */
export function solveReviewPhaseProgress(cursor: SolveReviewCursor): {
  phase: SolveReviewPlaybackPhase;
  current: number;
  total: number;
} {
  const scrambleTotal = cursor.scrambleLen;
  const solveTotal = cursor.steps.length - cursor.scrambleLen;
  if (cursor.index < cursor.scrambleLen) {
    return {
      phase: "scramble",
      current: cursor.index + 1,
      total: Math.max(scrambleTotal, 1),
    };
  }
  if (isSolveReviewAtEnd(cursor)) {
    if (solveTotal <= 0) {
      return {
        phase: "scramble",
        current: scrambleTotal,
        total: Math.max(scrambleTotal, 1),
      };
    }
    return {
      phase: "solve",
      current: solveTotal,
      total: Math.max(solveTotal, 1),
    };
  }
  const solveIndex = cursor.index - cursor.scrambleLen;
  return {
    phase: "solve",
    current: solveIndex + 1,
    total: Math.max(solveTotal, 1),
  };
}

export type SolveReviewSegmentId = "scramble" | CfopPhaseId;

/** 回放游标上的分段区间（左闭右开）。 */
export type SolveReviewSegmentRange = {
  id: SolveReviewSegmentId;
  label: string;
  start: number;
  end: number;
};

function phasesForPrefix(
  phases: readonly SolveReviewPhaseSpan[] | undefined,
  rawCount: number,
): SolveReviewPhaseSpan[] | undefined {
  if (!phases?.length) {
    return undefined;
  }
  return phases
    .filter((phase) => phase.startIndex < rawCount)
    .map((phase) => ({
      startIndex: phase.startIndex,
      endIndex: Math.min(phase.endIndex, rawCount),
    }));
}

/** raw trace.steps 前缀长度 → 按段合并后的步数。 */
export function coalesceRawSolvePrefixLength(
  steps: readonly SolveTraceStep[],
  rawCount: number,
  phases?: readonly SolveReviewPhaseSpan[],
): number {
  const n = Math.max(0, Math.min(steps.length, Math.trunc(rawCount)));
  return coalesceSolveStepsByPhases(
    steps.slice(0, n),
    phasesForPrefix(phases, n),
  ).length;
}

/**
 * 打乱 + CFOP 各段在回放游标上的区间。
 * `phases[].startIndex/endIndex` 对应 trace.steps（与 timedMoves 同序）。
 */
export function buildSolveReviewSegmentRanges(
  trace: SolveTrace,
  phases: readonly {
    id: CfopPhaseId;
    label: string;
    startIndex: number;
    endIndex: number;
  }[],
): SolveReviewSegmentRange[] {
  const spans = phases.map((phase) => ({
    startIndex: phase.startIndex,
    endIndex: phase.endIndex,
  }));
  const cursor = createSolveReviewCursor(trace, spans);
  const scrambleLen = cursor.scrambleLen;
  const ranges: SolveReviewSegmentRange[] = [
    {
      id: "scramble",
      label: "打乱",
      start: 0,
      end: scrambleLen,
    },
  ];
  for (const phase of phases) {
    ranges.push({
      id: phase.id,
      label: phase.label,
      start:
        scrambleLen +
        coalesceRawSolvePrefixLength(trace.steps, phase.startIndex, spans),
      end:
        scrambleLen +
        coalesceRawSolvePrefixLength(trace.steps, phase.endIndex, spans),
    });
  }
  return ranges;
}

export function solveReviewAtIndex(
  cursor: SolveReviewCursor,
  index: number,
): SolveReviewCursor {
  return {
    ...cursor,
    index: Math.max(0, Math.min(cursor.steps.length, Math.trunc(index))),
  };
}

/** 游标落在哪一段（播完某段终点时归下一段起点；全部播完归最后一段）。 */
export function solveReviewActiveSegmentId(
  ranges: readonly SolveReviewSegmentRange[],
  index: number,
): SolveReviewSegmentId | null {
  if (ranges.length === 0) {
    return null;
  }
  for (const range of ranges) {
    if (index >= range.start && index < range.end) {
      return range.id;
    }
  }
  const last = ranges[ranges.length - 1]!;
  if (index >= last.end) {
    return last.id;
  }
  // 空段：落在 start===end 的缝上，取下一段有内容的起点段，或当前空段。
  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i]!;
    if (index === range.start) {
      return range.id;
    }
  }
  return ranges[0]?.id ?? null;
}

/**
 * 决定下一次「播放」的区间。
 * 分段焦点下若已停在段末，则切到下一段；无下一段则回到整段重播。
 */
export function nextSolveReviewPlayRange(
  ranges: readonly SolveReviewSegmentRange[],
  focusId: SolveReviewSegmentId | null,
  index: number,
  totalSteps: number,
): {
  focusId: SolveReviewSegmentId | null;
  resumeAt: number;
  end: number;
} {
  const total = Math.max(0, Math.trunc(totalSteps));
  const at = Math.max(0, Math.min(total, Math.trunc(index)));
  const focused = focusId
    ? ranges.find((range) => range.id === focusId)
    : undefined;

  if (focused) {
    if (at < focused.end) {
      return { focusId: focused.id, resumeAt: at, end: focused.end };
    }
    const order = ranges.findIndex((range) => range.id === focused.id);
    const next = order >= 0 ? ranges[order + 1] : undefined;
    if (next) {
      return { focusId: next.id, resumeAt: next.start, end: next.end };
    }
    return { focusId: null, resumeAt: 0, end: total };
  }

  if (at >= total) {
    return { focusId: null, resumeAt: 0, end: total };
  }
  return { focusId: null, resumeAt: at, end: total };
}
