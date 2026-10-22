/** OLL 朝向：黄=已朝向。F2L / PLL 侧面可用实际色（含白）。 */
export type PatternPaint =
  | "黄"
  | "白"
  | "灰"
  | "其他"
  | "绿"
  | "蓝"
  | "红"
  | "橙";

export type TopSticker = PatternPaint;

/** F2L 立体缩略图：黄上视角下的 U / F / R 三面（各 9 格，行优先）。 */
export type CubeFaces = {
  U: readonly PatternPaint[];
  F: readonly PatternPaint[];
  R: readonly PatternPaint[];
};

/**
 * 顶层 9 格（行优先）+ 四周 12 条侧面；
 * PLL 可带置换箭头；F2L 使用 cube 立体三面。
 */
export type FormulaPattern = {
  id: string;
  name: string;
  top: readonly PatternPaint[];
  sides: readonly PatternPaint[];
  arrows?: readonly (readonly [number, number])[];
  cube?: CubeFaces;
};
