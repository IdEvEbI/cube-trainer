import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFormulaCatalog } from "../../data/catalog.ts";
import { back, showPractice, showTiming } from "./focus.ts";
import {
  defaultPracticeFormula,
  formulaPickerCode,
  formulaPickerPath,
  practiceCaseFromPicker,
  practicePickerGroups,
  practicePickerSteps,
  shouldCloseFormulaPickerOnOutsideClick,
} from "./formulaPicker.ts";

const catalogPath = new URL("../../data/formula-catalog.json", import.meta.url);
const catalog = parseFormulaCatalog(
  JSON.parse(readFileSync(catalogPath, "utf8")),
);

describe("practice entry after removing method / card pages", () => {
  it("首页练习入口直接进入 CFOP 练习", () => {
    assert.deepEqual(showPractice(), { kind: "练习", methodId: "cfop" });
    assert.deepEqual(back(showPractice()), { kind: "计时" });
    assert.deepEqual(back(showTiming()), { kind: "计时" });
  });

  it("选择器只有 F2L / OLL / PLL，不含方法页其它体系", () => {
    const steps = practicePickerSteps(catalog);
    assert.deepEqual(
      steps.map((step) => step.name),
      ["F2L", "OLL", "PLL"],
    );
    assert.equal(
      catalog.some((method) => method.id === "lbl" || method.id === "roux"),
      true,
    );
  });
});

describe("practiceCaseFromPicker", () => {
  it("公式选择后练习状态正确生成", () => {
    const oll = practicePickerSteps(catalog).find(
      (step) => step.id === "cfop-oll",
    );
    assert.ok(oll);
    const groups = practicePickerGroups(oll);
    const sune = groups
      .flatMap((group) => group.formulas)
      .find((formula) => formula.id === "oll-wca-27");
    assert.ok(sune);

    const setup = practiceCaseFromPicker(sune);
    assert.deepEqual(setup, {
      id: "oll-wca-27",
      name: "OLL 27",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
    assert.equal(formulaPickerCode(sune, 0), "27");
  });

  it("切换分组后仍能生成练习状态", () => {
    const f2l = practicePickerSteps(catalog).find(
      (step) => step.id === "cfop-f2l",
    );
    assert.ok(f2l);
    const groups = practicePickerGroups(f2l);
    assert.ok(groups.length > 0);
    const first = groups[0]!.formulas[0]!;
    const setup = practiceCaseFromPicker(first);
    assert.ok(setup);
    assert.equal(setup.id, first.id);
    assert.ok(setup.inverse.length > 0);
  });
});

describe("defaultPracticeFormula + formulaPickerPath", () => {
  it("未选中时默认是 F2L 第一条公式", () => {
    const first = defaultPracticeFormula(catalog);
    assert.ok(first);
    assert.equal(first.id, "f2l-1");
    assert.ok(practiceCaseFromPicker(first));
  });

  it("选中后路径为 步骤 / 分组 / 名称", () => {
    const path = formulaPickerPath(catalog, "f2l-1");
    assert.equal(path, "F2L / 基础插入 / F2L 1");
    assert.equal(formulaPickerPath(catalog, null), null);
  });
});

describe("shouldCloseFormulaPickerOnOutsideClick", () => {
  it("点击外部关闭后当前公式不变", () => {
    const selectedId = "f2l-1";
    const before = formulaPickerPath(catalog, selectedId);

    const inside = {} as Node;
    const outside = {} as Node;
    const root = {
      contains(node: Node) {
        return node === inside || node === (root as unknown as Node);
      },
    } as unknown as Element;

    assert.equal(shouldCloseFormulaPickerOnOutsideClick(outside, root), true);
    assert.equal(shouldCloseFormulaPickerOnOutsideClick(inside, root), false);
    assert.equal(shouldCloseFormulaPickerOnOutsideClick(root, root), false);
    assert.equal(shouldCloseFormulaPickerOnOutsideClick(null, root), false);

    // Dismiss only closes the panel; selection is unchanged.
    assert.equal(formulaPickerPath(catalog, selectedId), before);
  });
});
