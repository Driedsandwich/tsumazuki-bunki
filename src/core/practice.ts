import { answerValue, linear, parseExpr, solve } from "./math";
import { getRule, type RuleId } from "./rules";
import graph from "../config/units.json";
export type Practice = {
  prompt: string;
  kind: "number" | "coefficient" | "equation";
  answer: string;
  help: string;
};
export function practice(id: RuleId): Practice[] {
  const unit = getRule(id).unit;
  return [1, 2, 3].map((i) => {
    let prompt: string,
      kind: Practice["kind"] = "equation",
      help = "x の値を答えてください。",
      answer: string;
    if (id === "divide-sign") {
      prompt = `-${i + 1}x=${(i + 1) * (i + 3)}`;
    } else if (unit === "signed-products") {
      prompt = `(-${i + 1}) × (-${i + 3})`;
      kind = "number";
      help = "計算の答えを入力してください。";
    } else if (unit === "distribution") {
      prompt = `-${i + 1}(x+${i + 2})=${-(i + 1) * (2 * i + 2)}`;
    } else if (unit === "like-terms") {
      prompt = `${i + 3}x-${i}x`;
      kind = "coefficient";
      help = "まとめた式の x の係数を答えてください（3x なら 3）。";
    } else if (unit === "fraction-equations")
      prompt = `x/${i + 1}+${i + 2}=${2 * i + 3}`;
    else prompt = `${i + 1}x+${i + 2}=${(i + 1) * (i + 3) + i + 2}`;
    if (kind === "equation") {
      const s = solve(prompt);
      if (s.kind !== "one") throw new Error("確認問題の生成失敗");
      answer = s.value.toString();
    } else {
      const l = linear(parseExpr(prompt));
      answer = (kind === "number" ? l.b : l.a).toString();
    }
    return { prompt, kind, answer, help };
  });
}
export const checkPractice = (p: Practice, answer: string) =>
  answerValue(answer).toString() === p.answer;
export const unitById = (id: string) => graph.nodes.find((n) => n.id === id)!;
export function prerequisites(id: string): string[] {
  const seen = new Set<string>();
  const visit = (key: string) => {
    for (const parent of unitById(key).prerequisites) {
      visit(parent);
      seen.add(parent);
    }
  };
  visit(id);
  return [...seen];
}
