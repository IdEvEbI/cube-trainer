import {
  MOYU_MOVES,
  MOYU_MSG,
  MOYU_PACKET_LENGTH,
  type MoyuMove,
} from "./constants.ts";
import {
  decodeFaceletColors,
  encodeFaceletBits,
  faceletsToUrfDlB,
  type MoyuColor,
} from "./facelets.ts";
import type { MoyuQuat } from "./orientation.ts";

export type MoyuPacket = Uint8Array;

export function emptyPacket(type: number): MoyuPacket {
  const packet = new Uint8Array(MOYU_PACKET_LENGTH);
  packet[0] = type & 0xff;
  return packet;
}

export function requestCubeInfo(): MoyuPacket {
  return emptyPacket(MOYU_MSG.info);
}

export function requestCubeStatus(): MoyuPacket {
  return emptyPacket(MOYU_MSG.status);
}

export function requestCubePower(): MoyuPacket {
  return emptyPacket(MOYU_MSG.power);
}

/** 开启 / 关闭陀螺仪上报（第三字节 1 / 0）。 */
export function requestGyroControl(enabled: boolean): MoyuPacket {
  const packet = emptyPacket(MOYU_MSG.gyroControl);
  packet[2] = enabled ? 1 : 0;
  return packet;
}

const GYRO_SCALE = 1 / (1 << 30);

/**
 * 从已解密的 0xAB 包解析四元数。
 * 协议顺序为 LE int32 `(w, x, -z, y)`，各分量除以 2^30。
 */
export function parseGyroQuaternion(bytes: ArrayLike<number>): MoyuQuat {
  if (bytes.length < 17) {
    throw new Error("陀螺仪包过短");
  }
  const copy = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  if (view.getUint8(0) !== MOYU_MSG.gyro) {
    throw new Error("非陀螺仪包");
  }
  const w = view.getInt32(1, true) * GYRO_SCALE;
  const x = view.getInt32(5, true) * GYRO_SCALE;
  const negZ = view.getInt32(9, true) * GYRO_SCALE;
  const y = view.getInt32(13, true) * GYRO_SCALE;
  return { x, y, z: -negZ, w };
}

/** 把字节序列转成高位优先的 bit 串（与 csTimer 一致）。 */
export function bytesToBits(bytes: ArrayLike<number>): string {
  let bits = "";
  for (let i = 0; i < bytes.length; i += 1) {
    bits += (bytes[i]! & 0xff).toString(2).padStart(8, "0");
  }
  return bits;
}

export function bitsToBytes(bits: string): Uint8Array {
  if (bits.length % 8 !== 0) {
    throw new Error(`位串长度须为 8 的倍数，实际 ${bits.length}`);
  }
  const out = new Uint8Array(bits.length / 8);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return out;
}

export type MoyuInfoMessage = {
  type: "info";
  model: string;
  hardwareMajor: number;
  hardwareMinor: number;
  softwareMajor: number;
  softwareMinor: number;
  moveCounter: number;
};

export type MoyuStatusMessage = {
  type: "status";
  colors: MoyuColor[];
  facelets: string;
  moveCounter: number;
};

export type MoyuPowerMessage = {
  type: "power";
  batteryPercent: number;
};

export type MoyuMoveSample = {
  move: MoyuMove;
  /** 相对上一记的间隔（毫秒，协议 u16）。 */
  intervalMs: number;
};

export type MoyuMoveMessage = {
  type: "move";
  moveCounter: number;
  /** 最近最多 5 步，索引 0 为最新。 */
  history: MoyuMoveSample[];
};

export type MoyuGyroMessage = {
  type: "gyro";
  quaternion: MoyuQuat;
};

export type MoyuParsedMessage =
  | MoyuInfoMessage
  | MoyuStatusMessage
  | MoyuPowerMessage
  | MoyuMoveMessage
  | MoyuGyroMessage
  | { type: "unknown"; opcode: number };

/**
 * 解析已解密的通知包（通常 20 字节）。
 * 不处理 AES；模拟数据直接喂明文。
 */
export function parseMoyuPacket(bytes: ArrayLike<number>): MoyuParsedMessage {
  if (bytes.length < 1) {
    throw new Error("魔域包为空");
  }
  const bits = bytesToBits(bytes);
  const opcode = Number.parseInt(bits.slice(0, 8), 2);

  if (opcode === MOYU_MSG.info) {
    let model = "";
    for (let i = 0; i < 8; i += 1) {
      const code = Number.parseInt(bits.slice(8 + i * 8, 16 + i * 8), 2);
      if (code === 0) {
        break;
      }
      model += String.fromCharCode(code);
    }
    return {
      type: "info",
      model,
      hardwareMajor: Number.parseInt(bits.slice(72, 80), 2),
      hardwareMinor: Number.parseInt(bits.slice(80, 88), 2),
      softwareMajor: Number.parseInt(bits.slice(88, 96), 2),
      softwareMinor: Number.parseInt(bits.slice(96, 104), 2),
      moveCounter: Number.parseInt(bits.slice(109, 117), 2),
    };
  }

  if (opcode === MOYU_MSG.status) {
    if (bits.length < 160) {
      throw new Error("状态包过短");
    }
    const colors = decodeFaceletColors(bits.slice(8, 152));
    return {
      type: "status",
      colors,
      facelets: faceletsToUrfDlB(colors),
      moveCounter: Number.parseInt(bits.slice(152, 160), 2),
    };
  }

  if (opcode === MOYU_MSG.power) {
    return {
      type: "power",
      batteryPercent: Number.parseInt(bits.slice(8, 16), 2),
    };
  }

  if (opcode === MOYU_MSG.move) {
    if (bits.length < 121) {
      throw new Error("转动包过短");
    }
    const moveCounter = Number.parseInt(bits.slice(88, 96), 2);
    const history: MoyuMoveSample[] = [];
    for (let i = 0; i < 5; i += 1) {
      const code = Number.parseInt(bits.slice(96 + i * 5, 101 + i * 5), 2);
      const intervalMs = Number.parseInt(
        bits.slice(8 + i * 16, 24 + i * 16),
        2,
      );
      if (code >= MOYU_MOVES.length) {
        continue;
      }
      history.push({
        move: MOYU_MOVES[code]!,
        intervalMs,
      });
    }
    return { type: "move", moveCounter, history };
  }

  if (opcode === MOYU_MSG.gyro) {
    return {
      type: "gyro",
      quaternion: parseGyroQuaternion(bytes),
    };
  }

  return { type: "unknown", opcode };
}

/** 构造明文 A3 状态包（模拟数据）。 */
export function buildStatusPacket(
  colors: readonly MoyuColor[],
  moveCounter: number,
): MoyuPacket {
  const faceBits = encodeFaceletBits(colors);
  const counterBits = (moveCounter & 0xff).toString(2).padStart(8, "0");
  const bits =
    MOYU_MSG.status.toString(2).padStart(8, "0") + faceBits + counterBits;
  // 补齐到 20 字节
  const padded = bits.padEnd(MOYU_PACKET_LENGTH * 8, "0");
  return bitsToBytes(padded);
}

/** 构造明文 A5 转动包（history[0] 为最新一步）。 */
export function buildMovePacket(
  moveCounter: number,
  history: readonly MoyuMoveSample[],
): MoyuPacket {
  if (history.length > 5) {
    throw new Error("转动历史最多 5 步");
  }
  let timeBits = "";
  let moveBits = "";
  for (let i = 0; i < 5; i += 1) {
    const sample = history[i];
    const interval = sample?.intervalMs ?? 0;
    // 未使用槽位填 31（≥12），解析时跳过，避免冒充 F。
    let code = 31;
    if (sample) {
      code = MOYU_MOVES.indexOf(sample.move);
      if (code < 0) {
        throw new Error(`未知转动 ${sample.move}`);
      }
    }
    timeBits += (interval & 0xffff).toString(2).padStart(16, "0");
    moveBits += (code & 0x1f).toString(2).padStart(5, "0");
  }
  const bits =
    MOYU_MSG.move.toString(2).padStart(8, "0") +
    timeBits +
    (moveCounter & 0xff).toString(2).padStart(8, "0") +
    moveBits;
  const padded = bits.padEnd(MOYU_PACKET_LENGTH * 8, "0");
  return bitsToBytes(padded);
}

/** 构造明文 A1 信息包。 */
export function buildInfoPacket(options: {
  model: string;
  hardwareMajor: number;
  hardwareMinor: number;
  softwareMajor: number;
  softwareMinor: number;
  moveCounter: number;
}): MoyuPacket {
  const model = options.model.slice(0, 8).padEnd(8, "\0");
  let modelBits = "";
  for (let i = 0; i < 8; i += 1) {
    modelBits += model.charCodeAt(i).toString(2).padStart(8, "0");
  }
  // bit 104–108 标志位占 5 bit，其后 8 bit 为 moveCounter（与 csTimer slice(109,117) 对齐）
  const flagsAndCounter =
    "00000" + (options.moveCounter & 0xff).toString(2).padStart(8, "0");
  const bits =
    MOYU_MSG.info.toString(2).padStart(8, "0") +
    modelBits +
    (options.hardwareMajor & 0xff).toString(2).padStart(8, "0") +
    (options.hardwareMinor & 0xff).toString(2).padStart(8, "0") +
    (options.softwareMajor & 0xff).toString(2).padStart(8, "0") +
    (options.softwareMinor & 0xff).toString(2).padStart(8, "0") +
    flagsAndCounter;
  const padded = bits.padEnd(MOYU_PACKET_LENGTH * 8, "0");
  return bitsToBytes(padded);
}

/** 构造明文 A4 电量包。 */
export function buildPowerPacket(batteryPercent: number): MoyuPacket {
  const bits =
    MOYU_MSG.power.toString(2).padStart(8, "0") +
    (batteryPercent & 0xff).toString(2).padStart(8, "0");
  const padded = bits.padEnd(MOYU_PACKET_LENGTH * 8, "0");
  return bitsToBytes(padded);
}
