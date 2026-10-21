export const CUBE_FACES = ["U", "D", "F", "B", "L", "R"] as const;

export type CubeFace = (typeof CUBE_FACES)[number];

export type FaceColor = "黄" | "白" | "绿" | "蓝" | "红" | "橙";

export type FaceColors = Record<CubeFace, FaceColor>;

export const TARGET_FACE_COLORS: FaceColors = {
  U: "黄",
  D: "白",
  F: "绿",
  B: "蓝",
  L: "红",
  R: "橙",
};

export const LAYER_MOVES = [
  "U",
  "U'",
  "D",
  "D'",
  "L",
  "L'",
  "R",
  "R'",
  "F",
  "F'",
  "B",
  "B'",
] as const;

export type LayerMove = (typeof LAYER_MOVES)[number];
