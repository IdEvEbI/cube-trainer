import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";
import {
  colorsMatchTarget,
  CUBE_ORIENTATION_ALG,
  readCube,
} from "../cube/cube.ts";
import { parseFormulaLibrary } from "../formula/formulas.ts";
import type { Formula } from "../formula/types.ts";
import { invertAlgorithm, practiceCase } from "./setup.ts";

const samplePath = new URL("../../data/formula-catalog.json", import.meta.url);

function loadFormulas(): Formula[] {
  const methods = parseFormulaLibrary(
    JSON.parse(readFileSync(samplePath, "utf8")),
  );
  return methods.flatMap((method) =>
    method.subclasses.flatMap((subclass) => subclass.formulas),
  );
}

function ollFormulas(): Formula[] {
  return loadFormulas().filter((formula) =>
    ["oll-line", "oll-l", "oll-sune", "oll-antisune"].includes(formula.id),
  );
}

function pllFormulas(): Formula[] {
  const methods = parseFormulaLibrary(
    JSON.parse(readFileSync(samplePath, "utf8")),
  );
  const cfop = methods.find((method) => method.id === "cfop");
  const pll = cfop?.subclasses.find((subclass) => subclass.id === "cfop-pll");
  return pll?.formulas ?? [];
}

async function signature(moves: string): Promise<string> {
  const puzzle = await cube3x3x3.kpuzzle();
  let pattern = puzzle
    .defaultPattern()
    .applyTransformation(puzzle.algToTransformation(CUBE_ORIENTATION_ALG));
  if (moves.trim() !== "") {
    pattern = pattern.applyTransformation(puzzle.algToTransformation(moves));
  }
  return pieceSignature(pattern);
}

function pieceSignature(pattern: KPattern): string {
  const corners = pattern.patternData.CORNERS;
  const edges = pattern.patternData.EDGES;
  return JSON.stringify({
    corners: corners?.pieces,
    cornerOrientation: corners?.orientation,
    edges: edges?.pieces,
    edgeOrientation: edges?.orientation,
    centers: pattern.patternData.CENTERS?.pieces,
  });
}

describe("practiceCase", () => {
  it("右手小鱼从复原出发，应用的是逆公式", () => {
    const sune = ollFormulas().find((formula) => formula.id === "oll-sune");
    assert.ok(sune);

    const setup = practiceCase(sune);

    assert.deepEqual(setup, {
      id: "oll-sune",
      name: "右手小鱼",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
    assert.equal(setup?.inverse, invertAlgorithm(sune.moves));
  });

  it("OLL 的四条公式都会离开复原，再执行正向公式后回到复原", async () => {
    const solved = await signature("");

    for (const formula of ollFormulas()) {
      const setup = practiceCase(formula);
      assert.ok(setup);
      const scrambled = await signature(setup.inverse);
      const restored = await signature(`${setup.inverse} ${setup.forward}`);
      const colors = await readCube(setup.inverse);

      assert.notEqual(scrambled, solved);
      assert.equal(restored, solved);
      assert.equal(colorsMatchTarget(colors.faceColors), true);
    }
  });

  it("T 排列从复原出发，应用的是逆公式", () => {
    const tPerm = pllFormulas().find((formula) => formula.id === "pll-t");
    assert.ok(tPerm);

    const setup = practiceCase(tPerm);

    assert.deepEqual(setup, {
      id: "pll-t",
      name: "T 排列",
      forward: "R U R' U' R' F R2 U' R' U' R U R' F'",
      inverse: "F R U' R' U R U R2 F' R U R U' R'",
    });
    assert.equal(setup?.inverse, invertAlgorithm(tPerm.moves));
  });

  it("CFOP 的 PLL 都会离开复原，再执行正向公式后回到复原", async () => {
    const solved = await signature("");
    const formulas = pllFormulas();

    assert.equal(formulas.length, 21);
    for (const formula of formulas) {
      const setup = practiceCase(formula);
      assert.ok(setup);
      assert.equal(setup.forward, formula.moves);
      const scrambled = await signature(setup.inverse);
      const restored = await signature(`${setup.inverse} ${setup.forward}`);

      assert.notEqual(scrambled, solved);
      assert.equal(restored, solved);
    }
  });

  it("F2L、其余 OLL 和其他方法仍不生成练习状态", () => {
    const methods = parseFormulaLibrary(
      JSON.parse(readFileSync(samplePath, "utf8")),
    );
    const ollIds = ["oll-line", "oll-l", "oll-sune", "oll-antisune"];

    for (const method of methods) {
      for (const subclass of method.subclasses) {
        for (const formula of subclass.formulas) {
          const allowed =
            ollIds.includes(formula.id) ||
            (method.id === "cfop" && subclass.id === "cfop-pll");
          if (allowed) {
            assert.ok(practiceCase(formula));
          } else {
            assert.equal(practiceCase(formula), null, formula.id);
          }
        }
      }
    }
  });
});
