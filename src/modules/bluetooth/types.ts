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
