import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { practiceCase } from "../modules/practice/setup.ts";
import {
  formulasForMethod,
  formulasForSubclass,
  parseFormulaCatalog,
  toPracticeFormula,
  type CatalogFormula,
  type CatalogMethod,
} from "./catalog.ts";

const catalogPath = new URL("./formula-catalog.json", import.meta.url);
const ollIds = ["oll-line", "oll-l", "oll-sune", "oll-antisune"] as const;
const ollMoves = {
  "oll-line": ["一字", "F R U R' U' F'"],
  "oll-l": ["小拐弯", "F U R U' R' F'"],
  "oll-sune": ["右手小鱼", "R U R' U R U2 R'"],
  "oll-antisune": ["左手小鱼", "R U2 R' U' R U' R'"],
} as const;

function loadCatalog(): CatalogMethod[] {
  return parseFormulaCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));
}

describe("formula catalog", () => {
  it("能按方法读到层先法、CFOP、桥式和盲拧", () => {
    const catalog = loadCatalog();

    assert.deepEqual(
      catalog.map((method) => method.name),
      ["层先法", "CFOP", "桥式", "盲拧"],
    );
    for (const methodId of ["lbl", "cfop", "roux", "bld"]) {
      const formulas = formulasForMethod(catalog, methodId);
      assert.ok(formulas && formulas.length > 0);
      assert.equal(
        formulas.every((formula) => formula.methodId === methodId),
        true,
      );
    }
    const cfop = formulasForMethod(catalog, "cfop");
    assert.equal(
      cfop?.some((formula) => formula.id.startsWith("lbl-")),
      false,
    );
    assert.equal(formulasForMethod(catalog, "missing"), null);
  });

  it("CFOP 能按 F2L、OLL、PLL 读取，层先法和桥式有分类骨架", () => {
    const catalog = loadCatalog();
    const cfop = catalog.find((method) => method.id === "cfop");
    const lbl = catalog.find((method) => method.id === "lbl");
    const roux = catalog.find((method) => method.id === "roux");
    const bld = catalog.find((method) => method.id === "bld");

    assert.deepEqual(
      cfop?.subclasses.map((subclass) => subclass.name),
      ["Cross", "F2L", "OLL", "PLL"],
    );
    const f2l = formulasForSubclass(catalog, "cfop", "cfop-f2l");
    const oll = formulasForSubclass(catalog, "cfop", "cfop-oll");
    const pll = formulasForSubclass(catalog, "cfop", "cfop-pll");
    assert.equal(f2l?.length, 42);
    assert.equal(oll?.length, 57);
    assert.equal(pll?.length, 21);
    for (const id of ["f2l-split", "f2l-side", "f2l-1-2", "f2l-6-5"]) {
      assert.ok(f2l?.some((formula) => formula.id === id));
    }
    for (const id of ["oll-wca-1", "oll-wca-57", "oll-dot"]) {
      assert.ok(oll?.some((formula) => formula.id === id));
    }
    for (const id of ["pll-t", "pll-aa", "pll-e", "pll-ga", "pll-gd"]) {
      assert.ok(pll?.some((formula) => formula.id === id));
    }
    assert.equal(
      [...f2l, ...oll, ...pll].every((formula) => formula.puzzle === "3x3"),
      true,
    );
    assert.equal(formulasForSubclass(catalog, "cfop", "cfop-cross")?.length, 0);
    assert.deepEqual(
      lbl?.subclasses.map((subclass) => subclass.name),
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
      roux?.subclasses.map((subclass) => subclass.name),
      ["左桥", "右桥", "CMLL", "LSE"],
    );
    assert.deepEqual(
      bld?.subclasses.map((subclass) => subclass.name),
      ["角块", "棱块", "奇偶"],
    );
    assert.equal(formulasForSubclass(catalog, "cfop", "missing"), null);
  });

  it("已支持的四条 OLL 仍能生成练习状态，并且只出现一次", () => {
    const catalog = loadCatalog();
    const oll = formulasForSubclass(catalog, "cfop", "cfop-oll");
    const all = catalog.flatMap((method) =>
      method.subclasses.flatMap((subclass) => subclass.formulas),
    );

    for (const id of ollIds) {
      const stored: CatalogFormula | undefined = oll?.find(
        (formula) => formula.id === id,
      );
      const [name, moves] = ollMoves[id];
      assert.ok(stored);
      assert.equal(stored.name, name);
      assert.equal(stored.moves, moves);
      assert.equal(stored.puzzle, "3x3");
      assert.equal(stored.methodName, "CFOP");
      assert.equal(stored.subclassName, "OLL");
      assert.equal(all.filter((formula) => formula.id === id).length, 1);
      assert.ok(practiceCase(toPracticeFormula(stored)));
    }
    const sune = oll?.find((formula) => formula.id === "oll-sune");
    assert.ok(sune);
    assert.deepEqual(practiceCase(toPracticeFormula(sune)), {
      id: "oll-sune",
      name: "右手小鱼",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
    const tPerm = formulasForSubclass(catalog, "cfop", "cfop-pll")?.find(
      (formula) => formula.id === "pll-t",
    );
    assert.ok(tPerm);
    assert.equal(practiceCase(toPracticeFormula(tPerm)), null);
  });
});
