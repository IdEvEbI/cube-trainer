import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bluetoothCubeAbsoluteAlg } from "./cubeSync.ts";

describe("bluetoothCubeAbsoluteAlg", () => {
  it("拼接 setup 与后续转动", () => {
    assert.equal(bluetoothCubeAbsoluteAlg("R U", ["R'", "U'"]), "R U R' U'");
  });

  it("忽略空白段", () => {
    assert.equal(bluetoothCubeAbsoluteAlg("  ", ["R", ""]), "R");
    assert.equal(bluetoothCubeAbsoluteAlg("", []), "");
  });
});
