/**
 * #181 跟转合约：外面转 / 双步 / 同面反转 / 宽边 / 中层 / 转体。
 * 表驱动；只锁纯函数进度与提示文案。不改 GamePage 接线。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepGamePageBleAbsoluteFace } from "../game/guidedAbsolute.ts";
import { remapGripTokenToPuzzleHint } from "../game/guideOrientation.ts";
import {
  isResidualLayerDualFaceMove,
  layerEchoFaceMoves,
} from "./guideFollowController.ts";
import {
  applyGuidedMove,
  confirmGuidedFaceletsStep,
  confirmGuidedManualStep,
  createGuidedMoves,
  guideHintSliceFamily,
  guideStepHintText,
  guideStepShowsSkipButton,
  guideViewHintPaintToken,
  guidedScrambleView,
  invertGuideToken,
  layerAbsorbVisualBaseAlg,
  resolveGuideExpectedHintPaint,
  type GuidedScramble,
} from "./guided.ts";
import { createGuideFollowController } from "./guideFollowController.ts";

type Expect = {
  progress: number;
  /** 完整文案；与 hintIncludes 二选一或同用 */
  hint?: string | null;
  hintIncludes?: string;
  kind?: string;
  partial?: boolean;
  correctionNull?: boolean;
  /** 残留：完成后下一步面转不应被吞 */
  residualAccept?: {
    completedLayer: string;
    ble: string;
    expected: string;
  };
};

type Act =
  | { op: "face"; move: string }
  | { op: "confirmManual" }
  | { op: "confirmFacelets" }
  | {
      /** 宽边/中层：期望纯路径能吸收同面反转（尚无则红） */
      op: "layerInverse";
      label: string;
    }
  | {
      /** 宽边/中层：期望正转匹配可确认（facelets / manual） */
      op: "layerMatchConfirm";
    }
  | { op: "bleAbs"; absolute: string; orients: string[] };

type Case = {
  name: string;
  tokens: string[];
  progress?: number;
  acts: Act[];
  expect: Expect;
};

function runActs(
  guide: GuidedScramble,
  acts: readonly Act[],
): {
  guide: GuidedScramble;
  lastKind: string | null;
} {
  let current = guide;
  let lastKind: string | null = null;
  for (const act of acts) {
    if (act.op === "face") {
      const step = applyGuidedMove(current, act.move);
      current = step.guide;
      lastKind = step.kind;
      continue;
    }
    if (act.op === "confirmManual") {
      const step = confirmGuidedManualStep(current);
      current = step.guide;
      lastKind = step.kind;
      continue;
    }
    if (act.op === "confirmFacelets") {
      const step = confirmGuidedFaceletsStep(current);
      current = step.guide;
      lastKind = step.kind;
      continue;
    }
    if (act.op === "bleAbs") {
      const step = stepGamePageBleAbsoluteFace(
        current,
        act.absolute,
        act.orients,
      );
      current = step.guide;
      lastKind = step.kind;
      continue;
    }
    if (act.op === "layerMatchConfirm") {
      // 到位确认：facelets / 手动确认等价推进
      const step = confirmGuidedFaceletsStep(current);
      current = step.guide;
      lastKind = step.kind;
      continue;
    }
    if (act.op === "layerInverse") {
      // 合约：宽/中同面反转应计入 sameFaceInverseCount，满 3 推进。
      // 纯入口目前只有 applyGuidedMove（仅外面转四分之一）；层转记号会抛错或未吸收 → 红。
      try {
        const step = applyGuidedMove(current, act.label);
        current = step.guide;
        lastKind = step.kind;
      } catch {
        lastKind = "throw";
      }
      continue;
    }
  }
  return { guide: current, lastKind };
}

function assertCase(row: Case): void {
  let guide = createGuidedMoves(row.tokens);
  if (row.progress !== undefined) {
    guide = { ...guide, progress: row.progress };
  }
  const { guide: after, lastKind } = runActs(guide, row.acts);
  const view = guidedScrambleView(after);
  const hint = guideStepHintText(view);

  assert.equal(after.progress, row.expect.progress, "progress");
  if (row.expect.kind !== undefined) {
    assert.equal(lastKind, row.expect.kind, "kind");
  }
  if (row.expect.partial !== undefined) {
    assert.equal(view.partial, row.expect.partial, "partial");
  }
  if (row.expect.correctionNull) {
    assert.equal(view.correction, null, "correction");
    assert.equal(after.wrongStack.length, 0, "wrongStack");
  }
  if (row.expect.hint !== undefined) {
    assert.equal(hint, row.expect.hint, "hint");
  }
  if (row.expect.hintIncludes !== undefined) {
    assert.ok(
      hint !== null && hint.includes(row.expect.hintIncludes),
      `hint includes ${row.expect.hintIncludes}, got ${JSON.stringify(hint)}`,
    );
  }
  if (row.expect.residualAccept) {
    const { completedLayer, ble, expected } = row.expect.residualAccept;
    assert.ok(
      layerEchoFaceMoves(completedLayer).length > 0,
      "echo table for layer",
    );
    assert.equal(
      isResidualLayerDualFaceMove(ble, expected, [""], completedLayer),
      false,
      "next face must not be swallowed as residual",
    );
    assert.equal(view.expectedMove, expected);
  }
}

const CASES: Case[] = [
  // —— 外面转四分之一 ——
  {
    name: "期望 U，拧 U → 推进",
    tokens: ["U", "R"],
    acts: [{ op: "face", move: "U" }],
    expect: {
      progress: 1,
      kind: "progress",
      hint: "下一步 R",
      correctionNull: true,
    },
  },
  {
    name: "期望 U，拧 U' → 不推进，提示还差 U2",
    tokens: ["U", "R"],
    acts: [{ op: "face", move: "U'" }],
    expect: {
      progress: 0,
      kind: "absorb",
      hint: "下一步 U2",
      correctionNull: true,
    },
  },
  {
    name: "期望 U，U' 再 U → 抵消，回到期望 U",
    tokens: ["U", "R"],
    acts: [
      { op: "face", move: "U'" },
      { op: "face", move: "U" },
    ],
    expect: {
      progress: 0,
      kind: "absorb",
      hint: "下一步 U",
      correctionNull: true,
    },
  },
  {
    name: "期望 U，U'×3 → 推进，无纠错",
    tokens: ["U", "R"],
    acts: [
      { op: "face", move: "U'" },
      { op: "face", move: "U'" },
      { op: "face", move: "U'" },
    ],
    expect: {
      progress: 1,
      kind: "progress",
      hint: "下一步 R",
      correctionNull: true,
    },
  },

  // —— 外面转双步 ——
  {
    name: "期望 F2，拧 F → 半步，只显示还差字母",
    tokens: ["F2", "U"],
    acts: [{ op: "face", move: "F" }],
    expect: {
      progress: 0,
      kind: "partial",
      partial: true,
      hint: "下一步 F",
      correctionNull: true,
    },
  },
  {
    name: "期望 F2，拧 F' → 与 U2 拧 U' 同一规则（无再转半步）",
    tokens: ["F2", "U"],
    acts: [{ op: "face", move: "F'" }],
    expect: {
      progress: 0,
      kind: "partial",
      partial: true,
      hint: "下一步 F'",
      correctionNull: true,
    },
  },
  {
    name: "期望 U2，拧 U' → 对照：同一半步文案规则",
    tokens: ["U2", "R"],
    acts: [{ op: "face", move: "U'" }],
    expect: {
      progress: 0,
      kind: "partial",
      partial: true,
      hint: "下一步 U'",
      correctionNull: true,
    },
  },
  {
    name: "期望 F2，正反混拧不要直接跳下一步",
    tokens: ["F2", "U"],
    acts: [
      { op: "face", move: "F" },
      { op: "face", move: "F'" },
    ],
    expect: {
      progress: 0,
      kind: "wrong",
      hintIncludes: "转错了",
    },
  },

  // —— 宽边 ——
  {
    name: "期望 l，拧 l → 可确认到位",
    tokens: ["l", "U"],
    acts: [{ op: "layerMatchConfirm" }],
    expect: {
      progress: 1,
      kind: "progress",
      hint: "下一步 U",
      correctionNull: true,
    },
  },
  {
    name: "期望 l，拧 l' → 不推进，文案含「继续拧 l2」",
    tokens: ["l", "U"],
    acts: [{ op: "layerInverse", label: invertGuideToken("l") }],
    expect: {
      progress: 0,
      hintIncludes: "继续拧 l2",
      correctionNull: true,
    },
  },
  {
    name: "期望 l，l'×3 → 推进",
    tokens: ["l", "U"],
    acts: [
      { op: "layerInverse", label: invertGuideToken("l") },
      { op: "layerInverse", label: invertGuideToken("l") },
      { op: "layerInverse", label: invertGuideToken("l") },
    ],
    expect: {
      progress: 1,
      hint: "下一步 U",
      correctionNull: true,
    },
  },
  {
    name: "宽边 b 完成后，下一步 L' 仍能跟，不被吞",
    tokens: ["b", "L'"],
    acts: [{ op: "confirmManual" }],
    expect: {
      progress: 1,
      hint: "下一步 L'",
      correctionNull: true,
      residualAccept: {
        completedLayer: "b",
        ble: "L'",
        expected: "L'",
      },
    },
  },

  // —— 中层 ——
  {
    name: "期望 M'，中层包不被 absorb 吞掉，可确认到位",
    tokens: ["z2", "M'", "U"],
    progress: 1,
    acts: [
      { op: "bleAbs", absolute: "L'", orients: ["z2"] },
      { op: "confirmFacelets" },
    ],
    expect: {
      progress: 2,
      kind: "progress",
      hint: "下一步 U",
      correctionNull: true,
    },
  },
  {
    name: "期望 M'，拧 M → 不推进，文案含 M2",
    tokens: ["M'", "U"],
    acts: [{ op: "layerInverse", label: invertGuideToken("M'") }],
    expect: {
      progress: 0,
      hintIncludes: "M2",
      correctionNull: true,
    },
  },

  // —— 转体 ——
  {
    name: "z2 不走外面转反转计数，仍按转体到位确认",
    tokens: ["z2", "U"],
    acts: [{ op: "face", move: "U'" }, { op: "confirmManual" }],
    expect: {
      progress: 1,
      kind: "progress",
      hint: "下一步 U",
      correctionNull: true,
    },
  },
  {
    name: "y 不走外面转反转计数，仍按转体到位确认",
    tokens: ["y", "R"],
    acts: [{ op: "face", move: "R'" }, { op: "confirmManual" }],
    expect: {
      progress: 1,
      kind: "progress",
      hint: "下一步 R",
      correctionNull: true,
    },
  },
  {
    name: "x 不走外面转反转计数，仍按转体到位确认",
    tokens: ["x", "F"],
    acts: [{ op: "face", move: "F'" }, { op: "confirmManual" }],
    expect: {
      progress: 1,
      kind: "progress",
      hint: "下一步 F",
      correctionNull: true,
    },
  },
];

describe("guideStepContract · 跟转进度与文案", () => {
  for (const row of CASES) {
    it(row.name, () => {
      assertCase(row);
    });
  }

  it("双步半程文案无「再转半步」", () => {
    let guide = createGuidedMoves(["R2", "U"]);
    guide = applyGuidedMove(guide, "R").guide;
    const hint = guideStepHintText(guidedScrambleView(guide));
    assert.equal(hint, "下一步 R");
    assert.ok(hint !== null && !hint.includes("再转半步"));
    guide = createGuidedMoves(["B2", "U"]);
    guide = applyGuidedMove(guide, "B'").guide;
    const hintB = guideStepHintText(guidedScrambleView(guide));
    assert.equal(hintB, "下一步 B'");
    assert.ok(hintB !== null && !hintB.includes("再转半步"));
  });

  it("M' 文案不含「跳过此步」且同外面转提示", () => {
    const guide = createGuidedMoves(["M'", "U"]);
    const view = guidedScrambleView(guide);
    const hint = guideStepHintText(view);
    assert.equal(hint, "下一步 M'");
    assert.ok(hint !== null && !hint.includes("跳过此步"));
    assert.ok(hint !== null && !hint.includes("到位后自动继续"));
    assert.equal(guideStepShowsSkipButton(view), false);
  });

  it("E 后 R' 可推进（清层转窗后外面转）", () => {
    let guide = createGuidedMoves(["E", "R'"]);
    const confirmed = confirmGuidedManualStep(guide);
    assert.equal(confirmed.kind, "progress");
    guide = confirmed.guide;
    assert.equal(guide.progress, 1);
    assert.equal(guidedScrambleView(guide).expectedMove, "R'");
    const ctrl = createGuideFollowController();
    const t0 = 50_000;
    ctrl.beginLayerEchoQuiet(t0, "E");
    // 与 GamePage：下一步外面转时清层转窗。
    ctrl.clearResidualLayerDual();
    assert.equal(ctrl.shouldSwallowGuideFaceMove("R'", t0 + 1, "R'"), false);
    assert.equal(ctrl.shouldDiscardResidualLayerDual("R'", "R'", []), false);
    const step = applyGuidedMove(guide, "R'");
    assert.equal(step.kind, "done");
    assert.equal(step.guide.progress, 2);
  });

  it("期望 f 文案不含「跳过此步」", () => {
    const guide = createGuidedMoves(["f", "U"]);
    const view = guidedScrambleView(guide);
    const hint = guideStepHintText(view);
    assert.equal(hint, "下一步 f");
    assert.ok(hint !== null && !hint.includes("跳过此步"));
    assert.ok(hint !== null && !hint.includes("到位后自动继续"));
    assert.ok(hint !== null && !hint.includes("请完成宽层"));
    assert.equal(guideStepShowsSkipButton(view), false);
  });

  it("z2 文案不含「跳过此步」、不含「整机转体」", () => {
    const guide = createGuidedMoves(["z2", "U"]);
    const view = guidedScrambleView(guide);
    const hint = guideStepHintText(view);
    assert.equal(hint, "下一步 z2");
    assert.ok(hint !== null && !hint.includes("跳过此步"));
    assert.ok(hint !== null && !hint.includes("整机转体"));
    assert.ok(hint !== null && !hint.includes("到位后自动继续"));
    assert.equal(guideStepShowsSkipButton(view), false);
  });

  it("f + f' 文案含 f2，进度不推进，高亮 paint 为 double", () => {
    let guide = createGuidedMoves(["f", "U"]);
    const step = applyGuidedMove(guide, "f'");
    assert.equal(step.kind, "absorb");
    assert.equal(step.guide.progress, 0);
    guide = step.guide;
    const view = guidedScrambleView(guide);
    const hint = guideStepHintText(view);
    assert.equal(hint, "继续拧 f2");
    assert.ok(hint !== null && hint.includes("f2"));
    assert.equal(view.expectedMove, "f2");
    const paint = resolveGuideExpectedHintPaint(
      view.expectedMove!,
      view.currentIsDouble,
    );
    assert.equal(paint.token, "f2");
    assert.equal(paint.double, true);
  });

  it("M' 后 S' 的高亮层不是 M 的层", () => {
    let guide = createGuidedMoves(["z2", "M'", "S'"]);
    guide = { ...guide, progress: 1 };
    const confirmed = confirmGuidedManualStep(guide);
    assert.equal(confirmed.kind, "progress");
    guide = confirmed.guide;
    assert.equal(guide.progress, 2);
    const view = guidedScrambleView(guide);
    assert.equal(view.manualMove, "S'");
    const paint = guideViewHintPaintToken(view);
    assert.equal(paint, "S'");
    assert.equal(guideHintSliceFamily(paint), "S");
    assert.notEqual(guideHintSliceFamily(paint), "M");
  });

  it("f' 后画面底含已反转，不是旧姿态", () => {
    const formula = "z2";
    const oldPose = formula;
    const afterOne = layerAbsorbVisualBaseAlg(formula, "f", 1);
    assert.notEqual(afterOne, oldPose);
    assert.match(afterOne, /f'/);
    assert.equal(afterOne, "z2 f'");
    const afterTwo = layerAbsorbVisualBaseAlg(formula, "f", 2);
    assert.equal(afterTwo, "z2 f' f'");
    assert.notEqual(afterTwo, oldPose);
  });

  it("z2…f 后期望 R'：握持 R 不得映成 B'，应 absorb 还差 R2", () => {
    const moves = ["z2", "M'", "S'", "E'", "R'", "f", "R'"];
    const guide = { ...createGuidedMoves(moves), progress: 6 };
    assert.equal(guidedScrambleView(guide).expectedMove, "R'");
    const absGripR = remapGripTokenToPuzzleHint("R", ["z2"]);
    assert.equal(absGripR, "L");
    // 脏 relative / 层转残留抢在裸 z2 前：不得把握持 R（绝对 L）收成 B/F。
    const dirtyFirst = ["z2 y", "z2 z", "z2 x z' y z", "z2"];
    const step = stepGamePageBleAbsoluteFace(guide, absGripR, dirtyFirst);
    assert.notEqual(step.resolved, "B");
    assert.notEqual(step.resolved, "B'");
    assert.equal(step.resolved, "R");
    assert.equal(step.kind, "absorb");
    assert.equal(step.correction, null);
    assert.equal(guidedScrambleView(step.guide).expectedMove, "R2");
  });
});
