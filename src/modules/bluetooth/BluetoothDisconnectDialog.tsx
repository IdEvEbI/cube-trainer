import "./bluetoothDisconnectDialog.css";

/** 已连接时点绿色蓝牙图标：确认是否断开。 */
export function BluetoothDisconnectDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="bt-disconnect-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bt-disconnect-dialog-title"
      onClick={onCancel}
    >
      <div
        className="bt-disconnect-dialog-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="bt-disconnect-dialog-title"
          className="bt-disconnect-dialog-title"
        >
          断开魔方连接？
        </h2>
        <p className="bt-disconnect-dialog-copy">确认后将断开当前蓝牙魔方。</p>
        <div className="bt-disconnect-dialog-actions">
          <button
            type="button"
            className="bt-disconnect-dialog-confirm"
            onClick={onConfirm}
          >
            断开
          </button>
          <button
            type="button"
            className="bt-disconnect-dialog-cancel"
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
