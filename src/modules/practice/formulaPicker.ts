import type { CatalogMethod, CatalogSubclass } from "../../data/catalog.ts";
import { toPracticeFormula } from "../../data/catalog.ts";
import type { Formula } from "../formula/types.ts";
import { groupFormulas, type FormulaGroup } from "./browser.ts";
import { PRACTICE_METHOD_ID } from "./focus.ts";
import { practiceCase, type PracticeCase } from "./setup.ts";

const PRACTICE_STEP_IDS = new Set(["cfop-f2l", "cfop-oll", "cfop-pll"]);

/** CFOP steps shown in the practice picker (F2L / OLL / PLL). */
export function practicePickerSteps(
  methods: readonly CatalogMethod[],
): CatalogSubclass[] {
  const cfop = methods.find((method) => method.id === PRACTICE_METHOD_ID);
  if (!cfop) {
    return [];
  }
  return cfop.subclasses.filter(
    (step) => PRACTICE_STEP_IDS.has(step.id) && step.formulas.length > 0,
  );
}

export function practicePickerGroups(
  step: CatalogSubclass | null,
): FormulaGroup<CatalogSubclass["formulas"][number]>[] {
  if (!step) {
    return [];
  }
  return groupFormulas(step.formulas);
}

/** Number / short code shown on a picker thumbnail. */
export function formulaPickerCode(
  formula: { id: string; name: string },
  index: number,
): string {
  const nameMatch = formula.name.match(/\b(\d+)\b/);
  if (nameMatch) {
    return nameMatch[1]!;
  }
  const idMatch = formula.id.match(/(\d+(?:-\d+)+|\d+)$/);
  if (idMatch) {
    return idMatch[1]!;
  }
  return String(index + 1);
}

/**
 * Selecting a picker formula builds a practice case (same kernel as before).
 * Unsupported formulas return null.
 */
export function practiceCaseFromPicker(
  formula: CatalogSubclass["formulas"][number],
  algorithmIndex = 0,
): PracticeCase | null {
  return practiceCase(toPracticeFormula(formula), algorithmIndex);
}

export function toPickerFormula(
  formula: CatalogSubclass["formulas"][number],
): Formula {
  return toPracticeFormula(formula);
}

type CatalogFormula = CatalogSubclass["formulas"][number];

/** First F2L formula — used when practice opens with no selection. */
export function defaultPracticeFormula(
  methods: readonly CatalogMethod[],
): CatalogFormula | null {
  const f2l = practicePickerSteps(methods).find(
    (step) => step.id === "cfop-f2l",
  );
  return f2l?.formulas[0] ?? null;
}

/** Breadcrumb parts for the practice formula toggle (no raw `->`). */
export type FormulaPickerTrail = {
  step: string;
  group: string | null;
  name: string;
};

export function formulaPickerTrail(
  methods: readonly CatalogMethod[],
  formulaId: string | null,
): FormulaPickerTrail | null {
  if (!formulaId) {
    return null;
  }
  for (const step of practicePickerSteps(methods)) {
    const formula = step.formulas.find((item) => item.id === formulaId);
    if (!formula) {
      continue;
    }
    return {
      step: step.name,
      group: formula.group?.trim() || null,
      name: formula.name,
    };
  }
  return null;
}

/** Compact text for aria / tests: `F2L / 基础插入 / F2L 1`. */
export function formulaPickerPath(
  methods: readonly CatalogMethod[],
  formulaId: string | null,
): string | null {
  const trail = formulaPickerTrail(methods, formulaId);
  if (!trail) {
    return null;
  }
  return trail.group
    ? `${trail.step} / ${trail.group} / ${trail.name}`
    : `${trail.step} / ${trail.name}`;
}

/**
 * Outside click should close the panel without changing the selected formula.
 * Returns true when the event target is outside the picker root.
 */
export function shouldCloseFormulaPickerOnOutsideClick(
  target: EventTarget | null,
  pickerRoot: { contains(node: Node): boolean } | null,
): boolean {
  if (!pickerRoot || target === null) {
    return false;
  }
  return !pickerRoot.contains(target as Node);
}
