import { useState } from "react";
import type { BranchState, Evidence } from "../core/diagnose";
import MathText from "./MathText";
import PenMark from "./PenMark";
import InkEntrance from "./InkEntrance";
import { readableEquation } from "./mathPresentation";
import { getRule, type RuleId } from "../core/rules";
import {
  practice,
  checkPractice,
  prerequisites,
  unitById,
} from "../core/practice";
export default function ResultPanel({
  id,
  branched,
  evidence,
  history,
}: {
  id: RuleId;
  branched: boolean;
  evidence: Evidence[];
  history: BranchState["history"];
}) {
  const rule = getRule(id),
    questions = practice(id);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [checked, setChecked] = useState<(boolean | null)[]>([
    null,
    null,
    null,
  ]);
  const [error, setError] = useState("");
  return (
    <section className="result">
      <InkEntrance className="card conclusion">
        <div className="conclusion-top">
          <span className="paper-label">一致した原因</span>
          <div className="eyebrow">
            {branched ? "✓ 元の答案＋追加の答えで一致" : "✓ 途中式の再現で一致"}
          </div>
        </div>
        <h2
          id="conclusion-heading"
          tabIndex={-1}
          className="written-cause"
          aria-label={rule.name}
        >
          <span aria-hidden="true">
            {Array.from(rule.name).map((letter, index) => (
              <span
                className="written-letter"
                style={{ animationDelay: `${Math.min(index * 18, 300)}ms` }}
                key={index}
              >
                {letter}
              </span>
            ))}
          </span>
          <PenMark kind="underline" />
        </h2>
        <p className="pen-note">{rule.explanation}</p>
      </InkEntrance>
      <section className="card rule-evidence">
        <h3 className="paper-label">この原因が考えられる理由</h3>
        {evidence
          .filter((e) => e.ruleId === id)
          .map((e) => (
            <div key={e.ruleId}>
              <p className="evidence-caption">この誤り方で計算すると</p>
              <MathText value={readableEquation(e.generated)} />
              <p className="hint">生徒の途中式と同じ答えになります。</p>
              {e.quote && (
                <blockquote>
                  生徒の言葉「{e.quote}」<small>原文と照合済み</small>
                </blockquote>
              )}
            </div>
          ))}
        {history.map((h, i) => (
          <div key={i}>
            <p className="evidence-caption">次の一問に対する答え</p>
            <MathText value={readableEquation(h.probe.equation)} />
            <p>
              <MathText value={`x=${h.answer}`} />{" "}
              <span className="evidence-tag">
                {h.remaining.includes(id) ? "予測値と一致" : "一致なし"}
              </span>
            </p>
          </div>
        ))}
      </section>
      {evidence.some((e) => e.ruleId !== id) && (
        <section className="card other-candidates">
          <h3 className="paper-label">他の候補</h3>
          {evidence
            .filter((e) => e.ruleId !== id)
            .map((e) => (
              <p key={e.ruleId}>
                {getRule(e.ruleId).name}：追加の答えとは一致なし
              </p>
            ))}
        </section>
      )}
      <p className="notice">
        これは答案と一致した誤り方の仮説です。生徒の考えを断定するものではありません。次の確認問題と対話で確かめてください。
      </p>
      <InkEntrance className="card return-unit">
        <div className="return-connection" aria-hidden="true">
          <PenMark kind="arrow" />
          <span>ここから、学び直す</span>
        </div>
        <span className="eyebrow">戻る単元</span>
        <h3>{unitById(rule.unit).name}</h3>
        <p className="cue">「{rule.cue}」</p>
        <details>
          <summary>単元のつながりを見る</summary>
          <ol className="unit-path">
            {prerequisites(rule.unit).map((id) => (
              <li key={id}>{unitById(id).name}</li>
            ))}
            <li>
              <strong>{unitById(rule.unit).name} ← 今回戻るところ</strong>
            </li>
          </ol>
          <p className="hint">
            前提関係から並べています。前の単元すべてが未習得という意味ではありません。
          </p>
        </details>
      </InkEntrance>
      <section className="card practice-section" id="practice-section">
        <h3 className="paper-label">確認問題（理解の定着）</h3>
        <p className="muted">
          学び直したあとに解く3問です。生徒の答えを入れて確かめます。
        </p>
        <div className="practice-grid">
          {questions.map((p, i) => (
            <div
              className={`practice ${checked[i] === true ? "practice-correct" : ""}`}
              key={i}
            >
              <label htmlFor={`practice-${i}`}>
                <span className="practice-number">
                  {["①", "②", "③"][i]}
                  {checked[i] === true && <PenMark />}
                </span>
                <MathText value={p.prompt} />
              </label>
              <p className="hint">{p.help}</p>
              <div className="row">
                <input
                  id={`practice-${i}`}
                  value={answers[i]}
                  placeholder="答え"
                  onChange={(e) => {
                    setAnswers(
                      answers.map((a, j) => (i === j ? e.target.value : a)),
                    );
                    setChecked(checked.map((a, j) => (i === j ? null : a)));
                  }}
                />
                <button
                  onClick={() => {
                    try {
                      const ok = checkPractice(p, answers[i]);
                      setChecked(checked.map((a, j) => (i === j ? ok : a)));
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  確かめる
                </button>
              </div>
              {checked[i] !== null && (
                <p role="status" className={checked[i] ? "success" : "error"}>
                  {checked[i]
                    ? "一致しました。"
                    : "もう一度、符号と操作を確認しましょう。"}
                </p>
              )}
              <details>
                <summary>講師用：答えを見る</summary>
                <p className="math">
                  {p.kind === "equation" ? "x = " : ""}
                  {p.answer}
                </p>
              </details>
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {checked.every((v) => v === true) && (
          <div className="completion" role="status">
            3
            問とも一致しました。元の問題に戻って、生徒自身に解き直してもらいましょう。
          </div>
        )}
      </section>
    </section>
  );
}
