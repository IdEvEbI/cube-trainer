import type {
  Formula,
  FormulaMethod,
  FormulaSubclass,
} from "../formula/types.ts";

export function methodNames(methods: FormulaMethod[]): string[] {
  return methods.map((method) => method.name);
}

export function methodSteps(
  methods: FormulaMethod[],
  methodId: string,
): FormulaSubclass[] | null {
  const method = methods.find((item) => item.id === methodId);
  return method ? method.subclasses : null;
}

export function formulasForMethod(
  methods: FormulaMethod[],
  methodId: string,
): Formula[] | null {
  const steps = methodSteps(methods, methodId);
  if (!steps) {
    return null;
  }
  return steps.flatMap((step) => step.formulas);
}

export function practiceList(group: FormulaSubclass): Formula[] {
  return group.formulas;
}

export type FormulaGroup<T> = {
  name: string | null;
  formulas: T[];
};

export function groupFormulas<T extends { group?: string }>(
  formulas: readonly T[],
): FormulaGroup<T>[] {
  if (formulas.every((formula) => !formula.group)) {
    return [{ name: null, formulas: [...formulas] }];
  }
  const groups: FormulaGroup<T>[] = [];
  const ungrouped: T[] = [];
  for (const formula of formulas) {
    if (!formula.group) {
      ungrouped.push(formula);
      continue;
    }
    const found = groups.find((group) => group.name === formula.group);
    if (found) {
      found.formulas.push(formula);
    } else {
      groups.push({ name: formula.group, formulas: [formula] });
    }
  }
  if (ungrouped.length > 0) {
    groups.push({ name: "其他", formulas: ungrouped });
  }
  return groups;
}

export function formulaGroup(
  methods: FormulaMethod[],
  methodId: string,
  formulaId: string,
): FormulaSubclass | null {
  const steps = methodSteps(methods, methodId);
  if (!steps) {
    return null;
  }
  return (
    steps.find((step) =>
      step.formulas.some((formula) => formula.id === formulaId),
    ) ?? null
  );
}
