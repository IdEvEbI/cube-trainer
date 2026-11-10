import {
  IDENTITY_QUAT,
  quatInvert,
  quatMultiply,
  quatNormalize,
  type MoyuQuat,
} from "../bluetooth/moyu/orientation.ts";
import { isRotationGuideToken } from "../scramble/guided.ts";
import { quatFromOrientationAlg } from "../score/cubeOrientation.ts";
import { absoluteFaceMoveToGrip } from "../score/solveAlgDisplay.ts";
import { remapFaceMoveThroughOrientation } from "../score/solveTrace.ts";

/**
 * 转体步跟手：相对进入该步时的手持增量。
 * 贴纸已含此前公式转体时，mesh 只乘此增量，避免与 z'/y 贴纸叠乘。
 */
export function relativeOrientationQuat(
  fromQuat: MoyuQuat,
  liveQuat: MoyuQuat,
): MoyuQuat {
  return quatNormalize(quatMultiply(quatInvert(fromQuat), liveQuat));
}

/**
 * 公式中截至 progress（不含当前步）已完成的转体，供握持↔绝对换算。
 */
export function completedOrientationMoves(
  moves: readonly string[],
  progress: number,
): string[] {
  const truncated = Math.trunc(progress);
  if (!Number.isFinite(truncated)) {
    throw new Error(
      "completedOrientationMoves: progress must be a finite number",
    );
  }
  const end = Math.max(0, Math.min(moves.length, truncated));
  return moves
    .slice(0, end)
    .map((token) => token.trim())
    .filter((token) => isRotationGuideToken(token));
}

/**
 * 跟转 3D 朝向：默认锁到公式已完成转体（打乱白上、z2 后黄上）。
 * 打乱引导转体步：仅当 `rotationStarted`（已离开步起点）时跟 `liveQuat`；
 * 静置时锁公式，避免陀螺仪漂移把 B' 终态顶心从蓝拧成橙。
 */
export function guideDisplayOrientationQuat(
  formulaOrients: readonly string[],
  options: {
    onRotationStep: boolean;
    liveQuat: MoyuQuat | null;
    /** 转体步是否已离开登记起点；默认 true（跟手）。 */
    rotationStarted?: boolean;
  },
): MoyuQuat {
  const followLive =
    options.onRotationStep &&
    options.liveQuat &&
    options.rotationStarted !== false;
  if (followLive && options.liveQuat) {
    return options.liveQuat;
  }
  if (formulaOrients.length === 0) {
    return IDENTITY_QUAT;
  }
  return quatFromOrientationAlg(formulaOrients.join(" "));
}

const SLICE_AXIS_FACE: Record<"M" | "E" | "S", string> = {
  M: "R",
  E: "U",
  S: "F",
};

const FACE_TO_SLICE: Record<string, "M" | "E" | "S"> = {
  R: "M",
  L: "M",
  U: "E",
  D: "E",
  F: "S",
  B: "S",
};

/**
 * 游戏页黄上视图（viewOrientation=solve，setup z2）下的高亮记号。
 * - 已完成 z2 等转体后：公式已是握持帧，直接画 l' / U'，不再映回白上绿前。
 * - 转体前（打乱）：公式是白上绝对面转，映到黄上视图（U→D 等）。
 */
export function hintTokenInSolveView(
  token: string,
  orientationMoves: readonly string[],
): string {
  const raw = token.trim();
  if (!raw || isRotationGuideToken(raw)) {
    return raw;
  }
  const yellowUp = orientationMoves.some((move) => {
    const t = move.trim();
    return t === "z2" || t === "z2'" || t.startsWith("z2 ");
  });
  if (yellowUp) {
    return raw;
  }
  // 打乱段：白上记号 → 黄上视图
  return remapGripTokenToPuzzleHint(raw, ["z2"]);
}

/**
 * 握持记号 → 白上绿前绝对记号（蓝牙 facelets / 对表用）。
 * 转体本身不改写；面 / 宽层 / 中层按已完成转体映射。
 */
export function remapGripTokenToPuzzleHint(
  token: string,
  orientationMoves: readonly string[],
): string {
  const raw = token.trim();
  if (!raw || orientationMoves.length === 0 || isRotationGuideToken(raw)) {
    return raw;
  }
  const face = /^([UDLRFB])(2'|2|')?$/.exec(raw);
  if (face) {
    return remapFaceMoveThroughOrientation(raw, orientationMoves);
  }
  const wide = /^([udlrfb])(2'|2|')?$/.exec(raw);
  if (wide) {
    const upper = `${wide[1]!.toUpperCase()}${wide[2] ?? ""}`;
    const mapped = remapFaceMoveThroughOrientation(upper, orientationMoves);
    return `${mapped[0]!.toLowerCase()}${mapped.slice(1)}`;
  }
  const slice = /^([MES])(2'|2|')?$/.exec(raw);
  if (slice) {
    const family = slice[1] as "M" | "E" | "S";
    const suffix = slice[2] ?? "";
    const axis = SLICE_AXIS_FACE[family];
    const mapped = remapFaceMoveThroughOrientation(
      `${axis}${suffix}`,
      orientationMoves,
    );
    const mappedFace = mapped[0]!;
    const mappedSuffix = mapped.slice(1);
    const nextFamily = FACE_TO_SLICE[mappedFace] ?? family;
    // 轴面映到对侧（R→L 等）时中层方向取逆，与 z2 共轭一致。
    const flipped =
      (family === "M" && mappedFace === "L") ||
      (family === "E" && mappedFace === "D") ||
      (family === "S" && mappedFace === "B");
    if (!flipped) {
      return `${nextFamily}${mappedSuffix}`;
    }
    if (mappedSuffix === "2" || mappedSuffix === "2'") {
      return `${nextFamily}2`;
    }
    if (mappedSuffix === "'") {
      return nextFamily;
    }
    return `${nextFamily}'`;
  }
  return raw;
}

/**
 * 蓝牙色心绝对面转 → 当前握持面转，供引导匹配公式。
 */
export function absoluteMoveToGripGuide(
  absoluteMove: string,
  orientationMoves: readonly string[],
): string {
  return absoluteFaceMoveToGrip(absoluteMove, orientationMoves);
}
