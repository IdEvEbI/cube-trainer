import {
  formulaDisplay,
  formulaTokenGap,
  formulaTokens,
  moveCount,
} from "../formula/formulas.ts";
import { PatternIcon } from "./PatternIcon.tsx";
import { highlightedStep, type PracticeCursor } from "./playback.ts";
import { formulaPattern } from "./pattern.ts";
import type { PracticeCase } from "./setup.ts";
import "./practice.css";

export function PracticeHint({
  practice,
  note,
  cursor,
  algorithms = [],
  algorithmIndex = 0,
  onAlgorithm,
}: {
  practice: PracticeCase | null;
  note: string | null;
  cursor?: PracticeCursor | null;
  algorithms?: readonly string[];
  algorithmIndex?: number;
  onAlgorithm?: (index: number) => void;
}) {
  const pattern = practice ? formulaPattern(practice.id) : null;
  const source = algorithms[algorithmIndex] || practice?.forward || "";
  const tokens = practice ? formulaTokens(source) : [];
  const active = cursor ? highlightedStep(cursor) : null;

  return (
    <section className="practice-hint" aria-label="步骤提示">
      <h2>步骤提示</h2>
      {practice ? (
        <div className="practice-summary">
          {pattern ? (
            <PatternIcon
              top={pattern.top}
              sides={pattern.sides}
              arrows={pattern.arrows}
              label={`${practice.name}的顶层图案`}
              large
            />
          ) : null}
          <p className="practice-name">{practice.name}</p>
          <p className="practice-length">{moveCount(source)} 步</p>
          <p className="practice-moves">
            {tokens.map((token, index) => {
              const gap = formulaTokenGap(tokens[index - 1], token);
              if (token.step === null) {
                return (
                  <span key={`${index}-${token.text}`}>
                    {gap}
                    <span className="group">{token.text}</span>
                  </span>
                );
              }
              return (
                <span key={`${index}-${token.text}`}>
                  {gap}
                  <span
                    className={
                      token.step === active ? "step is-current" : "step"
                    }
                    aria-current={token.step === active ? "step" : undefined}
                  >
                    {token.text}
                  </span>
                </span>
              );
            })}
          </p>
          {algorithms.length > 1 && onAlgorithm ? (
            <label className="algorithm-picker">
              算法
              <select
                aria-label="选择算法"
                value={algorithmIndex}
                onChange={(event) => {
                  onAlgorithm(Number(event.target.value));
                }}
              >
                {algorithms.map((algorithm, index) => (
                  <option key={`${index}-${algorithm}`} value={index}>
                    {index === 0
                      ? `默认 ${formulaDisplay(algorithm)}`
                      : formulaDisplay(algorithm)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : (
        <p>{note ?? "选择一条公式后，步骤会显示在这里。"}</p>
      )}
    </section>
  );
}
