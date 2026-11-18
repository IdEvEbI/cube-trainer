/**
 * 游戏页跟拧契约（表驱动）。
 * 复原进入：F0 空、打乱+求解、Cross 可含 z2、跟完须还原。
 * 未还原自由求解已停用；进页闸与复原路径隔开。
 * 禁止为 M/S/E / z2 / U2 各写专用分支；映面与确认走同一套规则。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  gameGuidePaintAlg,
  patternsMatchIgnoringCenters,
  shouldSeekBackAfterCrossManualConfirm,
} from "./algStateMatch.ts";
import { trySolveCfopGame } from "./cfopSolve.ts";
import {
  GAME_ENTRY_RESTORED_TOAST,
  gateGamePageEntry,
} from "./gameEntryGate.ts";
import { createGamePageCursor } from "./gamePlayback.ts";
import {
  gripLayerMoveFromBleAbsolute,
  layerGestureAbsoluteToken,
  remapGripTokenToPuzzleHint,
} from "./guideOrientation.ts";
import {
  layerGuideGyroAnimKey,
  shouldRestartLayerGuideGyroTrack,
} from "./layerGuideAnimKey.ts";
import { stepGamePageBleAbsoluteFace } from "./guidedAbsolute.ts";
import {
  applyGuidedMove,
  confirmGuidedManualStep,
  createGuidedMoves,
  guidedScrambleView,
  invertGuideToken,
} from "../scramble/guided.ts";
import { guideRotationStepConfirmable } from "../score/cubeOrientation.ts";

const SLICE_QUARTERS = ["M", "M'", "E", "E'", "S", "S'"] as const;

describe("契约 · 复原进入跟完须还原", () => {
  it("F0 空：solveInput 仅为打乱；Cross 可含 z2；打乱+解终态还原", async () => {
    const scramble = "R U F'";
    const result = await trySolveCfopGame(scramble, "");
    assert.equal(result.ok, true, result.ok ? "" : result.reason);
    if (!result.ok) {
      return;
    }
    assert.equal(result.solveInput, scramble);
    assert.equal(result.phases[0]?.moves[0], "z2");

    const tokens = scramble.split(/\s+/);
    const cursor = createGamePageCursor(tokens, result.phases);
    assert.deepEqual(cursor.scrambleMoves, tokens);
    assert.equal(cursor.segments[0]?.id, "scramble");

    const paintEnd = gameGuidePaintAlg(
      "",
      tokens.length,
      cursor.flatMoves,
      cursor.flatMoves.length,
    );
    assert.equal(paintEnd, cursor.flatMoves.join(" "));

    const puzzle = await cube3x3x3.kpuzzle();
    const id = puzzle.defaultPattern();
    const yellow = id.applyAlg("z2");
    const after = id.applyAlg(paintEnd);
    assert.equal(
      patternsMatchIgnoringCenters(after, yellow) ||
        patternsMatchIgnoringCenters(after, id),
      true,
      "跟完打乱+求解须还原",
    );
  });

  it("进页闸：蓝牙未还原不可进；非蓝牙只提示不阻止", () => {
    assert.deepEqual(
      gateGamePageEntry({ bluetoothConnected: true, cubeRestored: false }),
      { allow: false, toast: GAME_ENTRY_RESTORED_TOAST },
    );
    assert.deepEqual(
      gateGamePageEntry({ bluetoothConnected: true, cubeRestored: null }),
      { allow: false, toast: GAME_ENTRY_RESTORED_TOAST },
    );
    assert.deepEqual(
      gateGamePageEntry({ bluetoothConnected: true, cubeRestored: true }),
      { allow: true, toast: null },
    );
    assert.deepEqual(
      gateGamePageEntry({ bluetoothConnected: false, cubeRestored: false }),
      { allow: true, toast: GAME_ENTRY_RESTORED_TOAST },
    );
  });
});

describe("契约 · z2 后中层握持↔绝对同一套（M/E/S）", () => {
  const orients = ["z2"] as const;

  for (const grip of SLICE_QUARTERS) {
    it(`期望 ${grip}：绝对匹配映回握持后只推进一次`, () => {
      const abs = layerGestureAbsoluteToken(grip, orients);
      assert.equal(abs, remapGripTokenToPuzzleHint(grip, orients));
      // 绝对包对上期望 → 握持仍是 grip（到位，不是反转）
      assert.equal(gripLayerMoveFromBleAbsolute(abs, grip, orients), grip);

      const guide = {
        ...createGuidedMoves(["z2", grip, "U"]),
        progress: 1,
      };
      assert.equal(guidedScrambleView(guide).manualMove, grip);
      // 中层到位走手动确认（与 GamePage tryConfirm 同入口），不是 apply 面转。
      const step = confirmGuidedManualStep(guide);
      assert.equal(step.kind, "progress");
      assert.equal(step.guide.progress, 2);
      assert.equal(step.guide.sameFaceInverseCount ?? 0, 0);
      const again = confirmGuidedManualStep(step.guide);
      assert.notEqual(again.guide.progress, 3);
    });

    it(`期望 ${grip}：绝对反转映回握持逆，不误推进`, () => {
      const inv = invertGuideToken(grip);
      const absInv = layerGestureAbsoluteToken(inv, orients);
      assert.equal(gripLayerMoveFromBleAbsolute(absInv, grip, orients), inv);
      const guide = {
        ...createGuidedMoves(["z2", grip, "U"]),
        progress: 1,
      };
      const step = applyGuidedMove(guide, inv);
      assert.equal(step.kind, "absorb");
      assert.equal(step.guide.progress, 1);
      assert.equal(
        guidedScrambleView(step.guide).expectedMove?.includes("2"),
        true,
      );
    });
  }
});

describe("契约 · 拧对后禁止 seek 回退", () => {
  const rows = [
    ...SLICE_QUARTERS.map((t) => ({ token: t, seek: false })),
    { token: "z2", seek: false },
    { token: "y'", seek: false },
    { token: "r'", seek: false },
    { token: "R'", seek: true },
    { token: "U", seek: true },
  ] as const;

  for (const row of rows) {
    it(`${row.token} 且状态不对 → seek=${row.seek}`, () => {
      assert.equal(
        shouldSeekBackAfterCrossManualConfirm(row.token, false),
        row.seek,
      );
    });
  }

  it("状态已对上 → 一律不 seek", () => {
    for (const token of ["M'", "S", "E'", "z2", "R'"]) {
      assert.equal(shouldSeekBackAfterCrossManualConfirm(token, true), false);
    }
  });
});

describe("契约 · 拧对后禁止重启动画", () => {
  it("同 progress+trackMove 不重开 gyro 轨道", () => {
    const key = layerGuideGyroAnimKey(2, "S'");
    assert.equal(shouldRestartLayerGuideGyroTrack(null, key), true);
    assert.equal(shouldRestartLayerGuideGyroTrack(key, key), false);
    assert.equal(
      shouldRestartLayerGuideGyroTrack(key, layerGuideGyroAnimKey(2, "M'")),
      true,
    );
  });
});

describe("契约 · 打乱后转体 *2 须相对确认", () => {
  const scramble = ["R", "U", "F'"];
  const flat = [...scramble, "z2", "U2", "f"];

  it("打乱结束后进度停在 z2，画面不含 z2", () => {
    const progress = scramble.length;
    assert.equal(flat[progress], "z2");
    const paint = gameGuidePaintAlg("", scramble.length, flat, progress);
    assert.equal(paint, scramble.join(" "));
    assert.equal(/\bz2\b/.test(paint), false);
    const guide = {
      ...createGuidedMoves(flat),
      progress,
    };
    assert.equal(guidedScrambleView(guide).manualMove, "z2");
  });

  it("朝向已像目标、无相对 Δ → 不可确认（含满 hold）", () => {
    const progress = scramble.length;
    const holdMs = 400;
    for (const ms of [0, holdMs, holdMs * 4]) {
      assert.equal(
        guideRotationStepConfirmable({
          expectedMove: "z2",
          relativeCommittedAlg: "",
          heldAlg: "z2",
          displayMoves: flat,
          progress,
          msSinceStepEnter: ms,
          holdMs,
        }),
        false,
        `ms=${ms}`,
      );
    }
  });

  it("相对步起点已满足 *2 → 可确认", () => {
    assert.equal(
      guideRotationStepConfirmable({
        expectedMove: "z2",
        relativeCommittedAlg: "z2",
        heldAlg: "z2",
        displayMoves: flat,
        progress: scramble.length,
        msSinceStepEnter: 50,
        holdMs: 400,
      }),
      true,
    );
  });
});

describe("契约 · 双步外面转两半同一握持→绝对映面", () => {
  const orients = ["z2"] as const;
  const dirty = ["z2 x", "z2"] as const;

  it("z2 后 U2：第一下绝对匹配 → 半步；第二下同绝对 → 完成", () => {
    const absU = remapGripTokenToPuzzleHint("U", orients);
    const guide = {
      ...createGuidedMoves(["z2", "U2", "f"]),
      progress: 1,
    };
    const first = stepGamePageBleAbsoluteFace(guide, absU, [...orients]);
    assert.equal(first.kind, "partial");
    assert.equal(first.resolved, "U");
    assert.equal(first.guide.halfDone, true);
    assert.equal(first.guide.progress, 1);

    const second = stepGamePageBleAbsoluteFace(first.guide, absU, [...dirty]);
    assert.equal(second.kind, "progress");
    assert.equal(second.resolved, "U");
    assert.equal(second.guide.progress, 2);
    assert.equal(second.enteredCorrection, false);
  });

  it("z2 后 U2 半步：绝对 F' 不推进、不报转错", () => {
    const absU = remapGripTokenToPuzzleHint("U", orients);
    const guide = {
      ...createGuidedMoves(["z2", "U2", "f"]),
      progress: 1,
    };
    const first = stepGamePageBleAbsoluteFace(guide, absU, [...orients]);
    assert.equal(first.kind, "partial");

    const bad = stepGamePageBleAbsoluteFace(first.guide, "F'", [...dirty]);
    assert.equal(bad.kind, "need_manual");
    assert.equal(bad.guide.progress, 1);
    assert.equal(bad.guide.halfDone, true);
    assert.equal(bad.enteredCorrection, false);
    assert.equal(bad.correction, null);
    assert.equal(guidedScrambleView(bad.guide).correction, null);
  });

  it("z2 后 U2 半步：倾斜下绝对 U 不得收成 F' 纠错", () => {
    const absU = remapGripTokenToPuzzleHint("U", orients);
    const guide = {
      ...createGuidedMoves(["z2", "U2", "f"]),
      progress: 1,
    };
    const first = stepGamePageBleAbsoluteFace(guide, absU, [...orients]);
    const tilted = stepGamePageBleAbsoluteFace(first.guide, "U", ["z2 x"]);
    assert.notEqual(tilted.resolved, "F'");
    assert.equal(tilted.kind, "need_manual");
    assert.equal(tilted.enteredCorrection, false);
    assert.equal(tilted.correction, null);
  });
});
