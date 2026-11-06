import { useEffect, useRef, useState } from "react";
import { diagnose, type Diagnosis, type Hint } from "./core/diagnose";
import type { TranscriptLine } from "./core/provider";
import type { Sample } from "./core/samples";
import { read } from "./client";
import Journey from "./ui/Journey";
import InputPanel, { type Draft } from "./ui/InputPanel";
import ReviewPanel from "./ui/ReviewPanel";
import DiagnosisPanel from "./ui/DiagnosisPanel";
const blank: Draft = { problem: "", text: "", words: "" };
export default function App() {
  const [mode, setMode] = useState("mock"),
    [draft, setDraft] = useState<Draft>(blank),
    [step, setStep] = useState<"input" | "review" | "result">("input");
  const [lines, setLines] = useState<TranscriptLine[]>([]),
    [hints, setHints] = useState<Hint[]>([]),
    [sample, setSample] = useState<Sample | null>(null),
    [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [calls, setCalls] = useState(0),
    [spent, setSpent] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const [inputTarget, setInputTarget] = useState<"home" | "own">("home");
  useEffect(() => {
    fetch("/api/analyze", { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => setMode(v?.mode === "live" ? "live" : "mock"))
      .catch(() => setMode("mock"));
  }, []);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
    if (step === "input" && inputTarget === "own") {
      document.getElementById("problem")?.focus({ preventScroll: true });
      document.getElementById("own-answer")?.scrollIntoView();
    }
  }, [step, inputTarget]);
  function reset(target: "home" | "own" = "home") {
    setInputTarget(target);
    setDraft(blank);
    setStep("input");
    setLines([]);
    setHints([]);
    setSample(null);
    setDiagnosis(null);
    setMessage("");
    setError("");
    setCalls(0);
    setSpent(false);
  }
  function choose(s: Sample) {
    setDraft({
      problem: s.problem,
      text: s.lines.join("\n"),
      words: s.words,
      image: s.image,
    });
    setLines(
      s.lines.map((expression) => ({
        expression,
        unreadable: false,
        confidence: 1,
      })),
    );
    setSample(s);
    setHints([]);
    setCalls(0);
    setSpent(false);
    setMessage(
      "見本の写真と、用意した途中式です。見比べて確認のチェックを入れると、原因の候補へ進めます。見本は最後まで AI を呼びません。",
    );
    setError("");
    setStep("review");
  }
  async function start() {
    setBusy(true);
    setError("");
    setSample(null);
    setHints([]);
    try {
      if (draft.image && mode !== "live") {
        setError(
          "現在は新しい写真を読み取れません。写真を外して途中式を手入力するか、見本を選んでください。",
        );
        return;
      }
      if ((!draft.image && !draft.words.trim()) || mode !== "live" || spent) {
        if (!draft.text.trim())
          throw new Error(
            "読み取りは使用済みです。写真を外して途中式を手入力してください。",
          );
        setLines(
          draft.text
            .split("\n")
            .filter((s) => s.trim())
            .map((expression) => ({
              expression,
              unreadable: false,
              confidence: 1,
            })),
        );
        setMessage("手入力の途中式です。問題と各行を見比べてください。");
        setStep("review");
        return;
      }
      setSpent(true);
      const result = await read({
        problem: draft.problem,
        words: draft.words,
        ...(draft.image ? { image: draft.image } : { text: draft.text }),
      });
      setCalls(result.calls);
      setMessage(result.message);
      if (result.transcript) {
        setLines(result.transcript.lines);
        setHints(result.transcript.hints);
        setStep("review");
      } else {
        setDraft({ ...draft, image: undefined });
        setError(result.message);
      }
    } catch (e) {
      setError(
        `${(e as Error).name === "TimeoutError" ? "読み取りの待ち時間を超えました。" : (e as Error).message} 写真を外して途中式を手入力すれば続けられます。`,
      );
    } finally {
      setBusy(false);
    }
  }
  function confirm() {
    try {
      setDiagnosis(
        diagnose(
          draft.problem,
          lines.map((l) => l.expression),
          hints,
          draft.words,
        ),
      );
      setError("");
      setStep("result");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span>つまずき分岐</span>
        </div>
        <span className="demo-badge">デモ</span>
        <span className="audience">指導者向け</span>
        <span className={`mode ${mode === "live" ? "live" : ""}`}>
          {mode === "live"
            ? "写真・生徒の言葉を AI で読み取り可能"
            : "見本・手入力で試せます"}
        </span>
      </header>
      <main ref={heading} tabIndex={-1}>
        {step !== "result" && <Journey stage={1} />}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {step === "input" && (
          <InputPanel
            draft={draft}
            setDraft={setDraft}
            onRead={start}
            onSample={choose}
            busy={busy}
            mode={mode}
            spent={spent}
          />
        )}
        {step === "review" && (
          <ReviewPanel
            problem={draft.problem}
            setProblem={(problem) => setDraft({ ...draft, problem })}
            lines={lines}
            setLines={setLines}
            image={draft.image}
            message={message}
            calls={calls}
            onConfirm={confirm}
            onBack={() => {
              setDraft({
                ...draft,
                text: lines.map((l) => l.expression).join("\n"),
                image: sample ? undefined : draft.image,
              });
              setStep("input");
              setError("");
            }}
          />
        )}
        {step === "result" && diagnosis && (
          <DiagnosisPanel
            diagnosis={diagnosis}
            problem={draft.problem}
            lines={lines.map((line) => line.expression)}
            sampleRule={sample?.expected}
            onEdit={() => {
              setStep("review");
              setError("");
            }}
            onReset={() => reset()}
            onOwn={() => reset("own")}
          />
        )}
        <footer>
          <p>AI は読み取る。人が直す。コードで確かめる。</p>
          <p>
            名前は入力しません。画像・答案はアプリのサーバーに保存しません。
            <br />
            「最初に戻る」「自分の入力で試す」またはページの再読み込みで画面の記録が消えます。
          </p>
          <details>
            <summary>AI・保存・対応範囲について</summary>
            <p>
              写真と生徒の言葉を AI で読む場合は、設定された外部 AI
              提供者へ送信します。提供者側の保持条件は利用するサービスに従います。
              見本と、AI を使わない手入力の診断はブラウザ内で動きます。
            </p>
            <p>
              対象は x
              一つの一次方程式。分数・小数・かっこに対応します。未知数で割る式、二次式、文章題の意味、複数の誤りが同時に起きた場合の特定は対象外です。
            </p>
            <p>
              規則を一度当てた式と生徒の式の「解」を比較します。同じ解になる別の考え方を区別できないため、結果は指導のための仮説です。画像・答案はブラウザのメモリのみで扱い、ブラウザの永続保存は使いません。
            </p>
          </details>
        </footer>
      </main>
    </>
  );
}
