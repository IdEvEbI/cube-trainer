import { useMemo, useRef, useState, type MouseEvent } from "react";
import formulas from "./data/formulas-3x3.json";
import { CubeView, type CubeHandle } from "./modules/cube/CubeView.tsx";
import { FormulaList } from "./modules/formula/FormulaList.tsx";
import { parseFormulaLibrary } from "./modules/formula/formulas.ts";
import type { Formula } from "./modules/formula/types.ts";
import { PracticeHint } from "./modules/practice/PracticeHint.tsx";
import { switchMode, type AppMode } from "./modules/practice/mode.ts";
import { practiceCase, type PracticeCase } from "./modules/practice/setup.ts";
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
  const [mode, setMode] = useState<AppMode>("打乱计时");
  const [practice, setPractice] = useState<PracticeCase | null>(null);
  const [practiceNote, setPracticeNote] = useState<string | null>(null);

  function onFormula(formula: Formula) {
    if (mode !== "公式练习") {
      cube.current?.applyAlgorithm(formula.moves);
      return;
    }
    const setup = practiceCase(formula);
    if (!setup) {
      setPractice(null);
      setPracticeNote(`${formula.name} 还不能练习。`);
      return;
    }
    setPracticeNote(null);
    setPractice(setup);
    cube.current?.showMoves(setup.inverse);
  }

  function onScramble(scramble: Scramble) {
    cube.current?.setAlgorithm(scramble.moves);
    timer.current?.prepare();
    setScrambleMoves(scramble.moves);
  }

  function onMode(event: MouseEvent<HTMLButtonElement>) {
    setMode((current) => switchMode(current).mode);
    event.currentTarget.blur();
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
      <div className="library">
        <button type="button" className="mode-switch" onClick={onMode}>
          {mode === "打乱计时" ? "练习模式" : "打乱计时"}
        </button>
        <FormulaList methods={formulaLibrary} onSelect={onFormula} />
      </div>
      <div className="workspace">
        <div className="stage">
          <CubeView ref={cube} />
          <div hidden={mode !== "打乱计时"}>
            <ScramblePanel onScramble={onScramble} />
          </div>
        </div>
        <div className="side">
          {mode === "打乱计时" ? (
            <>
              <TimerView ref={timer} onStop={onTimerStop} />
              <ScoreList
                scores={scores}
                open={scoresOpen}
                onToggle={() => setScoresOpen((open) => !open)}
              />
              {scrambleMoves ? <ScrambleNet moves={scrambleMoves} /> : null}
            </>
          ) : (
            <PracticeHint practice={practice} note={practiceNote} />
          )}
        </div>
      </div>
    </div>
  );
}
