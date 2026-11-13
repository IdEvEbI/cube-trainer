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
  /** 连接时已有实体态（打乱起点），与层转引导一致。 */
  scrambleSetupAlg?: string;
}): Promise<ScrambleGuideStepCheck> {
  const setup = options.scrambleSetupAlg ?? "";
  const ble = await faceletsToKPattern(options.facelets);
  const start = await expectedFixedCenterPattern(
    options.displayMoves,
    options.progress,
    setup,
  );
  const reached = await expectedFixedCenterPattern(
    options.displayMoves,
    options.progress + 1,
    setup,
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

/**
 * 蓝牙面转字母与期望不符时，用 facelets 兜底（层转后偶发错面字母）。
 * - reached：实体已到位 → 当作 progress
 * - at_start：实体未动 → 丢弃该包（尾包/误报）
 * - in_progress：拧动中快照 → 也丢弃（切勿当 keep_wrong，否则 M 后拧 F 途中冒 U 会误报）
 * - wrong（需 settle 或 readFacelets 复读）：才按字母判错
 */
export type FaceMoveFaceletsReconcile =
  | "accept_progress"
  | "ignore_packet"
  | "keep_wrong";

const RECONCILE_SETTLE_READS = 3;
const RECONCILE_SETTLE_GAP_MS = 120;

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function reconcileFaceMoveWithFacelets(options: {
  facelets: string;
  displayMoves: readonly string[];
  progress: number;
  scrambleSetupAlg?: string;
  /** 可选：复读 facelets，用于确认真正停在错态（而非拧动中）。 */
  readFacelets?: () => Promise<string>;
}): Promise<FaceMoveFaceletsReconcile> {
  const classify = async (
    facelets: string,
    settledSameCount: number,
  ): Promise<FaceMoveFaceletsReconcile | "in_progress"> => {
    const check = await checkScrambleGuideStepByFacelets({
      facelets,
      displayMoves: options.displayMoves,
      progress: options.progress,
      settledSameCount,
      scrambleSetupAlg: options.scrambleSetupAlg,
    });
    if (check === "reached") {
      return "accept_progress";
    }
    if (check === "at_start") {
      return "ignore_packet";
    }
    if (check === "wrong") {
      return "keep_wrong";
    }
    return "in_progress";
  };

  const first = await classify(options.facelets, 0);
  if (first !== "in_progress") {
    return first;
  }

  const readFacelets = options.readFacelets;
  if (!readFacelets) {
    // 单帧中间态：宁可漏报错，也不要在拧 F 途中因冒包标成「请转 U'」。
    return "ignore_packet";
  }

  let last = options.facelets;
  let same = 0;
  for (let i = 0; i < RECONCILE_SETTLE_READS; i += 1) {
    await waitMs(RECONCILE_SETTLE_GAP_MS);
    const next = await readFacelets();
    same = next === last ? same + 1 : 0;
    last = next;
    const again = await classify(next, same);
    if (again !== "in_progress") {
      return again;
    }
  }
  return "ignore_packet";
}
