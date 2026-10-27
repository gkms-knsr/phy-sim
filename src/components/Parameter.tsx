import { useEffect, useState } from "react";
import type { ParamSpec } from "../types";
export function Parameter({
  spec,
  value,
  onChange,
  max = spec.max,
  min = spec.min,
}: {
  spec: ParamSpec;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Number(value.toFixed(3)))), [value]);
  function commit() {
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n)) {
      const valid = Math.min(max, Math.max(min, n));
      setDraft(String(valid));
      onChange(valid);
    } else setDraft(String(value));
  }
  return (
    <div className="parameter">
      <div className="parameter-label">
        <label htmlFor={`range-${spec.key}`}>
          {spec.label} <span>{spec.symbol}</span>
        </label>
        <div className="number-field">
          <input
            aria-label={`${spec.label} 数値`}
            type="number"
            min={min}
            max={max}
            step={spec.step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <span>{spec.unit}</span>
        </div>
      </div>
      <input
        id={`range-${spec.key}`}
        aria-label={spec.label}
        type="range"
        min={min}
        max={max}
        step={spec.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--progress": `${max === min ? 0 : ((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
      <div className="range-bounds">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
