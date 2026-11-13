import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
  catchUpLayerGuideAnimIfPending,
  layerGuideMatchIdleMs,
  layerGuideVisualToken,
  planLayerGuideAnim,
  resolveLayerFollowKind,
  resolveLayerGuideAnimMs,
  shouldPlayBluetoothMoveAnim,
  tickScrambleGuideLayerFollow,
} from "./scrambleGuideLayerFollow.ts";

describe("scrambleGuideLayerFollow", () => {
  const moves = ["M", "E'", "S", "r", "l", "f'", "D", "B'", "z'", "y"];

  it("分类与动画策略", () => {
    assert.equal(resolveLayerFollowKind("M"), "slice");
    assert.equal(resolveLayerFollowKind("r"), "wide");
    // 外层面转（含 R2）不走 facelets 流水线，避免半步被标 wrong
    assert.equal(resolveLayerFollowKind("D"), null);
    assert.equal(resolveLayerFollowKind("R2"), null);
    assert.equal(resolveLayerFollowKind("z'"), null);
    // 层转不播拆包外层动画，改走整步 animateGuideStep
    assert.equal(shouldPlayBluetoothMoveAnim("slice"), false);
    assert.equal(shouldPlayBluetoothMoveAnim("wide"), false);
  });

  it("layerGuideVisualToken：四分之一一次；*2 按包数分两相", () => {
    assert.equal(layerGuideVisualToken("M", 0), null);
    assert.deepEqual(layerGuideVisualToken("M", 1), {
      animToken: "M",
      phaseKey: "1",
    });
    assert.deepEqual(layerGuideVisualToken("E2", 1), {
      animToken: "E",
      phaseKey: "1",
    });
    assert.deepEqual(layerGuideVisualToken("E2", 2), {
      animToken: "E",
      phaseKey: "1",
    });
    assert.deepEqual(layerGuideVisualToken("E2", 3), {
      animToken: "E",
      phaseKey: "2",
    });
    assert.deepEqual(layerGuideVisualToken("r2", 2), {
      animToken: "r",
      phaseKey: "2",
    });
  });

  it("planLayerGuideAnim：快拧一次收齐播整步；慢拧仍两相", () => {
    assert.deepEqual(planLayerGuideAnim("r2", 0, 2), {
      animToken: "r2",
      phaseKey: "full",
      quarterTurnMs: 130,
      resetToStepStart: false,
    });
    assert.deepEqual(planLayerGuideAnim("r'2", 0, 2), {
      animToken: "r'2",
      phaseKey: "full",
      quarterTurnMs: 130,
      resetToStepStart: false,
    });
    assert.equal(planLayerGuideAnim("M", 0, 1), null);
    assert.deepEqual(planLayerGuideAnim("M", 0, 2), {
      animToken: "M",
      phaseKey: "1",
      quarterTurnMs: 240,
      resetToStepStart: false,
    });
    assert.deepEqual(planLayerGuideAnim("r", 0, 1), {
      animToken: "r",
      phaseKey: "1",
      quarterTurnMs: 240,
      resetToStepStart: false,
    });
    assert.deepEqual(planLayerGuideAnim("r2", 0, 1), {
      animToken: "r",
      phaseKey: "1",
      quarterTurnMs: 200,
      resetToStepStart: false,
    });
    const secondHalf = planLayerGuideAnim("r2", 1, 2);
    assert.deepEqual(secondHalf, {
      animToken: "r",
      phaseKey: "2",
      quarterTurnMs: 180,
      resetToStepStart: false,
    });
    assert.ok(secondHalf);
    assert.deepEqual(catchUpLayerGuideAnimIfPending("r2", secondHalf!, true), {
      animToken: "r2",
      phaseKey: "catch-full",
      quarterTurnMs: 130,
      resetToStepStart: true,
    });
    assert.equal(
      catchUpLayerGuideAnimIfPending("r2", secondHalf!, false),
      secondHalf,
    );
    assert.equal(planLayerGuideAnim("r2", 2, 2), null);
  });

  it("resolveLayerGuideAnimMs：优先手势墙钟；快拧保持短时长", () => {
    const quarter = planLayerGuideAnim("M", 0, 2)!;
    assert.equal(resolveLayerGuideAnimMs(quarter, [], 200), 180);
    assert.equal(resolveLayerGuideAnimMs(quarter, [], 500), 400);
    assert.equal(
      resolveLayerGuideAnimMs(quarter, [
        { intervalMs: 0 },
        { intervalMs: 110 },
      ]),
      240,
    );
    const full = planLayerGuideAnim("r2", 0, 2)!;
    assert.equal(
      resolveLayerGuideAnimMs(full, [{ intervalMs: 200 }, { intervalMs: 200 }]),
      130,
    );
    assert.equal(layerGuideMatchIdleMs("1"), 420);
    assert.equal(layerGuideMatchIdleMs("full"), 280);
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

  it("未还原起点：scrambleSetup ⊕ M 到位可推进，不对复原态期望", async () => {
    const scrambleSetup = "R U";
    const atStart = await expectedFixedCenterPattern(moves, 0, scrambleSetup);
    const reached = await expectedFixedCenterPattern(moves, 1, scrambleSetup);
    const startFacelets = kpatternToFacelets(atStart);
    const reachedFacelets = kpatternToFacelets(reached);

    const stuckOnSolvedExpect = await tickScrambleGuideLayerFollow({
      facelets: startFacelets,
      setupAlg: scrambleSetup,
      scrambleSetupAlg: scrambleSetup,
      displayMoves: moves,
      progress: 0,
      token: "M",
      kind: "slice",
      lastFacelets: startFacelets,
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(stuckOnSolvedExpect.check, "at_start");
    assert.equal(stuckOnSolvedExpect.shouldAdvance, false);

    const tick = await tickScrambleGuideLayerFollow({
      facelets: reachedFacelets,
      setupAlg: `${scrambleSetup} M`,
      scrambleSetupAlg: scrambleSetup,
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
    assert.equal(tick.trackSetupAlg, "R U M");
  });

  it("中层拧动中：keep 画面（整步动画由 animateGuideStep 负责）", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const mid = nailFixedCenters(puzzle.defaultPattern().applyAlg("R"));
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
    assert.equal(tick.display.mode, "keep");
    assert.equal(tick.debug.equal, false);
  });

  it("E2 拧到一半（仅 E）视为进行中，不误标 wrong，画面 keep 留给第二记动画", async () => {
    const sequence = ["S", "E2", "M2"];
    const half = await expectedFixedCenterPattern(["S", "E"], 2);
    const facelets = kpatternToFacelets(half);
    const tick = await tickScrambleGuideLayerFollow({
      facelets,
      setupAlg: "S E",
      displayMoves: sequence,
      progress: 1,
      token: "E2",
      kind: "slice",
      lastFacelets: facelets,
      settledSameCount: LAYER_FOLLOW_WRONG_SETTLE_POLLS + 2,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "in_progress");
    assert.equal(tick.shouldMarkWrong, false);
    assert.equal(tick.shouldAdvance, false);
    assert.equal(tick.display.mode, "keep");
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

  it("宽层到位：restore 串应对齐钉中心画面", async () => {
    const { restoreFixedCenters, expectedRawPattern } = await import(
      "../game/algStateMatch.ts"
    );
    const restoreAfterR = kpatternToFacelets(
      restoreFixedCenters(await expectedRawPattern(moves, 4)),
    );
    const nailAfterR = kpatternToFacelets(
      await expectedFixedCenterPattern(moves, 4),
    );
    const tick = await tickScrambleGuideLayerFollow({
      facelets: restoreAfterR,
      setupAlg: "",
      displayMoves: moves,
      progress: 3,
      token: "r",
      kind: "wide",
      lastFacelets: "x",
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "reached");
    assert.equal(tick.shouldAdvance, true);
    assert.equal(tick.display.mode, "pattern");
    if (tick.display.mode === "pattern") {
      assert.equal(tick.display.facelets, nailAfterR);
      assert.notEqual(tick.display.facelets, restoreAfterR);
    }
  });
});
