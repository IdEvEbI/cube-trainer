/** App focus: timing home, CFOP practice, local scores, game, or temp capture. */
export type Focus =
  | { kind: "计时" }
  | { kind: "练习"; methodId: "cfop" }
  | { kind: "成绩" }
  | { kind: "游戏" }
  | { kind: "采集" };

export const PRACTICE_METHOD_ID = "cfop" as const;

export function showTiming(): Focus {
  return { kind: "计时" };
}

/** Home practice entry goes straight into CFOP practice. */
export function showPractice(): Focus {
  return { kind: "练习", methodId: PRACTICE_METHOD_ID };
}

export function showScores(): Focus {
  return { kind: "成绩" };
}

export function showGame(): Focus {
  return { kind: "游戏" };
}

/** 临时：魔域宽层 / 中层转动包采集。 */
export function showLayerCapture(): Focus {
  return { kind: "采集" };
}

export function back(focus: Focus): Focus {
  if (
    focus.kind === "练习" ||
    focus.kind === "成绩" ||
    focus.kind === "游戏" ||
    focus.kind === "采集"
  ) {
    return showTiming();
  }
  return focus;
}
