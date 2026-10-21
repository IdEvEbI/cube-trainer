import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { colorsMatchTarget, isLayerMove, readCube } from "./cube.ts";
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

describe("isLayerMove", () => {
  it("接受六个面的正转和逆转", () => {
    for (const move of LAYER_MOVES) {
      assert.equal(isLayerMove(move), true);
    }
    assert.equal(isLayerMove("M"), false);
    assert.equal(isLayerMove("u"), false);
  });
});
