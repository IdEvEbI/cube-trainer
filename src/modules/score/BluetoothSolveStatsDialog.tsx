import { formatElapsed } from "../timer/timer.ts";
import {
  formatPauseRate,
  formatShare,
  formatTps,
  type BluetoothSolveStats,
} from "./bluetoothSolveStats.ts";
import "./bluetoothSolveStats.css";

export function BluetoothSolveStatsDialog({
  stats,
  onConfirm,
}: {
  stats: BluetoothSolveStats;
  onConfirm: () => void;
}) {
  const { overview, phases } = stats;
  return (
    <div
      className="bt-solve-stats"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bt-solve-stats-title"
    >
      <div className="bt-solve-stats-card">
        <p id="bt-solve-stats-title" className="bt-solve-stats-heading">
          本次成绩
        </p>
        <p className="bt-solve-stats-time">{formatElapsed(overview.timeMs)}</p>

        <section className="bt-solve-stats-section" aria-label="总览">
          <h2 className="bt-solve-stats-section-title">总览</h2>
          <dl className="bt-solve-stats-overview">
            <div>
              <dt>步数</dt>
              <dd>{overview.moves}</dd>
            </div>
            <div>
              <dt>TPS</dt>
              <dd>{formatTps(overview.tps)}</dd>
            </div>
            <div>
              <dt>转体</dt>
              <dd>{overview.rotations}</dd>
            </div>
            <div>
              <dt>停顿率</dt>
              <dd>{formatPauseRate(overview.pauseRate)}</dd>
            </div>
          </dl>
        </section>

        <section className="bt-solve-stats-section" aria-label="分段">
          <h2 className="bt-solve-stats-section-title">分段</h2>
          <div className="bt-solve-stats-table-wrap">
            <table className="bt-solve-stats-table">
              <thead>
                <tr>
                  <th scope="col">阶段</th>
                  <th scope="col">时间</th>
                  <th scope="col">占比</th>
                  <th scope="col">步数</th>
                  <th scope="col">转体</th>
                  <th scope="col">TPS</th>
                  <th scope="col">停顿</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((phase) => (
                  <tr key={phase.id}>
                    <th scope="row">{phase.label}</th>
                    <td>{formatElapsed(phase.timeMs)}</td>
                    <td>{formatShare(phase.timeShare)}</td>
                    <td>{phase.moves}</td>
                    <td>{phase.rotations}</td>
                    <td>{formatTps(phase.tps)}</td>
                    <td>{formatPauseRate(phase.pauseRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <button
          type="button"
          className="bt-solve-stats-confirm"
          onClick={onConfirm}
        >
          确认
        </button>
      </div>
    </div>
  );
}
