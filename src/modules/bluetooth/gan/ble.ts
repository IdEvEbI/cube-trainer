/**
 * Gan 智能魔方：连接与状态同步适配层。
 * 协议实现委托 gan-web-bluetooth（Gen2 / Gen3 / Gen4）；运行时动态导入，避免 Node 测 aes-js ESM 问题。
 * 本阶段对外接口对齐魔域 MoyuBleConnection，便于 App 共用。
 */

import type { GanCubeConnection, GanCubeEvent } from "gan-web-bluetooth";
import { faceletsToSetupAlg } from "../moyu/pattern.ts";
import type { MoyuQuat } from "../moyu/orientation.ts";
import type { MoyuMove } from "../moyu/constants.ts";
import type { MoyuMoveSample } from "../moyu/packets.ts";
import type { MoyuBleConnection, MoyuCubeStatus } from "../moyu/ble.ts";
import { isWebBluetoothAvailable } from "../moyu/ble.ts";
import {
  deviceCanWatchAdvertisements,
  normalizeGanMacAddress,
  resolveGanMacProviderStep,
} from "./helpers.ts";

export {
  deviceCanWatchAdvertisements,
  formatGanConnectedLabel,
  formatGanConnectError,
  ganRequestDeviceOptions,
  GAN_GATT_SERVICES,
  GAN_NAME_PREFIXES,
  ganMacStorageKey,
  macFromGanDeviceName,
  normalizeGanMacAddress,
  resolveGanMacProviderStep,
  type GanBleRequestDeviceOptions,
  type GanMacProviderStep,
} from "./helpers.ts";

export type GanMacDevice = {
  id?: string;
  name?: string | null;
  watchAdvertisements?: unknown;
};

export type GanMacAsk = (
  device: GanMacDevice,
  isFallback?: boolean,
) => Promise<string | null>;

export type ConnectGanOptions = {
  onDisconnected?: () => void;
  /** 本阶段可选：转动事件（后续跟转动画 / 计时用）。 */
  onMoves?: (samples: readonly MoyuMoveSample[]) => void;
  /** 本阶段可选：陀螺仪姿态。 */
  onOrientation?: (quaternion: MoyuQuat) => void;
  /** 末次兜底：库无法从广播读出 MAC 时询问（官方 App 不需要这一步）。 */
  askMacAddress?: (
    deviceName: string,
  ) => string | null | Promise<string | null>;
  /** 按浏览器 device.id 读取曾成功连接过的 MAC，避免重复弹窗。 */
  getCachedMac?: (
    device: GanMacDevice,
  ) => string | null | Promise<string | null>;
  /** 连接成功后记住 MAC。 */
  rememberMac?: (device: GanMacDevice, mac: string) => void;
  statusTimeoutMs?: number;
  /** 测试注入：跳过真实 Web Bluetooth。 */
  connectImpl?: (askMac: GanMacAsk) => Promise<GanCubeConnection>;
};

const FACE_MOVES = new Set<string>([
  "U",
  "U'",
  "U2",
  "R",
  "R'",
  "R2",
  "F",
  "F'",
  "F2",
  "D",
  "D'",
  "D2",
  "L",
  "L'",
  "L2",
  "B",
  "B'",
  "B2",
]);

function asMoyuMove(move: string): MoyuMove | null {
  const token = move.trim();
  if (!FACE_MOVES.has(token)) {
    return null;
  }
  return token as MoyuMove;
}

/**
 * 连接 Gan 魔方，返回与魔域同形的会话接口。
 * 本阶段保证：requestStatus → facelets / setupAlg；转动与陀螺仪回调可选。
 *
 * 浏览器必须传入 {@link ConnectGanOptions.connectImpl}（由 App 静态导入 vendor），
 * 避免在用户手势与 requestDevice 之间 await 动态 import。
 */
export async function connectGanCubeSession(
  options: ConnectGanOptions = {},
): Promise<MoyuBleConnection> {
  if (!options.connectImpl) {
    if (!isWebBluetoothAvailable()) {
      throw new Error("当前浏览器不支持 Web Bluetooth（iPhone 请用 Bluefy）");
    }
    throw new Error("缺少 Gan 连接实现（connectImpl）");
  }

  let selectedDevice: GanMacDevice | null = null;
  const askMac: GanMacAsk = async (device, isFallback) => {
    selectedDevice = device;
    const deviceName = device.name?.trim() || "Gan 魔方";
    const cached = options.getCachedMac
      ? await options.getCachedMac(device)
      : null;
    const step = resolveGanMacProviderStep({
      deviceName,
      isFallback,
      cachedMac: cached,
      canWatchAdvertisements: deviceCanWatchAdvertisements(device),
    });
    if (step.action === "use") {
      return step.mac;
    }
    // 首次且浏览器支持广播监听：返回 null，让库自动读 MAC。
    if (step.action === "defer") {
      return null;
    }
    if (!options.askMacAddress) {
      return null;
    }
    const entered = await options.askMacAddress(deviceName);
    if (entered == null || entered.trim() === "") {
      return null;
    }
    const normalized = normalizeGanMacAddress(entered);
    if (!normalized) {
      throw new Error("MAC 地址格式无效，请输入 12 位十六进制（可带冒号）");
    }
    return normalized;
  };

  const raw = await options.connectImpl(askMac);

  const deviceName = raw.deviceName?.trim() || "Gan 魔方";
  if (raw.deviceMAC) {
    options.rememberMac?.(
      selectedDevice ?? { name: deviceName },
      raw.deviceMAC,
    );
  }
  const deviceId = `gan:${raw.deviceMAC || deviceName}`;
  let lastLocalTs: number | null = null;
  let closed = false;

  const subscription = raw.events$.subscribe((event: GanCubeEvent) => {
    if (event.type === "DISCONNECT") {
      if (!closed) {
        options.onDisconnected?.();
      }
      return;
    }
    if (event.type === "MOVE" && options.onMoves) {
      const move = asMoyuMove(event.move);
      if (!move) {
        return;
      }
      const now = event.localTimestamp ?? Date.now();
      const intervalMs =
        lastLocalTs === null || event.localTimestamp === null
          ? 0
          : Math.max(0, now - lastLocalTs);
      lastLocalTs = now;
      options.onMoves([{ move, intervalMs }]);
      return;
    }
    if (event.type === "GYRO" && options.onOrientation) {
      const { x, y, z, w } = event.quaternion;
      options.onOrientation({ x, y, z, w });
    }
  });

  const timeoutMs = options.statusTimeoutMs ?? 5000;

  return {
    id: deviceId,
    name: deviceName,
    disconnect() {
      closed = true;
      subscription.unsubscribe();
      void raw.disconnect().catch(() => undefined);
    },
    async requestStatus(): Promise<MoyuCubeStatus> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          sub.unsubscribe();
          reject(new Error("等待魔方状态超时"));
        }, timeoutMs);
        const sub = raw.events$.subscribe((event: GanCubeEvent) => {
          if (event.type !== "FACELETS") {
            return;
          }
          clearTimeout(timer);
          sub.unsubscribe();
          void faceletsToSetupAlg(event.facelets)
            .then((setupAlg) => {
              resolve({
                facelets: event.facelets,
                setupAlg,
                moveCounter: event.serial,
              });
            })
            .catch(reject);
        });
        void raw
          .sendCubeCommand({ type: "REQUEST_FACELETS" })
          .catch((error: unknown) => {
            clearTimeout(timer);
            sub.unsubscribe();
            reject(error instanceof Error ? error : new Error("请求状态失败"));
          });
      });
    },
    async enableGyro() {
      // Gen2+ 多数型号连接后自行上报 GYRO；无单独开关。
    },
    async disableGyro() {
      // 无协议级关闭；断开时随会话结束。
    },
  };
}
