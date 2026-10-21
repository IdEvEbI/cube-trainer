export type Puzzle = "2x2" | "3x3" | "4x4" | "5x5";

export interface Formula {
  id: string;
  name: string;
  puzzle: Puzzle;
  moves: string;
}

export interface FormulaSubclass {
  id: string;
  name: string;
  note?: string;
  formulas: Formula[];
}

export interface FormulaMethod {
  id: string;
  name: string;
  subclasses: FormulaSubclass[];
}
