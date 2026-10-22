import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectFormulas,
  formulaNames,
  formulaDisplay,
  formulaTokens,
  moveCount,
  parseAlgorithm,
  parseFormulaLibrary,
} from "./formulas.ts";

const samplePath = new URL("../../data/formula-catalog.json", import.meta.url);

function loadSample() {
  return parseFormulaLibrary(JSON.parse(readFileSync(samplePath, "utf8")));
}

describe("parseFormulaLibrary", () => {
  it("打乱计时公式库能读到层先法、CFOP、桥式和盲拧", () => {
    const methods = loadSample();
    const cfop = methods.find((method) => method.id === "cfop");

    assert.deepEqual(
      methods.map((method) => method.name),
      ["层先法", "CFOP", "桥式", "盲拧"],
    );
    assert.deepEqual(
      methods[0]?.subclasses.map((subclass) => subclass.name),
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
      cfop?.subclasses.map((subclass) => subclass.name),
      ["Cross", "F2L", "OLL", "PLL"],
    );
    assert.equal(
      cfop?.subclasses.find((subclass) => subclass.id === "cfop-cross")?.note,
      "靠观察完成，通常不超过 8 步",
    );
    assert.deepEqual(
      methods[2]?.subclasses.map((subclass) => subclass.name),
      ["左桥", "右桥", "CMLL", "LSE"],
    );
    const formulas = collectFormulas(methods);
    for (const id of [
      "lbl-middle-left",
      "lbl-edge-cycle",
      "f2l-side",
      "oll-dot",
      "pll-ja",
      "cmll-diagonal",
      "lse-l4e",
      "bld-m2",
    ]) {
      assert.ok(formulas.some((formula) => formula.id === id));
    }
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
            subclasses: [
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
            subclasses: [
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

  it("按可选的 order 排列公式，没有 order 时保持原顺序", () => {
    const ordered = parseFormulaLibrary([
      {
        id: "cfop",
        name: "CFOP",
        subclasses: [
          {
            id: "cfop-pll",
            name: "PLL",
            formulas: [
              {
                id: "pll-t",
                name: "T 排列",
                moves: "R U R' U' R' F R2 U' R' U' R U R' F'",
                order: 2,
              },
              {
                id: "pll-ua",
                name: "Ua 排列",
                moves: "M2 U M U2 M' U M2",
                order: 1,
              },
            ],
          },
        ],
      },
    ]);
    const kept = parseFormulaLibrary([
      {
        id: "cfop",
        name: "CFOP",
        subclasses: [
          {
            id: "cfop-oll",
            name: "OLL",
            formulas: [
              { id: "oll-line", name: "一字", moves: "F R U R' U' F'" },
              { id: "oll-l", name: "小拐弯", moves: "F U R U' R' F'" },
            ],
          },
        ],
      },
    ]);

    assert.deepEqual(
      ordered[0]?.subclasses[0]?.formulas.map((formula) => formula.id),
      ["pll-ua", "pll-t"],
    );
    assert.deepEqual(
      kept[0]?.subclasses[0]?.formulas.map((formula) => formula.id),
      ["oll-line", "oll-l"],
    );
    assert.throws(
      () =>
        parseFormulaLibrary([
          {
            id: "cfop",
            name: "CFOP",
            subclasses: [
              {
                id: "cfop-pll",
                name: "PLL",
                formulas: [
                  {
                    id: "pll-ua",
                    name: "Ua 排列",
                    moves: "M2 U M U2 M' U M2",
                    order: 1,
                  },
                  {
                    id: "pll-ub",
                    name: "Ub 排列",
                    moves: "M2 U' M U2 M' U' M2",
                  },
                ],
              },
            ],
          },
        ]),
      /顺序不完整/,
    );
  });

  it("省略 puzzle 时默认为 3x3", () => {
    const methods = parseFormulaLibrary([
      {
        id: "lbl",
        name: "层先法",
        subclasses: [
          {
            id: "top",
            name: "顶层面",
            formulas: [
              { id: "sune", name: "右手小鱼", moves: "R U R' U R U2 R'" },
            ],
          },
        ],
      },
    ]);

    assert.equal(collectFormulas(methods)[0]?.puzzle, "3x3");
  });

  it("能读取一条公式的多个算法，默认算法保持不变", () => {
    const formulas = collectFormulas(loadSample());
    const sune = formulas.find((formula) => formula.id === "oll-sune");
    const crown = formulas.find((formula) => formula.id === "oll-wca-18");
    const dot = formulas.find((formula) => formula.id === "oll-dot");

    assert.ok(sune?.algs);
    assert.deepEqual(sune.algs, [
      "(R U R' U)(R U2 R')",
      "(U' R' U2 R)(U R' U R)",
    ]);
    assert.equal(sune.algs[0], sune.moves);
    assert.ok(crown?.algs);
    assert.equal(crown.algs.length, 3);
    assert.equal(crown.algs[0], crown.moves);
    assert.equal(dot?.algs, undefined);
  });

  it("新增的 OLL 备选算法可以读取，默认算法不变", () => {
    const formulas = collectFormulas(loadSample());
    const oll = formulas.filter((formula) => formula.id.startsWith("oll-"));
    const multi = oll.filter((formula) => formula.algs);
    assert.equal(multi.length, 35);
    for (const formula of multi) {
      assert.ok(formula.algs);
      assert.equal(formula.algs[0], formula.moves);
      assert.equal(formula.algs.length >= 2, true);
      assert.notEqual(formula.algs[1], formula.moves);
    }
    assert.equal(
      oll.find((formula) => formula.id === "oll-line")?.algs?.[1],
      "(U2 F')(L' U' L U)(F)",
    );
    assert.equal(
      oll.find((formula) => formula.id === "oll-dot")?.algs,
      undefined,
    );
  });

  it("新增的 PLL 备选算法可以读取，默认算法不变", () => {
    const formulas = collectFormulas(loadSample());
    const pll = formulas.filter((formula) => formula.id.startsWith("pll-"));
    const multi = pll.filter((formula) => formula.algs);
    assert.equal(multi.length, 12);
    for (const formula of multi) {
      assert.ok(formula.algs);
      assert.equal(formula.algs[0], formula.moves);
      assert.equal(formula.algs.length >= 2, true);
      assert.notEqual(formula.algs[1], formula.moves);
    }
    for (const id of [
      "pll-ua",
      "pll-ub",
      "pll-h",
      "pll-z",
      "pll-t",
      "pll-y",
      "pll-ja",
      "pll-jb",
    ]) {
      assert.ok(pll.find((formula) => formula.id === id)?.algs, id);
    }
    assert.equal(
      pll.find((formula) => formula.id === "pll-ua")?.algs?.[1],
      "(R U' R U)(R U)(R U' R')(U' R2)",
    );
    assert.equal(
      pll.find((formula) => formula.id === "pll-aa")?.algs,
      undefined,
    );
    assert.equal(
      formulas.filter(
        (formula) => formula.id.startsWith("oll-") && formula.algs,
      ).length,
      35,
    );
  });

  it("默认算法不一致或重复时拒绝", () => {
    function library(algs: unknown) {
      return [
        {
          id: "cfop",
          name: "CFOP",
          subclasses: [
            {
              id: "cfop-oll",
              name: "OLL",
              formulas: [
                {
                  id: "oll-sune",
                  name: "右手小鱼",
                  moves: "R U R' U R U2 R'",
                  algs,
                },
              ],
            },
          ],
        },
      ];
    }

    assert.throws(
      () =>
        parseFormulaLibrary(library(["R U R' U R U2 R'", "R U R' U R U2 R'"])),
      /算法重复/,
    );
    assert.throws(
      () => parseFormulaLibrary(library(["R U2 R' U' R U' R'", "R"])),
      /默认算法不一致/,
    );
  });

  it("带括号的公式仍按层转动解析，括号只保留在显示里", () => {
    const grouped = "(R U R' U)(R U2 R')";
    const plain = "R U R' U R U2 R'";

    assert.deepEqual(parseAlgorithm(grouped), parseAlgorithm(plain));
    assert.deepEqual(
      formulaTokens(grouped).map((token) => token.text),
      ["(", "R", "U", "R'", "U", ")", "(", "R", "U2", "R'", ")"],
    );
    assert.deepEqual(
      formulaTokens(grouped).flatMap((token) =>
        token.step === null ? [] : [token.text],
      ),
      parseAlgorithm(plain),
    );
    assert.throws(() => parseAlgorithm("(R U"), /括号不匹配/);
    assert.throws(() => parseAlgorithm("()"), /括号是空的/);
    assert.throws(() => parseAlgorithm("(R U)2"), /括号只用于分组/);
  });

  it("带括号的公式显示时，分组之间有一个空格", () => {
    const source = "(U' R' U2 R)(U R' U R)";

    assert.equal(formulaDisplay(source), "(U' R' U2 R) (U R' U R)");
    assert.equal(formulaDisplay("(R U R' U)(R U2 R')"), "(R U R' U) (R U2 R')");
    assert.deepEqual(
      parseAlgorithm(source),
      parseAlgorithm(formulaDisplay(source)),
    );
  });

  it("新增的 OLL 和 PLL 备选算法带括号分组，显示时空格，执行步骤不受括号影响", () => {
    const formulas = collectFormulas(loadSample());
    const samples = [
      ["oll-line", 1],
      ["oll-h", 1],
      ["pll-ua", 1],
      ["pll-t", 1],
    ] as const;

    for (const [id, index] of samples) {
      const formula = formulas.find((item) => item.id === id);
      const source = formula?.algs?.[index];
      assert.ok(source, id);
      assert.match(source, /[()]/);
      assert.match(formulaDisplay(source), /\) \(/);
      assert.deepEqual(
        parseAlgorithm(source),
        parseAlgorithm(source.replace(/[()]/g, " ")),
      );
      assert.equal(moveCount(source), parseAlgorithm(source).length);
    }
  });

  it("单算法的 OLL 和 PLL 默认算法也带括号分组，显示时空格，执行步骤不受括号影响", () => {
    const formulas = collectFormulas(loadSample()).filter(
      (formula) =>
        (formula.id.startsWith("oll-") || formula.id.startsWith("pll-")) &&
        !formula.algs,
    );
    assert.equal(formulas.length, 31);
    for (const formula of formulas) {
      assert.match(formula.moves, /[()]/, formula.id);
      assert.match(formulaDisplay(formula.moves), /\) \(/, formula.id);
      assert.deepEqual(
        parseAlgorithm(formula.moves),
        parseAlgorithm(formula.moves.replace(/[()]/g, " ")),
        formula.id,
      );
      assert.equal(
        moveCount(formula.moves),
        parseAlgorithm(formula.moves).length,
        formula.id,
      );
    }
    assert.equal(
      formulaDisplay(
        formulas.find((formula) => formula.id === "oll-dot")?.moves ?? "",
      ),
      "(F R U R' U' F') (U) (F R U R' U' F')",
    );
    assert.equal(
      formulaDisplay(
        formulas.find((formula) => formula.id === "pll-aa")?.moves ?? "",
      ),
      "(R' F R' B2) (R F' R' B2 R2)",
    );
  });

  it("带括号的公式按实际转动计算步数", () => {
    assert.equal(moveCount("(U' R' U2 R)(U R' U R)"), 8);
    assert.equal(moveCount("(R U R' U)(R U2 R')"), 7);
    assert.equal(
      moveCount("(R U R' U)(R U2 R')"),
      moveCount("R U R' U R U2 R'"),
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

  it("宽层转可以解析，R M' 写法仍保留可用", () => {
    assert.deepEqual(parseAlgorithm("r U R' U R U2 r'"), [
      "r",
      "U",
      "R'",
      "U",
      "R",
      "U2",
      "r'",
    ]);
    assert.equal(moveCount("(r U R' U R U2 r')(r' U' R U' R' U2 r)"), 14);
    assert.equal(
      formulaDisplay("(r U R' U R U2 r')(r' U' R U' R' U2 r)"),
      "(r U R' U R U2 r') (r' U' R U' R' U2 r)",
    );

    const formulas = collectFormulas(loadSample());
    const crown = formulas.find((formula) => formula.id === "oll-wca-18");
    const edges = formulas.find((formula) => formula.id === "oll-wca-28");
    assert.ok(crown?.algs);
    assert.ok(edges?.algs);
    assert.equal(
      crown.algs[0],
      "(R M' U R' U R U2 R' M)(R' M U' R U' R' U2 R M')",
    );
    assert.equal(crown.algs[2], "(r U R' U R U2 r')(r' U' R U' R' U2 r)");
    assert.equal(edges.algs[0], "(R M' U R' U')(M U R U' R')");
    assert.equal(edges.algs[2], "(r U R' U')(M U R U' R')");
    assert.notEqual(
      parseAlgorithm(crown.algs[0]).join(" "),
      parseAlgorithm(crown.algs[2] ?? "").join(" "),
    );

    const moreWide = [
      ["oll-wca-7", "(r U)(R' U R U2 r')"],
      ["oll-wca-5", "(r' U2)(R U R' U r)"],
      ["oll-wca-6", "(r U2)(R' U' R U' r')"],
      ["oll-wca-49", "(r U')(r2 U)(r2 U)(r2 U')(r)"],
      ["oll-wca-50", "(r' U)(r2 U')(r2 U')(r2 U)(r')"],
      ["oll-wca-54", "(r U)(R' U R U')(R' U R U2 r')"],
      ["oll-wca-53", "(l' U2)(L U L' U')(L U L' U)(l)"],
      ["oll-wca-8", "(R' F')(r U' r')(F2 R)"],
      ["oll-wca-56", "(r U r')(U R U' R')(U R U' R')(r U' r')"],
    ] as const;
    for (const [id, wide] of moreWide) {
      const formula = formulas.find((item) => item.id === id);
      assert.ok(formula?.algs, id);
      assert.equal(formula.algs[0], formula.moves, id);
      assert.equal(formula.algs[1], wide, id);
      assert.match(formula.moves, /M/, id);
      assert.match(wide, /\b[rl]\b/, id);
    }
  });

  it("拒绝整颗转动和空算法", () => {
    assert.throws(() => parseAlgorithm("R U X"), /无法按层转动：X/);
    assert.throws(() => parseAlgorithm("   "), /算法是空的/);
  });
});
