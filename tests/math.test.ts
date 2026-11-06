import { describe, it, expect } from "vitest";
import {
  Q,
  parseEquation,
  parseExpr,
  solve,
  solutionKey,
  equivalent,
  answerValue,
} from "../src/core/math";
describe("exact rational parser and equivalence", () => {
  it.each([
    ["3x+4=19", "5"],
    ["2x+3=5x-9", "4"],
    ["2(x-3)=8", "7"],
    ["-(x+3)=5", "-8"],
    ["(2x+1)/3=(x-2)/2", "-8"],
    ["0.1x+0.2=0.3", "1"],
    [".5x=2", "4"],
    ["−４ｘ＝２０", "-5"],
    ["3×(x+2)÷2=12", "6"],
    ["x=x", "all"],
    ["x=x+1", "none"],
    ["0x=0", "all"],
    ["0x=1", "none"],
    ["2(x+3)-3(x-2)=4", "8"],
    ["1/2x=3", "6"],
    ["3/4*x=9/8", "3/2"],
  ])("%s -> %s", (s, answer) => expect(solutionKey(solve(s))).toBe(answer));
  it.each([
    "x*x=3",
    "x/(x+1)=2",
    "1/0=1",
    "x^2=2",
    "x=2=3",
    "x+=3",
    "(x+2=3",
    "x+2)=3",
    "y=2",
    "x=Infinity",
    "x=1e4",
    "x=alert(1)",
    "x=1;2",
    "x=" + "(".repeat(30) + "1" + ")".repeat(30),
  ])("rejects %s", (s) => expect(() => parseEquation(s)).toThrow());
  it.each([
    ["2x+4=10", "x=3", true],
    ["x=x", "2x=2x", true],
    ["x=x+1", "3=4", true],
    ["x=x", "x=1", false],
    ["3x=12", "x=9", false],
    [".1x=.3", "x=3", true],
  ])("compares %s and %s", (a, b, e) => expect(equivalent(a, b)).toBe(e));
  it("keeps exact large fractions and rejects zero", () => {
    expect(Q.from("0.1").add(Q.from("0.2")).toString()).toBe("3/10");
    expect(new Q(2, -4).toString()).toBe("-1/2");
    expect(() => new Q(1, 0)).toThrow();
  });
  it("normalizes numeric answers", () => {
    expect(answerValue("x = −0.5").toString()).toBe("-1/2");
    expect(answerValue("2/4").toString()).toBe("1/2");
    expect(() => answerValue("x+1")).toThrow();
    expect(() => parseExpr("2 3")).toThrow();
  });
});
