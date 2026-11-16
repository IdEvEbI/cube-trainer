import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  conjugateScrambleForYellowUp,
  conjugateTokenByZ2,
  countPhaseHtm,
  mergeZ2IntoCross,
  moveToToken,
  normalizeAlgTokens,
  phasesFromCfopSegments,
  solveCfopGame,
  tokenizeAlg,
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
});
