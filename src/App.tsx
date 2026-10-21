import { useMemo, useRef, useState, type MouseEvent } from "react";
import formulas from "./data/formula-catalog.json";
import { parseFormulaCatalog } from "./data/catalog.ts";
import { CubeView, type CubeHandle } from "./modules/cube/CubeView.tsx";
import { FormulaList } from "./modules/formula/FormulaList.tsx";
import { parseFormulaLibrary } from "./modules/formula/formulas.ts";
import type { Formula } from "./modules/formula/types.ts";
import {
  FormulaBoard,
  MethodPicker,
} from "./modules/practice/PracticeLibrary.tsx";
import { PracticeHint } from "./modules/practice/PracticeHint.tsx";
import {
  back,
  showFormulas,
  showLibrary,
  showMethods,
  showPractice,
  showTiming,
  type Focus,
} from "./modules/practice/focus.ts";
import { switchMode } from "./modules/practice/mode.ts";
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
const formulaCatalog = parseFormulaCatalog(formulas);

function modeOf(focus: Focus) {
  return focus.kind === "计时" || focus.kind === "公式库"
    ? "打乱计时"
    : "公式练习";
}

export default function App() {
  const cube = useRef<CubeHandle>(null);
  const timer = useRef<TimerHandle>(null);
  const focusRef = useRef<Focus>({ kind: "计时" });
  const scoreLog = useMemo(() => createScoreLog(browserScoreStorage()), []);
  const [scrambleMoves, setScrambleMoves] = useState<string | null>(null);
  const [scores, setScores] = useState<Score[]>(() => scoreLog.list());
  const [scoresOpen, setScoresOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);
  const [focus, setFocus] = useState<Focus>({ kind: "计时" });
  const [practice, setPractice] = useState<PracticeCase | null>(null);
  const [practiceNote, setPracticeNote] = useState<string | null>(null);
  focusRef.current = focus;

  const mode = modeOf(focus);
  const methodId =
    focus.kind === "公式" || focus.kind === "练习" ? focus.methodId : null;
  const methodName = formulaCatalog.find(
    (method) => method.id === methodId,
  )?.name;
  const showCube = focus.kind === "计时" || focus.kind === "练习";
  const showScrambleTimer = focus.kind === "计时" || focus.kind === "公式库";

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
    setFocus((current) => showPractice(current));
  }

  function onScramble(scramble: Scramble) {
    cube.current?.setAlgorithm(scramble.moves);
    timer.current?.prepare();
    setScrambleMoves(scramble.moves);
    setNetOpen(false);
  }

  function onMode(event: MouseEvent<HTMLButtonElement>) {
    const next = switchMode(mode).mode;
    setFocus(next === "公式练习" ? showMethods() : showTiming());
    event.currentTarget.blur();
  }

  function onBack(event: MouseEvent<HTMLButtonElement>) {
    setFocus((current) => back(current));
    event.currentTarget.blur();
  }

  function onTimerStop(timeMs: number) {
    const kind = focusRef.current.kind;
    if ((kind !== "计时" && kind !== "公式库") || !scrambleMoves) {
      return;
    }
    scoreLog.record({ timeMs, scramble: scrambleMoves });
    setScores(scoreLog.list());
  }

  const backLabel =
    focus.kind === "公式库"
      ? "返回计时"
      : focus.kind === "公式"
        ? "返回方法"
        : focus.kind === "练习"
          ? "返回公式"
          : null;

  return (
    <div className="app">
      <header className="topbar">
        {backLabel ? (
          <button type="button" className="nav-back" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
        <button type="button" className="mode-switch" onClick={onMode}>
          {mode === "打乱计时" ? "练习模式" : "打乱计时"}
        </button>
        {focus.kind === "计时" ? (
          <button
            type="button"
            className="library-entry"
            onClick={(event) => {
              setFocus(showLibrary());
              event.currentTarget.blur();
            }}
          >
            公式库
          </button>
        ) : null}
        {methodName && focus.kind === "练习" ? (
          <span className="topbar-title">{methodName}</span>
        ) : null}
      </header>
      <main className="focus" data-focus={focus.kind}>
        <div className="slot-scramble" hidden={focus.kind !== "计时"}>
          <ScramblePanel onScramble={onScramble} />
        </div>
        <div className="slot-cube" hidden={!showCube}>
          <CubeView ref={cube} />
        </div>
        <div className="slot-tools" hidden={focus.kind !== "计时"}>
          {showScrambleTimer ? (
            <TimerView ref={timer} onStop={onTimerStop} />
          ) : null}
          <ScoreList
            scores={scores}
            open={scoresOpen}
            onToggle={() => setScoresOpen((open) => !open)}
          />
          {scrambleMoves ? (
            <button
              type="button"
              className="net-toggle"
              aria-expanded={netOpen}
              onClick={() => setNetOpen((open) => !open)}
            >
              平面图
            </button>
          ) : null}
          {netOpen && scrambleMoves ? (
            <ScrambleNet moves={scrambleMoves} />
          ) : null}
        </div>
        <div className="slot-library" hidden={focus.kind !== "公式库"}>
          <FormulaList methods={formulaLibrary} onSelect={onFormula} />
        </div>
        <div className="slot-methods" hidden={focus.kind !== "方法"}>
          <MethodPicker
            methods={formulaCatalog}
            onSelect={(id) => {
              setPracticeNote(null);
              setFocus(showFormulas(id));
            }}
          />
        </div>
        <div className="slot-formulas" hidden={focus.kind !== "公式"}>
          {focus.kind === "公式" ? (
            <FormulaBoard
              methods={formulaCatalog}
              methodId={focus.methodId}
              selectedId={practice?.id ?? null}
              note={practiceNote}
              onSelect={onFormula}
            />
          ) : null}
        </div>
        <div className="slot-session" hidden={focus.kind !== "练习"}>
          <PracticeHint practice={practice} note={practiceNote} />
          {focus.kind === "练习" ? <TimerView /> : null}
        </div>
      </main>
    </div>
  );
}
