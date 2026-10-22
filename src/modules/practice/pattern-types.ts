/** OLL 朝向：黄=已朝向，其他=未朝向。PLL 侧面可用实际色。 */
export type PatternPaint = "黄" | "其他" | "绿" | "蓝" | "红" | "橙";

export type TopSticker = PatternPaint;

/** 顶层 9 格（行优先）+ 四周 12 条侧面；PLL 可带置换箭头（格序号 0–8）。 */
export type FormulaPattern = {
  id: string;
  name: string;
  top: readonly PatternPaint[];
  sides: readonly PatternPaint[];
  arrows?: readonly (readonly [number, number])[];
};
