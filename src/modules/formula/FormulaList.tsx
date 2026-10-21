import { useState } from "react";
import type { Formula } from "./types.ts";
import "./formula.css";

export function FormulaList({
  formulas,
  onSelect,
}: {
  formulas: Formula[];
  onSelect: (formula: Formula) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function choose(formula: Formula) {
    setSelectedId(formula.id);
    onSelect(formula);
  }

  return (
    <section className="formula-list">
      <h1>公式库</h1>
      <ul>
        {formulas.map((formula) => (
          <li key={formula.id}>
            <button
              type="button"
              aria-pressed={selectedId === formula.id}
              onClick={() => choose(formula)}
            >
              {formula.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="formula-hint">点击名称，把算法做到当前魔方上</p>
    </section>
  );
}
