import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectFormulas,
  parseFormulaLibrary,
} from "../modules/formula/formulas.ts";
import {
  formulasForMethod,
  formulasForSubclass,
  parseFormulaCatalog,
  type CatalogFormula,
  type CatalogMethod,
} from "./catalog.ts";

const catalogPath = new URL("./formula-catalog.json", import.meta.url);
const libraryPath = new URL("./formulas-3x3.json", import.meta.url);
const ollIds = ["oll-line", "oll-l", "oll-sune", "oll-antisune"] as const;

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
    assert.ok(formulasForSubclass(catalog, "cfop", "cfop-f2l")?.length);
    assert.ok(formulasForSubclass(catalog, "cfop", "cfop-pll")?.length);
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

  it("已有的四条 OLL 与练习库一致，并且只出现一次", () => {
    const catalog = loadCatalog();
    const library = parseFormulaLibrary(
      JSON.parse(readFileSync(libraryPath, "utf8")),
    );
    const oll = formulasForSubclass(catalog, "cfop", "cfop-oll");
    const all = catalog.flatMap((method) =>
      method.subclasses.flatMap((subclass) => subclass.formulas),
    );

    assert.deepEqual(
      oll?.map((formula) => formula.id),
      [...ollIds],
    );
    for (const id of ollIds) {
      const stored: CatalogFormula | undefined = oll?.find(
        (formula) => formula.id === id,
      );
      const existing = collectFormulas(library).find(
        (formula) => formula.id === id,
      );
      assert.ok(stored);
      assert.ok(existing);
      assert.equal(stored.name, existing.name);
      assert.equal(stored.moves, existing.moves);
      assert.equal(stored.methodName, "CFOP");
      assert.equal(stored.subclassName, "OLL");
      assert.equal(all.filter((formula) => formula.id === id).length, 1);
    }
  });
});
