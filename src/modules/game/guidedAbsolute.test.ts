import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGuidedMoves } from "../scramble/guided.ts";
import { applyGuidedBleAbsoluteMove } from "./guidedAbsolute.ts";

describe("applyGuidedBleAbsoluteMove", () => {
  it("z2 后按绝对面匹配握持 L'（蓝牙 R'），不因 yaw 误读", () => {
    const guide = createGuidedMoves(["z2", "L'", "d", "L'"]);
    // 已过 z2
    const afterZ2 = {
      ...guide,
      progress: 1,
    };
    const orients = ["z2"];
    // 握持 L' → 绝对 R'
    const ok = applyGuidedBleAbsoluteMove(afterZ2, "R'", orients);
    assert.equal(ok.kind, "progress");
    assert.equal(ok.guide.progress, 2);
  });

  it("绝对面不对则进纠错", () => {
    const guide = {
      ...createGuidedMoves(["z2", "L'"]),
      progress: 1,
    };
    const bad = applyGuidedBleAbsoluteMove(guide, "F'", ["z2"]);
    assert.equal(bad.kind, "wrong");
  });

  it("z2 后握持 D 认绝对 U，不因白上映面误报 U'", () => {
    const guide = {
      ...createGuidedMoves(["z2", "D'", "U", "F'", "L2", "B", "D"]),
      progress: 6,
    };
    // 错误：用 [] 映面会把绝对 U 当成握持 U → 纠正 U'
    const withEmpty = applyGuidedBleAbsoluteMove(guide, "U", []);
    assert.equal(withEmpty.kind, "wrong");
    // 正确：公式 z2 下绝对 U = 握持 D
    const ok = applyGuidedBleAbsoluteMove(guide, "U", ["z2"]);
    assert.equal(ok.kind, "done");
    assert.equal(ok.guide.progress, 7);
  });

  it("f 后实况含 z：绝对 D' 推进 R'；仅 z2 时 D' 误报", () => {
    const guide = {
      ...createGuidedMoves(["z2", "U2", "f", "R'"]),
      progress: 3,
    };
    const onlyZ2 = applyGuidedBleAbsoluteMove(guide, "D'", ["z2"], ["z2"]);
    assert.equal(onlyZ2.kind, "wrong");
    const withLive = applyGuidedBleAbsoluteMove(
      guide,
      "D'",
      ["z2", "z"],
      ["z2"],
    );
    assert.equal(withLive.kind, "done");
  });

  it("d' 后实况仍 z2（已摆正）：绝对 L' 推进 R'，勿因期望 y' 把 B' 映成 L'", () => {
    const guide = {
      ...createGuidedMoves(["z2", "d'", "R'", "U", "R"]),
      progress: 2,
    };
    // 摆正后只剩 z2：色心 L' = 握持 R'
    const squared = applyGuidedBleAbsoluteMove(guide, "L'", ["z2"], ["z2"]);
    assert.equal(squared.kind, "progress");
    // 错误：死叠期望 y' 时 B'→L'，会误报请转 L
    const staleYaw = applyGuidedBleAbsoluteMove(
      guide,
      "B'",
      ["z2", "y'"],
      ["z2", "y'"],
    );
    assert.equal(staleYaw.kind, "wrong");
    // 实况回退到 z2 后，B' 不应被当成 R' 的纠正链
    const liveHint = applyGuidedBleAbsoluteMove(
      guide,
      "B'",
      ["z2", "y'"],
      ["z2"],
    );
    assert.equal(liveHint.kind, "wrong");
  });

  it("M' 后倾斜：绝对 F 推进 U（公式 z2 + 相对 x）；摆正绝对 D 亦推进", () => {
    const guide = {
      ...createGuidedMoves(["z2", "M'", "U", "R"]),
      progress: 2,
    };
    // 仅 z2 时 F≠U
    const stripped = applyGuidedBleAbsoluteMove(guide, "F", ["z2"], ["z2"]);
    assert.equal(stripped.kind, "wrong");
    const tilted = applyGuidedBleAbsoluteMove(guide, "F", ["z2", "x"], ["z2"]);
    assert.equal(tilted.kind, "progress");
    const squared = applyGuidedBleAbsoluteMove(guide, "D", ["z2"], ["z2"]);
    assert.equal(squared.kind, "progress");
  });

  it("f 后倾斜：绝对 D' 推进 R'；hint z2 兜底摆正", () => {
    const guide = {
      ...createGuidedMoves(["z2", "U2", "f", "R'"]),
      progress: 3,
    };
    const tilted = applyGuidedBleAbsoluteMove(guide, "D'", ["z2", "z"], ["z2"]);
    assert.equal(tilted.kind, "done");
    const squared = applyGuidedBleAbsoluteMove(guide, "L'", ["z2"], ["z2"]);
    assert.equal(squared.kind, "done");
  });

  it("r' 后相对符号反了：顶面 B 靠候选取反推进 U，勿报请转 D'", () => {
    const guide = {
      ...createGuidedMoves(["z2", "r'", "U"]),
      progress: 2,
    };
    // 错误符号：z2 x 把 B 映成 D
    const badOnly = applyGuidedBleAbsoluteMove(
      guide,
      "B",
      ["z2", "x"],
      ["z2", "x"],
    );
    assert.equal(badOnly.kind, "wrong");
    assert.deepEqual(badOnly.guide.wrongStack, ["D"]);
    // 候选含取反 z2 x'
    const ok = applyGuidedBleAbsoluteMove(
      guide,
      "B",
      ["z2", "x"],
      ["z2"],
      ["z2 x'"],
    );
    assert.equal(ok.kind, "done");
  });

  it("d' 后 R'：色心 L' 推进；勿因 S'/S 历史期望 Δ 把误面收成请转 L", () => {
    const moves = ["z2", "U'", "S'", "L", "S", "d'", "R'", "U", "R"];
    const guide = { ...createGuidedMoves(moves), progress: 6 };
    assert.equal(guide.displayMoves[6], "R'");
    // 正确：黄上握持 R' = 色心 L'
    const ok = applyGuidedBleAbsoluteMove(guide, "L'", ["z2"], ["z2"]);
    assert.equal(ok.kind, "progress");
    // 黄上禁止 raw===expected 原样：色心 R' 不得当成握持 R'
    const absR = applyGuidedBleAbsoluteMove(guide, "R'", ["z2"], ["z2"]);
    assert.equal(absR.kind, "wrong");
    assert.deepEqual(absR.guide.wrongStack, ["L'"]);
  });
});
