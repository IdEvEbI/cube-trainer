import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { algStatesMatch } from "./algStateMatch.ts";
import {
  expectedSetupAfterManualStep,
  manualStepReachedOnCube,
  wideOuterFaceToken,
} from "./manualStepSync.ts";

describe("expectedSetupAfterManualStep", () => {
  it("builds delta from sync setup, remapping through z2", () => {
    assert.equal(
      expectedSetupAfterManualStep("R U F'", "l'", ["z2"]),
      "R U F' r'",
    );
    assert.equal(
      expectedSetupAfterManualStep("R U F'", "E", ["z2"]),
      "R U F' E'",
    );
  });

  it("公式前缀已含 z2/f 时拼握持 u，勿再映成 d", () => {
    assert.equal(
      expectedSetupAfterManualStep("z2 F' U' f R2", "u", ["z2"]),
      "z2 F' U' f R2 u",
    );
  });

  it("skip E 后只对 l' 增量仍能与实物对上", async () => {
    const sync = "R U F'";
    const expected = expectedSetupAfterManualStep(sync, "l'", ["z2"]);
    assert.equal(await algStatesMatch(`${sync} r'`, expected), true);
    assert.equal(await algStatesMatch(`${sync} r'`, `${sync} E' r'`), false);
  });
});

describe("manualStepReachedOnCube", () => {
  it("宽层须整步到位；只转外层不算完成", async () => {
    assert.equal(wideOuterFaceToken("r'"), "R'");
    const sync = "R U F'";
    // 握持 l' → 绝对 r'；仅外层 R' 不能推进（避免后续朝向漂）
    assert.equal(
      await manualStepReachedOnCube(`${sync} R'`, sync, "l'", ["z2"]),
      false,
    );
    assert.equal(
      await manualStepReachedOnCube(`${sync} r'`, sync, "l'", ["z2"]),
      true,
    );
  });

  it("打乱帧无转体时 u 用 facelets 整步判定", async () => {
    const sync = "R";
    assert.equal(
      await manualStepReachedOnCube(`${sync} U`, sync, "u", []),
      false,
    );
    assert.equal(
      await manualStepReachedOnCube(`${sync} u`, sync, "u", []),
      true,
    );
  });

  it("PLL：z2…f 后 u 按公式记号对表，映成 d 会卡死", async () => {
    const sync = "z2 F' U' f R2";
    assert.equal(
      await manualStepReachedOnCube(`${sync} u`, sync, "u", ["z2"]),
      true,
    );
    // 误把 u 当绝对 d 时不应作为唯一期望
    assert.equal(await algStatesMatch(`${sync} u`, `${sync} d`), false);
  });

  it("E 后再 M'：须用公式前缀 E，不能用 facelets 的 D' U 再拼 M'", async () => {
    // facelets 把 E 收成 D' U；实物 E M' 归中心后是 D' U B F'
    const bleAfterE = "D' U";
    const bleAfterEM = "D' U B F'";
    assert.equal(await algStatesMatch(bleAfterE, "E"), true);
    assert.equal(await algStatesMatch(bleAfterEM, "E M'"), true);
    // 错误拼法：对不上
    assert.equal(
      await manualStepReachedOnCube(bleAfterEM, bleAfterE, "M'", []),
      false,
    );
    // 正确：逻辑前缀保留 E
    assert.equal(await manualStepReachedOnCube(bleAfterE, "", "E", []), true);
    assert.equal(
      await manualStepReachedOnCube(bleAfterEM, "E", "M'", []),
      true,
    );
  });
});
