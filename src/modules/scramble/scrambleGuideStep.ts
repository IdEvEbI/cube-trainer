import { faceletsToKPattern } from "../bluetooth/moyu/pattern.ts";
import {
  expectedFixedCenterPattern,
  patternsMatchFixedCenters,
} from "../game/algStateMatch.ts";
import {
  invertFaceMove,
  isFaceGuideToken,
  isRotationGuideToken,
  isSliceGuideToken,
  isWideGuideToken,
} from "./guided.ts";

/** 打乱引导单步类型。 */
export type ScrambleGuideStepKind = "face" | "wide" | "slice" | "rotation";

/** facelets 对表结果。 */
export type ScrambleGuideStepCheck =
  | "at_start"
  | "reached"
  | "in_progress"
  | "wrong";

/** 稳定错误态需要连续相同 facelets 的轮询次数（约 450ms × 2）。 */
export const SCRAMBLE_GUIDE_WRONG_SETTLE_POLLS = 2;

export function classifyScrambleGuideStep(
  token: string | null | undefined,
): ScrambleGuideStepKind | null {
  const t = token?.trim() ?? "";
  if (!t) {
    return null;
  }
  if (isRotationGuideToken(t)) {
    return "rotation";
  }
  if (isSliceGuideToken(t)) {
    return "slice";
  }
  if (isWideGuideToken(t)) {
    return "wide";
  }
  if (isFaceGuideToken(t)) {
    return "face";
  }
  return null;
}

/** 面转 / 宽层 / 中层走 facelets 流水线；转体仍走陀螺仪。 */
export function isFaceletsGuideStepKind(
  kind: ScrambleGuideStepKind | null,
): boolean {
  return kind === "face" || kind === "wide" || kind === "slice";
}

/**
 * 误转提示用：往 wrongStack 压入「期望步的逆」，界面 correction 会显示期望步本身。
 */
export function syntheticWrongMoveForExpected(expectedToken: string): string {
  if (isFaceGuideToken(expectedToken)) {
    return invertFaceMove(expectedToken);
  }
  // 宽层 / 中层：用同记号逆形式凑 correction 文案（非严格面转撤销）。
  const t = expectedToken.trim();
  if (t.endsWith("2'") || t.endsWith("2")) {
    return t.replace(/2'?$/, "2");
  }
  if (t.endsWith("'")) {
    return t.slice(0, -1);
  }
  return `${t}'`;
}

/**
 * 打乱引导 facelets 流水线：
 * 1) 算本步完成后的固定色心期望态
 * 2) 与当前 facelets 比对
 * 3) 到位 / 仍在起点 / 拧动中 / 停在错误态
 */
export async function checkScrambleGuideStepByFacelets(options: {
  facelets: string;
  displayMoves: readonly string[];
  /** 当前步下标（尚未计入 progress 的那一步）。 */
  progress: number;
  /** 连续与上次相同且未到位的次数；调用方在 facelets 变化时归零。 */
  settledSameCount: number;
}): Promise<ScrambleGuideStepCheck> {
  const ble = await faceletsToKPattern(options.facelets);
  const start = await expectedFixedCenterPattern(
    options.displayMoves,
    options.progress,
  );
  const reached = await expectedFixedCenterPattern(
    options.displayMoves,
    options.progress + 1,
  );
  if (patternsMatchFixedCenters(ble, reached)) {
    return "reached";
  }
  if (patternsMatchFixedCenters(ble, start)) {
    return "at_start";
  }
  if (options.settledSameCount >= SCRAMBLE_GUIDE_WRONG_SETTLE_POLLS) {
    return "wrong";
  }
  return "in_progress";
}
