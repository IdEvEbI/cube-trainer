import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectFormulas,
  formulaNames,
  parseAlgorithm,
  parseFormulaLibrary,
} from "./formulas.ts";

const samplePath = new URL("../../data/formula-catalog.json", import.meta.url);

function loadSample() {
  return parseFormulaLibrary(JSON.parse(readFileSync(samplePath, "utf8")));
}

describe("parseFormulaLibrary", () => {
  it("打乱计时公式库能读到层先法、CFOP、桥式和盲拧", () => {
    const methods = loadSample();
    const cfop = methods.find((method) => method.id === "cfop");

    assert.deepEqual(
      methods.map((method) => method.name),
      ["层先法", "CFOP", "桥式", "盲拧"],
    );
    assert.deepEqual(
      methods[0]?.subclasses.map((subclass) => subclass.name),
      [
        "底层十字",
        "底层角块",
        "中层棱块",
        "顶层十字",
        "顶层面",
        "顶层角位置",
        "顶层棱位置",
      ],
    );
    assert.deepEqual(
      cfop?.subclasses.map((subclass) => subclass.name),
      ["Cross", "F2L", "OLL", "PLL"],
    );
    assert.equal(
      cfop?.subclasses.find((subclass) => subclass.id === "cfop-cross")?.note,
      "靠观察完成，通常不超过 8 步",
    );
    assert.deepEqual(
      methods[2]?.subclasses.map((subclass) => subclass.name),
      ["左桥", "右桥", "CMLL", "LSE"],
    );
    const formulas = collectFormulas(methods);
    for (const id of [
      "lbl-middle-left",
      "lbl-edge-cycle",
      "f2l-side",
      "oll-dot",
      "pll-ja",
      "cmll-diagonal",
      "lse-l4e",
      "bld-m2",
    ]) {
      assert.ok(formulas.some((formula) => formula.id === id));
    }
  });

  it("示例公式都是 3x3，并且都能按层转动", () => {
    const formulas = collectFormulas(loadSample());

    assert.ok(formulas.length > 5);
    assert.ok(formulas.every((formula) => formula.puzzle === "3x3"));
    for (const formula of formulas) {
      assert.ok(parseAlgorithm(formula.moves).length > 0);
    }
    assert.ok(formulaNames(formulas).includes("右手小鱼"));
    assert.ok(formulaNames(formulas).includes("T 排列"));
    assert.ok(formulaNames(formulas).includes("Ua 排列"));
  });

  it("不是数组时拒绝", () => {
    assert.throws(() => parseFormulaLibrary({}), /公式数据必须是数组/);
  });

  it("缺少名称时拒绝", () => {
    assert.throws(
      () =>
        parseFormulaLibrary([
          {
            id: "lbl",
            name: "层先法",
            subclasses: [
              {
                id: "top",
                name: "顶层面",
                formulas: [
                  { id: "sune", puzzle: "3x3", moves: "R U R' U R U2 R'" },
                ],
              },
            ],
          },
        ]),
      /第 1 条公式无效/,
    );
  });

  it("重复 id 时拒绝", () => {
    assert.throws(
      () =>
        parseFormulaLibrary([
          {
            id: "lbl",
            name: "层先法",
            subclasses: [
              {
                id: "top",
                name: "顶层面",
                formulas: [
                  {
                    id: "sune",
                    name: "右手小鱼",
                    puzzle: "3x3",
                    moves: "R U R' U R U2 R'",
                  },
                  {
                    id: "sune",
                    name: "另一条",
                    puzzle: "3x3",
                    moves: "R U R' U R U2 R'",
                  },
                ],
              },
            ],
          },
        ]),
      /公式 id 重复：sune/,
    );
  });

  it("按可选的 order 排列公式，没有 order 时保持原顺序", () => {
    const ordered = parseFormulaLibrary([
      {
        id: "cfop",
        name: "CFOP",
        subclasses: [
          {
            id: "cfop-pll",
            name: "PLL",
            formulas: [
              {
                id: "pll-t",
                name: "T 排列",
                moves: "R U R' U' R' F R2 U' R' U' R U R' F'",
                order: 2,
              },
              {
                id: "pll-ua",
                name: "Ua 排列",
                moves: "M2 U M U2 M' U M2",
                order: 1,
              },
            ],
          },
        ],
      },
    ]);
    const kept = parseFormulaLibrary([
      {
        id: "cfop",
        name: "CFOP",
        subclasses: [
          {
            id: "cfop-oll",
            name: "OLL",
            formulas: [
              { id: "oll-line", name: "一字", moves: "F R U R' U' F'" },
              { id: "oll-l", name: "小拐弯", moves: "F U R U' R' F'" },
            ],
          },
        ],
      },
    ]);

    assert.deepEqual(
      ordered[0]?.subclasses[0]?.formulas.map((formula) => formula.id),
      ["pll-ua", "pll-t"],
    );
    assert.deepEqual(
      kept[0]?.subclasses[0]?.formulas.map((formula) => formula.id),
      ["oll-line", "oll-l"],
    );
    assert.throws(
      () =>
        parseFormulaLibrary([
          {
            id: "cfop",
            name: "CFOP",
            subclasses: [
              {
                id: "cfop-pll",
                name: "PLL",
                formulas: [
                  {
                    id: "pll-ua",
                    name: "Ua 排列",
                    moves: "M2 U M U2 M' U M2",
                    order: 1,
                  },
                  {
                    id: "pll-ub",
                    name: "Ub 排列",
                    moves: "M2 U' M U2 M' U' M2",
                  },
                ],
              },
            ],
          },
        ]),
      /顺序不完整/,
    );
  });

  it("省略 puzzle 时默认为 3x3", () => {
    const methods = parseFormulaLibrary([
      {
        id: "lbl",
        name: "层先法",
        subclasses: [
          {
            id: "top",
            name: "顶层面",
            formulas: [
              { id: "sune", name: "右手小鱼", moves: "R U R' U R U2 R'" },
            ],
          },
        ],
      },
    ]);

    assert.equal(collectFormulas(methods)[0]?.puzzle, "3x3");
  });

  it("把右手小鱼的算法拆成层转动", () => {
    assert.deepEqual(parseAlgorithm("R U R' U R U2 R'"), [
      "R",
      "U",
      "R'",
      "U",
      "R",
      "U2",
      "R'",
    ]);
  });

  it("把含中层的算法拆开", () => {
    assert.deepEqual(parseAlgorithm("M2 U M U2 M' U M2"), [
      "M2",
      "U",
      "M",
      "U2",
      "M'",
      "U",
      "M2",
    ]);
  });

  it("拒绝整颗转动和空算法", () => {
    assert.throws(() => parseAlgorithm("R U X"), /无法按层转动：X/);
    assert.throws(() => parseAlgorithm("   "), /算法是空的/);
  });
});
