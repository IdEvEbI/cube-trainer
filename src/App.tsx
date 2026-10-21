import { useRef } from "react";
import formulas from "./data/formulas-3x3.json";
import { CubeView, type CubeHandle } from "./modules/cube/CubeView.tsx";
import { FormulaList } from "./modules/formula/FormulaList.tsx";
import { parseFormulas } from "./modules/formula/formulas.ts";
import type { Formula } from "./modules/formula/types.ts";
import { TimerView } from "./modules/timer/TimerView.tsx";

const formulaList = parseFormulas(formulas);

export default function App() {
  const cube = useRef<CubeHandle>(null);

  function onFormula(formula: Formula) {
    cube.current?.applyAlgorithm(formula.moves);
  }

  return (
    <>
      <FormulaList formulas={formulaList} onSelect={onFormula} />
      <CubeView ref={cube} />
      <TimerView />
    </>
  );
}
