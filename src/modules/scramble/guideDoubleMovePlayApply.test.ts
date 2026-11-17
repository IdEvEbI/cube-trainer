/**
 * 双步 *2 方向 · E18（须绿）。
 * 对齐 docs/research-moyu-layer-capture.md 与 fixture bug-double-L2-prime-dir。
 *
 * 游戏页：forPlay 与 apply 共用 resolveGuidedBleAbsoluteGripMove；
 * 真机候选链（公式 + relative）下也必须同串，勿对 expected 正转字母单独 resolve。
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
import { absoluteFaceMoveToGrip } from "../score/solveAlgDisplay.ts";
import { createGuidedMoves, guidedScrambleView } from "./guided.ts";
import { resolveGuideBleFaceMoveWithCandidates } from "./guideBleFaceRemap.ts";
import { resolveGuideBleFaceMove } from "./layerGuideDualPaint.ts";
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

/**
 * 真机式候选链：公式 z2 优先，后接 live relative（与 guideBleFaceOrientCandidates 同形）。
 * 脏首项链用于证明「对 expected 正转 resolve」会与记账分叉。
 */
const DEVICE_ORIENT_CHAIN = ["z2", "z2 y", "z2 y'"] as const;
const DIRTY_FIRST_ORIENT_CHAIN = ["z2 y", "z2"] as const;

describe("双步 *2 方向 · bug-double-L2-prime-dir", () => {
  const fixture = loadFixture("bug-double-L2-prime-dir.json");
  /** 黄上握持 L' → 色心绝对 R' */
  const absPrime = remapGripTokenToPuzzleHint("L'", ["z2"]);

  it("apply 路：两包绝对 R'（握持 L'）可推进过 L2", () => {
    assert.equal(absPrime, "R'");
    let guide = createGuidedMoves(fixture.displayMoves);
    guide = { ...guide, progress: 1 };
    guide = applyGuidedBleAbsoluteMoveWithOrientAlgs(
      guide,
      absPrime,
      DEVICE_ORIENT_CHAIN,
    ).guide;
    assert.equal(guide.halfDir, "'");
    guide = applyGuidedBleAbsoluteMoveWithOrientAlgs(
      guide,
      absPrime,
      DEVICE_ORIENT_CHAIN,
    ).guide;
    assert.equal(guide.progress, fixture.expect.progress);
    assert.equal(guide.phase === "done", fixture.expect.done);
  });

  it("guideReplay：黄上 L2 两包握持 L' 进度推进到 2", () => {
    const result = replayGuideSession(fixture);
    assert.equal(result.sawWrong, false);
    assert.equal(
      result.progress,
      fixture.expect.progress,
      `replay progress=${result.progress}，期望 ${fixture.expect.progress}（双步反首半）`,
    );
  });

  it("真机候选链：forPlay 与 apply 同为 L'（勿对 expected L 单独 resolve）", () => {
    let guide = createGuidedMoves(fixture.displayMoves);
    guide = { ...guide, progress: 1 };
    const view0 = guidedScrambleView(guide);
    assert.equal(view0.expectedMove, "L");
    assert.equal(view0.currentIsDouble, true);

    // 旧路：对 expected 正转字母 resolve，脏首项会与记账分叉。
    const legacyPlay = resolveGuideBleFaceMoveWithCandidates(
      absPrime,
      view0.expectedMove,
      DIRTY_FIRST_ORIENT_CHAIN,
    );
    assert.notEqual(
      legacyPlay,
      "L'",
      `旧 forPlay 在脏首项链下应为分叉（got=${legacyPlay}）`,
    );

    const playQuarters: string[] = [];
    const applyQuarters: string[] = [];

    for (const chain of [DEVICE_ORIENT_CHAIN, DIRTY_FIRST_ORIENT_CHAIN]) {
      guide = { ...createGuidedMoves(fixture.displayMoves), progress: 1 };
      playQuarters.length = 0;
      applyQuarters.length = 0;
      for (let i = 0; i < 2; i += 1) {
        const forPlay = resolveGuidedBleAbsoluteGripMove(
          guide,
          absPrime,
          chain,
        );
        const applied = resolveGuidedBleAbsoluteGripMove(
          guide,
          absPrime,
          chain,
        );
        playQuarters.push(forPlay);
        applyQuarters.push(applied);
        assert.equal(
          forPlay,
          applied,
          `链 ${JSON.stringify(chain)} 第 ${i + 1} 下 forPlay=${forPlay} 与 apply=${applied}`,
        );
        assert.equal(
          forPlay,
          "L'",
          `链 ${JSON.stringify(chain)} 第 ${i + 1} 下须为 L'，不得为 L/绝对面/脏映面`,
        );
        guide = applyGuidedBleAbsoluteMoveWithOrientAlgs(
          guide,
          absPrime,
          chain,
        ).guide;
        if (i === 0) {
          assert.equal(guide.halfDir, "'");
        }
      }
      assert.deepEqual(playQuarters, ["L'", "L'"]);
      assert.deepEqual(applyQuarters, ["L'", "L'"]);
      assert.equal(guide.progress, 2);
    }
  });

  it("真机候选链：R2 用 R'2 时 forPlay 与 apply 同为 R'", () => {
    const absRPrime = remapGripTokenToPuzzleHint("R'", ["z2"]);
    assert.equal(absRPrime, "L'");
    let guide = {
      ...createGuidedMoves(["z2", "R2", "U"]),
      progress: 1,
    };
    for (const chain of [DEVICE_ORIENT_CHAIN, DIRTY_FIRST_ORIENT_CHAIN]) {
      guide = { ...createGuidedMoves(["z2", "R2", "U"]), progress: 1 };
      for (let i = 0; i < 2; i += 1) {
        const forPlay = resolveGuidedBleAbsoluteGripMove(
          guide,
          absRPrime,
          chain,
        );
        assert.equal(forPlay, "R'");
        guide = applyGuidedBleAbsoluteMoveWithOrientAlgs(
          guide,
          absRPrime,
          chain,
        ).guide;
      }
      assert.equal(guide.progress, 2);
      assert.equal(guide.halfDir, null);
    }
  });

  it("整步记号 L2 映面：绝对 L' 须映成握持 R'（勿原样）", () => {
    // App 打乱引导 play 用 stepToken「L2」作 expected；黄上绝对 L'≡握持 R'。
    const got = resolveGuideBleFaceMove("L'", "L2", "z2");
    const want = absoluteFaceMoveToGrip("L'", ["z2"]);
    assert.equal(want, "R'");
    assert.equal(
      got,
      want,
      `黄上 resolve(L', L2, z2) 须为握持 ${want}，不得原样绝对 L'（got=${got}）`,
    );
  });
});
