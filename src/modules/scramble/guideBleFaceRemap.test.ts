import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IDENTITY_QUAT } from "../bluetooth/moyu/orientation.ts";
import { quatFromOrientationAlg } from "../score/cubeOrientation.ts";
import { absoluteFaceMoveToGrip } from "../score/solveAlgDisplay.ts";
import {
  applyGuideFaceRemapHomeLive,
  captureGuideFaceRemapHome,
  clearGuideFaceRemapHome,
  composeGuideBleMatchOrients,
  createGuideFaceRemapHomeState,
  guideBleFaceOrientCandidates,
  guideBleFaceOrientAlg,
  guideBleMatchOrientations,
  guideBleRelativeBasisQuat,
  invertOrientationAlgParts,
  resolveGuideBleFaceMoveWithCandidates,
  resolveGuideBleFaceMoveWithHint,
  syncGuideFaceRemapHome,
} from "./guideBleFaceRemap.ts";

describe("composeGuideBleMatchOrients", () => {
  it("无相对 Δ 时仅公式", () => {
    assert.deepEqual(composeGuideBleMatchOrients(["z2"], ""), ["z2"]);
    assert.deepEqual(composeGuideBleMatchOrients(["z2"], null), ["z2"]);
  });

  it("叠相对 Δ", () => {
    assert.deepEqual(composeGuideBleMatchOrients(["z2"], "x"), ["z2", "x"]);
  });
});

describe("guideBleRelativeBasisQuat", () => {
  it("有公式转体时用公式姿态，避免白上 home 双计 z2", () => {
    const captured = IDENTITY_QUAT;
    const basis = guideBleRelativeBasisQuat(["z2"], captured);
    const live = quatFromOrientationAlg("z2");
    const match = guideBleMatchOrientations(["z2"], captured, live);
    // 旧逻辑 home=I → [z2,z2] 把 D 映成 D；公式 basis → 仅 z2
    assert.deepEqual(match, ["z2"]);
    assert.equal(absoluteFaceMoveToGrip("D", match), "U");
    assert.notEqual(basis, captured);
  });
});

describe("guideBleMatchOrientations / guideBleFaceOrientAlg", () => {
  it("首页：无公式转体，只靠 relative(home→live)", () => {
    const home = quatFromOrientationAlg("");
    const live = quatFromOrientationAlg("x'");
    assert.deepEqual(guideBleMatchOrientations([], home, live), ["x'"]);
    assert.equal(guideBleFaceOrientAlg([], home, live), "x'");
  });

  it("游戏：公式 z2 + M' 倾斜相对 Δ，使 F→U", () => {
    const home = quatFromOrientationAlg("z2");
    const live = quatFromOrientationAlg("z2 x'");
    const match = guideBleMatchOrientations(["z2"], home, live);
    assert.equal(match[0], "z2");
    assert.equal(absoluteFaceMoveToGrip("F", match), "U");
  });

  it("live 为空时不追加相对", () => {
    assert.deepEqual(guideBleMatchOrientations(["z2"], IDENTITY_QUAT, null), [
      "z2",
    ]);
  });
});

describe("guideBleFaceOrientCandidates / r' 后 U", () => {
  it("相对符号反了时：顶面 B 仍能靠取反候选映成 U（勿报 D）", () => {
    const home = quatFromOrientationAlg("z2");
    // live 吸成 z2 x' 时 relative=x，B→D；取反 x' 后 B→U
    const live = quatFromOrientationAlg("z2 x'");
    const candidates = guideBleFaceOrientCandidates({
      formulaOrients: ["z2"],
      homeQuat: home,
      liveQuat: live,
    });
    assert.equal(candidates[0], "z2", "公式优先");
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("B", "U", candidates),
      "U",
    );
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("D", "U", candidates),
      "U",
    );
  });

  it("截图：z2 后 u 残留 yaw 时，期望 R 仍吃绝对 L（勿把绝对 R 收成 F）", () => {
    const home = quatFromOrientationAlg("z2");
    const live = quatFromOrientationAlg("z2 y'");
    const candidates = guideBleFaceOrientCandidates({
      formulaOrients: ["z2"],
      homeQuat: home,
      liveQuat: live,
    });
    assert.equal(candidates[0], "z2");
    // 黄上公式 R = 绝对 L；摆正拧法应直接命中
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("L", "R", candidates),
      "R",
    );
    // 绝对 R 在脏 yaw 下曾被首个候选映成 F；公式优先后回落为 L（对面），勿报 F
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("R", "R", candidates),
      "L",
    );
    assert.notEqual(
      resolveGuideBleFaceMoveWithCandidates("R", "R", candidates),
      "F",
    );
  });

  it("白上 home + 黄上 live 不再因 z2 双计把 D 认成 D", () => {
    const candidates = guideBleFaceOrientCandidates({
      formulaOrients: ["z2"],
      homeQuat: IDENTITY_QUAT,
      liveQuat: quatFromOrientationAlg("z2"),
    });
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("D", "U", candidates),
      "U",
    );
  });

  it("多步层转 Δ 不整串取反；单步仍取反", () => {
    // 多步累积（色心 x' z 或脏 z' z y'）整串取反曾把 B' 收成 R'；现不取反。
    const multi = guideBleFaceOrientCandidates({
      formulaOrients: ["z2"],
      homeQuat: quatFromOrientationAlg("z2"),
      liveQuat: quatFromOrientationAlg("z2"),
      layerGyroAlg: "z' z y'",
    });
    assert.ok(multi.includes("z2 z' z y'"));
    assert.equal(multi.includes("z2 y z' z"), false, "多步不应再推整串取反");
    assert.notEqual(
      resolveGuideBleFaceMoveWithCandidates("B'", "R'", multi),
      "R'",
    );
    const single = guideBleFaceOrientCandidates({
      formulaOrients: ["z2"],
      homeQuat: quatFromOrientationAlg("z2"),
      liveQuat: quatFromOrientationAlg("z2"),
      layerGyroAlg: "y'",
    });
    assert.equal(single[0], "z2");
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("L'", "R'", single),
      "R'",
    );
    // 单步 y' 仍取反为 y
    assert.ok(single.includes("z2 y'") || single.includes("z2 y"));
  });

  it("截图：M' 后跟公式拧顶面（绝对 F'）应推进 U'，勿报请转 F", () => {
    // Twisty：z2 M' 色心 ≡ z2 x；M' 期望 Δ=x'。跟 3D 顶面 = 绝对 F'。
    const candidates = guideBleFaceOrientCandidates({
      formulaOrients: ["z2"],
      homeQuat: quatFromOrientationAlg("z2"),
      liveQuat: quatFromOrientationAlg("z2"),
      layerGyroAlg: "x'",
    });
    assert.equal(candidates[0], "z2");
    assert.ok(candidates.includes("z2 x'") || candidates.includes("z2 x"));
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("F'", "U'", candidates),
      "U'",
    );
    // 摆正拧黄面（绝对 D'）仍走公式优先
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("D'", "U'", candidates),
      "U'",
    );
  });

  it("无一命中时回落首个候选（公式优先后即公式-only）", () => {
    assert.equal(
      resolveGuideBleFaceMoveWithCandidates("B'", "R'", ["z2", "z2 z' z y'"]),
      "B'",
    );
  });
});

describe("GuideFaceRemapHomeState", () => {
  it("capture 后 sync 同键不改 home", () => {
    const live = quatFromOrientationAlg("z2");
    let state = captureGuideFaceRemapHome(live, "z2");
    const again = quatFromOrientationAlg("z2 x'");
    state = syncGuideFaceRemapHome(state, {
      orientsKey: "z2",
      active: true,
      liveQuat: again,
    });
    assert.equal(state.homeQuat, live);
    assert.equal(state.pendingKey, null);
  });

  it("转体键变化且有 live 时重采 home", () => {
    const first = quatFromOrientationAlg("z2");
    const second = quatFromOrientationAlg("z2 y");
    let state = captureGuideFaceRemapHome(first, "z2");
    state = syncGuideFaceRemapHome(state, {
      orientsKey: "z2 y",
      active: true,
      liveQuat: second,
    });
    assert.equal(state.homeQuat, second);
    assert.equal(state.orientsKey, "z2 y");
  });

  it("无 live 时挂 pending，随后 apply 兑现", () => {
    let state = createGuideFaceRemapHomeState();
    state = syncGuideFaceRemapHome(state, {
      orientsKey: "z2",
      active: true,
      liveQuat: null,
    });
    assert.equal(state.pendingKey, "z2");
    const live = quatFromOrientationAlg("z2");
    state = applyGuideFaceRemapHomeLive(state, live);
    assert.equal(state.homeQuat, live);
    assert.equal(state.pendingKey, null);
  });

  it("active=false 清零", () => {
    const live = quatFromOrientationAlg("z2");
    let state = captureGuideFaceRemapHome(live, "z2");
    state = syncGuideFaceRemapHome(state, {
      orientsKey: "",
      active: false,
      liveQuat: live,
    });
    assert.deepEqual(state, clearGuideFaceRemapHome());
  });
});

describe("invertOrientationAlgParts", () => {
  it("x y' → y x'", () => {
    assert.equal(invertOrientationAlgParts("x y'"), "y x'");
  });
});

describe("resolveGuideBleFaceMoveWithHint", () => {
  it("match 倾斜对不上时 hint 公式转体兜底", () => {
    assert.equal(resolveGuideBleFaceMoveWithHint("D", "U", "z2 x", "z2"), "U");
  });

  it("match 已命中不改", () => {
    assert.equal(resolveGuideBleFaceMoveWithHint("F", "U", "z2 x", "z2"), "U");
  });
});
