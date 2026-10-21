import formulas from "./data/formulas-3x3.json";
import { CubeView } from "./modules/cube/CubeView.tsx";
import { FormulaList } from "./modules/formula/FormulaList.tsx";
import { parseFormulas } from "./modules/formula/formulas.ts";
import { TimerView } from "./modules/timer/TimerView.tsx";

const formulaList = parseFormulas(formulas);

export default function App() {
  return (
    <>
      <FormulaList formulas={formulaList} />
      <CubeView />
      <TimerView />
    </>
  );
}
