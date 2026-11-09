import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { patternFromSetup } from "../scramble/bluetoothSolve.ts";

export { patternFromSetup };

/** CFOP 分段 id（基础版）。 */
export type CfopPhaseId =
  | "cross"
  | "f2l1"
  | "f2l2"
  | "f2l3"
  | "f2l4"
  | "oll"
  | "pll";

export const CFOP_PHASE_ORDER: readonly CfopPhaseId[] = [
  "cross",
  "f2l1",
  "f2l2",
  "f2l3",
  "f2l4",
  "oll",
  "pll",
] as const;

export const CFOP_PHASE_LABELS: Record<CfopPhaseId, string> = {
  cross: "Cross",
  f2l1: "F2L 1",
  f2l2: "F2L 2",
  f2l3: "F2L 3",
  f2l4: "F2L 4",
  oll: "OLL",
  pll: "PLL",
};

/**
 * 24 种整体朝向（把任意心转到 D，再绕 D 转 4 次）。
 * 用于识别「手持转体后」的底层十字，不依赖白心固定在 D。
 */
const CUBE_ORIENTATIONS: readonly string[] = [
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
  "x2",
  "x2 y",
  "x2 y2",
  "x2 y'",
  "z",
  "z y",
  "z y2",
  "z y'",
  "z'",
  "z' y",
  "z' y2",
  "z' y'",
];

/** D 层十字棱位：DF DR DB DL。 */
const D_EDGE_SLOTS = [4, 5, 6, 7] as const;
/** F2L 槽：角 + 棱。 */
const F2L_SLOTS: ReadonlyArray<{ corner: number; edge: number }> = [
  { corner: 4, edge: 8 }, // FR
  { corner: 5, edge: 9 }, // FL
  { corner: 6, edge: 11 }, // BL
  { corner: 7, edge: 10 }, // BR
];
const U_EDGE_SLOTS = [0, 1, 2, 3] as const;
const U_CORNER_SLOTS = [0, 1, 2, 3] as const;

async function identityPattern(): Promise<KPattern> {
  const puzzle = await cube3x3x3.kpuzzle();
  return puzzle.defaultPattern();
}

function centersEqual(a: KPattern, b: KPattern): boolean {
  const ca = a.patternData.CENTERS?.pieces;
  const cb = b.patternData.CENTERS?.pieces;
  if (!ca || !cb || ca.length !== cb.length) {
    return false;
  }
  for (let i = 0; i < ca.length; i += 1) {
    if (ca[i] !== cb[i]) {
      return false;
    }
  }
  return true;
}

/** 把复原态转到与当前魔方相同的中心朝向，作位置参照。 */
export function referenceWithSameCenters(
  identity: KPattern,
  pattern: KPattern,
): KPattern | null {
  for (const rot of CUBE_ORIENTATIONS) {
    const ref = rot === "" ? identity : identity.applyAlg(rot);
    if (centersEqual(ref, pattern)) {
      return ref;
    }
  }
  return null;
}

function piecesMatch(
  current: { pieces: number[]; orientation: number[] },
  reference: { pieces: number[]; orientation: number[] },
  slots: readonly number[],
): boolean {
  for (const slot of slots) {
    if (
      current.pieces[slot] !== reference.pieces[slot] ||
      current.orientation[slot] !== reference.orientation[slot]
    ) {
      return false;
    }
  }
  return true;
}

/** Cross：底层（当前朝向下的 D）4 条棱位置与朝向正确。 */
function hasCross(pattern: KPattern, reference: KPattern): boolean {
  return piecesMatch(
    pattern.patternData.EDGES!,
    reference.patternData.EDGES!,
    D_EDGE_SLOTS,
  );
}

function countSolvedF2lSlots(pattern: KPattern, reference: KPattern): number {
  const corners = pattern.patternData.CORNERS!;
  const edges = pattern.patternData.EDGES!;
  const refC = reference.patternData.CORNERS!;
  const refE = reference.patternData.EDGES!;
  let n = 0;
  for (const slot of F2L_SLOTS) {
    if (
      corners.pieces[slot.corner] === refC.pieces[slot.corner] &&
      corners.orientation[slot.corner] === refC.orientation[slot.corner] &&
      edges.pieces[slot.edge] === refE.pieces[slot.edge] &&
      edges.orientation[slot.edge] === refE.orientation[slot.edge]
    ) {
      n += 1;
    }
  }
  return n;
}

/**
 * OLL：顶面朝向完成（顶层角/棱朝向多重集与复原一致 → 顶面同色），
 * 不要求顶层排列。
 */
function hasOll(pattern: KPattern, reference: KPattern): boolean {
  if (
    !hasCross(pattern, reference) ||
    countSolvedF2lSlots(pattern, reference) < 4
  ) {
    return false;
  }
  const corners = pattern.patternData.CORNERS!;
  const edges = pattern.patternData.EDGES!;
  const refC = reference.patternData.CORNERS!;
  const refE = reference.patternData.EDGES!;
  const co = U_CORNER_SLOTS.map((i) => corners.orientation[i]!)
    .sort((a, b) => a - b)
    .join(",");
  const refCo = U_CORNER_SLOTS.map((i) => refC.orientation[i]!)
    .sort((a, b) => a - b)
    .join(",");
  const eo = U_EDGE_SLOTS.map((i) => edges.orientation[i]!)
    .sort((a, b) => a - b)
    .join(",");
  const refEo = U_EDGE_SLOTS.map((i) => refE.orientation[i]!)
    .sort((a, b) => a - b)
    .join(",");
  return co === refCo && eo === refEo;
}

function isFullySolved(pattern: KPattern): boolean {
  return pattern.experimentalIsSolved({
    ignorePuzzleOrientation: true,
    ignoreCenterOrientation: true,
  });
}

/**
 * 当前状态最高 CFOP 阶段：0=Cross … 6=PLL；未完成 Cross 为 -1。
 * 会尝试 24 朝向，以匹配手持转体后的底层。
 */
export function cfopStageIndex(pattern: KPattern, identity: KPattern): number {
  if (isFullySolved(pattern)) {
    return 6;
  }

  let best = -1;
  for (const rot of CUBE_ORIENTATIONS) {
    const oriented = rot === "" ? pattern : pattern.applyAlg(rot);
    const reference = referenceWithSameCenters(identity, oriented);
    if (!reference || !hasCross(oriented, reference)) {
      continue;
    }
    let stage = 0;
    const f2l = countSolvedF2lSlots(oriented, reference);
    if (f2l >= 1) {
      stage = Math.min(4, f2l); // 1..4 → f2l1..f2l4；0 pairs 停在 cross
    }
    if (f2l === 4) {
      stage = 4;
      if (hasOll(oriented, reference)) {
        stage = 5;
      }
    }
    if (stage > best) {
      best = stage;
    }
    if (best >= 5) {
      break;
    }
  }
  return best;
}

/**
 * 更新阶段结束下标。
 * - 首次从 -1 达成：0..stage 均记为当前步数（Cross 吸收此前步数；同刻完成的更高阶段为 0 步）。
 * - 后续推进：跳过的中间阶段与前一阶段同界；新阶段记当前步数。
 */
export function assignPhaseEndsOnAdvance(
  ends: number[],
  reached: number,
  stage: number,
  moveCount: number,
): number {
  if (stage <= reached) {
    return reached;
  }
  if (reached < 0) {
    for (let s = 0; s <= stage; s += 1) {
      ends[s] = moveCount;
    }
    return stage;
  }
  let nextReached = reached;
  while (nextReached < stage) {
    nextReached += 1;
    const prevEnd = ends[nextReached - 1]!;
    if (nextReached === stage) {
      ends[nextReached] = moveCount;
    } else {
      ends[nextReached] = prevEnd;
    }
  }
  return nextReached;
}

/**
 * 按魔方状态切分：返回每个阶段结束时的 move 数量（长度 7）。
 * 不做步数均分；手持转体通过 24 朝向识别底层十字。
 */
export async function splitCfopPhaseEnds(
  startSetupAlg: string,
  solveMoves: readonly string[],
): Promise<number[]> {
  const identity = await identityPattern();
  const ends = CFOP_PHASE_ORDER.map(() => 0);
  let pattern = await patternFromSetup(startSetupAlg, []);
  // 开表时已完成的阶段记在 0 步界，后续步数归下一阶段。
  let reached = cfopStageIndex(pattern, identity);
  if (reached >= 0) {
    for (let s = 0; s <= reached; s += 1) {
      ends[s] = 0;
    }
  }

  for (let i = 0; i < solveMoves.length; i += 1) {
    const token = solveMoves[i]!.trim();
    if (token !== "") {
      pattern = pattern.applyAlg(token);
    }
    const stage = cfopStageIndex(pattern, identity);
    if (stage < 0) {
      continue;
    }
    reached = assignPhaseEndsOnAdvance(ends, reached, stage, i + 1);
    if (stage >= 6) {
      ends[6] = i + 1;
      reached = 6;
      break;
    }
  }

  if (reached >= 0 && reached < 6 && solveMoves.length > 0) {
    // 已识别部分阶段但未到 PLL：剩余步数并入下一未完成阶段起至 PLL
    const tailFrom = reached + 1;
    for (let j = tailFrom; j < ends.length; j += 1) {
      ends[j] = solveMoves.length;
    }
  } else if (reached < 0 && solveMoves.length > 0) {
    // 全程未识别 Cross：全部记入 PLL，避免误记 Cross
    for (let j = 0; j < ends.length - 1; j += 1) {
      ends[j] = 0;
    }
    ends[6] = solveMoves.length;
  }

  return ends;
}
