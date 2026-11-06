/** No eval, floating-point comparison, or model inference. All arithmetic is exact. */
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};
export class Q {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint | number, d: bigint | number = 1n) {
    n = BigInt(n);
    d = BigInt(d);
    if (!d) throw new Error("0 では割れません。");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
    if (this.n.toString().length > 100 || this.d.toString().length > 100)
      throw new Error("数が大きすぎます。");
  }
  static from(s: string): Q {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))
      throw new Error("数の書き方を確認してください。");
    const sign = s.startsWith("-") ? -1n : 1n;
    s = s.replace(/^[+-]/, "");
    const [a, b = ""] = s.split(".");
    return new Q(sign * BigInt((a || "0") + b), 10n ** BigInt(b.length));
  }
  add(q: Q) {
    return new Q(this.n * q.d + q.n * this.d, this.d * q.d);
  }
  sub(q: Q) {
    return this.add(q.neg());
  }
  mul(q: Q) {
    return new Q(this.n * q.n, this.d * q.d);
  }
  div(q: Q) {
    return new Q(this.n * q.d, this.d * q.n);
  }
  neg() {
    return new Q(-this.n, this.d);
  }
  abs() {
    return this.n < 0n ? this.neg() : this;
  }
  eq(q: Q) {
    return this.n === q.n && this.d === q.d;
  }
  get zero() {
    return this.n === 0n;
  }
  toString() {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
  }
}
export type Expr =
  | { type: "num"; value: Q }
  | { type: "x" }
  | { type: "neg"; child: Expr }
  | { type: "add" | "sub" | "mul" | "div"; left: Expr; right: Expr };
export type Equation = { left: Expr; right: Expr };
export const num = (v: Q | number): Expr => ({
  type: "num",
  value: v instanceof Q ? v : new Q(v),
});
export const X: Expr = { type: "x" };
export const op = (
  type: "add" | "sub" | "mul" | "div",
  left: Expr,
  right: Expr,
): Expr => ({ type, left, right });
export function normalizeInput(text: string) {
  const normalized = text.normalize("NFKC");
  if (/\d\s+\d/.test(normalized))
    throw new Error("数と数の間に計算記号が必要です。");
  return normalized
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[ｘＸX]/g, "x")
    .replace(/[\s\u3000]/g, "");
}
export function parseExpr(text: string): Expr {
  const s = normalizeInput(text);
  if (!s || s.length > 240)
    throw new Error("式は 1〜240 文字で入力してください。");
  const tokens = s.match(/(?:\d+(?:\.\d*)?|\.\d+)|[x()+\-*/]/g) || [];
  if (tokens.join("") !== s || tokens.length > 120)
    throw new Error("使えるのは x、数、+ - × ÷ / ( ) です。");
  let i = 0,
    depth = 0;
  function atom(): Expr {
    if (++depth > 24) throw new Error("かっこが深すぎます。");
    let out: Expr;
    const t = tokens[i++];
    if (t === "+" || t === "-") {
      const c = atom();
      out = t === "-" ? { type: "neg", child: c } : c;
    } else if (t === "(") {
      out = sum();
      if (tokens[i++] !== ")")
        throw new Error("かっこの対応を確認してください。");
    } else if (t === "x") out = X;
    else if (t && /^(\d|\.)/.test(t)) out = num(Q.from(t));
    else throw new Error("式の途中で数や x が必要です。");
    depth--;
    return out;
  }
  function product(): Expr {
    let a = atom();
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "*" || t === "/") {
        i++;
        a = op(t === "*" ? "mul" : "div", a, atom());
      } else if (t === "x" || t === "(") a = op("mul", a, atom());
      else break;
    }
    return a;
  }
  function sum(): Expr {
    let a = product();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const t = tokens[i++];
      a = op(t === "+" ? "add" : "sub", a, product());
    }
    return a;
  }
  const tree = sum();
  if (i !== tokens.length) throw new Error("式のつながりを確認してください。");
  linear(tree);
  return tree;
}
export function parseEquation(s: string): Equation {
  if (s.length > 240) throw new Error("等式は 1 行 240 文字までです。");
  const parts = normalizeInput(s).split("=");
  if (parts.length !== 2)
    throw new Error("各行は「左辺 = 右辺」の形にしてください。");
  return { left: parseExpr(parts[0]), right: parseExpr(parts[1]) };
}
export type Linear = { a: Q; b: Q };
export function linear(e: Expr): Linear {
  if (e.type === "num") return { a: new Q(0), b: e.value };
  if (e.type === "x") return { a: new Q(1), b: new Q(0) };
  if (e.type === "neg") {
    const z = linear(e.child);
    return { a: z.a.neg(), b: z.b.neg() };
  }
  const l = linear(e.left),
    r = linear(e.right);
  if (e.type === "add" || e.type === "sub")
    return {
      a: e.type === "add" ? l.a.add(r.a) : l.a.sub(r.a),
      b: e.type === "add" ? l.b.add(r.b) : l.b.sub(r.b),
    };
  if (e.type === "div") {
    if (!r.a.zero)
      throw new Error("x を含む式では割れません。このアプリの範囲外です。");
    return { a: l.a.div(r.b), b: l.b.div(r.b) };
  }
  if (!l.a.zero && !r.a.zero) throw new Error("x² を含む式は範囲外です。");
  return { a: l.a.mul(r.b).add(r.a.mul(l.b)), b: l.b.mul(r.b) };
}
export type Solution = { kind: "one"; value: Q } | { kind: "all" | "none" };
export function solve(eq: Equation | string): Solution {
  if (typeof eq === "string") eq = parseEquation(eq);
  const l = linear(eq.left),
    r = linear(eq.right),
    a = l.a.sub(r.a),
    b = r.b.sub(l.b);
  return a.zero
    ? { kind: b.zero ? "all" : "none" }
    : { kind: "one", value: b.div(a) };
}
export function solutionKey(s: Solution) {
  return s.kind === "one" ? s.value.toString() : s.kind;
}
export function equivalent(a: Equation | string, b: Equation | string) {
  return solutionKey(solve(a)) === solutionKey(solve(b));
}
export function constant(e: Expr): Q | null {
  const l = linear(e);
  return l.a.zero ? l.b : null;
}
export function show(e: Expr): string {
  if (e.type === "num")
    return e.value.d === 1n ? e.value.toString() : `(${e.value})`;
  if (e.type === "x") return "x";
  if (e.type === "neg") return `(-${show(e.child)})`;
  return `(${show(e.left)}${({ add: "+", sub: "-", mul: "*", div: "/" } as const)[e.type]}${show(e.right)})`;
}
export const showEquation = (eq: Equation) =>
  `${show(eq.left)} = ${show(eq.right)}`;
export function linearExpr(l: Linear): Expr {
  return l.a.zero
    ? num(l.b)
    : l.b.zero
      ? op("mul", num(l.a), X)
      : op("add", op("mul", num(l.a), X), num(l.b));
}
export function answerValue(text: string): Q {
  const clean = normalizeInput(text).replace(/^x=/, "");
  const e = parseExpr(clean),
    l = linear(e);
  if (!l.a.zero)
    throw new Error("答えは数だけ、または x=数 で入力してください。");
  return l.b;
}
