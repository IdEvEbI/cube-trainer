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
  heldMatchesRotationProgress,
  invertRotationGuideToken,
  orientationAlgThroughProgress,
  orientationRotationPath,
  orientationSatisfiesRotation,
  quatFromOrientationAlg,
  scrambleGuideRotationSatisfied,
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

  it("orientationSatisfiesRotation 识别 z2 及随后微调 y", () => {
    assert.equal(orientationSatisfiesRotation("", "z2", "z2"), true);
    assert.equal(orientationSatisfiesRotation("", "z2 y", "z2"), true);
    assert.equal(orientationSatisfiesRotation("", "y", "z2"), false);
    assert.equal(orientationSatisfiesRotation("z2", "z2 y", "y"), true);
    assert.equal(orientationSatisfiesRotation("", "", "z2"), false);
  });

  it("heldMatchesRotationProgress 按公式累积转体", () => {
    const moves = ["R", "U", "z2", "B"];
    assert.equal(orientationAlgThroughProgress(moves, 2), "z2");
    assert.equal(heldMatchesRotationProgress("z2", moves, 2), true);
    assert.equal(heldMatchesRotationProgress("z2 y", moves, 2), true);
    assert.equal(heldMatchesRotationProgress("", moves, 2), false);
  });

  it("打乱引导转体按进入步时的相对起点，避免握持偏移要拧三次", () => {
    // 进入 x 前手持已是 x2：再转一个 x → x'，相对到位；绝对对表会误要三次
    assert.equal(orientationSatisfiesRotation("x2", "x'", "x"), true);
    assert.equal(heldMatchesRotationProgress("x'", ["M", "u", "x"], 2), false);
    assert.equal(orientationSatisfiesRotation("x", "x y'", "y'"), true);
  });

  it("打乱引导转体：x/y 镜像、z 同轴四分之一双向可到位", () => {
    assert.equal(invertRotationGuideToken("x"), "x'");
    assert.equal(invertRotationGuideToken("y'"), "y");
    assert.equal(invertRotationGuideToken("z2"), "z2");
    // x/y：陀螺仪记成逆步，镜像一次到位
    assert.equal(scrambleGuideRotationSatisfied("", "x'", "x"), true);
    assert.equal(orientationSatisfiesRotation("", "x'", "x"), false);
    assert.equal(scrambleGuideRotationSatisfied("x", "x y", "y'"), true);
    // z：正向或反向四分之一都算走过（箭头/吸附偶发反向）
    assert.equal(scrambleGuideRotationSatisfied("x y'", "x y' z", "z"), true);
    assert.equal(scrambleGuideRotationSatisfied("x y'", "x y' z'", "z"), true);
    assert.equal(scrambleGuideRotationSatisfied("", "z", "z'"), true);
    assert.equal(scrambleGuideRotationSatisfied("", "z'", "z'"), true);
  });

  it("转体到位后允许微调 y，避免 z' 后卡死无法进到下一步", () => {
    assert.equal(orientationSatisfiesRotation("", "z'", "z'"), true);
    assert.equal(orientationSatisfiesRotation("", "z' y", "z'"), true);
    assert.equal(orientationSatisfiesRotation("", "z' y'", "z'"), true);
    assert.equal(orientationSatisfiesRotation("", "z' y2", "z'"), true);
    // 反方向整步仍不算到位
    assert.equal(orientationSatisfiesRotation("", "z", "z'"), false);
    assert.equal(scrambleGuideRotationSatisfied("", "z' y", "z'"), true);
  });

  it("期望本身是 y 时不做 yaw-after，避免 z' 后跳过 y 进观察", () => {
    assert.equal(orientationSatisfiesRotation("z'", "z'", "y"), false);
    assert.equal(scrambleGuideRotationSatisfied("z'", "z'", "y"), false);
    assert.equal(orientationSatisfiesRotation("z'", "z' y", "y"), true);
    // 引导对 y 走镜像：陀螺仪常记成 y'
    assert.equal(scrambleGuideRotationSatisfied("z'", "z' y'", "y"), true);
    assert.equal(scrambleGuideRotationSatisfied("z'", "z' y", "y"), false);
  });

  it("同轴过冲到 z2 仍算 z' 到位（连续拧不暂停时）", () => {
    assert.equal(orientationSatisfiesRotation("", "z2", "z'"), true);
    assert.equal(orientationSatisfiesRotation("", "z2", "z"), true);
    assert.equal(scrambleGuideRotationSatisfied("", "z2", "z'"), true);
    // 仍要求同轴：x2 不算 z' 到位
    assert.equal(orientationSatisfiesRotation("", "x2", "z'"), false);
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
