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
import type { MultiResult, Scene } from "./types";
import { isDynamic } from "./types";
export function MultiGraph({
  result,
  scene,
  time,
}: {
  result: MultiResult | null;
  scene: Scene;
  time: number;
}) {
  const [quantity, setQuantity] = useState("x"),
    [body, setBody] = useState("all");
  const bodies = scene.objects.filter(isDynamic),
    system = ["energy", "momentum"].includes(quantity);
  const data = useMemo(() => {
    const eventTime = result?.events?.[0]?.t;
    const frames = [
      ...(result?.frames.filter(
        (f, i) =>
          i % 4 === 0 &&
          (eventTime == null || Math.abs(f.t - eventTime) > 1e-9),
      ) || []),
      ...(result?.events || []),
    ].sort((a, b) => a.t - b.t);
    return frames.map((r) => ({
      t: r.t,
      kinetic: r.kinetic,
      potential: r.potential,
      energy: r.energy,
      dissipated: r.dissipated,
      px: r.px,
      py: r.py,
      ...Object.fromEntries(
        r.bodies.map((b) => [
          `body:${b.id}`,
          b[quantity as "x" | "y" | "vx" | "vy" | "ax" | "ay"],
        ]),
      ),
    }));
  }, [result, quantity]);
  const unit =
    quantity === "energy"
      ? "J"
      : quantity === "momentum"
        ? "kg·m/s"
        : quantity.includes("v")
          ? "m/s"
          : quantity.includes("a")
            ? "m/s²"
            : "m";
  const series = system
    ? quantity === "energy"
      ? ["kinetic", "potential", "energy", "dissipated"]
      : ["px", "py"]
    : bodies
        .filter((o) => body === "all" || body === o.id)
        .map((o) => `body:${o.id}`);
  const names: Record<string, string> = {
    kinetic: "運動エネルギー",
    potential: "位置エネルギー",
    energy: "力学的エネルギー",
    dissipated: "散逸エネルギー",
    px: "全運動量 pₓ",
    py: "全運動量 pᵧ",
    ...Object.fromEntries(bodies.map((b) => [`body:${b.id}`, b.label])),
  };
  return (
    <section className="card multi-graph">
      <div className="card-heading">
        <h2>物体ごとの運動と保存則</h2>
        <span className="subtle">現在より先は予測</span>
      </div>
      <div className="multi-graph-controls">
        <select
          aria-label="グラフの物理量"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        >
          {[
            ["x", "位置 x"],
            ["y", "位置 y"],
            ["vx", "速度 vₓ"],
            ["vy", "速度 vᵧ"],
            ["ax", "加速度 aₓ"],
            ["ay", "加速度 aᵧ"],
            ["energy", "エネルギー"],
            ["momentum", "全運動量"],
          ].map(([v, n]) => (
            <option value={v} key={v}>
              {n}
            </option>
          ))}
        </select>
        {!system && (
          <select
            aria-label="グラフの物体"
            value={bodies.some((b) => b.id === body) ? body : "all"}
            onChange={(e) => setBody(e.target.value)}
          >
            <option value="all">すべての物体</option>
            {bodies.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        )}
        <span>[{unit}]</span>
      </div>
      <div style={{ height: 260, width: "100%", minWidth: 0 }}>
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 15, right: 22, left: 0, bottom: 5 }}
          >
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, result?.duration || scene.duration]}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              tickFormatter={(v) => Number(v).toFixed(2)}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickFormatter={(v) => Number(v).toFixed(1)}
              width={55}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                borderColor: "var(--line)",
                fontSize: 11,
              }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(3)} s`}
              formatter={(v, n) => [`${Number(v).toFixed(4)} ${unit}`, n]}
            />
            <ReferenceLine x={time} stroke="var(--ink)" strokeDasharray="3 3" />
            {series.map((id, i) => (
              <Line
                key={id}
                dataKey={id}
                name={names[id]}
                stroke={
                  [
                    "#648566",
                    "#c38d4d",
                    "#8f80b4",
                    "#4c9aab",
                    "#b37982",
                    "#7d9a48",
                    "#5774a9",
                    "#a17746",
                  ][i]
                }
                strokeDasharray={i % 2 ? "5 3" : undefined}
                dot={false}
                isAnimationActive={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="multi-series">
        {series.map((id, i) => (
          <span key={id}>
            <i
              style={{
                background: [
                  "#648566",
                  "#c38d4d",
                  "#8f80b4",
                  "#4c9aab",
                  "#b37982",
                  "#7d9a48",
                  "#5774a9",
                  "#a17746",
                ][i],
              }}
            />
            {names[id]}
          </span>
        ))}
        <span>横軸：時間 t [s]</span>
      </div>
      {result?.model === "pulley" && (
        <p className="multi-muted">
          張り直す瞬間の加速度には衝撃成分があり、有限値のグラフには含めません。前後の速度の跳びで示します。
        </p>
      )}
    </section>
  );
}
