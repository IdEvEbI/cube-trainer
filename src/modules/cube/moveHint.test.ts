import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Group } from "three";
import { applyMoveHint } from "./moveHint.ts";

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

  it("双步带 half 选项可更新", () => {
    const puzzle = {
      add(_object: Group) {},
      remove(_object: Group) {},
    };
    const group = applyMoveHint(puzzle, null, "U", {
      double: true,
      half: false,
    });
    assert.ok(group);
    const next = applyMoveHint(puzzle, group, "U'", {
      tone: "error",
      double: true,
      half: true,
    });
    assert.ok(next);
    assert.notEqual(next, group);
  });
});
