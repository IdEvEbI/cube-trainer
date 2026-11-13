import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import { SOLVED_FACELETS_URFDLB } from "./facelets.ts";

const FACE_ORDER = "URFDLB";

/**
 * Reid 角块面位（URFDLB 0–53）。
 * 每组三面下标顺序与角块名字母一致：UFR→U/F/R，URB→U/R/B …
 */
const CORNER_FACELETS: ReadonlyArray<readonly [number, number, number]> = [
  [8, 20, 9], // UFR
  [2, 11, 45], // URB
  [0, 47, 36], // UBL
  [6, 38, 18], // ULF
  [29, 15, 26], // DRF
  [27, 24, 44], // DFL
  [33, 42, 53], // DLB
  [35, 51, 17], // DBR
];

/** Reid 棱块面位，顺序与棱名字母一致：UF→U/F … */
const EDGE_FACELETS: ReadonlyArray<readonly [number, number]> = [
  [7, 19], // UF
  [5, 10], // UR
  [1, 46], // UB
  [3, 37], // UL
  [28, 25], // DF
  [32, 16], // DR
  [34, 52], // DB
  [30, 43], // DL
  [23, 12], // FR
  [21, 41], // FL
  [48, 14], // BR
  [50, 39], // BL
];

const REID_EDGES = "UF UR UB UL DF DR DB DL FR FL BR BL".split(" ");
const REID_CORNERS = "UFR URB UBL ULF DRF DFL DLB DBR".split(" ");

function rotateLeft(s: string, i: number): string {
  return s.slice(i) + s.slice(0, i);
}

const PIECE_MAP: Record<string, { piece: number; orientation: number }> = {};
REID_EDGES.forEach((edge, idx) => {
  for (let i = 0; i < 2; i += 1) {
    PIECE_MAP[rotateLeft(edge, i)] = { piece: idx, orientation: i };
  }
});
REID_CORNERS.forEach((corner, idx) => {
  for (let i = 0; i < 3; i += 1) {
    PIECE_MAP[rotateLeft(corner, i)] = { piece: idx, orientation: i };
  }
});

function colorIndex(ch: string): number {
  const i = FACE_ORDER.indexOf(ch);
  if (i < 0) {
    throw new Error(`无效 facelet 色 ${ch}`);
  }
  return i;
}

/**
 * KPattern → URFDLB facelets（中心按槽位色心字母，与蓝牙固定色心同构）。
 * 用于公式钉中心态与设备 facelets 做字符串对表。
 */
export function kpatternToFacelets(pattern: KPattern): string {
  const stickers = Array<string>(54).fill("");
  for (let f = 0; f < 6; f += 1) {
    stickers[f * 9 + 4] = FACE_ORDER[f]!;
  }
  const corners = pattern.patternData.CORNERS;
  for (let slot = 0; slot < 8; slot += 1) {
    const name = REID_CORNERS[corners.pieces[slot]!]!;
    const ori = corners.orientation[slot]!;
    const rotated = name.slice(ori) + name.slice(0, ori);
    for (let i = 0; i < 3; i += 1) {
      stickers[CORNER_FACELETS[slot]![i]!] = rotated[i]!;
    }
  }
  const edges = pattern.patternData.EDGES;
  for (let slot = 0; slot < 12; slot += 1) {
    const name = REID_EDGES[edges.pieces[slot]!]!;
    const ori = edges.orientation[slot]!;
    const rotated = name.slice(ori) + name.slice(0, ori);
    for (let i = 0; i < 2; i += 1) {
      stickers[EDGE_FACELETS[slot]![i]!] = rotated[i]!;
    }
  }
  return stickers.join("");
}

/** 面中列三色（上中下），便于对照调试。 */
export function faceletsMidColumn(
  facelets: string,
  face: "U" | "R" | "F" | "D" | "L" | "B",
): string {
  if (facelets.length !== 54) {
    return "???";
  }
  const base = FACE_ORDER.indexOf(face) * 9;
  return `${facelets[base + 1]}${facelets[base + 4]}${facelets[base + 7]}`;
}

/** URFDLB facelet 串 → cubing KPattern（白上绿前）。 */
export async function faceletsToKPattern(facelets: string): Promise<KPattern> {
  if (facelets.length !== 54) {
    throw new Error(`facelets 长度应为 54，实际 ${facelets.length}`);
  }
  const stickers = [...facelets].map(colorIndex);
  const corners = { pieces: [] as number[], orientation: [] as number[] };
  const edges = { pieces: [] as number[], orientation: [] as number[] };

  for (const mapping of CORNER_FACELETS) {
    const key = mapping.map((i) => FACE_ORDER[stickers[i]!]!).join("");
    const info = PIECE_MAP[key];
    if (!info) {
      throw new Error(`无法识别角块 ${key}`);
    }
    corners.pieces.push(info.piece);
    corners.orientation.push(info.orientation);
  }
  for (const mapping of EDGE_FACELETS) {
    const key = mapping.map((i) => FACE_ORDER[stickers[i]!]!).join("");
    const info = PIECE_MAP[key];
    if (!info) {
      throw new Error(`无法识别棱块 ${key}`);
    }
    edges.pieces.push(info.piece);
    edges.orientation.push(info.orientation);
  }

  const puzzle = await cube3x3x3.kpuzzle();
  return new KPattern(puzzle, {
    CORNERS: corners,
    EDGES: edges,
    CENTERS: {
      pieces: [0, 1, 2, 3, 4, 5],
      orientation: [0, 0, 0, 0, 0, 0],
      orientationMod: [1, 1, 1, 1, 1, 1],
    },
  });
}

/**
 * 把 facelets 转成「从复原到该状态」的算法，供 TwistyPlayer 直接展示。
 * 计时首屏为白上，与协议 facelets 朝向一致。
 *
 * 纯中层等固定色心态上 min2phase 偶发解析失败；请优先用 {@link tryFaceletsToSetupAlg}。
 */
export async function faceletsToSetupAlg(facelets: string): Promise<string> {
  if (facelets === SOLVED_FACELETS_URFDLB) {
    return "";
  }
  const pattern = await faceletsToKPattern(facelets);
  const solve = await experimentalSolve3x3x3IgnoringCenters(pattern);
  return solve.invert().toString().trim();
}

/**
 * 与 {@link faceletsToSetupAlg} 相同，失败时返回 null（不抛），避免打断 facelets 轮询。
 */
export async function tryFaceletsToSetupAlg(
  facelets: string,
): Promise<string | null> {
  try {
    return await faceletsToSetupAlg(facelets);
  } catch {
    return null;
  }
}
