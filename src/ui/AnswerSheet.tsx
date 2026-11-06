import type { BranchState, Diagnosis } from "../core/diagnose";
import { linear, linearExpr, parseEquation, showEquation } from "../core/math";
import { getRule, type RuleId } from "../core/rules";
import MathText from "./MathText";
import PenMark from "./PenMark";
import { useInkEntrance } from "./InkEntrance";
import { readableEquation } from "./mathPresentation";

export default function AnswerSheet({
  problem,
  lines,
  diagnosis,
  branch,
  onEdit,
}: {
  problem: string;
  lines: string[];
  diagnosis: Diagnosis;
  branch: BranchState;
  onEdit: () => void;
}) {
  const { ref, entered } = useInkEntrance<HTMLElement>();
  const selected = branch.ids.length === 1 ? getRule(branch.ids[0]) : null;
  const evidence = diagnosis.evidence.filter((e) =>
    branch.ids.includes(e.ruleId),
  );
  let correction = "";
  if (diagnosis.before) {
    const eq = parseEquation(diagnosis.before);
    correction = showEquation({
      left: linearExpr(linear(eq.left)),
      right: linearExpr(linear(eq.right)),
    });
  }
  // Circle a tail only when the displayed line itself is a simple expansion
  // reproduced by a tail rule. Other rules keep the whole-line annotation.
  const tailRules: RuleId[] = [
    "minus-tail",
    "distribute-tail",
    "denominator-constant",
  ];
  const canCircle = evidence.some(
    (e) =>
      tailRules.includes(e.ruleId) &&
      readableEquation(e.generated) === readableEquation(diagnosis.after || ""),
  );
  const marked = canCircle
    ? diagnosis.after?.match(/([+-]\d+)=/)?.[1]
    : undefined;
  return (
    <section
      ref={ref}
      className={`answer-sheet grid-paper${entered ? " ink-entered" : ""}`}
      aria-label="答案と赤ペンの注釈"
    >
      <div className="sheet-title">
        <h2 className="paper-label">元の答案</h2>
        <span className="muted">確認した書き起こし</span>
      </div>
      <div className="sheet-problem">
        <span className="line-number">問題</span>
        <MathText value={problem} />
      </div>
      <ol className="answer-lines">
        {lines.map((line, i) => (
          <li
            className={`answer-line ${diagnosis.firstBroken === i + 1 ? "is-broken" : ""}`}
            key={i}
          >
            <span className="line-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="line-expression">
              <MathText
                value={line}
                marked={diagnosis.firstBroken === i + 1 ? marked : undefined}
              />
            </div>
            <button
              className="line-edit"
              onClick={onEdit}
              aria-label={`${i + 1} 行目の読み違いを直す`}
            >
              修正
            </button>
            {diagnosis.firstBroken === i + 1 && (
              <div className="line-annotation">
                <span className="broken-label">
                  <span className="broken-mark" aria-hidden="true">
                    !<PenMark />
                  </span>
                  最初に崩れた行
                </span>
                <p className="pen-note">
                  ↖{" "}
                  {selected
                    ? selected.explanation
                    : "この途中式に合う誤り方が複数あります。"}
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
      {correction && (
        <div className="correction-note">
          <span>正しく整理すると</span>
          <MathText value={readableEquation(correction)} />
        </div>
      )}
      {branch.history.map((h, i) => (
        <div className="sheet-next" key={i}>
          <div className="sheet-title">
            <h2 className="paper-label">
              次の一問{branch.history.length > 1 ? ` ${i + 1}` : ""}
            </h2>
            <span className="muted">追加の答えの記録</span>
          </div>
          <div className="sheet-problem">
            <span className="line-number">問題</span>
            <MathText value={readableEquation(h.probe.equation)} />
          </div>
          <div className="answer-line recorded-answer">
            <span className="line-number">答え</span>
            <MathText value={`x=${h.answer}`} />
          </div>
          <p className="pen-note">
            ↖{" "}
            {h.remaining.length
              ? "候補の誤り方で予想した答えと一致。"
              : "候補の誤り方で予想した答えとは一致しません。"}
          </p>
          <p className="hint">
            答えの値を照合。途中式は生徒に確認してください。
          </p>
        </div>
      ))}
      {selected && (
        <div className="teacher-cue">
          <span className="paper-label">声かけ</span>
          <p className="pen-note">{selected.cue}</p>
        </div>
      )}
      <button className="text-button" onClick={onEdit}>
        元の画像と読み取りを見直す →
      </button>
    </section>
  );
}
