import { parseAlgorithm } from "../formula/formulas.ts";
import { PatternIcon } from "./PatternIcon.tsx";
import { highlightedStep, type PracticeCursor } from "./playback.ts";
import { formulaPattern } from "./pattern.ts";
import type { PracticeCase } from "./setup.ts";
import "./practice.css";

export function PracticeHint({
  practice,
  note,
  cursor,
}: {
  practice: PracticeCase | null;
  note: string | null;
  cursor?: PracticeCursor | null;
}) {
  const pattern = practice ? formulaPattern(practice.id) : null;
  const moves =
    cursor?.forward ?? (practice ? parseAlgorithm(practice.forward) : []);
  const active = cursor ? highlightedStep(cursor) : null;

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
          <p className="practice-moves">
            {moves.map((move, index) => (
              <span key={`${index}-${move}`}>
                {index > 0 ? " " : null}
                <span
                  className={index === active ? "step is-current" : "step"}
                  aria-current={index === active ? "step" : undefined}
                >
                  {move}
                </span>
              </span>
            ))}
          </p>
        </div>
      ) : (
        <p>{note ?? "选择一条公式后，步骤会显示在这里。"}</p>
      )}
    </section>
  );
}
