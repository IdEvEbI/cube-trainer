import { cube3x3x3 } from "cubing/puzzles";
import type { FaceColor } from "../cube/types.ts";
import { F2L_SIMPLIFIED_MASK, stickeringChar } from "./stickering.ts";
import type { CubeFaces, PatternPaint } from "./pattern-types.ts";

/**
 * 从练习逆公式生成 F2L 立体缩略图三面色。
 * 朝向与练习 3D 一致（黄上绿前），并套用默认 F2L 简化遮罩（黄层块置灰）。
 */
const ORBITS = {
  CORNERS: 3,
  EDGES: 2,
  CENTERS: 4,
} as const;

type OrbitName = keyof typeof ORBITS;

type Slot = {
  orbit: OrbitName;
  location: number;
  orientation: number;
};

const SOLVED_COLOR: Record<"U" | "L" | "F" | "R" | "B" | "D", FaceColor> = {
  U: "白",
  L: "橙",
  F: "绿",
  R: "红",
  B: "蓝",
  D: "黄",
};

const FACE_SLOTS: Record<"U" | "F" | "R", readonly Slot[]> = {
  U: parseSlots([
    "CORNERS 2 0",
    "EDGES 2 0",
    "CORNERS 1 0",
    "EDGES 3 0",
    "CENTERS 0 0",
    "EDGES 1 0",
    "CORNERS 3 0",
    "EDGES 0 0",
    "CORNERS 0 0",
  ]),
  F: parseSlots([
    "CORNERS 3 1",
    "EDGES 0 1",
    "CORNERS 0 2",
    "EDGES 9 0",
    "CENTERS 2 0",
    "EDGES 8 0",
    "CORNERS 5 2",
    "EDGES 4 1",
    "CORNERS 4 1",
  ]),
  R: parseSlots([
    "CORNERS 0 1",
    "EDGES 1 1",
    "CORNERS 1 2",
    "EDGES 8 1",
    "CENTERS 3 0",
    "EDGES 10 1",
    "CORNERS 4 2",
    "EDGES 5 1",
    "CORNERS 7 1",
  ]),
};

const ALL_FACE_SLOTS: Record<
  "U" | "L" | "F" | "R" | "B" | "D",
  readonly Slot[]
> = {
  U: FACE_SLOTS.U,
  L: parseSlots([
    "CORNERS 2 1",
    "EDGES 3 1",
    "CORNERS 3 2",
    "EDGES 11 1",
    "CENTERS 1 0",
    "EDGES 9 1",
    "CORNERS 6 2",
    "EDGES 7 1",
    "CORNERS 5 1",
  ]),
  F: FACE_SLOTS.F,
  R: FACE_SLOTS.R,
  B: parseSlots([
    "CORNERS 1 1",
    "EDGES 2 1",
    "CORNERS 2 2",
    "EDGES 10 0",
    "CENTERS 4 0",
    "EDGES 11 0",
    "CORNERS 7 2",
    "EDGES 6 1",
    "CORNERS 6 1",
  ]),
  D: parseSlots([
    "CORNERS 5 0",
    "EDGES 4 0",
    "CORNERS 4 0",
    "EDGES 7 0",
    "CENTERS 5 0",
    "EDGES 5 0",
    "CORNERS 6 0",
    "EDGES 6 0",
    "CORNERS 7 0",
  ]),
};

function parseSlots(sources: readonly string[]): Slot[] {
  return sources.map((source) => {
    const [orbit, location, orientation] = source.split(" ");
    if (orbit !== "CORNERS" && orbit !== "EDGES" && orbit !== "CENTERS") {
      throw new Error("槽位无效");
    }
    return {
      orbit,
      location: Number(location),
      orientation: Number(orientation),
    };
  });
}

function pieceColors(): Record<OrbitName, FaceColor[][]> {
  const table: Record<OrbitName, FaceColor[][]> = {
    CORNERS: Array.from({ length: 8 }, () => []),
    EDGES: Array.from({ length: 12 }, () => []),
    CENTERS: Array.from({ length: 6 }, () => []),
  };
  for (const face of ["U", "L", "F", "R", "B", "D"] as const) {
    for (const slot of ALL_FACE_SLOTS[face]) {
      const colors = table[slot.orbit][slot.location] ?? [];
      colors[slot.orientation] = SOLVED_COLOR[face];
      table[slot.orbit][slot.location] = colors;
      if (slot.orbit === "CENTERS") {
        for (
          let orientation = 0;
          orientation < ORBITS.CENTERS;
          orientation += 1
        ) {
          colors[orientation] = SOLVED_COLOR[face];
        }
      }
    }
  }
  return table;
}

const PIECE_COLOR = pieceColors();

function stickerColor(
  pieces: readonly number[],
  orientation: readonly number[],
  slot: Slot,
): FaceColor {
  const piece = pieces[slot.location];
  const turned = orientation[slot.location] ?? 0;
  const count = ORBITS[slot.orbit];
  const sticker = (slot.orientation - turned + count) % count;
  const color =
    piece === undefined ? undefined : PIECE_COLOR[slot.orbit][piece]?.[sticker];
  if (!color) {
    throw new Error("无法读取练习贴纸颜色");
  }
  return color;
}

function asPaint(color: FaceColor): PatternPaint {
  return color;
}

/** 练习态（z2 + 逆公式）下的 U/F/R，黄层块按 F2L 简化遮罩置灰。 */
export async function f2lPracticeCubeFaces(
  inverse: string,
): Promise<CubeFaces> {
  const puzzle = await cube3x3x3.kpuzzle();
  const pattern = puzzle.defaultPattern().applyAlg(`z2 ${inverse}`);
  const orbitData = {
    CORNERS: pattern.patternData.CORNERS,
    EDGES: pattern.patternData.EDGES,
    CENTERS: pattern.patternData.CENTERS,
  };

  function face(name: "U" | "F" | "R"): PatternPaint[] {
    return FACE_SLOTS[name].map((slot) => {
      const data = orbitData[slot.orbit];
      if (!data) {
        throw new Error("无法读取练习贴纸颜色");
      }
      const piece = data.pieces[slot.location];
      if (
        piece !== undefined &&
        slot.orbit !== "CENTERS" &&
        stickeringChar(F2L_SIMPLIFIED_MASK, slot.orbit, piece) === "I"
      ) {
        return "灰";
      }
      return asPaint(stickerColor(data.pieces, data.orientation, slot));
    });
  }

  return {
    U: face("U"),
    F: face("F"),
    R: face("R"),
  };
}
