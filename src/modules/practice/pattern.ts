export type TopSticker = "黄" | "其他";

export type FormulaPattern = {
  id: string;
  name: string;
  top: readonly TopSticker[];
};

const PATTERNS: Record<string, FormulaPattern> = {
  "oll-line": {
    id: "oll-line",
    name: "一字",
    top: ["其他", "其他", "黄", "黄", "黄", "黄", "其他", "其他", "黄"],
  },
  "oll-l": {
    id: "oll-l",
    name: "小拐弯",
    top: ["黄", "黄", "其他", "黄", "黄", "其他", "黄", "其他", "其他"],
  },
  "oll-sune": {
    id: "oll-sune",
    name: "右手小鱼",
    top: ["其他", "黄", "其他", "黄", "黄", "黄", "黄", "黄", "其他"],
  },
  "oll-antisune": {
    id: "oll-antisune",
    name: "左手小鱼",
    top: ["其他", "黄", "黄", "黄", "黄", "黄", "其他", "黄", "其他"],
  },
};

export function formulaPattern(id: string): FormulaPattern | null {
  return PATTERNS[id] ?? null;
}
