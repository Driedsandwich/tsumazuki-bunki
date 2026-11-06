export default function Journey({ stage }: { stage: 1 | 2 | 3 }) {
  return (
    <nav aria-label="診断の手順" className="journey">
      <p className="journey-current" aria-live="polite">
        いま {stage} / 3
      </p>
      <ol className="steps">
        {[
          "答案を入れる（見本・写真・手入力）",
          "原因の候補と見分ける一問",
          "結論と戻る単元",
        ].map((label, i) => (
          <li key={label} aria-current={stage === i + 1 ? "step" : undefined}>
            <b>{i + 1}</b>
            <span>{label}</span>
            {i < 2 && (
              <span className="step-arrow" aria-hidden="true">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
