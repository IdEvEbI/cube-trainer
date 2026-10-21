import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle } from "cubing/kpuzzle";
import type { FaceColor } from "../cube/types.ts";
import { parseScramble } from "./scramble.ts";

export const NET_FACES = ["U", "L", "F", "R", "B", "D"] as const;

export type NetFace = (typeof NET_FACES)[number];

export type CubeNet = Record<NetFace, FaceColor[]>;

export const SOLVED_NET_COLOR: Record<NetFace, FaceColor> = {
  U: "白",
  L: "橙",
  F: "绿",
  R: "红",
  B: "蓝",
  D: "黄",
};

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

const FACE_SLOTS: Record<NetFace, readonly Slot[]> = {
  U: slots([
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
  L: slots([
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
  F: slots([
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
  R: slots([
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
  B: slots([
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
  D: slots([
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

const PIECE_COLOR = pieceColors();

let kpuzzlePromise: Promise<KPuzzle> | null = null;

function slots(sources: readonly string[]): Slot[] {
  return sources.map((source) => {
    const [orbit, location, orientation] = source.split(" ");
    if (orbit !== "CORNERS" && orbit !== "EDGES" && orbit !== "CENTERS") {
      throw new Error("平面图槽位无效");
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
  for (const face of NET_FACES) {
    FACE_SLOTS[face].forEach((slot) => {
      const colors = table[slot.orbit][slot.location] ?? [];
      colors[slot.orientation] = SOLVED_NET_COLOR[face];
      table[slot.orbit][slot.location] = colors;
      if (slot.orbit === "CENTERS") {
        for (
          let orientation = 0;
          orientation < ORBITS.CENTERS;
          orientation += 1
        ) {
          colors[orientation] = SOLVED_NET_COLOR[face];
        }
      }
    });
  }
  return table;
}

function kpuzzle(): Promise<KPuzzle> {
  kpuzzlePromise ??= cube3x3x3.kpuzzle();
  return kpuzzlePromise;
}

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
    throw new Error("无法读取平面图颜色");
  }
  return color;
}

export async function scrambleNet(moves: string): Promise<CubeNet> {
  const alg = parseScramble(moves).join(" ");
  const puzzle = await kpuzzle();
  const pattern = puzzle.defaultPattern().applyAlg(alg);
  const net = {} as CubeNet;

  for (const face of NET_FACES) {
    const orbitData = {
      CORNERS: pattern.patternData.CORNERS,
      EDGES: pattern.patternData.EDGES,
      CENTERS: pattern.patternData.CENTERS,
    };
    net[face] = FACE_SLOTS[face].map((slot) => {
      const data = orbitData[slot.orbit];
      if (!data) {
        throw new Error("无法读取平面图颜色");
      }
      return stickerColor(data.pieces, data.orientation, slot);
    });
  }

  return net;
}
