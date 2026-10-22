/**
 * Twisty 贴纸按「默认白上」的块编号生效，与画面 z2 黄上无关。
 * 内置 "F2L" 会忽略 U 层（白色块），黄上观看时等于误灰底层。
 * 简化显示应忽略 D 层（黄色块）：顶面无关块置灰，底层白块保持正常。
 */
export const F2L_SIMPLIFIED_MASK =
  "EDGES:----IIII----,CORNERS:----IIII,CENTERS:------";

export type PracticeStickering =
  | { mode: "full" }
  | { mode: "mask"; mask: string };

/** F2L 练习且开启简化时返回黄层忽略遮罩，否则全色。 */
export function practiceStickering(
  formulaId: string | null | undefined,
  simplified: boolean,
): PracticeStickering {
  if (
    simplified &&
    typeof formulaId === "string" &&
    formulaId.startsWith("f2l-")
  ) {
    return { mode: "mask", mask: F2L_SIMPLIFIED_MASK };
  }
  return { mode: "full" };
}

/** 从序列化遮罩读取某一轨道某一编号的贴纸字符。 */
export function stickeringChar(
  mask: string,
  orbit: "EDGES" | "CORNERS" | "CENTERS",
  index: number,
): string {
  const part = mask.split(",").find((item) => item.startsWith(`${orbit}:`));
  if (!part) {
    throw new Error(`缺少轨道 ${orbit}`);
  }
  const chars = part.slice(orbit.length + 1);
  const char = chars[index];
  if (!char) {
    throw new Error(`${orbit} 下标越界: ${index}`);
  }
  return char;
}
