import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quatFromOrientationAlg } from "../score/cubeOrientation.ts";
import {
  layerGuideExpectedGyroTurns,
  layerGuideExpectedPacketCount,
  layerGuideGyroProgress,
  layerGuidePacketProgress,
  layerGuideVisualProgress,
} from "./layerGuideGyroFollow.ts";

describe("layerGuideGyroFollow", () => {
  it("期望圈数：四分之一为 1，双步为 2", () => {
    assert.equal(layerGuideExpectedGyroTurns("M"), 1);
    assert.equal(layerGuideExpectedGyroTurns("E'"), 1);
    assert.equal(layerGuideExpectedGyroTurns("r2"), 2);
    assert.equal(layerGuideExpectedGyroTurns("d'2"), 2);
  });

  it("期望包数：中层双步 4，宽层双步 2", () => {
    assert.equal(layerGuideExpectedPacketCount("M"), 2);
    assert.equal(layerGuideExpectedPacketCount("M2"), 4);
    assert.equal(layerGuideExpectedPacketCount("M'2"), 4);
    assert.equal(layerGuideExpectedPacketCount("r"), 1);
    assert.equal(layerGuideExpectedPacketCount("r2"), 2);
  });

  it("相对转角映射到 0…1 进度", () => {
    const before = quatFromOrientationAlg("");
    assert.equal(layerGuideGyroProgress("E'", before, before), 0);
    const y90 = quatFromOrientationAlg("y");
    const p = layerGuideGyroProgress("E'", before, y90);
    assert.ok(p > 0.85 && p <= 1, `E' ~90° 应接近 1，实际 ${p}`);
    const y180 = quatFromOrientationAlg("y2");
    const p2 = layerGuideGyroProgress("E2", before, y180);
    assert.ok(p2 > 0.85 && p2 <= 1, `E2 ~180° 应接近 1，实际 ${p2}`);
    const half = layerGuideGyroProgress("E2", before, y90);
    assert.ok(half > 0.4 && half < 0.65, `E2 只转 90° 应约 0.5，实际 ${half}`);
  });

  it("包进度：M2 一包 0.25，两包 0.5，四包 1", () => {
    assert.equal(layerGuidePacketProgress("M2", 0), 0);
    assert.equal(layerGuidePacketProgress("M2", 1), 0.25);
    assert.equal(layerGuidePacketProgress("M2", 2), 0.5);
    assert.equal(layerGuidePacketProgress("M2", 4), 1);
  });

  it("视觉进度：陀螺卡在半步时包数仍能推进 M2", () => {
    const before = quatFromOrientationAlg("");
    const y90 = quatFromOrientationAlg("y");
    // 陀螺仍 ~0.5，但已收 3/4 包 → 应用包进度 0.75
    const visual = layerGuideVisualProgress("M2", 3, before, y90);
    assert.ok(visual >= 0.75 - 1e-9, `应 ≥0.75，实际 ${visual}`);
    assert.ok(visual < 0.85, `不应被陀螺拉满，实际 ${visual}`);
  });

  it("视觉进度：单包内陀螺可超前于包比例", () => {
    const before = quatFromOrientationAlg("");
    const y90 = quatFromOrientationAlg("y");
    // M 期望 2 包；仅 1 包但陀螺已 ~90° → 跟陀螺到 ~1
    const visual = layerGuideVisualProgress("M", 1, before, y90);
    assert.ok(visual > 0.85, `陀螺应把 M 推近完成，实际 ${visual}`);
  });

  it("视觉进度：双包同帧收齐时不把进度打到 1（避免闪切）", () => {
    const before = quatFromOrientationAlg("");
    // 无陀螺增量：两包齐也不应视觉直接满格
    const visual = layerGuideVisualProgress("M", 2, before, before);
    assert.ok(visual >= 0.5 - 1e-9, `应有 (2-1)/2 地板，实际 ${visual}`);
    assert.ok(visual < 0.99, `收齐包不得视觉满格，实际 ${visual}`);
  });

  it("视觉进度：M2 四包收齐仍可跟陀螺，包只提供 0.75 地板", () => {
    const before = quatFromOrientationAlg("");
    const y90 = quatFromOrientationAlg("y");
    const visual = layerGuideVisualProgress("M2", 4, before, y90);
    assert.ok(visual >= 0.75 - 1e-9, `四包地板 0.75，实际 ${visual}`);
    assert.ok(visual < 0.85, `陀螺仅半步时不应满格，实际 ${visual}`);
  });
});
