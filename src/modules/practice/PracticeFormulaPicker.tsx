import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { CatalogMethod, CatalogSubclass } from "../../data/catalog.ts";
import { PatternIcon } from "./PatternIcon.tsx";
import { formulaPattern } from "./pattern.ts";
import {
  formulaPickerCode,
  formulaPickerPath,
  formulaPickerTrail,
  practiceCaseFromPicker,
  practicePickerGroups,
  practicePickerSteps,
  shouldCloseFormulaPickerOnOutsideClick,
  toPickerFormula,
} from "./formulaPicker.ts";
import "./practice.css";

export function PracticeFormulaPicker({
  methods,
  selectedId,
  onSelect,
}: {
  methods: CatalogMethod[];
  selectedId: string | null;
  onSelect: (formula: ReturnType<typeof toPickerFormula>) => void;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const steps = useMemo(() => practicePickerSteps(methods), [methods]);
  const [open, setOpen] = useState(true);
  const [stepId, setStepId] = useState<string | null>(steps[0]?.id ?? null);

  useEffect(() => {
    if (!stepId && steps[0]) {
      setStepId(steps[0].id);
    }
  }, [stepId, steps]);

  const step: CatalogSubclass | null =
    steps.find((item) => item.id === stepId) ?? steps[0] ?? null;
  const groups = useMemo(() => practicePickerGroups(step), [step]);
  const [groupName, setGroupName] = useState<string | null>(null);

  useEffect(() => {
    setGroupName((current) => {
      const names = groups.map((group) => group.name);
      if (current !== null && names.includes(current)) {
        return current;
      }
      return groups[0]?.name ?? null;
    });
  }, [step?.id, groups]);

  // Keep open group in sync with the selected formula.
  useEffect(() => {
    if (!selectedId) {
      return;
    }
    for (const item of steps) {
      const formula = item.formulas.find((entry) => entry.id === selectedId);
      if (!formula) {
        continue;
      }
      setStepId(item.id);
      setGroupName(formula.group ?? null);
      break;
    }
  }, [selectedId, steps]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        shouldCloseFormulaPickerOnOutsideClick(event.target, rootRef.current)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const activeGroup =
    groups.find((group) => group.name === groupName) ?? groups[0] ?? null;

  function choose(
    formula: CatalogSubclass["formulas"][number],
    event: MouseEvent<HTMLButtonElement>,
  ) {
    onSelect(toPickerFormula(formula));
    setOpen(false);
    event.currentTarget.blur();
  }

  const trail = formulaPickerTrail(methods, selectedId);
  const selectedLabel = formulaPickerPath(methods, selectedId) ?? "选择公式";

  return (
    <section ref={rootRef} className="formula-picker" aria-label="公式选择">
      <button
        type="button"
        className="formula-picker-toggle"
        aria-expanded={open}
        aria-label={selectedLabel}
        onClick={(event) => {
          setOpen((current) => !current);
          event.currentTarget.blur();
        }}
      >
        {trail ? (
          <span className="formula-picker-trail">
            <span className="formula-picker-crumb">{trail.step}</span>
            {trail.group ? (
              <>
                <span className="formula-picker-sep" aria-hidden="true">
                  /
                </span>
                <span className="formula-picker-crumb">{trail.group}</span>
              </>
            ) : null}
            <span className="formula-picker-sep" aria-hidden="true">
              /
            </span>
            <span className="formula-picker-crumb is-current">
              {trail.name}
            </span>
          </span>
        ) : (
          "选择公式"
        )}
      </button>
      {open ? (
        <div className="formula-picker-panel">
          <div
            className="formula-picker-steps"
            role="tablist"
            aria-label="步骤"
          >
            {steps.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === step?.id}
                className={
                  item.id === step?.id
                    ? "formula-picker-step is-active"
                    : "formula-picker-step"
                }
                onClick={() => setStepId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          {groups.some((group) => group.name !== null) ? (
            <div className="formula-picker-groups" aria-label="分组">
              {groups.map((group) => {
                const name = group.name ?? "全部";
                return (
                  <button
                    key={name}
                    type="button"
                    className={
                      (group.name ?? null) === (activeGroup?.name ?? null)
                        ? "formula-picker-group is-active"
                        : "formula-picker-group"
                    }
                    onClick={() => setGroupName(group.name)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="formula-picker-scroller">
            {(activeGroup?.formulas ?? []).map((formula, index) => {
              const supported = practiceCaseFromPicker(formula) !== null;
              const pattern = formulaPattern(formula.id);
              const code = formulaPickerCode(formula, index);
              return (
                <button
                  key={formula.id}
                  type="button"
                  className={
                    supported
                      ? selectedId === formula.id
                        ? "formula-picker-card is-selected"
                        : "formula-picker-card"
                      : "formula-picker-card is-unsupported"
                  }
                  aria-pressed={selectedId === formula.id}
                  disabled={!supported}
                  onClick={(event) => choose(formula, event)}
                >
                  {pattern ? (
                    <PatternIcon
                      top={pattern.top}
                      sides={pattern.sides}
                      arrows={pattern.arrows}
                      cube={pattern.cube}
                      emptySlot={pattern.emptySlot}
                      label={`${formula.name}的顶层图案`}
                      size="card"
                    />
                  ) : (
                    <span className="formula-picker-fallback">{code}</span>
                  )}
                  <span className="formula-picker-code">{code}</span>
                  <span className="formula-picker-name">{formula.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
