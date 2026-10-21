import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formulaNames, parseAlgorithm, parseFormulas } from "./formulas.ts";

const samplePath = new URL("../../data/formulas-3x3.json", import.meta.url);

function loadSample() {
  return parseFormulas(JSON.parse(readFileSync(samplePath, "utf8")));
}

describe("parseFormulas", () => {
  it("按顺序读出示例公式名称", () => {
    const formulas = loadSample();

    assert.deepEqual(formulaNames(formulas), [
      "右手小鱼",
      "左手小鱼",
      "T 排列",
      "Ua 排列",
      "一线变十字",
    ]);
  });

  it("示例数据都是 3x3", () => {
    const formulas = loadSample();

    assert.equal(formulas.length, 5);
    assert.ok(formulas.every((formula) => formula.puzzle === "3x3"));
  });

  it("不是数组时拒绝", () => {
    assert.throws(() => parseFormulas({}), /公式数据必须是数组/);
  });

  it("缺少名称时拒绝", () => {
    assert.throws(
      () =>
        parseFormulas([
          { id: "sune", puzzle: "3x3", moves: "R U R' U R U2 R'" },
        ]),
      /第 1 条公式无效/,
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

  it("空名称时拒绝", () => {
    assert.throws(
      () =>
        parseFormulas([
          { id: "sune", name: "  ", puzzle: "3x3", moves: "R U R' U R U2 R'" },
        ]),
      /第 1 条公式无效/,
    );
  });
});
