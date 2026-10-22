import {
  formulasForMethod,
  toPracticeFormula,
  type CatalogFormula,
  type CatalogMethod,
} from "../../data/catalog.ts";
import type { Formula } from "../formula/types.ts";
import { groupFormulas } from "./browser.ts";
import { PatternIcon } from "./PatternIcon.tsx";
import { formulaPattern } from "./pattern.ts";
import { practiceCase } from "./setup.ts";
import "./practice.css";

export function MethodPicker({
  methods,
  onSelect,
}: {
  methods: CatalogMethod[];
  onSelect: (methodId: string) => void;
}) {
  return (
    <section className="method-screen" aria-label="选择方法">
      <h1>选择方法</h1>
      <div className="method-grid">
        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            className="method-card"
            onClick={() => {
              if (formulasForMethod(methods, method.id)) {
                onSelect(method.id);
              }
            }}
          >
            {method.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function FormulaCard({
  formula,
  selected,
  onSelect,
}: {
  formula: CatalogFormula;
  selected: boolean;
  onSelect: (formula: Formula) => void;
}) {
  const practiceFormula = toPracticeFormula(formula);
  const supported = practiceCase(practiceFormula) !== null;
  const pattern = formulaPattern(formula.id);
  return (
    <button
      type="button"
      className={supported ? "formula-card" : "formula-card is-unsupported"}
      aria-pressed={selected}
      onClick={() => onSelect(practiceFormula)}
    >
      {pattern ? (
        <PatternIcon
          top={pattern.top}
          label={`${formula.name}的顶层图案`}
          size="card"
        />
      ) : null}
      <span>{formula.name}</span>
      {supported ? null : <small>暂不支持</small>}
    </button>
  );
}

export function FormulaBoard({
  methods,
  methodId,
  selectedId,
  note,
  onSelect,
}: {
  methods: CatalogMethod[];
  methodId: string;
  selectedId: string | null;
  note: string | null;
  onSelect: (formula: Formula) => void;
}) {
  const method = methods.find((item) => item.id === methodId);
  if (!method) {
    return null;
  }

  return (
    <section className="practice-library" aria-label={method.name}>
      <h1>{method.name}</h1>
      {note ? <p className="practice-unsupported">{note}</p> : null}
      {method.subclasses.map((subclass) => (
        <div key={subclass.id} className="practice-step">
          <h2>{subclass.name}</h2>
          {subclass.formulas.length === 0 ? (
            <p className="practice-unsupported">暂不支持</p>
          ) : (
            groupFormulas(subclass.formulas).map((group) => (
              <div
                key={group.name ?? subclass.id}
                className={group.name ? "practice-group" : undefined}
              >
                {group.name ? <h3>{group.name}</h3> : null}
                <div className="formula-grid">
                  {group.formulas.map((formula) => (
                    <FormulaCard
                      key={formula.id}
                      formula={formula}
                      selected={selectedId === formula.id}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </section>
  );
}
