import type { ReactNode } from "react";
import PenMark from "./PenMark";

/** Presentation only: preserve the supplied expression and break between terms. */
export default function MathText({
  value,
  marked,
}: {
  value: string;
  marked?: string;
}) {
  function tokens(text: string): ReactNode {
    return text.split(/((?<![\d./])-?\d+\/\d+(?![\d./])|x)/g).map((part, i) => {
      if (part === "x") return <i key={i}>x</i>;
      if (/^-?\d+\/\d+$/.test(part)) {
        const [top, bottom] = part.split("/");
        return (
          <span className="fraction" key={i}>
            <span>{top.replace(/-/g, "−")}</span>
            <span>{bottom}</span>
          </span>
        );
      }
      return (
        <span key={i}>
          {part
            .replace(/-/g, "−")
            .replace(/\*/g, "×")
            .replace(/([=+×])/g, " $1 ")}
        </span>
      );
    });
  }
  const index = marked ? value.indexOf(marked) : -1;
  return (
    <span className="math" aria-label={value}>
      {index >= 0 ? (
        <>
          {tokens(value.slice(0, index))}
          <span className="marked-term">
            {tokens(marked!)}
            <PenMark />
          </span>
          {tokens(value.slice(index + marked!.length))}
        </>
      ) : (
        value.split(/(?=[=+])|(?<!^)(?=-)(?!-?\d+\/)/g).map((term, i) => (
          <span className="math-term" key={i}>
            {tokens(term)}
          </span>
        ))
      )}
    </span>
  );
}
