import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Group, Vector3 } from "three";
import {
  applyMoveHint,
  MOVE_HINT_CUBE_EDGE,
  MOVE_HINT_CUBE_RADIUS,
  MOVE_HINT_LAYER_OFFSET,
  MOVE_HINT_RADIUS_SCALE,
  MOVE_HINT_RING_RADIUS,
  MOVE_HINT_TUBE_RADIUS,
} from "./moveHint.ts";

describe("applyMoveHint", () => {
  it("挂载 R 箭头，清除时移除", () => {
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

  it("贴面弯箭头落在对应层外侧", () => {
    assert.equal(MOVE_HINT_CUBE_EDGE, 3);
    assert.equal(MOVE_HINT_CUBE_RADIUS, 1.5);
    assert.ok(
      MOVE_HINT_RADIUS_SCALE >= 0.75 && MOVE_HINT_RADIUS_SCALE <= 0.9,
      `贴面半径倍率=${MOVE_HINT_RADIUS_SCALE}`,
    );
    assert.equal(
      MOVE_HINT_RING_RADIUS,
      MOVE_HINT_CUBE_RADIUS * MOVE_HINT_RADIUS_SCALE,
    );
    assert.ok(MOVE_HINT_LAYER_OFFSET > MOVE_HINT_CUBE_RADIUS);
    assert.ok(MOVE_HINT_TUBE_RADIUS >= 0.05 && MOVE_HINT_TUBE_RADIUS <= 0.1);

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
      assert.equal(group!.userData.ringRadius, MOVE_HINT_RING_RADIUS);
      assert.equal(group!.userData.depthTest, false);
      assert.equal(group!.userData.fillColor, 0xffffff);
      assert.ok(group!.getObjectByName("cube-move-hint-layer"));
      assert.ok(group!.getObjectByName("cube-move-hint-arrow"));
      assert.ok(group!.getObjectByName("cube-move-hint-head"));
      if (item.move === "U" || item.move === "D") {
        assert.equal(group!.userData.horizontal, true);
      } else {
        assert.equal(group!.userData.horizontal, false);
      }
    }
    applyMoveHint(puzzle, prev, null);
  });

  it("双步弧更长；有 tip 锚点", () => {
    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const single = applyMoveHint(puzzle, null, "R", { tone: "guide" });
    assert.ok(single);
    const tip = single!.getObjectByName("cube-move-hint-tip");
    assert.ok(tip);
    const singleSpan = Math.abs(
      (single!.userData.tipAngle as number) -
        (single!.userData.tailAngle as number),
    );

    const double = applyMoveHint(puzzle, single, "L", {
      tone: "guide",
      double: true,
    });
    assert.ok(double);
    assert.equal(double!.userData.double, true);
    const doubleSpan = Math.abs(
      (double!.userData.tipAngle as number) -
        (double!.userData.tailAngle as number),
    );
    assert.ok(doubleSpan > singleSpan, "双步贴面弧应更长");
    applyMoveHint(puzzle, double, null);
  });

  it("纠错色与 half 更新", () => {
    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const group = applyMoveHint(puzzle, null, "U", {
      double: true,
      half: false,
    });
    const next = applyMoveHint(puzzle, group, "U'", {
      tone: "error",
      double: true,
      half: true,
    });
    assert.ok(next);
    assert.equal(next!.userData.double, false);
    assert.equal(next!.userData.fillColor, 0xff6b4a);
    assert.ok(next!.getObjectByName("cube-move-hint-tip"));
    assert.ok(next!.getObjectByName("cube-move-hint-layer"));
    assert.ok(next!.getObjectByName("cube-move-hint-arrow"));
    const halfSpan = Math.abs(
      (next!.userData.tipAngle as number) -
        (next!.userData.tailAngle as number),
    );
    assert.ok(halfSpan < Math.PI * 1.2, "半步弧应更短");
  });
});
