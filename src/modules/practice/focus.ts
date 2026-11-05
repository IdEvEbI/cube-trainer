/** App focus: timing home, CFOP practice, or local score list. */
export type Focus =
  | { kind: "计时" }
  | { kind: "练习"; methodId: "cfop" }
  | { kind: "成绩" };

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

export function back(focus: Focus): Focus {
  if (focus.kind === "练习" || focus.kind === "成绩") {
    return showTiming();
  }
  return focus;
}
