export type ScoreMode = "非蓝牙";

export type Score = {
  timeMs: number;
  scramble: string;
  recordedAt: string;
  mode: ScoreMode;
  split: false;
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
 * WCA Ao5: five newest times, drop best and worst, mean of the middle three.
 */
export function averageOf5(timesNewestFirst: readonly number[]): number | null {
  if (timesNewestFirst.length < 5) {
    return null;
  }
  const five = timesNewestFirst.slice(0, 5);
  const sorted = [...five].sort((a, b) => a - b);
  const mid = sorted.slice(1, 4);
  return Math.round((mid[0]! + mid[1]! + mid[2]!) / 3);
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
    ao5Ms: averageOf5(timesNewestFirst),
  };
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
    record(input: { timeMs: number; scramble: string }): Score {
      const score = createScore(input, now());
      const scores = [score, ...readScores(storage.read())].slice(
        0,
        SCORE_LIMIT,
      );
      storage.write(JSON.stringify(scores));
      return score;
    },
  };
}

function createScore(
  input: { timeMs: number; scramble: string },
  now: Date,
): Score {
  if (!Number.isFinite(input.timeMs) || input.timeMs < 0) {
    throw new Error("时间无效");
  }
  const scramble = input.scramble.trim();
  if (scramble === "") {
    throw new Error("打乱是空的");
  }
  return {
    timeMs: Math.trunc(input.timeMs),
    scramble,
    recordedAt: now.toISOString(),
    mode: "非蓝牙",
    split: false,
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
    return parsed.filter(isScore);
  } catch {
    return [];
  }
}

function isScore(value: unknown): value is Score {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.timeMs === "number" &&
    Number.isFinite(item.timeMs) &&
    item.timeMs >= 0 &&
    typeof item.scramble === "string" &&
    item.scramble.trim() !== "" &&
    typeof item.recordedAt === "string" &&
    !Number.isNaN(Date.parse(item.recordedAt)) &&
    item.mode === "非蓝牙" &&
    item.split === false
  );
}
