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
import {
  moveCount,
  parseAlgorithm,
  parseFormulaLibrary,
} from "../formula/formulas.ts";
import type { Formula } from "../formula/types.ts";
import { formulaAlgorithms, invertAlgorithm, practiceCase } from "./setup.ts";

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

function permutation(value: string): string {
  const data = JSON.parse(value) as {
    corners: unknown;
    cornerOrientation: unknown;
    edges: unknown;
    edgeOrientation: unknown;
  };
  return JSON.stringify({
    corners: data.corners,
    cornerOrientation: data.cornerOrientation,
    edges: data.edges,
    edgeOrientation: data.edgeOrientation,
  });
}

function orientation(value: string): string {
  const data = JSON.parse(value) as {
    cornerOrientation: unknown;
    edgeOrientation: unknown;
  };
  return JSON.stringify({
    cornerOrientation: data.cornerOrientation,
    edgeOrientation: data.edgeOrientation,
  });
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
      assert.equal(setup.forward, parseAlgorithm(formula.moves).join(" "));
      const scrambled = await signature(setup.inverse);
      const restored = await signature(`${setup.inverse} ${setup.forward}`);

      assert.notEqual(scrambled, solved);
      assert.equal(restored, solved);
    }
  });

  it("新增的二步 OLL 点击后能生成练习状态", async () => {
    const solved = await signature("");
    const ids = ["oll-dot", "oll-t", "oll-h", "oll-pi", "oll-u", "oll-wca-37"];
    const formulas = ids.map((id) => {
      const formula = loadFormulas().find((item) => item.id === id);
      assert.ok(formula);
      return formula;
    });
    for (const formula of formulas) {
      const setup = practiceCase(formula);
      assert.equal(formula.practice, true);
      assert.ok(setup);
      assert.equal(setup.id, formula.id);
      assert.equal(setup.name, formula.name);
      assert.equal(setup.inverse, invertAlgorithm(formula.moves));
      const scrambled = await signature(setup.inverse);
      const restored = await signature(`${setup.inverse} ${setup.forward}`);
      assert.notEqual(scrambled, solved);
      assert.equal(restored, solved);
    }
  });

  it("其余 OLL 点击后能生成练习状态", async () => {
    const solved = await signature("");
    const methods = parseFormulaLibrary(
      JSON.parse(readFileSync(samplePath, "utf8")),
    );
    const oll = methods
      .find((method) => method.id === "cfop")
      ?.subclasses.find((subclass) => subclass.id === "cfop-oll");
    const already = new Set([
      "oll-line",
      "oll-l",
      "oll-sune",
      "oll-antisune",
      "oll-dot",
      "oll-t",
      "oll-h",
      "oll-pi",
      "oll-u",
      "oll-wca-37",
    ]);

    assert.equal(oll?.formulas.length, 57);
    const added = oll?.formulas.filter((formula) => !already.has(formula.id));
    assert.equal(added?.length, 47);
    for (const formula of added ?? []) {
      const setup = practiceCase(formula);
      assert.equal(formula.practice, true);
      assert.equal(formula.group === undefined, false);
      assert.ok(setup);
      assert.equal(setup.id, formula.id);
      assert.equal(setup.name, formula.name);
      assert.equal(setup.forward, parseAlgorithm(formula.moves).join(" "));
      assert.equal(setup.inverse, invertAlgorithm(formula.moves));
      const restored = await signature(`${setup.inverse} ${setup.forward}`);
      assert.equal(restored, solved);
    }
  });

  it("切换算法后练习状态跟着更新", async () => {
    const solved = await signature("");
    const sune = ollFormulas().find((formula) => formula.id === "oll-sune");
    const crown = loadFormulas().find((formula) => formula.id === "oll-wca-18");
    const dot = loadFormulas().find((formula) => formula.id === "oll-dot");
    assert.ok(sune?.algs);
    assert.ok(crown?.algs);
    assert.ok(dot);

    assert.deepEqual(formulaAlgorithms(sune), sune.algs);
    assert.deepEqual(formulaAlgorithms(dot), [dot.moves]);

    const defaults = practiceCase(sune);
    const alternate = practiceCase(sune, 1);
    assert.ok(defaults);
    assert.ok(alternate);
    assert.equal(defaults.forward, parseAlgorithm(sune.moves).join(" "));
    assert.equal(
      alternate.forward,
      parseAlgorithm(sune.algs[1] ?? "").join(" "),
    );
    assert.notEqual(alternate.forward, defaults.forward);
    assert.equal(moveCount(sune.moves), 7);
    assert.equal(moveCount(sune.algs[1] ?? ""), 8);
    assert.equal(moveCount(defaults.forward), moveCount(sune.moves));
    assert.equal(moveCount(alternate.forward), moveCount(sune.algs[1] ?? ""));
    assert.equal(alternate.inverse, invertAlgorithm(alternate.forward));
    assert.equal(practiceCase(sune, 2), null);
    assert.equal(practiceCase(dot, 1), null);

    const defaultSetup = await signature(defaults.inverse);
    const alternateSetup = await signature(alternate.inverse);
    assert.notEqual(defaultSetup, alternateSetup);
    assert.equal(orientation(defaultSetup), orientation(alternateSetup));
    assert.equal(
      await signature(`${alternate.inverse} ${alternate.forward}`),
      solved,
    );

    const crownDefault = practiceCase(crown);
    const crownAlternate = practiceCase(crown, 1);
    assert.ok(crownDefault);
    assert.ok(crownAlternate);
    assert.equal(moveCount(crown.moves), 18);
    assert.equal(moveCount(crown.algs[1] ?? ""), 14);
    assert.equal(crownDefault.forward, parseAlgorithm(crown.moves).join(" "));
    assert.equal(
      crownAlternate.forward,
      parseAlgorithm(crown.algs[1] ?? "").join(" "),
    );
    assert.equal(
      orientation(await signature(crownDefault.inverse)),
      orientation(await signature(crownAlternate.inverse)),
    );
    assert.equal(
      await signature(`${crownAlternate.inverse} ${crownAlternate.forward}`),
      solved,
    );
  });

  it("宽层转优化后的备选算法能练习，原有 R M' 写法仍可用", async () => {
    const solved = await signature("");
    const crown = loadFormulas().find((formula) => formula.id === "oll-wca-18");
    const edges = loadFormulas().find((formula) => formula.id === "oll-wca-28");
    assert.ok(crown?.algs);
    assert.ok(edges?.algs);
    assert.equal(crown.algs.length, 3);
    assert.equal(edges.algs.length, 3);

    const crownDefault = practiceCase(crown);
    const crownWide = practiceCase(crown, 2);
    assert.ok(crownDefault);
    assert.ok(crownWide);
    assert.match(crown.algs[0] ?? "", /R M'/);
    assert.match(crown.algs[2] ?? "", /\br\b/);
    assert.equal(moveCount(crown.algs[2] ?? ""), 14);
    assert.equal(
      orientation(await signature(crownDefault.inverse)),
      orientation(await signature(crownWide.inverse)),
    );
    assert.equal(
      await signature(`${crownDefault.inverse} ${crownDefault.forward}`),
      solved,
    );
    assert.equal(
      await signature(`${crownWide.inverse} ${crownWide.forward}`),
      solved,
    );

    const edgesDefault = practiceCase(edges);
    const edgesWide = practiceCase(edges, 2);
    assert.ok(edgesDefault);
    assert.ok(edgesWide);
    assert.match(edges.algs[0] ?? "", /R M'/);
    assert.match(edges.algs[2] ?? "", /\br\b/);
    assert.equal(
      orientation(await signature(edgesDefault.inverse)),
      orientation(await signature(edgesWide.inverse)),
    );
    assert.equal(
      await signature(`${edgesDefault.inverse} ${edgesDefault.forward}`),
      solved,
    );
    assert.equal(
      await signature(`${edgesWide.inverse} ${edgesWide.forward}`),
      solved,
    );

    for (const id of [
      "oll-wca-7",
      "oll-wca-5",
      "oll-wca-6",
      "oll-wca-49",
      "oll-wca-50",
      "oll-wca-54",
      "oll-wca-53",
      "oll-wca-8",
      "oll-wca-56",
    ]) {
      const formula = loadFormulas().find((item) => item.id === id);
      assert.ok(formula?.algs, id);
      assert.match(formula.algs[0] ?? "", /M/, id);
      assert.match(formula.algs[1] ?? "", /\b[rl]\b/, id);
      const defaults = practiceCase(formula);
      const wide = practiceCase(formula, 1);
      assert.ok(defaults, id);
      assert.ok(wide, id);
      assert.equal(
        orientation(await signature(defaults.inverse)),
        orientation(await signature(wide.inverse)),
        id,
      );
      assert.equal(
        await signature(`${defaults.inverse} ${defaults.forward}`),
        solved,
        id,
      );
      assert.equal(
        await signature(`${wide.inverse} ${wide.forward}`),
        solved,
        id,
      );
    }
  });

  it("新增的 OLL 备选算法切换后朝向一致，原有默认算法仍可用", async () => {
    const solved = await signature("");
    const oll = loadFormulas().filter((formula) =>
      formula.id.startsWith("oll-"),
    );
    const multi = oll.filter((formula) => formula.algs);
    assert.equal(multi.length, 35);

    for (const formula of multi) {
      const defaults = practiceCase(formula);
      const alternate = practiceCase(formula, 1);
      assert.ok(defaults, formula.id);
      assert.ok(alternate, formula.id);
      assert.equal(defaults.forward, parseAlgorithm(formula.moves).join(" "));
      assert.equal(
        alternate.forward,
        parseAlgorithm(formula.algs?.[1] ?? "").join(" "),
      );
      assert.notEqual(alternate.forward, defaults.forward, formula.id);
      assert.equal(
        orientation(await signature(defaults.inverse)),
        orientation(await signature(alternate.inverse)),
        formula.id,
      );
      assert.equal(
        await signature(`${defaults.inverse} ${defaults.forward}`),
        solved,
        formula.id,
      );
      assert.equal(
        await signature(`${alternate.inverse} ${alternate.forward}`),
        solved,
        formula.id,
      );
    }

    const single = oll.filter((formula) => !formula.algs);
    assert.equal(single.length, 22);
    for (const formula of single) {
      const setup = practiceCase(formula);
      assert.ok(setup, formula.id);
      assert.equal(setup.forward, parseAlgorithm(formula.moves).join(" "));
      assert.equal(practiceCase(formula, 1), null, formula.id);
    }
  });

  it("新增的 PLL 备选算法切换后排列一致，OLL 多算法仍可用", async () => {
    const solved = await signature("");
    const formulas = loadFormulas();
    const pll = formulas.filter(
      (formula) => formula.id.startsWith("pll-") && formula.algs,
    );
    assert.equal(pll.length, 12);

    for (const formula of pll) {
      const defaults = practiceCase(formula);
      const alternate = practiceCase(formula, 1);
      assert.ok(defaults, formula.id);
      assert.ok(alternate, formula.id);
      assert.equal(
        defaults.forward,
        parseAlgorithm(formula.moves).join(" "),
        formula.id,
      );
      assert.equal(
        alternate.forward,
        parseAlgorithm(formula.algs?.[1] ?? "").join(" "),
        formula.id,
      );
      assert.notEqual(alternate.forward, defaults.forward, formula.id);
      assert.equal(
        moveCount(alternate.forward),
        moveCount(formula.algs?.[1] ?? ""),
        formula.id,
      );
      assert.equal(
        permutation(await signature(defaults.inverse)),
        permutation(await signature(alternate.inverse)),
        formula.id,
      );
      assert.equal(
        await signature(`${defaults.inverse} ${defaults.forward}`),
        solved,
        formula.id,
      );
      assert.equal(
        await signature(`${alternate.inverse} ${alternate.forward}`),
        solved,
        formula.id,
      );
    }

    const single = formulas.find((formula) => formula.id === "pll-aa");
    assert.ok(single);
    assert.equal(single.algs, undefined);
    assert.equal(practiceCase(single, 1), null);

    const oll = formulas.filter(
      (formula) => formula.id.startsWith("oll-") && formula.algs,
    );
    assert.equal(oll.length, 35);
    const sune = oll.find((formula) => formula.id === "oll-sune");
    assert.ok(sune?.algs);
    assert.equal(
      practiceCase(sune, 1)?.forward,
      parseAlgorithm(sune.algs[1] ?? "").join(" "),
    );
  });

  it("F2L 和其他方法仍不生成练习状态", () => {
    const methods = parseFormulaLibrary(
      JSON.parse(readFileSync(samplePath, "utf8")),
    );

    for (const method of methods) {
      for (const subclass of method.subclasses) {
        for (const formula of subclass.formulas) {
          const allowed =
            subclass.id === "cfop-oll" ||
            (method.id === "cfop" && subclass.id === "cfop-pll");
          if (allowed) {
            assert.ok(practiceCase(formula), formula.id);
          } else {
            assert.equal(practiceCase(formula), null, formula.id);
          }
        }
      }
    }
  });
});
