import {
  equivalent,
  parseEquation,
  solve,
  solutionKey,
  answerValue,
} from "./math";
import { rules, getRule, type RuleId } from "./rules";
export type Hint = { ruleId: RuleId; quote: string };
export type Evidence = {
  ruleId: RuleId;
  generated: string;
  student: string;
  quote?: string;
};
export type Diagnosis = {
  status: "matched" | "unknown" | "equivalent";
  firstBroken: number | null;
  before?: string;
  after?: string;
  candidates: RuleId[];
  evidence: Evidence[];
  checked: number;
  message: string;
};
export function diagnose(
  problem: string,
  lines: string[],
  hints: Hint[] = [],
  words = "",
): Diagnosis {
  if (!lines.length || lines.length > 20)
    throw new Error("途中式は 1〜20 行で入力してください。");
  const all = [problem, ...lines];
  all.forEach((s, i) => {
    try {
      parseEquation(s);
    } catch (e) {
      throw new Error(
        `${i === 0 ? "問題" : `答案 ${i} 行目`}: ${(e as Error).message}`,
      );
    }
  });
  let first = -1;
  for (let i = 1; i < all.length; i++)
    if (!equivalent(all[i - 1], all[i])) {
      first = i;
      break;
    }
  if (first < 0)
    return {
      status: "equivalent",
      firstBroken: null,
      candidates: [],
      evidence: [],
      checked: lines.length,
      message:
        "入力された行はすべて同値です。この途中式から誤りは見つかりません。",
    };
  const before = all[first - 1],
    after = all[first],
    evidence: Evidence[] = [];
  const studentSolution = solutionKey(solve(after));
  for (const rule of rules) {
    const generated = rule
      .apply(before)
      .find((r) => r.solution === studentSolution);
    if (generated) {
      const hint = hints.find(
        (h) =>
          h.ruleId === rule.id && h.quote.trim() && words.includes(h.quote),
      );
      evidence.push({
        ruleId: rule.id,
        generated: generated.equation,
        student: after,
        ...(hint ? { quote: hint.quote } : {}),
      });
    }
  }
  const candidates = evidence.map((e) => e.ruleId);
  return {
    status: candidates.length ? "matched" : "unknown",
    firstBroken: first,
    before,
    after,
    candidates,
    evidence,
    checked: first,
    message: candidates.length
      ? "誤りの規則で、この行の解を再現できました。"
      : "特定できない：登録した 9 つの規則では、この行を再現できません。講師が途中式を確認してください。",
  };
}
export type Probe = {
  equation: string;
  correct: string;
  predictions: Partial<Record<RuleId, string>>;
};
function prediction(id: RuleId, equation: string): string | null {
  const keys = new Set(
    getRule(id)
      .apply(equation)
      .map((r) => r.solution),
  );
  // A rule with multiple possible outcomes is not used as a separating question.
  if (keys.size !== 1) return null;
  const key = [...keys][0];
  if (!/^-?\d+$/.test(key) || Math.abs(Number(key)) > 20) return null;
  return key;
}
/** Enumerated families, varied parameters; a probe must separate every rule and the correct answer. */
export function* problemFamily(): Generator<string> {
  for (const a of [-2, -3, -4, -1, 2, 3, 4])
    for (const b of [2, 3, 4, 1, -2, -3])
      for (let c = -18; c <= 18; c += 2) {
        yield `${a}(x+(${b}))=${c}`;
        yield `${a}x+(${b})=${c}`;
        yield `${a}x=${c}`;
        yield `x/${Math.abs(a)}+(${b})=${c}`;
        yield `${a}x+(${b})x=${c}`;
        yield `(-${Math.abs(a)})*(-${Math.abs(b)})*x=${c}`;
      }
}
const probeCache = new Map<string, Probe | null>();
export function findProbe(
  ids: RuleId[],
  excluded: string[] = [],
): Probe | null {
  if (ids.length < 2) return null;
  const key = [...ids].sort().join(",") + "|" + excluded.join(";");
  if (probeCache.has(key)) return probeCache.get(key)!;
  for (const equation of problemFamily()) {
    if (excluded.includes(equation)) continue;
    const correct = solutionKey(solve(equation));
    if (!/^-?\d+$/.test(correct) || Math.abs(Number(correct)) > 20) continue;
    const predictions: Partial<Record<RuleId, string>> = {};
    const answers = new Set([correct]);
    let valid = true;
    for (const id of ids) {
      const answer = prediction(id, equation);
      if (answer === null || answers.has(answer)) {
        valid = false;
        break;
      }
      answers.add(answer);
      predictions[id] = answer;
    }
    if (valid) {
      const probe = { equation, correct, predictions };
      probeCache.set(key, probe);
      return probe;
    }
  }
  probeCache.set(key, null);
  return null;
}
export function narrow(ids: RuleId[], probe: Probe, answer: string): RuleId[] {
  const value = answerValue(answer).toString();
  return ids.filter((id) => probe.predictions[id] === value);
}
export type BranchState = {
  ids: RuleId[];
  rounds: number;
  history: { probe: Probe; answer: string; remaining: RuleId[] }[];
};
export function answerBranch(
  state: BranchState,
  probe: Probe,
  answer: string,
): BranchState {
  if (state.rounds >= 2) throw new Error("見分ける一問は 2 回までです。");
  if (state.ids.some((id) => probe.predictions[id] === undefined))
    throw new Error("候補に対応しない問題です。");
  const ids = narrow(state.ids, probe, answer);
  return {
    ids,
    rounds: state.rounds + 1,
    history: [
      ...state.history,
      { probe, answer: answerValue(answer).toString(), remaining: ids },
    ],
  };
}
