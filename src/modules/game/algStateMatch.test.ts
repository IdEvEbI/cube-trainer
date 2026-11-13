import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  algStatesMatch,
  expectedFixedCenterPattern,
  guideAlgToCubingAlg,
  guidePaintAlgPrefix,
  guideProgressMatchesCube,
  guideTokenToCubingAlg,
  nonRotationAlgPrefix,
  patternsMatchFixedCenters,
} from "./algStateMatch.ts";

describe("guideTokenToCubingAlg", () => {
  it("采集式双步撇改写为 cubing 可解析的 2'", () => {
    assert.equal(guideTokenToCubingAlg("r'2"), "r2'");
    assert.equal(guideTokenToCubingAlg("d'2"), "d2'");
    assert.equal(guideTokenToCubingAlg("M'2"), "M2'");
    assert.equal(guideTokenToCubingAlg("r2"), "r2");
    assert.equal(guideTokenToCubingAlg("d'"), "d'");
  });

  it("guideAlgToCubingAlg 整串含 '2 时仍可规范化", () => {
    assert.equal(guideAlgToCubingAlg("r'2 r2 d'2"), "r2' r2 d2'");
  });
});

describe("algStatesMatch", () => {
  it("same alg matches", async () => {
    assert.equal(await algStatesMatch("R U", "R U"), true);
  });

  it("z2 then inverse returns to identity", async () => {
    assert.equal(await algStatesMatch("z2 z2", ""), true);
  });

  it("different states do not match", async () => {
    assert.equal(await algStatesMatch("R", "U"), false);
  });

  it("归中心后切片与 facelets 等价面转对得上", async () => {
    // 实体 E ≡ 归中心后的 D' U；宽层 u' ≡ D'
    assert.equal(await algStatesMatch("E", "D' U"), true);
    assert.equal(await algStatesMatch("E'", "D U'"), true);
    assert.equal(await algStatesMatch("M", "L' R"), true);
    assert.equal(await algStatesMatch("u'", "D'"), true);
    assert.equal(await algStatesMatch("U' E", "u'"), true);
    assert.equal(await algStatesMatch("U' E'", "u'"), false);
  });

  it("打乱后再 E' 能与纯面转 setup 对上", async () => {
    assert.equal(await algStatesMatch("R U F' E'", "R U F' U' D"), true);
  });
});

describe("nonRotationAlgPrefix", () => {
  it("strips x/y/z, remaps grip faces after z2, respects count", () => {
    assert.equal(nonRotationAlgPrefix(["R", "z2", "U'", "u'"], 0), "");
    assert.equal(nonRotationAlgPrefix(["R", "z2", "U'", "u'"], 2), "R");
    // z2 后握持 U'/u' → 绝对 D'/d'
    assert.equal(nonRotationAlgPrefix(["R", "z2", "U'", "u'"], 4), "R D' d'");
  });

  it("rejects non-finite count (would otherwise paint solved)", () => {
    assert.throws(
      () => nonRotationAlgPrefix(["M", "E'", "z'"], Number.NaN),
      /finite number/,
    );
  });

  it("keeps face prefix when standing on trailing z'", () => {
    const moves = ["M", "E'", "S", "r", "l", "f'", "D", "B'", "z'", "y"];
    assert.equal(nonRotationAlgPrefix(moves, 8), "M E' S r l f' D B'");
    assert.equal(nonRotationAlgPrefix(moves, 9), "M E' S r l f' D B'");
  });
});

describe("guidePaintAlgPrefix", () => {
  it("keeps trailing rotations for 3D paint", () => {
    const moves = ["M", "E'", "S", "r", "l", "f'", "D", "B'", "z'", "y"];
    assert.equal(guidePaintAlgPrefix(moves, 8), "M E' S r l f' D B'");
    assert.equal(guidePaintAlgPrefix(moves, 9), "M E' S r l f' D B' z'");
    assert.equal(guidePaintAlgPrefix(moves, 10), "M E' S r l f' D B' z' y");
  });
});

describe("expectedFixedCenterPattern + setupAlg", () => {
  it("未还原起点：期望态 = setup ⊕ 公式前缀，不等于从复原起的同前缀", async () => {
    const fromSolved = await expectedFixedCenterPattern(["M"], 0);
    const fromScrambledStart = await expectedFixedCenterPattern(
      ["M"],
      0,
      "R U",
    );
    assert.equal(
      patternsMatchFixedCenters(fromSolved, fromScrambledStart),
      false,
    );
    const afterM = await expectedFixedCenterPattern(["M"], 1, "R U");
    const viaCompose = await expectedFixedCenterPattern(["R", "U", "M"], 3);
    assert.equal(patternsMatchFixedCenters(afterM, viaCompose), true);
  });

  it("公式含采集式 d'2 时期望态可算（不抛），与 d2' 同态", async () => {
    const fromCapture = await expectedFixedCenterPattern(
      ["r'2", "r2", "d'2"],
      3,
    );
    const fromCubing = await expectedFixedCenterPattern(
      ["r2'", "r2", "d2'"],
      3,
    );
    assert.equal(patternsMatchFixedCenters(fromCapture, fromCubing), true);
  });
});

describe("guideProgressMatchesCube", () => {
  it("进度前缀与蓝牙 setup 同态时通过", async () => {
    const moves = ["R", "U", "F'"];
    assert.equal(await guideProgressMatchesCube(moves, 2, "R U"), true);
    assert.equal(await guideProgressMatchesCube(moves, 2, "R F"), false);
  });

  it("含 z2 时与纯面转贴纸态仍可对上", async () => {
    assert.equal(
      await guideProgressMatchesCube(["R", "z2", "L2"], 3, "R R2"),
      true,
    );
  });
});
