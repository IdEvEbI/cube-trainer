import type { MoyuQuat } from "../bluetooth/moyu/orientation.ts";
import { quatNormalize } from "../bluetooth/moyu/orientation.ts";

/**
 * 24 种整步朝向（相对白上绿前），与 cfopSplit 切分用表一致。
 * 用于把手持姿态吸附到最近朝向，并推断 x/y/z 转体。
 */
export const CUBE_ORIENTATION_ALGS: readonly string[] = [
  "",
  "y",
  "y2",
  "y'",
  "x",
  "x y",
  "x y2",
  "x y'",
  "x'",
  "x' y",
  "x' y2",
  "x' y'",
  // 黄上：用魔友常见的 z2 写法（等价于 x2 / x2 y*）
  "z2",
  "z2 y",
  "z2 y2",
  "z2 y'",
  "z",
  "z y",
  "z y2",
  "z y'",
  "z'",
  "z' y",
  "z' y2",
  "z' y'",
];

const ROTATION_MOVES = [
  "y",
  "y'",
  "y2",
  "x",
  "x'",
  "x2",
  "z",
  "z'",
  "z2",
] as const;

type Face = "U" | "D" | "F" | "B" | "L" | "R";

/** 转体后面标签移到何处（与 solveTrace 一致）。 */
const ROTATION_FACE_MAP: Record<string, Record<Face, Face>> = {
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

const FACE_NORMALS: Record<Face, readonly [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0],
};

const FACES = Object.keys(FACE_NORMALS) as Face[];

type Facing = { up: Face; front: Face };

function invertFaceMap(map: Record<Face, Face>): Record<Face, Face> {
  const inv = {} as Record<Face, Face>;
  for (const from of FACES) {
    inv[map[from]] = from;
  }
  return inv;
}

/** 转体后：哪个色心朝上 / 朝前（槽位仍为世界 U / F）。 */
export function facingAfterAlg(alg: string): Facing {
  let up: Face = "U";
  let front: Face = "F";
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    const map = ROTATION_FACE_MAP[token];
    if (!map) {
      continue;
    }
    const inv = invertFaceMap(map);
    up = inv[up]!;
    front = inv[front]!;
  }
  return { up, front };
}

const FACING_TO_ALG = new Map<string, string>();
for (const alg of CUBE_ORIENTATION_ALGS) {
  const facing = facingAfterAlg(alg);
  FACING_TO_ALG.set(`${facing.up}|${facing.front}`, alg);
}

function facingKey(facing: Facing): string {
  return `${facing.up}|${facing.front}`;
}

function canonicalizeOrientationAlg(alg: string): string {
  return FACING_TO_ALG.get(facingKey(facingAfterAlg(alg))) ?? "";
}

function rotateVecByQuat(
  q: MoyuQuat,
  v: readonly [number, number, number],
): [number, number, number] {
  // q ⊗ (0,v) ⊗ q⁻¹
  const ix = q.w * v[0] + q.y * v[2] - q.z * v[1];
  const iy = q.w * v[1] + q.z * v[0] - q.x * v[2];
  const iz = q.w * v[2] + q.x * v[1] - q.y * v[0];
  const iw = -q.x * v[0] - q.y * v[1] - q.z * v[2];
  return [
    ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  ];
}

function faceMostAlignedWith(
  q: MoyuQuat,
  world: readonly [number, number, number],
): Face {
  let best: Face = "U";
  let bestDot = -Infinity;
  for (const face of FACES) {
    const worldNormal = rotateVecByQuat(q, FACE_NORMALS[face]);
    const dot =
      worldNormal[0] * world[0] +
      worldNormal[1] * world[1] +
      worldNormal[2] * world[2];
    if (dot > bestDot) {
      bestDot = dot;
      best = face;
    }
  }
  return best;
}

/**
 * 由朝向公式构造四元数（右乘、与 face map 同序），供测试与吸附对照。
 */
export function quatFromOrientationAlg(alg: string): MoyuQuat {
  let q: MoyuQuat = { x: 0, y: 0, z: 0, w: 1 };
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    q = quatNormalize(quatMultiply(q, quatFromRotationToken(token)));
  }
  return q;
}

function quatFromRotationToken(token: string): MoyuQuat {
  // x/y 用右手系正角；z 取反以匹配本仓库 ROTATION_FACE_MAP（与 U/R 同向的 z）。
  let halfTurns = token.endsWith("2") ? 2 : token.endsWith("'") ? -1 : 1;
  const axis = token[0]!;
  if (axis === "z") {
    halfTurns = -halfTurns;
  }
  const angle = (halfTurns * Math.PI) / 2;
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  if (axis === "x") {
    return { x: s, y: 0, z: 0, w: c };
  }
  if (axis === "y") {
    return { x: 0, y: s, z: 0, w: c };
  }
  if (axis === "z") {
    return { x: 0, y: 0, z: s, w: c };
  }
  return { x: 0, y: 0, z: 0, w: 1 };
}

function quatMultiply(a: MoyuQuat, b: MoyuQuat): MoyuQuat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/**
 * 将相对姿态四元数吸附到最近的 24 朝向（白上绿前为 ""）。
 */
export function nearestCubeOrientationAlg(quat: MoyuQuat): string {
  const q = quatNormalize(quat);
  const up = faceMostAlignedWith(q, [0, 1, 0]);
  const front = faceMostAlignedWith(q, [0, 0, 1]);
  return FACING_TO_ALG.get(`${up}|${front}`) ?? "";
}

/** CFOP 黄上四朝向（只绕 y 换槽，不含误倾斜出的 z/x）。 */
export const YELLOW_TOP_RING: readonly string[] = [
  "z2",
  "z2 y",
  "z2 y2",
  "z2 y'",
];

export function isYellowTopOrientation(alg: string): boolean {
  return facingAfterAlg(canonicalizeOrientationAlg(alg)).up === "D";
}

/** 在黄上四朝向中取与姿态最贴合的一个。 */
export function nearestYellowTopOrientationAlg(quat: MoyuQuat): string {
  let best = YELLOW_TOP_RING[0]!;
  let bestScore = -Infinity;
  for (const alg of YELLOW_TOP_RING) {
    const score = cubeOrientationScore(quat, alg);
    if (score > bestScore) {
      bestScore = score;
      best = alg;
    }
  }
  return best;
}

/**
 * 计时中朝向候选：已黄上则只允许 y 环，避免手抖被记成 z/z' 并带歪后续公式。
 */
export function midSolveOrientationCandidate(
  quat: MoyuQuat,
  committedAlg: string,
): string {
  if (isYellowTopOrientation(committedAlg)) {
    return nearestYellowTopOrientationAlg(quat);
  }
  return nearestCubeOrientationAlg(quat);
}

/** 朝向相似度：色心与世界轴对齐程度，1 为完全对齐。 */
export function cubeOrientationScore(quat: MoyuQuat, alg: string): number {
  const q = quatNormalize(quat);
  const facing = facingAfterAlg(alg);
  const upN = rotateVecByQuat(q, FACE_NORMALS[facing.up]);
  const frontN = rotateVecByQuat(q, FACE_NORMALS[facing.front]);
  const upDot = upN[1];
  const frontDot = frontN[2];
  return (Math.max(0, upDot) + Math.max(0, frontDot)) / 2;
}

/**
 * 带滞回的朝向吸附：仅当新朝向明显更贴合时才切换，避免边界抖动。
 */
export function snapCubeOrientationAlg(
  quat: MoyuQuat,
  currentAlg: string,
  margin = 0.12,
): string {
  const current = canonicalizeOrientationAlg(currentAlg);
  const next = nearestCubeOrientationAlg(quat);
  if (next === current) {
    return current;
  }
  const currentScore = cubeOrientationScore(quat, current);
  const nextScore = cubeOrientationScore(quat, next);
  if (nextScore >= currentScore + margin) {
    return next;
  }
  return current;
}

function composeOrientationAlg(base: string, move: string): string {
  return canonicalizeOrientationAlg(
    [base, move].filter((part) => part.trim() !== "").join(" "),
  );
}

/**
 * 开表瞬间：相对打乱朝向（白上绿前 `""`）的观察准备转体。
 * 直接用 24 朝向表中的规范写法（如 `z2 y`），避免最短路写成等价的 `y x2`。
 */
export function scrambleToHeldPrepRotations(heldAlg: string): string[] {
  const held = canonicalizeOrientationAlg(heldAlg);
  if (held === "") {
    return [];
  }
  return held.split(/\s+/).filter(Boolean);
}

/** 计时中朝向需稳定这么久才写入转体，避免 z z' 抖动。 */
export const ORIENTATION_HOLD_STABLE_MS = 320;

/** 面转后静默窗口：此间不采纳陀螺仪转体，避免打断 R2 等连拧。 */
export const ORIENTATION_FACE_QUIET_MS = 450;

export function clearOrientationHoldPending(
  state: OrientationHoldState,
  nowMs: number = 0,
): OrientationHoldState {
  return {
    committed: state.committed,
    pending: null,
    pendingSinceMs: nowMs,
  };
}

export type OrientationHoldState = {
  committed: string;
  pending: string | null;
  pendingSinceMs: number;
};

export function createOrientationHoldState(
  committed = "",
): OrientationHoldState {
  return { committed, pending: null, pendingSinceMs: 0 };
}

/**
 * 朝向候选需连续稳定 {@link ORIENTATION_HOLD_STABLE_MS} 才提交，
 * 返回本次新提交的转体路径（可能为空）。
 */
export function tickOrientationHold(
  state: OrientationHoldState,
  candidateAlg: string,
  nowMs: number,
  stableMs: number = ORIENTATION_HOLD_STABLE_MS,
): { state: OrientationHoldState; path: string[] } {
  const candidate = canonicalizeOrientationAlg(candidateAlg);
  const committed = canonicalizeOrientationAlg(state.committed);
  if (candidate === committed) {
    return {
      state: {
        committed,
        pending: null,
        pendingSinceMs: nowMs,
      },
      path: [],
    };
  }
  if (state.pending !== candidate) {
    return {
      state: {
        committed,
        pending: candidate,
        pendingSinceMs: nowMs,
      },
      path: [],
    };
  }
  if (nowMs - state.pendingSinceMs < stableMs) {
    return { state, path: [] };
  }
  return {
    state: {
      committed: candidate,
      pending: null,
      pendingSinceMs: nowMs,
    },
    path: orientationRotationPath(committed, candidate),
  };
}

/**
 * 从 from 到 to 的最短整步转体序列（单次 x/y/z 及 2/'）。
 */
export function orientationRotationPath(
  fromAlg: string,
  toAlg: string,
): string[] {
  const start = canonicalizeOrientationAlg(fromAlg);
  const goal = canonicalizeOrientationAlg(toAlg);
  if (start === goal) {
    return [];
  }
  const queue: Array<{ alg: string; path: string[] }> = [
    { alg: start, path: [] },
  ];
  const seen = new Set<string>([start]);
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const move of ROTATION_MOVES) {
      const next = composeOrientationAlg(node.alg, move);
      if (seen.has(next)) {
        continue;
      }
      const path = [...node.path, move];
      if (next === goal) {
        return path;
      }
      seen.add(next);
      queue.push({ alg: next, path });
    }
  }
  return [];
}
