import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import {
  faceletsMidColumn,
  kpatternToFacelets,
} from "../bluetooth/moyu/pattern.ts";
import {
  expectedFixedCenterPattern,
  nailFixedCenters,
} from "../game/algStateMatch.ts";
import {
  LAYER_FOLLOW_WRONG_SETTLE_POLLS,
  resolveLayerFollowKind,
  shouldPlayBluetoothMoveAnim,
  tickScrambleGuideLayerFollow,
} from "./scrambleGuideLayerFollow.ts";

describe("scrambleGuideLayerFollow", () => {
  const moves = ["M", "E'", "S", "r", "l", "f'", "D", "B'", "z'", "y"];

  it("分类与动画策略", () => {
    assert.equal(resolveLayerFollowKind("M"), "slice");
    assert.equal(resolveLayerFollowKind("r"), "wide");
    assert.equal(resolveLayerFollowKind("D"), "face");
    assert.equal(resolveLayerFollowKind("z'"), null);
    // 引导禁止播设备面转包（避免 D 被固件报成 F）
    assert.equal(shouldPlayBluetoothMoveAnim("face"), false);
    assert.equal(shouldPlayBluetoothMoveAnim("slice"), false);
  });

  it("M 到位：facelets 全等即推进，期望 U 中列 BUB、F 中列 UFU", async () => {
    const reached = await expectedFixedCenterPattern(moves, 1);
    const facelets = kpatternToFacelets(reached);
    assert.equal(faceletsMidColumn(facelets, "U"), "BUB");
    assert.equal(faceletsMidColumn(facelets, "F"), "UFU");

    const tick = await tickScrambleGuideLayerFollow({
      facelets,
      setupAlg: "",
      displayMoves: moves,
      progress: 0,
      token: "M",
      kind: "slice",
      lastFacelets: "x",
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "reached");
    assert.equal(tick.shouldAdvance, true);
    assert.equal(tick.display.mode, "pattern");
    assert.equal(tick.debug.equal, true);
    if (tick.display.mode === "pattern") {
      assert.equal(tick.display.facelets, facelets);
    }
  });

  it("中层拧动中：不贴设备 restore，保持公式起点钉中心（白上）", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const mid = nailFixedCenters(puzzle.defaultPattern().applyAlg("R"));
    const start = kpatternToFacelets(
      await expectedFixedCenterPattern(moves, 0),
    );
    const tick = await tickScrambleGuideLayerFollow({
      facelets: kpatternToFacelets(mid),
      setupAlg: "R",
      displayMoves: moves,
      progress: 0,
      token: "M",
      kind: "slice",
      lastFacelets: "x",
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "in_progress");
    assert.equal(tick.display.mode, "pattern");
    assert.equal(tick.debug.equal, false);
    if (tick.display.mode === "pattern") {
      assert.equal(tick.display.facelets, start);
      assert.equal(faceletsMidColumn(tick.display.facelets, "F"), "FFF");
    }
  });

  it("中层停错仍保持起点钉中心画面", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const mid = nailFixedCenters(puzzle.defaultPattern().applyAlg("R"));
    const facelets = kpatternToFacelets(mid);
    const start = kpatternToFacelets(
      await expectedFixedCenterPattern(moves, 0),
    );
    const tick = await tickScrambleGuideLayerFollow({
      facelets,
      setupAlg: "R",
      displayMoves: moves,
      progress: 0,
      token: "M",
      kind: "slice",
      lastFacelets: facelets,
      settledSameCount: LAYER_FOLLOW_WRONG_SETTLE_POLLS - 1,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "wrong");
    assert.equal(tick.display.mode, "pattern");
    if (tick.display.mode === "pattern") {
      assert.equal(tick.display.facelets, start);
    }
  });

  it("已到位推进后 BLE 仍还原：E' 不误标 wrong，保持公式 M 画面", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const solved = kpatternToFacelets(puzzle.defaultPattern());
    assert.equal(faceletsMidColumn(solved, "U"), "UUU");
    const tick = await tickScrambleGuideLayerFollow({
      facelets: solved,
      setupAlg: "",
      displayMoves: moves,
      progress: 1,
      token: "E'",
      kind: "slice",
      lastFacelets: solved,
      settledSameCount: LAYER_FOLLOW_WRONG_SETTLE_POLLS + 2,
      hasWrongMark: false,
      entryFacelets: solved,
    });
    assert.equal(tick.check, "at_start");
    assert.equal(tick.shouldAdvance, false);
    assert.equal(tick.shouldMarkWrong, false);
    assert.equal(tick.debug.displayUF, "UBUB FUFU/FF");
  });

  it("M 推进后 E' 起点：restore 设备态也对齐，画面仍为 nail(M) 白心条", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const { restoreFixedCenters } = await import("../game/algStateMatch.ts");
    const restoreFl = kpatternToFacelets(
      restoreFixedCenters(puzzle.defaultPattern().applyAlg("M")),
    );
    assert.equal(faceletsMidColumn(restoreFl, "U"), "UUU");
    const tick = await tickScrambleGuideLayerFollow({
      facelets: restoreFl,
      setupAlg: "",
      displayMoves: moves,
      progress: 1,
      token: "E'",
      kind: "slice",
      lastFacelets: "x",
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "at_start");
    assert.equal(tick.debug.equal, true);
    assert.equal(tick.debug.expectUF, "UBUB FUFU/FF");
    assert.equal(tick.debug.displayUF, "UBUB FUFU/FF");
    assert.equal(tick.display.mode, "pattern");
    if (tick.display.mode === "pattern") {
      assert.equal(faceletsMidColumn(tick.display.facelets, "F"), "UFU");
    }
  });

  it("宽层 r 到位可推进", async () => {
    const start = await expectedFixedCenterPattern(moves, 3);
    const reached = await expectedFixedCenterPattern(moves, 4);
    const tick = await tickScrambleGuideLayerFollow({
      facelets: kpatternToFacelets(reached),
      setupAlg: "",
      displayMoves: moves,
      progress: 3,
      token: "r",
      kind: "wide",
      lastFacelets: kpatternToFacelets(start),
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "reached");
    assert.equal(tick.shouldAdvance, true);
  });

  it("面转拧动中仍贴钉中心起点（不贴设备 restore）", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const mid: KPattern = nailFixedCenters(
      puzzle.defaultPattern().applyAlg("R"),
    );
    const start = kpatternToFacelets(
      await expectedFixedCenterPattern(["D", "B'"], 0),
    );
    const tick = await tickScrambleGuideLayerFollow({
      facelets: kpatternToFacelets(mid),
      setupAlg: "",
      displayMoves: ["D", "B'"],
      progress: 0,
      token: "D",
      kind: "face",
      lastFacelets: "changed",
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "in_progress");
    assert.equal(tick.display.mode, "pattern");
    if (tick.display.mode === "pattern") {
      assert.equal(tick.display.facelets, start);
    }
  });

  it("截图：restore(前缀+D) 应对齐 D 到位，画面钉中心而非设备串", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const { restoreFixedCenters, expectedRawPattern } = await import(
      "../game/algStateMatch.ts"
    );
    const restoreAfterD = kpatternToFacelets(
      restoreFixedCenters(await expectedRawPattern(moves, 7)),
    );
    assert.equal(faceletsMidColumn(restoreAfterD, "U"), "RUD");
    assert.equal(faceletsMidColumn(restoreAfterD, "F"), "FFD");
    const nailAfterD = kpatternToFacelets(
      await expectedFixedCenterPattern(moves, 7),
    );
    const tick = await tickScrambleGuideLayerFollow({
      facelets: restoreAfterD,
      setupAlg: "",
      displayMoves: moves,
      progress: 6,
      token: "D",
      kind: "face",
      lastFacelets: "x",
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "reached");
    assert.equal(tick.shouldAdvance, true);
    assert.equal(tick.display.mode, "pattern");
    if (tick.display.mode === "pattern") {
      assert.equal(tick.display.facelets, nailAfterD);
      assert.notEqual(tick.display.facelets, restoreAfterD);
    }
  });
});
