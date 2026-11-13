import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDENTITY_QUAT,
  quatMultiply,
  quatNormalize,
} from "../bluetooth/moyu/orientation.ts";
import { quatFromOrientationAlg } from "../score/cubeOrientation.ts";
import {
  absoluteMoveToGripGuide,
  completedOrientationMoves,
  guideDisplayOrientationQuat,
  guideMeshFollowQuat,
  hintTokenInSolveView,
  relativeOrientationAlg,
  relativeOrientationQuat,
  remapGripTokenToPuzzleHint,
  shouldUpdateGuideMeshHomeAfterAdvance,
} from "./guideOrientation.ts";

describe("completedOrientationMoves", () => {
  it("only keeps rotations before progress", () => {
    assert.deepEqual(completedOrientationMoves(["R", "z2", "U'", "y"], 0), []);
    assert.deepEqual(completedOrientationMoves(["R", "z2", "U'", "y"], 2), [
      "z2",
    ]);
    assert.deepEqual(completedOrientationMoves(["R", "z2", "U'", "y"], 4), [
      "z2",
      "y",
    ]);
  });

  it("rejects non-finite progress", () => {
    assert.throws(
      () => completedOrientationMoves(["M", "z'"], Number.NaN),
      /finite number/,
    );
  });
});

describe("guideDisplayOrientationQuat", () => {
  it("非转体步锁到公式 z2，忽略活 yaw", () => {
    const yaw = quatFromOrientationAlg("z2 y");
    const locked = guideDisplayOrientationQuat(["z2"], {
      onRotationStep: false,
      liveQuat: yaw,
    });
    const expected = quatFromOrientationAlg("z2");
    assert.equal(locked.x, expected.x);
    assert.equal(locked.y, expected.y);
    assert.equal(locked.z, expected.z);
    assert.equal(locked.w, expected.w);
  });

  it("onRotationStep 时仍可跟活姿态（兼容）；游戏页默认不启用", () => {
    const live = quatFromOrientationAlg("z");
    const out = guideDisplayOrientationQuat([], {
      onRotationStep: true,
      liveQuat: live,
    });
    assert.equal(out, live);
  });

  it("转体步已起步时跟 liveQuat；静置锁公式（B' 后顶蓝）", () => {
    const live = quatFromOrientationAlg("z'");
    const following = guideDisplayOrientationQuat(["z'"], {
      onRotationStep: true,
      liveQuat: live,
      rotationStarted: true,
    });
    assert.equal(following, live);
    const resting = guideDisplayOrientationQuat([], {
      onRotationStep: true,
      liveQuat: live,
      rotationStarted: false,
    });
    assert.deepEqual(resting, IDENTITY_QUAT);
    const afterZ = guideDisplayOrientationQuat(["z'"], {
      onRotationStep: true,
      liveQuat: live,
      rotationStarted: false,
    });
    assert.deepEqual(afterZ, quatFromOrientationAlg("z'"));
  });

  it("尚无公式转体时回单位朝向", () => {
    assert.deepEqual(
      guideDisplayOrientationQuat([], {
        onRotationStep: false,
        liveQuat: null,
      }),
      IDENTITY_QUAT,
    );
  });
});

describe("guideMeshFollow / mesh home", () => {
  it("宽层手持 x' 后 mesh 跟手，不锁单位", () => {
    const home = quatFromOrientationAlg("");
    const live = quatFromOrientationAlg("x'");
    const mesh = guideMeshFollowQuat(home, live);
    assert.deepEqual(mesh, live);
  });

  it("仅公式转体步推进后更新 mesh 基准", () => {
    assert.equal(shouldUpdateGuideMeshHomeAfterAdvance("z'"), true);
    assert.equal(shouldUpdateGuideMeshHomeAfterAdvance("y"), true);
    assert.equal(shouldUpdateGuideMeshHomeAfterAdvance("r'"), false);
    assert.equal(shouldUpdateGuideMeshHomeAfterAdvance("M"), false);
    assert.equal(shouldUpdateGuideMeshHomeAfterAdvance("D'"), false);
  });
});

describe("relativeOrientationQuat", () => {
  it("相对步起点：静止为单位，转 z' 后接近公式 z'", () => {
    const start = IDENTITY_QUAT;
    const live = quatFromOrientationAlg("z'");
    assert.deepEqual(relativeOrientationQuat(start, start), IDENTITY_QUAT);
    const delta = relativeOrientationQuat(start, live);
    const expected = quatFromOrientationAlg("z'");
    assert.ok(Math.abs(delta.x - expected.x) < 1e-9);
    assert.ok(Math.abs(delta.y - expected.y) < 1e-9);
    assert.ok(Math.abs(delta.z - expected.z) < 1e-9);
    assert.ok(Math.abs(delta.w - expected.w) < 1e-9);
  });

  it("世界系左乘：起点已有 y 时再叠 z'，增量仍是 z'（勿共轭成 x/y）", () => {
    const start = quatFromOrientationAlg("y");
    const zPrime = quatFromOrientationAlg("z'");
    // MoyuOrientationTracker：orientation = R_world ⊗ previous
    const live = quatNormalize(quatMultiply(zPrime, start));
    const delta = relativeOrientationQuat(start, live);
    assert.ok(Math.abs(delta.x - zPrime.x) < 1e-9);
    assert.ok(Math.abs(delta.y - zPrime.y) < 1e-9);
    assert.ok(Math.abs(delta.z - zPrime.z) < 1e-9);
    assert.ok(Math.abs(delta.w - zPrime.w) < 1e-9);
  });
});

describe("relativeOrientationAlg", () => {
  it("从任意起点再转世界系 z'，相对吸附为 z'", () => {
    const start = quatFromOrientationAlg("y");
    const live = quatNormalize(
      quatMultiply(quatFromOrientationAlg("z'"), start),
    );
    assert.equal(relativeOrientationAlg(start, start), "");
    assert.equal(relativeOrientationAlg(start, live), "z'");
  });

  it("起点略有 x 偏斜时世界系 z' 仍吸附为 z'（旧右乘相对会变成 y）", () => {
    const start = quatFromOrientationAlg("x");
    const live = quatNormalize(
      quatMultiply(quatFromOrientationAlg("z'"), start),
    );
    assert.equal(relativeOrientationAlg(start, live), "z'");
  });
});

describe("remapGripTokenToPuzzleHint yaw trap", () => {
  it("L' 经 z2 y 会变成 F'（故显示朝向不得混入活 yaw）", () => {
    assert.equal(remapGripTokenToPuzzleHint("L'", ["z2"]), "R'");
    assert.equal(remapGripTokenToPuzzleHint("L'", ["z2", "y"]), "F'");
  });
});

describe("remapGripTokenToPuzzleHint", () => {
  it("z2 后握持 U' 映到模型 D'（视觉上仍是顶层）", () => {
    assert.equal(remapGripTokenToPuzzleHint("U'", ["z2"]), "D'");
    assert.equal(remapGripTokenToPuzzleHint("U", ["z2"]), "D");
  });

  it("z2 后宽层 u' → d'", () => {
    assert.equal(remapGripTokenToPuzzleHint("u'", ["z2"]), "d'");
  });

  it("转体记号不改写", () => {
    assert.equal(remapGripTokenToPuzzleHint("z2", ["y"]), "z2");
  });

  it("无转体时保持原样", () => {
    assert.equal(remapGripTokenToPuzzleHint("U'", []), "U'");
  });
});

describe("absoluteMoveToGripGuide", () => {
  it("z2 后蓝牙 D' 对上握持 U'", () => {
    assert.equal(absoluteMoveToGripGuide("D'", ["z2"]), "U'");
  });
});

describe("hintTokenInSolveView", () => {
  it("z2 后保持握持记号，不映回白上", () => {
    assert.equal(hintTokenInSolveView("l'", ["z2"]), "l'");
    assert.equal(hintTokenInSolveView("U'", ["z2"]), "U'");
    assert.equal(hintTokenInSolveView("E", ["z2"]), "E");
  });

  it("转体前打乱面转映到黄上视图", () => {
    assert.equal(hintTokenInSolveView("U'", []), "D'");
    assert.equal(hintTokenInSolveView("R", []), "L");
  });
});
