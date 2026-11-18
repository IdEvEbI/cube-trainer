import { parseGuidedAlg } from "./scramble.ts";

const FACE_QUARTER = /^[UDLRFB](?:')?$/;
const FACE_TURN = /^([UDLRFB])(2'|2|')?$/;

export type GuidedScramble = {
  /** 打乱公式展示步（保留 U2 / R2' 等整步）。 */
  displayMoves: string[];
  /** 已完整完成的展示步数量。 */
  progress: number;
  /** 当前双步是否已完成一半。 */
  halfDone: boolean;
  /** 双步前半锁定的方向："" 正转、"'" 逆转；未锁定为 null。 */
  halfDir: "" | "'" | null;
  /**
   * 当前步同面反转累计（#181）：如期望 R 时连续 R'。
   * 满 3 等价完成期望步；不满不推进、不进 wrongStack。
   */
  sameFaceInverseCount: number;
  /** 转错后待撤销的步（后进先出，存实际转过的步）。 */
  wrongStack: string[];
  phase: "guiding" | "done";
};

export type GuidedScrambleView = {
  displayMoves: string[];
  /** 已完整完成的展示步数量。 */
  completedCount: number;
  /** 当前展示步下标；完成时为 null。 */
  currentIndex: number | null;
  /** 当前步是否双步且已转一半（半高亮）。 */
  partial: boolean;
  /** 当前步是否为双步（R2 / R2' 等）。 */
  currentIsDouble: boolean;
  /**
   * 箭头 /「下一步」用的推荐四分之一转。
   * 双步未半完成时默认推荐正转（R）；匹配时 R 与 R' 均可。
   * 当前为转体等非面转时为 null。
   */
  expectedMove: string | null;
  /** 当前步为转体 / 宽层 / 中层等时的记号；面转引导时为 null。 */
  manualMove: string | null;
  /** 修正提示：应转的撤销步；无误时为 null。 */
  correction: string | null;
  done: boolean;
};

export type ApplyGuidedMoveResult = {
  guide: GuidedScramble;
  kind:
    | "progress"
    | "partial"
    | "absorb"
    | "wrong"
    | "recover"
    | "done"
    | "need_manual";
};

/** 同面反转四分之一（期望 R、实转 R'）。 */
export function isSameFaceInverseQuarter(
  move: string,
  expected: string,
): boolean {
  const got = move.trim();
  const want = expected.trim();
  if (!FACE_QUARTER.test(got) || !FACE_QUARTER.test(want)) {
    return false;
  }
  if (got[0]!.toUpperCase() !== want[0]!.toUpperCase()) {
    return false;
  }
  return got !== want;
}

/** 宽边 / 中层四分之一（不含 *2）；可与外面转共用同面反转计数。 */
export function isWideOrSliceQuarterGuideToken(token: string): boolean {
  const t = token.trim();
  if (!t || /2/.test(t)) {
    return false;
  }
  return isWideGuideToken(t) || isSliceGuideToken(t);
}

/** 同面反转：外面转或宽边/中层四分之一（l↔l'、M'↔M）。 */
export function isSameFaceInverseGuideToken(
  move: string,
  expected: string,
): boolean {
  const got = move.trim();
  const want = expected.trim();
  if (!got || !want || /2/.test(got) || /2/.test(want)) {
    return false;
  }
  if (FACE_QUARTER.test(got) && FACE_QUARTER.test(want)) {
    return isSameFaceInverseQuarter(got, want);
  }
  if (
    isWideOrSliceQuarterGuideToken(got) &&
    isWideOrSliceQuarterGuideToken(want)
  ) {
    try {
      return invertGuideToken(want) === got;
    } catch {
      return false;
    }
  }
  return false;
}

/** 可走蓝牙四分之一转引导的面转（含 R2）；转体 / 宽层 / 中层需手动确认。 */
export function isFaceGuideToken(token: string): boolean {
  return FACE_TURN.test(token.trim());
}

const ROTATION_TOKEN = /^[xyz](?:2'|'2|2|')?$/;
const WIDE_TOKEN = /^[udlrfb](?:2'|'2|2|')?$/;
const SLICE_TOKEN = /^[MES](?:2'|'2|2|')?$/;

/** 整机转体（x/y/z）。 */
export function isRotationGuideToken(token: string): boolean {
  return ROTATION_TOKEN.test(token.trim());
}

/** 宽层（u/d/l/r/f/b）。 */
export function isWideGuideToken(token: string): boolean {
  return WIDE_TOKEN.test(token.trim());
}

/** 中层（M/E/S）。 */
export function isSliceGuideToken(token: string): boolean {
  return SLICE_TOKEN.test(token.trim());
}

/** 可画高亮盒、但蓝牙通常不按单步面转上报的记号。 */
export function isHintableManualToken(token: string): boolean {
  const t = token.trim();
  return isRotationGuideToken(t) || isWideGuideToken(t) || isSliceGuideToken(t);
}

/**
 * 宽层 / 中层 facelets 确认后进入「回声门」：只放行下一步期望面转。
 * 门控持续到该面转整步完成，不靠短时限（尾包常晚于 450ms）。
 * 当前不是面转步时返回 null（整批丢弃）。
 */
export function scrambleGuideEchoAcceptedMoves(
  token: string | null | undefined,
  halfDone: boolean,
  halfDir: "" | "'" | null,
): string[] | null {
  const t = token?.trim() ?? "";
  if (!t || !isFaceGuideToken(t)) {
    return null;
  }
  const { face, suffix } = parseFaceTurn(t);
  if (suffix === "2" || suffix === "2'") {
    if (!halfDone) {
      return [face, `${face}'`];
    }
    return [`${face}${halfDir ?? ""}`];
  }
  return [`${face}${suffix}`];
}

/** @deprecated 使用 {@link scrambleGuideEchoAcceptedMoves} */
export const scrambleGuideQuietAcceptedMoves = scrambleGuideEchoAcceptedMoves;

/** 宽层 / 中层：外层包只跟 3D 动画，不对表（到位靠 facelets）。 */
export function isScrambleGuideAnimateOnlyToken(
  token: string | null | undefined,
): boolean {
  const t = token?.trim() ?? "";
  return Boolean(t) && (isWideGuideToken(t) || isSliceGuideToken(t));
}

export function parseFaceTurn(move: string): {
  face: string;
  suffix: "" | "'" | "2" | "2'";
} {
  const match = FACE_TURN.exec(move);
  if (!match) {
    throw new Error(`无法解析：${move}`);
  }
  const face = match[1]!;
  const raw = match[2] ?? "";
  const suffix =
    raw === "2" || raw === "2'" || raw === "'" ? raw : ("" as const);
  return { face, suffix };
}

/** R2 与 R2' / R'2 等价：都是该面 180°。 */
export function isDoubleMove(move: string): boolean {
  const { suffix } = parseFaceTurn(move);
  return suffix === "2" || suffix === "2'";
}

/** 将单步展开为默认四分之一转（双步默认正转两下；匹配时另见 apply）。 */
export function expandFaceMoveToQuarters(move: string): string[] {
  const { face, suffix } = parseFaceTurn(move);
  if (suffix === "2" || suffix === "2'") {
    return [face, face];
  }
  return [`${face}${suffix}`];
}

export function invertFaceMove(move: string): string {
  const { face, suffix } = parseFaceTurn(move);
  if (suffix === "2" || suffix === "2'") {
    return `${face}2`;
  }
  if (suffix === "'") {
    return face;
  }
  return `${face}'`;
}

/**
 * 面转 / 宽层 / 中层 / 转体的记号取逆（仅用于 correction 文案与误转栈）。
 * 宽层中层不可再走 {@link invertFaceMove}，否则会抛「无法解析：M'」。
 */
export function invertGuideToken(token: string): string {
  const t = token.trim();
  if (!t) {
    return t;
  }
  if (isFaceGuideToken(t)) {
    return invertFaceMove(t);
  }
  if (t.endsWith("2'") || t.endsWith("2")) {
    return t.replace(/2'?$/, "2");
  }
  if (t.endsWith("'")) {
    return t.slice(0, -1);
  }
  return `${t}'`;
}

/** 由已拆分的公式步创建引导（可含转体等非面转，供游戏页使用）。 */
export function createGuidedMoves(
  displayMoves: readonly string[],
): GuidedScramble {
  const moves = displayMoves
    .map((move) => move.trim())
    .filter((move) => move.length > 0);
  return {
    displayMoves: moves,
    progress: 0,
    halfDone: false,
    halfDir: null,
    sameFaceInverseCount: 0,
    wrongStack: [],
    phase: moves.length === 0 ? "done" : "guiding",
  };
}

export function createGuidedScramble(source: string): GuidedScramble {
  return createGuidedMoves(parseGuidedAlg(source));
}

/** 分段跳转：瞬切到指定展示步下标并清空误转栈。 */
export function seekGuidedProgress(
  guide: GuidedScramble,
  progress: number,
): GuidedScramble {
  const next = Math.max(
    0,
    Math.min(guide.displayMoves.length, Math.trunc(progress)),
  );
  return {
    ...guide,
    progress: next,
    halfDone: false,
    halfDir: null,
    sameFaceInverseCount: 0,
    wrongStack: [],
    phase: next >= guide.displayMoves.length ? "done" : "guiding",
  };
}

function currentToken(guide: GuidedScramble): string | null {
  if (guide.phase === "done" || guide.progress >= guide.displayMoves.length) {
    return null;
  }
  return guide.displayMoves[guide.progress] ?? null;
}

/**
 * 还差步 → 高亮 paint 参数。外面转 `B2` 须拆成面字母 + double（moveHint 不认 `B2` 字面量）。
 */
export function resolveGuideExpectedHintPaint(
  expectedMove: string,
  currentIsDouble = false,
): { token: string; double: boolean } {
  const raw = expectedMove.trim();
  const outerDouble = /^([UDLRFB])2$/.exec(raw);
  if (outerDouble) {
    return { token: outerDouble[1]!, double: true };
  }
  return { token: raw, double: currentIsDouble || /2/.test(raw) };
}

/**
 * 同面反转累计中的「还差」提示（#181）：
 * count=1 → base2（U2 / l2 / M2）；count=2 → 期望的逆（U' / l' / M）。
 * 适用于外面转四分之一、宽边、中层；不含已是双步的记号。
 */
export function remainingAfterSameFaceInverse(
  expectedToken: string,
  inverseCount: number,
): string | null {
  const count = Math.trunc(inverseCount);
  const t = expectedToken.trim();
  if (count <= 0 || !t || /2/.test(t)) {
    return null;
  }
  const baseMatch = /^([UDLRFB]|[udlrfb]|[MES])(')?$/.exec(t);
  if (!baseMatch) {
    return null;
  }
  const base = baseMatch[1]!;
  if (count === 1) {
    return `${base}2`;
  }
  if (count === 2) {
    return invertGuideToken(t);
  }
  return null;
}

/**
 * 公式步本身的期望四分之一（不含同面反转「还差」提示）。
 * 映面 / apply 必须用这个，不能用 UI 的 U2/U' 还差文案。
 */
export function formulaExpectedFaceQuarter(
  guide: GuidedScramble,
): string | null {
  const token = currentToken(guide);
  if (!token || !isFaceGuideToken(token)) {
    return null;
  }
  const { face, suffix } = parseFaceTurn(token);
  if (suffix === "2" || suffix === "2'") {
    const dir = guide.halfDir ?? "";
    return `${face}${dir}`;
  }
  return `${face}${suffix}`;
}

/** 外面转四分之一（U/R/F/D/L/B 及逆）；不含双步、中层、宽边。 */
export function isOuterFaceQuarterGuideToken(token: string): boolean {
  return FACE_QUARTER.test(token.trim());
}

function preferredExpectedMove(guide: GuidedScramble): string | null {
  const token = currentToken(guide);
  if (!token) {
    return null;
  }
  const { face, suffix } = parseFaceTurn(token);
  if (suffix === "2" || suffix === "2'") {
    const dir = guide.halfDir ?? "";
    return `${face}${dir}`;
  }
  const expected = `${face}${suffix}`;
  const inverseCount = guide.sameFaceInverseCount ?? 0;
  if (inverseCount > 0) {
    return remainingAfterSameFaceInverse(expected, inverseCount) ?? expected;
  }
  return expected;
}

export function guidedScrambleView(guide: GuidedScramble): GuidedScrambleView {
  const topWrong = guide.wrongStack[guide.wrongStack.length - 1];
  const done = guide.phase === "done";
  const token = currentToken(guide);
  const faceToken = Boolean(token && isFaceGuideToken(token));
  const manualMove = done || faceToken || !token ? null : token;
  const inverseCount = guide.sameFaceInverseCount ?? 0;
  let expectedMove: string | null = null;
  if (!done && faceToken) {
    expectedMove = preferredExpectedMove(guide);
  } else if (
    !done &&
    manualMove &&
    !isRotationGuideToken(manualMove) &&
    inverseCount > 0
  ) {
    // 宽边 / 中层反转累计中：还差 l2 / M2 等（供高亮与文案）。
    expectedMove = remainingAfterSameFaceInverse(manualMove, inverseCount);
  }
  return {
    displayMoves: guide.displayMoves,
    completedCount: guide.progress,
    currentIndex: done ? null : guide.progress,
    partial: !done && guide.halfDone,
    currentIsDouble: faceToken && token ? isDoubleMove(token) : false,
    expectedMove,
    /** 当前为转体 / 宽层等时，需手动确认的记号。 */
    manualMove,
    correction: topWrong ? invertGuideToken(topWrong) : null,
    done,
  };
}

/**
 * 同面反转累计时，已拧进画面的反转步（期望 f、count=2 → `f' f'`）。
 * 供 3D 跟手前缀，避免还差 f2 时闪回旧姿态。
 */
export function sameFaceInverseVisualMoves(
  expectedToken: string,
  inverseCount: number,
): string[] {
  const count = Math.trunc(inverseCount);
  const token = expectedToken.trim();
  if (count <= 0 || !token) {
    return [];
  }
  const inv = invertGuideToken(token);
  return Array.from({ length: count }, () => inv);
}

/**
 * 宽边/中层反转跟手底：公式已完成前缀 + 已拧的反转步。
 * 不得等于「仅公式前缀」（否则会从旧姿态硬开还差轨道，顶心错色）。
 */
export function layerAbsorbVisualBaseAlg(
  formulaPrefix: string,
  expectedToken: string,
  inverseCount: number,
): string {
  const prefix = formulaPrefix.trim();
  const applied = sameFaceInverseVisualMoves(expectedToken, inverseCount);
  if (applied.length === 0) {
    return prefix;
  }
  return [prefix, ...applied].filter(Boolean).join(" ");
}

/**
 * 当前跟转高亮应画的记号（纠错 / 还差 / 手动步）。
 * 中层确认后须是下一步记号，不得沿用上一步层。
 */
export function guideViewHintPaintToken(
  view: GuidedScrambleView,
): string | null {
  if (view.correction) {
    return view.correction.trim();
  }
  if (view.done) {
    return null;
  }
  if (view.expectedMove) {
    return resolveGuideExpectedHintPaint(
      view.expectedMove,
      view.currentIsDouble,
    ).token;
  }
  if (view.manualMove) {
    return view.manualMove.trim();
  }
  return null;
}

/** 中层高亮族（M/E/S）；非中层返回 null。 */
export function guideHintSliceFamily(
  token: string | null | undefined,
): "M" | "E" | "S" | null {
  const m = /^([MES])/i.exec((token ?? "").trim());
  if (!m) {
    return null;
  }
  return m[1]!.toUpperCase() as "M" | "E" | "S";
}

/**
 * 跟转右侧状态文案合约（与 GamePage 展示一致；单测锁文案用）。
 * 纠错优先；宽边 / 中层 / 转体 / 外面转：正常「下一步」；宽边反转还差「继续拧 f2」；
 * 中层反转还差仍「下一步 M2」。双步半程不缀「再转半步」。
 */
export function guideStepHintText(view: GuidedScrambleView): string | null {
  if (view.correction) {
    return `转错了，请转 ${view.correction}`;
  }
  if (view.done) {
    return null;
  }
  if (view.manualMove) {
    const token = view.manualMove;
    if (isSliceGuideToken(token) || isRotationGuideToken(token)) {
      return `下一步 ${view.expectedMove ?? token}`;
    }
    if (isWideGuideToken(token)) {
      // 正常「下一步 f」；反转累计「继续拧 f2」。
      if (view.expectedMove) {
        return `继续拧 ${view.expectedMove}`;
      }
      return `下一步 ${token}`;
    }
    return `请完成：${token}`;
  }
  if (view.expectedMove) {
    return `下一步 ${view.expectedMove}`;
  }
  return null;
}

/** 外面转 / 宽边 / 中层 / 转体均不显示「跳过此步」。 */
export function guideStepShowsSkipButton(view: GuidedScrambleView): boolean {
  void view;
  return false;
}

/**
 * 确认当前非面转步（转体 / 宽层等）：蓝牙无法上报时由用户点确认推进。
 */
export function confirmGuidedManualStep(
  guide: GuidedScramble,
): ApplyGuidedMoveResult {
  if (guide.phase === "done") {
    return { guide, kind: "done" };
  }
  if (guide.wrongStack.length > 0) {
    return { guide, kind: "need_manual" };
  }
  const token = currentToken(guide);
  if (!token || isFaceGuideToken(token)) {
    return { guide, kind: "need_manual" };
  }
  const progress = guide.progress + 1;
  const finished = progress >= guide.displayMoves.length;
  return {
    guide: {
      ...guide,
      progress,
      halfDone: false,
      halfDir: null,
      sameFaceInverseCount: 0,
      phase: finished ? "done" : "guiding",
    },
    kind: finished ? "done" : "progress",
  };
}

/**
 * facelets 到位后确认当前步（面转 / 宽层 / 中层；不含转体）。
 * 打乱引导在切片后改走状态对表，避免外层尾包误判 D/L' 等面转。
 */
export function confirmGuidedFaceletsStep(
  guide: GuidedScramble,
): ApplyGuidedMoveResult {
  if (guide.phase === "done") {
    return { guide, kind: "done" };
  }
  const token = currentToken(guide);
  if (!token || isRotationGuideToken(token)) {
    return { guide, kind: "need_manual" };
  }
  const progress = guide.progress + 1;
  const finished = progress >= guide.displayMoves.length;
  return {
    guide: {
      ...guide,
      progress,
      halfDone: false,
      halfDir: null,
      sameFaceInverseCount: 0,
      wrongStack: [],
      phase: finished ? "done" : "guiding",
    },
    kind: finished ? "done" : "progress",
  };
}

function advanceFaceProgress(guide: GuidedScramble): ApplyGuidedMoveResult {
  const progress = guide.progress + 1;
  const finished = progress >= guide.displayMoves.length;
  return {
    guide: {
      ...guide,
      progress,
      halfDone: false,
      halfDir: null,
      sameFaceInverseCount: 0,
      wrongStack: [],
      phase: finished ? "done" : "guiding",
    },
    kind: finished ? "done" : "progress",
  };
}

/**
 * #181：同面反转累计（外面转 / 宽边 / 中层四分之一共用）。
 * 1 → 还差 *2；2 → 还差逆；3 → 推进；正转抵消不推进。
 */
function absorbSameFaceInverse(
  guide: GuidedScramble,
  move: string,
  expected: string,
): ApplyGuidedMoveResult | null {
  const inverseCount = guide.sameFaceInverseCount ?? 0;
  if (move === expected) {
    if (inverseCount > 0) {
      return {
        guide: { ...guide, sameFaceInverseCount: inverseCount - 1 },
        kind: "absorb",
      };
    }
    return advanceFaceProgress(guide);
  }
  if (isSameFaceInverseGuideToken(move, expected)) {
    const count = inverseCount + 1;
    if (count >= 3) {
      return advanceFaceProgress(guide);
    }
    return {
      guide: { ...guide, sameFaceInverseCount: count },
      kind: "absorb",
    };
  }
  return null;
}

export function applyGuidedMove(
  guide: GuidedScramble,
  move: string,
): ApplyGuidedMoveResult {
  const rawMove = move.trim();
  if (guide.phase === "done") {
    return { guide, kind: "done" };
  }

  const token = currentToken(guide);
  if (!token) {
    return { guide: { ...guide, phase: "done" }, kind: "done" };
  }

  // 宽边 / 中层：只接受同记号族的四分之一做反转计数；色心外层包不进 absorb。
  if (isWideOrSliceQuarterGuideToken(token)) {
    if (isWideOrSliceQuarterGuideToken(rawMove)) {
      const absorbed = absorbSameFaceInverse(guide, rawMove, token);
      if (absorbed) {
        return absorbed;
      }
    }
    return { guide, kind: "need_manual" };
  }

  // 转体等非面转：不走反转计数。
  if (!isFaceGuideToken(token)) {
    return { guide, kind: "need_manual" };
  }

  if (!FACE_QUARTER.test(rawMove)) {
    throw new Error(`无法匹配蓝牙步：${rawMove}`);
  }

  if (guide.wrongStack.length > 0) {
    const lastWrong = guide.wrongStack[guide.wrongStack.length - 1]!;
    const expectedUndo = invertFaceMove(lastWrong);
    if (rawMove === expectedUndo) {
      const wrongStack = guide.wrongStack.slice(0, -1);
      const next: GuidedScramble = { ...guide, wrongStack };
      return { guide: next, kind: "recover" };
    }
    return {
      guide: { ...guide, wrongStack: [...guide.wrongStack, rawMove] },
      kind: "wrong",
    };
  }

  const { face, suffix } = parseFaceTurn(token);
  const moveFace = rawMove[0]!;
  const moveDir = rawMove.endsWith("'") ? "'" : "";

  if (suffix === "2" || suffix === "2'") {
    if (moveFace !== face) {
      return {
        guide: {
          ...guide,
          sameFaceInverseCount: 0,
          wrongStack: [...guide.wrongStack, rawMove],
        },
        kind: "wrong",
      };
    }
    if (!guide.halfDone) {
      // 双步前半：正转或逆转均可（R2 ≡ R'2）
      return {
        guide: {
          ...guide,
          halfDone: true,
          halfDir: moveDir,
          sameFaceInverseCount: 0,
        },
        kind: "partial",
      };
    }
    // 后半必须与前半同向，才能凑满 180°
    if (moveDir !== guide.halfDir) {
      return {
        guide: {
          ...guide,
          sameFaceInverseCount: 0,
          wrongStack: [...guide.wrongStack, rawMove],
        },
        kind: "wrong",
      };
    }
    return advanceFaceProgress(guide);
  }

  const expected = `${face}${suffix}`;
  // #181：外面转四分之一同面反转；双步已在上方处理。
  if (
    isOuterFaceQuarterGuideToken(expected) &&
    isOuterFaceQuarterGuideToken(rawMove)
  ) {
    const absorbed = absorbSameFaceInverse(guide, rawMove, expected);
    if (absorbed) {
      return absorbed;
    }
  }
  if (rawMove === expected) {
    return advanceFaceProgress(guide);
  }
  return {
    guide: {
      ...guide,
      sameFaceInverseCount: 0,
      wrongStack: [...guide.wrongStack, rawMove],
    },
    kind: "wrong",
  };
}
