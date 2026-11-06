import {
  Q,
  X,
  constant,
  equivalent,
  linear,
  linearExpr,
  num,
  op,
  parseEquation,
  showEquation,
  solve,
  solutionKey,
  type Equation,
  type Expr,
} from "./math";
export const ruleIds = [
  "move-sign",
  "distribute-tail",
  "minus-tail",
  "negative-product",
  "divide-sign",
  "subtract-coefficient",
  "denominator-constant",
  "unlike-terms",
  "like-sign",
] as const;
export type RuleId = (typeof ruleIds)[number];
export type Rewrite = { equation: string; detail: string; solution: string };
export type Rule = {
  id: RuleId;
  name: string;
  explanation: string;
  unit: string;
  cue: string;
  apply: (equation: string) => Rewrite[];
};
type Local = (e: Expr) => Expr | null;
function sites(e: Expr, fn: Local): Expr[] {
  const out: Expr[] = [];
  const root = fn(e);
  if (root) out.push(root);
  if (e.type === "neg")
    for (const child of sites(e.child, fn)) out.push({ ...e, child });
  else if ("left" in e) {
    for (const left of sites(e.left, fn)) out.push({ ...e, left });
    for (const right of sites(e.right, fn)) out.push({ ...e, right });
  }
  return out;
}
function local(eq: Equation, fn: Local): Equation[] {
  return [
    ...sites(eq.left, fn).map((left) => ({ ...eq, left })),
    ...sites(eq.right, fn).map((right) => ({ ...eq, right })),
  ];
}
function signedTerms(e: Expr, sign = 1): Expr[] {
  if (e.type === "add")
    return [...signedTerms(e.left, sign), ...signedTerms(e.right, sign)];
  if (e.type === "sub")
    return [...signedTerms(e.left, sign), ...signedTerms(e.right, -sign)];
  return [sign === 1 ? e : { type: "neg", child: e }];
}
const sum = (items: Expr[]) => items.reduce((a, b) => op("add", a, b), num(0));
function multiplier(e: Expr): {
  a: Q;
  inner: Extract<Expr, { type: "add" | "sub" | "mul" | "div" }>;
} | null {
  let a: Q | null = null,
    inner: Expr;
  if (e.type === "neg") {
    a = new Q(-1);
    inner = e.child;
  } else if (e.type === "mul") {
    a = constant(e.left);
    inner = e.right;
    if (a === null) {
      a = constant(e.right);
      inner = e.left;
    }
  } else return null;
  if (a === null || (inner.type !== "add" && inner.type !== "sub")) return null;
  return { a, inner };
}
function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}
const lcm = (a: bigint, b: bigint) => (a / gcd(a, b)) * b;
function transform(id: RuleId, eq: Equation): Equation[] {
  if (id === "move-sign") {
    const out: Equation[] = [];
    for (const side of ["left", "right"] as const) {
      const other = side === "left" ? "right" : "left",
        terms = signedTerms(eq[side]);
      if (terms.length < 2) continue;
      terms.forEach((term, i) => {
        if (
          (side === "left" && linear(term).a.zero && !linear(term).b.zero) ||
          (side === "right" && !linear(term).a.zero && linear(term).b.zero)
        )
          out.push({
            ...eq,
            [side]: sum(terms.filter((_, j) => i !== j)),
            [other]: op("add", eq[other], term),
          });
      });
    }
    return out;
  }
  if (id === "divide-sign" || id === "subtract-coefficient") {
    const out: Equation[] = [];
    for (const side of ["left", "right"] as const) {
      const other = side === "left" ? "right" : "left",
        l = linear(eq[side]),
        r = linear(eq[other]);
      if (!l.b.zero || l.a.zero || !r.a.zero) continue;
      if (id === "divide-sign" && l.a.n < 0n)
        out.push({ left: X, right: num(r.b.div(l.a.abs())) });
      if (id === "subtract-coefficient" && !l.a.eq(new Q(1)))
        out.push({ left: X, right: num(r.b.sub(l.a)) });
    }
    return out;
  }
  if (id === "denominator-constant") {
    const l = linear(eq.left),
      r = linear(eq.right),
      m = [l.a.d, l.b.d, r.a.d, r.b.d].reduce(lcm, 1n);
    if (m === 1n) return [];
    const scale = new Q(m),
      out: Equation[] = [];
    for (const side of ["left", "right"] as const) {
      const terms = signedTerms(eq[side]);
      if (terms.length < 2) continue;
      for (const term of terms) {
        const c = constant(term);
        if (c === null || c.zero || c.d !== 1n) continue;
        const scaled = {
          left: { a: l.a.mul(scale), b: l.b.mul(scale) },
          right: { a: r.a.mul(scale), b: r.b.mul(scale) },
        };
        scaled[side].b = scaled[side].b.sub(c.mul(scale.sub(new Q(1))));
        out.push({
          left: linearExpr(scaled.left),
          right: linearExpr(scaled.right),
        });
      }
    }
    return out;
  }
  return local(eq, (e) => {
    if (id === "distribute-tail" || id === "minus-tail") {
      const m = multiplier(e);
      if (!m || m.a.zero || m.a.eq(new Q(1))) return null;
      if (id === "minus-tail" && m.a.n >= 0n) return null;
      const tail =
        id === "distribute-tail"
          ? m.inner.right
          : op("mul", num(m.a.abs()), m.inner.right);
      return op(
        m.inner.type as "add" | "sub",
        op("mul", num(m.a), m.inner.left),
        tail,
      );
    }
    if (id === "negative-product" && e.type === "mul") {
      const l = constant(e.left),
        r = constant(e.right);
      if (l && r && l.n < 0n && r.n < 0n) return num(l.mul(r).neg());
    }
    if (
      (id === "unlike-terms" || id === "like-sign") &&
      (e.type === "add" || e.type === "sub")
    ) {
      const l = linear(e.left),
        raw = linear(e.right),
        r = e.type === "sub" ? { a: raw.a.neg(), b: raw.b.neg() } : raw;
      if (
        id === "unlike-terms" &&
        ((l.b.zero && !l.a.zero && r.a.zero && !r.b.zero) ||
          (r.b.zero && !r.a.zero && l.a.zero && !l.b.zero))
      )
        return op("mul", num(l.a.add(r.a).add(l.b).add(r.b)), X);
      if (
        id === "like-sign" &&
        l.b.zero &&
        r.b.zero &&
        !l.a.zero &&
        !r.a.zero &&
        (l.a.n < 0n || r.a.n < 0n)
      )
        return op("mul", num(l.a.abs().add(r.a.abs())), X);
    }
    return null;
  });
}
const definitions: Omit<Rule, "apply">[] = [
  {
    id: "move-sign",
    name: "移項しても符号がそのまま",
    explanation: "反対側に移した項の符号を変えない規則です。",
    unit: "equality",
    cue: "移す前に、両辺から同じ数を引いて書いてみよう。",
  },
  {
    id: "distribute-tail",
    name: "かっこの後ろに掛け忘れる",
    explanation: "a(x+b) を ax+b にします。",
    unit: "distribution",
    cue: "かっこの中の一つひとつに、外の数から矢印を書こう。",
  },
  {
    id: "minus-tail",
    name: "かっこの後ろでマイナスを落とす",
    explanation: "負の数をかっこに掛けるとき、後ろの項には正の数を掛けます。",
    unit: "distribution",
    cue: "−(x+3) は (−1)×x と (−1)×3 に分けてみよう。",
  },
  {
    id: "negative-product",
    name: "負 × 負を負にする",
    explanation: "負の数どうしの積を負にします。",
    unit: "signed-products",
    cue: "符号を先に決めてから、数の大きさを掛けよう。",
  },
  {
    id: "divide-sign",
    name: "割る係数のマイナスを落とす",
    explanation: "−ax=b で、負の係数の大きさだけで割ります。",
    unit: "signed-products",
    cue: "両辺を、符号を付けた係数で割ってみよう。",
  },
  {
    id: "subtract-coefficient",
    name: "係数で割らずに引く",
    explanation: "ax=b を x=b−a にします。",
    unit: "equality",
    cue: "3x は x に 3 を足したものかな、3 を掛けたものかな。",
  },
  {
    id: "denominator-constant",
    name: "分母を払うとき定数を忘れる",
    explanation:
      "分母の最小公倍数を掛けるとき、独立した定数項一つに掛け忘れます。",
    unit: "fraction-equations",
    cue: "両辺のすべての項を囲んでから、同じ数を掛けよう。",
  },
  {
    id: "unlike-terms",
    name: "x の項と数だけの項をまとめる",
    explanation: "2x+3 を 5x のようにまとめます。",
    unit: "like-terms",
    cue: "x が付くものと、数だけのものを別の箱に分けよう。",
  },
  {
    id: "like-sign",
    name: "同類項の係数で符号を落とす",
    explanation: "符号を無視して係数の大きさを足します。",
    unit: "like-terms",
    cue: "係数だけを、符号を残してかっこの中に書いてみよう。",
  },
];
export const rules: Rule[] = definitions.map((def) => ({
  ...def,
  apply(source: string) {
    const eq = parseEquation(source);
    const seen = new Set<string>();
    const out: Rewrite[] = [];
    for (const next of transform(def.id, eq)) {
      const equation = showEquation(next);
      if (equivalent(eq, next) || seen.has(equation)) continue;
      seen.add(equation);
      out.push({
        equation,
        detail: def.explanation,
        solution: solutionKey(solve(next)),
      });
    }
    return out;
  },
}));
export const getRule = (id: RuleId) => rules.find((r) => r.id === id)!;
