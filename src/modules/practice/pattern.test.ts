import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";
import { CUBE_ORIENTATION_ALG } from "../cube/cube.ts";
import { parseFormulaLibrary } from "../formula/formulas.ts";
import type { Formula } from "../formula/types.ts";
import { formulaPattern, type TopSticker } from "./pattern.ts";
import { practiceCase } from "./setup.ts";

const samplePath = new URL("../../data/formula-catalog.json", import.meta.url);

const U_SLOTS = [
  ["CORNERS", 2, 0],
  ["EDGES", 2, 0],
  ["CORNERS", 1, 0],
  ["EDGES", 3, 0],
  ["CENTERS", 0, 0],
  ["EDGES", 1, 0],
  ["CORNERS", 3, 0],
  ["EDGES", 0, 0],
  ["CORNERS", 0, 0],
] as const;

function loadFormulas(): Formula[] {
  const methods = parseFormulaLibrary(
    JSON.parse(readFileSync(samplePath, "utf8")),
  );
  return methods.flatMap((method) =>
    method.subclasses.flatMap((subclass) => subclass.formulas),
  );
}

function rememberYellow(pattern: KPattern): Map<string, number> {
  const yellow = new Map<string, number>();
  for (const [orbit, location, orientation] of U_SLOTS) {
    if (orbit === "CENTERS") {
      continue;
    }
    const data = pattern.patternData[orbit];
    if (!data) {
      throw new Error("无法读取顶层");
    }
    const piece = data.pieces[location];
    const turned = data.orientation[location] ?? 0;
    const count = orbit === "CORNERS" ? 3 : 2;
    yellow.set(`${orbit}:${piece}`, (orientation - turned + count) % count);
  }
  return yellow;
}

function topMask(pattern: KPattern, yellow: Map<string, number>): TopSticker[] {
  return U_SLOTS.map(([orbit, location, orientation]) => {
    if (orbit === "CENTERS") {
      return "黄";
    }
    const data = pattern.patternData[orbit];
    if (!data) {
      throw new Error("无法读取顶层");
    }
    const piece = data.pieces[location];
    const turned = data.orientation[location] ?? 0;
    const count = orbit === "CORNERS" ? 3 : 2;
    const showing = (orientation - turned + count) % count;
    return yellow.get(`${orbit}:${piece}`) === showing ? "黄" : "其他";
  });
}

describe("formulaPattern", () => {
  it("四条 OLL 显示和练习状态一致的顶层图案", async () => {
    const formulas = loadFormulas().filter((formula) =>
      ["oll-line", "oll-l", "oll-sune", "oll-antisune"].includes(formula.id),
    );
    const puzzle = await cube3x3x3.kpuzzle();
    const solved = puzzle
      .defaultPattern()
      .applyTransformation(puzzle.algToTransformation(CUBE_ORIENTATION_ALG));
    const yellow = rememberYellow(solved);

    assert.equal(formulas.length, 4);
    for (const formula of formulas) {
      const setup = practiceCase(formula);
      const pattern = formulaPattern(formula.id);
      assert.ok(setup);
      assert.ok(pattern);
      assert.equal(pattern.name, formula.name);
      const practice = solved.applyTransformation(
        puzzle.algToTransformation(setup.inverse),
      );
      assert.deepEqual(pattern.top, topMask(practice, yellow));
    }
  });

  it("未支持的公式没有图案，也不报错", () => {
    assert.equal(formulaPattern("f2l-paired"), null);
    assert.equal(formulaPattern("pll-t"), null);
    assert.equal(formulaPattern(""), null);
  });
});
