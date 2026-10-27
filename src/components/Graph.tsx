import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
import type { Result, Kind } from "../types";
const groups = {
  position: { label: "位置", unit: "m", keys: ["x", "y"], names: ["x", "y"] },
  velocity: {
    label: "速度",
    unit: "m/s",
    keys: ["vx", "vy"],
    names: ["vₓ", "vᵧ"],
  },
  acceleration: {
    label: "加速度",
    unit: "m/s²",
    keys: ["ax", "ay"],
    names: ["aₓ", "aᵧ"],
  },
  energy: {
    label: "エネルギー",
    unit: "J",
    keys: ["kinetic", "potential", "energy"],
    names: ["運動", "位置", "力学的"],
  },
  momentum: {
    label: "運動量",
    unit: "kg·m/s",
    keys: ["momentum"],
    names: ["合計 p"],
  },
};
export function Graph({
  result,
  time,
  kind,
}: {
  result: Result | null;
  time: number;
  kind: Kind;
}) {
  const [tab, setTab] = useState<keyof typeof groups>("position");
  const active =
    tab === "momentum" && kind !== "collision"
      ? "position"
      : tab === "acceleration" && kind === "collision"
        ? "velocity"
        : tab;
  const group = groups[active];
  const horizon = Math.min(30, Math.max(6, Math.ceil((time + 1) / 5) * 5));
  const data = useMemo(() => {
    if (!result) return [];
    const eventTime = result.events?.[0]?.t;
    return [
      ...result.frames.filter(
        (f, i) =>
          i % 4 === 0 &&
          f.t <= horizon &&
          (eventTime == null || Math.abs(f.t - eventTime) > 1e-9),
      ),
      ...(result.events || []).filter((f) => f.t <= horizon),
    ].sort((a, b) => a.t - b.t);
  }, [result, horizon]);
  const keys =
    active === "position" && kind === "collision"
      ? ["x", "x2"]
      : active === "velocity" && kind === "collision"
        ? ["vx", "vx2"]
        : group.keys.filter(
            (k) =>
              !["y", "vy", "ay"].includes(k) ||
              ["incline", "projectile"].includes(kind),
          );
  return (
    <section className="card graph-card">
      <div className="card-heading">
        <h2>
          <ChartNoAxesCombined size={17} />
          運動をグラフで見る
        </h2>
        <span className="subtle">現在と未来の予測</span>
      </div>
      <div className="graph-tabs">
        {Object.entries(groups)
          .filter(
            ([k]) =>
              (k !== "momentum" || kind === "collision") &&
              (k !== "acceleration" || kind !== "collision"),
          )
          .map(([k, g]) => (
            <button
              key={k}
              onClick={() => setTab(k as keyof typeof groups)}
              className={active === k ? "active" : ""}
            >
              {g.label}
            </button>
          ))}
      </div>
      <div className="graph-unit">
        {group.label} [{group.unit}]
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, left: -22, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 5"
              vertical={false}
              stroke="var(--line)"
            />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, horizon]}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              tickCount={7}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickFormatter={(v) => Number(v).toFixed(Math.abs(v) < 10 ? 1 : 0)}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                fontSize: 12,
              }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v, name) => [
                `${Number(v).toFixed(3)} ${group.unit}`,
                name,
              ]}
            />
            <ReferenceLine x={time} stroke="var(--ink)" strokeDasharray="3 3" />
            {keys.map((k, i) => (
              <Line
                type="linear"
                key={k}
                dataKey={k}
                name={
                  kind === "collision" &&
                  ["velocity", "position"].includes(active)
                    ? `物体${i + 1}`
                    : group.names[i]
                }
                stroke={["#4a8263", "#d29148", "#9282b5"][i]}
                strokeWidth={2.2}
                strokeDasharray={i === 1 ? "6 3" : i === 2 ? "2 3" : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="graph-series">
        {keys.map((k, i) => (
          <span key={k}>
            <i
              style={{
                borderColor: ["#4a8263", "#d29148", "#9282b5"][i],
                borderTopStyle: i === 0 ? "solid" : "dashed",
              }}
            />
            {kind === "collision" && ["position", "velocity"].includes(active)
              ? `物体${i + 1}`
              : group.names[i]}
          </span>
        ))}
      </div>
      <div className="graph-footer">
        <span>┊ 現在の時刻 · 先の値は予測</span>
        <span>時間 t [s]</span>
      </div>
    </section>
  );
}
