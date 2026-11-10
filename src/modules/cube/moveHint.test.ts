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
  MOVE_HINT_TRAVEL_HALF,
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

  it("同一 move+options 不重建，避免箭头动画被打断", () => {
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
    const first = applyMoveHint(puzzle, null, "R'", { tone: "guide" });
    const second = applyMoveHint(puzzle, first, "R'", { tone: "guide" });
    assert.equal(second, first);
    assert.equal(children.length, 1);
    const third = applyMoveHint(puzzle, second, "R'", { tone: "error" });
    assert.notEqual(third, first);
    assert.equal(children.length, 1);
  });

  it("同一 move 若已脱离宿主，挂回新 puzzle（面转动画后 x 不丢高亮）", () => {
    const oldChildren: Group[] = [];
    const newChildren: Group[] = [];
    const oldPuzzle = {
      add(object: Group) {
        oldChildren.push(object);
        // 模拟 Object3D.add 的 parent 绑定
        (object as Group).parent = oldPuzzle as unknown as Group;
      },
      remove(object: Group) {
        const index = oldChildren.indexOf(object);
        if (index >= 0) {
          oldChildren.splice(index, 1);
        }
        if (object.parent === (oldPuzzle as unknown as Group)) {
          object.parent = null;
        }
      },
    };
    const newPuzzle = {
      add(object: Group) {
        newChildren.push(object);
        (object as Group).parent = newPuzzle as unknown as Group;
      },
      remove(object: Group) {
        const index = newChildren.indexOf(object);
        if (index >= 0) {
          newChildren.splice(index, 1);
        }
        if (object.parent === (newPuzzle as unknown as Group)) {
          object.parent = null;
        }
      },
    };
    const first = applyMoveHint(oldPuzzle, null, "x", { tone: "guide" });
    assert.ok(first);
    assert.equal(oldChildren.length, 1);
    // 场景重建：旧宿主丢掉子节点，高亮组 parent 悬空
    oldPuzzle.remove(first!);
    assert.equal(first!.parent, null);
    const rebound = applyMoveHint(newPuzzle, first, "x", { tone: "guide" });
    assert.equal(rebound, first);
    assert.equal(newChildren.length, 1);
    assert.equal(first!.parent, newPuzzle as unknown as Group);
    applyMoveHint(newPuzzle, first, null);
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
      assert.equal(group!.userData.arrowBeltCount, 1);
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

  it("转体 z2 画在 F 轴面，三排箭头；行程与单层一致、双步周期更快", () => {
    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const outer = applyMoveHint(puzzle, null, "R", { tone: "guide" });
    assert.ok(outer);
    assert.equal(outer!.userData.travelHalf, MOVE_HINT_TRAVEL_HALF);

    const group = applyMoveHint(puzzle, outer, "z2", { tone: "guide" });
    assert.ok(group);
    assert.equal(group!.userData.face, "F");
    assert.equal(group!.userData.double, true);
    assert.equal(group!.userData.layerKind, "whole");
    assert.equal(group!.userData.arrowBeltCount, 3);
    assert.equal(group!.userData.arrowCount, 12);
    assert.equal(group!.userData.travelHalf, MOVE_HINT_TRAVEL_HALF);
    assert.ok((group!.userData.sideMs as number) < MOVE_HINT_SIDE_MS);
    assert.ok(group!.getObjectByName("cube-move-hint-arrow-1"));
    assert.ok(group!.getObjectByName("cube-move-hint-arrow-2"));
    applyMoveHint(puzzle, group, null);
  });

  it("中层一排、宽层两排，轴向跟 WCA；行程与周期同单层", () => {
    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const middle = applyMoveHint(puzzle, null, "M", { tone: "guide" });
    assert.ok(middle);
    // M 同 L；绑 R 会让箭头与 L 反向
    assert.equal(middle!.userData.face, "L");
    assert.equal(middle!.userData.layerKind, "middle");
    assert.equal(middle!.userData.depthTest, true);
    assert.equal(middle!.userData.arrowBeltCount, 1);
    assert.equal(middle!.userData.arrowCount, 4);
    assert.equal(middle!.userData.sideMs, MOVE_HINT_SIDE_MS);
    assert.equal(middle!.userData.travelHalf, MOVE_HINT_TRAVEL_HALF);

    const equator = applyMoveHint(puzzle, middle, "E'", { tone: "guide" });
    assert.ok(equator);
    // E 同 D
    assert.equal(equator!.userData.face, "D");
    assert.equal(equator!.userData.layerKind, "middle");
    assert.equal(equator!.userData.depthTest, true);
    assert.equal(equator!.userData.arrowBeltCount, 1);

    const standing = applyMoveHint(puzzle, equator, "S", { tone: "guide" });
    assert.ok(standing);
    assert.equal(standing!.userData.face, "F");

    const wide = applyMoveHint(puzzle, standing, "u'", { tone: "guide" });
    assert.ok(wide);
    assert.equal(wide!.userData.face, "U");
    assert.equal(wide!.userData.layerKind, "wide");
    assert.equal(wide!.userData.arrowBeltCount, 2);
    assert.equal(wide!.userData.arrowCount, 8);
    assert.equal(wide!.userData.sideMs, MOVE_HINT_SIDE_MS);
    assert.equal(wide!.userData.travelHalf, MOVE_HINT_TRAVEL_HALF);
    assert.ok(wide!.getObjectByName("cube-move-hint-arrow-1"));

    const whole = applyMoveHint(puzzle, wide, "x", { tone: "guide" });
    assert.ok(whole);
    assert.equal(whole!.userData.layerKind, "whole");
    assert.equal(whole!.userData.arrowBeltCount, 3);
    assert.equal(whole!.userData.sideMs, MOVE_HINT_SIDE_MS);
    assert.equal(whole!.userData.travelHalf, MOVE_HINT_TRAVEL_HALF);
    applyMoveHint(puzzle, whole, null);
  });

  it("双步更快；半步两枚箭头、纠错色", () => {
    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const single = applyMoveHint(puzzle, null, "R", { tone: "guide" });
    assert.ok(single);
    assert.equal(single!.userData.double, false);
    assert.equal(single!.userData.arrowBeltCount, 1);
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
    assert.equal(half!.userData.arrowBeltCount, 1);
    assert.equal(half!.userData.arrowCount, 2);
    applyMoveHint(puzzle, half, null);
  });
});
