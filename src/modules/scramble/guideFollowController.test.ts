import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IDENTITY_QUAT } from "../bluetooth/moyu/orientation.ts";
import { quatFromOrientationAlg } from "../score/cubeOrientation.ts";
import {
  createGuideFollowController,
  GUIDE_FOLLOW_MOVE_QUIET_MS,
} from "./guideFollowController.ts";

describe("GuideFollowController · faceRemapHome", () => {
  it("capture / clear / sync / applyLive 与状态机一致", () => {
    const ctrl = createGuideFollowController();
    const live = quatFromOrientationAlg("z2");
    ctrl.captureFaceRemapHome(live, "z2");
    assert.equal(ctrl.faceRemapHome.homeQuat, live);
    assert.equal(ctrl.faceRemapHome.orientsKey, "z2");
    assert.equal(ctrl.faceRemapHome.pendingKey, null);

    ctrl.syncFaceRemapHome({
      orientsKey: "z2 y",
      active: true,
      liveQuat: null,
    });
    assert.equal(ctrl.faceRemapHome.orientsKey, "z2 y");
    assert.equal(ctrl.faceRemapHome.pendingKey, "z2 y");
    assert.equal(ctrl.faceRemapHome.homeQuat, live);

    const nextLive = quatFromOrientationAlg("z2 y");
    ctrl.applyFaceRemapHomeLive(nextLive);
    assert.equal(ctrl.faceRemapHome.homeQuat, nextLive);
    assert.equal(ctrl.faceRemapHome.pendingKey, null);

    ctrl.syncFaceRemapHome({
      orientsKey: "",
      active: false,
      liveQuat: nextLive,
    });
    assert.equal(ctrl.faceRemapHome.homeQuat, IDENTITY_QUAT);
    assert.equal(ctrl.faceRemapHome.orientsKey, "");
  });

  it("reset 清空 home 与其它接线状态", () => {
    const ctrl = createGuideFollowController();
    ctrl.captureFaceRemapHome(quatFromOrientationAlg("z2"), "z2");
    ctrl.beginQuiet(1000);
    ctrl.beginOrContinueRotationStep("0:z2", quatFromOrientationAlg("z2"));
    ctrl.reset();
    assert.equal(ctrl.faceRemapHome.homeQuat, IDENTITY_QUAT);
    assert.equal(ctrl.quietUntilMs, 0);
    assert.equal(ctrl.rotationStepKey, null);
    assert.equal(ctrl.layerGestureTracker, null);
  });
});

describe("GuideFollowController · faceOrientCandidates", () => {
  it("首页：公式空 + 开局 home，含层转 Last Δ", () => {
    const ctrl = createGuideFollowController();
    const home = quatFromOrientationAlg("");
    ctrl.captureFaceRemapHome(home);
    const candidates = ctrl.faceOrientCandidates({
      formulaOrients: [],
      displayMoves: ["r", "U'"],
      progress: 1,
      liveQuat: home,
      requireYellowUp: false,
    });
    assert.ok(candidates.includes(""));
    // r 的 Δ=x'；无公式前缀时候选含 x' / x
    assert.ok(candidates.includes("x'") || candidates.includes("x"));
  });

  it("游戏页：无黄上只回绝对空串；有 z2 时公式优先", () => {
    const ctrl = createGuideFollowController();
    assert.deepEqual(
      ctrl.faceOrientCandidates({
        formulaOrients: [],
        displayMoves: ["R", "U"],
        progress: 1,
        liveQuat: IDENTITY_QUAT,
        requireYellowUp: true,
      }),
      [""],
    );

    const z2 = quatFromOrientationAlg("z2");
    ctrl.captureFaceRemapHome(z2, "z2");
    const candidates = ctrl.faceOrientCandidates({
      formulaOrients: ["z2"],
      displayMoves: ["z2", "U'", "M'", "U'"],
      progress: 3,
      liveQuat: z2,
      requireYellowUp: true,
    });
    assert.equal(candidates[0], "z2");
    assert.ok(candidates.includes("z2 x'") || candidates.includes("z2 x"));
  });
});

describe("GuideFollowController · quiet window", () => {
  it("beginQuiet 后 isInQuiet，超时后放行", () => {
    const ctrl = createGuideFollowController();
    const t0 = 10_000;
    assert.equal(ctrl.isInQuiet(t0), false);
    ctrl.beginQuiet(t0);
    assert.equal(ctrl.isInQuiet(t0 + 1), true);
    assert.equal(ctrl.isInQuiet(t0 + GUIDE_FOLLOW_MOVE_QUIET_MS - 1), true);
    assert.equal(ctrl.isInQuiet(t0 + GUIDE_FOLLOW_MOVE_QUIET_MS), false);
  });

  it("自定义时长", () => {
    const ctrl = createGuideFollowController();
    ctrl.beginQuiet(100, 50);
    assert.equal(ctrl.isInQuiet(149), true);
    assert.equal(ctrl.isInQuiet(150), false);
  });
});

describe("GuideFollowController · manualSync / rotation / layer", () => {
  it("ensureManualSync 同键复用；换键重采 tracker", () => {
    const ctrl = createGuideFollowController();
    const a = ctrl.ensureManualSync({
      guideKey: "2:r",
      syncSetup: "z2 U'",
      progress: 2,
      expectedToken: "r",
      gyroBefore: IDENTITY_QUAT,
    });
    assert.equal(a, "z2 U'");
    assert.equal(ctrl.manualSyncSetup, "z2 U'");
    assert.ok(ctrl.layerGestureTracker);
    const tracker1 = ctrl.layerGestureTracker;

    const again = ctrl.ensureManualSync({
      guideKey: "2:r",
      syncSetup: "ignored",
      progress: 2,
      expectedToken: "r",
      gyroBefore: IDENTITY_QUAT,
    });
    assert.equal(again, "z2 U'");
    assert.equal(ctrl.layerGestureTracker, tracker1);

    ctrl.ensureManualSync({
      guideKey: "3:U'",
      syncSetup: "z2 U' r",
      progress: 3,
      expectedToken: "U'",
      gyroBefore: IDENTITY_QUAT,
    });
    assert.equal(ctrl.manualSyncSetup, "z2 U' r");
    assert.notEqual(ctrl.layerGestureTracker, tracker1);
  });

  it("转体步键变则重采 from", () => {
    const ctrl = createGuideFollowController();
    const q0 = quatFromOrientationAlg("");
    const q1 = quatFromOrientationAlg("z2");
    const first = ctrl.beginOrContinueRotationStep("1:z2", q0);
    assert.equal(first.isNewStep, true);
    assert.equal(first.relativeAlg, "");
    const same = ctrl.beginOrContinueRotationStep("1:z2", q1);
    assert.equal(same.isNewStep, false);
    assert.equal(same.relativeAlg, "z2");
    const next = ctrl.beginOrContinueRotationStep("2:y", q1);
    assert.equal(next.isNewStep, true);
    assert.equal(next.relativeAlg, "");
  });
});
