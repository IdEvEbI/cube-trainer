import type { PracticeCase } from "./setup.ts";
import "./practice.css";

export function PracticeHint({
  practice,
  note,
}: {
  practice: PracticeCase | null;
  note: string | null;
}) {
  return (
    <section className="practice-hint" aria-label="步骤提示">
      <h2>步骤提示</h2>
      {practice ? (
        <>
          <p className="practice-name">{practice.name}</p>
          <p className="practice-moves">{practice.forward}</p>
        </>
      ) : (
        <p>{note ?? "选择一条公式后，步骤会显示在这里。"}</p>
      )}
    </section>
  );
}
