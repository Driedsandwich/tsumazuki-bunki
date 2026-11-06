import { useEffect, useMemo, useRef, useState } from "react";
import {
  answerBranch,
  findProbe,
  type BranchState,
  type Diagnosis,
} from "../core/diagnose";
import { getRule, type RuleId } from "../core/rules";
import Journey from "./Journey";
import ResultPanel from "./ResultPanel";
import AnswerSheet from "./AnswerSheet";
import BranchReveal from "./BranchReveal";
import MathText from "./MathText";
import { readableEquation } from "./mathPresentation";
export default function DiagnosisPanel({
  diagnosis,
  problem,
  lines,
  sampleRule,
  onEdit,
  onReset,
  onOwn,
}: {
  diagnosis: Diagnosis;
  problem: string;
  lines: string[];
  sampleRule?: RuleId;
  onEdit: () => void;
  onReset: () => void;
  onOwn: () => void;
}) {
  const [branch, setBranch] = useState<BranchState>({
      ids: diagnosis.candidates,
      rounds: 0,
      history: [],
    }),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState("");
  const reveal = useRef<HTMLElement>(null);
  useEffect(() => {
    if (branch.rounds > 0) {
      reveal.current?.focus({ preventScroll: true });
      reveal.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [branch.rounds]);
  const probe = useMemo(
    () =>
      branch.rounds < 2
        ? findProbe(
            branch.ids,
            branch.history.map((h) => h.probe.equation),
          )
        : null,
    [branch],
  );
  const unknown =
    diagnosis.status === "unknown" ||
    (diagnosis.status === "matched" && branch.ids.length === 0);
  return (
    <>
      <Journey stage={branch.ids.length > 1 && probe ? 2 : 3} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">答案から、次の指導へ</span>
          <h1>
            {diagnosis.status === "equivalent"
              ? "途中式の答えは変わっていません"
              : unknown
                ? "特定できない"
                : branch.ids.length > 1
                  ? probe
                    ? "原因を見分ける"
                    : "候補が残りました"
                  : "指導のまとめ"}
          </h1>
        </div>
        <span className="status-stamp">
          {diagnosis.status === "equivalent"
            ? "入力された途中式を照合"
            : unknown
              ? "判定を保留しています"
              : branch.ids.length > 1
                ? `候補 ${branch.ids.length} 個を照合`
                : "答案に合う誤り方が見つかりました"}
        </span>
      </div>
      {branch.ids.length > 1 && probe && (
        <p className="notice">
          答案だけでは原因を1つに絞れません。下の一問の答えで確かめます。
          <button
            className="text-button"
            onClick={() => {
              document
                .getElementById("probe-heading")
                ?.focus({ preventScroll: true });
              document.getElementById("probe-panel")?.scrollIntoView();
            }}
          >
            見分ける一問へ ↓
          </button>
        </p>
      )}
      {branch.history.length > 0 && (
        <section
          ref={reveal}
          tabIndex={-1}
          className="branch-feedback"
          aria-label="候補を絞った結果"
        >
          <BranchReveal history={branch.history} />
        </section>
      )}
      {branch.ids.length === 1 && (
        <p className="notice">
          結果が出ました。原因のまとめと、学び直す単元を確認できます。
          <button
            className="text-button"
            onClick={() => {
              document
                .getElementById("conclusion-heading")
                ?.focus({ preventScroll: true });
              document.getElementById("conclusion-heading")?.scrollIntoView();
            }}
          >
            結論と戻る単元へ ↓
          </button>
        </p>
      )}
      <div
        className={`diagnosis-layout ${branch.ids.length > 1 ? "branch-layout" : ""}`}
      >
        <AnswerSheet
          problem={problem}
          lines={lines}
          diagnosis={diagnosis}
          branch={branch}
          onEdit={onEdit}
        />
        <div className="margin-notes">
          {branch.ids.length > 1 && (
            <section className="candidate-list" aria-label="原因の候補">
              <h2>答案から見つかった候補</h2>
              {diagnosis.evidence
                .filter((e) => branch.ids.includes(e.ruleId))
                .map((e, index) => (
                  <article
                    className="candidate-card ink-reveal"
                    style={{ animationDelay: `${Math.min(index * 80, 300)}ms` }}
                    key={e.ruleId}
                  >
                    <span className="candidate-ring" aria-hidden="true">
                      ○
                    </span>
                    <div>
                      <h3>{getRule(e.ruleId).name}</h3>
                      <span className="evidence-tag">元の答案と合う誤り方</span>
                      <p className="hint">
                        この誤り方で計算すると、答案と同じ答えになります
                      </p>
                      <MathText value={readableEquation(e.generated)} />
                      {e.quote && (
                        <blockquote>
                          生徒の言葉「{e.quote}」
                          <small>原文との一致と式の再現を確認済み</small>
                        </blockquote>
                      )}
                    </div>
                  </article>
                ))}
              <p className="hint">
                未確認：生徒が実際に使った考え方。次の一問で候補を確かめます。
              </p>
            </section>
          )}
          {(unknown || diagnosis.status === "equivalent") && (
            <section className="card">
              <p>{diagnosis.message}</p>
              <p className="notice">
                {unknown
                  ? (branch.history.length
                      ? "追加問題の答えは、候補の予測と一致しませんでした。正答・別の誤り・その場の計算ミスの可能性があります。"
                      : "複数の誤りや未登録の操作は見分けられません。") +
                    " 答案を見直し、生徒に「ここで何をした？」と聞いてください。"
                  : "計算の完了や問題文に合う答えかは判定しません。x=数 まで解けているかを講師が確認してください。"}
              </p>
            </section>
          )}
          {branch.ids.length > 1 && (
            <section className="card probe-panel" id="probe-panel">
              <div className="eyebrow">
                候補 {branch.ids.length} 個 · 追加問題 {branch.rounds + 1} / 2
              </div>
              <h2 id="probe-heading" tabIndex={-1}>
                見分ける一問
              </h2>
              {sampleRule && probe && (
                <p className="notice">
                  見本では、下の「見本の答えを入れる」を押し、「この答えで候補を絞る」で結論へ進みます。AI
                  は呼びません。
                </p>
              )}
              {probe ? (
                <>
                  <div className="probe grid-paper">
                    <p className="pen-note">答えと途中式で候補を確かめる</p>
                    <MathText value={readableEquation(probe.equation)} />
                    <p className="hint">
                      この式を生徒に解いてもらってください。
                    </p>
                  </div>
                  <details className="predictions" open>
                    <summary>
                      予想される答え <span className="optional">講師用</span>
                    </summary>
                    <p className="hint">
                      生徒に答えを見せずに出題してください。
                    </p>
                    <ul>
                      {branch.ids.map((id) => (
                        <li key={id}>
                          <MathText value={`x=${probe.predictions[id]}`} />
                          <span>→ {getRule(id).name}</span>
                        </li>
                      ))}
                      <li>
                        <MathText value={`x=${probe.correct}`} />
                        <span>→ 正しい計算</span>
                      </li>
                    </ul>
                  </details>
                  <p className="notice">
                    !
                    答えだけで考え方を断定しません。途中式は生徒と一緒に確認してください。
                  </p>
                  <label htmlFor="branch-answer">生徒の答え（x の値）</label>
                  <input
                    id="branch-answer"
                    value={answer}
                    placeholder="例：-3 または x=-3"
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  {sampleRule &&
                    probe.predictions[sampleRule] !== undefined && (
                      <button
                        className="text-button"
                        onClick={() =>
                          setAnswer(probe.predictions[sampleRule]!)
                        }
                      >
                        見本の答えを入れる
                      </button>
                    )}
                  <button
                    className="primary red-button full"
                    disabled={!answer.trim()}
                    onClick={() => {
                      try {
                        setBranch(answerBranch(branch, probe, answer));
                        setAnswer("");
                        setError("");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    この答えで候補を絞る →
                  </button>
                  {error && (
                    <p role="alert" className="error">
                      {error}
                    </p>
                  )}
                  <details>
                    <summary>この問題で分かれる理由</summary>
                    <p className="hint">
                      生徒に答えを見せずに出題してください。
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>解き方</th>
                          <th>予測される x</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branch.ids.map((id) => (
                          <tr key={id}>
                            <td>{getRule(id).name}</td>
                            <td>{probe.predictions[id]}</td>
                          </tr>
                        ))}
                        <tr>
                          <td>正しい計算</td>
                          <td>{probe.correct}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="hint">
                      候補ごとに異なる答えになることを、計算で確かめています。
                    </p>
                  </details>
                </>
              ) : (
                <p className="notice">
                  特定できない：用意した問題では、これ以上候補を絞れませんでした。生徒に途中式を説明してもらい、考え方を確かめてください。
                </p>
              )}
            </section>
          )}
          {branch.ids.length === 1 && (
            <ResultPanel
              key={branch.ids[0]}
              id={branch.ids[0]}
              branched={branch.rounds > 0}
              evidence={diagnosis.evidence}
              history={branch.history}
            />
          )}
        </div>
      </div>
      <p className="hint">
        {branch.ids.length > 1 && probe
          ? "次は「見分ける一問」の答えを入れて、候補を絞ります。"
          : "ここまでで結果の確認は完了です。戻る単元と確認問題を授業に使えます。原因を特定できなかった場合は、生徒との対話で確かめてください。"}
      </p>
      <section className="actions">
        <button onClick={onEdit}>途中式を直す</button>
        <button onClick={onReset}>最初に戻る</button>
        <button className="primary" onClick={onOwn}>
          自分の入力で試す
        </button>
      </section>
    </>
  );
}
