/** Gan 连接辅助：请求选项、MAC 推断、文案（无 Web Bluetooth 依赖）。 */

export const GAN_NAME_PREFIXES = ["GAN", "MG", "AiCube"] as const;

export const GAN_GATT_SERVICES = [
  "6e400001-b5a3-f393-e0a9-e50e24dc4179",
  "8653000a-43e6-47b7-9cb0-5fc21d4ae340",
  "00000010-0000-fff7-fff6-fff5fff4fff0",
] as const;

/** 与 gan-web-bluetooth 一致：广播里读 MAC 需请求这些 CIC。 */
export const GAN_OPTIONAL_MANUFACTURER_IDS: readonly number[] = Array.from(
  { length: 256 },
  (_, i) => (i << 8) | 0x01,
);

export type GanBleRequestDeviceOptions = {
  filters: Array<{ namePrefix: string }>;
  optionalServices: string[];
  optionalManufacturerData: number[];
};

export function ganRequestDeviceOptions(): GanBleRequestDeviceOptions {
  return {
    filters: GAN_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
    optionalServices: [...GAN_GATT_SERVICES],
    optionalManufacturerData: [...GAN_OPTIONAL_MANUFACTURER_IDS],
  };
}

/**
 * 设备名末尾若带完整 12 位十六进制 MAC（如 `…-AABBCCDDEEFF`），则解析。
 * 不猜测 OUI，避免错密钥。
 */
export function macFromGanDeviceName(name: string | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  const hexOnly = trimmed.replace(/[^0-9A-Fa-f]/g, "");
  const match = /([0-9A-Fa-f]{12})$/.exec(hexOnly);
  if (match) {
    const hex = match[1]!.toUpperCase();
    return `${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}:${hex.slice(6, 8)}:${hex.slice(8, 10)}:${hex.slice(10, 12)}`;
  }
  const colon =
    /(?:^|[^0-9A-Fa-f])([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})(?:$|[^0-9A-Fa-f])/i.exec(
      trimmed,
    );
  if (!colon) {
    return null;
  }
  return colon[1]!.toUpperCase();
}

/**
 * 规范化用户输入的 MAC 为 `AA:BB:CC:DD:EE:FF`。
 * gan-web-bluetooth 按 `:` / `-` 分段解析；纯 12 位十六进制需补冒号。
 */
export function normalizeGanMacAddress(raw: string): string | null {
  const hex = raw.trim().replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 12) {
    return null;
  }
  const upper = hex.toUpperCase();
  return `${upper.slice(0, 2)}:${upper.slice(2, 4)}:${upper.slice(4, 6)}:${upper.slice(6, 8)}:${upper.slice(8, 10)}:${upper.slice(10, 12)}`;
}

export const GAN_MAC_STORAGE_KEY_PREFIX = "cube-trainer.gan-mac.";

export function ganMacStorageKey(deviceId: string): string {
  return `${GAN_MAC_STORAGE_KEY_PREFIX}${deviceId}`;
}

/**
 * gan-web-bluetooth 的 MacAddressProvider 约定：
 * - 首次（isFallback=false）：可返回名中 / 缓存 MAC；否则返回 null，让库走 watchAdvertisements。
 * - 末次（isFallback=true）：才应弹窗询问。官方原生 App 可直接读 MAC；网页蓝牙默认拿不到。
 * - 若浏览器没有 watchAdvertisements（未开实验特性），首次也改为 prompt，避免空等约 10 秒。
 */
export type GanMacProviderStep =
  | { action: "use"; mac: string }
  | { action: "defer" }
  | { action: "prompt" };

export function resolveGanMacProviderStep(input: {
  deviceName: string | undefined;
  isFallback?: boolean;
  cachedMac?: string | null;
  /** 缺省视为可能支持；显式 false 时不 defer。 */
  canWatchAdvertisements?: boolean;
}): GanMacProviderStep {
  const fromName = macFromGanDeviceName(input.deviceName);
  if (fromName) {
    return { action: "use", mac: fromName };
  }
  const cached = input.cachedMac
    ? normalizeGanMacAddress(input.cachedMac)
    : null;
  if (cached) {
    return { action: "use", mac: cached };
  }
  if (!input.isFallback) {
    if (input.canWatchAdvertisements === false) {
      return { action: "prompt" };
    }
    return { action: "defer" };
  }
  return { action: "prompt" };
}

/** 当前设备是否暴露 Web Bluetooth 广播监听（Chrome 常需开实验特性）。 */
export function deviceCanWatchAdvertisements(device: {
  watchAdvertisements?: unknown;
}): boolean {
  return typeof device.watchAdvertisements === "function";
}

export function formatGanConnectedLabel(
  deviceName: string | undefined,
): string {
  const name = deviceName?.trim();
  return name ? `已连接 · ${name}` : "已连接";
}

export function formatGanConnectError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotFoundError") {
      return "未选择魔方，或附近没有 Gan 设备";
    }
    if (error.name === "SecurityError") {
      return "当前页面无法使用蓝牙（需 HTTPS 与支持 Web Bluetooth 的浏览器）";
    }
    if (error.name === "NetworkError" || error.name === "InvalidStateError") {
      return "蓝牙连接失败，请靠近魔方后重试";
    }
  }
  if (error instanceof Error && error.message) {
    if (/MAC/i.test(error.message)) {
      return "无法自动取得魔方地址。可在 Chrome 开启实验特性后重试，或手动输入一次（官方 App 可直接读取）";
    }
    if (/unsupported|services/i.test(error.message)) {
      return "已连接设备，但不是支持的 Gan 协议型号";
    }
    return error.message;
  }
  return "蓝牙连接失败";
}
