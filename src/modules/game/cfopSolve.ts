/**
 * 游戏页：CFOP 分步解公式。
 *
 * 复原进入（F0 空）：
 * 1. 求解输入 = 打乱；白上共轭后 fixed 求解，Cross 前补 z2。
 * 2. 进页算一次；打乱跟完不重算。
 * 验证：打乱 · z2 · rest ≡ z2（黄上复原）。
 *
 * 未还原进入（只求解）：
 * 1. 求解输入 = 当前贴纸 F0；不叠打乱、不引导 z2。
 * 2. 内部按黄上绿前 CFOP 求解，Cross 内不补 z2；再映回进页色心朝向。
 * 3. 剪掉已还原后的多余段（避免只拧 U 却拆出多段 F2L）。
 * 验证：F0 · 解 ≡ 黄上/白上还原（自检忽略色心）。
 */

import { Alg } from "cubing/alg";
import { cfop } from "@moishy/cfop";
import { cube3x3x3 } from "cubing/puzzles";
import { joinAlgParts } from "../scramble/bluetoothSolve.ts";
import { isRotationGuideToken } from "../scramble/guided.ts";
import {
  orientationAlgFromCenterPieces,
  orientationRotationPath,
  warmOrientationCenterPieceMap,
  YELLOW_UP_GREEN_FRONT_ALG,
} from "../score/cubeOrientation.ts";
import { patternsMatchIgnoringCenters } from "./algStateMatch.ts";
import { coalesceWideMoves } from "./coalesceWideMoves.ts";
import { remapGripTokenToPuzzleHint } from "./guideOrientation.ts";

export const CFOP_PHASE_IDS = [
  "Cross",
  "F2L1",
  "F2L2",
  "F2L3",
  "F2L4",
  "OLL",
  "PLL",
] as const;

export type CfopPhaseId = (typeof CFOP_PHASE_IDS)[number];

export type CfopPhaseSolution = {
  id: CfopPhaseId;
  /** 该段公式记号（可含宽层 / 中层 / 转体）。Cross 段以 z2 开头。 */
  moves: string[];
};

type MoishyMove = {
  family: string;
  amount: number;
};

type MoishyPhase = {
  phaseId?: string;
  moves?: readonly MoishyMove[];
};

type MoishySegment = {
  unitId?: string;
  strategyId?: string;
  moves?: readonly MoishyMove[];
  phases?: readonly MoishyPhase[];
};

/** z2 共轭：层字母映射。 */
const Z2_FACE_FAMILY: Record<string, string> = {
  U: "D",
  D: "U",
  L: "R",
  R: "L",
  F: "F",
  B: "B",
  u: "d",
  d: "u",
  l: "r",
  r: "l",
  f: "f",
  b: "b",
  M: "M",
  E: "E",
  S: "S",
  x: "x",
  y: "y",
  z: "z",
};

/** z2 共轭下要取逆的轴（' ↔ 空，2 不变）。 */
const Z2_INVERT_AMOUNT = new Set(["M", "E", "x", "y"]);

export function moveToToken(move: MoishyMove): string {
  const { family, amount } = move;
  if (amount === 1) {
    return family;
  }
  if (amount === 2 || amount === -2) {
    return `${family}2`;
  }
  if (amount === 3 || amount === -1) {
    return `${family}'`;
  }
  if (amount === -3) {
    return family;
  }
  return `${family}${amount}`;
}

export function movesToTokens(
  moves: readonly MoishyMove[] | undefined,
): string[] {
  if (!moves || moves.length === 0) {
    return [];
  }
  return moves.map(moveToToken);
}

export function tokenizeAlg(alg: string): string[] {
  return alg
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * 单步经 z2 共轭：z2 · move · z2。
 * 用于把白上打乱映成黄上（白底）等价打乱。
 */
export function conjugateTokenByZ2(token: string): string {
  const raw = token.trim();
  if (!raw) {
    return raw;
  }
  const match = /^([A-Za-z])(2|')?$/.exec(raw);
  if (!match) {
    return raw;
  }
  const family = match[1]!;
  let suffix = match[2] ?? "";
  const mappedFamily = Z2_FACE_FAMILY[family] ?? family;
  if (Z2_INVERT_AMOUNT.has(family)) {
    if (suffix === "'") {
      suffix = "";
    } else if (suffix === "") {
      suffix = "'";
    }
  }
  return `${mappedFamily}${suffix}`;
}

export function conjugateScrambleForYellowUp(scramble: string): string {
  return tokenizeAlg(scramble).map(conjugateTokenByZ2).join(" ");
}

/** 用 cubing Alg 再展开一遍，避免库记号与播放层不一致；再合并可写成宽层的面+中层。 */
export function normalizeAlgTokens(tokens: readonly string[]): string[] {
  if (tokens.length === 0) {
    return [];
  }
  const parsed = [...new Alg(tokens.join(" ")).experimentalLeafMoves()].map(
    (move) => move.toString(),
  );
  return coalesceWideMoves(parsed);
}

/**
 * 将 @moishy/cfop 的 segments 映射为产品七段。
 * F2L：合并 setup + greedy 相位，避免漏掉 setup 里的转体 / 对槽。
 */
export function phasesFromCfopSegments(
  segments: readonly MoishySegment[],
): CfopPhaseSolution[] {
  const phases: CfopPhaseSolution[] = [];
  for (const segment of segments) {
    if (segment.unitId === "f2l") {
      let pair = 0;
      let pendingSetup: string[] = [];
      for (const phase of segment.phases ?? []) {
        const phaseId = String(phase.phaseId ?? "");
        const tokens = normalizeAlgTokens(movesToTokens(phase.moves));
        if (phaseId.toLowerCase().includes("setup")) {
          pendingSetup = pendingSetup.concat(tokens);
          continue;
        }
        pair += 1;
        if (pair > 4) {
          break;
        }
        phases.push({
          id: `F2L${pair}` as CfopPhaseId,
          moves: pendingSetup.concat(tokens),
        });
        pendingSetup = [];
      }
      if (pendingSetup.length > 0 && phases.length > 0) {
        const last = phases[phases.length - 1]!;
        last.moves = last.moves.concat(pendingSetup);
      }
      while (pair < 4) {
        pair += 1;
        phases.push({ id: `F2L${pair}` as CfopPhaseId, moves: [] });
      }
      continue;
    }
    if (segment.unitId === "cross") {
      phases.push({
        id: "Cross",
        moves: normalizeAlgTokens(movesToTokens(segment.moves)),
      });
      continue;
    }
    if (segment.unitId === "oll") {
      phases.push({
        id: "OLL",
        moves: normalizeAlgTokens(movesToTokens(segment.moves)),
      });
      continue;
    }
    if (segment.unitId === "pll") {
      phases.push({
        id: "PLL",
        moves: normalizeAlgTokens(movesToTokens(segment.moves)),
      });
    }
  }
  return phases;
}

/** Cross 段公式前加上 z2（若尚未以 z2 开头）。 */
export function mergeZ2IntoCross(
  phases: readonly CfopPhaseSolution[],
): CfopPhaseSolution[] {
  const next = phases.map((phase) => ({
    id: phase.id,
    moves: [...phase.moves],
  }));
  const cross = next.find((phase) => phase.id === "Cross");
  if (cross) {
    if (cross.moves[0] !== "z2") {
      cross.moves = ["z2", ...cross.moves];
    }
    return next;
  }
  return [{ id: "Cross", moves: ["z2"] }, ...next];
}

/**
 * Cross（及任意段）HTM：非转体记号条数；`R2` / `r2` / `M2` 各计 1，不含 x/y/z。
 */
export function countPhaseHtm(moves: readonly string[]): number {
  let n = 0;
  for (const token of moves) {
    const trimmed = token.trim();
    if (!trimmed || isRotationGuideToken(trimmed)) {
      continue;
    }
    n += 1;
  }
  return n;
}

/** 进页 F0 与打乱串拼成求解输入。 */
export function composeSetupScramble(
  setupAlg: string,
  scramble: string,
): string {
  return joinAlgParts(setupAlg.trim(), tokenizeAlg(scramble));
}

/** 进页贴纸是否已还原（只比棱角；空串视为复原进入）。 */
export async function isSetupRestoredIgnoringCenters(
  setupAlg: string,
): Promise<boolean> {
  const trimmed = setupAlg.trim();
  if (trimmed === "") {
    return true;
  }
  const puzzle = await cube3x3x3.kpuzzle();
  const identity = puzzle.defaultPattern();
  try {
    const pat = identity.applyAlg(trimmed);
    return (
      patternsMatchIgnoringCenters(pat, identity) ||
      patternsMatchIgnoringCenters(pat, identity.applyAlg("z2"))
    );
  } catch {
    return false;
  }
}

function stripLeadingZ2FromCross(
  phases: readonly CfopPhaseSolution[],
): CfopPhaseSolution[] {
  return phases.map((phase) => {
    if (phase.id !== "Cross" || phase.moves[0] !== "z2") {
      return { id: phase.id, moves: [...phase.moves] };
    }
    return { id: phase.id, moves: phase.moves.slice(1) };
  });
}

export type CfopGameSolveOk = {
  ok: true;
  phases: CfopPhaseSolution[];
  /** F0 · 打乱（进页求解输入）。 */
  solveInput: string;
  prependedZ2: boolean;
};

export type CfopGameSolveFail = {
  ok: false;
  phases: [];
  solveInput: string;
  reason: string;
};

/**
 * 复原进入求解：输入 F0 · 打乱（F0 通常为空）；成功则分段公式固定，打乱跟完不重算。
 */
export async function trySolveCfopGame(
  scramble: string,
  setupAlg = "",
): Promise<CfopGameSolveOk | CfopGameSolveFail> {
  const trimmed = scramble.trim();
  const solveInput = composeSetupScramble(setupAlg, trimmed);
  if (trimmed === "") {
    return { ok: false, phases: [], solveInput, reason: "打乱是空的" };
  }

  const puzzle = await cube3x3x3.kpuzzle();
  const identity = puzzle.defaultPattern();
  const yellowUpSolved = identity.applyAlg("z2");
  let scrambledPat;
  try {
    scrambledPat = identity.applyAlg(solveInput);
  } catch {
    return {
      ok: false,
      phases: [],
      solveInput,
      reason: "无法解析 F0 · 打乱",
    };
  }

  const alreadyYellowUp =
    scrambledPat.patternData.CENTERS.pieces[0] ===
    yellowUpSolved.patternData.CENTERS.pieces[0];

  const yellowUpScramble = conjugateScrambleForYellowUp(solveInput);
  if (yellowUpScramble === "") {
    return { ok: false, phases: [], solveInput, reason: "打乱是空的" };
  }

  const result = await cfop.solve(yellowUpScramble, {
    colorNeutrality: "fixed",
  });
  if (!result.solved) {
    return { ok: false, phases: [], solveInput, reason: "CFOP 求解未完成" };
  }
  let solvePhases = phasesFromCfopSegments(
    result.segments as readonly MoishySegment[],
  );
  if (solvePhases.length === 0) {
    return { ok: false, phases: [], solveInput, reason: "CFOP 求解无分段" };
  }

  const prependedZ2 = !alreadyYellowUp;
  solvePhases = prependedZ2
    ? mergeZ2IntoCross(solvePhases)
    : stripLeadingZ2FromCross(solvePhases);

  const solution = solvePhases.flatMap((phase) => phase.moves).join(" ");
  let after;
  try {
    after =
      solution.trim() === "" ? scrambledPat : scrambledPat.applyAlg(solution);
  } catch {
    return {
      ok: false,
      phases: [],
      solveInput,
      reason: "还原公式无法应用",
    };
  }

  // 中层/宽层在 cubing 模型里会带走色心；实体固定色心，自检忽略中心整机转。
  const restored =
    patternsMatchIgnoringCenters(after, yellowUpSolved) ||
    patternsMatchIgnoringCenters(after, identity);
  if (!restored) {
    return {
      ok: false,
      phases: [],
      solveInput,
      reason: "解法跑完未到还原态",
    };
  }

  return {
    ok: true,
    phases: solvePhases,
    solveInput,
    prependedZ2,
  };
}

export type CfopGameUnsolvedOk = {
  ok: true;
  phases: CfopPhaseSolution[];
  /** 当前贴纸 F0（不叠打乱）。 */
  solveInput: string;
  /** 未还原路径不跟打乱。 */
  scrambleMoves: [];
  /** 未还原不引导整机转体（勿输出 z2 朝向步）。 */
  orientationMoves: [];
};

export type CfopGameUnsolvedFail = {
  ok: false;
  phases: [];
  solveInput: string;
  scrambleMoves: [];
  orientationMoves: [];
  reason: string;
};

/**
 * 黄上 CFOP 解映回进页色心朝向（用「当前→黄上绿前」桥接转体共轭），
 * 这样不用引导 z2，公式可直接叠在 F0 上。
 */
export function mapYellowUpPhasesToSetupOrientation(
  phases: readonly CfopPhaseSolution[],
  fromOrientAlg: string,
): CfopPhaseSolution[] {
  const bridge = orientationRotationPath(
    fromOrientAlg,
    YELLOW_UP_GREEN_FRONT_ALG,
  );
  if (bridge.length === 0) {
    return phases.map((phase) => ({
      id: phase.id,
      moves: [...phase.moves],
    }));
  }
  return phases.map((phase) => ({
    id: phase.id,
    moves: phase.moves.map((token) =>
      remapGripTokenToPuzzleHint(token, bridge),
    ),
  }));
}

type PatternLike = {
  applyAlg: (alg: string) => PatternLike;
};

/**
 * 只保留应用到 setup 后首次还原所需的段；丢掉多余空段 / 多余 F2L。
 */
export function prunePhasesUntilRestored(
  setupPat: PatternLike,
  phases: readonly CfopPhaseSolution[],
  isRestored: (pat: PatternLike) => boolean,
): CfopPhaseSolution[] {
  let pat = setupPat;
  const kept: CfopPhaseSolution[] = [];
  for (const phase of phases) {
    if (phase.moves.length === 0) {
      continue;
    }
    kept.push({ id: phase.id, moves: [...phase.moves] });
    const chunk = phase.moves.join(" ").trim();
    if (chunk !== "") {
      pat = pat.applyAlg(chunk);
    }
    if (isRestored(pat)) {
      return kept;
    }
  }
  return kept;
}

/**
 * 未还原进入：只对当前贴纸 F0 求解；无打乱段；不引导 z2；
 * 黄上求解后映回当前朝向，并剪掉已还原后的多余段。
 */
export async function trySolveCfopGameUnsolved(
  setupAlg: string,
): Promise<CfopGameUnsolvedOk | CfopGameUnsolvedFail> {
  const solveInput = setupAlg.trim();
  const fail = (reason: string): CfopGameUnsolvedFail => ({
    ok: false,
    phases: [],
    solveInput,
    scrambleMoves: [],
    orientationMoves: [],
    reason,
  });
  if (solveInput === "") {
    return fail("进页态为空");
  }

  const puzzle = await cube3x3x3.kpuzzle();
  const identity = puzzle.defaultPattern();
  warmOrientationCenterPieceMap((alg) => {
    const pat = alg.trim() === "" ? identity : identity.applyAlg(alg);
    return pat.patternData.CENTERS.pieces;
  });
  const yellowUpSolved = identity.applyAlg(YELLOW_UP_GREEN_FRONT_ALG);
  let scrambledPat;
  try {
    scrambledPat = identity.applyAlg(solveInput);
  } catch {
    return fail("无法解析进页贴纸");
  }

  const yellowUpScramble = conjugateScrambleForYellowUp(solveInput);
  if (yellowUpScramble === "") {
    return fail("进页态为空");
  }

  const result = await cfop.solve(yellowUpScramble, {
    colorNeutrality: "fixed",
  });
  if (!result.solved) {
    return fail("CFOP 求解未完成");
  }
  let solvePhases = phasesFromCfopSegments(
    result.segments as readonly MoishySegment[],
  );
  if (solvePhases.length === 0) {
    return fail("CFOP 求解无分段");
  }
  // 未还原：Cross 从黄上绿前起，禁止把 z2 并进 Cross。
  solvePhases = stripLeadingZ2FromCross(solvePhases);

  const fromOrient = orientationAlgFromCenterPieces(
    scrambledPat.patternData.CENTERS.pieces,
  );
  solvePhases = mapYellowUpPhasesToSetupOrientation(solvePhases, fromOrient);

  const isRestored = (pat: PatternLike): boolean => {
    const p = pat as typeof scrambledPat;
    return (
      patternsMatchIgnoringCenters(p, yellowUpSolved) ||
      patternsMatchIgnoringCenters(p, identity)
    );
  };
  solvePhases = prunePhasesUntilRestored(scrambledPat, solvePhases, isRestored);

  const solution = solvePhases
    .flatMap((p) => p.moves)
    .join(" ")
    .trim();
  let after;
  try {
    after = solution === "" ? scrambledPat : scrambledPat.applyAlg(solution);
  } catch {
    return fail("还原公式无法应用");
  }
  if (!isRestored(after)) {
    return fail("解法跑完未到还原态");
  }

  return {
    ok: true,
    phases: solvePhases,
    solveInput,
    scrambleMoves: [],
    orientationMoves: [],
  };
}

/**
 * 游戏还原公式（默认 F0 空 = 从复原进入）。
 * Cross 保留宽层 / 中层（不再展开成面转）。
 */
export async function solveCfopGame(
  scramble: string,
  setupAlg = "",
): Promise<CfopPhaseSolution[]> {
  const result = await trySolveCfopGame(scramble, setupAlg);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.phases;
}
