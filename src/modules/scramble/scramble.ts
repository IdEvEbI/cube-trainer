import { Alg } from "cubing/alg";
import type { Scramble } from "./types.ts";

const FACES = ["U", "D", "L", "R", "F", "B"] as const;

type Face = (typeof FACES)[number];
type Axis = "UD" | "LR" | "FB";

const AXIS: Record<Face, Axis> = {
  U: "UD",
  D: "UD",
  L: "LR",
  R: "LR",
  F: "FB",
  B: "FB",
};

const SUFFIXES = ["", "'", "2"] as const;
const SCRAMBLE_LENGTH = 20;
const FACE_TURN = /^[UDLRFB](?:2'|2|')?$/;

function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  const item = items[index];
  if (item === undefined) {
    throw new Error("随机源无效");
  }
  return item;
}

/** White-up scramble view (CSTimer-style); use for timer 3D + net. */
export function scrambleViewAlgorithm(moves: string): string {
  return parseScramble(moves).join(" ");
}

/**
 * Yellow-up view: scramble in white-up frame, then z2 for solve orientation.
 * Practice / restore still use yellow-up; timer first screen uses scrambleViewAlgorithm.
 */
export function scrambleDisplayAlgorithm(moves: string): string {
  return `z2 ${parseScramble(moves).join(" ")} z2`;
}

export function parseScramble(source: string): string[] {
  const moves = [...new Alg(source).experimentalLeafMoves()].map((move) =>
    move.toString(),
  );
  if (moves.length === 0) {
    throw new Error("打乱是空的");
  }
  const invalid = moves.find((move) => !FACE_TURN.test(move));
  if (invalid) {
    throw new Error(`无法打乱：${invalid}`);
  }
  return moves;
}

export function randomScramble3x3(
  random: () => number = Math.random,
): Scramble {
  const tokens: string[] = [];
  let previousFace: Face | null = null;
  let previousAxis: Axis | null = null;
  let axisBeforeThat: Axis | null = null;

  while (tokens.length < SCRAMBLE_LENGTH) {
    const faces = FACES.filter((face) => {
      if (face === previousFace) {
        return false;
      }
      return !(AXIS[face] === previousAxis && AXIS[face] === axisBeforeThat);
    });
    const face = pick(faces, random);
    const suffix = pick(SUFFIXES, random);
    tokens.push(`${face}${suffix}`);
    axisBeforeThat = previousAxis;
    previousAxis = AXIS[face];
    previousFace = face;
  }

  return {
    puzzle: "3x3",
    moves: parseScramble(tokens.join(" ")).join(" "),
  };
}
