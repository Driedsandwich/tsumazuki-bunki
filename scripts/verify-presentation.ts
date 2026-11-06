import assert from "node:assert/strict";
import { linear, parseEquation } from "../src/core/math";
import { problemFamily } from "../src/core/diagnose";
import { rules } from "../src/core/rules";
import { practice } from "../src/core/practice";
import { samples } from "../src/core/samples";
import { readableEquation } from "../src/ui/mathPresentation";
let checks = 0;
function check(value: string) {
  const shown = readableEquation(value),
    before = parseEquation(value),
    after = parseEquation(shown);
  for (const side of ["left", "right"] as const) {
    const a = linear(before[side]),
      b = linear(after[side]);
    assert(a.a.eq(b.a) && a.b.eq(b.b), `Display changed ${value} to ${shown}`);
  }
  checks++;
}
for (const s of samples) [s.problem, ...s.lines].forEach(check);
for (const expression of [
  "2*(-x)=6",
  "x/(2/3)=6",
  "-(-x+2)=3",
  "0.5x+1.25=3",
  "x/3/2=6",
  "-1*(2x)=4",
  "1/2*(-x+2)=4",
])
  check(expression);
for (const r of rules)
  for (const p of practice(r.id)) if (p.kind === "equation") check(p.prompt);
let families = 0;
for (const expression of problemFamily()) {
  check(expression);
  for (const rule of rules)
    for (const rewrite of rule.apply(expression)) check(rewrite.equation);
  if (++families >= 500) break;
}
console.log(
  JSON.stringify({
    checks,
    passed: checks,
    compared: "both sides' exact linear coefficients",
    families,
  }),
);
