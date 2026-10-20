export type Clock = () => number;

export interface Timer {
  start(): void;
  stop(): void;
  reset(): void;
  current(): number;
}
