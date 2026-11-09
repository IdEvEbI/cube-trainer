import {
  SOLVE_TRACE_VERSION,
  type SolveTrace,
  type SolveTraceStep,
} from "./solveTrace.ts";

export type ScoreMode = "非蓝牙" | "蓝牙";

/** 蓝牙分段快照（与弹层展示字段对齐，便于成绩详情复用）。 */
export type ScorePhaseSplit = {
  id: string;
  label: string;
  /** 该段握持公式；旧记录可能缺失，读出时补空串。 */
  alg: string;
  timeMs: number;
  timeShare: number;
  moves: number;
  rotations: number;
  tps: number;
  pauseRate: number;
};

export type ScoreSplit = {
  overview: {
    moves: number;
    rotations: number;
    tps: number;
    pauseRate: number;
  };
  phases: ScorePhaseSplit[];
};

export type Score = {
  /** 稳定主键；旧记录读出时按 recordedAt+timeMs+scramble 合成。 */
  id: string;
  timeMs: number;
  scramble: string;
  recordedAt: string;
  mode: ScoreMode;
  split: false | ScoreSplit;
  /** 蓝牙复盘轨迹；旧记录或非蓝牙为 false。 */
  trace: false | SolveTrace;
};

export type ScoreStorage = {
  read(): string | null;
  write(value: string): void;
};

export type ScoreSummary = {
  count: number;
  bestMs: number | null;
  worstMs: number | null;
  avgMs: number | null;
  /** WCA-style Ao5 over the five newest attempts; null if fewer than 5. */
  ao5Ms: number | null;
  /** WCA-style Ao12；不足 12 次为 null。 */
  ao12Ms: number | null;
  /** WCA-style Ao100；不足 100 次为 null。 */
  ao100Ms: number | null;
};

const STORAGE_KEY = "cube-trainer-scores";
const SCORE_LIMIT = 100;

export function browserScoreStorage(): ScoreStorage {
  return {
    read() {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // 本机写不进去时，这次计时仍然可以结束。
      }
    },
  };
}

/**
 * WCA 截尾平均：取最新 n 次，去掉最好与最差，对中间 n−2 次取平均。
 */
export function trimmedAverage(
  timesNewestFirst: readonly number[],
  windowSize: number,
): number | null {
  if (windowSize < 3 || timesNewestFirst.length < windowSize) {
    return null;
  }
  const window = timesNewestFirst.slice(0, windowSize);
  const sorted = [...window].sort((a, b) => a - b);
  const mid = sorted.slice(1, -1);
  let sum = 0;
  for (const time of mid) {
    sum += time;
  }
  return Math.round(sum / mid.length);
}

/** WCA Ao5：最新 5 次截尾平均。 */
export function averageOf5(timesNewestFirst: readonly number[]): number | null {
  return trimmedAverage(timesNewestFirst, 5);
}

export function summarizeAttempts(
  timesNewestFirst: readonly number[],
): ScoreSummary {
  const count = timesNewestFirst.length;
  if (count === 0) {
    return {
      count: 0,
      bestMs: null,
      worstMs: null,
      avgMs: null,
      ao5Ms: null,
      ao12Ms: null,
      ao100Ms: null,
    };
  }
  let best = timesNewestFirst[0]!;
  let worst = timesNewestFirst[0]!;
  let sum = 0;
  for (const time of timesNewestFirst) {
    if (time < best) {
      best = time;
    }
    if (time > worst) {
      worst = time;
    }
    sum += time;
  }
  return {
    count,
    bestMs: best,
    worstMs: worst,
    avgMs: Math.round(sum / count),
    ao5Ms: trimmedAverage(timesNewestFirst, 5),
    ao12Ms: trimmedAverage(timesNewestFirst, 12),
    ao100Ms: trimmedAverage(timesNewestFirst, 100),
  };
}

/** 成绩列表按最新在前；取上一把总时间，无成绩为 null。 */
export function latestSolveTimeMs(scores: readonly Score[]): number | null {
  const latest = scores[0];
  return latest ? latest.timeMs : null;
}

export function createScoreLog(
  storage: ScoreStorage,
  now: () => Date = () => new Date(),
) {
  return {
    list(): Score[] {
      return readScores(storage.read());
    },
    summary(): ScoreSummary {
      return summarizeAttempts(
        readScores(storage.read()).map((score) => score.timeMs),
      );
    },
    record(input: {
      timeMs: number;
      scramble: string;
      mode?: ScoreMode;
      split?: false | ScoreSplit;
      trace?: false | SolveTrace;
      id?: string;
    }): Score {
      const score = createScore(input, now());
      const scores = [score, ...readScores(storage.read())].slice(
        0,
        SCORE_LIMIT,
      );
      storage.write(JSON.stringify(scores));
      return score;
    },
    /** 去掉最新一条（再练一次撤销进入复盘时写入的成绩）。空列表返回 null。 */
    removeNewest(): Score | null {
      const scores = readScores(storage.read());
      if (scores.length === 0) {
        return null;
      }
      const [removed, ...rest] = scores;
      storage.write(JSON.stringify(rest));
      return removed ?? null;
    },
    /** 按 id 删除一条；未找到返回 null。 */
    removeById(id: string): Score | null {
      const key = id.trim();
      if (key === "") {
        return null;
      }
      const scores = readScores(storage.read());
      const index = scores.findIndex((score) => score.id === key);
      if (index < 0) {
        return null;
      }
      const removed = scores[index]!;
      const next = [...scores.slice(0, index), ...scores.slice(index + 1)];
      storage.write(JSON.stringify(next));
      return removed;
    },
  };
}

function createScoreId(now: Date): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${now.toISOString()}_${rand}`;
}

function legacyScoreId(
  recordedAt: string,
  timeMs: number,
  scramble: string,
): string {
  return `${recordedAt}|${timeMs}|${scramble}`;
}

function createScore(
  input: {
    timeMs: number;
    scramble: string;
    mode?: ScoreMode;
    split?: false | ScoreSplit;
    trace?: false | SolveTrace;
    id?: string;
  },
  now: Date,
): Score {
  if (!Number.isFinite(input.timeMs) || input.timeMs < 0) {
    throw new Error("时间无效");
  }
  const scramble = input.scramble.trim();
  if (scramble === "") {
    throw new Error("打乱是空的");
  }
  const mode = input.mode ?? "非蓝牙";
  const split = input.split ?? false;
  const trace = input.trace ?? false;
  if (mode === "非蓝牙" && split !== false) {
    throw new Error("非蓝牙成绩不支持分段");
  }
  if (mode === "非蓝牙" && trace !== false) {
    throw new Error("非蓝牙成绩不支持复盘轨迹");
  }
  const recordedAt = now.toISOString();
  const timeMs = Math.trunc(input.timeMs);
  const id = input.id?.trim() || createScoreId(now);
  return {
    id,
    timeMs,
    scramble,
    recordedAt,
    mode,
    split,
    trace,
  };
}

function readScores(raw: string | null): Score[] {
  if (raw === null || raw.trim() === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const scores: Score[] = [];
    for (const item of parsed) {
      const score = normalizeScore(item);
      if (score) {
        scores.push(score);
      }
    }
    return scores;
  } catch {
    return [];
  }
}

function normalizeScore(value: unknown): Score | null {
  if (!isScoreRecord(value)) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const timeMs = item.timeMs as number;
  const scramble = (item.scramble as string).trim();
  const recordedAt = item.recordedAt as string;
  const mode = item.mode as ScoreMode;
  const split = normalizeScoreSplit(item.split ?? false);
  const trace = parseStoredTrace(item.trace);
  const id =
    typeof item.id === "string" && item.id.trim() !== ""
      ? item.id.trim()
      : legacyScoreId(recordedAt, timeMs, scramble);
  return { id, timeMs, scramble, recordedAt, mode, split, trace };
}

function normalizeScoreSplit(value: unknown): false | ScoreSplit {
  if (value === false || value === undefined || value === null) {
    return false;
  }
  if (!isScoreSplit(value)) {
    return false;
  }
  return {
    overview: value.overview,
    phases: value.phases.map((phase) => ({
      ...phase,
      alg: typeof phase.alg === "string" ? phase.alg : "",
    })),
  };
}

function parseStoredTrace(value: unknown): false | SolveTrace {
  if (value === undefined || value === false || value === null) {
    return false;
  }
  if (typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  if (row.version !== SOLVE_TRACE_VERSION) {
    return false;
  }
  if (
    typeof row.scramble !== "string" ||
    typeof row.startSetupAlg !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(row.steps)) {
    return false;
  }
  const steps: SolveTraceStep[] = [];
  for (const step of row.steps) {
    if (typeof step !== "object" || step === null) {
      return false;
    }
    const s = step as Record<string, unknown>;
    if (
      typeof s.move !== "string" ||
      typeof s.rawMove !== "string" ||
      typeof s.atMs !== "number" ||
      (s.kind !== "face" && s.kind !== "rotation") ||
      typeof s.orientationAfter !== "string"
    ) {
      return false;
    }
    steps.push({
      move: s.move,
      rawMove: s.rawMove,
      atMs: s.atMs,
      kind: s.kind,
      orientationAfter: s.orientationAfter,
    });
  }
  return {
    version: SOLVE_TRACE_VERSION,
    scramble: row.scramble,
    // 旧成绩无此字段：按还原态起点回放。
    scrambleSetupAlg:
      typeof row.scrambleSetupAlg === "string" ? row.scrambleSetupAlg : "",
    startSetupAlg: row.startSetupAlg,
    steps,
  };
}

function isScoreSplit(value: unknown): value is ScoreSplit {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const split = value as Record<string, unknown>;
  if (typeof split.overview !== "object" || split.overview === null) {
    return false;
  }
  const overview = split.overview as Record<string, unknown>;
  if (
    typeof overview.moves !== "number" ||
    typeof overview.rotations !== "number" ||
    typeof overview.tps !== "number" ||
    typeof overview.pauseRate !== "number"
  ) {
    return false;
  }
  if (!Array.isArray(split.phases)) {
    return false;
  }
  return split.phases.every((phase) => {
    if (typeof phase !== "object" || phase === null) {
      return false;
    }
    const row = phase as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.label !== "string" ||
      typeof row.timeMs !== "number" ||
      typeof row.timeShare !== "number" ||
      typeof row.moves !== "number" ||
      typeof row.rotations !== "number" ||
      typeof row.tps !== "number" ||
      typeof row.pauseRate !== "number"
    ) {
      return false;
    }
    // 旧记录无 alg；新记录为 string。
    return row.alg === undefined || typeof row.alg === "string";
  });
}

function isScoreRecord(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.timeMs !== "number" ||
    !Number.isFinite(item.timeMs) ||
    item.timeMs < 0 ||
    typeof item.scramble !== "string" ||
    item.scramble.trim() === "" ||
    typeof item.recordedAt !== "string" ||
    Number.isNaN(Date.parse(item.recordedAt))
  ) {
    return false;
  }
  if (item.mode === "非蓝牙") {
    return item.split === false || item.split === undefined;
  }
  if (item.mode === "蓝牙") {
    return (
      item.split === false ||
      item.split === undefined ||
      isScoreSplit(item.split)
    );
  }
  return false;
}
