/** 魔域 WCU_MY32（如威龙 V10 AI）明文协议常量。解析层只处理解密后的包。 */

export const MOYU_PACKET_LENGTH = 20;

export const MOYU_MSG = {
  info: 0xa1,
  status: 0xa3,
  power: 0xa4,
  move: 0xa5,
  gyro: 0xab,
  gyroControl: 0xac,
} as const;

export type MoyuMsgType = (typeof MOYU_MSG)[keyof typeof MOYU_MSG];

/** 协议色号 → 面（WCA 白上绿前：绿前、蓝后、白上、黄下、橙左、红右）。 */
export const MOYU_COLOR_FACES = ["F", "B", "U", "D", "L", "R"] as const;

export type MoyuColorFace = (typeof MOYU_COLOR_FACES)[number];

/** 包内 6 面顺序（每面 8 贴纸，无中心）。 */
export const MOYU_FACELET_FACE_ORDER = ["F", "B", "U", "D", "L", "R"] as const;

/** 展开为 54 贴纸时的标准面序（CubieCube / facelet 串）。 */
export const FACELET_FACE_ORDER = ["U", "R", "F", "D", "L", "B"] as const;

/** A5 五步历史：色号高 4 位选面，低 1 位方向（0 顺时针，1 逆时针）。 */
export const MOYU_MOVE_FACES = ["F", "B", "U", "D", "L", "R"] as const;

export const MOYU_MOVES = [
  "F",
  "F'",
  "B",
  "B'",
  "U",
  "U'",
  "D",
  "D'",
  "L",
  "L'",
  "R",
  "R'",
] as const;

export type MoyuMove = (typeof MOYU_MOVES)[number];
