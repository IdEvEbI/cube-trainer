import { Alg } from "cubing/alg";
import type {
  Formula,
  FormulaMethod,
  FormulaSubclass,
  Puzzle,
} from "./types.ts";

/** Suffix order: 2' / '2 before bare 2 / '. Catalog prefers M'2; Alg normalizes to M2. */
const LAYER_MOVE = /^(?:[UDLRFBudlrfb]|[MES])(?:2'|'2|2|')?$/;
const PUZZLES = new Set<Puzzle>(["2x2", "3x3", "4x4", "5x5"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function readPuzzle(value: unknown, label: string): Puzzle {
  if (value === undefined) {
    return "3x3";
  }
  if (typeof value === "string" && PUZZLES.has(value as Puzzle)) {
    return value as Puzzle;
  }
  throw new Error(`${label}无效`);
}

function readOrder(value: unknown, label: string): number | null {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label}的顺序无效`);
  }
  return value;
}

function readGroup(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isNonEmptyString(value)) {
    throw new Error(`${label}的分类无效`);
  }
  return value;
}

function readPractice(value: unknown, label: string): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${label}的练习标记无效`);
  }
  return value;
}

function readAlgs(
  value: unknown,
  moves: string,
  label: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`${label}的算法无效`);
  }
  const defaultMoves = parseAlgorithm(moves).join(" ");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!isNonEmptyString(item)) {
      throw new Error(`${label}的算法无效`);
    }
    const parsed = parseAlgorithm(item).join(" ");
    if (seen.has(parsed)) {
      throw new Error(`${label}的算法重复`);
    }
    seen.add(parsed);
    if (index === 0 && parsed !== defaultMoves) {
      throw new Error(`${label}的默认算法不一致`);
    }
    return item;
  });
}

function readFormula(
  value: unknown,
  label: string,
): { formula: Formula; order: number | null } {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label}无效`);
  }
  const item = value as Record<string, unknown>;
  if (
    !isNonEmptyString(item.id) ||
    !isNonEmptyString(item.name) ||
    !isNonEmptyString(item.moves)
  ) {
    throw new Error(`${label}无效`);
  }
  parseAlgorithm(item.moves);
  const formula: Formula = {
    id: item.id,
    name: item.name,
    puzzle: readPuzzle(item.puzzle, label),
    moves: item.moves,
  };
  const algs = readAlgs(item.algs, item.moves, label);
  if (algs) {
    formula.algs = algs;
  }
  const group = readGroup(item.group, label);
  if (group) {
    formula.group = group;
  }
  if (readPractice(item.practice, label)) {
    formula.practice = true;
  }
  return {
    formula,
    order: readOrder(item.order, label),
  };
}

function sortFormulas(
  entries: Array<{ formula: Formula; order: number | null }>,
  label: string,
): Formula[] {
  const orders = entries.flatMap((entry) =>
    entry.order === null ? [] : [entry.order],
  );
  if (orders.length !== 0 && orders.length !== entries.length) {
    throw new Error(`${label}的顺序不完整`);
  }
  if (new Set(orders).size !== orders.length) {
    throw new Error(`${label}的顺序重复`);
  }
  if (orders.length === 0) {
    return entries.map((entry) => entry.formula);
  }
  return entries
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((entry) => entry.formula);
}

function readSubclass(value: unknown, label: string): FormulaSubclass {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label}无效`);
  }
  const item = value as Record<string, unknown>;
  if (!isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
    throw new Error(`${label}无效`);
  }
  if (item.note !== undefined && !isNonEmptyString(item.note)) {
    throw new Error(`${label}无效`);
  }
  if (!Array.isArray(item.formulas)) {
    throw new Error(`${label}无效`);
  }
  return {
    id: item.id,
    name: item.name,
    note: item.note,
    formulas: sortFormulas(
      item.formulas.map((formula, index) =>
        readFormula(formula, `${label}的第 ${index + 1} 条公式`),
      ),
      label,
    ),
  };
}

export function parseFormulaLibrary(input: unknown): FormulaMethod[] {
  if (!Array.isArray(input)) {
    throw new Error("公式数据必须是数组");
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
    if (methodIds.has(item.id)) {
      throw new Error(`方法 id 重复：${item.id}`);
    }
    methodIds.add(item.id);
    if (!Array.isArray(item.subclasses)) {
      throw new Error(`${methodLabel}无效`);
    }
    const subclasses = item.subclasses.map((subclass, subclassIndex) =>
      readSubclass(subclass, `${methodLabel}的第 ${subclassIndex + 1} 个子类`),
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
      id: item.id,
      name: item.name,
      subclasses,
    };
  });
}

export function collectFormulas(methods: FormulaMethod[]): Formula[] {
  return methods.flatMap((method) =>
    method.subclasses.flatMap((subclass) => subclass.formulas),
  );
}

export function formulaNames(formulas: Formula[]): string[] {
  return formulas.map((formula) => formula.name);
}

export type FormulaToken = {
  text: string;
  step: number | null;
};

const MOVE_TOKEN = /(?:[UDLRFBudlrfb]|[MES])(?:2'|'2|2|')?/y;

/**
 * Rewrite face+'2 (e.g. M'2) to face+2' for cubing/Alg.
 * Same 180° end state as face+2, but keeps the ' turning direction in animation
 * (catalog writes M'2; Twisty/SiGN uses M2').
 */
export function normalizeLayerNotation(source: string): string {
  return source.replace(/([UDLRFBudlrfbMES])'2/g, (_match, face: string) => {
    return `${face}2'`;
  });
}

function withoutGroups(source: string): string {
  const open: boolean[] = [];
  let plain = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (char === "(") {
      open.push(false);
      plain += " ";
      continue;
    }
    if (char === ")") {
      const hadMove = open.pop();
      if (hadMove === undefined) {
        throw new Error("括号不匹配");
      }
      if (!hadMove) {
        throw new Error("括号是空的");
      }
      if (open.length > 0) {
        open[open.length - 1] = true;
      }
      const next = source.slice(index + 1).trimStart()[0];
      if (next && /[0-9']/.test(next)) {
        throw new Error("括号只用于分组");
      }
      plain += " ";
      continue;
    }
    if (!/\s/.test(char) && open.length > 0) {
      open[open.length - 1] = true;
    }
    plain += char;
  }
  if (open.length > 0) {
    throw new Error("括号不匹配");
  }
  return plain;
}

export function formulaTokens(source: string): FormulaToken[] {
  const moves = parseAlgorithm(source);
  const tokens: FormulaToken[] = [];
  let step = 0;
  let cursor = 0;
  while (cursor < source.length) {
    const char = source[cursor] ?? "";
    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ text: char, step: null });
      cursor += 1;
      continue;
    }
    MOVE_TOKEN.lastIndex = cursor;
    const match = MOVE_TOKEN.exec(source);
    if (!match) {
      throw new Error(`无法按层转动：${source.slice(cursor).trim()}`);
    }
    tokens.push({ text: match[0], step });
    step += 1;
    cursor = MOVE_TOKEN.lastIndex;
  }
  if (step !== moves.length) {
    throw new Error("括号只用于分组");
  }
  return tokens;
}

export function formulaTokenGap(
  previous: FormulaToken | undefined,
  token: FormulaToken,
): string {
  if (!previous || token.text === ")" || previous.text === "(") {
    return "";
  }
  return " ";
}

export function formulaDisplay(source: string): string {
  const tokens = formulaTokens(source);
  return tokens
    .map(
      (token, index) => formulaTokenGap(tokens[index - 1], token) + token.text,
    )
    .join("");
}

export function parseAlgorithm(source: string): string[] {
  const moves = [
    ...new Alg(
      normalizeLayerNotation(withoutGroups(source)),
    ).experimentalLeafMoves(),
  ].map((move) => move.toString());
  if (moves.length === 0) {
    throw new Error("算法是空的");
  }
  const invalid = moves.find((move) => !LAYER_MOVE.test(move));
  if (invalid) {
    throw new Error(`无法按层转动：${invalid}`);
  }
  return moves;
}

export function moveCount(source: string): number {
  return parseAlgorithm(source).length;
}
