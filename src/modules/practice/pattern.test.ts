import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";
import { CUBE_ORIENTATION_ALG } from "../cube/cube.ts";
import { parseFormulaLibrary } from "../formula/formulas.ts";
import type { Formula } from "../formula/types.ts";
import {
  formulaPattern,
  hasF2lPattern,
  hasOllPattern,
  hasPllPattern,
  type TopSticker,
} from "./pattern.ts";
import { f2lPracticeCubeFaces } from "./f2l-practice-faces.ts";
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

const F_TOP = [
  ["CORNERS", 3, 1],
  ["EDGES", 0, 1],
  ["CORNERS", 0, 2],
] as const;
const R_TOP = [
  ["CORNERS", 0, 1],
  ["EDGES", 1, 1],
  ["CORNERS", 1, 2],
] as const;
const B_TOP = [
  ["CORNERS", 1, 1],
  ["EDGES", 2, 1],
  ["CORNERS", 2, 2],
] as const;
const L_TOP = [
  ["CORNERS", 2, 1],
  ["EDGES", 3, 1],
  ["CORNERS", 3, 2],
] as const;

const SIDE_SLOTS = [
  B_TOP[2],
  B_TOP[1],
  B_TOP[0],
  R_TOP[2],
  R_TOP[1],
  R_TOP[0],
  F_TOP[0],
  F_TOP[1],
  F_TOP[2],
  L_TOP[0],
  L_TOP[1],
  L_TOP[2],
] as const;

function loadCfopSubclass(subclassId: string): Formula[] {
  const methods = parseFormulaLibrary(
    JSON.parse(readFileSync(samplePath, "utf8")),
  );
  return (
    methods
      .find((method) => method.id === "cfop")
      ?.subclasses.find((subclass) => subclass.id === subclassId)?.formulas ??
    []
  );
}

function loadCfopOll(): Formula[] {
  return loadCfopSubclass("cfop-oll");
}

function loadCfopPll(): Formula[] {
  return loadCfopSubclass("cfop-pll");
}

function loadCfopF2l(): Formula[] {
  return loadCfopSubclass("cfop-f2l");
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

function stickerMask(
  pattern: KPattern,
  yellow: Map<string, number>,
  slots: readonly (readonly [string, number, number])[],
): TopSticker[] {
  return slots.map(([orbit, location, orientation]) => {
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
  it("OLL 缩略图能正常显示", () => {
    const oll = loadCfopOll();
    const signatures = new Set<string>();

    assert.equal(oll.length, 57);
    for (const formula of oll) {
      const pattern = formulaPattern(formula.id);
      assert.ok(pattern, formula.id);
      assert.equal(hasOllPattern(formula.id), true);
      assert.equal(pattern.name, formula.name);
      assert.equal(pattern.top.length, 9);
      assert.equal(pattern.sides.length, 12);
      assert.equal(pattern.top[4], "黄");
      assert.equal(
        pattern.top.every((sticker) => sticker === "黄" || sticker === "其他"),
        true,
      );
      assert.equal(
        pattern.sides.every(
          (sticker) => sticker === "黄" || sticker === "其他",
        ),
        true,
      );
      signatures.add(`${pattern.top.join("")}|${pattern.sides.join("")}`);
    }
    assert.equal(signatures.size, 57);
  });

  it("全部 OLL 顶层图案与练习状态一致", async () => {
    const formulas = loadCfopOll();
    const puzzle = await cube3x3x3.kpuzzle();
    const solved = puzzle
      .defaultPattern()
      .applyTransformation(puzzle.algToTransformation(CUBE_ORIENTATION_ALG));
    const yellow = rememberYellow(solved);

    assert.equal(formulas.length, 57);
    for (const formula of formulas) {
      const setup = practiceCase(formula);
      const pattern = formulaPattern(formula.id);
      assert.ok(setup, formula.id);
      assert.ok(pattern, formula.id);
      assert.equal(pattern.name, formula.name);
      const practice = solved.applyTransformation(
        puzzle.algToTransformation(setup.inverse),
      );
      assert.deepEqual(
        pattern.top,
        stickerMask(practice, yellow, U_SLOTS),
        formula.id,
      );
      assert.deepEqual(
        pattern.sides,
        stickerMask(practice, yellow, SIDE_SLOTS),
        `${formula.id} sides`,
      );
    }
  });

  it("PLL 缩略图能正常显示", () => {
    const pll = loadCfopPll();
    const signatures = new Set<string>();

    assert.equal(pll.length, 21);
    for (const formula of pll) {
      const pattern = formulaPattern(formula.id);
      assert.ok(pattern, formula.id);
      assert.equal(hasPllPattern(formula.id), true);
      assert.equal(hasOllPattern(formula.id), false);
      assert.equal(pattern.name, formula.name);
      assert.equal(pattern.top.length, 9);
      assert.equal(pattern.sides.length, 12);
      assert.equal(
        pattern.top.every((sticker) => sticker === "黄"),
        true,
      );
      assert.ok(pattern.arrows && pattern.arrows.length > 0, formula.id);
      for (const [from, to] of pattern.arrows ?? []) {
        assert.ok(
          from >= 0 && from <= 8 && from !== 4,
          `${formula.id}:${from}`,
        );
        assert.ok(to >= 0 && to <= 8 && to !== 4, `${formula.id}:${to}`);
      }
      signatures.add(
        `${pattern.sides.join("")}|${(pattern.arrows ?? [])
          .map(([a, b]) => `${a}>${b}`)
          .join(",")}`,
      );
    }
    assert.equal(signatures.size, 21);
  });

  it("F2L 缩略图能正常显示", () => {
    const f2l = loadCfopF2l().filter((formula) => !formula.emptySlot);
    const signatures = new Set<string>();

    assert.equal(f2l.length, 41);
    for (const formula of f2l) {
      const pattern = formulaPattern(formula.id);
      assert.ok(pattern, formula.id);
      assert.equal(hasF2lPattern(formula.id), true);
      assert.equal(hasOllPattern(formula.id), false);
      assert.equal(hasPllPattern(formula.id), false);
      assert.equal(pattern.name, formula.name);
      assert.equal(pattern.top.length, 9);
      assert.equal(pattern.sides.length, 12);
      assert.ok(pattern.cube, formula.id);
      assert.equal(pattern.cube.U.length, 9, formula.id);
      assert.equal(pattern.cube.F.length, 9, formula.id);
      assert.equal(pattern.cube.R.length, 9, formula.id);
      assert.equal(pattern.arrows, undefined);
      // U 黄心；F 左下 2×2、R 右下 2×2（含中心）非灰，便于看出空槽
      assert.equal(pattern.cube.U[4], "黄", formula.id);
      for (const index of [3, 4, 6, 7] as const) {
        assert.notEqual(pattern.cube.F[index], "灰", `${formula.id}:F${index}`);
      }
      for (const index of [4, 5, 7, 8] as const) {
        assert.notEqual(pattern.cube.R[index], "灰", `${formula.id}:R${index}`);
      }
      signatures.add(
        `U${pattern.cube.U.join("")}|F${pattern.cube.F.join("")}|R${pattern.cube.R.join("")}`,
      );
    }
    // 合并后每条 F2L 对应独立缩略图（原 join/side 同图已并入 F2L 1）
    assert.equal(signatures.size, 41);
    assert.equal(formulaPattern("f2l-join"), null);
    assert.equal(formulaPattern("f2l-side"), null);

    const first = formulaPattern("f2l-1");
    assert.ok(first?.cube);
    assert.equal(first.emptySlot, undefined);

    const paired = formulaPattern("f2l-4");
    assert.ok(paired?.cube);
    assert.deepEqual(paired.cube.F, [
      "灰",
      "灰",
      "绿",
      "绿",
      "绿",
      "灰",
      "绿",
      "绿",
      "灰",
    ]);
    assert.deepEqual(paired.cube.R, [
      "白",
      "灰",
      "灰",
      "灰",
      "橙",
      "橙",
      "灰",
      "橙",
      "橙",
    ]);
  });

  it("F2L 空槽缩略图与练习 3D 状态一致，并标出空槽", async () => {
    const empty = loadCfopF2l().filter((formula) => formula.emptySlot);
    assert.equal(empty.length, 19);

    const baseFive = formulaPattern("f2l-5");
    assert.ok(baseFive?.cube);
    assert.equal(baseFive.emptySlot, undefined);

    for (const formula of empty) {
      const pattern = formulaPattern(formula.id);
      const setup = practiceCase(formula);
      assert.ok(pattern, formula.id);
      assert.ok(pattern.cube, formula.id);
      assert.ok(setup, formula.id);
      assert.equal(hasF2lPattern(formula.id), true);
      assert.equal(pattern.name, formula.name);
      assert.ok(pattern.emptySlot === "fl" || pattern.emptySlot === "br");
      assert.match(formula.id, new RegExp(`empty-${pattern.emptySlot}$`));
      assert.equal(pattern.cube.U[4], "黄", formula.id);

      const expected = await f2lPracticeCubeFaces(setup.inverse);
      assert.deepEqual(pattern.cube.U, expected.U, `${formula.id} U`);
      assert.deepEqual(pattern.cube.F, expected.F, `${formula.id} F`);
      assert.deepEqual(pattern.cube.R, expected.R, `${formula.id} R`);
    }

    const fl = formulaPattern("f2l-5-empty-fl");
    const br = formulaPattern("f2l-5-empty-br");
    assert.ok(fl?.cube && br?.cube);
    assert.equal(fl.emptySlot, "fl");
    assert.equal(br.emptySlot, "br");
    assert.notDeepEqual(fl.cube, baseFive.cube);
    assert.notDeepEqual(br.cube, baseFive.cube);
  });

  it("未支持的公式没有图案，也不报错", () => {
    assert.equal(formulaPattern(""), null);
    assert.equal(formulaPattern("lbl-corner-insert"), null);
    assert.equal(hasOllPattern("pll-t"), false);
    assert.equal(hasPllPattern("oll-wca-27"), false);
    assert.equal(hasF2lPattern("oll-wca-27"), false);
  });
});
