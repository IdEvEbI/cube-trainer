import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SOLVED_FACELETS_URFDLB } from "./facelets.ts";
import { faceletsToKPattern, faceletsToSetupAlg } from "./pattern.ts";

describe("moyu pattern", () => {
  it("复原 facelets → 空 setup 算法", async () => {
    assert.equal(await faceletsToSetupAlg(SOLVED_FACELETS_URFDLB), "");
  });

  it("复原 facelets 可建成 KPattern", async () => {
    const pattern = await faceletsToKPattern(SOLVED_FACELETS_URFDLB);
    assert.deepEqual(
      pattern.patternData.CORNERS?.pieces,
      [0, 1, 2, 3, 4, 5, 6, 7],
    );
    assert.deepEqual(
      pattern.patternData.EDGES?.pieces,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
  });

  it("非法 facelets 拒绝", async () => {
    await assert.rejects(() => faceletsToKPattern("F".repeat(54)), /无法识别/);
  });
});
