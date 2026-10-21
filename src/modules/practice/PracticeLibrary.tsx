import {
  formulasForMethod,
  toPracticeFormula,
  type CatalogMethod,
} from "../../data/catalog.ts";
import type { Formula } from "../formula/types.ts";
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
            <div className="formula-grid">
              {subclass.formulas.map((formula) => {
                const practiceFormula = toPracticeFormula(formula);
                const supported = practiceCase(practiceFormula) !== null;
                const pattern = formulaPattern(formula.id);
                return (
                  <button
                    key={formula.id}
                    type="button"
                    className={
                      supported ? "formula-card" : "formula-card is-unsupported"
                    }
                    aria-pressed={selectedId === formula.id}
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
              })}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
