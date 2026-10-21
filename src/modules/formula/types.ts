export interface Formula {
  id: string;
  name: string;
  puzzle: "3x3";
  moves: string;
}

export interface FormulaStep {
  id: string;
  name: string;
  note?: string;
  formulas: Formula[];
}

export interface FormulaMethod {
  id: string;
  name: string;
  steps: FormulaStep[];
}
