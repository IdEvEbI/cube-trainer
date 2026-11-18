/**
 * E19 / #180：y（及 f）后期望 R'：侧面握持不得映成 U。
 * 真机日志：absolute=D，orientAlgs=['z2 y', "z2 y y' y y' z"]，不得 resolved=U。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyGuidedBleAbsoluteMoveWithOrientAlgs,
  resolveGuidedBleAbsoluteGripMove,
} from "../game/guidedAbsolute.ts";
import { remapGripTokenToPuzzleHint } from "../game/guideOrientation.ts";
import { createGuidedMoves, guidedScrambleView } from "./guided.ts";
import { resolveGuideBleFaceMoveWithCandidates } from "./guideBleFaceRemap.ts";
import { replayGuideSession, type GuideReplayFixture } from "./guideReplay.ts";

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/guide-replay",
);

function loadFixture(name: string): GuideReplayFixture {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf8"),
  ) as GuideReplayFixture;
}

describe("E19 · bug-y-then-R-as-U（#180）", () => {
  const fixture = loadFixture("bug-y-then-R-as-U.json");
  const formulaOrients = ["z2", "y"] as const;
  const absB = remapGripTokenToPuzzleHint("R", formulaOrients);
  const dirtyFirstChain = ["z2 y x'", "z2 y"] as const;

  /** 真机控制台 [guide-face] 快照（F2L3：y f 已完成，期望 R'）。 */
  const deviceLog = {
    absolute: "D",
    expectedMove: "R'",
    orientAlgs: ["z2 y", "z2 y y' y y' z"] as const,
  };

  it("fixture：无 f 时握持 R 绝对包为 B", () => {
    assert.equal(absB, "B");
    const face = fixture.events.find((e) => e.type === "face");
    assert.ok(face && face.type === "face");
    assert.equal(face.move, absB);
  });

  it("replay 骨架：y 到位后绝对 B 不得推进过 R'", () => {
    const result = replayGuideSession(fixture);
    assert.equal(result.progress, fixture.expect.progress);
    assert.equal(result.acceptedFaceMoves.includes("B"), false);
  });

  it("脏首项链下绝对 B 须映成握持 R，不得收成 U", () => {
    const guide = {
      ...createGuidedMoves(fixture.displayMoves),
      progress: 2,
    };
    const grip = resolveGuidedBleAbsoluteGripMove(guide, absB, dirtyFirstChain);
    assert.equal(grip, "R");
    const applied = applyGuidedBleAbsoluteMoveWithOrientAlgs(
      guide,
      absB,
      dirtyFirstChain,
    );
    // 期望 R'、映成 R：同面反转 → absorb（#181），不得错映成 U 进纠错。
    assert.equal(applied.kind, "absorb");
    assert.equal(applied.guide.wrongStack.length, 0);
    assert.equal(guidedScrambleView(applied.guide).correction, null);
  });

  it("真机日志：absolute=D + 候选链不得映成 U（须为 R）", () => {
    // 截图：y f 已完成，期望 R'；拧握持 R → 绝对 D；旧逻辑 z2 y 回落成 U →「请转 U'」。
    const displayMoves = ["z2", "y", "f", "R'", "U", "R2", "U'", "R2", "f'"];
    const guide = { ...createGuidedMoves(displayMoves), progress: 3 };
    assert.equal(guide.displayMoves[guide.progress], "R'");

    const legacy = resolveGuideBleFaceMoveWithCandidates(
      deviceLog.absolute,
      deviceLog.expectedMove,
      deviceLog.orientAlgs,
    );
    const resolved = resolveGuidedBleAbsoluteGripMove(
      guide,
      deviceLog.absolute,
      deviceLog.orientAlgs,
    );
    assert.notEqual(
      resolved,
      "U",
      `[guide-face] absolute=${deviceLog.absolute} orientAlgs=${JSON.stringify([...deviceLog.orientAlgs])} resolved=${resolved}（legacy=${legacy}）`,
    );
    assert.equal(resolved, "R", `真机绝对 D 须映成握持 R（got=${resolved}）`);

    const applied = applyGuidedBleAbsoluteMoveWithOrientAlgs(
      guide,
      deviceLog.absolute,
      deviceLog.orientAlgs,
    );
    assert.equal(applied.kind, "absorb");
    assert.equal(applied.guide.wrongStack.length, 0);
    assert.equal(
      guidedScrambleView(applied.guide).correction,
      null,
      "同面反转不得提示请转 U' / R'",
    );
  });
});
