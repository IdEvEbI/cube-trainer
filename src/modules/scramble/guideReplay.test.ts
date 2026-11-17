/**
 * 离线回放骨架 + E17 fixture。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  expectedLiveOrientAlgAfterStep,
  replayGuideSession,
  type GuideReplayFixture,
} from "./guideReplay.ts";

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/guide-replay",
);

function loadFixture(name: string): GuideReplayFixture {
  const raw = readFileSync(join(FIXTURE_DIR, name), "utf8");
  return JSON.parse(raw) as GuideReplayFixture;
}

describe("guideReplay · 期望姿态串", () => {
  it("z2 / r' / b' 叠文档陀螺 Δ", () => {
    const moves = ["z2", "r'", "b'", "R"] as const;
    assert.equal(expectedLiveOrientAlgAfterStep(moves, 0), "z2");
    assert.equal(expectedLiveOrientAlgAfterStep(moves, 1), "z2 x");
    assert.equal(expectedLiveOrientAlgAfterStep(moves, 2), "z2 x z");
  });
});

describe("guideReplay · fixture E17", () => {
  it("z2 → r' → b' → R：D 推进且 B 不收成 R", () => {
    const fixture = loadFixture("e17-r-prime-b-prime-R.json");
    const result = replayGuideSession(fixture);

    assert.equal(result.progress, fixture.expect.progress);
    assert.equal(result.done, fixture.expect.done);
    assert.equal(result.sawWrong, fixture.expect.sawWrong);
    assert.deepEqual(result.rejectedFaceMoves, ["B"]);
    assert.deepEqual(result.acceptedFaceMoves, ["D"]);
  });
});
