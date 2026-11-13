/**
 * 魔域层转采集：宽层 / 中层 → 转动包序列 + 相对陀螺。
 * 每个记号都应同时具备非空 moves 与可解释的 gyroBefore/After/Delta。
 */

/** 含逆双步（`r'2` / `M'2`）：公式等价 180°，但拧法方向不同，包/陀螺可能不同。 */
export const LAYER_CAPTURE_LABELS = [
  "r",
  "r'",
  "r2",
  "r'2",
  "l",
  "l'",
  "l2",
  "l'2",
  "f",
  "f'",
  "f2",
  "f'2",
  "b",
  "b'",
  "b2",
  "b'2",
  "u",
  "u'",
  "u2",
  "u'2",
  "d",
  "d'",
  "d2",
  "d'2",
  "M",
  "M'",
  "M2",
  "M'2",
  "E",
  "E'",
  "E2",
  "E'2",
  "S",
  "S'",
  "S2",
  "S'2",
] as const;

export type LayerCaptureLabel = (typeof LAYER_CAPTURE_LABELS)[number];

export type LayerCaptureMoveSample = {
  move: string;
  intervalMs: number;
};

export type LayerCaptureRow = {
  label: LayerCaptureLabel;
  /** 本段手势内的转动包序列（外层记号）。 */
  moves: string[];
  intervalsMs: number[];
  /** 武装时吸附朝向（24 朝向公式）。 */
  gyroBefore: string;
  /** 保存时吸附朝向。 */
  gyroAfter: string;
  /**
   * 相对增量吸附（live ⊗ before⁻¹ → 24 朝向）。
   * 匹配宽层/中层应以本字段为准，不要只看 gyroChanged。
   */
  gyroDelta: string;
  /** 前后吸附串是否不同（粗信号；宽层/中层真机多为 true）。 */
  gyroChanged: boolean;
  recordedAt: string;
};

/** 超过此时无新转动，视为一手势结束（毫秒）。 */
export const LAYER_CAPTURE_BURST_GAP_MS = 400;

export function isLayerCaptureLabel(value: string): value is LayerCaptureLabel {
  return (LAYER_CAPTURE_LABELS as readonly string[]).includes(value);
}

export function movesSignature(moves: readonly string[]): string {
  return moves
    .map((move) => move.trim())
    .filter(Boolean)
    .join(" ");
}

export function gyroChanged(beforeAlg: string, afterAlg: string): boolean {
  return beforeAlg.trim() !== afterAlg.trim();
}

/**
 * 把连续转动收成一手势：相邻步 interval 超过 gap 则切开。
 * 返回最后一段；空输入得空数组。
 * 采集页武装后缓冲已清空，保存应走整段 samples，不要用本函数裁切
 * （慢拧 `*2` 两包间隔常 >400ms，裁切会导致「本段 F F / 表里只有 F」）。
 */
export function lastMoveBurst(
  samples: readonly LayerCaptureMoveSample[],
  gapMs: number = LAYER_CAPTURE_BURST_GAP_MS,
): LayerCaptureMoveSample[] {
  if (samples.length === 0) {
    return [];
  }
  let start = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const gap = samples[i]!.intervalMs;
    if (gap > gapMs) {
      start = i;
    }
  }
  return samples.slice(start);
}

export function buildCaptureRow(input: {
  label: LayerCaptureLabel;
  /** 武装后本段全部转动包（不再按 gap 裁成最后一手势）。 */
  samples: readonly LayerCaptureMoveSample[];
  gyroBefore: string;
  gyroAfter: string;
  /** 相对增量；缺省时用空串（旧数据 / 无四元数时）。 */
  gyroDelta?: string;
  recordedAt?: string;
}): LayerCaptureRow {
  const before = input.gyroBefore.trim();
  const after = input.gyroAfter.trim();
  return {
    label: input.label,
    moves: input.samples.map((sample) => sample.move),
    intervalsMs: input.samples.map((sample) => sample.intervalMs),
    gyroBefore: before,
    gyroAfter: after,
    gyroDelta: (input.gyroDelta ?? "").trim(),
    gyroChanged: gyroChanged(before, after),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}

/** 保存前校验：必须有转动包；建议有陀螺相对量。 */
export function validateCaptureRow(row: LayerCaptureRow): string | null {
  if (row.moves.length === 0) {
    return "本段没有转动包，请拧后再保存";
  }
  if (!row.gyroDelta && !row.gyroBefore && !row.gyroAfter) {
    return "没有陀螺仪朝向，请确认已连接并收到姿态流后再保存";
  }
  return null;
}

/** 尚未出现过的记号（每记号至少一条有效包记录）。 */
export function missingCaptureLabels(
  rows: readonly LayerCaptureRow[],
): LayerCaptureLabel[] {
  const seen = new Set(
    rows.filter((row) => row.moves.length > 0).map((row) => row.label),
  );
  return LAYER_CAPTURE_LABELS.filter((label) => !seen.has(label));
}

/** 同 label 多条时保留全部，便于看固件是否稳定。 */
export function upsertCaptureRow(
  rows: readonly LayerCaptureRow[],
  next: LayerCaptureRow,
): LayerCaptureRow[] {
  return [...rows, next];
}

/** 按 recordedAt 删一条（拧错时可去掉）。 */
export function removeCaptureRow(
  rows: readonly LayerCaptureRow[],
  recordedAt: string,
): LayerCaptureRow[] {
  const key = recordedAt.trim();
  if (!key) {
    return [...rows];
  }
  return rows.filter((row) => row.recordedAt !== key);
}

export function captureRowsToJson(rows: readonly LayerCaptureRow[]): string {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

/** 便于贴进笔记的 Markdown 表。 */
export function captureRowsToMarkdown(
  rows: readonly LayerCaptureRow[],
): string {
  const header =
    "| label | moves | gyroBefore | gyroAfter | gyroDelta | gyroChanged |\n| --- | --- | --- | --- | --- | --- |";
  if (rows.length === 0) {
    return `${header}\n`;
  }
  const body = rows
    .map((row) => {
      const moves = movesSignature(row.moves) || "（无转动包）";
      const before = row.gyroBefore || "（单位）";
      const after = row.gyroAfter || "（单位）";
      const delta = row.gyroDelta || "（无）";
      return `| ${row.label} | ${moves} | ${before} | ${after} | ${delta} | ${row.gyroChanged} |`;
    })
    .join("\n");
  return `${header}\n${body}\n`;
}

export const LAYER_CAPTURE_STORAGE_KEY = "cube-trainer.moyu-layer-capture.v1";

export function loadCaptureRowsFromStorage(
  raw: string | null,
): LayerCaptureRow[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const rows: LayerCaptureRow[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as Partial<LayerCaptureRow>;
      if (!row.label || !isLayerCaptureLabel(row.label)) {
        continue;
      }
      if (!Array.isArray(row.moves) || !Array.isArray(row.intervalsMs)) {
        continue;
      }
      rows.push({
        label: row.label,
        moves: row.moves.map(String),
        intervalsMs: row.intervalsMs.map((n) => Number(n) || 0),
        gyroBefore: String(row.gyroBefore ?? ""),
        gyroAfter: String(row.gyroAfter ?? ""),
        gyroDelta: String(row.gyroDelta ?? ""),
        gyroChanged: Boolean(row.gyroChanged),
        recordedAt: String(row.recordedAt ?? ""),
      });
    }
    return rows;
  } catch {
    return [];
  }
}
