import { ruleIds, type RuleId } from "./rules";
import type { Hint } from "./diagnose";
export type TranscriptLine = {
  expression: string;
  unreadable: boolean;
  confidence: number;
};
export type Transcript = { lines: TranscriptLine[]; hints: Hint[] };
export type ReadInput = {
  problem: string;
  words: string;
  text?: string;
  image?: string;
  sampleId?: string;
};
export type ReadResult = {
  transcript: Transcript | null;
  mode: "mock" | "live";
  calls: number;
  manual: boolean;
  message: string;
};
export interface Provider {
  name: "mock" | "live";
  read(input: ReadInput, repair: boolean): Promise<unknown>;
}
function record(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error("JSON object required");
  return x as Record<string, unknown>;
}
export function validateTranscript(raw: unknown, words: string): Transcript {
  const v = record(raw);
  if (
    !Array.isArray(v.lines) ||
    v.lines.length < 1 ||
    v.lines.length > 20 ||
    !Array.isArray(v.hints) ||
    v.hints.length > 9
  )
    throw new Error("JSON shape");
  const lines = v.lines.map((value) => {
    const l = record(value);
    if (
      typeof l.expression !== "string" ||
      l.expression.length < 1 ||
      l.expression.length > 240 ||
      typeof l.unreadable !== "boolean" ||
      typeof l.confidence !== "number" ||
      !Number.isFinite(l.confidence) ||
      l.confidence < 0 ||
      l.confidence > 1
    )
      throw new Error("Invalid line");
    return {
      expression: l.expression,
      unreadable: l.unreadable,
      confidence: l.confidence,
    };
  });
  const hints = v.hints.map((value) => {
    const h = record(value);
    if (
      !ruleIds.includes(h.ruleId as RuleId) ||
      typeof h.quote !== "string" ||
      !h.quote.trim() ||
      h.quote.length > 500 ||
      !words.includes(h.quote)
    )
      throw new Error("Invalid evidence quote");
    return { ruleId: h.ruleId as RuleId, quote: h.quote };
  });
  return { lines, hints };
}
/** This is the only retry owner. Neither provider nor client retries requests. */
export async function transcribe(
  input: ReadInput,
  provider: Provider,
): Promise<ReadResult> {
  let calls = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: unknown;
    try {
      calls++;
      raw = await provider.read(input, attempt === 1);
    } catch {
      return {
        transcript: null,
        mode: provider.name,
        calls: provider.name === "mock" ? 0 : calls,
        manual: true,
        message:
          "読み取りに接続できませんでした。途中式を手入力して続けてください。",
      };
    }
    try {
      return {
        transcript: validateTranscript(raw, input.words),
        mode: provider.name,
        calls: provider.name === "mock" ? 0 : calls,
        manual: false,
        message:
          provider.name === "mock"
            ? "見本の固定書き起こしです。診断と問題づくりは入力から計算します。"
            : "書き起こしを確認・修正してください。AI は原因を決めていません。",
      };
    } catch {
      /* Only malformed JSON/schema gets one retry. */
    }
  }
  return {
    transcript: null,
    mode: provider.name,
    calls: provider.name === "mock" ? 0 : calls,
    manual: true,
    message:
      "書き起こしの形式を確認できませんでした。途中式を手入力して続けてください。",
  };
}
