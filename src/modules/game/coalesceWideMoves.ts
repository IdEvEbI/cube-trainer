/**
 * 把同轴「外层 + 中层」合并为宽层记号（SiGN / cubing.js）：
 * u = U E'，u' = U' E，d = D E，d' = D' E'，……
 * 注意：U' E' ≠ u'，不会被合并。
 */

type Parsed = {
  family: string;
  suffix: "" | "'" | "2" | "2'";
};

const FACE_SLICE_TO_WIDE: Record<string, string> = {
  // face+slice → wide（后缀相同或按表）
  "U|E'|": "u",
  "U'|E|": "u'",
  "U2|E2|": "u2",
  "D|E|": "d",
  "D'|E'|": "d'",
  "D2|E2|": "d2",
  "R|M'|": "r",
  "R'|M|": "r'",
  "R2|M2|": "r2",
  "L|M|": "l",
  "L'|M'|": "l'",
  "L2|M2|": "l2",
  "F|S|": "f",
  "F'|S'|": "f'",
  "F2|S2|": "f2",
  "B|S'|": "b",
  "B'|S|": "b'",
  "B2|S2|": "b2",
};

function parseToken(raw: string): Parsed | null {
  const match = /^([UDLRFBudlrfbMES])(2'|2|')?$/.exec(raw.trim());
  if (!match) {
    return null;
  }
  const suffixRaw = match[2] ?? "";
  const suffix =
    suffixRaw === "2" || suffixRaw === "2'" || suffixRaw === "'"
      ? suffixRaw
      : ("" as const);
  return { family: match[1]!, suffix };
}

function sameAxis(face: string, slice: string): boolean {
  const f = face.toUpperCase();
  if (slice === "E") {
    return f === "U" || f === "D";
  }
  if (slice === "M") {
    return f === "R" || f === "L";
  }
  if (slice === "S") {
    return f === "F" || f === "B";
  }
  return false;
}

function tryMerge(a: Parsed, b: Parsed): string | null {
  const aFace = /^[UDLRFB]$/.test(a.family);
  const bFace = /^[UDLRFB]$/.test(b.family);
  const aSlice = /^[MES]$/.test(a.family);
  const bSlice = /^[MES]$/.test(b.family);
  if (aFace && bSlice && sameAxis(a.family, b.family)) {
    const key = `${a.family}${a.suffix}|${b.family}${b.suffix}|`;
    return FACE_SLICE_TO_WIDE[key] ?? null;
  }
  if (aSlice && bFace && sameAxis(b.family, a.family)) {
    const key = `${b.family}${b.suffix}|${a.family}${a.suffix}|`;
    return FACE_SLICE_TO_WIDE[key] ?? null;
  }
  return null;
}

/** 合并相邻可合成宽层的面转+中层；其余原样保留。 */
export function coalesceWideMoves(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cur = tokens[i]!.trim();
    const next = tokens[i + 1]?.trim() ?? "";
    const a = parseToken(cur);
    const b = next ? parseToken(next) : null;
    if (a && b) {
      const wide = tryMerge(a, b);
      if (wide) {
        out.push(wide);
        i += 2;
        continue;
      }
    }
    if (cur) {
      out.push(cur);
    }
    i += 1;
  }
  return out;
}
