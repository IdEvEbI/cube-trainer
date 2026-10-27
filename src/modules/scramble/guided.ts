import { parseScramble } from "./scramble.ts";

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
   */
  expectedMove: string | null;
  /** 修正提示：应转的撤销步；无误时为 null。 */
  correction: string | null;
  done: boolean;
};

export type ApplyGuidedMoveResult = {
  guide: GuidedScramble;
  kind: "progress" | "partial" | "wrong" | "recover" | "done";
};

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

export function createGuidedScramble(source: string): GuidedScramble {
  const displayMoves = parseScramble(source);
  return {
    displayMoves,
    progress: 0,
    halfDone: false,
    halfDir: null,
    wrongStack: [],
    phase: displayMoves.length === 0 ? "done" : "guiding",
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
  return {
    displayMoves: guide.displayMoves,
    completedCount: guide.progress,
    currentIndex: done ? null : guide.progress,
    partial: !done && guide.halfDone,
    currentIsDouble: token ? isDoubleMove(token) : false,
    expectedMove: done ? null : preferredExpectedMove(guide),
    correction: topWrong ? invertFaceMove(topWrong) : null,
    done,
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
