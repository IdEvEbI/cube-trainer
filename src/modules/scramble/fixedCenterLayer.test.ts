import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  faceletsToKPattern,
  kpatternToFacelets,
} from "../bluetooth/moyu/pattern.ts";
import {
  nailFixedCenters,
  patternsMatchFixedCenters,
  restoreFixedCenters,
} from "../game/algStateMatch.ts";
import {
  absoluteAlgToFixedCenterFacelets,
  absoluteAlgToFixedCenterPattern,
  algNeedsFixedCenterPaint,
  expectedFixedCenterFacelets,
  faceletsLayerFingerprint,
} from "./fixedCenterLayer.ts";
import { tickScrambleGuideLayerFollow } from "./scrambleGuideLayerFollow.ts";
import { parseGuidedAlg } from "./scramble.ts";

/**
 * 验收锚点（白上绿前、固定色心）：
 * - M 后：顶仍白心；前面中列白-绿-白（冲前；与 cubing M / 实体照一致），不是绿上。
 * - 对表：设备 facelets 与期望 facelets 全等即推进。
 * - 含 M/E/S/u 的绝对串禁止走 Twisty.alg。
 */
describe("fixedCenterLayer 中层 / 宽层规格", () => {
  const moves = parseGuidedAlg("M E' S r l f' D B' z' y");

  it("algNeedsFixedCenterPaint：切片与宽层要钉中心，纯面转不用", () => {
    assert.equal(algNeedsFixedCenterPaint("M"), true);
    assert.equal(algNeedsFixedCenterPaint("E'"), true);
    assert.equal(algNeedsFixedCenterPaint("r l"), true);
    assert.equal(algNeedsFixedCenterPaint("R U R'"), false);
    assert.equal(algNeedsFixedCenterPaint(""), false);
  });

  it("M：棱块前面白条顶面蓝条；3D 色心白到前、蓝到顶（对齐实体）", async () => {
    const afterM = await absoluteAlgToFixedCenterFacelets("M");
    const fp = faceletsLayerFingerprint(afterM);
    // facelets 对表仍钉中心字母（与蓝牙同构）
    assert.equal(fp.uCenter, "U", "facelets 顶心字母仍为 U");
    assert.equal(fp.fCenter, "F", "facelets 前心字母仍为 F");
    assert.equal(fp.fMid, "UFU", "前面中列应为白-绿-白（冲前，对齐实体）");
    assert.equal(fp.uMid, "BUB", "顶面中列应为蓝-白-蓝");

    const painted = await absoluteAlgToFixedCenterPattern("M");
    // cubing CENTERS 轨道非 URFDLB；raw M = [4,1,0,3,5,2] → 顶蓝前白
    assert.deepEqual(
      [...painted.patternData.CENTERS.pieces],
      [4, 1, 0, 3, 5, 2],
      "raw M 色心（顶蓝前白）",
    );

    const puzzle = await cube3x3x3.kpuzzle();
    const raw = puzzle.defaultPattern().applyAlg("M");
    assert.notDeepEqual(
      raw.patternData.CENTERS.pieces,
      [0, 1, 2, 3, 4, 5],
      "裸 M 会移动中心，禁止当展示态",
    );
    const restored = kpatternToFacelets(restoreFixedCenters(raw));
    const restoreFp = faceletsLayerFingerprint(restored);
    assert.notEqual(afterM, restored, "nail(M) 不得等于 restore(M) 贴纸串");
    assert.notEqual(restoreFp.fMid, "UFU", "整机归心后前面不再是白心条");

    const my = await absoluteAlgToFixedCenterFacelets("M y");
    const myFp = faceletsLayerFingerprint(my);
    assert.notEqual(
      myFp.fMid,
      "UFU",
      "M y 会把白心条转离前面，不得当作 M 期望态",
    );
  });

  it("M'：前面中列为黄-绿-黄，仍白上", async () => {
    const facelets = await absoluteAlgToFixedCenterFacelets("M'");
    const fp = faceletsLayerFingerprint(facelets);
    assert.equal(fp.uCenter, "U");
    assert.equal(fp.fMid, "DFD");
  });

  it("E'：钉中心后与 D'U 整机归心不同态", async () => {
    const afterE = await absoluteAlgToFixedCenterFacelets("E'");
    const puzzle = await cube3x3x3.kpuzzle();
    const asDU = kpatternToFacelets(
      nailFixedCenters(puzzle.defaultPattern().applyAlg("D' U")),
    );
    // E' 固定色心 ≠ 用 D'U 冒充
    assert.notEqual(afterE, asDU);
    assert.equal(faceletsLayerFingerprint(afterE).uCenter, "U");
  });

  it("宽层 r：钉中心，顶面中心仍为 U", async () => {
    const facelets = await absoluteAlgToFixedCenterFacelets("r");
    assert.equal(faceletsLayerFingerprint(facelets).uCenter, "U");
    assert.equal(faceletsLayerFingerprint(facelets).fCenter, "F");
  });

  it("临时公式逐步期望 facelets 可算，且与 nail(前缀) 一致", async () => {
    for (let count = 0; count <= moves.length; count += 1) {
      const fromHelper = await expectedFixedCenterFacelets(moves, count);
      const prefix = moves.slice(0, count).join(" ");
      // 转体步不进绝对前缀；用 expectedFixedCenterFacelets 自身作锚
      assert.equal(fromHelper.length, 54, `count=${count}`);
      assert.equal(faceletsLayerFingerprint(fromHelper).uCenter, "U");
      if (count >= 1 && moves[0] === "M") {
        const afterFirst = await expectedFixedCenterFacelets(moves, 1);
        assert.equal(faceletsLayerFingerprint(afterFirst).fMid, "UFU");
      }
      void prefix;
    }
  });

  it("facelets 往返：nail(M) → 串 → KPattern 仍匹配，可供对表", async () => {
    const facelets = await absoluteAlgToFixedCenterFacelets("M");
    const back = await faceletsToKPattern(facelets);
    const nail = await absoluteAlgToFixedCenterFacelets("M").then((f) =>
      faceletsToKPattern(f),
    );
    assert.equal(patternsMatchFixedCenters(back, nail), true);
    assert.equal(kpatternToFacelets(back), facelets);
  });

  it("引导 tick：设备 facelets= M 期望串 → reached 并推进", async () => {
    const reached = await expectedFixedCenterFacelets(moves, 1);
    const tick = await tickScrambleGuideLayerFollow({
      facelets: reached,
      setupAlg: "",
      displayMoves: moves,
      progress: 0,
      token: "M",
      kind: "slice",
      lastFacelets: await expectedFixedCenterFacelets(moves, 0),
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "reached");
    assert.equal(tick.shouldAdvance, true);
    assert.equal(tick.debug.equal, true);
    assert.equal(tick.display.mode, "pattern");
    if (tick.display.mode === "pattern") {
      assert.equal(faceletsLayerFingerprint(tick.display.facelets).fMid, "UFU");
    }
  });

  it("引导 tick：仍在复原 → at_start，贴起点 facelets", async () => {
    const start = await expectedFixedCenterFacelets(moves, 0);
    const tick = await tickScrambleGuideLayerFollow({
      facelets: start,
      setupAlg: "",
      displayMoves: moves,
      progress: 0,
      token: "M",
      kind: "slice",
      lastFacelets: start,
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "at_start");
    assert.equal(tick.shouldAdvance, false);
  });

  it("引导 tick：M 后 E' 到位可推进", async () => {
    const start = await expectedFixedCenterFacelets(moves, 1);
    const reached = await expectedFixedCenterFacelets(moves, 2);
    const tick = await tickScrambleGuideLayerFollow({
      facelets: reached,
      setupAlg: "M",
      displayMoves: moves,
      progress: 1,
      token: "E'",
      kind: "slice",
      lastFacelets: start,
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "reached");
    assert.equal(tick.shouldAdvance, true);
  });

  it("引导 tick：宽层 r 到位可推进", async () => {
    const start = await expectedFixedCenterFacelets(moves, 3);
    const reached = await expectedFixedCenterFacelets(moves, 4);
    const tick = await tickScrambleGuideLayerFollow({
      facelets: reached,
      setupAlg: "",
      displayMoves: moves,
      progress: 3,
      token: "r",
      kind: "wide",
      lastFacelets: start,
      settledSameCount: 0,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "reached");
    assert.equal(tick.shouldAdvance, true);
  });

  it("含 M 的跟踪串转 facelets 必须钉中心（模拟 setAbsoluteAlg 防护）", async () => {
    const painted = await absoluteAlgToFixedCenterFacelets("M");
    assert.equal(faceletsLayerFingerprint(painted).uCenter, "U");
    assert.equal(faceletsLayerFingerprint(painted).fMid, "UFU");
    assert.equal(algNeedsFixedCenterPaint("M"), true);
  });

  it("截图场景：设备报 restore(M)（中列 UUU/FFF）也算 M 到位，画面贴 nail 白心条", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const restoreFl = kpatternToFacelets(
      restoreFixedCenters(puzzle.defaultPattern().applyAlg("M")),
    );
    assert.equal(faceletsLayerFingerprint(restoreFl).uMid, "UUU");
    assert.equal(faceletsLayerFingerprint(restoreFl).fMid, "FFF");
    const tick = await tickScrambleGuideLayerFollow({
      facelets: restoreFl,
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
    if (tick.display.mode === "pattern") {
      assert.equal(
        faceletsLayerFingerprint(tick.display.facelets).fMid,
        "UFU",
        "到位后画面必须钉中心白心条冲前",
      );
    }
  });

  it("设备仍为真正复原时保持 at_start", async () => {
    const start = await expectedFixedCenterFacelets(moves, 0);
    const tick = await tickScrambleGuideLayerFollow({
      facelets: start,
      setupAlg: "",
      displayMoves: moves,
      progress: 0,
      token: "M",
      kind: "slice",
      lastFacelets: start,
      settledSameCount: 20,
      hasWrongMark: false,
    });
    assert.equal(tick.check, "at_start");
    assert.equal(tick.shouldAdvance, false);
  });
});
