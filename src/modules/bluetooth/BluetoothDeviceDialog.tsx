import { useEffect, useState, type FormEvent } from "react";
import "./bluetoothDeviceDialog.css";

export function BluetoothDeviceDialog({
  alias,
  rawName,
  onSaveAlias,
  onDisconnect,
  onClose,
}: {
  alias: string;
  rawName: string;
  onSaveAlias: (alias: string) => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(alias);

  useEffect(() => {
    setDraft(alias);
  }, [alias]);

  function save(event: FormEvent) {
    event.preventDefault();
    onSaveAlias(draft);
    onClose();
  }

  return (
    <div
      className="bt-device-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bt-device-dialog-title"
      onClick={onClose}
    >
      <div
        className="bt-device-dialog-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="bt-device-dialog-title" className="bt-device-dialog-title">
          蓝牙魔方
        </h2>
        <p className="bt-device-dialog-raw" title={rawName}>
          设备：{rawName}
        </p>
        <form className="bt-device-dialog-form" onSubmit={save}>
          <label className="bt-device-dialog-label" htmlFor="bt-device-alias">
            本地别名
          </label>
          <input
            id="bt-device-alias"
            className="bt-device-dialog-input"
            type="text"
            value={draft}
            placeholder="未设置则显示原始名称"
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="bt-device-dialog-save">
            保存别名
          </button>
        </form>
        <div className="bt-device-dialog-actions">
          <button
            type="button"
            className="bt-device-dialog-disconnect"
            onClick={onDisconnect}
          >
            断开
          </button>
          <button
            type="button"
            className="bt-device-dialog-close"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
