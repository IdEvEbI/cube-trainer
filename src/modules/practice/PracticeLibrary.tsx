import type { Formula, FormulaMethod } from "../formula/types.ts";
import { formulasForMethod, methodSteps } from "./browser.ts";
import { PatternIcon } from "./PatternIcon.tsx";
import { formulaPattern } from "./pattern.ts";
import { practiceCase } from "./setup.ts";
import "./practice.css";

export function MethodPicker({
  methods,
  onSelect,
}: {
  methods: FormulaMethod[];
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
  methods: FormulaMethod[];
  methodId: string;
  selectedId: string | null;
  note: string | null;
  onSelect: (formula: Formula) => void;
}) {
  const steps = methodSteps(methods, methodId);
  const methodName = methods.find((method) => method.id === methodId)?.name;
  if (!steps || !methodName) {
    return null;
  }

  return (
    <section className="practice-library" aria-label={methodName}>
      <h1>{methodName}</h1>
      {note ? <p className="practice-unsupported">{note}</p> : null}
      {steps.map((step) => (
        <div key={step.id} className="practice-step">
          <h2>{step.name}</h2>
          {step.formulas.length === 0 ? (
            <p className="practice-unsupported">暂不支持</p>
          ) : (
            <div className="formula-grid">
              {step.formulas.map((formula) => {
                const supported = practiceCase(formula) !== null;
                const pattern = formulaPattern(formula.id);
                return (
                  <button
                    key={formula.id}
                    type="button"
                    className={
                      supported ? "formula-card" : "formula-card is-unsupported"
                    }
                    aria-pressed={selectedId === formula.id}
                    onClick={() => onSelect(formula)}
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
