import { useRef } from "react";
import formulas from "./data/formulas-3x3.json";
import { CubeView, type CubeHandle } from "./modules/cube/CubeView.tsx";
import { FormulaList } from "./modules/formula/FormulaList.tsx";
import { parseFormulas } from "./modules/formula/formulas.ts";
import type { Formula } from "./modules/formula/types.ts";
import { ScramblePanel } from "./modules/scramble/ScramblePanel.tsx";
import type { Scramble } from "./modules/scramble/types.ts";
import { TimerView, type TimerHandle } from "./modules/timer/TimerView.tsx";

const formulaList = parseFormulas(formulas);

export default function App() {
  const cube = useRef<CubeHandle>(null);
  const timer = useRef<TimerHandle>(null);

  function onFormula(formula: Formula) {
    cube.current?.applyAlgorithm(formula.moves);
  }

  function onScramble(scramble: Scramble) {
    cube.current?.setAlgorithm(scramble.moves);
    timer.current?.prepare();
  }

  return (
    <>
      <FormulaList formulas={formulaList} onSelect={onFormula} />
      <ScramblePanel onScramble={onScramble} />
      <CubeView ref={cube} />
      <TimerView ref={timer} />
    </>
  );
}
