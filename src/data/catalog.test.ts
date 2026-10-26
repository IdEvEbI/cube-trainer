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
const ollIds = [
  "oll-wca-45",
  "oll-wca-44",
  "oll-wca-27",
  "oll-wca-26",
] as const;
const ollMoves = {
  "oll-wca-45": ["OLL 45", "(F)(R U R' U')(F')"],
  "oll-wca-44": ["OLL 44", "(F)(U R U' R')(F')"],
  "oll-wca-27": ["OLL 27", "(R U R' U)(R U2 R')"],
  "oll-wca-26": ["OLL 26", "(R U2 R' U')(R U' R')"],
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
    const f2lStandard = f2l?.filter((formula) => !formula.emptySlot);
    assert.equal(f2lStandard?.length, 41);
    assert.ok((f2l?.length ?? 0) > 41);
    assert.equal(oll?.length, 57);
    assert.equal(pll?.length, 21);
    for (const id of ["f2l-1", "f2l-4", "f2l-27", "f2l-41"]) {
      assert.ok(f2lStandard?.some((formula) => formula.id === id));
    }
    for (const id of ["oll-wca-1", "oll-wca-57", "oll-wca-15"]) {
      assert.ok(oll?.some((formula) => formula.id === id));
    }
    for (const id of ["pll-t", "pll-aa", "pll-e", "pll-ga", "pll-gd"]) {
      assert.ok(pll?.some((formula) => formula.id === id));
    }
    assert.equal(
      [...(f2l ?? []), ...(oll ?? []), ...(pll ?? [])].every(
        (formula) => formula.puzzle === "3x3",
      ),
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

  it("F2L 标准 41 无重复，空槽单独标记且可解析练习", () => {
    const catalog = loadCatalog();
    const f2l = formulasForSubclass(catalog, "cfop", "cfop-f2l");
    assert.ok(f2l);
    const standard = f2l.filter((formula) => !formula.emptySlot);
    const empty = f2l.filter((formula) => formula.emptySlot);
    assert.equal(standard.length, 41);
    assert.ok(empty.length > 0);

    const ids = standard.map((formula) => formula.id);
    assert.equal(new Set(ids).size, 41);
    assert.equal(ids.includes("f2l-join"), false);
    assert.equal(ids.includes("f2l-side"), false);

    for (let n = 1; n <= 41; n++) {
      const formula = standard.find((item) => item.id === `f2l-${n}`);
      assert.ok(formula, `missing f2l-${n}`);
      assert.equal(formula.name, `F2L ${n}`);
      assert.equal(formula.emptySlot, undefined);
      assert.ok(practiceCase(toPracticeFormula(formula)));
    }

    for (const formula of empty) {
      assert.equal(formula.emptySlot, true);
      assert.equal(formula.group, "空槽插入");
      assert.ok(practiceCase(toPracticeFormula(formula)), formula.id);
    }

    const first = standard.find((formula) => formula.id === "f2l-1");
    assert.ok(first);
    assert.equal(first.moves, "(U)(R U' R')");
    assert.deepEqual(first.algs, ["(U)(R U' R')", "(R' F R F')"]);
    assert.equal(first.group, "基础插入");
  });

  it("OLL / PLL 编号完整、默认可解析，OLL 57 对齐 Wiki", () => {
    const catalog = loadCatalog();
    const oll = formulasForSubclass(catalog, "cfop", "cfop-oll");
    const pll = formulasForSubclass(catalog, "cfop", "cfop-pll");
    assert.ok(oll);
    assert.ok(pll);
    assert.equal(oll.length, 57);
    assert.equal(pll.length, 21);

    const nums = oll.map((formula) => {
      assert.match(formula.id, /^oll-wca-\d+$/);
      assert.equal(formula.name, `OLL ${formula.id.slice("oll-wca-".length)}`);
      assert.ok(practiceCase(toPracticeFormula(formula)), formula.id);
      return Number(formula.id.slice("oll-wca-".length));
    });
    assert.deepEqual(
      [...nums].sort((a, b) => a - b),
      Array.from({ length: 57 }, (_, i) => i + 1),
    );

    for (const formula of pll) {
      assert.ok(practiceCase(toPracticeFormula(formula)), formula.id);
    }

    const fifteen = oll.find((formula) => formula.id === "oll-wca-15");
    assert.ok(fifteen);
    assert.equal(fifteen.moves, "(r' U' r)(R' U' R U)(r' U r)");

    const fiftySeven = oll.find((formula) => formula.id === "oll-wca-57");
    assert.ok(fiftySeven);
    assert.equal(fiftySeven.moves, "(R U R' U')(M' U R U' r')");
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
    const sune = oll?.find((formula) => formula.id === "oll-wca-27");
    assert.ok(sune);
    assert.deepEqual(practiceCase(toPracticeFormula(sune)), {
      id: "oll-wca-27",
      name: "OLL 27",
      forward: "R U R' U R U2 R'",
      inverse: "R U2 R' U' R U' R'",
    });
    const tPerm = formulasForSubclass(catalog, "cfop", "cfop-pll")?.find(
      (formula) => formula.id === "pll-t",
    );
    assert.ok(tPerm);
    assert.equal(tPerm.subclassName, "PLL");
    assert.ok(practiceCase(toPracticeFormula(tPerm)));
  });
});
