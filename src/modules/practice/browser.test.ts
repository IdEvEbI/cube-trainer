import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFormulaLibrary } from "../formula/formulas.ts";
import type { FormulaMethod } from "../formula/types.ts";
import { formulasForMethod, methodNames, methodSteps } from "./browser.ts";
import { practiceCase } from "./setup.ts";

const samplePath = new URL("../../data/formulas-3x3.json", import.meta.url);

function loadMethods(): FormulaMethod[] {
  return parseFormulaLibrary(JSON.parse(readFileSync(samplePath, "utf8")));
}

describe("practice browser", () => {
  it("先列出层先法、CFOP 和桥式", () => {
    assert.deepEqual(methodNames(loadMethods()), ["层先法", "CFOP", "桥式"]);
  });

  it("选择 CFOP 后进入该分类，点击右手小鱼仍生成练习状态", () => {
    const methods = loadMethods();
    const steps = methodSteps(methods, "cfop");
    const formulas = formulasForMethod(methods, "cfop");
    const sune = formulas?.find((formula) => formula.id === "oll-sune");

    assert.ok(steps?.some((step) => step.name === "OLL"));
    assert.ok(formulas?.some((formula) => formula.id === "oll-line"));
    assert.equal(
      formulas?.some((formula) => formula.id === "lbl-corner-insert"),
      false,
    );
    assert.ok(sune);
    assert.deepEqual(practiceCase(sune), {
      id: "oll-sune",
      name: "右手小鱼",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
  });

  it("选择层先法只进入层先法", () => {
    const formulas = formulasForMethod(loadMethods(), "lbl");

    assert.ok(formulas && formulas.length > 0);
    assert.equal(
      formulas.some((formula) => formula.id.startsWith("oll-")),
      false,
    );
  });

  it("没有的方法不进入分类", () => {
    assert.equal(methodSteps(loadMethods(), "missing"), null);
    assert.equal(formulasForMethod(loadMethods(), "missing"), null);
  });
});
