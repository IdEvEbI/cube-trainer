import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import {
  conjugateScrambleForYellowUp,
  conjugateTokenByZ2,
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

describe("solveCfopGame", () => {
  it("z2 并入 Cross；Cross 无宽层/中层；整串到黄上复原", async () => {
    const scramble = "R U2 F' L D B2 R' U F2 D' L2 B R2 U' F D2 B' L U2 R'";
    const phases = await solveCfopGame(scramble);
    assert.equal(phases[0]?.id, "Cross");
    assert.equal(phases[0]?.moves[0], "z2");
    assert.ok(
      phases[0]!.moves.every(
        (token) => !/^[udlrfbMES](?:2'|2|')?$/.test(token),
      ),
    );
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
});
