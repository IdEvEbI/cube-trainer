/**
 * 游戏页：CFOP 分步解公式。
 *
 * 思路（与产品朝向一致）：
 * 1. 打乱在白上绿前；
 * 2. 还原先 z2 → 黄上白下绿前，并入 Cross 段公式前缀；
 * 3. 把原打乱经 z2 共轭，得到「白底下的等价打乱」，再 @moishy/cfop fixed 求解
 *    （输出在黄上握持帧，不是白上绿前）；
 * 4. Cross 段把宽层 / 中层展开成固定色心面转，便于蓝牙逐步上报；
 * 5. 展示：打乱 + Cross（含 z2，面转）+ F2L1–4 + OLL + PLL（后段暂不展开）。
 *
 * 验证：scramble · z2 · rest ≡ z2（黄上复原）。
 */

import { Alg } from "cubing/alg";
import { cfop } from "@moishy/cfop";
import { coalesceWideMoves } from "./coalesceWideMoves.ts";
import { expandCrossPhaseToFaceMoves } from "./crossFaceExpand.ts";

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
 * 游戏还原公式：对「白底等价打乱」的 CFOP 解；z2 并入 Cross；
 * Cross 段宽层 / 中层再展开成固定色心面转（蓝牙可逐步上报）。
 * F2L 及后续段暂不展开。
 */
export async function solveCfopGame(
  scramble: string,
): Promise<CfopPhaseSolution[]> {
  const trimmed = scramble.trim();
  if (trimmed === "") {
    throw new Error("打乱是空的");
  }
  const yellowUpScramble = conjugateScrambleForYellowUp(trimmed);
  if (yellowUpScramble === "") {
    throw new Error("打乱是空的");
  }
  const result = await cfop.solve(yellowUpScramble, {
    colorNeutrality: "fixed",
  });
  if (!result.solved) {
    throw new Error("CFOP 求解未完成");
  }
  const solvePhases = phasesFromCfopSegments(
    result.segments as readonly MoishySegment[],
  );
  if (solvePhases.length === 0) {
    throw new Error("CFOP 求解无分段");
  }
  const withZ2 = mergeZ2IntoCross(solvePhases);
  return expandCrossPhaseToFaceMoves(trimmed, withZ2);
}
