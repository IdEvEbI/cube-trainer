/**
 * 宽层 / 中层与真机对偶：对面包 + 期望陀螺 Δ。
 *
 * 3D：过程中一步 scrub 宽层/中层记号，到位后**保持**该 alg（勿再钉成对面包，
 * 否则 setAbsoluteAlg 闪切抖动）；mesh 锁单位（勿把 Δ 打进 mesh，否则 U' 高亮跑到背面像 B'）。
 * 对表：已完成层转的 Δ 用于把 BLE 色心面转映回公式帧（`absoluteFaceMoveToGrip`）。
 */

import {
  expectedBurstMovesForLayer,
  expectedGyroDeltaAlg,
  parseLayerGestureToken,
} from "../bluetooth/moyu/moyuLayerGesture.ts";
import { invertRotationGuideToken } from "../score/cubeOrientation.ts";
import { absoluteFaceMoveToGrip } from "../score/solveAlgDisplay.ts";

export type LayerDualParts = {
  /** 固件同构外层包（宽层对面；中层多重集顺序）。 */
  outerMoves: string[];
  /** {@link expectedGyroDeltaAlg} 吸附串。 */
  orientationAlg: string;
};

/** 单步层转 → 对偶；非层转返回 null。 */
export function layerTokenDualParts(token: string): LayerDualParts | null {
  const parsed = parseLayerGestureToken(token);
  if (!parsed) {
    return null;
  }
  const outerMoves = expectedBurstMovesForLayer(token);
  const orientationAlg = expectedGyroDeltaAlg(token);
  if (!outerMoves?.length || !orientationAlg) {
    return null;
  }
  return { outerMoves, orientationAlg };
}

/**
 * 已完成前缀中层转期望 Δ 的拼接（不含公式 x/y/z）。
 * `count`：完成到下标 count-1。
 */
export function guideLayerGyroOrientationAlg(
  moves: readonly string[],
  count: number,
): string {
  const truncated = Math.trunc(count);
  if (!Number.isFinite(truncated)) {
    throw new Error(
      "guideLayerGyroOrientationAlg: count must be a finite number",
    );
  }
  const end = Math.max(0, Math.min(moves.length, truncated));
  const parts: string[] = [];
  for (let i = 0; i < end; i += 1) {
    const dual = layerTokenDualParts(moves[i] ?? "");
    if (!dual) {
      continue;
    }
    for (const part of dual.orientationAlg.split(/\s+/).filter(Boolean)) {
      parts.push(part);
    }
  }
  return parts.join(" ");
}

/**
 * 最近一次已完成层转的期望**陀螺** Δ（单步）。
 * 手势匹配仍用陀螺表；映面勿只靠 Last——`r' b'` 会丢掉 `r'` 色心分量（#160）。
 */
export function guideLayerGyroOrientationAlgLast(
  moves: readonly string[],
  count: number,
): string {
  const truncated = Math.trunc(count);
  if (!Number.isFinite(truncated)) {
    throw new Error(
      "guideLayerGyroOrientationAlgLast: count must be a finite number",
    );
  }
  const end = Math.max(0, Math.min(moves.length, truncated));
  for (let i = end - 1; i >= 0; i -= 1) {
    const dual = layerTokenDualParts(moves[i] ?? "");
    if (dual) {
      return dual.orientationAlg.trim();
    }
  }
  return "";
}

/**
 * 层转在 Twisty 公式里的色心等价 Δ（与 {@link expectedGyroDeltaAlg} 对照）：
 * - `r/l/u/d/M/E` 族：色心 ≡ invert(陀螺)（例：`r'` 陀螺 `x`、色心 `x'`；`M'` 陀螺 `x'`、色心 `x`）
 * - `f/b/S` 族：与陀螺同向
 * - 含 `2` 的双步：与陀螺一致（如 `r2`→`z2 y2`）
 *
 * 3D `setAbsoluteAlg` 跟公式色心；映面须用本函数累积，禁止 poll 贴图拧回黄上。
 */
export function expectedFormulaCenterDeltaAlg(token: string): string | null {
  const gyro = expectedGyroDeltaAlg(token)?.trim() ?? "";
  if (!gyro) {
    return null;
  }
  const parsed = parseLayerGestureToken(token);
  if (!parsed) {
    return null;
  }
  const family = parsed.family;
  // f/b/S：公式色心与陀螺同向
  if (family === "f" || family === "b" || family === "S") {
    return gyro;
  }
  // 双步（陀螺已是 z2 y2 / y2 / z2）：与色心一致
  if (/2/.test(gyro)) {
    return gyro;
  }
  // r/l/u/d/M/E 四分之一：色心 = 陀螺取反
  return gyro
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => invertRotationGuideToken(part))
    .join(" ");
}

/**
 * 已完成层转的**公式色心** Δ 累积（对齐 Twisty 中心，供 BLE 映面）。
 * 例：`z2 r' b'` → `x' z`（不是 Last 陀螺 `z`）。
 */
export function guideLayerCenterOrientationAlg(
  moves: readonly string[],
  count: number,
): string {
  const truncated = Math.trunc(count);
  if (!Number.isFinite(truncated)) {
    throw new Error(
      "guideLayerCenterOrientationAlg: count must be a finite number",
    );
  }
  const end = Math.max(0, Math.min(moves.length, truncated));
  const parts: string[] = [];
  for (let i = 0; i < end; i += 1) {
    const delta = expectedFormulaCenterDeltaAlg(moves[i] ?? "");
    if (!delta) {
      continue;
    }
    for (const part of delta.split(/\s+/).filter(Boolean)) {
      parts.push(part);
    }
  }
  return parts.join(" ");
}

/**
 * BLE 色心面转 → 公式帧（经朝向串）。
 * `orientationAlg` 为空或非面转时原样返回。
 */
export function remapBleFaceMoveThroughOrientationAlg(
  bleMove: string,
  orientationAlg: string,
): string {
  const orient = orientationAlg.trim();
  const raw = bleMove.trim();
  if (!orient || !/^[URFDLB](?:2|')?$/i.test(raw)) {
    return raw;
  }
  return absoluteFaceMoveToGrip(raw, orient.split(/\s+/).filter(Boolean));
}

/**
 * 引导面转采纳：色心包原样已对上期望则不映（避免 live `y` 噪声把真 L 映成 F）；
 * 否则按朝向映回公式帧（未摆正时空间面 ≠ 色心面，如 r 后顶面 F'→U'）。
 */
export function resolveGuideBleFaceMove(
  bleMove: string,
  expectedToken: string | null | undefined,
  orientationAlg: string,
): string {
  const raw = bleMove.trim();
  if (!/^[URFDLB](?:2|')?$/i.test(raw)) {
    return raw;
  }
  const expected = (expectedToken ?? "").trim();
  const remapped = remapBleFaceMoveThroughOrientationAlg(raw, orientationAlg);
  if (!expected || !/^[URFDLB](?:2|')?$/i.test(expected)) {
    return remapped;
  }
  // 四分之一：色心字母已对上期望时优先原样（避 live y 噪声 L→F）。
  // 但朝向含 z2（黄上公式）时禁止：色心 R' 字面等于握持 R' 实为对面，
  // 原样采纳会把绝对 R' 当成握持 R'，纠错链也会被后续脏候选收成「请转 L」。
  if (!/[2]/.test(expected)) {
    const yellowUp = /\bz2'?\b/.test(orientationAlg);
    if (raw === expected && !yellowUp) {
      return raw;
    }
    if (remapped === expected) {
      return remapped;
    }
    return remapped;
  }
  // 双步：先比色心面字母（R2 半步只来色心 R/R'）。
  const expFace = expected[0]!.toUpperCase();
  if (raw[0]!.toUpperCase() === expFace) {
    return raw;
  }
  if (remapped[0]!.toUpperCase() === expFace) {
    return remapped;
  }
  return remapped;
}

/**
 * BLE 色心面转 → 公式帧（经已完成层转**期望** Δ）。
 * 长序列易与真机漂移；引导面转优先
 * {@link resolveGuideBleFaceMove} + live 朝向。
 */
export function remapBleFaceMoveAfterLayerGyro(
  bleMove: string,
  moves: readonly string[],
  progress: number,
): string {
  return remapBleFaceMoveThroughOrientationAlg(
    bleMove,
    guideLayerGyroOrientationAlg(moves, progress),
  );
}
