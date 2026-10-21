import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import {
  LAYER_MOVES,
  TARGET_FACE_COLORS,
  type CubeFace,
  type FaceColor,
  type FaceColors,
  type LayerMove,
} from "./types.ts";

export const CUBE_ORIENTATION_ALG = "z2";

const CENTER_FACES = ["U", "L", "F", "R", "B", "D"] as const;

const WESTERN_COLOR_BY_PIECE: FaceColor[] = [
  "白",
  "橙",
  "绿",
  "红",
  "蓝",
  "黄",
];

let kpuzzlePromise: Promise<KPuzzle> | null = null;

function kpuzzle(): Promise<KPuzzle> {
  kpuzzlePromise ??= cube3x3x3.kpuzzle();
  return kpuzzlePromise;
}

function faceColors(pattern: KPattern): FaceColors {
  const pieces = pattern.patternData.CENTERS?.pieces;
  if (!pieces) {
    throw new Error("缺少中心块");
  }
  const colors = {} as FaceColors;
  CENTER_FACES.forEach((face, index) => {
    const color = WESTERN_COLOR_BY_PIECE[pieces[index] ?? -1];
    if (!color) {
      throw new Error("无法识别中心块颜色");
    }
    colors[face] = color;
  });
  return colors;
}

export async function readCube(moves = ""): Promise<{
  faceColors: FaceColors;
  corners: readonly number[];
  centers: readonly number[];
}> {
  const puzzle = await kpuzzle();
  let pattern = puzzle
    .defaultPattern()
    .applyTransformation(puzzle.algToTransformation(CUBE_ORIENTATION_ALG));
  if (moves.trim() !== "") {
    pattern = pattern.applyTransformation(puzzle.algToTransformation(moves));
  }
  const corners = pattern.patternData.CORNERS?.pieces;
  const centers = pattern.patternData.CENTERS?.pieces;
  if (!corners || !centers) {
    throw new Error("缺少魔方状态");
  }
  return {
    faceColors: faceColors(pattern),
    corners,
    centers,
  };
}

export function isLayerMove(move: string): move is LayerMove {
  return (LAYER_MOVES as readonly string[]).includes(move);
}

export function colorsMatchTarget(colors: FaceColors): boolean {
  return (Object.keys(TARGET_FACE_COLORS) as CubeFace[]).every(
    (face) => colors[face] === TARGET_FACE_COLORS[face],
  );
}
