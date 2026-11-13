import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCaptureRow,
  captureRowsToMarkdown,
  gyroChanged,
  lastMoveBurst,
  LAYER_CAPTURE_LABELS,
  loadCaptureRowsFromStorage,
  missingCaptureLabels,
  movesSignature,
  removeCaptureRow,
  upsertCaptureRow,
  validateCaptureRow,
} from "./layerCapture.ts";

describe("layerCapture", () => {
  it("标签覆盖宽层/中层及逆双步（36）", () => {
    assert.equal(LAYER_CAPTURE_LABELS.length, 36);
    assert.ok(LAYER_CAPTURE_LABELS.includes("M'"));
    assert.ok(LAYER_CAPTURE_LABELS.includes("M'2"));
    assert.ok(LAYER_CAPTURE_LABELS.includes("r'2"));
    assert.ok(LAYER_CAPTURE_LABELS.includes("d'"));
  });

  it("lastMoveBurst 按间隔切开，只留最后一段", () => {
    assert.deepEqual(
      lastMoveBurst(
        [
          { move: "L", intervalMs: 0 },
          { move: "R'", intervalMs: 80 },
          { move: "U", intervalMs: 900 },
          { move: "U'", intervalMs: 70 },
        ],
        400,
      ),
      [
        { move: "U", intervalMs: 900 },
        { move: "U'", intervalMs: 70 },
      ],
    );
  });

  it("buildCaptureRow 记录整段包与相对陀螺 Δ（不按 gap 裁切）", () => {
    const row = buildCaptureRow({
      label: "b2",
      samples: [
        { move: "F", intervalMs: 0 },
        { move: "F", intervalMs: 900 },
      ],
      gyroBefore: "",
      gyroAfter: "z2",
      gyroDelta: "z2 y'",
      recordedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(movesSignature(row.moves), "F F");
    assert.deepEqual(row.intervalsMs, [0, 900]);
    assert.equal(row.gyroDelta, "z2 y'");
    assert.equal(row.gyroChanged, true);
    assert.equal(gyroChanged("", "z'"), true);
  });

  it("validate：无包或全无陀螺则拒绝", () => {
    const emptyMoves = buildCaptureRow({
      label: "M",
      samples: [],
      gyroBefore: "",
      gyroAfter: "x",
      gyroDelta: "x",
    });
    assert.match(validateCaptureRow(emptyMoves) ?? "", /转动包/);
    const noGyro = buildCaptureRow({
      label: "r",
      samples: [{ move: "L", intervalMs: 0 }],
      gyroBefore: "",
      gyroAfter: "",
      gyroDelta: "",
    });
    assert.match(validateCaptureRow(noGyro) ?? "", /陀螺仪/);
    const ok = buildCaptureRow({
      label: "r",
      samples: [{ move: "L", intervalMs: 0 }],
      gyroBefore: "",
      gyroAfter: "x'",
      gyroDelta: "x'",
    });
    assert.equal(validateCaptureRow(ok), null);
  });

  it("missingCaptureLabels 按有效包统计覆盖", () => {
    assert.equal(missingCaptureLabels([]).length, 36);
    const one = buildCaptureRow({
      label: "M",
      samples: [
        { move: "R", intervalMs: 0 },
        { move: "L'", intervalMs: 10 },
      ],
      gyroBefore: "",
      gyroAfter: "x",
      gyroDelta: "x",
    });
    const missing = missingCaptureLabels([one]);
    assert.equal(missing.length, 35);
    assert.ok(!missing.includes("M"));
    assert.ok(missing.includes("M'"));
    assert.ok(missing.includes("M'2"));
  });

  it("removeCaptureRow 按 recordedAt 删一条", () => {
    const a = buildCaptureRow({
      label: "r",
      samples: [{ move: "L", intervalMs: 0 }],
      gyroBefore: "",
      gyroAfter: "x'",
      gyroDelta: "x'",
      recordedAt: "t1",
    });
    const b = buildCaptureRow({
      label: "r",
      samples: [{ move: "L", intervalMs: 0 }],
      gyroBefore: "",
      gyroAfter: "x'",
      gyroDelta: "x'",
      recordedAt: "t2",
    });
    const next = removeCaptureRow([a, b], "t1");
    assert.equal(next.length, 1);
    assert.equal(next[0]!.recordedAt, "t2");
  });

  it("upsert 追加；storage 往返含 gyroDelta；markdown 含 Δ 列", () => {
    const a = buildCaptureRow({
      label: "r",
      samples: [{ move: "L", intervalMs: 0 }],
      gyroBefore: "",
      gyroAfter: "x'",
      gyroDelta: "x'",
      recordedAt: "t1",
    });
    const b = buildCaptureRow({
      label: "r",
      samples: [{ move: "L", intervalMs: 0 }],
      gyroBefore: "",
      gyroAfter: "z2 y2",
      gyroDelta: "z2 y2",
      recordedAt: "t2",
    });
    const rows = upsertCaptureRow(upsertCaptureRow([], a), b);
    assert.equal(rows.length, 2);
    const loaded = loadCaptureRowsFromStorage(JSON.stringify(rows));
    assert.equal(loaded.length, 2);
    assert.equal(loaded[1]!.gyroDelta, "z2 y2");
    assert.match(captureRowsToMarkdown(rows), /gyroDelta/);
  });
});
