import {
  FACELET_FACE_ORDER,
  MOYU_COLOR_FACES,
  MOYU_FACELET_FACE_ORDER,
  type MoyuColorFace,
} from "./constants.ts";

/** 魔域色号：0 绿 / 1 蓝 / 2 白 / 3 黄 / 4 橙 / 5 红。 */
export type MoyuColor = 0 | 1 | 2 | 3 | 4 | 5;

const COLOR_TO_ZH = ["绿", "蓝", "白", "黄", "橙", "红"] as const;

export type MoyuZhColor = (typeof COLOR_TO_ZH)[number];

export function moyuColorToZh(color: MoyuColor): MoyuZhColor {
  return COLOR_TO_ZH[color];
}

export function moyuColorToFace(color: MoyuColor): MoyuColorFace {
  return MOYU_COLOR_FACES[color];
}

function isMoyuColor(value: number): value is MoyuColor {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

/**
 * 从 A3 包中的 144 bit 贴纸流解出 48 个色号（无中心，顺序 FBUDLR × 8）。
 * 位序与 csTimer / Weilong 文档一致：按字节高位优先拼接。
 */
export function decodeFaceletColors(bits144: string): MoyuColor[] {
  if (bits144.length !== 144) {
    throw new Error(`贴纸位流长度应为 144，实际 ${bits144.length}`);
  }
  const colors: MoyuColor[] = [];
  for (let i = 0; i < 48; i += 1) {
    const raw = Number.parseInt(bits144.slice(i * 3, i * 3 + 3), 2);
    if (!isMoyuColor(raw)) {
      throw new Error(`无效贴纸色号 ${raw} @${i}`);
    }
    colors.push(raw);
  }
  return colors;
}

/** 把 48 色号压成 144 bit 串（测试 / 构造模拟包用）。 */
export function encodeFaceletBits(colors: readonly MoyuColor[]): string {
  if (colors.length !== 48) {
    throw new Error(`贴纸色号应为 48 个，实际 ${colors.length}`);
  }
  let bits = "";
  for (const color of colors) {
    if (!isMoyuColor(color)) {
      throw new Error(`无效贴纸色号 ${color}`);
    }
    bits += color.toString(2).padStart(3, "0");
  }
  return bits;
}

/** 复原态 48 色：每面 8 贴纸同色，面序 FBUDLR。 */
export function solvedFaceletColors(): MoyuColor[] {
  const colors: MoyuColor[] = [];
  for (let face = 0; face < 6; face += 1) {
    for (let i = 0; i < 8; i += 1) {
      colors.push(face as MoyuColor);
    }
  }
  return colors;
}

/**
 * 展开为 54 贴纸 facelet 串（URFDLB，每面 9 贴纸含中心）。
 * 字符取该贴纸颜色对应的中心面字母（与 CubieCube / csTimer 一致）。
 */
export function faceletsToUrfDlB(colors: readonly MoyuColor[]): string {
  if (colors.length !== 48) {
    throw new Error(`贴纸色号应为 48 个，实际 ${colors.length}`);
  }

  const byFace = new Map<string, MoyuColor[]>();
  MOYU_FACELET_FACE_ORDER.forEach((face, index) => {
    byFace.set(face, colors.slice(index * 8, index * 8 + 8));
  });

  const faceIndexInPacket = (face: string): number =>
    MOYU_FACELET_FACE_ORDER.indexOf(
      face as (typeof MOYU_FACELET_FACE_ORDER)[number],
    );

  let out = "";
  for (const face of FACELET_FACE_ORDER) {
    const stickers = byFace.get(face);
    if (!stickers) {
      throw new Error(`缺少面 ${face}`);
    }
    const centerColor = faceIndexInPacket(face) as MoyuColor;
    for (let j = 0; j < 8; j += 1) {
      out += moyuColorToFace(stickers[j]!);
      if (j === 3) {
        out += moyuColorToFace(centerColor);
      }
    }
  }
  return out;
}

/** CubieCube 复原 facelet 串（白上绿前）。 */
export const SOLVED_FACELETS_URFDLB =
  "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
