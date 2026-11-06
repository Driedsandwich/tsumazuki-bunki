import { constant, parseEquation, type Expr } from "../core/math";

/** Readable notation for engine-generated expressions; never used for diagnosis. */
export function readableEquation(value: string): string {
  function format(e: Expr, parent = 0): string {
    const number = constant(e);
    if (number) {
      const text = number.toString();
      return parent > 2 && number.d !== 1n ? `(${text})` : text;
    }
    if (e.type === "x") return "x";
    if (e.type === "num") return e.value.toString();
    if (e.type === "neg") {
      const text = `-${format(e.child, 3)}`;
      return parent > 3 ? `(${text})` : text;
    }
    const precedence = e.type === "add" || e.type === "sub" ? 1 : 2;
    let text: string;
    if (e.type === "mul") {
      const left = constant(e.left);
      const right = constant(e.right);
      if (left?.toString() === "1") return format(e.right, parent);
      if (left?.toString() === "-1") return `-${format(e.right, 3)}`;
      if (right?.toString() === "1") return format(e.left, parent);
      const a = format(e.left, 2),
        b = format(e.right, 2);
      text =
        left && !right
          ? `${a}${b.startsWith("-") ? `(${b})` : /^[x(]/.test(b) ? b : `×${b}`}`
          : `${a}×${b}`;
    } else if (e.type === "div") {
      text = `${format(e.left, 2)}/${format(e.right, 3)}`;
    } else {
      const right = format(e.right, e.type === "sub" ? 2 : 1);
      text = `${format(e.left, 1)}${e.type === "sub" ? "-" : right.startsWith("-") ? "" : "+"}${right}`;
    }
    return precedence < parent ? `(${text})` : text;
  }
  try {
    const equation = parseEquation(value);
    return `${format(equation.left)}=${format(equation.right)}`;
  } catch {
    return value;
  }
}
