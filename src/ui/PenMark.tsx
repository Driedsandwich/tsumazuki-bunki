/** Decorative ink only. The adjacent text always carries the meaning. */
export default function PenMark({
  kind = "circle",
  className = "",
}: {
  kind?: "circle" | "underline" | "arrow" | "strike";
  className?: string;
}) {
  const paths = {
    circle: "M 78,9 C 47,-2 7,9 5,29 C 2,49 52,57 83,44 C 109,32 91,8 66,6",
    underline: "M 3,32 Q 45,21 97,28",
    arrow: "M 22,4 C 11,24 36,28 76,28 L 94,28 L 81,16 L 94,28 L 81,41",
    strike: "M 3,29 Q 48,20 97,24",
  };
  return (
    <svg
      className={`pen-mark pen-${kind} ${className}`}
      viewBox="0 0 100 54"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[kind]} pathLength="1" />
    </svg>
  );
}
