import { useState, type MouseEvent } from "react";
import type { Formula } from "../formula/types.ts";
import { practiceCase } from "./setup.ts";

export function PracticeSwitcher({
  title,
  formulas,
  selectedId,
  onSelect,
}: {
  title: string;
  formulas: Formula[];
  selectedId: string | null;
  onSelect: (formula: Formula) => void;
}) {
  const [open, setOpen] = useState(false);

  function choose(formula: Formula, event: MouseEvent<HTMLButtonElement>) {
    onSelect(formula);
    setOpen(false);
    event.currentTarget.blur();
  }

  return (
    <section
      className={open ? "practice-switcher is-open" : "practice-switcher"}
      aria-label={title}
    >
      <button
        type="button"
        className="switcher-toggle"
        aria-expanded={open}
        onClick={(event) => {
          setOpen((current) => !current);
          event.currentTarget.blur();
        }}
      >
        公式
      </button>
      <div className="switcher-panel">
        <h2 className="switcher-title">{title}</h2>
        <ul className="switcher-list">
          {formulas.map((formula) => {
            const supported = practiceCase(formula) !== null;
            return (
              <li key={formula.id}>
                <button
                  type="button"
                  className={supported ? undefined : "is-unsupported"}
                  aria-pressed={selectedId === formula.id}
                  onClick={(event) => choose(formula, event)}
                >
                  <span>{formula.name}</span>
                  {supported ? null : <small>暂不支持</small>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
