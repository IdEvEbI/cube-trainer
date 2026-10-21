import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectFormulas,
  formulaNames,
  parseAlgorithm,
  parseFormulaLibrary,
} from "./formulas.ts";

const samplePath = new URL("../../data/formulas-3x3.json", import.meta.url);

function loadSample() {
  return parseFormulaLibrary(JSON.parse(readFileSync(samplePath, "utf8")));
}

describe("parseFormulaLibrary", () => {
  it("按层先法、CFOP、桥式三级列出步骤", () => {
    const methods = loadSample();

    assert.deepEqual(
      methods.map((method) => method.name),
      ["层先法", "CFOP", "桥式"],
    );
    assert.deepEqual(
      methods[0]?.steps.map((step) => step.name),
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
      methods[1]?.steps.map((step) => step.name),
      ["Cross", "F2L", "OLL", "PLL"],
    );
    assert.deepEqual(
      methods[2]?.steps.map((step) => step.name),
      ["左桥", "右桥", "CMLL", "LSE"],
    );
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
            steps: [
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
            steps: [
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
