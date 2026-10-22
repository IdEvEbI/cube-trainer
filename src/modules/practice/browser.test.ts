import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  formulasForSubclass,
  parseFormulaCatalog,
} from "../../data/catalog.ts";
import { parseAlgorithm, parseFormulaLibrary } from "../formula/formulas.ts";
import type { FormulaMethod } from "../formula/types.ts";
import {
  formulaGroup,
  groupFormulas,
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
    assert.equal(
      current?.forward,
      parseAlgorithm(currentFormula.moves).join(" "),
    );
    assert.equal(next?.id, "pll-y");
    assert.equal(next?.name, "Y 排列");
    assert.equal(next?.forward, parseAlgorithm(nextFormula.moves).join(" "));
    assert.notEqual(next?.name, current?.name);
    assert.notEqual(next?.forward, current?.forward);
    assert.equal(next?.inverse, invertAlgorithm(nextFormula.moves));
    assert.notEqual(next?.inverse, current?.inverse);
  });

  it("卡片和练习界面的 PLL 顺序一致", () => {
    const raw = JSON.parse(readFileSync(samplePath, "utf8"));
    const group = formulaGroup(loadMethods(), "cfop", "pll-ua");
    const oll = formulaGroup(loadMethods(), "cfop", "oll-sune");
    const cards = formulasForSubclass(
      parseFormulaCatalog(raw),
      "cfop",
      "cfop-pll",
    );
    const expected = [
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
    ];

    assert.ok(group);
    assert.ok(oll);
    assert.ok(cards);
    assert.deepEqual(
      cards.map((formula) => formula.id),
      expected,
    );
    assert.deepEqual(
      practiceList(group).map((formula) => formula.id),
      expected,
    );
    const ua = cards[0];
    assert.equal(ua?.name, "Ua 排列");
    assert.equal(ua?.moves, "(M2)(U M U2 M' U)(M2)");
    assert.equal(practiceList(group)[0]?.moves, ua?.moves);
    assert.deepEqual(
      practiceList(oll).map((formula) => formula.id),
      oll.formulas.map((formula) => formula.id),
    );
  });

  it("OLL 按形状分类，卡片和练习列表分组一致", () => {
    const raw = JSON.parse(readFileSync(samplePath, "utf8"));
    const cards = formulasForSubclass(
      parseFormulaCatalog(raw),
      "cfop",
      "cfop-oll",
    );
    const group = formulaGroup(loadMethods(), "cfop", "oll-line");
    const pll = formulaGroup(loadMethods(), "cfop", "pll-ua");

    assert.ok(cards);
    assert.ok(group);
    assert.ok(pll);
    const cardGroups = groupFormulas(cards);
    const practiceGroups = groupFormulas(practiceList(group));
    const names = [
      "点",
      "小拐弯",
      "一字",
      "十字",
      "T 形",
      "小鱼",
      "闪电",
      "方块",
      "P 形",
      "C 形",
      "W 形",
      "骑士",
      "别扭",
      "角块已朝向",
    ];

    assert.deepEqual(
      cardGroups.map((item) => item.name),
      names,
    );
    assert.deepEqual(
      practiceGroups.map((item) => item.name),
      names,
    );
    assert.deepEqual(
      cardGroups.map((item) => item.formulas.map((formula) => formula.id)),
      practiceGroups.map((item) => item.formulas.map((formula) => formula.id)),
    );
    const ids = (name: string) =>
      cardGroups
        .find((item) => item.name === name)
        ?.formulas.map((formula) => formula.id) ?? [];
    assert.deepEqual(ids("点").slice(0, 1), ["oll-dot"]);
    assert.ok(ids("一字").includes("oll-line"));
    assert.ok(ids("小拐弯").includes("oll-l"));
    assert.ok(ids("十字").includes("oll-h"));
    assert.deepEqual(ids("T 形"), ["oll-t"]);
    assert.ok(ids("小鱼").includes("oll-sune"));
    assert.ok(ids("小鱼").includes("oll-antisune"));
    assert.equal(cardGroups.flatMap((item) => item.formulas).length, 57);
    assert.deepEqual(
      groupFormulas(pll.formulas).map((item) => item.name),
      [null],
    );
    assert.equal(pll.formulas[0]?.id, "pll-ua");
    assert.equal(pll.formulas.at(-1)?.id, "pll-gd");
  });

  it("原先暂不支持的 OLL 现在可以练习，分组不变", () => {
    const group = formulaGroup(loadMethods(), "cfop", "oll-sune");
    const dotCase = group?.formulas.find(
      (formula) => formula.id === "oll-wca-1",
    );
    const sune = group?.formulas.find((formula) => formula.id === "oll-sune");

    assert.equal(group?.name, "OLL");
    assert.ok(sune);
    assert.equal(sune.group, "小鱼");
    assert.deepEqual(practiceCase(sune), {
      id: "oll-sune",
      name: "右手小鱼",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
    assert.ok(dotCase);
    assert.equal(dotCase.group, "点");
    assert.equal(dotCase.name, "OLL 1");
    assert.ok(practiceCase(dotCase));
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
