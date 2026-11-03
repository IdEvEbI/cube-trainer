import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Group, Vector3 } from "three";
import {
  applyMoveHint,
  MOVE_HINT_ARROW_HALF_LEN,
  MOVE_HINT_ARROW_HALF_WIDTH,
  MOVE_HINT_CUBE_EDGE,
  MOVE_HINT_CUBE_RADIUS,
  MOVE_HINT_FRAME_HALF,
  MOVE_HINT_LAYER_FACE,
  MOVE_HINT_LAYER_OFFSET,
  MOVE_HINT_RING_RADIUS,
  MOVE_HINT_SIDE_LIFT,
  MOVE_HINT_SIDE_MS,
} from "./moveHint.ts";

describe("applyMoveHint", () => {
  it("挂载后可清除", () => {
    const children: Group[] = [];
    const puzzle = {
      add(object: Group) {
        children.push(object);
      },
      remove(object: Group) {
        const index = children.indexOf(object);
        if (index >= 0) {
          children.splice(index, 1);
        }
      },
    };
    const first = applyMoveHint(puzzle, null, "R", { tone: "guide" });
    assert.ok(first);
    assert.equal(children.length, 1);
    assert.equal(first!.name, "cube-move-hint");

    const cleared = applyMoveHint(puzzle, first, null);
    assert.equal(cleared, null);
    assert.equal(children.length, 0);
  });

  it("空心描边框 + 四边同步箭头落在对应层外侧", () => {
    assert.equal(MOVE_HINT_LAYER_FACE, MOVE_HINT_CUBE_EDGE + 0.18);
    assert.equal(
      MOVE_HINT_RING_RADIUS,
      MOVE_HINT_LAYER_FACE / 2 + MOVE_HINT_SIDE_LIFT,
    );
    assert.ok(MOVE_HINT_LAYER_OFFSET > MOVE_HINT_CUBE_RADIUS);
    assert.ok(MOVE_HINT_FRAME_HALF > 0);
    assert.ok(MOVE_HINT_ARROW_HALF_WIDTH > 0);
    assert.ok(MOVE_HINT_ARROW_HALF_LEN > MOVE_HINT_ARROW_HALF_WIDTH);
    assert.equal(MOVE_HINT_SIDE_MS, 1600);
    assert.ok(MOVE_HINT_RING_RADIUS > MOVE_HINT_CUBE_RADIUS * 0.9);

    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const pos = new Vector3();

    const cases: Array<{
      move: string;
      axis: "x" | "y" | "z";
      sign: 1 | -1;
    }> = [
      { move: "U", axis: "y", sign: 1 },
      { move: "D", axis: "y", sign: -1 },
      { move: "F", axis: "z", sign: 1 },
      { move: "B", axis: "z", sign: -1 },
      { move: "L", axis: "x", sign: -1 },
      { move: "R", axis: "x", sign: 1 },
    ];

    let prev: Group | null = null;
    for (const item of cases) {
      const group = applyMoveHint(puzzle, prev, item.move, { tone: "guide" });
      assert.ok(group);
      group!.getWorldPosition(pos);
      const value = pos[item.axis];
      assert.ok(
        item.sign > 0 ? value > 1.5 : value < -1.5,
        `${item.move} 应在对应层外侧，${item.axis}=${value}`,
      );
      assert.equal(group!.userData.face, item.move);
      assert.equal(group!.userData.depthTest, true);
      assert.equal(group!.userData.fillColor, 0xffffff);
      assert.equal(group!.userData.arrowCount, 4);
      assert.equal(group!.userData.sideMs, MOVE_HINT_SIDE_MS);
      assert.ok(group!.getObjectByName("cube-move-hint-layer"));
      assert.ok(group!.getObjectByName("cube-move-hint-arrow"));
      assert.ok(group!.getObjectByName("cube-move-hint-traveler"));
      assert.ok(group!.getObjectByName("cube-move-hint-head"));
      prev = group;
    }
    applyMoveHint(puzzle, prev, null);
  });

  it("双步更快；半步两枚箭头、纠错色", () => {
    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const single = applyMoveHint(puzzle, null, "R", { tone: "guide" });
    assert.ok(single);
    assert.equal(single!.userData.double, false);
    assert.equal(single!.userData.arrowCount, 4);

    const double = applyMoveHint(puzzle, single, "L", {
      tone: "guide",
      double: true,
    });
    assert.ok(double);
    assert.equal(double!.userData.double, true);
    assert.ok((double!.userData.sideMs as number) < MOVE_HINT_SIDE_MS);

    const half = applyMoveHint(puzzle, double, "U'", {
      tone: "error",
      double: true,
      half: true,
    });
    assert.ok(half);
    assert.equal(half!.userData.double, false);
    assert.equal(half!.userData.fillColor, 0xff5a52);
    assert.equal(half!.userData.arrowCount, 2);
    applyMoveHint(puzzle, half, null);
  });
});
