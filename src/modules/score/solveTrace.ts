import {
  isFaceMove,
  isRotationMove,
  type TimedSolveMove,
} from "./solveMetrics.ts";

/** 序列版本，便于后续分段 / 回放演进。 */
export const SOLVE_TRACE_VERSION = 1 as const;

export type SolveTraceStepKind = "face" | "rotation";

/**
 * 单步记录。
 * - `move`：写入复盘公式的记号（面转已按当前朝向转换；转体为 x/y/z）
 * - `rawMove`：输入原步（面转转换前；转体与 move 相同）
 * - `atMs`：相对开表毫秒
 * - `orientationAfter`：本步之后的累积转体（空串 = 开表朝向）
 */
export type SolveTraceStep = {
  move: string;
  rawMove: string;
  atMs: number;
  kind: SolveTraceStepKind;
  orientationAfter: string;
};

/**
 * 一局计时的转动轨迹（复盘数据层）。
 * 后续分段公式 / 回放直接消费本结构。
 */
export type SolveTrace = {
  version: typeof SOLVE_TRACE_VERSION;
  /** 本次打乱公式。 */
  scramble: string;
  /** 开表时相对复原的 setup（连接 setup + 开表前转动）。 */
  startSetupAlg: string;
  steps: SolveTraceStep[];
};

export type SolveTraceSessionOptions = {
  scramble: string;
  startSetupAlg?: string;
  /** 返回相对开表的毫秒；默认用 session 内时钟。 */
  nowMs?: () => number;
};

export type SolveTraceSession = {
  /** 追加一步（面转或 x/y/z）；面转会按当前朝向转换后写入 `move`。 */
  append(rawMove: string): SolveTraceStep;
  /** 指定相对开表时刻追加（测试 / 回放对齐用）。 */
  appendAt(rawMove: string, atMs: number): SolveTraceStep;
  /** 当前累积转体（如 `y x'`）。 */
  orientationAlg(): string;
  /** 不可变快照。 */
  snapshot(): SolveTrace;
  /** 兼容现有分段统计的 `{ move, atMs }[]`（使用转换后的 move）。 */
  toTimedMoves(): TimedSolveMove[];
};

const FACE_CHARS = ["U", "D", "F", "B", "L", "R"] as const;

/** 整步转体把各面映到何处（立方体绕固定轴转，面标签跟随）。 */
const ROTATION_FACE_MAP: Record<string, Record<string, string>> = {
  x: { U: "F", F: "D", D: "B", B: "U", L: "L", R: "R" },
  "x'": { U: "B", B: "D", D: "F", F: "U", L: "L", R: "R" },
  x2: { U: "D", D: "U", F: "B", B: "F", L: "L", R: "R" },
  y: { F: "R", R: "B", B: "L", L: "F", U: "U", D: "D" },
  "y'": { F: "L", L: "B", B: "R", R: "F", U: "U", D: "D" },
  y2: { F: "B", B: "F", L: "R", R: "L", U: "U", D: "D" },
  z: { U: "R", R: "D", D: "L", L: "U", F: "F", B: "B" },
  "z'": { U: "L", L: "D", D: "R", R: "U", F: "F", B: "B" },
  z2: { U: "D", D: "U", L: "R", R: "L", F: "F", B: "B" },
};

const INVERSE_ROTATION: Record<string, string> = {
  x: "x'",
  "x'": "x",
  x2: "x2",
  y: "y'",
  "y'": "y",
  y2: "y2",
  z: "z'",
  "z'": "z",
  z2: "z2",
};

type ParsedMove = {
  family: string;
  suffix: string;
  token: string;
};

function parseMoveToken(raw: string): ParsedMove | null {
  const token = raw.trim();
  if (!token) {
    return null;
  }
  const match = /^([URFDLBxyz])(2|')?$/i.exec(token);
  if (!match) {
    return null;
  }
  const family =
    match[1]!.toLowerCase() === match[1]
      ? match[1]!.toLowerCase()
      : match[1]!.toUpperCase();
  const suffix = match[2] ?? "";
  return { family, suffix, token: `${family}${suffix}` };
}

/**
 * 将面转通过已累积转体映到开表朝向下的记号。
 * 输入为转体后的「握持/视角」面转；对每个转体取逆映射，得到开表朝向下的面。
 */
export function remapFaceMoveThroughOrientation(
  faceMove: string,
  orientationMoves: readonly string[],
): string {
  const parsed = parseMoveToken(faceMove);
  if (!parsed || !isFaceMove(parsed.token)) {
    return faceMove.trim();
  }
  let face = parsed.family.toUpperCase();
  for (const rot of orientationMoves) {
    const inverse = INVERSE_ROTATION[rot] ?? rot;
    const map = ROTATION_FACE_MAP[inverse];
    if (!map) {
      continue;
    }
    face = map[face] ?? face;
  }
  if (!FACE_CHARS.includes(face as (typeof FACE_CHARS)[number])) {
    return parsed.token;
  }
  return `${face}${parsed.suffix}`;
}

function normalizeOrientationToken(raw: string): string | null {
  const parsed = parseMoveToken(raw);
  if (!parsed || !isRotationMove(parsed.token)) {
    return null;
  }
  return parsed.token;
}

/**
 * 开一局复盘轨迹会话：从开表起追加转动，转体更新朝向并转换后续面转。
 */
export function createSolveTraceSession(
  options: SolveTraceSessionOptions,
): SolveTraceSession {
  const scramble = options.scramble.trim();
  const startSetupAlg = (options.startSetupAlg ?? "").trim();
  const startedAt = performance.now();
  const nowMs =
    options.nowMs ??
    (() => Math.max(0, Math.round(performance.now() - startedAt)));

  const orientation: string[] = [];
  const steps: SolveTraceStep[] = [];

  function orientationAlg(): string {
    return orientation.join(" ");
  }

  function appendAt(rawMove: string, atMs: number): SolveTraceStep {
    const parsed = parseMoveToken(rawMove);
    if (!parsed) {
      throw new Error(`无法识别转动: ${rawMove}`);
    }
    const t = Math.max(0, Math.trunc(atMs));
    const rot = normalizeOrientationToken(parsed.token);
    if (rot) {
      orientation.push(rot);
      const step: SolveTraceStep = {
        move: rot,
        rawMove: rot,
        atMs: t,
        kind: "rotation",
        orientationAfter: orientationAlg(),
      };
      steps.push(step);
      return step;
    }
    if (!isFaceMove(parsed.token)) {
      throw new Error(`无法识别转动: ${rawMove}`);
    }
    const faceToken = parsed.family.toUpperCase() + parsed.suffix;
    const move = remapFaceMoveThroughOrientation(faceToken, orientation);
    const step: SolveTraceStep = {
      move,
      rawMove: faceToken,
      atMs: t,
      kind: "face",
      orientationAfter: orientationAlg(),
    };
    steps.push(step);
    return step;
  }

  function append(rawMove: string): SolveTraceStep {
    return appendAt(rawMove, nowMs());
  }

  function snapshot(): SolveTrace {
    return {
      version: SOLVE_TRACE_VERSION,
      scramble,
      startSetupAlg,
      steps: steps.map((step) => ({ ...step })),
    };
  }

  function toTimedMoves(): TimedSolveMove[] {
    return steps.map((step) => ({ move: step.move, atMs: step.atMs }));
  }

  return {
    append,
    appendAt,
    orientationAlg,
    snapshot,
    toTimedMoves,
  };
}
