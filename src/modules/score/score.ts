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

export function createScoreLog(
  storage: ScoreStorage,
  now: () => Date = () => new Date(),
) {
  return {
    list(): Score[] {
      return readScores(storage.read());
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
