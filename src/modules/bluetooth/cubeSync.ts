/**
 * 蓝牙 3D 与实体对表：用连接时 setup + 此后转动拼绝对展示算法。
 */

/** 连接 setup + 此后实体转动 → 当前绝对展示算法（白上绿前）。 */
export function bluetoothCubeAbsoluteAlg(
  setupAlg: string,
  stateMoves: readonly string[],
): string {
  return [setupAlg, ...stateMoves]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/** 蓝牙放弃回首页时应重绘 3D 并跟实体，不得复位为复原态。 */
export function shouldSyncCubeAfterBluetoothAbandon(
  bluetoothConnected: boolean,
): boolean {
  return bluetoothConnected;
}
