export interface CubeMoveEvent {
  move: string;
  timestamp: number;
}

export interface BluetoothCube {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onMove(cb: (e: CubeMoveEvent) => void): () => void;
  getName(): string | undefined;
}

/** 魔域明文协议解析见 `./moyu/`（不依赖实时 BLE）。 */
