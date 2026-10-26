import { parseFormulaLibrary } from "../modules/formula/formulas.ts";
import type { Formula, Puzzle } from "../modules/formula/types.ts";

export type CatalogFormula = {
  id: string;
  name: string;
  puzzle: Puzzle;
  methodId: string;
  methodName: string;
  subclassId: string | null;
  subclassName: string | null;
  moves: string;
  algs?: string[];
  group?: string;
  practice?: boolean;
  emptySlot?: boolean;
};

export type CatalogSubclass = {
  id: string;
  name: string;
  note?: string;
  formulas: CatalogFormula[];
};

export type CatalogMethod = {
  id: string;
  name: string;
  subclasses: CatalogSubclass[];
};

export function parseFormulaCatalog(input: unknown): CatalogMethod[] {
  return parseFormulaLibrary(input).map((method) => ({
    id: method.id,
    name: method.name,
    subclasses: method.subclasses.map((subclass) => ({
      id: subclass.id,
      name: subclass.name,
      note: subclass.note,
      formulas: subclass.formulas.map((formula) => ({
        id: formula.id,
        name: formula.name,
        puzzle: formula.puzzle,
        methodId: method.id,
        methodName: method.name,
        subclassId: subclass.id,
        subclassName: subclass.name,
        moves: formula.moves,
        algs: formula.algs,
        group: formula.group,
        practice: formula.practice,
        emptySlot: formula.emptySlot,
      })),
    })),
  }));
}

export function toPracticeFormula(formula: CatalogFormula): Formula {
  return {
    id: formula.id,
    name: formula.name,
    puzzle: formula.puzzle,
    moves: formula.moves,
    algs: formula.algs,
    group: formula.group,
    practice: formula.practice,
    emptySlot: formula.emptySlot,
  };
}

export function formulasForMethod(
  methods: CatalogMethod[],
  methodId: string,
): CatalogFormula[] | null {
  const method = methods.find((item) => item.id === methodId);
  if (!method) {
    return null;
  }
  return method.subclasses.flatMap((subclass) => subclass.formulas);
}

export function formulasForSubclass(
  methods: CatalogMethod[],
  methodId: string,
  subclassId: string,
): CatalogFormula[] | null {
  const method = methods.find((item) => item.id === methodId);
  const subclass = method?.subclasses.find((item) => item.id === subclassId);
  if (!method || !subclass) {
    return null;
  }
  return subclass.formulas;
}
