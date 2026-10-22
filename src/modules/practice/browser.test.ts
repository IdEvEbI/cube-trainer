import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFormulaLibrary } from "../formula/formulas.ts";
import type { FormulaMethod } from "../formula/types.ts";
import {
  formulaGroup,
  practiceList,
  formulasForMethod,
  methodNames,
  methodSteps,
} from "./browser.ts";
import { invertAlgorithm, practiceCase } from "./setup.ts";

const samplePath = new URL("../../data/formula-catalog.json", import.meta.url);

function loadMethods(): FormulaMethod[] {
  return parseFormulaLibrary(JSON.parse(readFileSync(samplePath, "utf8")));
}

describe("practice browser", () => {
  it("先列出层先法、CFOP 和桥式", () => {
    assert.deepEqual(methodNames(loadMethods()), [
      "层先法",
      "CFOP",
      "桥式",
      "盲拧",
    ]);
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
    const tPerm = formulas?.find((formula) => formula.id === "pll-t");
    assert.ok(tPerm);
    assert.equal(
      practiceCase(tPerm)?.inverse,
      "F R U' R' U R U R2 F' R U R U' R'",
    );
  });

  it("在 PLL 中从 T 排列切换到 Y 排列后更新步骤提示和练习状态", () => {
    const group = formulaGroup(loadMethods(), "cfop", "pll-t");
    const currentFormula = group?.formulas.find(
      (formula) => formula.id === "pll-t",
    );
    const nextFormula = group?.formulas.find(
      (formula) => formula.id === "pll-y",
    );
    const current = currentFormula ? practiceCase(currentFormula) : null;
    const next = nextFormula ? practiceCase(nextFormula) : null;

    assert.equal(group?.name, "PLL");
    assert.equal(
      group?.formulas.some((formula) => formula.id.startsWith("f2l-")),
      false,
    );
    assert.ok(currentFormula);
    assert.ok(nextFormula);
    assert.equal(current?.id, "pll-t");
    assert.equal(current?.name, "T 排列");
    assert.equal(current?.forward, currentFormula.moves);
    assert.equal(next?.id, "pll-y");
    assert.equal(next?.name, "Y 排列");
    assert.equal(next?.forward, nextFormula.moves);
    assert.notEqual(next?.name, current?.name);
    assert.notEqual(next?.forward, current?.forward);
    assert.equal(next?.inverse, invertAlgorithm(nextFormula.moves));
    assert.notEqual(next?.inverse, current?.inverse);
  });

  it("PLL 练习列表按 Ua 到 Gd 的顺序显示", () => {
    const group = formulaGroup(loadMethods(), "cfop", "pll-t");
    const oll = formulaGroup(loadMethods(), "cfop", "oll-sune");

    assert.ok(group);
    assert.ok(oll);
    assert.deepEqual(
      practiceList(group).map((formula) => formula.id),
      [
        "pll-ua",
        "pll-ub",
        "pll-h",
        "pll-z",
        "pll-aa",
        "pll-ab",
        "pll-e",
        "pll-t",
        "pll-f",
        "pll-v",
        "pll-y",
        "pll-ja",
        "pll-jb",
        "pll-ra",
        "pll-rb",
        "pll-na",
        "pll-nb",
        "pll-ga",
        "pll-gb",
        "pll-gc",
        "pll-gd",
      ],
    );
    const listed = practiceList(group);
    const ua = group.formulas.find((formula) => formula.id === "pll-ua");
    assert.equal(group.formulas[0]?.id, "pll-t");
    assert.equal(listed[0]?.id, "pll-ua");
    assert.equal(listed[0]?.name, "Ua 排列");
    assert.equal(listed[0]?.moves, ua?.moves);
    assert.equal(ua?.moves, "M2 U M U2 M' U M2");
    assert.deepEqual(
      practiceList(oll).map((formula) => formula.id),
      oll.formulas.map((formula) => formula.id),
    );
  });

  it("OLL 分组里未支持的公式仍不能练习", () => {
    const group = formulaGroup(loadMethods(), "cfop", "oll-sune");
    const dot = group?.formulas.find((formula) => formula.id === "oll-dot");
    const sune = group?.formulas.find((formula) => formula.id === "oll-sune");

    assert.equal(group?.name, "OLL");
    assert.ok(sune);
    assert.ok(practiceCase(sune));
    assert.ok(dot);
    assert.equal(practiceCase(dot), null);
    assert.equal(formulaGroup(loadMethods(), "cfop", "missing"), null);
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
