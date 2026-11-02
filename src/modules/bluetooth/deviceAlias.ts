export type DeviceAliasStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const STORAGE_KEY = "cube-trainer.bt-device-aliases";

type AliasMap = Record<string, string>;

function readMap(storage: DeviceAliasStorage): AliasMap {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const map: AliasMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        map[key] = value.trim();
      }
    }
    return map;
  } catch {
    return {};
  }
}

function writeMap(storage: DeviceAliasStorage, map: AliasMap): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function browserDeviceAliasStorage(): DeviceAliasStorage {
  return {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* private mode / quota */
      }
    },
  };
}

export function getDeviceAlias(
  storage: DeviceAliasStorage,
  deviceId: string,
): string | null {
  const id = deviceId.trim();
  if (!id) {
    return null;
  }
  return readMap(storage)[id] ?? null;
}

/** Empty / whitespace clears the alias. */
export function setDeviceAlias(
  storage: DeviceAliasStorage,
  deviceId: string,
  alias: string,
): void {
  const id = deviceId.trim();
  if (!id) {
    return;
  }
  const map = readMap(storage);
  const next = alias.trim();
  if (!next) {
    delete map[id];
  } else {
    map[id] = next;
  }
  writeMap(storage, map);
}

/** Prefer local alias; fall back to raw BLE name. */
export function resolveDeviceDisplayName(
  storage: DeviceAliasStorage,
  deviceId: string,
  rawName: string | undefined,
): string {
  const alias = getDeviceAlias(storage, deviceId);
  if (alias) {
    return alias;
  }
  const name = rawName?.trim();
  return name || "魔方";
}
