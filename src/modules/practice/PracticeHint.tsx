import { PatternIcon } from "./PatternIcon.tsx";
import { formulaPattern } from "./pattern.ts";
import type { PracticeCase } from "./setup.ts";
import "./practice.css";

export function PracticeHint({
  practice,
  note,
}: {
  practice: PracticeCase | null;
  note: string | null;
}) {
  const pattern = practice ? formulaPattern(practice.id) : null;

  return (
    <section className="practice-hint" aria-label="步骤提示">
      <h2>步骤提示</h2>
      {practice ? (
        <div className="practice-summary">
          {pattern ? (
            <PatternIcon
              top={pattern.top}
              label={`${practice.name}的顶层图案`}
              large
            />
          ) : null}
          <p className="practice-name">{practice.name}</p>
          <p className="practice-moves">{practice.forward}</p>
        </div>
      ) : (
        <p>{note ?? "选择一条公式后，步骤会显示在这里。"}</p>
      )}
    </section>
  );
}
