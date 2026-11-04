import { isFaceMove, isRotationMove } from "./solveMetrics.ts";
import { remapFaceMoveThroughOrientation } from "./solveTrace.ts";

/**
 * 色心绝对面转 → 当前握持记号。
 * 与 {@link remapFaceMoveThroughOrientation}（握持→绝对）互逆。
 */
export function absoluteFaceMoveToGrip(
  absoluteMove: string,
  orientationMoves: readonly string[],
): string {
  if (orientationMoves.length === 0) {
    return absoluteMove.trim();
  }
  // 对 z2 等：握持→绝对 与 绝对→握持 都可用同一套 inv 映射的对偶；
  // 用「正向」面映射实现绝对→握持。
  const token = absoluteMove.trim();
  const match = /^([URFDLB])(2|')?$/i.exec(token);
  if (!match) {
    return token;
  }
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
  let face = match[1]!.toUpperCase();
  const suffix = match[2] ?? "";
  // 握持→绝对按 orientation 正向逐个取逆映射；绝对→握持需逆序取正映射。
  for (const rot of [...orientationMoves].reverse()) {
    const map = ROTATION_FACE_MAP[rot];
    if (!map) {
      continue;
    }
    face = map[face] ?? face;
  }
  return `${face}${suffix}`;
}

function faceFamily(move: string): string | null {
  const match = /^([URFDLB])(2|')?$/i.exec(move.trim());
  return match ? match[1]!.toUpperCase() : null;
}

function faceQuarterSign(move: string): number {
  const token = move.trim();
  if (token.endsWith("2")) {
    return 2;
  }
  if (token.endsWith("'")) {
    return -1;
  }
  return 1;
}

function faceFromQuarters(family: string, quarters: number): string | null {
  const q = ((quarters % 4) + 4) % 4;
  if (q === 0) {
    return null;
  }
  if (q === 1) {
    return family;
  }
  if (q === 2) {
    return `${family}2`;
  }
  return `${family}'`;
}

function rotationAxis(move: string): string | null {
  const token = move.trim();
  if (!isRotationMove(token)) {
    return null;
  }
  return token[0]!.toLowerCase();
}

function rotationQuarterSign(move: string): number {
  const token = move.trim();
  if (token.endsWith("2")) {
    return 2;
  }
  if (token.endsWith("'")) {
    return -1;
  }
  return 1;
}

function rotationFromQuarters(axis: string, quarters: number): string | null {
  const q = ((quarters % 4) + 4) % 4;
  if (q === 0) {
    return null;
  }
  if (q === 1) {
    return axis;
  }
  if (q === 2) {
    return `${axis}2`;
  }
  return `${axis}'`;
}

/** 合并同轴连续转体，并消掉 y y' / z z' 等空转。 */
export function cancelRedundantRotations(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) {
      continue;
    }
    if (!isRotationMove(token)) {
      out.push(token);
      continue;
    }
    const prev = out[out.length - 1];
    if (!prev || !isRotationMove(prev)) {
      out.push(token);
      continue;
    }
    const axis = rotationAxis(token);
    const prevAxis = rotationAxis(prev);
    if (!axis || axis !== prevAxis) {
      out.push(token);
      continue;
    }
    const merged = rotationFromQuarters(
      axis,
      rotationQuarterSign(prev) + rotationQuarterSign(token),
    );
    if (merged === null) {
      out.pop();
    } else {
      out[out.length - 1] = merged;
    }
  }
  return out;
}

/** 合并连续同层四分之一转（L L → L2），便于对照手拧。 */
export function mergeQuarterMoves(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) {
      continue;
    }
    if (isRotationMove(token) || !isFaceMove(token)) {
      out.push(token);
      continue;
    }
    const prev = out[out.length - 1];
    if (!prev || isRotationMove(prev) || !isFaceMove(prev)) {
      out.push(token);
      continue;
    }
    const family = faceFamily(token);
    const prevFamily = faceFamily(prev);
    if (!family || family !== prevFamily) {
      out.push(token);
      continue;
    }
    const merged = faceFromQuarters(
      family,
      faceQuarterSign(prev) + faceQuarterSign(token),
    );
    if (merged === null) {
      out.pop();
    } else {
      out[out.length - 1] = merged;
    }
  }
  return out;
}

/**
 * 将一段绝对轨迹（可含 x/y/z）格式化为握持公式。
 * `orientationBefore` 为该段开始前已累积的转体。
 */
export function formatGripRelativeAlg(
  moves: readonly string[],
  orientationBefore: readonly string[] = [],
): string {
  const orientation = [...orientationBefore];
  const tokens: string[] = [];
  for (const raw of moves) {
    const move = raw.trim();
    if (!move) {
      continue;
    }
    if (isRotationMove(move)) {
      orientation.push(move);
      tokens.push(move);
      continue;
    }
    if (!isFaceMove(move)) {
      tokens.push(move);
      continue;
    }
    tokens.push(absoluteFaceMoveToGrip(move, orientation));
  }
  return cancelRedundantRotations(mergeQuarterMoves(tokens)).join(" ");
}

/**
 * HTM 面转步数：先合并四分之一转（R R → R2 计 1），不含 x/y/z。
 * 与复盘公式展示口径一致。
 */
export function countFaceMovesHtm(moves: readonly string[]): number {
  const faces = moves.filter((move) => isFaceMove(move.trim()));
  return mergeQuarterMoves(faces).length;
}

/**
 * 展示用转体次数：与公式口径一致。
 * 在完整序列上消去相邻空转（`y y'`）；中间有面转则分别计次（`y2 … y` 计 2）。
 */
export function countRotationsDisplay(moves: readonly string[]): number {
  const cleaned = cancelRedundantRotations(mergeQuarterMoves(moves));
  let n = 0;
  for (const move of cleaned) {
    if (isRotationMove(move)) {
      n += 1;
    }
  }
  return n;
}

/** 自序列开头累计到 `endExclusive` 之前的转体。 */
export function orientationPrefix(
  moves: readonly string[],
  endExclusive: number,
): string[] {
  const orientation: string[] = [];
  const end = Math.max(0, Math.min(endExclusive, moves.length));
  for (let i = 0; i < end; i += 1) {
    const move = moves[i]!.trim();
    if (isRotationMove(move)) {
      orientation.push(move);
    }
  }
  return orientation;
}

/**
 * 校验：握持→绝对→握持 在给定朝向下应回到原记号。
 * （供测试；生产路径用 absoluteFaceMoveToGrip。）
 */
export function gripAbsoluteRoundTrip(
  gripMove: string,
  orientationMoves: readonly string[],
): string {
  const absolute = remapFaceMoveThroughOrientation(gripMove, orientationMoves);
  return absoluteFaceMoveToGrip(absolute, orientationMoves);
}
