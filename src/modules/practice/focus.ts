export type Focus =
  | { kind: "计时" }
  | { kind: "公式库" }
  | { kind: "方法" }
  | { kind: "公式"; methodId: string }
  | { kind: "练习"; methodId: string };

export function showTiming(): Focus {
  return { kind: "计时" };
}

export function showLibrary(): Focus {
  return { kind: "公式库" };
}

export function showMethods(): Focus {
  return { kind: "方法" };
}

export function showFormulas(methodId: string): Focus {
  return { kind: "公式", methodId };
}

export function showPractice(focus: Focus): Focus {
  if (focus.kind !== "公式") {
    return focus;
  }
  return { kind: "练习", methodId: focus.methodId };
}

export function back(focus: Focus): Focus {
  switch (focus.kind) {
    case "练习":
      return { kind: "公式", methodId: focus.methodId };
    case "公式":
      return { kind: "方法" };
    case "方法":
    case "公式库":
      return { kind: "计时" };
    case "计时":
      return focus;
  }
}
