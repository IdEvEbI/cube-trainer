import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUBE_ORIENTATION_ALGS,
  createOrientationHoldState,
  facingAfterAlg,
  isYellowTopOrientation,
  midSolveOrientationCandidate,
  nearestCubeOrientationAlg,
  nearestYellowTopOrientationAlg,
  orientationRotationPath,
  quatFromOrientationAlg,
  scrambleToHeldPrepRotations,
  snapCubeOrientationAlg,
  tickOrientationHold,
} from "./cubeOrientation.ts";

describe("cubeOrientation", () => {
  it("24 朝向的 up/front 互不重复", () => {
    const keys = new Set<string>();
    for (const alg of CUBE_ORIENTATION_ALGS) {
      const facing = facingAfterAlg(alg);
      keys.add(`${facing.up}|${facing.front}`);
    }
    assert.equal(keys.size, 24);
  });

  it("quatFromOrientationAlg 可被吸附回原公式", () => {
    for (const alg of CUBE_ORIENTATION_ALGS) {
      const q = quatFromOrientationAlg(alg);
      assert.equal(
        nearestCubeOrientationAlg(q),
        alg,
        `expected ${alg} got ${nearestCubeOrientationAlg(q)}`,
      );
    }
  });

  it("orientationRotationPath 单步与多步", () => {
    assert.deepEqual(orientationRotationPath("", "y"), ["y"]);
    assert.deepEqual(orientationRotationPath("y", "y2"), ["y"]);
    assert.deepEqual(orientationRotationPath("", "y2"), ["y2"]);
    assert.deepEqual(orientationRotationPath("y", "y"), []);
    const path = orientationRotationPath("", "x y");
    assert.ok(path.length >= 1 && path.length <= 2);
    assert.equal(
      nearestCubeOrientationAlg(
        quatFromOrientationAlg(["", ...path].filter(Boolean).join(" ")),
      ),
      "x y",
    );
  });

  it("snapCubeOrientationAlg 明确贴合才切换，否则保持", () => {
    const y = quatFromOrientationAlg("y");
    assert.equal(snapCubeOrientationAlg(y, "", 0.12), "y");
    assert.equal(snapCubeOrientationAlg(y, "y", 0.12), "y");
    // 已在正确朝向：大 margin 也不应离开
    assert.equal(snapCubeOrientationAlg(y, "y", 0.9), "y");
  });

  it("scrambleToHeldPrepRotations 写出观察阶段 z2 / y", () => {
    assert.deepEqual(scrambleToHeldPrepRotations(""), []);
    assert.deepEqual(scrambleToHeldPrepRotations("z2"), ["z2"]);
    assert.deepEqual(scrambleToHeldPrepRotations("z2 y"), ["z2", "y"]);
    // 等价写法归一到表内 z2 系
    assert.deepEqual(scrambleToHeldPrepRotations("x2 y2"), ["z2"]);
  });

  it("黄上之后 midSolve 只落在 y 环，不误吸 z/x", () => {
    assert.equal(isYellowTopOrientation("z2"), true);
    assert.equal(isYellowTopOrientation("z2 y"), true);
    assert.equal(isYellowTopOrientation(""), false);
    assert.equal(isYellowTopOrientation("z"), false);

    const tiltedTowardZ = quatFromOrientationAlg("z");
    assert.equal(
      midSolveOrientationCandidate(tiltedTowardZ, "z2"),
      nearestYellowTopOrientationAlg(tiltedTowardZ),
    );
    assert.notEqual(midSolveOrientationCandidate(tiltedTowardZ, "z2"), "z");

    const yaw = quatFromOrientationAlg("z2 y");
    assert.equal(midSolveOrientationCandidate(yaw, "z2"), "z2 y");
  });

  it("tickOrientationHold 需稳定一段时间才提交，抑制抖动", () => {
    let state = createOrientationHoldState("");
    let tick = tickOrientationHold(state, "y", 0, 320);
    assert.deepEqual(tick.path, []);
    state = tick.state;
    tick = tickOrientationHold(state, "y", 100, 320);
    assert.deepEqual(tick.path, []);
    tick = tickOrientationHold(state, "y", 320, 320);
    assert.deepEqual(tick.path, ["y"]);
    state = tick.state;
    // 来回抖动未稳住不提交
    tick = tickOrientationHold(state, "y'", 400, 320);
    state = tick.state;
    tick = tickOrientationHold(state, "y", 500, 320);
    assert.deepEqual(tick.path, []);
  });
});
