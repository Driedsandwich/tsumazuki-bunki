import type { BranchState } from "../core/diagnose";
import { getRule, type RuleId } from "../core/rules";
import MathText from "./MathText";
import PenMark from "./PenMark";

/** Show the existing branch result, without recomputing or delaying it. */
export default function BranchReveal({
  history,
}: {
  history: BranchState["history"];
}) {
  const latest = history[history.length - 1];
  const ids = Object.keys(latest.probe.predictions) as RuleId[];
  return (
    <div className="branch-reveal" key={history.length}>
      <div className="branch-reveal-heading">
        <div>
          <span className="eyebrow">一問の答えで確かめた結果</span>
          <h2>
            {ids.length} 候補 <span aria-hidden="true">→</span>{" "}
            {latest.remaining.length} 候補
          </h2>
        </div>
        <p className="student-answer">
          生徒の答え <MathText value={`x=${latest.answer}`} />
        </p>
      </div>
      <div className="comparison-grid">
        {ids.map((id) => {
          const matched = latest.remaining.includes(id);
          return (
            <article
              className={`comparison-card ${matched ? "is-match" : "is-ruled-out"}`}
              key={id}
            >
              <div className="comparison-status">
                <span className="match-stamp">
                  {matched ? "予測と一致" : "一致なし"}
                  {matched && <PenMark />}
                </span>
              </div>
              <p className="comparison-name">
                <strong>{getRule(id).name}</strong>
                {!matched && <PenMark kind="strike" />}
              </p>
              <div className="answer-comparison">
                <span>
                  予想 <MathText value={`x=${latest.probe.predictions[id]}`} />
                </span>
                <span
                  className="comparison-symbol"
                  aria-label={matched ? "一致" : "不一致"}
                >
                  {matched ? "=" : "≠"}
                </span>
                <span>
                  生徒 <MathText value={`x=${latest.answer}`} />
                </span>
              </div>
            </article>
          );
        })}
      </div>
      <p className="hint">
        {latest.remaining.length === 1
          ? "答えと一致した候補は1つ。生徒の考え方は、途中式と対話で確かめます。"
          : latest.remaining.length === 0
            ? "一致する候補はありません。原因を断定せず、途中式を見直します。"
            : "複数の候補が残っています。次の一問と対話で確かめます。"}
      </p>
    </div>
  );
}
