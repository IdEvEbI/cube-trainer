import { useMemo, useRef, useState } from "react";
import formulas from "./data/formulas-3x3.json";
import { CubeView, type CubeHandle } from "./modules/cube/CubeView.tsx";
import { FormulaList } from "./modules/formula/FormulaList.tsx";
import { parseFormulaLibrary } from "./modules/formula/formulas.ts";
import type { Formula } from "./modules/formula/types.ts";
import {
  browserScoreStorage,
  createScoreLog,
  type Score,
} from "./modules/score/score.ts";
import { ScoreList } from "./modules/score/ScoreList.tsx";
import { ScrambleNet } from "./modules/scramble/ScrambleNet.tsx";
import { ScramblePanel } from "./modules/scramble/ScramblePanel.tsx";
import type { Scramble } from "./modules/scramble/types.ts";
import { TimerView, type TimerHandle } from "./modules/timer/TimerView.tsx";
import "./app.css";

const formulaLibrary = parseFormulaLibrary(formulas);

export default function App() {
  const cube = useRef<CubeHandle>(null);
  const timer = useRef<TimerHandle>(null);
  const scoreLog = useMemo(() => createScoreLog(browserScoreStorage()), []);
  const [scrambleMoves, setScrambleMoves] = useState<string | null>(null);
  const [scores, setScores] = useState<Score[]>(() => scoreLog.list());
  const [scoresOpen, setScoresOpen] = useState(false);

  function onFormula(formula: Formula) {
    cube.current?.applyAlgorithm(formula.moves);
  }

  function onScramble(scramble: Scramble) {
    cube.current?.setAlgorithm(scramble.moves);
    timer.current?.prepare();
    setScrambleMoves(scramble.moves);
  }

  function onTimerStop(timeMs: number) {
    if (!scrambleMoves) {
      return;
    }
    scoreLog.record({ timeMs, scramble: scrambleMoves });
    setScores(scoreLog.list());
  }

  return (
    <div className="app">
      <FormulaList methods={formulaLibrary} onSelect={onFormula} />
      <div className="workspace">
        <div className="stage">
          <CubeView ref={cube} />
          <ScramblePanel onScramble={onScramble} />
        </div>
        <div className="side">
          <TimerView ref={timer} onStop={onTimerStop} />
          <ScoreList
            scores={scores}
            open={scoresOpen}
            onToggle={() => setScoresOpen((open) => !open)}
          />
          {scrambleMoves ? <ScrambleNet moves={scrambleMoves} /> : null}
        </div>
      </div>
    </div>
  );
}
