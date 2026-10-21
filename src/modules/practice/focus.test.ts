import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFormulaLibrary } from "../formula/formulas.ts";
import type { FormulaMethod } from "../formula/types.ts";
import { formulasForMethod } from "./browser.ts";
import {
  back,
  showFormulas,
  showLibrary,
  showMethods,
  showPractice,
  showTiming,
} from "./focus.ts";
import { practiceCase } from "./setup.ts";

const samplePath = new URL("../../data/formula-catalog.json", import.meta.url);

function loadMethods(): FormulaMethod[] {
  return parseFormulaLibrary(JSON.parse(readFileSync(samplePath, "utf8")));
}

describe("practice focus", () => {
  it("打乱计时默认不展开公式库", () => {
    assert.deepEqual(showTiming(), { kind: "计时" });
    assert.deepEqual(showLibrary(), { kind: "公式库" });
    assert.deepEqual(back(showLibrary()), { kind: "计时" });
  });

  it("选择 CFOP 后进入该分类", () => {
    const methods = loadMethods();
    const focus = showFormulas("cfop");
    const formulas = formulasForMethod(methods, "cfop");

    assert.deepEqual(showMethods(), { kind: "方法" });
    assert.deepEqual(focus, { kind: "公式", methodId: "cfop" });
    assert.ok(formulas?.some((formula) => formula.id === "oll-sune"));
    assert.equal(
      formulas?.some((formula) => formula.id === "lbl-corner-insert"),
      false,
    );
  });

  it("选中右手小鱼后进入练习，并仍生成练习状态", () => {
    const formulas = formulasForMethod(loadMethods(), "cfop");
    const sune = formulas?.find((formula) => formula.id === "oll-sune");
    const focus = showPractice(showFormulas("cfop"));

    assert.ok(sune);
    assert.deepEqual(focus, { kind: "练习", methodId: "cfop" });
    assert.deepEqual(practiceCase(sune), {
      id: "oll-sune",
      name: "右手小鱼",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
  });

  it("未进入公式列表时不会跳到练习", () => {
    assert.deepEqual(showPractice(showMethods()), { kind: "方法" });
  });

  it("从练习返回公式，再返回方法，再退出到打乱计时", () => {
    const practice = showPractice(showFormulas("roux"));
    const formulas = back(practice);
    const methods = back(formulas);
    const timing = back(methods);

    assert.deepEqual(formulas, { kind: "公式", methodId: "roux" });
    assert.deepEqual(methods, { kind: "方法" });
    assert.deepEqual(timing, { kind: "计时" });
  });
});
