import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quatFromOrientationAlg } from "../../score/cubeOrientation.ts";
import {
  classifyMoyuLayerGestureMoves,
  disambiguateMoyuLayerGesture,
  expectedBurstMovesForLayer,
  expectedGyroDeltaAlg,
  matchMoyuLayerGesture,
  matchMoyuLayerGestureGyro,
  matchMoyuLayerGestureMoves,
  measureGyroDeltaAlg,
  movesMultisetKey,
  parseLayerGestureToken,
} from "./moyuLayerGesture.ts";

/** 2026-11-11 全量重采多数票（moves；d 系含二次重采）。 */
const CAPTURE: ReadonlyArray<{ label: string; moves: string[] }> = [
  { label: "M", moves: ["L'", "R"] },
  { label: "M'", moves: ["R'", "L"] },
  { label: "M2", moves: ["L'", "R", "L'", "R"] },
  { label: "M'2", moves: ["R'", "L", "R'", "L"] },
  { label: "E", moves: ["D'", "U"] },
  { label: "E'", moves: ["D", "U'"] },
  { label: "E2", moves: ["D'", "U", "D'", "U"] },
  { label: "E'2", moves: ["U'", "D", "U'", "D"] },
  { label: "S", moves: ["B", "F'"] },
  { label: "S'", moves: ["B'", "F"] },
  { label: "S2", moves: ["F'", "B", "F'", "B"] },
  { label: "S'2", moves: ["B'", "F", "B'", "F"] },
  { label: "r", moves: ["L"] },
  { label: "r'", moves: ["L'"] },
  { label: "r2", moves: ["L", "L"] },
  { label: "r'2", moves: ["L'", "L'"] },
  { label: "l", moves: ["R"] },
  { label: "l'", moves: ["R'"] },
  { label: "l2", moves: ["R", "R"] },
  { label: "l'2", moves: ["R'", "R'"] },
  { label: "f", moves: ["B"] },
  { label: "f'", moves: ["B'"] },
  { label: "f2", moves: ["B", "B"] },
  { label: "f'2", moves: ["B'", "B'"] },
  { label: "b", moves: ["F"] },
  { label: "b'", moves: ["F'"] },
  { label: "b2", moves: ["F", "F"] },
  { label: "b'2", moves: ["F'", "F'"] },
  { label: "u", moves: ["D"] },
  { label: "u'", moves: ["D'"] },
  { label: "u2", moves: ["D", "D"] },
  { label: "u'2", moves: ["D'", "D'"] },
  { label: "d", moves: ["U"] },
  { label: "d'", moves: ["U'"] },
  { label: "d2", moves: ["U", "U"] },
  { label: "d'2", moves: ["U'", "U'"] },
];

/**
 * 真机相对 Δ 样例（取各记号一条干净 before→after）。
 * `d2`/`d'2` 用干净的 `y2` 条。
 */
const CAPTURE_GYRO: ReadonlyArray<{
  label: string;
  moves: string[];
  before: string;
  after: string;
  delta: string;
  disambiguateAs: string;
}> = [
  {
    label: "M",
    moves: ["L'", "R"],
    before: "",
    after: "x",
    delta: "x",
    disambiguateAs: "M",
  },
  {
    label: "M'",
    moves: ["R'", "L"],
    before: "",
    after: "x'",
    delta: "x'",
    disambiguateAs: "M'",
  },
  {
    label: "M2",
    moves: ["L'", "R", "L'", "R"],
    before: "",
    after: "z2 y2",
    delta: "z2 y2",
    disambiguateAs: "M2",
  },
  {
    label: "M'2",
    moves: ["R'", "L", "R'", "L"],
    before: "",
    after: "z2 y2",
    delta: "z2 y2",
    disambiguateAs: "M'2",
  },
  {
    label: "E",
    moves: ["D'", "U"],
    before: "",
    after: "y",
    delta: "y",
    disambiguateAs: "E",
  },
  {
    label: "E'",
    moves: ["D", "U'"],
    before: "",
    after: "y'",
    delta: "y'",
    disambiguateAs: "E'",
  },
  {
    label: "E2",
    moves: ["D'", "U", "D'", "U"],
    before: "",
    after: "y2",
    delta: "y2",
    disambiguateAs: "E2",
  },
  {
    label: "E'2",
    moves: ["U'", "D", "U'", "D"],
    before: "",
    after: "y2",
    delta: "y2",
    disambiguateAs: "E'2",
  },
  {
    label: "S",
    moves: ["B", "F'"],
    before: "",
    after: "z",
    delta: "z",
    disambiguateAs: "S",
  },
  {
    label: "S'",
    moves: ["B'", "F"],
    before: "",
    after: "z'",
    delta: "z'",
    disambiguateAs: "S'",
  },
  {
    label: "S2",
    moves: ["F'", "B", "F'", "B"],
    before: "",
    after: "z2",
    delta: "z2",
    disambiguateAs: "S2",
  },
  {
    label: "S'2",
    moves: ["B'", "F", "B'", "F"],
    before: "",
    after: "z2",
    delta: "z2",
    disambiguateAs: "S'2",
  },
  {
    label: "r",
    moves: ["L"],
    before: "",
    after: "x'",
    delta: "x'",
    disambiguateAs: "r",
  },
  {
    label: "r'",
    moves: ["L'"],
    before: "",
    after: "x",
    delta: "x",
    disambiguateAs: "r'",
  },
  {
    label: "r2",
    moves: ["L", "L"],
    before: "",
    after: "z2 y2",
    delta: "z2 y2",
    disambiguateAs: "r2",
  },
  {
    label: "r'2",
    moves: ["L'", "L'"],
    before: "",
    after: "z2 y2",
    delta: "z2 y2",
    disambiguateAs: "r'2",
  },
  {
    label: "l",
    moves: ["R"],
    before: "",
    after: "x",
    delta: "x",
    disambiguateAs: "l",
  },
  {
    label: "l'",
    moves: ["R'"],
    before: "",
    after: "x'",
    delta: "x'",
    disambiguateAs: "l'",
  },
  {
    label: "l2",
    moves: ["R", "R"],
    before: "",
    after: "z2 y2",
    delta: "z2 y2",
    disambiguateAs: "l2",
  },
  {
    label: "l'2",
    moves: ["R'", "R'"],
    before: "",
    after: "z2 y2",
    delta: "z2 y2",
    disambiguateAs: "l'2",
  },
  {
    label: "f",
    moves: ["B"],
    before: "",
    after: "z",
    delta: "z",
    disambiguateAs: "f",
  },
  {
    label: "f'",
    moves: ["B'"],
    before: "",
    after: "z'",
    delta: "z'",
    disambiguateAs: "f'",
  },
  {
    label: "f2",
    moves: ["B", "B"],
    before: "",
    after: "z2",
    delta: "z2",
    disambiguateAs: "f2",
  },
  {
    label: "f'2",
    moves: ["B'", "B'"],
    before: "",
    after: "z2",
    delta: "z2",
    disambiguateAs: "f'2",
  },
  {
    label: "b",
    moves: ["F"],
    before: "",
    after: "z'",
    delta: "z'",
    disambiguateAs: "b",
  },
  {
    label: "b'",
    moves: ["F'"],
    before: "",
    after: "z",
    delta: "z",
    disambiguateAs: "b'",
  },
  {
    label: "b2",
    moves: ["F", "F"],
    before: "",
    after: "z2",
    delta: "z2",
    disambiguateAs: "b2",
  },
  {
    label: "b'2",
    moves: ["F'", "F'"],
    before: "",
    after: "z2",
    delta: "z2",
    disambiguateAs: "b'2",
  },
  {
    label: "u",
    moves: ["D"],
    before: "",
    after: "y'",
    delta: "y'",
    disambiguateAs: "u",
  },
  {
    label: "u'",
    moves: ["D'"],
    before: "",
    after: "y",
    delta: "y",
    disambiguateAs: "u'",
  },
  {
    label: "u2",
    moves: ["D", "D"],
    before: "",
    after: "y2",
    delta: "y2",
    disambiguateAs: "u2",
  },
  {
    label: "u'2",
    moves: ["D'", "D'"],
    before: "",
    after: "y2",
    delta: "y2",
    disambiguateAs: "u'2",
  },
  {
    label: "d",
    moves: ["U"],
    before: "",
    after: "y",
    delta: "y",
    disambiguateAs: "d",
  },
  {
    label: "d'",
    moves: ["U'"],
    before: "",
    after: "y'",
    delta: "y'",
    disambiguateAs: "d'",
  },
  {
    label: "d2",
    moves: ["U", "U"],
    before: "",
    after: "y2",
    delta: "y2",
    disambiguateAs: "d2",
  },
  {
    label: "d'2",
    moves: ["U'", "U'"],
    before: "",
    after: "y2",
    delta: "y2",
    disambiguateAs: "d'2",
  },
];

describe("moyuLayerGesture", () => {
  it("无序多重集：R L' 与 L' R 同键", () => {
    assert.equal(movesMultisetKey(["R", "L'"]), movesMultisetKey(["L'", "R"]));
    assert.equal(movesMultisetKey(["R", "L'"]), "L' R");
  });

  it("parse：宽层 / 中层与后缀", () => {
    assert.deepEqual(parseLayerGestureToken("r'"), {
      label: "r'",
      kind: "wide",
      family: "r",
      suffix: "'",
    });
    assert.deepEqual(parseLayerGestureToken("M2"), {
      label: "M2",
      kind: "slice",
      family: "M",
      suffix: "2",
    });
    assert.deepEqual(parseLayerGestureToken("r'2"), {
      label: "r'2",
      kind: "wide",
      family: "r",
      suffix: "2",
    });
    assert.equal(parseLayerGestureToken("R"), null);
    assert.equal(parseLayerGestureToken("x'"), null);
  });

  it("真机表：每条 label 都能 match 自身 moves", () => {
    for (const row of CAPTURE) {
      assert.equal(
        matchMoyuLayerGestureMoves(row.label, row.moves),
        true,
        `${row.label} ← ${row.moves.join(" ")}`,
      );
    }
  });

  it("中层顺序对调仍匹配；E 与 E'、M 与 M' 可区分", () => {
    assert.equal(matchMoyuLayerGestureMoves("M", ["R", "L'"]), true);
    assert.equal(matchMoyuLayerGestureMoves("M'", ["L", "R'"]), true);
    assert.equal(matchMoyuLayerGestureMoves("M", ["L", "R'"]), false);
    assert.equal(
      matchMoyuLayerGestureMoves("S2", ["B", "F'", "B", "F'"]),
      true,
    );
    assert.equal(matchMoyuLayerGestureMoves("E", ["D", "U'"]), false);
    assert.equal(matchMoyuLayerGestureMoves("E'", ["D'", "U"]), false);
  });

  it("宽层：对面包；*2 为两下；错面不匹配", () => {
    assert.equal(matchMoyuLayerGestureMoves("r", ["L"]), true);
    assert.equal(matchMoyuLayerGestureMoves("r", ["R"]), false);
    assert.equal(matchMoyuLayerGestureMoves("r'", ["L'"]), true);
    assert.equal(matchMoyuLayerGestureMoves("r2", ["L", "L"]), true);
    assert.equal(matchMoyuLayerGestureMoves("r2", ["L"]), false);
    assert.equal(matchMoyuLayerGestureMoves("r'2", ["L'", "L'"]), true);
    assert.equal(matchMoyuLayerGestureMoves("f", ["B"]), true);
    assert.equal(matchMoyuLayerGestureMoves("d2", ["U", "U"]), true);
    assert.equal(matchMoyuLayerGestureMoves("R", ["R"]), false);
  });

  it("classify：单包四分之一；双包宽层*2或中层；四包中层*2", () => {
    assert.deepEqual(classifyMoyuLayerGestureMoves(["L"]), ["r"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["L'"]), ["r'"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["L", "L"]), ["r2"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["L'", "L'"]), ["r'2"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["R", "L'"]), ["M"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["L", "R'"]), ["M'"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["L'", "R", "L'", "R"]), [
      "M2",
    ]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["R'", "L", "R'", "L"]), [
      "M'2",
    ]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["D'", "U"]), ["E"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["D", "U'"]), ["E'"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["B", "F'"]), ["S"]);
    assert.deepEqual(classifyMoyuLayerGestureMoves(["U", "R"]), []);
    assert.deepEqual(classifyMoyuLayerGestureMoves([]), []);
  });

  it("expectedBurstMovesForLayer 与宽层对面、中层键一致", () => {
    assert.deepEqual(expectedBurstMovesForLayer("r'"), ["L'"]);
    assert.deepEqual(expectedBurstMovesForLayer("r2"), ["L", "L"]);
    assert.deepEqual(expectedBurstMovesForLayer("r'2"), ["L'", "L'"]);
    assert.deepEqual(expectedBurstMovesForLayer("d2"), ["U", "U"]);
    assert.deepEqual(expectedBurstMovesForLayer("f"), ["B"]);
    assert.deepEqual(expectedBurstMovesForLayer("E'"), ["D", "U'"]);
    assert.deepEqual(expectedBurstMovesForLayer("M2"), ["L'", "L'", "R", "R"]);
    assert.equal(expectedBurstMovesForLayer("x"), null);
  });

  it("真机相对陀螺 Δ 与 measure 一致", () => {
    for (const row of CAPTURE_GYRO) {
      const measured = measureGyroDeltaAlg(
        quatFromOrientationAlg(row.before),
        quatFromOrientationAlg(row.after),
      );
      assert.equal(measured, row.delta, row.label);
    }
  });

  it("消歧：真机包+陀螺落到唯一记号", () => {
    for (const row of CAPTURE_GYRO) {
      const got = disambiguateMoyuLayerGesture({
        burstMoves: row.moves,
        gyroBefore: quatFromOrientationAlg(row.before),
        gyroAfter: quatFromOrientationAlg(row.after),
      });
      assert.equal(got, row.disambiguateAs, row.label);
    }
  });

  it("消歧：M' 与 M / 宽层 *2 可分", () => {
    assert.equal(
      disambiguateMoyuLayerGesture({
        burstMoves: ["L", "R'"],
        gyroBefore: quatFromOrientationAlg(""),
        gyroAfter: quatFromOrientationAlg("x'"),
      }),
      "M'",
    );
    assert.equal(
      disambiguateMoyuLayerGesture({
        burstMoves: ["L"],
        gyroBefore: quatFromOrientationAlg(""),
        gyroAfter: quatFromOrientationAlg("x'"),
      }),
      "r",
    );
    assert.equal(
      disambiguateMoyuLayerGesture({
        burstMoves: ["L", "L"],
        gyroBefore: quatFromOrientationAlg(""),
        gyroAfter: quatFromOrientationAlg("z2 y2"),
      }),
      "r2",
    );
  });

  it("宽层：无陀螺或陀螺静默 ≠ r（避免与外层 L 混淆）", () => {
    assert.equal(
      matchMoyuLayerGesture({
        expectedToken: "r",
        burstMoves: ["L"],
      }),
      false,
    );
    assert.equal(
      matchMoyuLayerGesture({
        expectedToken: "r",
        burstMoves: ["L"],
        gyroBefore: quatFromOrientationAlg(""),
        gyroAfter: quatFromOrientationAlg(""),
      }),
      false,
    );
  });

  it("match 带陀螺：包对但朝向不对则失败；真机表全过", () => {
    assert.equal(
      matchMoyuLayerGesture({
        expectedToken: "r",
        burstMoves: ["L"],
        gyroBefore: quatFromOrientationAlg(""),
        gyroAfter: quatFromOrientationAlg("z2 y2"),
      }),
      false,
    );
    assert.equal(
      matchMoyuLayerGestureGyro(
        "r2",
        quatFromOrientationAlg(""),
        quatFromOrientationAlg("x2"),
      ),
      true,
    );
    for (const row of CAPTURE) {
      const expect = expectedGyroDeltaAlg(row.label);
      assert.ok(expect, row.label);
      assert.equal(
        matchMoyuLayerGesture({
          expectedToken: row.label,
          burstMoves: row.moves,
          gyroBefore: quatFromOrientationAlg(""),
          gyroAfter: quatFromOrientationAlg(expect!),
        }),
        true,
        row.label,
      );
    }
  });

  it("expectedGyroDeltaAlg：x2 规范为可吸附串", () => {
    assert.equal(expectedGyroDeltaAlg("M2"), "z2 y2");
    assert.equal(expectedGyroDeltaAlg("d2"), "y2");
    assert.equal(expectedGyroDeltaAlg("R"), null);
  });
});
