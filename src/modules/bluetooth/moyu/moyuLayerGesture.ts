/**
 * 魔域宽层 / 中层：转动包指纹 + 陀螺仪相对转角。
 * 真机多数票表：2026-11-11 全量重采（含逆双步；d 系二次重采）。
 *
 * - 宽层：固件只报**对面**一层（`r→L`、`f→B`、`u→D`…），且手持朝向会变。
 *   **不能**单靠对面包：无陀螺变化时那是外层，不是宽层。
 * - 宽层 `*2` / `*'2`：真机常报**两下**对面包（`r2→L L`，`r'2→L' L'`），与四分之一不同。
 * - 中层：一对对面、近乎同时；无序多重集 + 陀螺。`M`/`M'` 多重集不同。
 * - 中层 `*2`：真机为单步包的两倍（四包）。
 */

import {
  relativeOrientationAlg,
  relativeOrientationQuat,
} from "../../game/guideOrientation.ts";
import {
  cubeOrientationScore,
  nearestCubeOrientationAlg,
  quatFromOrientationAlg,
} from "../../score/cubeOrientation.ts";
import { isLayerCaptureLabel, type LayerCaptureLabel } from "./layerCapture.ts";
import { IDENTITY_QUAT, quatAngle, type MoyuQuat } from "./orientation.ts";

/**
 * 宽层 → 固件上报的对面外层（四分之一转的包面）。
 * 另一半：相对陀螺须达到 {@link LAYER_GYRO_QUIET_MAX_TURNS} 以上。
 */
const WIDE_OPPOSITE_FACE: Record<string, string> = {
  r: "L",
  l: "R",
  f: "B",
  b: "F",
  u: "D",
  d: "U",
};

/**
 * 中层无序包键（多重集，已排序）。
 * `*2` 为单步键各元素出现两次（四包）。
 */
const SLICE_MULTISET_KEY: Record<string, string> = {
  M: "L' R",
  "M'": "L R'",
  M2: "L' L' R R",
  "M'2": "L L R' R'",
  E: "D' U",
  "E'": "D U'",
  E2: "D' D' U U",
  "E'2": "D D U' U'",
  S: "B F'",
  "S'": "B' F",
  S2: "B B F' F'",
  "S'2": "B' B' F F",
};

/**
 * 手势前后相对朝向（`live ⊗ from⁻¹` 再吸附到 24 朝向）。
 * `x2` 在本仓库吸附为 `z2 y2`。
 * `d2`/`d'2` 真机偶发吸附成 `x y2` 或空，期望仍记 `y2`，靠转角软匹配兜底。
 */
export const EXPECTED_GYRO_DELTA_ALG: Record<LayerCaptureLabel, string> = {
  M: "x",
  "M'": "x'",
  M2: "z2 y2",
  "M'2": "z2 y2",
  E: "y",
  "E'": "y'",
  E2: "y2",
  "E'2": "y2",
  S: "z",
  "S'": "z'",
  S2: "z2",
  "S'2": "z2",
  r: "x'",
  "r'": "x",
  r2: "z2 y2",
  "r'2": "z2 y2",
  l: "x",
  "l'": "x'",
  l2: "z2 y2",
  "l'2": "z2 y2",
  f: "z",
  "f'": "z'",
  f2: "z2",
  "f'2": "z2",
  b: "z'",
  "b'": "z",
  b2: "z2",
  "b'2": "z2",
  u: "y'",
  "u'": "y",
  u2: "y2",
  "u'2": "y2",
  d: "y",
  "d'": "y'",
  d2: "y2",
  "d'2": "y2",
};

/** 消歧采纳最低朝向分（完全对齐为 1）。 */
export const LAYER_GYRO_SCORE_MIN = 0.85;

export type LayerGestureKind = "wide" | "slice";

export type ParsedLayerToken = {
  label: LayerCaptureLabel;
  kind: LayerGestureKind;
  family: string;
  suffix: "" | "'" | "2";
};

/** 无序多重集键：`R L'` 与 `L' R` 相同。 */
export function movesMultisetKey(moves: readonly string[]): string {
  return [...moves]
    .map((move) => move.trim())
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function parseLayerGestureToken(token: string): ParsedLayerToken | null {
  const raw = token.trim();
  if (!isLayerCaptureLabel(raw)) {
    return null;
  }
  const match = /^([MESrldfub])(2'|'2|2|')?$/.exec(raw);
  if (!match) {
    return null;
  }
  const family = match[1]!;
  const suf = match[2] ?? "";
  const suffix: "" | "'" | "2" =
    suf === "2" || suf === "2'" || suf === "'2" ? "2" : suf === "'" ? "'" : "";
  const kind: LayerGestureKind =
    family === "M" || family === "E" || family === "S" ? "slice" : "wide";
  return { label: raw, kind, family, suffix };
}

/** 宽层对面外层记号（含撇号）；`*2` 为两下相同包。 */
function wideOppositeMoves(parsed: ParsedLayerToken): string[] | null {
  const face = WIDE_OPPOSITE_FACE[parsed.family];
  if (!face) {
    return null;
  }
  const primed = parsed.label.includes("'");
  const move = primed ? `${face}'` : face;
  if (parsed.suffix === "2") {
    return [move, move];
  }
  return [move];
}

/**
 * 期望记号对应的转动包（规范化示例；中层按多重集键展开）。
 * 宽层 `*2` / `*'2` 为两下对面包；中层 `*2` 为四包。
 */
export function expectedBurstMovesForLayer(token: string): string[] | null {
  const parsed = parseLayerGestureToken(token);
  if (!parsed) {
    return null;
  }
  if (parsed.kind === "wide") {
    return wideOppositeMoves(parsed);
  }
  const key = SLICE_MULTISET_KEY[parsed.label];
  if (!key) {
    return null;
  }
  return key.split(" ");
}

/**
 * 当前手势转动包是否与期望宽层/中层记号相符（只看包，不看陀螺仪）。
 */
export function matchMoyuLayerGestureMoves(
  expectedToken: string,
  burstMoves: readonly string[],
): boolean {
  const parsed = parseLayerGestureToken(expectedToken);
  if (!parsed) {
    return false;
  }
  const cleaned = burstMoves.map((m) => m.trim()).filter(Boolean);
  if (parsed.kind === "wide") {
    const want = wideOppositeMoves(parsed);
    if (!want || cleaned.length !== want.length) {
      return false;
    }
    return cleaned.every((move, index) => move === want[index]);
  }
  const wantKey = SLICE_MULTISET_KEY[parsed.label];
  if (!wantKey) {
    return false;
  }
  const wantCount = wantKey.split(" ").length;
  return cleaned.length === wantCount && movesMultisetKey(cleaned) === wantKey;
}

/**
 * 仅从转动包反查可能记号（宽层单包/双包、中层双包/四包）。
 */
export function classifyMoyuLayerGestureMoves(
  burstMoves: readonly string[],
): LayerCaptureLabel[] {
  const cleaned = burstMoves.map((m) => m.trim()).filter(Boolean);
  if (cleaned.length === 1) {
    const move = cleaned[0]!;
    const out: LayerCaptureLabel[] = [];
    for (const [layer, face] of Object.entries(WIDE_OPPOSITE_FACE)) {
      if (move === face) {
        out.push(layer as LayerCaptureLabel);
      } else if (move === `${face}'`) {
        out.push(`${layer}'` as LayerCaptureLabel);
      }
    }
    return out;
  }
  if (cleaned.length === 2) {
    const a = cleaned[0]!;
    const b = cleaned[1]!;
    if (a === b) {
      const out: LayerCaptureLabel[] = [];
      for (const [layer, face] of Object.entries(WIDE_OPPOSITE_FACE)) {
        if (a === face) {
          out.push(`${layer}2` as LayerCaptureLabel);
        } else if (a === `${face}'`) {
          out.push(`${layer}'2` as LayerCaptureLabel);
        }
      }
      if (out.length > 0) {
        return out;
      }
    }
    const key = movesMultisetKey(cleaned);
    const out: LayerCaptureLabel[] = [];
    for (const [label, sliceKey] of Object.entries(SLICE_MULTISET_KEY)) {
      if (sliceKey === key) {
        out.push(label as LayerCaptureLabel);
      }
    }
    return out;
  }
  if (cleaned.length === 4) {
    const key = movesMultisetKey(cleaned);
    const out: LayerCaptureLabel[] = [];
    for (const [label, sliceKey] of Object.entries(SLICE_MULTISET_KEY)) {
      if (sliceKey === key) {
        out.push(label as LayerCaptureLabel);
      }
    }
    return out;
  }
  return [];
}

export function expectedGyroDeltaAlg(token: string): string | null {
  const parsed = parseLayerGestureToken(token);
  if (!parsed) {
    return null;
  }
  return EXPECTED_GYRO_DELTA_ALG[parsed.label] ?? null;
}

/** 手势前后相对朝向，吸附到 24 朝向公式。 */
export function measureGyroDeltaAlg(
  gyroBefore: MoyuQuat,
  gyroAfter: MoyuQuat,
): string {
  return relativeOrientationAlg(gyroBefore, gyroAfter);
}

/**
 * 相对转角折合四分之一圈数（0…2）。
 * 用于 `E`/`E2` 等吸附串稍偏时的软消歧。
 */
export function gyroDeltaQuarterTurns(
  gyroBefore: MoyuQuat,
  gyroAfter: MoyuQuat,
): number {
  const delta = relativeOrientationQuat(gyroBefore, gyroAfter);
  return quatAngle(IDENTITY_QUAT, delta) / (Math.PI / 2);
}

/** ≥ 该圈数视为 180° 族；否则视为 90° 族。 */
export const LAYER_GYRO_HALF_TURN_MIN = 1.4;

/**
 * 低于该相对圈数视为「陀螺几乎未动」→ 外层面转，不是宽层/中层手势。
 * （宽层 `r` 与外层 `L` 同包，靠这条区分。）
 */
export const LAYER_GYRO_QUIET_MAX_TURNS = 0.35;

/** 手势是否带动整机朝向（宽层/中层应为 true；纯外层 L 应为 false）。 */
export function gyroSuggestsLayerBodyTurn(
  gyroBefore: MoyuQuat,
  gyroAfter: MoyuQuat,
): boolean {
  return (
    gyroDeltaQuarterTurns(gyroBefore, gyroAfter) >= LAYER_GYRO_QUIET_MAX_TURNS
  );
}

function canonicalizeGyroDeltaAlg(alg: string): string {
  return nearestCubeOrientationAlg(quatFromOrientationAlg(alg));
}

/** 相对陀螺是否与期望记号一致（吸附串相等，或圈数软匹配 `*2`）。 */
export function matchMoyuLayerGestureGyro(
  expectedToken: string,
  gyroBefore: MoyuQuat,
  gyroAfter: MoyuQuat,
): boolean {
  const parsed = parseLayerGestureToken(expectedToken);
  const expect = expectedGyroDeltaAlg(expectedToken);
  if (!parsed || expect === null) {
    return false;
  }
  const measured = measureGyroDeltaAlg(gyroBefore, gyroAfter);
  if (measured === canonicalizeGyroDeltaAlg(expect)) {
    return true;
  }
  // 吸附偶发漂到邻近朝向：用转角区分 90° / 180°。
  const turns = gyroDeltaQuarterTurns(gyroBefore, gyroAfter);
  if (parsed.suffix === "2") {
    return turns >= LAYER_GYRO_HALF_TURN_MIN;
  }
  return turns >= 0.55 && turns < LAYER_GYRO_HALF_TURN_MIN;
}

/**
 * 转动包 + 陀螺仪：在包候选里按相对朝向打分，选出唯一记号。
 * 无合格候选时返回 null。
 */
export function disambiguateMoyuLayerGesture(input: {
  burstMoves: readonly string[];
  gyroBefore: MoyuQuat;
  gyroAfter: MoyuQuat;
}): LayerCaptureLabel | null {
  const candidates = classifyMoyuLayerGestureMoves(input.burstMoves);
  if (candidates.length === 0) {
    return null;
  }
  const measuredAlg = measureGyroDeltaAlg(input.gyroBefore, input.gyroAfter);
  const measuredQuat = quatFromOrientationAlg(measuredAlg);
  let best: LayerCaptureLabel | null = null;
  let bestScore = -Infinity;
  for (const label of candidates) {
    const expect = EXPECTED_GYRO_DELTA_ALG[label];
    const score = cubeOrientationScore(measuredQuat, expect);
    if (score < LAYER_GYRO_SCORE_MIN) {
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      best = label;
    }
  }
  return best;
}

/**
 * 期望记号是否与本段手势相符。
 * - 宽层：必须同时有包 + 陀螺（且朝向确有变化）；缺陀螺或静默 → 不匹配（避免当成外层 L）。
 * - 中层：有陀螺则包+陀螺；无陀螺时仅唯一包可过（如 `E'`）。
 */
export function matchMoyuLayerGesture(input: {
  expectedToken: string;
  burstMoves: readonly string[];
  gyroBefore?: MoyuQuat;
  gyroAfter?: MoyuQuat;
}): boolean {
  const parsed = parseLayerGestureToken(input.expectedToken);
  if (!parsed) {
    return false;
  }
  if (!matchMoyuLayerGestureMoves(input.expectedToken, input.burstMoves)) {
    return false;
  }
  const hasGyro =
    input.gyroBefore !== undefined && input.gyroAfter !== undefined;
  if (parsed.kind === "wide") {
    if (!hasGyro) {
      return false;
    }
    if (!gyroSuggestsLayerBodyTurn(input.gyroBefore!, input.gyroAfter!)) {
      return false;
    }
    return matchMoyuLayerGestureGyro(
      input.expectedToken,
      input.gyroBefore!,
      input.gyroAfter!,
    );
  }
  if (!hasGyro) {
    return true;
  }
  if (!gyroSuggestsLayerBodyTurn(input.gyroBefore!, input.gyroAfter!)) {
    return false;
  }
  return matchMoyuLayerGestureGyro(
    input.expectedToken,
    input.gyroBefore!,
    input.gyroAfter!,
  );
}
