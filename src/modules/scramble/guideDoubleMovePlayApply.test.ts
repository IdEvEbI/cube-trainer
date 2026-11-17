/**
 * 双步 *2 方向 · E18 锚点（须绿）。
 * 对齐 docs/research-moyu-layer-capture.md 与 fixture bug-double-L2-prime-dir。
 *
 * 游戏页：play 用 resolve(…, expectedMove|整步记号)，apply 用
 * applyGuidedBleAbsoluteMoveWithOrientAlgs；两路必须同一握持四分之一。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { applyGuidedBleAbsoluteMoveWithOrientAlgs } from "../game/guidedAbsolute.ts";
import { remapGripTokenToPuzzleHint } from "../game/guideOrientation.ts";
import { absoluteFaceMoveToGrip } from "../score/solveAlgDisplay.ts";
import {
  createGuidedMoves,
  guidedScrambleView,
  parseFaceTurn,
} from "./guided.ts";
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

/** 镜像 GamePage：forPlay 字母（不改生产）。 */
function gamePageForPlayMove(
  guide: ReturnType<typeof createGuidedMoves>,
  absoluteMove: string,
  orientAlgs: readonly string[],
): string {
  const view = guidedScrambleView(guide);
  return resolveGuideBleFaceMoveWithCandidates(
    absoluteMove,
    view.correction ?? view.expectedMove,
    orientAlgs,
  );
}

/** 镜像 apply 路得到的握持四分之一（双步首半走绝对面匹配）。 */
function applyPathGripQuarter(
  guide: ReturnType<typeof createGuidedMoves>,
  absoluteMove: string,
  orientAlgs: readonly string[],
): string {
  const token = guide.displayMoves[guide.progress] ?? "";
  const view = guidedScrambleView(guide);
  if (view.currentIsDouble && !view.partial) {
    const { face } = parseFaceTurn(token);
    for (const alg of orientAlgs) {
      const parts = alg.split(/\s+/).filter(Boolean);
      const absCw = remapGripTokenToPuzzleHint(face, parts);
      const absCcw = remapGripTokenToPuzzleHint(`${face}'`, parts);
      if (absoluteMove === absCw) {
        return face;
      }
      if (absoluteMove === absCcw) {
        return `${face}'`;
      }
    }
  }
  const expected = view.correction ?? view.expectedMove;
  return resolveGuideBleFaceMoveWithCandidates(
    absoluteMove,
    expected,
    orientAlgs,
  );
}

describe("双步 *2 方向 · bug-double-L2-prime-dir", () => {
  const fixture = loadFixture("bug-double-L2-prime-dir.json");
  const orients = ["z2"] as const;
  /** 黄上握持 L' → 色心绝对 R' */
  const absPrime = remapGripTokenToPuzzleHint("L'", ["z2"]);

  it("apply 路：两包绝对 R'（握持 L'）可推进过 L2", () => {
    assert.equal(absPrime, "R'");
    let guide = createGuidedMoves(fixture.displayMoves);
    guide = { ...guide, progress: 1 };
    guide = applyGuidedBleAbsoluteMoveWithOrientAlgs(
      guide,
      absPrime,
      orients,
    ).guide;
    assert.equal(guide.halfDir, "'");
    guide = applyGuidedBleAbsoluteMoveWithOrientAlgs(
      guide,
      absPrime,
      orients,
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

  it("GamePage forPlay 与 apply 两路四分之一须同为 L'", () => {
    let guide = createGuidedMoves(fixture.displayMoves);
    guide = { ...guide, progress: 1 };
    const playQuarters: string[] = [];
    const applyQuarters: string[] = [];

    for (let i = 0; i < 2; i += 1) {
      const forPlay = gamePageForPlayMove(guide, absPrime, orients);
      const applied = applyPathGripQuarter(guide, absPrime, orients);
      playQuarters.push(forPlay);
      applyQuarters.push(applied);
      assert.equal(
        forPlay,
        applied,
        `第 ${i + 1} 下 forPlay=${forPlay} 与 apply=${applied} 必须同串`,
      );
      assert.equal(
        forPlay,
        "L'",
        `第 ${i + 1} 下 3D 字母须为 L'，不得为 L 或绝对面`,
      );
      const next = applyGuidedBleAbsoluteMoveWithOrientAlgs(
        guide,
        absPrime,
        orients,
      );
      guide = next.guide;
      if (i === 0) {
        assert.equal(guide.halfDir, "'");
      }
    }
    assert.deepEqual(playQuarters, ["L'", "L'"]);
    assert.deepEqual(applyQuarters, ["L'", "L'"]);
    assert.equal(guide.progress, 2);
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
