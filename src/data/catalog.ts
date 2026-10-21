import { parseAlgorithm } from "../modules/formula/formulas.ts";

export type CatalogFormula = {
  id: string;
  name: string;
  methodId: string;
  methodName: string;
  subclassId: string | null;
  subclassName: string | null;
  moves: string;
};

export type CatalogSubclass = {
  id: string;
  name: string;
  formulas: CatalogFormula[];
};

export type CatalogMethod = {
  id: string;
  name: string;
  subclasses: CatalogSubclass[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function readFormula(
  value: unknown,
  label: string,
  methodId: string,
  methodName: string,
  subclassId: string,
  subclassName: string,
): CatalogFormula {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label}无效`);
  }
  const item = value as Record<string, unknown>;
  if (!isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
    throw new Error(`${label}无效`);
  }
  if (!isNonEmptyString(item.moves)) {
    throw new Error(`${label}无效`);
  }
  parseAlgorithm(item.moves);
  return {
    id: item.id,
    name: item.name,
    methodId,
    methodName,
    subclassId,
    subclassName,
    moves: item.moves,
  };
}

function readSubclass(
  value: unknown,
  label: string,
  methodId: string,
  methodName: string,
): CatalogSubclass {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label}无效`);
  }
  const item = value as Record<string, unknown>;
  if (!isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
    throw new Error(`${label}无效`);
  }
  if (!Array.isArray(item.formulas)) {
    throw new Error(`${label}无效`);
  }
  const subclassId = item.id;
  const subclassName = item.name;
  return {
    id: subclassId,
    name: subclassName,
    formulas: item.formulas.map((formula, index) =>
      readFormula(
        formula,
        `${label}的第 ${index + 1} 条公式`,
        methodId,
        methodName,
        subclassId,
        subclassName,
      ),
    ),
  };
}

export function parseFormulaCatalog(input: unknown): CatalogMethod[] {
  if (!Array.isArray(input)) {
    throw new Error("公式目录必须是数组");
  }
  const methodIds = new Set<string>();
  const subclassIds = new Set<string>();
  const formulaIds = new Set<string>();
  return input.map((value, methodIndex) => {
    const methodLabel = `第 ${methodIndex + 1} 个方法`;
    if (typeof value !== "object" || value === null) {
      throw new Error(`${methodLabel}无效`);
    }
    const item = value as Record<string, unknown>;
    if (!isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
      throw new Error(`${methodLabel}无效`);
    }
    const methodId = item.id;
    const methodName = item.name;
    if (methodIds.has(methodId)) {
      throw new Error(`方法 id 重复：${methodId}`);
    }
    methodIds.add(methodId);
    if (!Array.isArray(item.subclasses)) {
      throw new Error(`${methodLabel}无效`);
    }
    const subclasses = item.subclasses.map((subclass, subclassIndex) =>
      readSubclass(
        subclass,
        `${methodLabel}的第 ${subclassIndex + 1} 个子类`,
        methodId,
        methodName,
      ),
    );
    for (const subclass of subclasses) {
      if (subclassIds.has(subclass.id)) {
        throw new Error(`子类 id 重复：${subclass.id}`);
      }
      subclassIds.add(subclass.id);
      for (const formula of subclass.formulas) {
        if (formulaIds.has(formula.id)) {
          throw new Error(`公式 id 重复：${formula.id}`);
        }
        formulaIds.add(formula.id);
      }
    }
    return {
      id: methodId,
      name: methodName,
      subclasses,
    };
  });
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
