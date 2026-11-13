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

/** 整机转体取逆：x↔x'，y↔y'，z↔z'；180° 不变。 */
export function invertRotationGuideToken(token: string): string {
  const match = /^([xyz])(2'|2|')?$/.exec(token.trim());
  if (!match) {
    return token.trim();
  }
  const axis = match[1]!;
  const suffix = match[2] ?? "";
  if (suffix === "2" || suffix === "2'") {
    return `${axis}2`;
  }
  if (suffix === "'") {
    return axis;
  }
  return `${axis}'`;
}

/**
 * 打乱引导转体是否到位（相对进入该步时的手持）。
 * x/y：真机跟箭头转一次常被记成逆步，用镜像判定。
 * z：面表四元数已取反；仍接受同轴另一四分之一（箭头 travelSign 与吸附偶发反向），
 * 避免跟箭头转一次却卡在 z' 无法进到 y。
 */
export function scrambleGuideRotationSatisfied(
  fromAlg: string,
  heldAlg: string,
  expectedMove: string,
): boolean {
  const expected = expectedMove.trim();
  const axis = expected[0];
  const matched = axis === "z" ? expected : invertRotationGuideToken(expected);
  if (orientationSatisfiesRotation(fromAlg, heldAlg, matched)) {
    return true;
  }
  if (axis === "z" && !/2/.test(expected)) {
    return orientationSatisfiesRotation(
      fromAlg,
      heldAlg,
      invertRotationGuideToken(matched),
    );
  }
  return false;
}

/**
 * 手持朝向是否已满足「从 from 起再做一个 expected 转体」。
 * - 允许到位后微调 y（z' 后偏航不应卡住）
 * - 允许同轴过冲到 *2（连续拧过 z' 停在 z2 仍算走过目标，否则公式卡死、
 *   画面跟陀螺仪顶绿，箭头随魔方转看起来像已经在提示 y）
 */
export function orientationSatisfiesRotation(
  fromAlg: string,
  toAlg: string,
  expectedMove: string,
): boolean {
  const expected = expectedMove.trim();
  if (!/^([xyz])(2'|2|')?$/.test(expected)) {
    return false;
  }
  const from = canonicalizeOrientationAlg(fromAlg);
  const held = canonicalizeOrientationAlg(toAlg);
  const target = canonicalizeOrientationAlg(
    [from, expected].filter((part) => part !== "").join(" "),
  );
  if (held === target) {
    return true;
  }
  // 到位后仅差 y / y' / y2：视为已完成该转体（打乱引导 z' 后偏航常见）。
  // 期望本身是偏航时禁用：未拧时 held=from、target=from+y，差值也是 y，会误判已到位并跳过 y。
  const expectedIsYaw =
    expected === "y" || expected === "y'" || expected === "y2";
  if (!expectedIsYaw) {
    const yawAfter = orientationRotationPath(target, held);
    if (
      yawAfter.length > 0 &&
      yawAfter.every((move) => move === "y" || move === "y'" || move === "y2")
    ) {
      return true;
    }
  }
  // z2 / x2 等：朝上色心到位即可（含提前翻转到位、或随后微调 y）。
  if (expected.endsWith("2") || expected.endsWith("2'")) {
    return facingAfterAlg(target).up === facingAfterAlg(held).up;
  }
  const path = orientationRotationPath(from, held);
  if (path.length > 0 && path[0] === expected) {
    return true;
  }
  // 同轴过冲：要 z' 却稳定在 z2（最短路写成一条 *2）
  const axis = expected[0]!;
  if (path.length === 1 && path[0] === `${axis}2`) {
    return true;
  }
  return false;
}

/**
 * 公式里截至 `progress`（含）的转体串，归一成 24 朝向之一。
 * 用于游戏页：当前步是转体时，看手持是否已到该目标朝向。
 */
export function orientationAlgThroughProgress(
  moves: readonly string[],
  progress: number,
): string {
  const end = Math.max(0, Math.min(moves.length, Math.trunc(progress) + 1));
  const rotations: string[] = [];
  for (let i = 0; i < end; i += 1) {
    const token = moves[i]?.trim() ?? "";
    if (/^([xyz])(2'|2|')?$/.test(token)) {
      rotations.push(token);
    }
  }
  return canonicalizeOrientationAlg(rotations.join(" "));
}

/** 手持是否已到达公式截至当前转体步的目标朝向。 */
export function heldMatchesRotationProgress(
  heldAlg: string,
  moves: readonly string[],
  progress: number,
): boolean {
  const token = moves[progress]?.trim() ?? "";
  if (!/^([xyz])(2'|2|')?$/.test(token)) {
    return false;
  }
  const target = orientationAlgThroughProgress(moves, progress);
  const held = canonicalizeOrientationAlg(heldAlg);
  if (held === target) {
    return true;
  }
  if (token.endsWith("2") || token.endsWith("2'")) {
    return facingAfterAlg(target).up === facingAfterAlg(held).up;
  }
  const prev = orientationAlgThroughProgress(moves, progress - 1);
  return orientationSatisfiesRotation(prev, held, token);
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
