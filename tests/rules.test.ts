import { describe, it, expect } from "vitest";
import { rules, getRule, type RuleId } from "../src/core/rules";
import { equivalent, solve, solutionKey } from "../src/core/math";
import {
  diagnose,
  findProbe,
  narrow,
  answerBranch,
} from "../src/core/diagnose";
import { samples } from "../src/core/samples";
import {
  practice,
  checkPractice,
  prerequisites,
  unitById,
} from "../src/core/practice";
const golden: [RuleId, string, string][] = [
  ["move-sign", "3x+4=19", "3x=23"],
  ["move-sign", "5x=2x+9", "7x=9"],
  ["distribute-tail", "3(x+2)=18", "3x+2=18"],
  ["distribute-tail", "2(3x-4)=10", "6x-4=10"],
  ["minus-tail", "-(x+3)=5", "-x+3=5"],
  ["minus-tail", "-2(x-4)=6", "-2x-8=6"],
  ["negative-product", "(-2)*(-3)*x=18", "-6x=18"],
  ["negative-product", "x+(-4)*(-2)=10", "x-8=10"],
  ["divide-sign", "-4x=20", "x=5"],
  ["divide-sign", "12=-3x", "x=4"],
  ["subtract-coefficient", "3x=12", "x=9"],
  ["subtract-coefficient", "-4x=20", "x=24"],
  ["denominator-constant", "x/3+2=6", "x+2=18"],
  ["denominator-constant", "x/2-3=5", "x-3=10"],
  ["unlike-terms", "2x+3=20", "5x=20"],
  ["unlike-terms", "4x-2=10", "2x=10"],
  ["like-sign", "5x-2x=12", "7x=12"],
  ["like-sign", "-2x-3x=10", "5x=10"],
];
describe("nine deterministic erroneous transformations", () => {
  it.each(golden)("%s on %s", (id, before, expected) => {
    const outputs = getRule(id).apply(before);
    expect(outputs.some((o) => equivalent(o.equation, expected))).toBe(true);
    expect(diagnose(before, [expected]).candidates).toContain(id);
    expect(outputs.every((o) => !equivalent(o.equation, before))).toBe(true);
  });
  it("does not claim an inapplicable or identity rule", () => {
    expect(getRule("negative-product").apply("3x=12")).toEqual([]);
    expect(getRule("distribute-tail").apply("1(x+2)=8")).toEqual([]);
  });
  it("finds first broken line only", () => {
    const d = diagnose("2(x+3)=14", ["2x+6=14", "2x=20", "x=10"]);
    expect(d.firstBroken).toBe(2);
    expect(d.candidates).toEqual(["move-sign"]);
  });
  it("supports a final answer without intermediate steps", () => {
    expect(diagnose("3(x+2)=18", ["x=16/3"]).candidates).toContain(
      "distribute-tail",
    );
  });
  it("does not let a model hint create or remove candidates", () => {
    const d = diagnose(
      "3x+4=19",
      ["3x=23"],
      [
        { ruleId: "negative-product", quote: "移項" },
        { ruleId: "move-sign", quote: "捏造" },
      ],
      "移項",
    );
    expect(d.candidates).toEqual(["move-sign"]);
    expect(d.evidence[0].quote).toBeUndefined();
  });
  it("attaches an exact source quote only after reproduction", () => {
    expect(
      diagnose(
        "3x+4=19",
        ["3x=23"],
        [{ ruleId: "move-sign", quote: "移項した" }],
        "移項したから",
      ).evidence[0].quote,
    ).toBe("移項した");
  });
  it("keeps unknown and valid work distinct", () => {
    expect(diagnose("2x=10", ["x=123"]).status).toBe("unknown");
    expect(diagnose("2x=10", ["x=5"]).status).toBe("equivalent");
    expect(() => diagnose("2x=10", ["?"])).toThrow();
  });
  it("separates an ambiguous sample from the correct solution", () => {
    const d = diagnose("-(x+3)=5", ["-x+3=5"]);
    expect(d.candidates).toEqual(["distribute-tail", "minus-tail"]);
    const p = findProbe(d.candidates)!;
    expect(p).not.toBeNull();
    const answers = [p.correct, ...Object.values(p.predictions)];
    expect(new Set(answers).size).toBe(d.candidates.length + 1);
    for (const a of answers)
      expect(Number.isInteger(Number(a)) && Math.abs(Number(a)) <= 20).toBe(
        true,
      );
    expect(solutionKey(solve(p.equation))).toBe(p.correct);
    for (const id of d.candidates) {
      expect(
        getRule(id)
          .apply(p.equation)
          .every((o) => solutionKey(solve(o.equation)) === p.predictions[id]),
      ).toBe(true);
      expect(narrow(d.candidates, p, p.predictions[id]!)).toEqual([id]);
    }
    expect(narrow(d.candidates, p, p.correct)).toEqual([]);
    expect(narrow(d.candidates, p, "999")).toEqual([]);
  });
  it("caps branching at two and can find another distinct problem", () => {
    const ids: RuleId[] = ["distribute-tail", "minus-tail"];
    const p = findProbe(ids)!;
    expect(findProbe(ids, [p.equation])?.equation).not.toBe(p.equation);
    expect(() =>
      answerBranch({ ids, rounds: 2, history: [] }, p, "1"),
    ).toThrow();
  });
  it("reports when no separating problem exists", () => {
    expect(findProbe(["negative-product", "denominator-constant"])).toBeNull();
  });
  it.each(samples)("sample $id reaches its expected hypothesis", (s) => {
    const d = diagnose(s.problem, s.lines);
    let ids = d.candidates;
    if (ids.length > 1) {
      const p = findProbe(ids)!;
      expect(p).not.toBeNull();
      ids = narrow(ids, p, p.predictions[s.expected]!);
    }
    expect(ids).toEqual([s.expected]);
  });
  it.each(rules)("three checkable practice problems for $id", (r) => {
    const questions = practice(r.id);
    expect(questions).toHaveLength(3);
    for (const p of questions) {
      expect(checkPractice(p, p.answer)).toBe(true);
      expect(checkPractice(p, "999")).toBe(false);
      if (p.kind === "equation")
        expect(solutionKey(solve(p.prompt))).toBe(p.answer);
    }
    expect(unitById(r.unit)).toBeDefined();
    expect(new Set(prerequisites(r.unit)).size).toBe(
      prerequisites(r.unit).length,
    );
  });
  it("has independent expected practice answers", () => {
    expect(practice("negative-product").map((p) => p.answer)).toEqual([
      "8",
      "15",
      "24",
    ]);
    expect(practice("minus-tail").map((p) => p.answer)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(practice("unlike-terms").map((p) => p.answer)).toEqual([
      "3",
      "3",
      "3",
    ]);
  });
});

it("diagnoses a long valid expression without reparsing expanded display text", () => {
  const source = `3(${"x+".repeat(38)}2)=120`;
  expect(diagnose(source, ["x=59/57"]).candidates).toContain("distribute-tail");
});
