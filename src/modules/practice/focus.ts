/** App focus: timing home or CFOP practice (no method / card-list pages). */
export type Focus = { kind: "计时" } | { kind: "练习"; methodId: "cfop" };

export const PRACTICE_METHOD_ID = "cfop" as const;

export function showTiming(): Focus {
  return { kind: "计时" };
}

/** Home practice entry goes straight into CFOP practice. */
export function showPractice(): Focus {
  return { kind: "练习", methodId: PRACTICE_METHOD_ID };
}

export function back(focus: Focus): Focus {
  if (focus.kind === "练习") {
    return showTiming();
  }
  return focus;
}
