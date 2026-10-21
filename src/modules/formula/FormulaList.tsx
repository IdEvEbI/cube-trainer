import type { Formula } from "./types.ts";
import "./formula.css";

export function FormulaList({ formulas }: { formulas: Formula[] }) {
  return (
    <section className="formula-list">
      <h1>公式库</h1>
      <ul>
        {formulas.map((formula) => (
          <li key={formula.id}>{formula.name}</li>
        ))}
      </ul>
    </section>
  );
}
