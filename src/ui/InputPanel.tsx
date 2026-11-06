import { useRef, useState } from "react";
import { samples, type Sample } from "../core/samples";
import CostNotice from "./CostNotice";
import MathText from "./MathText";
import { prepareImage } from "../client";
export type Draft = {
  problem: string;
  text: string;
  words: string;
  image?: string;
};
export default function InputPanel({
  draft,
  setDraft,
  onRead,
  onSample,
  busy,
  mode,
  spent,
}: {
  draft: Draft;
  setDraft: (v: Draft) => void;
  onRead: () => void;
  onSample: (s: Sample) => void;
  busy: boolean;
  mode: string;
  spent: boolean;
}) {
  const [imageError, setImageError] = useState("");
  const serial = useRef(0);
  const [loading, setLoading] = useState(false);
  const usesAI =
    mode === "live" && !spent && (!!draft.image || !!draft.words.trim());
  return (
    <>
      <div className="home-overview">
        <section className="intro">
          <div className="eyebrow">
            中学1年・一次方程式 ／ 指導者のための授業支援
          </div>
          <h1>
            その誤答、
            <br />
            どこでつまずいた？
          </h1>
          <p className="hero-description">
            誤答の原因を一問で見分け、
            <br className="wide" />
            戻る単元までつなぐ授業支援アプリ。
          </p>
          <button
            className="primary red-button demo-start"
            disabled={busy || loading}
            onClick={() => onSample(samples[1])}
          >
            見本で試す <span aria-hidden="true">→</span>
          </button>
          <p className="hint">
            見本の答案が開き、原因の候補から戻る単元まで試せます。
          </p>
          <CostNotice />
          <button
            className="text-button"
            onClick={() => {
              document
                .getElementById("problem")
                ?.focus({ preventScroll: true });
              document.getElementById("own-answer")?.scrollIntoView();
            }}
          >
            自分の答案を入れる（写真・手入力） ↓
          </button>
          <div className="home-answer grid-paper">
            <span className="paper-label">生徒の答案に、戻って考える。</span>
            <MathText value={samples[1].problem} />
            <div className="home-error">
              <MathText value={samples[1].lines[0]} marked="+3" />
              <span className="pen-note">← ここで、なぜ？</span>
            </div>
          </div>
        </section>
        <section className="card sample-section">
          <div className="section-title">
            <h2>ほかの見本も試せます</h2>
          </div>
          <p className="muted">どの見本も AI を呼ばずに試せます。</p>
          <div className="sample-grid">
            {samples.map((s, i) => (
              <button
                className="sample"
                key={s.id}
                disabled={busy || loading}
                onClick={() => onSample(s)}
              >
                <span className="sample-number">0{i + 1}</span>
                <span className="sample-content">
                  <strong>{s.title}</strong>
                  <span className="sample-equation">{s.problem}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="card new-answer" id="own-answer">
        <div className="section-title">
          <h2>自分の答案を入れる</h2>
        </div>
        <label htmlFor="problem">問題の式</label>
        <input
          id="problem"
          value={draft.problem}
          maxLength={240}
          placeholder="例：3x + 4 = 19"
          disabled={busy || loading}
          onChange={(e) => setDraft({ ...draft, problem: e.target.value })}
        />
        <p className="hint">
          分数は x/3、かっこは 2(x+3)、小数は 0.5x と書けます。
        </p>
        <label htmlFor="work">
          生徒の途中式 <span className="optional">1 行に 1 つの等式</span>
        </label>
        <textarea
          id="work"
          rows={4}
          value={draft.text}
          maxLength={5000}
          placeholder={"3x = 19 + 4\nx = 23/3"}
          disabled={busy || loading || !!draft.image}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        />
        <div className="upload">
          <label htmlFor="photo">または、答案の写真を選ぶ</label>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || loading}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const request = ++serial.current;
              setLoading(true);
              setImageError("");
              try {
                const image = await prepareImage(f);
                if (request === serial.current) setDraft({ ...draft, image });
              } catch (error) {
                setImageError((error as Error).message);
              } finally {
                if (request === serial.current) setLoading(false);
                e.target.value = "";
              }
            }}
          />
          <p className="hint">
            JPEG・PNG・WebP、12 MB
            まで。名前が写らないよう式の部分だけにしてください。
          </p>
          {mode !== "live" && (
            <p className="notice">
              現在は見本・手入力で試せます。新しい写真は自動では読み取れません。見本の写真、または新しい途中式の手入力で試せます。
            </p>
          )}
          {loading && <p role="status">写真を準備しています…</p>}
          {imageError && (
            <p role="alert" className="error">
              {imageError}
            </p>
          )}
          {draft.image && (
            <>
              <img
                className="answer-image"
                src={draft.image}
                alt="選んだ生徒の答案"
              />
              <button
                className="text-button"
                onClick={() => {
                  serial.current++;
                  setDraft({ ...draft, image: undefined });
                }}
              >
                写真を外して手入力する
              </button>
            </>
          )}
        </div>
        <label htmlFor="words">
          生徒の言葉 <span className="optional">任意</span>
        </label>
        <textarea
          id="words"
          rows={2}
          maxLength={1000}
          value={draft.words}
          disabled={busy || loading}
          placeholder="例：移項したから、足しました。"
          onChange={(e) => setDraft({ ...draft, words: e.target.value })}
        />
        <p className="hint">
          生徒がどう考えたかを書けます。AI
          が使えるときは、この言葉も読み取ります。
        </p>
        <CostNotice />
        <p className="hint">
          {usesAI
            ? "押すと写真や生徒の言葉を AI に送り、途中式の確認画面へ進みます。"
            : draft.image && mode !== "live"
              ? "現在は写真を読み取れません。写真を外して、途中式を手入力してください。"
              : "手入力の式を確認する画面へ進みます。AI は呼びません。"}
        </p>
        <button
          className="primary full"
          disabled={
            busy ||
            loading ||
            !draft.problem.trim() ||
            (!draft.image && !draft.text.trim())
          }
          onClick={onRead}
        >
          {busy
            ? "AI で読み取り中…（最長 53 秒）"
            : usesAI
              ? "AI で読む（数秒かかります）"
              : "途中式を確認する →"}
        </button>
      </section>
    </>
  );
}
