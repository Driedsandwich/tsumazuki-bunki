import { useState } from "react";
import MathText from "./MathText";
import InkEntrance from "./InkEntrance";
import type { TranscriptLine } from "../core/provider";
export default function ReviewPanel({
  problem,
  setProblem,
  lines,
  setLines,
  image,
  message,
  calls,
  onConfirm,
  onBack,
}: {
  problem: string;
  setProblem: (s: string) => void;
  lines: TranscriptLine[];
  setLines: (lines: TranscriptLine[]) => void;
  image?: string;
  message: string;
  calls: number;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const [checked, setChecked] = useState(false);
  function change(index: number, expression: string) {
    setChecked(false);
    setLines(lines.map((l, i) => (i === index ? { ...l, expression } : l)));
  }
  return (
    <section className="review-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">1 / 3 · 入れた答案を確認する</span>
          <h1>入れた答案を確認</h1>
        </div>
        <span className="status-stamp">読み違いはここで修正できます</span>
      </div>
      <p className="notice">
        問題と途中式を元の答案と見比べてください。下の確認にチェックを入れると、原因の候補へ進めます。
      </p>
      <div className="card problem-band">
        <span className="paper-label">問題</span>
        <MathText value={problem} />
        <details>
          <summary>問題の式を修正</summary>
          <label htmlFor="review-problem">問題の式</label>
          <input
            id="review-problem"
            value={problem}
            maxLength={240}
            onChange={(e) => {
              setChecked(false);
              setProblem(e.target.value);
            }}
          />
        </details>
      </div>
      <div className="review-layout">
        <section className="card source-paper">
          <h2>
            答案の写真 <span className="optional">元の答案</span>
          </h2>
          {image ? (
            <img
              className="answer-image"
              src={image}
              alt="書き起こしと照合する答案の画像"
            />
          ) : (
            <div className="grid-paper no-photo">
              <span className="paper-label">手入力の答案</span>
              <p>書き起こしの途中式を、元の答案と見比べてください。</p>
            </div>
          )}
          <div className="photo-actions">
            <button onClick={onBack}>入力をやり直す</button>
            <button onClick={() => document.getElementById("line-0")?.focus()}>
              手入力で直す
            </button>
          </div>
          <p className="hint">
            写真と書き起こしは別々に保持します。文字を直しても、元の写真は変わりません。
          </p>
        </section>
        <section className="transcript-panel">
          <h2>
            読み取り <span className="optional">文字起こし</span>
          </h2>
          <p className="muted">元の答案どおりに読めているか確認します。</p>

          {lines.map((line, index) => (
            <InkEntrance
              className="review-line ink-reveal"
              style={{ animationDelay: `${Math.min(index * 80, 300)}ms` }}
              key={index}
            >
              <label htmlFor={`line-${index}`}>
                {index + 1} 行目{" "}
                {line.unreadable || line.confidence < 0.8 ? (
                  <span className="warning-tag">
                    要確認 · 読み取りの確かさ{" "}
                    {Math.round(line.confidence * 100)}%
                  </span>
                ) : (
                  <span className="optional">
                    読み取りの確かさ {Math.round(line.confidence * 100)}%
                  </span>
                )}
              </label>
              <div className="row">
                <input
                  id={`line-${index}`}
                  value={line.expression}
                  maxLength={240}
                  onChange={(e) => change(index, e.target.value)}
                />
                <button
                  className="compact"
                  onClick={() =>
                    document.getElementById(`line-${index}`)?.focus()
                  }
                >
                  修正
                </button>
                <button
                  aria-label={`${index + 1} 行目を削除`}
                  className="compact"
                  disabled={lines.length <= 1}
                  onClick={() => {
                    setChecked(false);
                    setLines(lines.filter((_, i) => i !== index));
                  }}
                >
                  削除
                </button>
              </div>
            </InkEntrance>
          ))}
          <button
            className="text-button"
            disabled={lines.length >= 20}
            onClick={() => {
              setChecked(false);
              setLines([
                ...lines,
                { expression: "", unreadable: false, confidence: 1 },
              ]);
            }}
          >
            ＋ 行を足す
          </button>
          <p className="hint">
            読めない「?」は写真を見て直してください。式を省略した答案は、最後の答えだけでも照合できます。
          </p>
          <p className="hint">{message}</p>
          <p className="hint">
            ここまでの AI 利用は {calls} 回（上限 2 回）。この先の判定では AI
            を呼びません。
          </p>
          <p className="notice">
            次へ進むには、問題と途中式を見比べて、下の確認にチェックを入れてください。
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>問題と途中式が元の答案どおりであることを確認しました</span>
          </label>
          <button
            className="primary full"
            disabled={
              !checked ||
              lines.some(
                (l) => !l.expression.trim() || l.expression.includes("?"),
              )
            }
            onClick={onConfirm}
          >
            原因の候補を見る →
          </button>
        </section>
      </div>
      <button className="text-button" onClick={onBack}>
        ← 入力へ戻る
      </button>
    </section>
  );
}
