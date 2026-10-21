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

  it("当前不生成 OLL 以外的练习状态", () => {
    const other = loadFormulas().find((formula) => formula.id === "f2l-paired");
    assert.ok(other);
    assert.equal(practiceCase(other), null);
  });
});
