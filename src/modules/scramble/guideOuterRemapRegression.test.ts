/**
 * 映面回归护栏：期望面 × 同面反转 × 朝向候选。
 * 只走 stepGamePageBleAbsoluteFace；不改生产逻辑。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepGamePageBleAbsoluteFace } from "../game/guidedAbsolute.ts";
import { remapGripTokenToPuzzleHint } from "../game/guideOrientation.ts";
import { createGuidedMoves, guidedScrambleView } from "./guided.ts";

function faceLetter(move: string): string {
  return (move.trim()[0] ?? "").toUpperCase();
}

/** 期望撇步时拧同面正转 → absorb；resolved 须同面，不得邻面。 */
type RemapRow = {
  id: string;
  tokens: string[];
  progress: number;
  expected: string;
  /** 握持面字母（正转） */
  gripCw: string;
  /** 用于求绝对包的朝向（通常是公式朝向） */
  gripOrients: readonly string[];
  candidates: readonly string[];
};

const ROWS: RemapRow[] = [
  {
    id: "1 · z2…f 后 R' + 脏 z2 y（合约已有）",
    tokens: ["z2", "M'", "S'", "E'", "R'", "f", "R'"],
    progress: 6,
    expected: "R'",
    gripCw: "R",
    gripOrients: ["z2"],
    candidates: ["z2 y", "z2 z", "z2 x z' y z", "z2"],
  },
  {
    id: "2 · 同上，候选只有 z2",
    tokens: ["z2", "M'", "S'", "E'", "R'", "f", "R'"],
    progress: 6,
    expected: "R'",
    gripCw: "R",
    gripOrients: ["z2"],
    candidates: ["z2"],
  },
  {
    id: "3 · z2 y 后期望 R'，握持 R",
    tokens: ["z2", "y", "R'"],
    progress: 2,
    expected: "R'",
    gripCw: "R",
    gripOrients: ["z2", "y"],
    candidates: ["z2 y", "z2 y x'", "z2"],
  },
  {
    id: "4a · z2 后期望 U'，拧 U",
    tokens: ["z2", "U'"],
    progress: 1,
    expected: "U'",
    gripCw: "U",
    gripOrients: ["z2"],
    candidates: ["z2"],
  },
  {
    id: "4b · z2 后期望 F'，拧 F",
    tokens: ["z2", "F'"],
    progress: 1,
    expected: "F'",
    gripCw: "F",
    gripOrients: ["z2"],
    candidates: ["z2"],
  },
  {
    id: "4c · z2 后期望 L'，拧 L",
    tokens: ["z2", "L'"],
    progress: 1,
    expected: "L'",
    gripCw: "L",
    gripOrients: ["z2"],
    candidates: ["z2"],
  },
  {
    id: "4d · z2 后期望 B'，拧 B",
    tokens: ["z2", "B'"],
    progress: 1,
    expected: "B'",
    gripCw: "B",
    gripOrients: ["z2"],
    candidates: ["z2"],
  },
  {
    id: "4e · z2 后期望 D'，拧 D",
    tokens: ["z2", "D'"],
    progress: 1,
    expected: "D'",
    gripCw: "D",
    gripOrients: ["z2"],
    candidates: ["z2"],
  },
  {
    id: "5 · z2 M' S' E' 后期望 R'，握持 R",
    tokens: ["z2", "M'", "S'", "E'", "R'"],
    progress: 4,
    expected: "R'",
    gripCw: "R",
    gripOrients: ["z2"],
    candidates: ["z2 y", "z2", "z2 M' S' E'"],
  },
];

describe("映面回归 · stepGamePageBleAbsoluteFace", () => {
  for (const row of ROWS) {
    it(row.id, () => {
      const guide = {
        ...createGuidedMoves(row.tokens),
        progress: row.progress,
      };
      assert.equal(
        guidedScrambleView(guide).expectedMove,
        row.expected,
        `期望步 ${row.expected}`,
      );
      const absolute = remapGripTokenToPuzzleHint(row.gripCw, row.gripOrients);
      const step = stepGamePageBleAbsoluteFace(guide, absolute, row.candidates);
      const wantFace = faceLetter(row.expected);
      const gotFace = faceLetter(step.resolved);
      assert.equal(
        gotFace,
        wantFace,
        `resolved 须同面 ${wantFace}，不得邻面（got=${step.resolved} abs=${absolute}）`,
      );
      assert.notEqual(
        step.kind,
        "wrong",
        `不得进 wrong（got kind=${step.kind}）`,
      );
      assert.equal(
        step.kind,
        "absorb",
        `同面反转须 absorb（got kind=${step.kind} resolved=${step.resolved}）`,
      );
      assert.equal(step.correction, null);
    });
  }
});
