import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSolveTraceSession,
  remapFaceMoveThroughOrientation,
  SOLVE_TRACE_VERSION,
} from "./solveTrace.ts";

describe("remapFaceMoveThroughOrientation", () => {
  it("无转体时保持面转", () => {
    assert.equal(remapFaceMoveThroughOrientation("R'", []), "R'");
    assert.equal(remapFaceMoveThroughOrientation("U2", []), "U2");
  });

  it("y 之后握持 R 映到开表朝向的 F", () => {
    assert.equal(remapFaceMoveThroughOrientation("R", ["y"]), "F");
    assert.equal(remapFaceMoveThroughOrientation("R'", ["y"]), "F'");
  });

  it("y' 之后握持 R 映到开表朝向的 B", () => {
    assert.equal(remapFaceMoveThroughOrientation("R", ["y'"]), "B");
  });
});

describe("createSolveTraceSession", () => {
  it("保存打乱与 setup，并按时刻记录面转", () => {
    const session = createSolveTraceSession({
      scramble: "R U R' U'",
      startSetupAlg: "R U R' U'",
      nowMs: () => 0,
    });
    session.appendAt("R", 100);
    session.appendAt("U'", 250);
    const trace = session.snapshot();
    assert.equal(trace.version, SOLVE_TRACE_VERSION);
    assert.equal(trace.scramble, "R U R' U'");
    assert.equal(trace.startSetupAlg, "R U R' U'");
    assert.equal(trace.steps.length, 2);
    assert.deepEqual(trace.steps[0], {
      move: "R",
      rawMove: "R",
      atMs: 100,
      kind: "face",
      orientationAfter: "",
    });
    assert.deepEqual(trace.steps[1], {
      move: "U'",
      rawMove: "U'",
      atMs: 250,
      kind: "face",
      orientationAfter: "",
    });
  });

  it("转体写入序列并更新朝向；后续面转按朝向转换", () => {
    const session = createSolveTraceSession({
      scramble: "U",
      startSetupAlg: "",
    });
    const y = session.appendAt("y", 50);
    assert.equal(y.kind, "rotation");
    assert.equal(y.move, "y");
    assert.equal(y.orientationAfter, "y");
    assert.equal(session.orientationAlg(), "y");

    const face = session.appendAt("R", 120);
    assert.equal(face.kind, "face");
    assert.equal(face.rawMove, "R");
    assert.equal(face.move, "F");
    assert.equal(face.orientationAfter, "y");
  });

  it("连续转体累积；toTimedMoves 用转换后的 move", () => {
    const session = createSolveTraceSession({
      scramble: "F",
      startSetupAlg: "x",
    });
    session.appendAt("y", 10);
    session.appendAt("x", 20);
    session.appendAt("U", 30);
    const timed = session.toTimedMoves();
    assert.deepEqual(
      timed.map((step) => step.move),
      ["y", "x", session.snapshot().steps[2]!.move],
    );
    assert.equal(timed[2]!.atMs, 30);
    assert.equal(session.orientationAlg(), "y x");
  });

  it("remapFace:false 时面转保持色心绝对记号", () => {
    const session = createSolveTraceSession({
      scramble: "U",
      startSetupAlg: "",
    });
    session.appendAt("y", 50);
    const face = session.appendAt("R", 120, { remapFace: false });
    assert.equal(face.move, "R");
    assert.equal(face.rawMove, "R");
    assert.equal(face.orientationAfter, "y");
  });

  it("拒绝无法识别的记号", () => {
    const session = createSolveTraceSession({ scramble: "" });
    assert.throws(() => session.append("M"), /无法识别/);
  });
});
