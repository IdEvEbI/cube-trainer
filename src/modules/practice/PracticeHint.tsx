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
  preferredAlgorithmIndex = 0,
  onAlgorithm,
  onSetDefaultAlgorithm,
  f2lSimplified,
  onF2lSimplified,
}: {
  practice: PracticeCase | null;
  note: string | null;
  cursor?: PracticeCursor | null;
  algorithms?: readonly string[];
  algorithmIndex?: number;
  /** Resolved preferred index (0 = catalog / unmarked). */
  preferredAlgorithmIndex?: number;
  onAlgorithm?: (index: number) => void;
  onSetDefaultAlgorithm?: () => void;
  f2lSimplified?: boolean;
  onF2lSimplified?: (value: boolean) => void;
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
              cube={pattern.cube}
              emptySlot={pattern.emptySlot}
              label={`${practice.name}的顶层图案`}
              large
            />
          ) : null}
          <p className="practice-name">{practice.name}</p>
          <div className="practice-moves">
            <p className="practice-moves-scroll">
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
            <span className="practice-length">{moveCount(source)} 步</span>
          </div>
          {algorithms.length > 1 && onAlgorithm ? (
            <div className="algorithm-picker">
              <label className="algorithm-picker-field">
                <span className="algorithm-picker-label">算法</span>
                <select
                  aria-label="选择算法"
                  value={algorithmIndex}
                  onChange={(event) => {
                    onAlgorithm(Number(event.target.value));
                  }}
                >
                  {algorithms.map((algorithm, index) => {
                    const display = formulaDisplay(algorithm);
                    let label = display;
                    if (index === preferredAlgorithmIndex) {
                      label = `默认 ${display}`;
                    } else if (index === 0 && preferredAlgorithmIndex !== 0) {
                      label = `目录 ${display}`;
                    }
                    return (
                      <option key={`${index}-${algorithm}`} value={index}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
              {onSetDefaultAlgorithm ? (
                <button
                  type="button"
                  className="algorithm-default-btn"
                  disabled={algorithmIndex === preferredAlgorithmIndex}
                  onClick={onSetDefaultAlgorithm}
                >
                  {algorithmIndex === preferredAlgorithmIndex
                    ? "当前为默认"
                    : "设为默认"}
                </button>
              ) : null}
            </div>
          ) : null}
          {practice.id.startsWith("f2l-") && onF2lSimplified ? (
            <label className="f2l-simplify">
              <input
                type="checkbox"
                checked={f2lSimplified ?? true}
                onChange={(event) => {
                  onF2lSimplified(event.target.checked);
                }}
              />
              简化显示
            </label>
          ) : null}
        </div>
      ) : (
        <p>{note ?? "选择一条公式后，步骤会显示在这里。"}</p>
      )}
    </section>
  );
}
