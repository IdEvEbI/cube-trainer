import { useEffect, useMemo, useRef, useState } from "react";
import { relativeOrientationAlg } from "../../game/guideOrientation.ts";
import { nearestCubeOrientationAlg } from "../../score/cubeOrientation.ts";
import type { MoyuMoveSample, MoyuQuat } from "./index.ts";
import {
  buildCaptureRow,
  captureRowsToJson,
  captureRowsToMarkdown,
  LAYER_CAPTURE_BURST_GAP_MS,
  LAYER_CAPTURE_LABELS,
  LAYER_CAPTURE_STORAGE_KEY,
  loadCaptureRowsFromStorage,
  missingCaptureLabels,
  movesSignature,
  removeCaptureRow,
  validateCaptureRow,
  type LayerCaptureLabel,
  type LayerCaptureMoveSample,
  type LayerCaptureRow,
  upsertCaptureRow,
} from "./layerCapture.ts";
import "./layerCapturePage.css";

export type LayerCapturePageProps = {
  connected: boolean;
  liveQuat: MoyuQuat | null;
  onBack: () => void;
  /** App 把蓝牙转动转发到这里。 */
  registerMovesSink: (
    sink: ((samples: readonly MoyuMoveSample[]) => void) | null,
  ) => void;
};

type Phase = "idle" | "armed" | "recording";

function readStoredRows(): LayerCaptureRow[] {
  try {
    return loadCaptureRowsFromStorage(
      localStorage.getItem(LAYER_CAPTURE_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

function writeStoredRows(rows: readonly LayerCaptureRow[]): void {
  try {
    localStorage.setItem(LAYER_CAPTURE_STORAGE_KEY, captureRowsToJson(rows));
  } catch {
    // 忽略配额 / 隐私模式
  }
}

export function LayerCapturePage({
  connected,
  liveQuat,
  onBack,
  registerMovesSink,
}: LayerCapturePageProps) {
  const [label, setLabel] = useState<LayerCaptureLabel>("M");
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveMoves, setLiveMoves] = useState<LayerCaptureMoveSample[]>([]);
  const [rows, setRows] = useState<LayerCaptureRow[]>(() => readStoredRows());
  const [note, setNote] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const liveMovesRef = useRef(liveMoves);
  liveMovesRef.current = liveMoves;
  const gyroBeforeAlgRef = useRef("");
  const gyroBeforeQuatRef = useRef<MoyuQuat | null>(null);
  const quietTimerRef = useRef(0);

  const liveGyroAlg = useMemo(
    () => (liveQuat ? nearestCubeOrientationAlg(liveQuat) : ""),
    [liveQuat],
  );

  const missing = useMemo(() => missingCaptureLabels(rows), [rows]);
  const coveredCount = LAYER_CAPTURE_LABELS.length - missing.length;

  useEffect(() => {
    registerMovesSink((samples) => {
      if (phaseRef.current !== "recording" && phaseRef.current !== "armed") {
        return;
      }
      if (phaseRef.current === "armed") {
        setPhase("recording");
        phaseRef.current = "recording";
      }
      setLiveMoves((prev) => {
        const next = [
          ...prev,
          ...samples.map((sample) => ({
            move: sample.move,
            intervalMs: sample.intervalMs,
          })),
        ];
        liveMovesRef.current = next;
        return next;
      });
      window.clearTimeout(quietTimerRef.current);
      quietTimerRef.current = window.setTimeout(() => {
        setNote("已静音，可点「保存本段」；或继续拧。");
      }, LAYER_CAPTURE_BURST_GAP_MS);
    });
    return () => {
      registerMovesSink(null);
      window.clearTimeout(quietTimerRef.current);
    };
  }, [registerMovesSink]);

  function armRecording() {
    if (!connected) {
      setNote("请先连接魔方");
      return;
    }
    if (!liveQuat) {
      setNote("尚无陀螺仪数据，请稍候或点首页「对齐朝向」后再采");
      return;
    }
    gyroBeforeAlgRef.current = liveGyroAlg;
    gyroBeforeQuatRef.current = liveQuat;
    setLiveMoves([]);
    liveMovesRef.current = [];
    setPhase("armed");
    setNote(`已武装：请拧 ${label}（陀螺仪起点 ${liveGyroAlg || "单位"}）`);
  }

  function saveRow() {
    if (phase === "idle") {
      setNote("请先点「开始记录」再拧");
      return;
    }
    if (!liveQuat || !gyroBeforeQuatRef.current) {
      setNote("缺少陀螺仪四元数，本段未保存");
      return;
    }
    const afterAlg = liveGyroAlg;
    const delta = relativeOrientationAlg(gyroBeforeQuatRef.current, liveQuat);
    const row = buildCaptureRow({
      label,
      samples: liveMovesRef.current,
      gyroBefore: gyroBeforeAlgRef.current,
      gyroAfter: afterAlg,
      gyroDelta: delta,
    });
    const invalid = validateCaptureRow(row);
    if (invalid) {
      setNote(invalid);
      return;
    }
    const next = upsertCaptureRow(rows, row);
    setRows(next);
    writeStoredRows(next);
    setPhase("idle");
    setLiveMoves([]);
    liveMovesRef.current = [];
    gyroBeforeQuatRef.current = null;
    setNote(
      `已保存 ${row.label} → [${movesSignature(row.moves)}] Δ=${row.gyroDelta || "单位"}`,
    );
  }

  function cancelRecording() {
    setPhase("idle");
    setLiveMoves([]);
    liveMovesRef.current = [];
    gyroBeforeQuatRef.current = null;
    setNote("已取消本段");
  }

  function clearRows() {
    setRows([]);
    writeStoredRows([]);
    setNote("已清空本地表");
  }

  function deleteRow(recordedAt: string) {
    const next = removeCaptureRow(rows, recordedAt);
    if (next.length === rows.length) {
      setNote("未找到该条记录");
      return;
    }
    setRows(next);
    writeStoredRows(next);
    setNote("已删除一条");
  }

  async function copyMarkdown() {
    const text = captureRowsToMarkdown(rows);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1200);
      setNote("已复制 Markdown 表");
    } catch {
      setNote("复制失败，请手动选中下方 JSON");
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(captureRowsToJson(rows));
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1200);
      setNote("已复制 JSON");
    } catch {
      setNote("复制失败");
    }
  }

  return (
    <section className="layer-capture" aria-label="魔域层转采集">
      <header className="layer-capture-bar">
        <button
          type="button"
          className="nav-back nav-back-icon"
          onClick={onBack}
        >
          返回
        </button>
        <h1 className="layer-capture-title">魔域层转采集（临时）</h1>
      </header>

      <p className="layer-capture-lead">
        选记号 → 开始记录 → 拧对应层 → 保存。每条必须含转动包与相对陀螺 Δ。
        {connected ? " 已连接。" : " 未连接，请先回首页连接魔方。"}
      </p>

      <p className="layer-capture-coverage" aria-live="polite">
        覆盖 {coveredCount}/{LAYER_CAPTURE_LABELS.length}
        {missing.length > 0
          ? ` · 缺：${missing.join(" ")}`
          : " · 记号已齐（可同记号多采复核）"}
      </p>

      <div className="layer-capture-status" aria-live="polite">
        <span>阶段：{phase}</span>
        <span>陀螺仪：{liveGyroAlg || "（无数据）"}</span>
        <span>本段：{movesSignature(liveMoves.map((m) => m.move)) || "—"}</span>
      </div>

      <div className="layer-capture-labels" role="list">
        {LAYER_CAPTURE_LABELS.map((item) => (
          <button
            key={item}
            type="button"
            role="listitem"
            className={
              item === label
                ? "layer-capture-chip is-selected"
                : "layer-capture-chip"
            }
            onClick={() => setLabel(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="layer-capture-actions">
        <button
          type="button"
          className="layer-capture-primary"
          disabled={!connected || phase === "recording" || !liveQuat}
          onClick={armRecording}
        >
          开始记录 {label}
        </button>
        <button
          type="button"
          className="layer-capture-primary"
          disabled={phase === "idle"}
          onClick={saveRow}
        >
          保存本段
        </button>
        <button
          type="button"
          disabled={phase === "idle"}
          onClick={cancelRecording}
        >
          取消
        </button>
        <button type="button" onClick={copyMarkdown}>
          {copyFlash ? "已复制" : "复制 Markdown"}
        </button>
        <button type="button" onClick={copyJson}>
          复制 JSON
        </button>
        <button type="button" onClick={clearRows}>
          清空表
        </button>
      </div>

      {note ? <p className="layer-capture-note">{note}</p> : null}

      <div className="layer-capture-table-wrap">
        <table className="layer-capture-table">
          <thead>
            <tr>
              <th>label</th>
              <th>moves</th>
              <th>before</th>
              <th>after</th>
              <th>Δ</th>
              <th>changed</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>尚无记录</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.label}-${row.recordedAt}`}>
                  <td>{row.label}</td>
                  <td>{movesSignature(row.moves) || "（无）"}</td>
                  <td>{row.gyroBefore || "（单位）"}</td>
                  <td>{row.gyroAfter || "（单位）"}</td>
                  <td>{row.gyroDelta || "（无）"}</td>
                  <td>{row.gyroChanged ? "是" : "否"}</td>
                  <td>
                    <button
                      type="button"
                      className="layer-capture-row-delete"
                      onClick={() => deleteRow(row.recordedAt)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
