import type { Frame, Kind, Result } from "../types";
import { format as f } from "../clock";
interface Metric {
  label: string;
  symbol?: string;
  value: number;
  unit: string;
  color?: string;
}
export function Measurements({
  kind,
  frame: r,
  result,
  secondary = false,
}: {
  kind: Kind;
  frame: Frame;
  result: Result | null;
  secondary?: boolean;
}) {
  let metrics: Metric[];
  if (secondary) {
    metrics =
      kind === "collision"
        ? [
            { label: "物体2の位置 x₂", value: r.x2 || 0, unit: "m" },
            { label: "物体2の速度 v₂", value: r.vx2 || 0, unit: "m/s" },
            {
              label: "エネルギー減少 ΔK",
              value: r.collided ? -(result?.meta.energyLoss || 0) : 0,
              unit: "J",
            },
          ]
        : [
            ...(["incline", "projectile"].includes(kind)
              ? [
                  { label: "位置 y", value: r.y, unit: "m" },
                  { label: "速度 vᵧ", value: r.vy, unit: "m/s" },
                  { label: "加速度 aᵧ", value: r.ay, unit: "m/s²" },
                ]
              : []),
            ...(["incline", "projectile", "spring"].includes(kind)
              ? [{ label: "位置エネルギー U", value: r.potential, unit: "J" }]
              : []),
            { label: "力学的エネルギー E", value: r.energy, unit: "J" },
          ];
    return (
      <section className="more-data card" aria-label="追加の物理量">
        {metrics.map((m) => (
          <div key={m.label}>
            <span>{m.label}</span>
            <strong>
              {f(m.value)} <small>{m.unit}</small>
            </strong>
          </div>
        ))}
      </section>
    );
  }
  metrics = [
    {
      label:
        kind === "incline"
          ? "斜面方向の位置"
          : kind === "collision"
            ? "物体1の位置"
            : "位置",
      symbol: kind === "incline" ? "s" : kind === "collision" ? "x₁" : "x",
      value: kind === "incline" ? r.s || 0 : r.x,
      unit: "m",
    },
    {
      label:
        kind === "incline"
          ? "斜面方向の速度"
          : kind === "collision"
            ? "物体1の速度"
            : "速度",
      symbol: kind === "incline" ? "vₛ" : kind === "collision" ? "v₁" : "vₓ",
      value: kind === "incline" ? r.v || 0 : r.vx,
      unit: "m/s",
      color: "velocity-text",
    },
    kind === "collision"
      ? { label: "全運動量", symbol: "p", value: r.momentum, unit: "kg·m/s" }
      : {
          label: kind === "incline" ? "斜面方向の加速度" : "加速度",
          symbol: kind === "incline" ? "aₛ" : "aₓ",
          value: kind === "incline" ? r.a || 0 : r.ax,
          unit: "m/s²",
          color: "acceleration-text",
        },
    {
      label: kind === "collision" ? "全運動エネルギー" : "運動エネルギー",
      symbol: "K",
      value: r.kinetic,
      unit: "J",
    },
  ];
  return (
    <section className="measurements card" aria-label="現在の物理量">
      {metrics.map((m) => (
        <div key={m.label}>
          <span>
            {m.label}
            <i>{m.symbol}</i>
          </span>
          <strong className={m.color}>
            {f(m.value)}
            <small>{m.unit}</small>
          </strong>
        </div>
      ))}
    </section>
  );
}
