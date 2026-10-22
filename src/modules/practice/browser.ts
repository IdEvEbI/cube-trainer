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

const PLL_LIST_ORDER = [
  "pll-ua",
  "pll-ub",
  "pll-h",
  "pll-z",
  "pll-aa",
  "pll-ab",
  "pll-e",
  "pll-t",
  "pll-f",
  "pll-v",
  "pll-y",
  "pll-ja",
  "pll-jb",
  "pll-ra",
  "pll-rb",
  "pll-na",
  "pll-nb",
  "pll-ga",
  "pll-gb",
  "pll-gc",
  "pll-gd",
];

export function practiceList(group: FormulaSubclass): Formula[] {
  if (group.id !== "cfop-pll") {
    return group.formulas;
  }
  const rank = new Map(PLL_LIST_ORDER.map((id, index) => [id, index]));
  return group.formulas
    .map((formula, index) => ({ formula, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.formula.id);
      const rightRank = rank.get(right.formula.id);
      if (leftRank === undefined && rightRank === undefined) {
        return left.index - right.index;
      }
      if (leftRank === undefined) {
        return 1;
      }
      if (rightRank === undefined) {
        return -1;
      }
      return leftRank - rightRank;
    })
    .map((item) => item.formula);
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
