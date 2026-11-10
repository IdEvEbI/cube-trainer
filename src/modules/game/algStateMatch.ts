import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { isRotationGuideToken } from "../scramble/guided.ts";
import {
  CUBE_ORIENTATION_ALGS,
  invertRotationGuideToken,
} from "../score/cubeOrientation.ts";
import { remapGripTokenToPuzzleHint } from "./guideOrientation.ts";

/**
 * 引导/公式里的切片记号 → cubing.js 算法。
 * 白上绿前拧 M：前面出白条、顶面出蓝条（与 SiGN/cubing `M` 一致，跟 L）。
 * 此函数保留统一入口；当前 M/E/S 与 cubing 同向，原样返回。
 */
export function guideTokenToCubingAlg(token: string): string {
  return token.trim();
}

/** 把绝对 alg 中的 M/M' 按 {@link guideTokenToCubingAlg} 改写。 */
export function guideAlgToCubingAlg(alg: string): string {
  const trimmed = alg.trim();
  if (!trimmed) {
    return "";
  }
  try {
    return [...new Alg(trimmed).experimentalLeafMoves()]
      .map((leaf) => guideTokenToCubingAlg(leaf.toString()))
      .join(" ");
  } catch {
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map(guideTokenToCubingAlg)
      .join(" ");
  }
}

function centersAreIdentity(pattern: KPattern): boolean {
  return JSON.stringify(pattern.patternData.CENTERS.pieces) === "[0,1,2,3,4,5]";
}

/**
 * 把含 M/E/S / 宽层的状态转回「中心钉死」表示（整机旋转归位）。
 * 注意：这与实体固定色心「只动棱角、中心槽位不变」不同；蓝牙 facelets 应对 {@link nailFixedCenters}。
 */
export function restoreFixedCenters(pattern: KPattern): KPattern {
  if (centersAreIdentity(pattern)) {
    return pattern;
  }
  for (const alg of CUBE_ORIENTATION_ALGS) {
    if (alg === "") {
      continue;
    }
    const candidate = pattern.applyAlg(alg);
    if (centersAreIdentity(candidate)) {
      return candidate;
    }
  }
  return pattern;
}

/**
 * 求把 pattern 中心归位的整机转体（如 M 后为 x）。已归位则 ""。
 */
export function findRestoreOrientationAlg(pattern: KPattern): string {
  if (centersAreIdentity(pattern)) {
    return "";
  }
  for (const alg of CUBE_ORIENTATION_ALGS) {
    if (alg === "") {
      continue;
    }
    if (centersAreIdentity(pattern.applyAlg(alg))) {
      return alg;
    }
  }
  return "";
}

/** 整机转体串取逆：`x y'` → `y x'`。 */
export function invertOrientationAlg(alg: string): string {
  const tokens = alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(invertRotationGuideToken);
  return tokens.reverse().join(" ");
}

/**
 * 实体固定色心语义：切片 / 宽层在 cubing 里会带走中心，这里强行钉回中心槽位，
 * 保留角棱置换（不对整机做 x/y/z 重贴）。与蓝牙 facelets 同构。
 */
export function nailFixedCenters(pattern: KPattern): KPattern {
  if (centersAreIdentity(pattern)) {
    return pattern;
  }
  return new KPattern(pattern.kpuzzle, {
    CORNERS: pattern.patternData.CORNERS,
    EDGES: pattern.patternData.EDGES,
    CENTERS: {
      pieces: [0, 1, 2, 3, 4, 5],
      orientation: [0, 0, 0, 0, 0, 0],
      orientationMod: [1, 1, 1, 1, 1, 1],
    },
  });
}

/**
 * 3D 贴图：角棱用钉中心态，色心用 cubing raw（轨道顺序非 URFDLB）。
 * 白上绿前拧 M 后顶蓝前白，与实体一致；勿按 URFDLB 手写色心环。
 * 对表仍用 {@link nailFixedCenters} / facelets（中心字母钉死）。
 */
export function withRawSliceCenters(nailed: KPattern, raw: KPattern): KPattern {
  const base = nailFixedCenters(nailed);
  return new KPattern(base.kpuzzle, {
    CORNERS: base.patternData.CORNERS,
    EDGES: base.patternData.EDGES,
    CENTERS: {
      pieces: [...raw.patternData.CENTERS.pieces],
      orientation: [...raw.patternData.CENTERS.orientation],
      orientationMod: [
        ...(raw.patternData.CENTERS.orientationMod ?? [1, 1, 1, 1, 1, 1]),
      ],
    },
  });
}

function edgesCornersEqual(a: KPattern, b: KPattern): boolean {
  return (
    JSON.stringify(a.patternData.EDGES) ===
      JSON.stringify(b.patternData.EDGES) &&
    JSON.stringify(a.patternData.CORNERS) ===
      JSON.stringify(b.patternData.CORNERS)
  );
}

/**
 * 只比角块 / 棱块（先整机旋转归中心）。游戏页等仍用此路径。
 */
export function patternsMatchIgnoringCenters(
  a: KPattern,
  b: KPattern,
): boolean {
  return edgesCornersEqual(restoreFixedCenters(a), restoreFixedCenters(b));
}

/**
 * 实体固定色心对表：钉中心后只比角棱（不对整机旋转）。
 * 打乱引导 facelets 应用此路径。
 */
export function patternsMatchFixedCenters(a: KPattern, b: KPattern): boolean {
  return edgesCornersEqual(nailFixedCenters(a), nailFixedCenters(b));
}

/**
 * 比较两个 setupAlg 是否到达同一贴纸态（忽略等价写法；切片先归中心）。
 * 用于游戏页手动步（中层 / 宽层）自动确认。
 */
export async function algStatesMatch(
  setupA: string,
  setupB: string,
): Promise<boolean> {
  const a = setupA.trim();
  const b = setupB.trim();
  if (a === b) {
    return true;
  }
  const puzzle = await cube3x3x3.kpuzzle();
  const id = puzzle.defaultPattern();
  try {
    return patternsMatchIgnoringCenters(id.applyAlg(a), id.applyAlg(b));
  } catch {
    return false;
  }
}

/**
 * 公式前缀 → cubing 原始态（中层会带走色心）。
 * 部分蓝牙固件 facelets 等价于此态再整机归心，对表时与钉中心态并列。
 */
export async function expectedRawPattern(
  moves: readonly string[],
  count: number,
): Promise<KPattern> {
  const puzzle = await cube3x3x3.kpuzzle();
  const id = puzzle.defaultPattern();
  const prefix = nonRotationAlgPrefix(moves, count).trim();
  if (!prefix) {
    return id;
  }
  return id.applyAlg(prefix);
}

/**
 * 公式前缀 → 实体固定色心期望态（钉中心）。
 * `count` 为已包含的步数（完成到下标 count-1）。
 */
export async function expectedFixedCenterPattern(
  moves: readonly string[],
  count: number,
): Promise<KPattern> {
  return nailFixedCenters(await expectedRawPattern(moves, count));
}

/**
 * 3D 贴图用公式前缀（保留 x/y/z）：与非蓝牙 `twisty.alg` 播完同态。
 * 转体写入贴纸后 mesh 须锁单位朝向，勿再叠公式四元数。
 * `count` 为已包含的步数（完成到下标 count-1）。
 */
export function guidePaintAlgPrefix(
  moves: readonly string[],
  count: number,
): string {
  const truncated = Math.trunc(count);
  if (!Number.isFinite(truncated)) {
    throw new Error("guidePaintAlgPrefix: count must be a finite number");
  }
  const end = Math.max(0, Math.min(moves.length, truncated));
  return moves
    .slice(0, end)
    .map((token) => guideTokenToCubingAlg(token.trim()))
    .filter(Boolean)
    .join(" ");
}

/**
 * 公式前缀映成蓝牙绝对面转串（去掉整机转体，面/宽层/中层按已完成转体换算）。
 * `count` 为已包含的步数（与 guided.progress 对齐：完成到下标 count-1）。
 */
export function nonRotationAlgPrefix(
  moves: readonly string[],
  count: number,
): string {
  // NaN（如误传 GuidedScrambleView.progress）曾让循环零次 → 空串 → 3D 贴成还原态。
  const truncated = Math.trunc(count);
  if (!Number.isFinite(truncated)) {
    throw new Error("nonRotationAlgPrefix: count must be a finite number");
  }
  const end = Math.max(0, Math.min(moves.length, truncated));
  const orientation: string[] = [];
  const out: string[] = [];
  for (let i = 0; i < end; i += 1) {
    const token = moves[i]?.trim() ?? "";
    if (!token) {
      continue;
    }
    if (isRotationGuideToken(token)) {
      orientation.push(token);
      continue;
    }
    out.push(
      guideTokenToCubingAlg(remapGripTokenToPuzzleHint(token, orientation)),
    );
  }
  return out.join(" ");
}

/**
 * 引导进度对应的公式前缀是否与蓝牙贴纸态一致（固定色心、忽略整机转体写法）。
 * Cross 每步后用来发现「步数对了但状态已偏」。
 */
export async function guideProgressMatchesCube(
  flatMoves: readonly string[],
  progress: number,
  bleSetupAlg: string,
): Promise<boolean> {
  const end = Math.max(0, Math.min(flatMoves.length, Math.trunc(progress)));
  const prefix = flatMoves
    .slice(0, end)
    .map((token) => token.trim())
    .filter(Boolean)
    .join(" ");
  return algStatesMatch(prefix, bleSetupAlg.trim());
}
