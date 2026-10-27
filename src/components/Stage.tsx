import { useRef, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Hand,
  MousePointer2,
} from "lucide-react";
import type {
  Experiment,
  Frame,
  Params,
  Result,
  Visibility,
  Mode,
} from "../types";
import { format as f } from "../clock";
type Point = { x: number; y: number };
const colors = [
  "#5d8bc0",
  "#57946f",
  "#cd6b63",
  "#d18d39",
  "#8e79b5",
  "#496e59",
];
export function Stage({
  experiment: e,
  p,
  frame: r,
  result,
  visible,
  onEdit,
  onPause,
  mode,
}: {
  experiment: Experiment;
  p: Params;
  frame: Frame;
  result: Result | null;
  visible: Visibility;
  onEdit: (p: Params) => void;
  onPause: () => void;
  mode: Mode;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [tool, setTool] = useState<"move" | "pan">("move");
  const [preview, setPreview] = useState<{ type: string; point: Point } | null>(
    null,
  );
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<{
      type: string;
      x: number;
      y: number;
      panX: number;
      panY: number;
    } | null>(null);
  const kind = e.id,
    scale = 32 * zoom,
    baseX =
      kind === "spring" || kind === "collision"
        ? 450
        : kind === "incline"
          ? 280
          : 160,
    baseY = kind === "projectile" ? 315 : kind === "incline" ? 165 : 255;
  const ox = baseX + pan.x,
    oy = baseY + pan.y;
  const X = (x: number) => ox + x * scale,
    Y = (y: number) => oy - y * scale;
  const theta = (p.angle * Math.PI) / 180,
    c = Math.cos(theta),
    s = Math.sin(theta);
  const forceScale = 8 / Math.max(1, (p.m || 1) * 0.8);
  function point(ev: React.PointerEvent) {
    const box = svg.current!.getBoundingClientRect();
    const factor = Math.min(box.width / 900, box.height / 400);
    return {
      x: (ev.clientX - box.left - (box.width - 900 * factor) / 2) / factor,
      y: (ev.clientY - box.top - (box.height - 400 * factor) / 2) / factor,
    };
  }
  function down(ev: React.PointerEvent, type: string) {
    ev.stopPropagation();
    onPause();
    const q = point(ev);
    drag.current = { type, x: q.x, y: q.y, panX: pan.x, panY: pan.y };
    if (type !== "pan") setPreview({ type, point: q });
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function move(ev: React.PointerEvent) {
    if (!drag.current) return;
    const q = point(ev),
      d = drag.current;
    if (d.type === "pan")
      setPan({ x: d.panX + q.x - d.x, y: d.panY + q.y - d.y });
    else setPreview({ type: d.type, point: q });
  }
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  function up(ev: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const q = point(ev);
    drag.current = null;
    setPreview(null);
    const wx = (q.x - ox) / scale,
      wy = (oy - q.y) / scale;
    if (d.type === "angle")
      onEdit({
        angle: Math.round(
          clamp((Math.atan2(q.y - oy, q.x - ox) * 180) / Math.PI, 0, 80),
        ),
      });
    if (d.type === "velocity") {
      const dx = (q.x - X(p.x0)) / 12,
        dy = (Y(p.y0) - q.y) / 12;
      onEdit({
        v0: clamp(Math.hypot(Math.max(0, dx), Math.max(0, dy)), 0, 25),
        angle: clamp(
          (Math.atan2(Math.max(0, dy), Math.max(0, dx)) * 180) / Math.PI,
          0,
          90,
        ),
      });
    }
    if (d.type === "body") {
      if (kind === "projectile")
        onEdit({ x0: clamp(wx, -20, 20), y0: clamp(wy, 0, 15) });
      else if (kind === "incline")
        onEdit({ x0: clamp(wx * c - wy * s, -10, 10) });
      else if (kind === "collision") onEdit({ x1: clamp(wx, -15, -0.5) });
      else
        onEdit({
          x0: clamp(
            wx,
            kind === "spring" ? -4 : -20,
            kind === "spring" ? 4 : 20,
          ),
        });
    }
    if (d.type === "body2") onEdit({ x2: clamp(wx, 0.5, 15) });
  }
  const arrow = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    color: string,
    label: string,
    dashed = false,
  ) => (
    <g className="vector">
      <line
        x1={x}
        y1={y}
        x2={x + dx}
        y2={y + dy}
        stroke={color}
        strokeWidth={dashed ? 1.6 : 2.2}
        strokeDasharray={dashed ? "4 3" : undefined}
        markerEnd={`url(#arrow-${color.slice(1)})`}
      />
      <text
        x={x + dx + (Math.abs(dy) > Math.abs(dx) ? 10 : 0)}
        y={y + dy - 10}
        textAnchor={
          Math.abs(dy) > Math.abs(dx) ? "start" : dx < 0 ? "end" : "middle"
        }
        fill={color}
        fontSize={11}
        fontWeight={500}
        paintOrder="stroke"
        stroke="var(--stage)"
        strokeWidth="3"
      >
        {label}
      </text>
    </g>
  );
  const body = (
    x: number,
    y: number,
    label: string,
    second = false,
    rotation = 0,
  ) => (
    <g
      data-testid={second ? "body2" : "body"}
      className="draggable"
      onPointerDown={(ev) => {
        if (tool === "move") down(ev, second ? "body2" : "body");
      }}
    >
      <g transform={`translate(${X(x)} ${Y(y)}) rotate(${rotation})`}>
        <rect
          x={kind === "collision" ? -scale / 2 : -25}
          y="-40"
          width={kind === "collision" ? scale : 50}
          height="31"
          rx="6"
          fill={second ? "#bd9b6e" : "#769879"}
          stroke={second ? "#9a784e" : "#496e59"}
          strokeWidth="1.4"
          filter="url(#shadow)"
        />
        <path
          d={`M ${kind === "collision" ? -scale / 2 + 5 : -16} -32 h ${kind === "collision" ? Math.max(0, scale - 10) : 30}`}
          stroke={second ? "#e2cba8" : "#a9c0a8"}
          strokeWidth="2"
        />
        <circle
          cx={kind === "collision" ? -scale / 3 : -15}
          cy="-6"
          r="5"
          fill="#435347"
          stroke="var(--stage)"
          strokeWidth="1.5"
        />
        <circle
          cx={kind === "collision" ? scale / 3 : 15}
          cy="-6"
          r="5"
          fill="#435347"
          stroke="var(--stage)"
          strokeWidth="1.5"
        />
        <text y="-52" fill="var(--ink)" fontSize="11" textAnchor="middle">
          {label}
        </text>
      </g>
    </g>
  );
  const trail = result?.frames
    .filter((a, i) => i % 12 === 0 && a.t <= r.t)
    .slice(-250);
  const tickStep = Math.max(1, Math.ceil(2 / zoom));
  const xmin = Math.floor(-ox / scale / tickStep) * tickStep,
    xmax = Math.ceil((900 - ox) / scale / tickStep) * tickStep;
  const ticks = Array.from(
    { length: Math.min(200, Math.ceil((xmax - xmin) / tickStep) + 1) },
    (_, i) => xmin + i * tickStep,
  );
  const px = X(r.x),
    py = Y(r.y),
    cy = kind === "projectile" ? py : py - 24;
  const recenter = () =>
    setPan({
      x: 450 - baseX - r.x * scale,
      y: (kind === "projectile" ? 260 : 240) - baseY + r.y * scale,
    });
  const prediction =
    kind === "projectile"
      ? result?.frames.filter((a, i) => i % 12 === 0 && !a.landed)
      : null;
  const apex = result?.meta.apex,
    apexTime = result?.meta.apexTime;
  const projectionPreview =
    preview && preview.type !== "pan" ? preview.point : null;
  return (
    <div className="stage-wrap">
      <div className="stage-badges">
        <span className="live-badge">
          <i />
          実験エリア
        </span>
        <span>
          {kind === "incline"
            ? "静止・動摩擦モデル"
            : kind === "collision"
              ? "外力なし · 1次元"
              : kind === "projectile"
                ? "空気抵抗なし"
                : kind === "spring"
                  ? "理想ばね · 摩擦なし"
                  : "摩擦なし"}{" "}
          · SI単位系
        </span>
      </div>
      <div className="view-tools">
        <button
          title="物体を操作"
          aria-label="物体を操作"
          className={tool === "move" ? "selected" : ""}
          onClick={() => setTool("move")}
        >
          <MousePointer2 size={16} />
        </button>
        <button
          title="視点を移動"
          aria-label="視点を移動"
          className={tool === "pan" ? "selected" : ""}
          onClick={() => setTool("pan")}
        >
          <Hand size={16} />
        </button>
        <span />
        <button
          aria-label="拡大"
          onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
        >
          <ZoomIn size={17} />
        </button>
        <button
          aria-label="縮小"
          onClick={() => setZoom((z) => Math.max(0.125, z / 1.25))}
        >
          <ZoomOut size={17} />
        </button>
        <button aria-label="物体を中央に表示" onClick={recenter}>
          <LocateFixed size={17} />
        </button>
      </div>
      <svg
        ref={svg}
        className={`simulation ${tool === "pan" ? "panning" : ""}`}
        viewBox="0 0 900 400"
        role="img"
        aria-label={`${e.name}のシミュレーション。${e.hint}`}
        onPointerDown={(ev) => {
          if (tool === "pan") down(ev, "pan");
        }}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          drag.current = null;
          setPreview(null);
        }}
      >
        <defs>
          <pattern
            id="grid"
            width={scale}
            height={scale}
            patternUnits="userSpaceOnUse"
            x={ox}
            y={oy}
          >
            <path
              d={`M ${scale} 0 L 0 0 0 ${scale}`}
              fill="none"
              stroke="var(--grid)"
              strokeWidth=".7"
            />
          </pattern>
          {colors.map((col) => (
            <marker
              id={`arrow-${col.slice(1)}`}
              key={col}
              markerWidth="7"
              markerHeight="7"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6" fill={col} />
            </marker>
          ))}
          <filter id="shadow">
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="7"
              floodColor="#243d2c"
              floodOpacity=".13"
            />
          </filter>
        </defs>
        {visible.grid && <rect width="900" height="400" fill="url(#grid)" />}
        <line
          x1="0"
          x2="900"
          y1={oy}
          y2={oy}
          stroke="var(--axis)"
          strokeWidth="1"
        />
        <line
          x1={ox}
          x2={ox}
          y1="45"
          y2="370"
          stroke="var(--axis)"
          strokeDasharray="3 4"
        />
        {ticks.map(
          (i) =>
            X(i) > 20 &&
            X(i) < 880 && (
              <g key={i}>
                <line
                  x1={X(i)}
                  x2={X(i)}
                  y1={oy - 4}
                  y2={oy + 4}
                  stroke="var(--axis)"
                />
                <text
                  x={X(i)}
                  y={oy + 21}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="10"
                >
                  {i}
                </text>
              </g>
            ),
        )}
        <text x="860" y={oy + 40} fill="var(--muted)" fontSize="11">
          x [m]
        </text>
        {["projectile", "incline"].includes(kind) && (
          <>
            {Array.from({ length: 20 }, (_, i) => i - 8)
              .filter((i) => i !== 0 && Y(i * 2) > 45 && Y(i * 2) < 360)
              .map((i) => (
                <text
                  key={i}
                  x={ox - 12}
                  y={Y(i * 2) + 3}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize="9"
                >
                  {i * 2}
                </text>
              ))}
            <text
              x={ox - 12}
              y="52"
              textAnchor="end"
              fill="var(--muted)"
              fontSize="11"
            >
              y [m]
            </text>
          </>
        )}
        {kind === "incline" && (
          <>
            <path
              d={`M ${ox - 600 * c} ${oy - 600 * s} L ${ox + 1500 * c} ${oy + 1500 * s} L ${ox + 1500 * c} 1200 L ${ox - 600 * c} 1200 Z`}
              fill="var(--green-soft)"
              opacity=".5"
            />
            <line
              x1={ox - 600 * c}
              y1={oy - 600 * s}
              x2={ox + 1500 * c}
              y2={oy + 1500 * s}
              stroke="#92a680"
              strokeWidth="3"
            />
            <path
              d={`M ${ox + 65} ${oy} A 65 65 0 0 1 ${ox + 65 * c} ${oy + 65 * s}`}
              fill="none"
              stroke="#adba9b"
            />
            <text x={ox + 79} y={oy + 25} fill="#879b72" fontSize="12">
              θ = {f(p.angle, 0)}°
            </text>
            <g
              className="draggable"
              data-testid="angle-handle"
              onPointerDown={(ev) => {
                if (tool === "move") down(ev, "angle");
              }}
            >
              <circle
                cx={ox + 180 * c}
                cy={oy + 180 * s}
                r="12"
                fill="var(--surface)"
                stroke="#95ab7b"
                strokeWidth="2"
              />
              <circle
                cx={ox + 180 * c}
                cy={oy + 180 * s}
                r="3"
                fill="#95ab7b"
              />
            </g>
            <text x="26" y="77" fill="var(--muted)" fontSize="11">
              斜面下向きが +s
            </text>
          </>
        )}
        {kind === "spring" && (
          <>
            <line
              x1={X(-5)}
              x2={X(-5)}
              y1={oy - 80}
              y2={oy}
              stroke="#8e9e81"
              strokeWidth="5"
            />
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1={X(-5) - 10}
                x2={X(-5)}
                y1={oy - 80 + i * 10 + 10}
                y2={oy - 80 + i * 10}
                stroke="#a8b398"
              />
            ))}
            <path
              d={`M ${X(-5)} ${oy - 24} L ${X(-5) + 12} ${oy - 24} ${Array.from({ length: 18 }, (_, i) => `L ${X(-5) + 12 + ((px - 25 - X(-5) - 24) * (i + 1)) / 19} ${oy - 24 + (i % 2 ? -10 : 10)}`).join(" ")} L ${px - 25} ${oy - 24}`}
              fill="none"
              stroke="#899e76"
              strokeWidth="2.5"
            />
            <text
              x={ox}
              y={oy + 45}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="10"
            >
              自然長の位置 x = 0
            </text>
          </>
        )}
        {kind === "projectile" && (
          <>
            <rect
              x="0"
              y={oy}
              width="900"
              height={Math.max(0, 400 - oy)}
              fill="var(--green-soft)"
              opacity=".4"
            />
            {visible.trail && (
              <>
                <polyline
                  points={prediction
                    ?.map((a) => `${X(a.x)},${Y(a.y)}`)
                    .join(" ")}
                  fill="none"
                  stroke="#95ac84"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
                {apex != null && apexTime != null && (
                  <g>
                    <circle
                      cx={X(p.x0 + p.v0 * c * apexTime)}
                      cy={Y(apex)}
                      r="4"
                      fill="var(--surface)"
                      stroke="#9bae87"
                    />
                    <text
                      x={X(p.x0 + p.v0 * c * apexTime)}
                      y={Y(apex) - 15}
                      fill="#92a17d"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      最高点 {f(apex)} m
                    </text>
                  </g>
                )}
              </>
            )}
            <g
              className="draggable"
              data-testid="body"
              onPointerDown={(ev) => {
                if (tool === "move") down(ev, "body");
              }}
            >
              <circle
                cx={px}
                cy={py}
                r="13"
                fill="#7e9f78"
                stroke="#4a7655"
                strokeWidth="1.7"
                filter="url(#shadow)"
              />
              <circle cx={px - 4} cy={py - 4} r="4" fill="#b0c4a4" />
            </g>
            {r.t === 0 && (
              <g
                className="draggable"
                data-testid="velocity-handle"
                onPointerDown={(ev) => {
                  if (tool === "move") down(ev, "velocity");
                }}
              >
                <line
                  x1={X(p.x0)}
                  y1={Y(p.y0)}
                  x2={X(p.x0) + p.v0 * c * 12}
                  y2={Y(p.y0) - p.v0 * s * 12}
                  stroke="#d18d39"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={X(p.x0) + p.v0 * c * 12}
                  cy={Y(p.y0) - p.v0 * s * 12}
                  r="8"
                  fill="var(--surface)"
                  stroke="#d18d39"
                  strokeWidth="2"
                />
                <text
                  x={X(p.x0) + p.v0 * c * 12 + 15}
                  y={Y(p.y0) - p.v0 * s * 12 + 5}
                  fill="#d18d39"
                  fontSize="11"
                >
                  v₀
                </text>
              </g>
            )}
            <line
              x1={px}
              y1={py}
              x2={px}
              y2={oy}
              stroke="#bdc8b2"
              strokeDasharray="3 4"
            />
          </>
        )}
        {visible.trail &&
          trail?.map((a, i) => (
            <circle
              key={i}
              cx={X(a.x)}
              cy={kind === "projectile" ? Y(a.y) : Y(a.y) - 5}
              r="2.4"
              fill="#719b7a"
              opacity={0.15 + (i / trail.length) * 0.5}
            />
          ))}
        {kind !== "projectile" &&
          body(
            r.x,
            r.y,
            kind === "collision" ? `① ${f(p.m1, 1)} kg` : `${f(p.m, 1)} kg`,
            false,
            kind === "incline" ? p.angle : 0,
          )}
        {kind === "collision" && (
          <>
            {body(r.x2 ?? p.x2, 0, `② ${f(p.m2, 1)} kg`, true)}
            <text
              x="450"
              y="80"
              fill="var(--muted)"
              fontSize="12"
              textAnchor="middle"
            >
              {r.collided
                ? "衝突後"
                : result?.meta.collisionTime == null
                  ? "この条件では衝突しません"
                  : `接触まで ${f(Math.max(0, result.meta.collisionTime - r.t))} s`}
            </text>
            {visible.velocity &&
              Math.abs(r.vx2 || 0) > 0.001 &&
              arrow(
                X(r.x2 ?? p.x2),
                oy - 100,
                (r.vx2 || 0) * 12,
                0,
                "#d18d39",
                `v₂ = ${f(r.vx2 || 0)} m/s`,
              )}
          </>
        )}
        {visible.velocity &&
          Math.hypot(r.vx, r.vy) > 0.001 &&
          arrow(
            px,
            kind === "projectile" ? py : cy - 55,
            r.vx * 12,
            -r.vy * 12,
            "#d18d39",
            `${kind === "collision" ? "v₁" : "v"} = ${f(Math.hypot(r.vx, r.vy))} m/s`,
          )}
        {kind === "projectile" && visible.velocity && r.t > 0 && !r.landed && (
          <>
            {arrow(px, py, r.vx * 12, 0, "#d18d39", `vₓ ${f(r.vx)}`, true)}
            {arrow(
              px + r.vx * 12,
              py,
              0,
              -r.vy * 12,
              "#d18d39",
              `vᵧ ${f(r.vy)}`,
              true,
            )}
          </>
        )}
        {visible.acceleration &&
          Math.hypot(r.ax, r.ay) > 0.001 &&
          arrow(
            px,
            kind === "projectile" ? py : cy - 100,
            r.ax * 20,
            -r.ay * 20,
            "#8e79b5",
            `a = ${f(Math.hypot(r.ax, r.ay))} m/s²`,
          )}
        {visible.force && (
          <>
            {kind === "linear" &&
              Math.abs(r.ax) > 0.001 &&
              arrow(
                px,
                oy + 63,
                p.m * r.ax * forceScale,
                0,
                "#496e59",
                `F ${f(p.m * r.ax)} N`,
              )}
            {["linear", "spring", "incline", "projectile"].includes(kind) && (
              <>
                {arrow(
                  px,
                  cy,
                  0,
                  p.m * (p.g || 9.8) * forceScale,
                  "#5d8bc0",
                  `mg ${f(p.m * (p.g || 9.8))} N`,
                )}
                {kind === "incline" ? (
                  <>
                    {arrow(
                      px,
                      cy,
                      -s * r.normal * forceScale,
                      -c * r.normal * forceScale,
                      "#57946f",
                      `N ${f(r.normal)} N`,
                    )}
                    {Math.abs(r.friction) > 0.001 &&
                      arrow(
                        px,
                        cy,
                        c * r.friction * forceScale,
                        s * r.friction * forceScale,
                        "#cd6b63",
                        `f${r.regime === "static" ? "ₛ" : "ₖ"} ${f(Math.abs(r.friction))} N`,
                      )}
                    {mode !== "intuitive" &&
                      arrow(
                        px,
                        cy,
                        p.m * p.g * s * c * forceScale,
                        p.m * p.g * s * s * forceScale,
                        "#5d8bc0",
                        `mg sinθ ${f(p.m * p.g * s)} N`,
                        true,
                      )}
                    {mode !== "intuitive" &&
                      arrow(
                        px,
                        cy,
                        p.m * p.g * c * s * forceScale,
                        p.m * p.g * c * c * forceScale,
                        "#5d8bc0",
                        `mg cosθ ${f(p.m * p.g * c)} N`,
                        true,
                      )}
                  </>
                ) : kind !== "projectile" || r.landed ? (
                  arrow(
                    px + 12,
                    cy,
                    0,
                    -p.m * (p.g || 9.8) * forceScale,
                    "#57946f",
                    `N ${f(p.m * (p.g || 9.8))} N`,
                  )
                ) : null}
              </>
            )}
            {kind === "spring" &&
              Math.abs(r.x) > 0.001 &&
              arrow(
                px,
                cy,
                -p.k * r.x * forceScale,
                0,
                "#496e59",
                `−kx ${f(-p.k * r.x)} N`,
              )}
          </>
        )}
        {projectionPreview && (
          <g pointerEvents="none">
            <circle
              cx={projectionPreview.x}
              cy={projectionPreview.y}
              r="16"
              fill="#7f9c6633"
              stroke="#829b6d"
              strokeDasharray="4 3"
            />
            <line
              x1={drag.current?.x}
              y1={drag.current?.y}
              x2={projectionPreview.x}
              y2={projectionPreview.y}
              stroke="#829b6d"
              strokeDasharray="3 3"
            />
            {preview?.type === "angle" && (
              <text
                x={projectionPreview.x + 20}
                y={projectionPreview.y}
                fill="#829b6d"
                fontSize="12"
              >
                {f(
                  clamp(
                    (Math.atan2(
                      projectionPreview.y - oy,
                      projectionPreview.x - ox,
                    ) *
                      180) /
                      Math.PI,
                    0,
                    80,
                  ),
                  0,
                )}
                °
              </text>
            )}
          </g>
        )}
        <text x="23" y="383" fontSize="9" fill="var(--muted)">
          矢印（SVG座標）：速度 12 単位/(m/s)　加速度 20 単位/(m/s²)　力{" "}
          {f(forceScale, 1)} 単位/N
        </text>
      </svg>
      <div className="stage-hint">
        <MousePointer2 size={13} />
        {e.hint}
      </div>
      {(px < 0 || px > 900 || py < 0 || py > 400) && (
        <button className="offscreen" onClick={recenter}>
          物体が表示範囲の外です · 追いかける →
        </button>
      )}
    </div>
  );
}
