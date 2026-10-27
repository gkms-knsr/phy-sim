import { useEffect, useState } from "react";
import type { BodyState, LabObject } from "./types";
import { forceColors } from "./types";
import type { VectorSettings } from "./interaction";
import { forceIsVisible } from "./interaction";
import { MathText } from "../components/Explanation";
import { format as f } from "../clock";
export function ForceDiagram({
  states,
  objects,
  selected,
  onPair,
  vectors,
}: {
  states: BodyState[];
  objects: LabObject[];
  selected: string;
  onPair?: (id: string) => void;
  vectors: VectorSettings;
}) {
  const [pair, setPair] = useState("");
  const [horizontal, setHorizontal] = useState(false);
  useEffect(() => setPair(""), [selected]);
  const chosen =
    selected === "system"
      ? states.filter((s) =>
          objects.find(
            (o) =>
              o.id === s.id && ["mass", "block", "platform"].includes(o.kind),
          ),
        )
      : states.filter((s) => s.id === selected);
  const all = chosen.flatMap((s) =>
    s.forces.map((force) => ({ ...force, body: s.id })),
  );
  const internal = new Set(
    all
      .filter(
        (a) =>
          a.pair &&
          all.some(
            (b) =>
              b.body !== a.body &&
              a.pair === b.pair &&
              Math.abs(a.fx + b.fx) < 1e-8 &&
              Math.abs(a.fy + b.fy) < 1e-8,
          ),
      )
      .map((a) => a.pair),
  );
  const max = Math.max(
    1,
    ...all
      .filter(
        (a) =>
          forceIsVisible(a.kind, vectors) &&
          (!horizontal || Math.abs(a.fx) > 1e-9),
      )
      .map((a) => Math.hypot(a.fx, a.fy)),
  );
  const scale = (65 / max) * vectors.scale;
  return (
    <section className="card free-body">
      <div className="card-heading">
        <h2>
          自由物体図 ·{" "}
          {selected === "system"
            ? "系全体"
            : objects.find((o) => o.id === selected)?.label || "物体を選択"}
        </h2>
      </div>
      <p className="multi-muted">
        力の項を選ぶと、同じ接続の作用・反作用を強調します。図で隠した力も、下の式と合力には含めます。
      </p>
      <label className="fbd-filter">
        <input
          type="checkbox"
          checked={horizontal}
          onChange={(e) => setHorizontal(e.target.checked)}
        />
        水平成分を持つ力だけを図に表示（共通倍率を再調整）
      </label>
      <div className="fbd-list">
        {chosen.map((s) => (
          <div key={s.id}>
            <strong>{objects.find((o) => o.id === s.id)?.label}</strong>
            <svg viewBox="0 0 260 210" aria-label={`${s.id}の自由物体図`}>
              <defs>
                {Object.entries(forceColors).map(([kind, color]) => (
                  <marker
                    key={kind}
                    id={`fbd-${s.id}-${kind}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0 0L6 3L0 6" fill={color} />
                  </marker>
                ))}
              </defs>
              <rect
                x="116"
                y="91"
                width="28"
                height="28"
                rx="6"
                fill="var(--green-soft)"
                stroke="var(--green)"
              />
              {s.forces
                .filter(
                  (a) =>
                    forceIsVisible(a.kind, vectors) &&
                    Math.hypot(a.fx, a.fy) > 1e-9 &&
                    (!horizontal || Math.abs(a.fx) > 1e-9),
                )
                .map((a, i) => (
                  <g
                    key={i}
                    opacity={
                      pair && a.pair !== pair
                        ? 0.35
                        : selected === "system" && internal.has(a.pair)
                          ? 0.3
                          : 1
                    }
                  >
                    <line
                      x1="130"
                      y1="105"
                      x2={130 + a.fx * scale}
                      y2={105 - a.fy * scale}
                      stroke={forceColors[a.kind]}
                      strokeWidth={pair === a.pair && pair ? 4 : 2}
                      strokeDasharray={
                        selected === "system" && internal.has(a.pair)
                          ? "4 3"
                          : undefined
                      }
                      markerEnd={`url(#fbd-${s.id}-${a.kind})`}
                    />
                    {vectors.labels && (
                      <text
                        x={130 + a.fx * scale + (a.fx >= 0 ? 5 : -5)}
                        y={105 - a.fy * scale - 7 - (i % 2) * 12}
                        textAnchor={a.fx < 0 ? "end" : "start"}
                        fill={forceColors[a.kind]}
                        fontSize="10"
                      >
                        {a.label}
                      </text>
                    )}
                  </g>
                ))}
            </svg>
            <MathText
              tex={`m a_x=${f(s.forces.reduce((v, a) => v + a.fx, 0))}\\,\\mathrm{N},\\quad m a_y=${f(s.forces.reduce((v, a) => v + a.fy, 0))}\\,\\mathrm{N}`}
            />
          </div>
        ))}
      </div>
      <div className="force-terms">
        {all.map((a, i) => (
          <button
            key={i}
            onClick={() => {
              const next = pair === a.pair ? "" : a.pair;
              setPair(next);
              onPair?.(next);
            }}
            className={pair && pair === a.pair ? "active" : ""}
            style={{ borderLeftColor: forceColors[a.kind] }}
          >
            <strong>
              {objects.find((o) => o.id === a.body)?.label} · {a.label}
            </strong>
            <span>
              ({f(a.fx)}, {f(a.fy)}) N{" "}
              {!forceIsVisible(a.kind, vectors) && "· 図では非表示"}{" "}
              {selected === "system" && internal.has(a.pair)
                ? "· 内力として相殺"
                : ""}
            </span>
          </button>
        ))}
      </div>
      {chosen.length > 0 && (
        <p className="multi-muted">
          矢印 1 N = {f(scale)} 図内単位。
          {selected === "system"
            ? "破線の対は内力。固定壁・滑車・床から受ける力は、動く物体だけを系に選んだときは外力です。"
            : "矢印の長さは、この自由物体図の共通倍率です。"}
        </p>
      )}
    </section>
  );
}
