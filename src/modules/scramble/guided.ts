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
  kind: "progress" | "partial" | "wrong" | "recover" | "done" | "need_manual";
};

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
  return `${face}${suffix}`;
}

export function guidedScrambleView(guide: GuidedScramble): GuidedScrambleView {
  const topWrong = guide.wrongStack[guide.wrongStack.length - 1];
  const done = guide.phase === "done";
  const token = currentToken(guide);
  const faceToken = Boolean(token && isFaceGuideToken(token));
  return {
    displayMoves: guide.displayMoves,
    completedCount: guide.progress,
    currentIndex: done ? null : guide.progress,
    partial: !done && guide.halfDone,
    currentIsDouble: faceToken && token ? isDoubleMove(token) : false,
    expectedMove: done || !faceToken ? null : preferredExpectedMove(guide),
    /** 当前为转体 / 宽层等时，需手动确认的记号。 */
    manualMove: done || faceToken || !token ? null : token,
    correction: topWrong ? invertGuideToken(topWrong) : null,
    done,
  };
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
      wrongStack: [],
      phase: finished ? "done" : "guiding",
    },
    kind: finished ? "done" : "progress",
  };
}

export function applyGuidedMove(
  guide: GuidedScramble,
  move: string,
): ApplyGuidedMoveResult {
  if (!FACE_QUARTER.test(move)) {
    throw new Error(`无法匹配蓝牙步：${move}`);
  }
  if (guide.phase === "done") {
    return { guide, kind: "done" };
  }

  if (guide.wrongStack.length > 0) {
    const lastWrong = guide.wrongStack[guide.wrongStack.length - 1]!;
    const expectedUndo = invertFaceMove(lastWrong);
    if (move === expectedUndo) {
      const wrongStack = guide.wrongStack.slice(0, -1);
      const next: GuidedScramble = { ...guide, wrongStack };
      return { guide: next, kind: "recover" };
    }
    return {
      guide: { ...guide, wrongStack: [...guide.wrongStack, move] },
      kind: "wrong",
    };
  }

  const token = currentToken(guide);
  if (!token) {
    return { guide: { ...guide, phase: "done" }, kind: "done" };
  }
  if (!isFaceGuideToken(token)) {
    return { guide, kind: "need_manual" };
  }

  const { face, suffix } = parseFaceTurn(token);
  const moveFace = move[0]!;
  const moveDir = move.endsWith("'") ? "'" : "";

  if (suffix === "2" || suffix === "2'") {
    if (moveFace !== face) {
      return {
        guide: { ...guide, wrongStack: [...guide.wrongStack, move] },
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
        },
        kind: "partial",
      };
    }
    // 后半必须与前半同向，才能凑满 180°
    if (moveDir !== guide.halfDir) {
      return {
        guide: { ...guide, wrongStack: [...guide.wrongStack, move] },
        kind: "wrong",
      };
    }
    const progress = guide.progress + 1;
    const finished = progress >= guide.displayMoves.length;
    return {
      guide: {
        ...guide,
        progress,
        halfDone: false,
        halfDir: null,
        phase: finished ? "done" : "guiding",
      },
      kind: finished ? "done" : "progress",
    };
  }

  const expected = `${face}${suffix}`;
  if (move !== expected) {
    return {
      guide: { ...guide, wrongStack: [...guide.wrongStack, move] },
      kind: "wrong",
    };
  }

  const progress = guide.progress + 1;
  const finished = progress >= guide.displayMoves.length;
  return {
    guide: {
      ...guide,
      progress,
      halfDone: false,
      halfDir: null,
      phase: finished ? "done" : "guiding",
    },
    kind: finished ? "done" : "progress",
  };
}
