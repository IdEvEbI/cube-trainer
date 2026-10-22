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
  groupNameForFormula,
  isPracticeGroupOpen,
  openPracticeGroups,
  practiceList,
  formulasForMethod,
  methodNames,
  methodSteps,
  togglePracticeGroup,
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

  it("选择 CFOP 后进入该分类，点击 OLL 27 仍生成练习状态", () => {
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
      name: "OLL 27（Sune）",
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

  it("OLL 按截图分类正确分组", () => {
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
    const names = [
      "十字 OLL",
      "直线 OLL",
      "点 OLL",
      "拐角 OLL",
      "肥鱼 OLL",
      "其他 OLL",
    ];
    const counts = [7, 14, 10, 8, 10, 8];

    assert.deepEqual(
      cardGroups.map((item) => item.name),
      names,
    );
    assert.deepEqual(
      cardGroups.map((item) => item.formulas.length),
      counts,
    );
    assert.equal(cardGroups.flatMap((item) => item.formulas).length, 57);

    const ids = (name: string) =>
      cardGroups
        .find((item) => item.name === name)
        ?.formulas.map((formula) => formula.id) ?? [];

    assert.deepEqual(ids("十字 OLL"), [
      "oll-h",
      "oll-pi",
      "oll-u",
      "oll-wca-24",
      "oll-wca-25",
      "oll-antisune",
      "oll-sune",
    ]);
    assert.ok(ids("直线 OLL").includes("oll-line"));
    assert.ok(ids("直线 OLL").includes("oll-t"));
    assert.deepEqual(ids("点 OLL").slice(0, 4), [
      "oll-wca-1",
      "oll-wca-2",
      "oll-wca-3",
      "oll-wca-4",
    ]);
    assert.ok(ids("点 OLL").includes("oll-wca-28"));
    assert.ok(ids("点 OLL").includes("oll-wca-57"));
    assert.ok(ids("拐角 OLL").includes("oll-wca-47"));
    assert.ok(ids("拐角 OLL").includes("oll-wca-9"));
    assert.ok(ids("肥鱼 OLL").includes("oll-wca-7"));
    assert.ok(ids("肥鱼 OLL").includes("oll-l"));
    assert.ok(ids("其他 OLL").includes("oll-wca-29"));
    assert.ok(ids("其他 OLL").includes("oll-wca-36"));

    assert.deepEqual(
      groupFormulas(practiceList(group)).map((item) => item.name),
      names,
    );
    assert.deepEqual(
      groupFormulas(pll.formulas).map((item) => item.name),
      [null],
    );
    assert.equal(pll.formulas[0]?.id, "pll-ua");
    assert.equal(pll.formulas.at(-1)?.id, "pll-gd");
  });

  it("F2L 按分组正确显示", () => {
    const raw = JSON.parse(readFileSync(samplePath, "utf8"));
    const cards = formulasForSubclass(
      parseFormulaCatalog(raw),
      "cfop",
      "cfop-f2l",
    );
    const group = formulaGroup(loadMethods(), "cfop", "f2l-paired");

    assert.ok(cards);
    assert.ok(group);
    const cardGroups = groupFormulas(cards);
    const names = [
      "基础插入",
      "顶层分开",
      "角在槽里",
      "棱在槽里",
      "连在一起",
      "都在槽里",
    ];
    const counts = [8, 10, 4, 6, 9, 5];

    assert.deepEqual(
      cardGroups.map((item) => item.name),
      names,
    );
    assert.deepEqual(
      cardGroups.map((item) => item.formulas.length),
      counts,
    );
    assert.equal(cardGroups.flatMap((item) => item.formulas).length, 42);

    const ids = (name: string) =>
      cardGroups
        .find((item) => item.name === name)
        ?.formulas.map((formula) => formula.id) ?? [];

    assert.deepEqual(ids("基础插入"), [
      "f2l-paired",
      "f2l-join",
      "f2l-split",
      "f2l-white-front",
      "f2l-white-up",
      "f2l-side",
      "f2l-1-2",
      "f2l-1-4",
    ]);
    assert.deepEqual(ids("顶层分开"), [
      "f2l-2-1",
      "f2l-2-2",
      "f2l-2-3",
      "f2l-2-4",
      "f2l-2-5",
      "f2l-2-6",
      "f2l-2-7",
      "f2l-2-8",
      "f2l-2-9",
      "f2l-2-10",
    ]);
    assert.deepEqual(ids("角在槽里"), [
      "f2l-3-1",
      "f2l-3-2",
      "f2l-3-4",
      "f2l-3-6",
    ]);
    assert.deepEqual(ids("棱在槽里"), [
      "f2l-4-1",
      "f2l-4-2",
      "f2l-4-3",
      "f2l-4-4",
      "f2l-4-5",
      "f2l-4-6",
    ]);
    assert.deepEqual(ids("连在一起"), [
      "f2l-5-1",
      "f2l-5-2",
      "f2l-5-3",
      "f2l-5-4",
      "f2l-5-5",
      "f2l-5-6",
      "f2l-5-8",
      "f2l-5-9",
      "f2l-5-10",
    ]);
    assert.deepEqual(ids("都在槽里"), [
      "f2l-6-1",
      "f2l-6-2",
      "f2l-6-3",
      "f2l-6-4",
      "f2l-6-5",
    ]);

    assert.deepEqual(
      groupFormulas(practiceList(group)).map((item) => item.name),
      names,
    );
    const paired = cards.find((formula) => formula.id === "f2l-paired");
    const last = cards.find((formula) => formula.id === "f2l-6-5");
    assert.ok(paired);
    assert.ok(last);
    assert.ok(practiceCase(paired));
    assert.ok(practiceCase(last));
  });

  it("练习列表分类能正确折叠展开，切换公式后展开选中分类", () => {
    const group = formulaGroup(loadMethods(), "cfop", "oll-sune");
    assert.ok(group);
    const formulas = practiceList(group);
    const groups = groupFormulas(formulas);
    assert.equal(groups.length, 6);

    assert.equal(groupNameForFormula(formulas, "oll-sune"), "十字 OLL");
    assert.equal(groupNameForFormula(formulas, "oll-wca-1"), "点 OLL");
    assert.equal(groupNameForFormula(formulas, "missing"), null);

    let openNames = openPracticeGroups([], formulas, "oll-sune");
    assert.deepEqual(openNames, ["十字 OLL"]);
    assert.equal(isPracticeGroupOpen(openNames, "十字 OLL"), true);
    assert.equal(isPracticeGroupOpen(openNames, "点 OLL"), false);

    openNames = togglePracticeGroup(openNames, "点 OLL");
    assert.deepEqual(openNames, ["点 OLL"]);
    assert.equal(isPracticeGroupOpen(openNames, "十字 OLL"), false);
    assert.equal(isPracticeGroupOpen(openNames, "点 OLL"), true);

    openNames = togglePracticeGroup(openNames, "拐角 OLL");
    assert.deepEqual(openNames, ["拐角 OLL"]);
    assert.equal(isPracticeGroupOpen(openNames, "点 OLL"), false);

    openNames = togglePracticeGroup(openNames, "拐角 OLL");
    assert.deepEqual(openNames, []);

    openNames = openPracticeGroups(["点 OLL"], formulas, "oll-sune");
    assert.deepEqual(openNames, ["十字 OLL"]);
    assert.equal(isPracticeGroupOpen(openNames, "点 OLL"), false);

    const sune = formulas.find((formula) => formula.id === "oll-sune");
    const dot = formulas.find((formula) => formula.id === "oll-wca-1");
    assert.ok(sune);
    assert.ok(dot);
    const suneCase = practiceCase(sune);
    const dotCase = practiceCase(dot);
    assert.ok(suneCase);
    assert.ok(dotCase);
    assert.notEqual(suneCase.forward, dotCase.forward);
    assert.equal(suneCase.id, "oll-sune");
    assert.equal(dotCase.id, "oll-wca-1");

    const f2l = formulaGroup(loadMethods(), "cfop", "f2l-paired");
    assert.ok(f2l);
    const f2lFormulas = practiceList(f2l);
    assert.equal(groupFormulas(f2lFormulas).length, 6);
    assert.equal(groupNameForFormula(f2lFormulas, "f2l-paired"), "基础插入");
    assert.equal(groupNameForFormula(f2lFormulas, "f2l-4-1"), "棱在槽里");

    openNames = openPracticeGroups([], f2lFormulas, "f2l-paired");
    assert.deepEqual(openNames, ["基础插入"]);
    assert.equal(isPracticeGroupOpen(openNames, "基础插入"), true);
    assert.equal(isPracticeGroupOpen(openNames, "顶层分开"), false);

    openNames = togglePracticeGroup(openNames, "顶层分开");
    assert.deepEqual(openNames, ["顶层分开"]);
    assert.equal(isPracticeGroupOpen(openNames, "基础插入"), false);

    openNames = togglePracticeGroup(openNames, "都在槽里");
    assert.deepEqual(openNames, ["都在槽里"]);

    openNames = togglePracticeGroup(openNames, "都在槽里");
    assert.deepEqual(openNames, []);

    openNames = openPracticeGroups(["顶层分开"], f2lFormulas, "f2l-6-1");
    assert.deepEqual(openNames, ["都在槽里"]);
    assert.equal(isPracticeGroupOpen(openNames, "顶层分开"), false);
    const separated = f2lFormulas.find((formula) => formula.id === "f2l-2-1");
    assert.ok(separated);
    assert.ok(practiceCase(separated));

    const pll = formulaGroup(loadMethods(), "cfop", "pll-ua");
    assert.ok(pll);
    assert.deepEqual(
      groupFormulas(practiceList(pll)).map((item) => item.name),
      [null],
    );
    assert.equal(isPracticeGroupOpen([], null), true);
  });

  it("原先暂不支持的 OLL 现在可以练习，新分类下仍可练习", () => {
    const group = formulaGroup(loadMethods(), "cfop", "oll-sune");
    const dotCase = group?.formulas.find(
      (formula) => formula.id === "oll-wca-1",
    );
    const sune = group?.formulas.find((formula) => formula.id === "oll-sune");

    assert.equal(group?.name, "OLL");
    assert.ok(sune);
    assert.equal(sune.group, "十字 OLL");
    assert.deepEqual(practiceCase(sune), {
      id: "oll-sune",
      name: "OLL 27（Sune）",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
    assert.ok(dotCase);
    assert.equal(dotCase.group, "点 OLL");
    assert.equal(dotCase.name, "OLL 1");
    assert.ok(practiceCase(dotCase));
    assert.equal(formulaGroup(loadMethods(), "cfop", "missing"), null);
  });

  it("OLL 名称按标准数字显示，常见别名写在括号里", () => {
    const formulas = formulaGroup(loadMethods(), "cfop", "oll-sune")?.formulas;
    assert.ok(formulas);
    assert.equal(formulas.length, 57);
    for (const formula of formulas) {
      assert.match(formula.name, /^OLL \d+(（.+）)?$/, formula.id);
    }
    assert.equal(
      formulas.find((formula) => formula.id === "oll-sune")?.name,
      "OLL 27（Sune）",
    );
    assert.equal(
      formulas.find((formula) => formula.id === "oll-h")?.name,
      "OLL 21（H）",
    );
    assert.equal(
      formulas.find((formula) => formula.id === "oll-line")?.name,
      "OLL 45",
    );
    assert.equal(
      formulas.find((formula) => formula.id === "oll-wca-1")?.name,
      "OLL 1",
    );
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
