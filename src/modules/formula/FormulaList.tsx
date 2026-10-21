import { useState } from "react";
import type { Formula, FormulaMethod } from "./types.ts";
import "./formula.css";

export function FormulaList({
  methods,
  onSelect,
}: {
  methods: FormulaMethod[];
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
      {methods.map((method, index) => (
        <details key={method.id} className="formula-method" open={index === 0}>
          <summary>{method.name}</summary>
          {method.steps.map((step) => (
            <details key={step.id} className="formula-step">
              <summary>{step.name}</summary>
              {step.note ? <p className="formula-note">{step.note}</p> : null}
              {step.formulas.length > 0 ? (
                <ul>
                  {step.formulas.map((formula) => (
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
              ) : null}
            </details>
          ))}
        </details>
      ))}
      <p className="formula-hint">点名称，把算法做到当前魔方上</p>
    </section>
  );
}
