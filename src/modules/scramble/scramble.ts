import { Alg } from "cubing/alg";
import type { Scramble } from "./types.ts";

const FACES = ["U", "D", "L", "R", "F", "B"] as const;

type Face = (typeof FACES)[number];
type Axis = "UD" | "LR" | "FB";

const AXIS: Record<Face, Axis> = {
  U: "UD",
  D: "UD",
  L: "LR",
  R: "LR",
  F: "FB",
  B: "FB",
};

const SUFFIXES = ["", "'", "2"] as const;
const SCRAMBLE_LENGTH = 20;
const FACE_TURN = /^[UDLRFB](?:2'|2|')?$/;
/**
 * 引导公式：面转 + 宽层 + 中层 + 整机转体。
 * 双步撇同时认 `2'`（cubing）与 `'2`（采集/联调表，如 `r'2`）。
 */
const GUIDED_TURN = /^(?:[UDLRFBudlrfbxyz]|[MES])(?:2'|'2|2|')?$/;

function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  const item = items[index];
  if (item === undefined) {
    throw new Error("随机源无效");
  }
  return item;
}

/** White-up scramble view (CSTimer-style); use for timer 3D + net. */
export function scrambleViewAlgorithm(moves: string): string {
  return parseScramble(moves).join(" ");
}

/**
 * Yellow-up view: scramble in white-up frame, then z2 for solve orientation.
 * Practice / restore still use yellow-up; timer first screen uses scrambleViewAlgorithm.
 */
export function scrambleDisplayAlgorithm(moves: string): string {
  return `z2 ${parseScramble(moves).join(" ")} z2`;
}

export function parseScramble(source: string): string[] {
  const moves = [...new Alg(source).experimentalLeafMoves()].map((move) =>
    move.toString(),
  );
  if (moves.length === 0) {
    throw new Error("打乱是空的");
  }
  const invalid = moves.find((move) => !FACE_TURN.test(move));
  if (invalid) {
    throw new Error(`无法打乱：${invalid}`);
  }
  return moves;
}

/**
 * 蓝牙跟转公式：允许宽层 / 中层 / 转体；展示仍用原记号，到位靠 facelets。
 * 含 `r'2` 等采集记号时不走 cubing `Alg`（其只认 `r2'`），按空格拆以保真。
 * 随机打乱仍走 {@link parseScramble}（仅外层）。
 */
export function parseGuidedAlg(source: string): string[] {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error("打乱是空的");
  }
  const spaced = trimmed.split(/\s+/).filter(Boolean);
  if (spaced.length > 0 && spaced.every((move) => GUIDED_TURN.test(move))) {
    return spaced;
  }
  let moves: string[];
  try {
    moves = [...new Alg(trimmed).experimentalLeafMoves()].map((move) =>
      move.toString(),
    );
  } catch {
    const invalid = spaced.find((move) => !GUIDED_TURN.test(move)) ?? trimmed;
    throw new Error(`无法引导：${invalid}`);
  }
  if (moves.length === 0) {
    throw new Error("打乱是空的");
  }
  const invalid = moves.find((move) => !GUIDED_TURN.test(move));
  if (invalid) {
    throw new Error(`无法引导：${invalid}`);
  }
  return moves;
}

export function randomScramble3x3(
  random: () => number = Math.random,
): Scramble {
  const tokens: string[] = [];
  let previousFace: Face | null = null;
  let previousAxis: Axis | null = null;
  let axisBeforeThat: Axis | null = null;

  while (tokens.length < SCRAMBLE_LENGTH) {
    const faces = FACES.filter((face) => {
      if (face === previousFace) {
        return false;
      }
      return !(AXIS[face] === previousAxis && AXIS[face] === axisBeforeThat);
    });
    const face = pick(faces, random);
    const suffix = pick(SUFFIXES, random);
    tokens.push(`${face}${suffix}`);
    axisBeforeThat = previousAxis;
    previousAxis = AXIS[face];
    previousFace = face;
  }

  return {
    puzzle: "3x3",
    moves: parseScramble(tokens.join(" ")).join(" "),
  };
}

/**
 * 真机联调：首页用引导式层转公式（不含外层单面、不含转体）。
 * 验收通过后改回 false（恢复仅外层随机打乱）。
 */
export const USE_TEMP_WIDE_SLICE_HOME_SCRAMBLE = true;

/**
 * 联调焦点：决定首页随机公式族。
 * L9 后默认 `full-mix`：单边 + 中层 + 宽层（含双步），步数加长。
 */
export type GuidedHomeTestFocus =
  | "wide-quarter"
  | "wide-double"
  | "slice-quarter"
  | "slice-double"
  | "wide-slice"
  | "layer-then-face"
  | "full-mix";

/** L9 通过后：完整混测（单边 / 中层 / 宽层，含双步）。 */
export const GUIDED_HOME_TEST_FOCUS: GuidedHomeTestFocus = "full-mix";

const SLICE_BASES = ["M", "E", "S"] as const;
const WIDE_BASES = ["u", "d", "l", "r", "f", "b"] as const;
const FACE_BASES = ["U", "D", "L", "R", "F", "B"] as const;
const QUARTER_SUFFIXES = ["", "'"] as const;
const DOUBLE_SUFFIXES = ["2", "'2"] as const;

function pickMove(
  bases: readonly string[],
  suffixes: readonly string[],
  random: () => number,
  previousBase: string | null,
): string {
  const choices =
    previousBase === null
      ? bases
      : bases.filter(
          (base) => base.toLowerCase() !== previousBase.toLowerCase(),
        );
  const pool = choices.length > 0 ? choices : bases;
  const base = pick(pool, random);
  const suffix = pick(suffixes, random);
  return `${base}${suffix}`;
}

function appendRandomMoves(
  tokens: string[],
  count: number,
  bases: readonly string[],
  suffixes: readonly string[],
  random: () => number,
): void {
  let previousBase: string | null =
    tokens.length > 0 ? tokens[tokens.length - 1]![0]! : null;
  for (let i = 0; i < count; i += 1) {
    const move = pickMove(bases, suffixes, random, previousBase);
    tokens.push(move);
    previousBase = move[0]!;
  }
}

/**
 * 联调用随机引导打乱：按 {@link GUIDED_HOME_TEST_FOCUS} 针对性出步。
 * L6（wide-double）：前两步固定为 `r2`/`r'2`（顺序随机），再补若干宽层双步。
 */
export function randomGuidedTestScramble(
  random: () => number = Math.random,
  focus: GuidedHomeTestFocus = GUIDED_HOME_TEST_FOCUS,
): string {
  const tokens: string[] = [];

  switch (focus) {
    case "wide-quarter": {
      appendRandomMoves(
        tokens,
        5 + Math.floor(random() * 2),
        WIDE_BASES,
        QUARTER_SUFFIXES,
        random,
      );
      break;
    }
    case "wide-double": {
      // L6 人工脚本要立刻碰到 r2 / r'2：固定前两步，顺序随机。
      if (random() < 0.5) {
        tokens.push("r2", "r'2");
      } else {
        tokens.push("r'2", "r2");
      }
      appendRandomMoves(
        tokens,
        2 + Math.floor(random() * 2),
        WIDE_BASES,
        DOUBLE_SUFFIXES,
        random,
      );
      break;
    }
    case "slice-quarter": {
      appendRandomMoves(
        tokens,
        5 + Math.floor(random() * 2),
        SLICE_BASES,
        QUARTER_SUFFIXES,
        random,
      );
      break;
    }
    case "slice-double": {
      // L8：先碰到 M2/M'2，再补中层双步（含 E2/S2）。
      if (random() < 0.5) {
        tokens.push("M2", "M'2");
      } else {
        tokens.push("M'2", "M2");
      }
      appendRandomMoves(
        tokens,
        2 + Math.floor(random() * 2),
        SLICE_BASES,
        DOUBLE_SUFFIXES,
        random,
      );
      break;
    }
    case "wide-slice": {
      appendRandomMoves(
        tokens,
        3 + Math.floor(random() * 2),
        SLICE_BASES,
        SUFFIXES,
        random,
      );
      appendRandomMoves(
        tokens,
        3 + Math.floor(random() * 2),
        WIDE_BASES,
        SUFFIXES,
        random,
      );
      break;
    }
    case "layer-then-face": {
      // L9：层转后紧接外面转，验错面 / 整机假转。
      tokens.push(random() < 0.5 ? "r" : "M");
      appendRandomMoves(tokens, 1, FACE_BASES, QUARTER_SUFFIXES, random);
      tokens.push(random() < 0.5 ? "M'" : "r'");
      appendRandomMoves(
        tokens,
        1 + Math.floor(random() * 2),
        FACE_BASES,
        QUARTER_SUFFIXES,
        random,
      );
      break;
    }
    case "full-mix": {
      // 完整回归：单边 + 中层 + 宽层（四分之一为主，穿插双步），约 12–16 步。
      type MixKind = "face" | "slice-q" | "wide-q" | "slice-d" | "wide-d";
      const kindPool: MixKind[] = [
        "face",
        "face",
        "face",
        "slice-q",
        "slice-q",
        "wide-q",
        "wide-q",
        "slice-d",
        "wide-d",
      ];
      const kindBases: Record<
        MixKind,
        { bases: readonly string[]; suffixes: readonly string[] }
      > = {
        face: { bases: FACE_BASES, suffixes: QUARTER_SUFFIXES },
        "slice-q": { bases: SLICE_BASES, suffixes: QUARTER_SUFFIXES },
        "wide-q": { bases: WIDE_BASES, suffixes: QUARTER_SUFFIXES },
        "slice-d": { bases: SLICE_BASES, suffixes: DOUBLE_SUFFIXES },
        "wide-d": { bases: WIDE_BASES, suffixes: DOUBLE_SUFFIXES },
      };
      // 先各塞一类，保证公式里三类都有、且含至少一个双步。
      const seedKinds: MixKind[] = [
        "face",
        "slice-q",
        "wide-q",
        "slice-d",
        "wide-d",
      ];
      for (let i = seedKinds.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        const tmp = seedKinds[i]!;
        seedKinds[i] = seedKinds[j]!;
        seedKinds[j] = tmp;
      }
      const plan: MixKind[] = [...seedKinds];
      const extra = 7 + Math.floor(random() * 5); // 总计约 12–16
      for (let i = 0; i < extra; i += 1) {
        plan.push(pick(kindPool, random));
      }
      let previousBase: string | null = null;
      for (const kind of plan) {
        const { bases, suffixes } = kindBases[kind];
        const move = pickMove(bases, suffixes, random, previousBase);
        tokens.push(move);
        previousBase = move[0]!;
      }
      break;
    }
    default: {
      const _exhaustive: never = focus;
      throw new Error(`未知联调焦点：${String(_exhaustive)}`);
    }
  }

  return parseGuidedAlg(tokens.join(" ")).join(" ");
}

/** 计时首页「下一打乱」：联调期按焦点出引导式，否则随机外层。 */
export function nextHomeScrambleMoves(
  random: () => number = Math.random,
): string {
  if (USE_TEMP_WIDE_SLICE_HOME_SCRAMBLE) {
    return randomGuidedTestScramble(random);
  }
  return randomScramble3x3(random).moves;
}
