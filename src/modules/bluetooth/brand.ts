/** 计时首页蓝牙魔方品牌。 */

import {
  GAN_GATT_SERVICES,
  GAN_NAME_PREFIXES,
  GAN_OPTIONAL_MANUFACTURER_IDS,
} from "./gan/helpers.ts";
import { MOYU_GATT, MOYU_NAME_PREFIX } from "./moyu/ble.ts";

export type SmartCubeBrand = "moyu" | "gan";

export const SMART_CUBE_BRANDS: readonly SmartCubeBrand[] = ["moyu", "gan"];

export function smartCubeBrandLabel(brand: SmartCubeBrand): string {
  return brand === "moyu" ? "魔域" : "Gan";
}

export function smartCubeBrandHint(brand: SmartCubeBrand): string {
  return brand === "moyu" ? "Weilong / WCU_MY32 等" : "GAN / MG / AiCube 等";
}

/**
 * 按广播名推断品牌。无法识别时返回 null（需用户换设备或检查名称）。
 */
export function inferSmartCubeBrand(
  deviceName: string | null | undefined,
): SmartCubeBrand | null {
  const name = deviceName?.trim() ?? "";
  if (!name) {
    return null;
  }
  if (name.startsWith(MOYU_NAME_PREFIX)) {
    return "moyu";
  }
  for (const prefix of GAN_NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      return "gan";
    }
  }
  return null;
}

export type SmartCubeRequestDeviceOptions = {
  filters: Array<{ namePrefix: string }>;
  optionalServices: string[];
  optionalManufacturerData: number[];
};

/** 一次系统选择窗同时覆盖魔域与 Gan（含 Gan 广播读 MAC 所需 manufacturer data）。 */
export function smartCubeRequestDeviceOptions(): SmartCubeRequestDeviceOptions {
  return {
    filters: [
      { namePrefix: MOYU_NAME_PREFIX },
      ...GAN_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
    ],
    optionalServices: [MOYU_GATT.service, ...GAN_GATT_SERVICES],
    optionalManufacturerData: [...GAN_OPTIONAL_MANUFACTURER_IDS],
  };
}
