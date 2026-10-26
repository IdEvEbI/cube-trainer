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
    const sune = formulas?.find((formula) => formula.id === "oll-wca-27");

    assert.ok(steps?.some((step) => step.name === "OLL"));
    assert.ok(formulas?.some((formula) => formula.id === "oll-wca-45"));
    assert.equal(
      formulas?.some((formula) => formula.id === "lbl-corner-insert"),
      false,
    );
    assert.ok(sune);
    assert.deepEqual(practiceCase(sune), {
      id: "oll-wca-27",
      name: "OLL 27",
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
    const oll = formulaGroup(loadMethods(), "cfop", "oll-wca-27");
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
    assert.equal(ua?.moves, "(M'2)(U M U2 M' U)(M'2)");
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
    const group = formulaGroup(loadMethods(), "cfop", "oll-wca-45");
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
      "oll-wca-21",
      "oll-wca-22",
      "oll-wca-23",
      "oll-wca-24",
      "oll-wca-25",
      "oll-wca-26",
      "oll-wca-27",
    ]);
    assert.ok(ids("直线 OLL").includes("oll-wca-45"));
    assert.ok(ids("直线 OLL").includes("oll-wca-33"));
    assert.ok(ids("直线 OLL").includes("oll-wca-15"));
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
    assert.ok(ids("肥鱼 OLL").includes("oll-wca-44"));
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

  it("F2L 按 Wiki 分组正确显示", () => {
    const raw = JSON.parse(readFileSync(samplePath, "utf8"));
    const cards = formulasForSubclass(
      parseFormulaCatalog(raw),
      "cfop",
      "cfop-f2l",
    );
    const group = formulaGroup(loadMethods(), "cfop", "f2l-4");

    assert.ok(cards);
    assert.ok(group);
    const cardGroups = groupFormulas(cards);
    const names = [
      "基础插入",
      "调整棱块",
      "调整棱块并翻角",
      "越过拆对",
      "侧面成对",
      "特殊情况",
      "角在槽、棱在顶",
      "棱在槽、角在顶",
      "角棱都在槽",
      "空槽插入",
    ];
    const counts = [4, 4, 4, 4, 4, 4, 4, 4, 9, 19];

    assert.deepEqual(
      cardGroups.map((item) => item.name),
      names,
    );
    assert.deepEqual(
      cardGroups.map((item) => item.formulas.length),
      counts,
    );
    assert.equal(cardGroups.flatMap((item) => item.formulas).length, 60);
    assert.equal(cards.filter((formula) => !formula.emptySlot).length, 41);

    const ids = (name: string) =>
      cardGroups
        .find((item) => item.name === name)
        ?.formulas.map((formula) => formula.id) ?? [];

    assert.deepEqual(ids("基础插入"), ["f2l-1", "f2l-2", "f2l-3", "f2l-4"]);
    assert.deepEqual(ids("调整棱块"), ["f2l-5", "f2l-6", "f2l-7", "f2l-8"]);
    assert.deepEqual(ids("调整棱块并翻角"), [
      "f2l-9",
      "f2l-10",
      "f2l-11",
      "f2l-12",
    ]);
    assert.deepEqual(ids("越过拆对"), ["f2l-13", "f2l-14", "f2l-15", "f2l-16"]);
    assert.deepEqual(ids("侧面成对"), ["f2l-17", "f2l-18", "f2l-19", "f2l-20"]);
    assert.deepEqual(ids("特殊情况"), ["f2l-21", "f2l-22", "f2l-23", "f2l-24"]);
    assert.deepEqual(ids("角在槽、棱在顶"), [
      "f2l-25",
      "f2l-26",
      "f2l-27",
      "f2l-28",
    ]);
    assert.deepEqual(ids("棱在槽、角在顶"), [
      "f2l-29",
      "f2l-30",
      "f2l-31",
      "f2l-32",
    ]);
    assert.deepEqual(
      ids("角棱都在槽"),
      Array.from({ length: 9 }, (_, i) => `f2l-${33 + i}`),
    );

    assert.deepEqual(
      groupFormulas(practiceList(group)).map((item) => item.name),
      names,
    );
    const first = cards.find((formula) => formula.id === "f2l-1");
    const last = cards.find((formula) => formula.id === "f2l-41");
    assert.ok(first);
    assert.ok(last);
    assert.ok(practiceCase(first));
    assert.ok(practiceCase(last));
    assert.equal(first.algs?.includes("(R' F R F')"), true);
  });

  it("练习列表分类能正确折叠展开，切换公式后展开选中分类", () => {
    const group = formulaGroup(loadMethods(), "cfop", "oll-wca-27");
    assert.ok(group);
    const formulas = practiceList(group);
    const groups = groupFormulas(formulas);
    assert.equal(groups.length, 6);

    assert.equal(groupNameForFormula(formulas, "oll-wca-27"), "十字 OLL");
    assert.equal(groupNameForFormula(formulas, "oll-wca-1"), "点 OLL");
    assert.equal(groupNameForFormula(formulas, "missing"), null);

    let openNames = openPracticeGroups([], formulas, "oll-wca-27");
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

    openNames = openPracticeGroups(["点 OLL"], formulas, "oll-wca-27");
    assert.deepEqual(openNames, ["十字 OLL"]);
    assert.equal(isPracticeGroupOpen(openNames, "点 OLL"), false);

    const sune = formulas.find((formula) => formula.id === "oll-wca-27");
    const dot = formulas.find((formula) => formula.id === "oll-wca-1");
    assert.ok(sune);
    assert.ok(dot);
    const suneCase = practiceCase(sune);
    const dotCase = practiceCase(dot);
    assert.ok(suneCase);
    assert.ok(dotCase);
    assert.notEqual(suneCase.forward, dotCase.forward);
    assert.equal(suneCase.id, "oll-wca-27");
    assert.equal(dotCase.id, "oll-wca-1");

    const f2l = formulaGroup(loadMethods(), "cfop", "f2l-4");
    assert.ok(f2l);
    const f2lFormulas = practiceList(f2l);
    assert.equal(groupFormulas(f2lFormulas).length, 10);
    assert.equal(groupNameForFormula(f2lFormulas, "f2l-4"), "基础插入");
    assert.equal(groupNameForFormula(f2lFormulas, "f2l-32"), "棱在槽、角在顶");

    openNames = openPracticeGroups([], f2lFormulas, "f2l-4");
    assert.deepEqual(openNames, ["基础插入"]);
    assert.equal(isPracticeGroupOpen(openNames, "基础插入"), true);
    assert.equal(isPracticeGroupOpen(openNames, "调整棱块"), false);

    openNames = togglePracticeGroup(openNames, "调整棱块");
    assert.deepEqual(openNames, ["调整棱块"]);
    assert.equal(isPracticeGroupOpen(openNames, "基础插入"), false);

    openNames = togglePracticeGroup(openNames, "角棱都在槽");
    assert.deepEqual(openNames, ["角棱都在槽"]);

    openNames = togglePracticeGroup(openNames, "角棱都在槽");
    assert.deepEqual(openNames, []);

    openNames = openPracticeGroups(["调整棱块"], f2lFormulas, "f2l-37");
    assert.deepEqual(openNames, ["角棱都在槽"]);
    assert.equal(isPracticeGroupOpen(openNames, "调整棱块"), false);
    const separated = f2lFormulas.find((formula) => formula.id === "f2l-5");
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
    const group = formulaGroup(loadMethods(), "cfop", "oll-wca-27");
    const dotCase = group?.formulas.find(
      (formula) => formula.id === "oll-wca-1",
    );
    const sune = group?.formulas.find((formula) => formula.id === "oll-wca-27");

    assert.equal(group?.name, "OLL");
    assert.ok(sune);
    assert.equal(sune.group, "十字 OLL");
    assert.deepEqual(practiceCase(sune), {
      id: "oll-wca-27",
      name: "OLL 27",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
    assert.ok(dotCase);
    assert.equal(dotCase.group, "点 OLL");
    assert.equal(dotCase.name, "OLL 1");
    assert.ok(practiceCase(dotCase));
    assert.equal(formulaGroup(loadMethods(), "cfop", "missing"), null);
  });

  it("OLL 名称与 id 均为 WCA 编号", () => {
    const formulas = formulaGroup(
      loadMethods(),
      "cfop",
      "oll-wca-27",
    )?.formulas;
    assert.ok(formulas);
    assert.equal(formulas.length, 57);
    for (const formula of formulas) {
      assert.match(formula.id, /^oll-wca-\d+$/, formula.id);
      assert.equal(
        formula.name,
        `OLL ${formula.id.slice("oll-wca-".length)}`,
        formula.id,
      );
    }
    assert.equal(
      formulas.find((formula) => formula.id === "oll-wca-27")?.name,
      "OLL 27",
    );
    assert.equal(
      formulas.find((formula) => formula.id === "oll-wca-21")?.name,
      "OLL 21",
    );
    assert.equal(
      formulas.find((formula) => formula.id === "oll-wca-45")?.name,
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
