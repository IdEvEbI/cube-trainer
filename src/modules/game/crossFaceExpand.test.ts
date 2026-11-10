import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cube3x3x3 } from "cubing/puzzles";
import { patternsMatchIgnoringCenters } from "./algStateMatch.ts";
import {
  expandCrossPhaseToFaceMoves,
  expandMovesToFixedCenterFaces,
} from "./crossFaceExpand.ts";

describe("expandMovesToFixedCenterFaces", () => {
  it("把宽层 / 中层拆成面转，且固定色心下与原 Cross 同态", async () => {
    const scramble = "D' B' U' L F' U2 L' D2 U L' D' B2 F2 L B' U' L R' B2 R";
    const original = ["z2", "L2", "b'", "L'", "u'", "r'", "u"];
    const expanded = await expandMovesToFixedCenterFaces(scramble, original);
    assert.equal(expanded[0], "z2");
    assert.ok(
      expanded.every((token) =>
        /^([xyz](?:2'|2|')?|[UDLRFB](?:2'|2|')?)$/.test(token),
      ),
    );
    assert.ok(!expanded.some((token) => /^[udlrfbMES]/.test(token)));

    const puzzle = await cube3x3x3.kpuzzle();
    const id = puzzle.defaultPattern();
    assert.equal(
      patternsMatchIgnoringCenters(
        id.applyAlg(scramble).applyAlg(original.join(" ")),
        id.applyAlg(scramble).applyAlg(expanded.join(" ")),
      ),
      true,
    );
  });

  it("含 M 的短串也能展开", async () => {
    const expanded = await expandMovesToFixedCenterFaces("R U F'", [
      "z2",
      "M",
      "U",
    ]);
    assert.ok(expanded.every((token) => !/^[udlrfbMES]/.test(token)));
    assert.equal(expanded[0], "z2");
  });
});

describe("expandCrossPhaseToFaceMoves", () => {
  it("只改 Cross，其它段不动", async () => {
    const scramble = "R U F'";
    const phases = await expandCrossPhaseToFaceMoves(scramble, [
      { id: "Cross", moves: ["z2", "M", "U"] },
      { id: "F2L1", moves: ["r", "U"] },
    ]);
    assert.equal(phases[0]?.id, "Cross");
    assert.ok(phases[0]!.moves.every((token) => !/^[udlrfbMES]/.test(token)));
    assert.deepEqual(phases[1]?.moves, ["r", "U"]);
  });
});
