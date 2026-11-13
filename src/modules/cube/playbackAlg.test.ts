import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playbackAlgText, playbackMoveToken } from "./playbackAlg.ts";

describe("playbackAlgText", () => {
  it("空串表示复原", () => {
    assert.equal(playbackAlgText(""), "");
    assert.equal(playbackAlgText("   "), "");
  });

  it("外层与中层四分之一可过", () => {
    assert.equal(playbackAlgText("E F' M'"), "E F' M'");
  });

  it("采集式双步撇 E'2 / M'2 规范化后可解析", () => {
    assert.equal(playbackAlgText("M' E'2"), "M' E2'");
    assert.equal(
      playbackAlgText("E F' b2 S2 f' R' l2 d' l2 M' E'2"),
      "E F' b2 S2 f' R' l2 d' l2 M' E2'",
    );
  });

  it("已是 cubing 写法 2' 保持可播", () => {
    assert.equal(playbackAlgText("M' E2' S'2"), "M' E2' S2'");
  });
});

describe("playbackMoveToken", () => {
  it("E'2 → E2'", () => {
    assert.equal(playbackMoveToken("E'2"), "E2'");
    assert.equal(playbackMoveToken("M'2"), "M2'");
  });

  it("普通步不变", () => {
    assert.equal(playbackMoveToken("M'"), "M'");
    assert.equal(playbackMoveToken("r2"), "r2");
  });
});
