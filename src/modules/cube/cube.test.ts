import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendAlgorithm,
  colorsMatchTarget,
  isLayerMove,
  readCube,
} from "./cube.ts";
import { CUBE_FACES, LAYER_MOVES } from "./types.ts";

describe("readCube", () => {
  it("朝向是黄上白下、绿前蓝后、红左橙右", async () => {
    const cube = await readCube();

    assert.equal(colorsMatchTarget(cube.faceColors), true);
  });

  it("每个层转动都会改变角块，反向转动后恢复", async () => {
    const solved = await readCube();

    for (const face of CUBE_FACES) {
      const turned = await readCube(face);
      const restored = await readCube(`${face} ${face}'`);

      assert.notDeepEqual(turned.corners, solved.corners);
      assert.deepEqual(turned.centers, solved.centers);
      assert.deepEqual(restored.corners, solved.corners);
    }
  });
});

describe("appendAlgorithm", () => {
  it("把算法接到当前状态后面，角块会变化", async () => {
    const current = "U";
    const algorithm = "R U R' U R U2 R'";
    const before = await readCube(current);
    const applied = appendAlgorithm(current, algorithm);
    const after = await readCube(applied);

    assert.equal(applied, "U R U R' U R U2 R'");
    assert.notDeepEqual(after.corners, before.corners);
    assert.notDeepEqual(after.corners, (await readCube(algorithm)).corners);
  });
});

describe("isLayerMove", () => {
  it("接受六个面的正转和逆转", () => {
    for (const move of LAYER_MOVES) {
      assert.equal(isLayerMove(move), true);
    }
    assert.equal(isLayerMove("M"), false);
    assert.equal(isLayerMove("u"), false);
  });
});
