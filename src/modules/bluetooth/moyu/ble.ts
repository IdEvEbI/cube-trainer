/** 魔域 WCU_MY32 GATT：连接、加密收发、请求状态与陀螺仪。 */

import { MOYU_MSG, type MoyuMove } from "./constants.ts";
import {
  decryptMoyuPacket,
  deriveMoyuKeyIv,
  encryptMoyuPacket,
  macFromMoyuDeviceName,
  parseMacAddress,
  type MoyuKeyIv,
} from "./crypto.ts";
import { takeNewMoves } from "./moves.ts";
import type { MoyuQuat } from "./orientation.ts";
import { emptyPacket, parseMoyuPacket, requestGyroControl } from "./packets.ts";
import { faceletsToSetupAlg } from "./pattern.ts";

export const MOYU_GATT = {
  service: "0783b03e-7735-b5a0-1760-a305d2795cb0",
  notify: "0783b03e-7735-b5a0-1760-a305d2795cb1",
  write: "0783b03e-7735-b5a0-1760-a305d2795cb2",
} as const;

/** 广播名前缀（csTimer / Weilong V10 AI 等）。 */
export const MOYU_NAME_PREFIX = "WCU_MY3";

export type MoyuBleRequestDeviceOptions = {
  filters: Array<{ namePrefix: string }>;
  optionalServices: string[];
};

export function moyuRequestDeviceOptions(): MoyuBleRequestDeviceOptions {
  return {
    filters: [{ namePrefix: MOYU_NAME_PREFIX }],
    optionalServices: [MOYU_GATT.service],
  };
}

export type MoyuBluetoothRequestApi = {
  requestDevice(
    options: MoyuBleRequestDeviceOptions,
  ): Promise<MoyuBleDeviceLike>;
};

export type MoyuBleDeviceLike = {
  name?: string | null;
  gatt?: MoyuBleGattLike | null;
  addEventListener?(type: "gattserverdisconnected", listener: () => void): void;
  removeEventListener?(
    type: "gattserverdisconnected",
    listener: () => void,
  ): void;
};

export type MoyuBleGattLike = {
  connected: boolean;
  connect(): Promise<MoyuBleServerLike>;
  disconnect(): void;
};

export type MoyuBleServerLike = {
  getPrimaryService(service: string): Promise<MoyuBleServiceLike>;
  disconnect(): void;
};

export type MoyuBleCharacteristicLike = {
  startNotifications(): Promise<unknown>;
  stopNotifications?(): Promise<unknown>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
  writeValue?(data: BufferSource): Promise<void>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: "characteristicvaluechanged",
    listener: (event: Event) => void,
  ): void;
};

export type MoyuBleServiceLike = {
  getCharacteristic(uuid: string): Promise<MoyuBleCharacteristicLike>;
};

function browserBluetoothApi(): MoyuBluetoothRequestApi | undefined {
  if (typeof globalThis.navigator === "undefined") {
    return undefined;
  }
  const nav = globalThis.navigator as Navigator & {
    bluetooth?: MoyuBluetoothRequestApi;
  };
  return nav.bluetooth;
}

export function isWebBluetoothAvailable(
  bluetooth: unknown = browserBluetoothApi(),
): boolean {
  return Boolean(
    bluetooth &&
      typeof (bluetooth as { requestDevice?: unknown }).requestDevice ===
        "function",
  );
}

export function formatMoyuConnectedLabel(
  deviceName: string | undefined,
): string {
  const name = deviceName?.trim();
  return name ? `已连接 · ${name}` : "已连接";
}

export function formatMoyuConnectError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotFoundError") {
      return "未选择魔方，或附近没有魔域设备";
    }
    if (error.name === "SecurityError") {
      return "当前页面无法使用蓝牙（需 HTTPS 与支持 Web Bluetooth 的浏览器）";
    }
    if (error.name === "NetworkError" || error.name === "InvalidStateError") {
      return "蓝牙连接失败，请靠近魔方后重试";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "蓝牙连接失败";
}

export type MoyuCubeStatus = {
  facelets: string;
  /** 从复原到该状态的算法，可直接交给 TwistyPlayer。 */
  setupAlg: string;
  moveCounter: number;
};

export type MoyuBleConnection = {
  name: string;
  disconnect(): void;
  /** 写 A1 初始化后请求 A3，解密并解析为 facelets / setupAlg。 */
  requestStatus(): Promise<MoyuCubeStatus>;
  /** 开启陀螺仪上报（0xAC）；应在 requestStatus 之后调用。 */
  enableGyro(): Promise<void>;
  /** 关闭陀螺仪上报。 */
  disableGyro(): Promise<void>;
};

export type ConnectMoyuOptions = {
  bluetooth?: MoyuBluetoothRequestApi;
  onDisconnected?: () => void;
  /** 状态同步完成后，每次新转动按时间正序回调（可连续多步）。 */
  onMoves?: (moves: readonly MoyuMove[]) => void;
  /** 陀螺仪姿态（0xAB），连接并 enableGyro 后持续回调。 */
  onOrientation?: (quaternion: MoyuQuat) => void;
  /** 无法从设备名推断时询问 MAC（返回 `AA:BB:…`）。 */
  askMacAddress?: (
    deviceName: string,
  ) => string | null | Promise<string | null>;
  statusTimeoutMs?: number;
};

function bufferFromEvent(event: Event): Uint8Array {
  const target = event.target as {
    value?: DataView | null;
  } | null;
  const view = target?.value;
  if (!view) {
    throw new Error("空通知");
  }
  return new Uint8Array(
    view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
  );
}

async function writeCharacteristic(
  characteristic: MoyuBleCharacteristicLike,
  data: Uint8Array,
): Promise<void> {
  if (characteristic.writeValueWithoutResponse) {
    await characteristic.writeValueWithoutResponse(data);
    return;
  }
  if (characteristic.writeValue) {
    await characteristic.writeValue(data);
    return;
  }
  throw new Error("写特征不可用");
}

async function resolveMac(
  deviceName: string,
  askMacAddress?: ConnectMoyuOptions["askMacAddress"],
): Promise<Uint8Array> {
  const inferred = macFromMoyuDeviceName(deviceName);
  if (inferred) {
    return parseMacAddress(inferred);
  }
  const asked = askMacAddress ? await askMacAddress(deviceName) : null;
  if (!asked) {
    throw new Error("无法取得魔方 MAC，无法解密（设备名需为 WCU_MY32_XXXX）");
  }
  return parseMacAddress(asked);
}

/**
 * 扫描连接魔域魔方：GATT + 通知 + 密钥。
 * 连接后可用 {@link MoyuBleConnection.requestStatus} 拉一次状态。
 */
export async function connectMoyuCube(
  options: ConnectMoyuOptions = {},
): Promise<MoyuBleConnection> {
  const bluetooth = options.bluetooth ?? browserBluetoothApi();
  if (!isWebBluetoothAvailable(bluetooth) || !bluetooth) {
    throw new Error("当前浏览器不支持 Web Bluetooth（iPhone 请用 Bluefy）");
  }

  const device = await bluetooth.requestDevice(moyuRequestDeviceOptions());
  const gatt = device.gatt;
  if (!gatt) {
    throw new Error("设备不支持 GATT");
  }

  const server = await gatt.connect();
  let service: MoyuBleServiceLike;
  let notifyChar: MoyuBleCharacteristicLike;
  let writeChar: MoyuBleCharacteristicLike;
  try {
    service = await server.getPrimaryService(MOYU_GATT.service);
    notifyChar = await service.getCharacteristic(MOYU_GATT.notify);
    writeChar = await service.getCharacteristic(MOYU_GATT.write);
  } catch {
    server.disconnect();
    throw new Error("已连接设备，但未找到魔域读写特征");
  }

  const deviceName = device.name?.trim() || "魔域魔方";
  const mac = await resolveMac(deviceName, options.askMacAddress);
  const keyIv: MoyuKeyIv = deriveMoyuKeyIv(mac);

  type Pending = {
    resolve: (plain: Uint8Array) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  let pending: Pending | null = null;
  /** -1：尚未完成状态同步，忽略 A5。 */
  let prevMoveCnt = -1;

  const applyMoveMessage = (plain: Uint8Array) => {
    const parsed = parseMoyuPacket(plain);
    if (parsed.type !== "move") {
      return;
    }
    const { nextCounter, moves } = takeNewMoves(prevMoveCnt, parsed);
    if (moves.length === 0) {
      return;
    }
    prevMoveCnt = nextCounter;
    options.onMoves?.(moves);
  };

  const applyOrientation = (plain: Uint8Array): boolean => {
    const parsed = parseMoyuPacket(plain);
    if (parsed.type !== "gyro") {
      return false;
    }
    options.onOrientation?.(parsed.quaternion);
    return true;
  };

  const onNotify = (event: Event) => {
    void (async () => {
      try {
        const raw = bufferFromEvent(event);
        const plain = await decryptMoyuPacket(keyIv, raw);
        // 陀螺仪高频；绝不拿来结束 waitPlain，也不打断状态请求
        if (applyOrientation(plain)) {
          return;
        }
        if (pending) {
          const wait = pending;
          pending = null;
          clearTimeout(wait.timer);
          wait.resolve(plain);
          // 等待状态期间若夹带 A5，仍尝试记账（prev 未就绪则忽略）
          applyMoveMessage(plain);
          return;
        }
        applyMoveMessage(plain);
      } catch (error) {
        if (pending) {
          const wait = pending;
          pending = null;
          clearTimeout(wait.timer);
          wait.reject(error instanceof Error ? error : new Error("解密失败"));
        }
      }
    })();
  };

  await notifyChar.startNotifications();
  notifyChar.addEventListener("characteristicvaluechanged", onNotify);

  const waitPlain = (timeoutMs: number) =>
    new Promise<Uint8Array>((resolve, reject) => {
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error("上一次请求尚未完成"));
      }
      const timer = setTimeout(() => {
        pending = null;
        reject(new Error("等待魔方状态超时"));
      }, timeoutMs);
      pending = { resolve, reject, timer };
    });

  const sendPlain = async (plain: Uint8Array) => {
    const cipher = await encryptMoyuPacket(keyIv, plain);
    await writeCharacteristic(writeChar, cipher);
  };

  const sendOpcode = async (opcode: number) => {
    await sendPlain(emptyPacket(opcode));
  };

  const setGyroEnabled = async (enabled: boolean) => {
    await sendPlain(requestGyroControl(enabled));
  };

  const onGone = () => {
    options.onDisconnected?.();
  };
  device.addEventListener?.("gattserverdisconnected", onGone);

  const timeoutMs = options.statusTimeoutMs ?? 5000;

  return {
    name: deviceName,
    disconnect() {
      device.removeEventListener?.("gattserverdisconnected", onGone);
      notifyChar.removeEventListener("characteristicvaluechanged", onNotify);
      void notifyChar.stopNotifications?.().catch(() => undefined);
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error("已断开"));
        pending = null;
      }
      try {
        if (gatt.connected) {
          gatt.disconnect();
        } else {
          server.disconnect();
        }
      } catch {
        // ignore
      }
    },
    async requestStatus() {
      // 上电后先 A1 再 A3（Weilong / csTimer）
      await sendOpcode(MOYU_MSG.info);
      try {
        await waitPlain(200);
      } catch {
        // A1 可能无回复或已过期，继续要状态
      }
      await sendOpcode(MOYU_MSG.status);
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const plain = await waitPlain(Math.max(100, deadline - Date.now()));
        const parsed = parseMoyuPacket(plain);
        if (parsed.type === "status") {
          const setupAlg = await faceletsToSetupAlg(parsed.facelets);
          prevMoveCnt = parsed.moveCounter;
          return {
            facelets: parsed.facelets,
            setupAlg,
            moveCounter: parsed.moveCounter,
          };
        }
      }
      throw new Error("等待魔方状态超时");
    },
    async enableGyro() {
      await setGyroEnabled(true);
    },
    async disableGyro() {
      await setGyroEnabled(false);
    },
  };
}
