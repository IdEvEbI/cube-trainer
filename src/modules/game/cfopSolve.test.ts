import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  composeSetupScramble,
  conjugateScrambleForYellowUp,
  conjugateTokenByZ2,
  countPhaseHtm,
  mergeZ2IntoCross,
  moveToToken,
  normalizeAlgTokens,
  phasesFromCfopSegments,
  solveCfopGame,
  tokenizeAlg,
  trySolveCfopGame,
} from "./cfopSolve.ts";

describe("moveToToken / tokenizeAlg / normalize", () => {
  it("面转与宽层记号", () => {
    assert.equal(moveToToken({ family: "R", amount: 1 }), "R");
    assert.equal(moveToToken({ family: "U", amount: 2 }), "U2");
    assert.equal(moveToToken({ family: "L", amount: 3 }), "L'");
    assert.deepEqual(tokenizeAlg(" R  U2  f' "), ["R", "U2", "f'"]);
    assert.deepEqual(normalizeAlgTokens(["U", "M", "U'"]), ["U", "M", "U'"]);
  });
});

describe("conjugateTokenByZ2 / conjugateScrambleForYellowUp", () => {
  it("白上打乱映成白底等价打乱", () => {
    assert.equal(conjugateTokenByZ2("R"), "L");
    assert.equal(conjugateTokenByZ2("U"), "D");
    assert.equal(conjugateTokenByZ2("y"), "y'");
    assert.equal(conjugateScrambleForYellowUp("R U F'"), "L D F'");
  });

  it("共轭打乱与 z2 状态一致", async () => {
    const scramble = "R U2 F' L D B2 R'";
    const conj = conjugateScrambleForYellowUp(scramble);
    const puzzle = await cube3x3x3.kpuzzle();
    const id = puzzle.defaultPattern();
    const afterPhysical = id.applyAlg(scramble).applyAlg("z2");
    const afterConjFromYellow = id.applyAlg("z2").applyAlg(conj);
    assert.equal(afterPhysical.isIdentical(afterConjFromYellow), true);
  });
});

describe("phasesFromCfopSegments", () => {
  it("F2L setup 步并入对应 pair", () => {
    const phases = phasesFromCfopSegments([
      { unitId: "cross", moves: [{ family: "R", amount: 1 }] },
      {
        unitId: "f2l",
        phases: [
          {
            phaseId: "greedy1Setup",
            moves: [{ family: "U", amount: 1 }],
          },
          {
            phaseId: "greedy1",
            moves: [{ family: "R", amount: 1 }],
          },
          { phaseId: "greedy2Setup", moves: [] },
          {
            phaseId: "greedy2",
            moves: [{ family: "F", amount: 1 }],
          },
          { phaseId: "greedy3Setup", moves: [] },
          {
            phaseId: "greedy3",
            moves: [{ family: "L", amount: 1 }],
          },
          { phaseId: "greedy4Setup", moves: [] },
          {
            phaseId: "greedy4",
            moves: [{ family: "B", amount: 1 }],
          },
        ],
      },
      { unitId: "oll", moves: [{ family: "r", amount: 1 }] },
      { unitId: "pll", moves: [{ family: "M", amount: 2 }] },
    ]);
    assert.deepEqual(phases[1], { id: "F2L1", moves: ["U", "R"] });
    assert.equal(phases[0]?.id, "Cross");
    assert.equal(phases.at(-1)?.id, "PLL");
  });
});

describe("mergeZ2IntoCross", () => {
  it("把 z2 前缀并入 Cross", () => {
    assert.deepEqual(mergeZ2IntoCross([{ id: "Cross", moves: ["R", "U"] }]), [
      { id: "Cross", moves: ["z2", "R", "U"] },
    ]);
    assert.deepEqual(mergeZ2IntoCross([{ id: "Cross", moves: ["z2", "R"] }]), [
      { id: "Cross", moves: ["z2", "R"] },
    ]);
  });
});

describe("countPhaseHtm", () => {
  it("R2 / r2 / M2 各计 1，不含 z2", () => {
    assert.equal(countPhaseHtm(["z2", "R2", "r2", "M2", "U"]), 4);
    assert.equal(countPhaseHtm(["z2", "y", "R", "U'"]), 2);
  });
});

describe("solveCfopGame", () => {
  const FIXED_SCRAMBLES = [
    "R U2 F' L D B2 R' U F2 D' L2 B R2 U' F D2 B' L U2 R'",
    "L2 R2 B' U2 L B F2 U2 L R' D2 B R' U' R2 U' D R' B' L",
    "D' B' U' L F' U2 L' D2 U L' D' B2 F2 L B' U' L R' B2 R",
    "F2 L' U2 R F' D2 B' R2 U F L2 D' B2 R' U' F' L D2 B R'",
    "U R2 F' D L2 B U' R F2 D' L B2 R' U F' L2 D B' R U2 F",
  ] as const;

  it("z2 并入 Cross；可含宽层/中层；整串到黄上复原", async () => {
    const scramble = FIXED_SCRAMBLES[0]!;
    const phases = await solveCfopGame(scramble);
    assert.equal(phases[0]?.id, "Cross");
    assert.equal(phases[0]?.moves[0], "z2");
    assert.equal(phases.at(-1)?.id, "PLL");

    const puzzle = await cube3x3x3.kpuzzle();
    const identity = puzzle.defaultPattern();
    const yellowUpSolved = identity.applyAlg("z2");
    const solution = phases.flatMap((phase) => phase.moves).join(" ");
    assert.equal(
      identity
        .applyAlg(scramble)
        .applyAlg(solution)
        .isIdentical(yellowUpSolved),
      true,
    );
  });

  it("若干固定打乱：Cross HTM ≤ 8，且仍以 z2 开头、终态黄上复原", async () => {
    const puzzle = await cube3x3x3.kpuzzle();
    const identity = puzzle.defaultPattern();
    const yellowUpSolved = identity.applyAlg("z2");
    for (const scramble of FIXED_SCRAMBLES) {
      const phases = await solveCfopGame(scramble);
      const cross = phases[0];
      assert.equal(cross?.id, "Cross", scramble);
      assert.equal(cross?.moves[0], "z2", scramble);
      const htm = countPhaseHtm(cross!.moves);
      assert.ok(
        htm <= 8,
        `${scramble} Cross HTM=${htm} > 8（${cross!.moves.join(" ")}）`,
      );
      const solution = phases.flatMap((phase) => phase.moves).join(" ");
      assert.equal(
        identity
          .applyAlg(scramble)
          .applyAlg(solution)
          .isIdentical(yellowUpSolved),
        true,
        scramble,
      );
    }
  });

  it("F0=U2：求解输入是 U2·打乱；解完到还原；进页公式固定", async () => {
    const scramble = FIXED_SCRAMBLES[0]!;
    const f0 = "U2";
    assert.equal(composeSetupScramble(f0, scramble), `U2 ${scramble}`);

    const first = await trySolveCfopGame(scramble, f0);
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    assert.equal(first.solveInput, `U2 ${scramble}`);
    assert.equal(first.prependedZ2, true);
    assert.equal(first.phases[0]?.moves[0], "z2");

    const puzzle = await cube3x3x3.kpuzzle();
    const identity = puzzle.defaultPattern();
    const yellowUpSolved = identity.applyAlg("z2");
    const solution = first.phases.flatMap((phase) => phase.moves).join(" ");
    assert.equal(
      identity
        .applyAlg(first.solveInput)
        .applyAlg(solution)
        .isIdentical(yellowUpSolved),
      true,
      "解完应用到 F0·打乱 得还原态",
    );

    const second = await trySolveCfopGame(scramble, f0);
    assert.equal(second.ok, true);
    if (!second.ok) {
      return;
    }
    assert.deepEqual(
      second.phases,
      first.phases,
      "打乱跟完后公式不变（同输入再求一次仍同）",
    );
    assert.equal(second.solveInput, first.solveInput);
  });

  it("F0=U：含中层解自检忽略色心，仍可开还原引导", async () => {
    const scramble = "F D2 L' B2 U2 D' B2 D' R' D' F' D L' F D2 L' B F L' U'";
    const result = await trySolveCfopGame(scramble, "U");
    assert.equal(result.ok, true, result.ok ? "" : result.reason);
    if (!result.ok) {
      return;
    }
    assert.equal(result.solveInput, `U ${scramble}`);
    assert.equal(result.phases[0]?.id, "Cross");
  });

  it("F0 已黄上：Cross 前不补 z2", async () => {
    const scramble = FIXED_SCRAMBLES[1]!;
    const f0 = "z2";
    const result = await trySolveCfopGame(scramble, f0);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.prependedZ2, false);
    assert.notEqual(result.phases[0]?.moves[0], "z2");
    const puzzle = await cube3x3x3.kpuzzle();
    const identity = puzzle.defaultPattern();
    const yellowUpSolved = identity.applyAlg("z2");
    const solution = result.phases.flatMap((phase) => phase.moves).join(" ");
    const after = identity.applyAlg(result.solveInput).applyAlg(solution);
    assert.equal(
      after.isIdentical(yellowUpSolved) || after.isIdentical(identity),
      true,
    );
  });
});
