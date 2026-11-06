import { mkdirSync, writeFileSync } from "node:fs";
import { rules, getRule, type RuleId } from "../src/core/rules";
import { diagnose, findProbe, narrow } from "../src/core/diagnose";
import { solve, solutionKey } from "../src/core/math";
import { transcribe } from "../src/core/provider";
import { createProvider } from "../server/providers";
const templates: Record<RuleId, (n: number) => string> = {
  "move-sign": (n) => `${n + 2}x+${n + 1}=${(n + 2) * 4 + n + 1}`,
  "distribute-tail": (n) => `${n + 2}(x+${n + 1})=${(n + 2) * (n + 3)}`,
  "minus-tail": (n) => `-(x+${n + 1})=${n + 4}`,
  "negative-product": (n) =>
    `(-${n + 1})*(-${n + 2})*x=${(n + 1) * (n + 2) * 3}`,
  "divide-sign": (n) => `-${n + 2}x=${(n + 2) * 4}`,
  "subtract-coefficient": (n) => `${n + 2}x=${(n + 2) * 5}`,
  "denominator-constant": (n) => `x/${n + 2}+${n + 1}=${n + 5}`,
  "unlike-terms": (n) => `${n + 2}x+${n + 1}=${(2 * n + 3) * 4}`,
  "like-sign": (n) => `${n + 4}x-${n + 1}x=${(2 * n + 5) * 3}`,
};
type BranchRecord = {
  equation: string;
  answer: string;
  correct: string;
  remaining: RuleId[];
};
type Case = {
  id: string;
  ruleId: RuleId;
  problem: string;
  lines: string[];
  candidates: RuleId[];
  initialUnique: boolean;
  retained: boolean;
  branch: BranchRecord[];
  final: RuleId[];
  correct: boolean;
  unknown: boolean;
  wrongUnique: boolean;
};
const cases: Case[] = [];
for (const rule of rules)
  for (let n = 1; n <= 6; n++) {
    const problem = templates[rule.id](n),
      generated = rule.apply(problem)[0];
    if (!generated) throw new Error(`No fixture ${rule.id}`);
    const final = solutionKey(solve(generated.equation));
    const lines = [generated.equation, `x=${final}`];
    const response = await transcribe(
      { problem, text: lines.join("\n"), words: "" },
      createProvider({ AI_PROVIDER: "mock" }),
    );
    const diagnosis = diagnose(
      problem,
      response.transcript!.lines.map((l) => l.expression),
    );
    let remaining = diagnosis.candidates;
    const branch: BranchRecord[] = [];
    for (let round = 0; round < 2 && remaining.length > 1; round++) {
      const probe = findProbe(
        remaining,
        branch.map((b) => b.equation),
      );
      if (!probe) break;
      // Synthetic student follows its generating rule on the NEW problem.
      const predicted = getRule(rule.id)
        .apply(probe.equation)
        .map((r) => solutionKey(solve(r.equation)));
      if (new Set(predicted).size !== 1) break;
      const answer = predicted[0];
      remaining = narrow(remaining, probe, answer);
      branch.push({
        equation: probe.equation,
        answer,
        correct: probe.correct,
        remaining,
      });
    }
    cases.push({
      id: `${rule.id}-${n}`,
      ruleId: rule.id,
      problem,
      lines,
      candidates: diagnosis.candidates,
      initialUnique:
        diagnosis.candidates.length === 1 &&
        diagnosis.candidates[0] === rule.id,
      retained: diagnosis.candidates.includes(rule.id),
      branch,
      final: remaining,
      correct: remaining.length === 1 && remaining[0] === rule.id,
      unknown: remaining.length !== 1,
      wrongUnique: remaining.length === 1 && remaining[0] !== rule.id,
    });
  }
const controls = [
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    kind: "unknown",
    problem: `${n + 2}x=${(n + 2) * 5}`,
    lines: [`x=${100 + n}`],
  })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    kind: "equivalent",
    problem: `${n + 2}x+${n}=${(n + 2) * 5 + n}`,
    lines: [`${n + 2}x=${(n + 2) * 5}`, "x=5"],
  })),
].map((c) => ({ ...c, actual: diagnose(c.problem, c.lines).status }));
const rows = rules.map((rule) => {
  const set = cases.filter((c) => c.ruleId === rule.id);
  return {
    id: rule.id,
    name: rule.name,
    n: set.length,
    initialUnique: set.filter((c) => c.initialUnique).length,
    retained: set.filter((c) => c.retained).length,
    finalCorrect: set.filter((c) => c.correct).length,
    unknown: set.filter((c) => c.unknown).length,
    wrongUnique: set.filter((c) => c.wrongUnique).length,
  };
});
const summary = {
  cases: cases.length,
  initialUnique: cases.filter((c) => c.initialUnique).length,
  retained: cases.filter((c) => c.retained).length,
  finalCorrect: cases.filter((c) => c.correct).length,
  unknown: cases.filter((c) => c.unknown).length,
  wrongUnique: cases.filter((c) => c.wrongUnique).length,
  controls: controls.length,
  controlsCorrect: controls.filter((c) => c.actual === c.kind).length,
};
const pct = (n: number, total: number) =>
  `${n}/${total} (${((100 * n) / total).toFixed(1)}%)`;
const md = `# mock 合成答案評価\n\n固定したパラメータ族、9 規則 × 6 問 = ${cases.length} 件。書き起こしのみ mock。初期候補・追加問題・最終判定は本体と同じコードです。\n\n|規則|件数|初回で一意正解|正しい候補を保持|追加問後の一意正解|特定できない|誤った一意判定|\n|---|---:|---:|---:|---:|---:|---:|\n${rows.map((r) => `|${r.name}|${r.n}|${pct(r.initialUnique, r.n)}|${pct(r.retained, r.n)}|${pct(r.finalCorrect, r.n)}|${pct(r.unknown, r.n)}|${r.wrongUnique}|`).join("\n")}\n|合計|${summary.cases}|${pct(summary.initialUnique, summary.cases)}|${pct(summary.retained, summary.cases)}|${pct(summary.finalCorrect, summary.cases)}|${pct(summary.unknown, summary.cases)}|${summary.wrongUnique}|\n\n対照（未登録の誤答 6 件・正しい答案 6 件）：${summary.controlsCorrect}/${summary.controls} 件が期待状態と一致。\n\n「特定できない」は候補なし、または追加問題後も一意に決められない場合。正しい候補を含むだけでは正解に数えません。追加問題の答えは生成元の規則を新しい問題に適用して作ります。\n\n**限界**：規則で合成し同じ規則実装で診断する整合性評価です。実際の生徒の原因を当てる精度、未登録の誤りに対する一般的な拒否率、画像 OCR 精度は測定していません。独立した手書き期待値の単体テストも別途実行します。全ケースは results.mock.json に収録。\n`;
mkdirSync("eval", { recursive: true });
writeFileSync(
  "eval/results.mock.json",
  JSON.stringify({ summary, rows, cases, controls }, null, 2) + "\n",
);
writeFileSync("eval/results.mock.md", md);
console.log(md);
if (
  summary.retained !== 54 ||
  summary.wrongUnique !== 0 ||
  summary.controlsCorrect !== 12 ||
  summary.finalCorrect < 48
)
  process.exitCode = 1;
