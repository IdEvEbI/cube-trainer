import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coalesceWideMoves } from "./coalesceWideMoves.ts";

describe("coalesceWideMoves", () => {
  it("merges true wide pairs either order", () => {
    assert.deepEqual(coalesceWideMoves(["U", "E'"]), ["u"]);
    assert.deepEqual(coalesceWideMoves(["E'", "U"]), ["u"]);
    assert.deepEqual(coalesceWideMoves(["U'", "E"]), ["u'"]);
    assert.deepEqual(coalesceWideMoves(["D'", "E'"]), ["d'"]);
    assert.deepEqual(coalesceWideMoves(["R", "M'"]), ["r"]);
  });

  it("does not merge U' E' into u'", () => {
    assert.deepEqual(coalesceWideMoves(["U'", "E'"]), ["U'", "E'"]);
  });

  it("keeps surrounding moves", () => {
    assert.deepEqual(coalesceWideMoves(["z2", "U'", "E", "L'"]), [
      "z2",
      "u'",
      "L'",
    ]);
  });
});
