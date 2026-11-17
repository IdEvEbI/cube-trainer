/**
 * 层转后交接 · 生成矩阵（第 1 层安全网）。
 * 规则对齐 docs/research-moyu-layer-capture.md「生成矩阵」；
 * E1–E17 仍由 layerHandoffMatrix.test.ts 锚定，本文件不替代。
 *
 * 改残留 / 映面决策：先改本文档化规则与本生成器，再改生产代码。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guideRotationStepConfirmable,
  orientationHoldStableMsForMove,
} from "../score/cubeOrientation.ts";
import {
  createGuideFollowController,
  isResidualLayerDualFaceMove,
  layerEchoFaceMoves,
} from "./guideFollowController.ts";
import { resolveGuideBleFaceMove } from "./layerGuideDualPaint.ts";

/** 常见层转（不做 *2）。 */
const LAYER_TOKENS = [
  "r",
  "r'",
  "l",
  "l'",
  "f",
  "f'",
  "b",
  "b'",
  "u",
  "u'",
  "d",
  "d'",
  "M",
  "M'",
  "E",
  "E'",
  "S",
  "S'",
] as const;

const FACE_TOKENS = [
  "U",
  "U'",
  "D",
  "D'",
  "L",
  "L'",
  "R",
  "R'",
  "F",
  "F'",
  "B",
  "B'",
] as const;

const ROTATION_TOKENS = ["x", "x'", "y", "y'", "z", "z'"] as const;

/** 白上 = 空公式朝向；黄上 = z2。 */
const ORIENT_CASES = [
  { id: "white", formulaOrients: [] as readonly string[] },
  { id: "yellow", formulaOrients: ["z2"] as readonly string[] },
] as const;

export type GeneratedFaceCase = {
  kind: "face";
  layer: string;
  next: string;
  ble: string;
  orientId: "white" | "yellow";
  formulaOrients: readonly string[];
  residualOn: boolean;
  /** reject = 对偶残留应丢弃 */
  want: "accept" | "reject";
};

export type GeneratedRotationCase = {
  kind: "rotation";
  layer: string;
  next: string;
  orientId: "white" | "yellow";
  want: "reject";
};

/**
 * 文档化决策（残留窗开）：与 isResidualLayerDualFaceMove 同构。
 * 故意写在测试侧，避免「生产改了、生成表跟着漂」。
 */
function generatedWantDiscardResidual(
  bleMove: string,
  expected: string,
  formulaOrients: readonly string[],
  completedLayer: string,
): boolean {
  const raw = bleMove.trim();
  const echo = layerEchoFaceMoves(completedLayer);
  if (echo.length === 0 || !echo.includes(raw)) {
    return false;
  }
  const exp = expected.trim();
  if (exp && raw === exp) {
    return false;
  }
  if (exp) {
    const formulaOrient = formulaOrients
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    // 只认公式朝向；层转脏 Δ 不得单独放行
    const viaFormula = resolveGuideBleFaceMove(raw, exp, formulaOrient);
    if (viaFormula === exp) {
      return false;
    }
  }
  return true;
}

function generateFaceCases(): GeneratedFaceCase[] {
  const out: GeneratedFaceCase[] = [];
  for (const layer of LAYER_TOKENS) {
    for (const next of FACE_TOKENS) {
      for (const ble of FACE_TOKENS) {
        for (const orient of ORIENT_CASES) {
          for (const residualOn of [true, false] as const) {
            const discard =
              residualOn &&
              generatedWantDiscardResidual(
                ble,
                next,
                orient.formulaOrients,
                layer,
              );
            out.push({
              kind: "face",
              layer,
              next,
              ble,
              orientId: orient.id,
              formulaOrients: orient.formulaOrients,
              residualOn,
              want: discard ? "reject" : "accept",
            });
          }
        }
      }
    }
  }
  return out;
}

function generateRotationCases(): GeneratedRotationCase[] {
  const out: GeneratedRotationCase[] = [];
  for (const layer of LAYER_TOKENS) {
    for (const next of ROTATION_TOKENS) {
      for (const orient of ORIENT_CASES) {
        out.push({
          kind: "rotation",
          layer,
          next,
          orientId: orient.id,
          want: "reject",
        });
      }
    }
  }
  return out;
}

const FACE_CASES = generateFaceCases();
const ROTATION_CASES = generateRotationCases();

describe("层转后交接 · 生成矩阵", () => {
  it(`面转组合共 ${FACE_CASES.length} 条；转体 0ms 共 ${ROTATION_CASES.length} 条`, () => {
    assert.equal(
      FACE_CASES.length,
      LAYER_TOKENS.length *
        FACE_TOKENS.length *
        FACE_TOKENS.length *
        ORIENT_CASES.length *
        2,
    );
    assert.equal(
      ROTATION_CASES.length,
      LAYER_TOKENS.length * ROTATION_TOKENS.length * ORIENT_CASES.length,
    );
  });

  it("面转：生产 isResidualLayerDualFaceMove 与生成期望一致（残留开）；关则不丢", () => {
    const ctrlOff = createGuideFollowController();
    let quietLayer = "";
    let ctrlOn = createGuideFollowController();
    let t = 1_000;
    for (const c of FACE_CASES) {
      if (!c.residualOn) {
        assert.equal(c.want, "accept");
        assert.equal(
          ctrlOff.shouldDiscardResidualLayerDual(
            c.ble,
            c.next,
            c.formulaOrients,
          ),
          false,
          `残留关应不丢: ${c.layer}→${c.next} ble=${c.ble} ${c.orientId}`,
        );
        continue;
      }
      const discard = isResidualLayerDualFaceMove(
        c.ble,
        c.next,
        c.formulaOrients,
        c.layer,
      );
      assert.equal(
        discard,
        c.want === "reject",
        `残留开不符: ${c.layer}→${c.next} ble=${c.ble} ${c.orientId} want=${c.want} gotDiscard=${discard}`,
      );
      if (quietLayer !== c.layer) {
        ctrlOn = createGuideFollowController();
        t += 1;
        ctrlOn.beginLayerEchoQuiet(t, c.layer);
        quietLayer = c.layer;
      }
      assert.equal(
        ctrlOn.shouldDiscardResidualLayerDual(c.ble, c.next, c.formulaOrients),
        c.want === "reject",
        `controller 残留开不符: ${c.layer}→${c.next} ble=${c.ble} ${c.orientId}`,
      );
    }
  });

  it("转体：进入 0ms 且无相对 hold → 不可确认", () => {
    for (const c of ROTATION_CASES) {
      const holdMs = orientationHoldStableMsForMove(c.next);
      const displayMoves =
        c.orientId === "yellow"
          ? (["z2", c.layer, c.next] as const)
          : ([c.layer, c.next] as const);
      const progress = c.orientId === "yellow" ? 2 : 1;
      const heldAlg = c.orientId === "yellow" ? `z2 ${c.next}` : c.next;
      const ok = guideRotationStepConfirmable({
        expectedMove: c.next,
        relativeCommittedAlg: "",
        heldAlg,
        displayMoves,
        progress,
        msSinceStepEnter: 0,
        holdMs,
      });
      assert.equal(
        ok,
        false,
        `转体 0ms 应 reject: ${c.layer}→${c.next} ${c.orientId}`,
      );
    }
  });
});

describe("层转后交接 · 生成矩阵 vs E 锚点", () => {
  type Anchor = {
    id: string;
    layer: string;
    next: string;
    ble: string;
    formulaOrients: readonly string[];
    want: "accept" | "reject";
    /** 超出本生成维时跳过对拍 */
    inScope: boolean;
  };

  const anchors: Anchor[] = [
    {
      id: "E1",
      layer: "f'",
      next: "L'",
      ble: "B'",
      formulaOrients: ["z2"],
      want: "reject",
      inScope: true,
    },
    {
      id: "E2",
      layer: "f'",
      next: "L'",
      ble: "L'",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: true,
    },
    {
      id: "E3",
      layer: "M'",
      next: "F'",
      ble: "L'",
      formulaOrients: ["z2"],
      want: "reject",
      inScope: true,
    },
    {
      id: "E4",
      layer: "S'",
      next: "F'",
      ble: "F'",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: true,
    },
    {
      id: "E5",
      layer: "S'",
      next: "F'",
      ble: "B'",
      formulaOrients: ["z2"],
      want: "reject",
      inScope: true,
    },
    {
      id: "E10",
      layer: "E",
      next: "U",
      ble: "U",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: true,
    },
    {
      id: "E11",
      layer: "r'",
      next: "U",
      ble: "U",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: true,
    },
    {
      id: "E12a",
      layer: "b",
      next: "R'",
      ble: "F",
      formulaOrients: ["z2"],
      want: "reject",
      inScope: true,
    },
    {
      id: "E12b",
      layer: "b",
      next: "R'",
      ble: "R'",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: true,
    },
    {
      id: "E14",
      layer: "r",
      next: "R",
      ble: "L",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: true,
    },
    // 超出：多朝向 / 多步 / 红测 / 转体满 hold
    {
      id: "E15",
      layer: "S'",
      next: "L",
      ble: "F",
      formulaOrients: ["z2", "y"],
      want: "accept",
      inScope: false,
    },
    {
      id: "E6",
      layer: "d'",
      next: "y'",
      ble: "",
      formulaOrients: ["z2"],
      want: "reject",
      inScope: false,
    },
    {
      id: "E13",
      layer: "r'",
      next: "R'",
      ble: "R'",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: false,
    },
    {
      id: "E17",
      layer: "b'",
      next: "R",
      ble: "D",
      formulaOrients: ["z2"],
      want: "accept",
      inScope: false,
    },
  ];

  it("范围内 E 锚点与生成期望无冲突", () => {
    const conflicts: string[] = [];
    const skipped: string[] = [];
    for (const a of anchors) {
      if (!a.inScope || !a.ble) {
        skipped.push(a.id);
        continue;
      }
      const discard = generatedWantDiscardResidual(
        a.ble,
        a.next,
        a.formulaOrients,
        a.layer,
      );
      const got: "accept" | "reject" = discard ? "reject" : "accept";
      if (got !== a.want) {
        conflicts.push(`${a.id}: anchor=${a.want} generated=${got}`);
      }
      const row = FACE_CASES.find(
        (c) =>
          c.residualOn &&
          c.layer === a.layer &&
          c.next === a.next &&
          c.ble === a.ble &&
          c.formulaOrients.join(" ") === a.formulaOrients.join(" "),
      );
      assert.ok(row, `${a.id} 应落在生成表内`);
      if (row.want !== a.want) {
        conflicts.push(`${a.id}: table=${row.want} anchor=${a.want}`);
      }
    }
    assert.deepEqual(conflicts, [], conflicts.join("; "));
    assert.ok(skipped.includes("E15"));
    assert.ok(skipped.includes("E6"));
  });
});
