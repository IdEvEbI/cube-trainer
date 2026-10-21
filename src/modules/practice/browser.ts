import type { Formula, FormulaMethod, FormulaStep } from "../formula/types.ts";

export function methodNames(methods: FormulaMethod[]): string[] {
  return methods.map((method) => method.name);
}

export function methodSteps(
  methods: FormulaMethod[],
  methodId: string,
): FormulaStep[] | null {
  const method = methods.find((item) => item.id === methodId);
  return method ? method.steps : null;
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
