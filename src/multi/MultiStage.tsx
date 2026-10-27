import { useEffect, useRef, useState } from "react";
import {
  Hand,
  LocateFixed,
  MousePointer2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Scene, MultiFrame, Force } from "./types";
import type { InteractionSettings, VectorSettings } from "./interaction";
import {
  dragPosition,
  dragForce,
  forceIsVisible,
  snapDelta,
} from "./interaction";
import { forceColors, isDynamic } from "./types";
import { format as f } from "../clock";
export function MultiStage({
  scene,
  current,
  selected,
  onSelect,
  onMove,
  onForce,
  onDrop,
  onPause,
  model,
  tool,
  pair,
  vectors,
  interaction,
  frames,
  endpoint,
  onSelectionTool,
}: {
  scene: Scene;
  current: MultiFrame | null;
  selected: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onForce: (id: string, fx: number, fy: number) => void;
  onDrop: (kind: string, x: number, y: number) => void;
  onPause: () => void;
  model: string;
  tool: string;
  pair: string;
  vectors: VectorSettings;
  interaction: InteractionSettings;
  frames: MultiFrame[];
  endpoint: string;
  onSelectionTool: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      type: string;
      pan: { x: number; y: number };
      start: { x: number; y: number };
      forceStart: { fx: number; fy: number };
      scale: number;
    } | null>(null);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [hand, setHand] = useState(false),
    [follow, setFollow] = useState(true),
    [ghost, setGhost] = useState<{
      x: number;
      y: number;
      label: string;
    } | null>(null);
  useEffect(() => {
    if (tool !== "select") setHand(false);
  }, [tool]);
  const base = scene.objects.filter(isDynamic),
    center = base.length ? base.reduce((s, o) => s + o.x, 0) / base.length : 0;
  const scale = 42 * zoom,
    ox = 450 + pan.x - (follow && current ? current.cx : center) * scale,
    oy = 250 + pan.y;
  const X = (x: number) => ox + x * scale,
    Y = (y: number) => oy - y * scale;
  const states = Object.fromEntries(
    (current?.bodies || []).map((b) => [b.id, b]),
  );
  const position = (id: string) =>
    states[id] || scene.objects.find((o) => o.id === id)!;
  function point(clientX: number, clientY: number) {
    const box = svg.current!.getBoundingClientRect(),
      k = Math.min(box.width / 900, box.height / 430);
    return {
      x: (clientX - box.left - (box.width - 900 * k) / 2) / k,
      y: (clientY - box.top - (box.height - 430 * k) / 2) / k,
    };
  }
  function down(ev: React.PointerEvent, id: string, type = "body") {
    ev.stopPropagation();
    onPause();
    if (type === "body" || type === "force") onSelect(id);
    if (tool !== "select" && type === "body") return;
    const q = point(ev.clientX, ev.clientY);
    const initial = type === "body" ? position(id) : { x: 0, y: 0 };
    const applied = scene.external.find((f) => f.id === id);
    drag.current = {
      id,
      ...q,
      type,
      pan,
      start: { x: initial.x, y: initial.y },
      forceStart: { fx: applied?.fx || 0, fy: applied?.fy || 0 },
      scale,
    };
    svg.current!.setPointerCapture(ev.pointerId);
  }
  function up(ev: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setGhost(null);
    const q = point(ev.clientX, ev.clientY);
    if (Math.hypot(q.x - d.x, q.y - d.y) < 3) return;
    if (d.type === "pan") return;
    const delta = { x: (q.x - d.x) / d.scale, y: -(q.y - d.y) / d.scale };
    if (d.type === "force") {
      const value = dragForce(
        d.forceStart,
        {
          x: delta.x / (0.08 * vectors.scale),
          y: delta.y / (0.08 * vectors.scale),
        },
        interaction,
      );
      if (value.fx !== d.forceStart.fx || value.fy !== d.forceStart.fy)
        onForce(d.id, value.fx, value.fy);
    } else {
      const target = dragPosition(
        scene,
        d.id,
        d.start,
        delta,
        model,
        interaction,
      );
      if (
        Math.abs(target.x - d.start.x) + Math.abs(target.y - d.start.y) >
        1e-9
      )
        onMove(d.id, target.x, target.y);
    }
  }
  function preview(clientX: number, clientY: number) {
    const d = drag.current;
    if (!d) return;
    const q = point(clientX, clientY),
      delta = { x: (q.x - d.x) / d.scale, y: -(q.y - d.y) / d.scale };
    if (d.type === "force") {
      const v = dragForce(
        d.forceStart,
        {
          x: delta.x / (0.08 * vectors.scale),
          y: delta.y / (0.08 * vectors.scale),
        },
        interaction,
      );
      const body = position(scene.external.find((a) => a.id === d.id)!.body);
      setGhost({
        x: X(body.x) + v.fx * scale * 0.08 * vectors.scale,
        y: Y(body.y) - v.fy * scale * 0.08 * vectors.scale,
        label: `F = (${f(v.fx)}, ${f(v.fy)}) N`,
      });
    } else {
      const target = dragPosition(
        scene,
        d.id,
        d.start,
        delta,
        model,
        interaction,
      );
      setGhost({
        x: X(target.x),
        y: Y(target.y),
        label: `x = ${f(target.x)} m / y = ${f(target.y)} m`,
      });
    }
  }
  const scope =
    current?.bodies.filter((b) =>
      scene.objects.some((o) => o.id === b.id && isDynamic(o)),
    ) || [];
  const vectorBodies = scope.filter(
    (b) =>
      !scene.objects.some((o) => o.id === selected && isDynamic(o)) ||
      b.id === selected ||
      (!!pair && b.forces.some((f) => f.pair === pair)),
  );
  const motionColors = { velocity: "#d18d39", acceleration: "#8e79b5" };
  const motionArrow = (
    id: string,
    x: number,
    y: number,
    dx: number,
    dy: number,
    kind: "velocity" | "acceleration",
    label: string,
  ) =>
    Math.hypot(dx, dy) > 0.001 && (
      <g
        key={`${id}-${kind}`}
        className="multi-vector motion-vector"
        data-vector-kind={kind}
      >
        <line
          x1={x}
          y1={y}
          x2={x + dx}
          y2={y + dy}
          stroke={motionColors[kind]}
          strokeWidth="2.3"
          markerEnd={`url(#multi-arrow-${kind})`}
        />
        {vectors.labels && (
          <text
            x={x + dx + 6}
            y={y + dy - 9}
            fill={motionColors[kind]}
            fontSize="11"
            stroke="var(--stage)"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {label}
          </text>
        )}
      </g>
    );
  const spring = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ax = X(a.x),
      ay = Y(a.y),
      bx = X(b.x),
      by = Y(b.y),
      length = Math.hypot(bx - ax, by - ay),
      nx = -(by - ay) / Math.max(1, length),
      ny = (bx - ax) / Math.max(1, length);
    return `M ${ax} ${ay} ${Array.from({ length: 17 }, (_, i) => {
      const t = (i + 1) / 18,
        d = (i % 2 ? 1 : -1) * 6;
      return `L ${ax + (bx - ax) * t + nx * d} ${ay + (by - ay) * t + ny * d}`;
    }).join(" ")} L ${bx} ${by}`;
  };
  return (
    <div className="multi-stage-wrap">
      <div className="multi-stage-toolbar">
        <span>
          {tool === "spring"
            ? "ばねの第1端 → 第2端をクリック"
            : tool === "rope"
              ? "糸の第1端 → 第2端をクリック"
              : `つかんだ位置から ${interaction.positionStep} mずつ移動 · 外力は ${interaction.forceStep} Nずつ調整`}
        </span>
        <div>
          <label>
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
            />
            重心を追う
          </label>
          <button
            aria-label="選択ツール"
            title="物体を選択・ドラッグ（接続操作を終了）"
            onClick={() => {
              setHand(false);
              onSelectionTool();
            }}
            className={!hand ? "active" : ""}
          >
            <MousePointer2 size={15} />
          </button>
          <button
            aria-label="実験室の視点移動"
            title="背景をドラッグして視点を移動"
            onClick={() => {
              onSelectionTool();
              setHand(true);
              setFollow(false);
            }}
            className={hand ? "active" : ""}
          >
            <Hand size={15} />
          </button>
          <button
            aria-label="実験室を拡大"
            onClick={() => setZoom((z) => Math.min(3, z * 1.25))}
          >
            <ZoomIn size={15} />
          </button>
          <button
            aria-label="実験室を縮小"
            onClick={() => setZoom((z) => Math.max(0.125, z / 1.25))}
          >
            <ZoomOut size={15} />
          </button>
          <button
            aria-label="実験室の視点を戻す"
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(1);
              setFollow(true);
            }}
          >
            <LocateFixed size={15} />
          </button>
        </div>
      </div>
      <svg
        ref={svg}
        viewBox="0 0 900 430"
        className="multi-canvas"
        role="img"
        aria-label="自由実験の配置エリア"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const q = point(e.clientX, e.clientY);
          onDrop(
            e.dataTransfer.getData("text/physica"),
            snapDelta((q.x - ox) / scale, interaction.positionStep),
            snapDelta((oy - q.y) / scale, interaction.positionStep),
          );
        }}
        onPointerDown={(e) => {
          if (hand) down(e, "", "pan");
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const q = point(e.clientX, e.clientY);
          if (drag.current.type === "pan")
            setPan({
              x: drag.current.pan.x + q.x - drag.current.x,
              y: drag.current.pan.y + q.y - drag.current.y,
            });
          else preview(e.clientX, e.clientY);
        }}
        onPointerUp={up}
        onPointerCancel={() => {
          drag.current = null;
          setGhost(null);
        }}
      >
        <defs>
          <pattern
            id="multi-grid"
            width={scale}
            height={scale}
            x={ox}
            y={oy}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${scale} 0 H 0 V ${scale}`}
              fill="none"
              stroke="var(--grid)"
              strokeWidth=".8"
            />
          </pattern>
          {Object.entries({ ...forceColors, ...motionColors }).map(
            ([kind, color]) => (
              <marker
                id={`multi-arrow-${kind}`}
                key={kind}
                markerWidth="7"
                markerHeight="7"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0 0L6 3L0 6" fill={color} />
              </marker>
            ),
          )}
        </defs>
        <rect
          width="900"
          height="430"
          fill={vectors.grid ? "url(#multi-grid)" : "var(--stage)"}
        />
        <line x1="0" x2="900" y1={oy} y2={oy} stroke="var(--axis)" />
        <text x="860" y={oy + 20} fontSize="10" fill="var(--muted)">
          x [m]
        </text>
        {Array.from(
          { length: Math.min(100, Math.ceil(900 / scale / 2) + 2) },
          (_, i) => Math.floor(-ox / scale / 2) * 2 + i * 2,
        ).map((v) => (
          <text
            x={X(v)}
            y={oy + 16}
            key={v}
            fontSize="9"
            fill="var(--muted)"
            textAnchor="middle"
          >
            {v}
          </text>
        ))}
        {vectors.trail &&
          scene.objects.filter(isDynamic).map((o, i) => (
            <polyline
              key={`trail-${o.id}`}
              data-testid={`trail-${o.id}`}
              points={frames
                .filter((a, j) => j % 12 === 0 && a.t <= (current?.t || 0))
                .slice(-180)
                .map((a) => a.bodies.find((b) => b.id === o.id))
                .filter(Boolean)
                .map((b) => `${X(b!.x)},${Y(b!.y)}`)
                .join(" ")}
              fill="none"
              stroke={["#729879", "#b99a6b", "#888cb5"][i % 3]}
              strokeWidth="2"
              strokeDasharray="3 4"
              opacity=".6"
              className="multi-vector"
            />
          ))}
        {scene.objects
          .filter((o) => !isDynamic(o))
          .map((o) => (
            <g
              key={o.id}
              className="draggable"
              data-testid={`multi-${o.id}`}
              onPointerDown={(ev) => {
                if (!hand) down(ev, o.id);
              }}
            >
              <title>{o.label}</title>
              {o.kind === "wall" ? (
                <rect
                  x={X(o.x) - 8}
                  y={Y(o.y) - 55}
                  width="16"
                  height="110"
                  rx="3"
                  fill="var(--axis)"
                  stroke={selected === o.id ? "var(--green)" : "none"}
                  strokeWidth="3"
                />
              ) : o.kind === "floor" ? (
                <>
                  <rect
                    x="0"
                    y={Y(o.y)}
                    width="900"
                    height="12"
                    fill="var(--green-soft)"
                  />
                  <line
                    x1="0"
                    y1={Y(o.y)}
                    x2="900"
                    y2={Y(o.y)}
                    stroke="var(--green)"
                    strokeWidth="2"
                  />
                </>
              ) : o.kind === "incline" ? (
                <path
                  transform={`translate(${((scene.objects.find((b) => b.support === o.id)?.height ?? 0.8) / 2) * scale * Math.sin((o.angle * Math.PI) / 180)} ${((scene.objects.find((b) => b.support === o.id)?.height ?? 0.8) / 2) * scale * Math.cos((o.angle * Math.PI) / 180)})`}
                  d={`M ${X(o.x)} ${Y(o.y)} L ${X(o.x) - 450 * Math.cos((o.angle * Math.PI) / 180)} ${Y(o.y) + 450 * Math.sin((o.angle * Math.PI) / 180)} L ${X(o.x)} ${Y(o.y) + 450 * Math.sin((o.angle * Math.PI) / 180)} Z`}
                  fill="var(--green-soft)"
                  stroke="#8ca47b"
                  strokeWidth="2"
                />
              ) : o.kind === "pulley" ? (
                <>
                  <line
                    x1={X(o.x)}
                    y1={Y(o.y) - 40}
                    x2={X(o.x)}
                    y2={Y(o.y)}
                    stroke="var(--axis)"
                    strokeWidth="4"
                  />
                  <circle
                    cx={X(o.x)}
                    cy={Y(o.y)}
                    r={0.4 * scale}
                    fill="var(--surface)"
                    stroke={selected === o.id ? "#b18b44" : "#879c78"}
                    strokeWidth="3"
                  />
                  <circle cx={X(o.x)} cy={Y(o.y)} r="4" fill="#879c78" />
                </>
              ) : (
                <circle
                  cx={X(o.x)}
                  cy={Y(o.y)}
                  r="8"
                  fill="var(--surface)"
                  stroke={selected === o.id ? "#b18b44" : "#879c78"}
                  strokeWidth="3"
                />
              )}
              <text
                x={X(o.x) + 13}
                y={Y(o.y) - 28}
                fill="var(--muted)"
                fontSize="10"
              >
                {o.label}
              </text>
            </g>
          ))}
        {scene.connections.map((l) => {
          const a = position(l.a),
            b = position(l.b),
            pulley = scene.objects.find((o) => o.id === l.pulley);
          if (!a || !b) return null;
          return (
            <g
              key={l.id}
              onClick={() => onSelect(l.id)}
              className="connection-line"
              data-testid={`link-${l.id}`}
            >
              <title>
                {l.kind === "spring" ? "ばね" : "糸"} {l.id}
              </title>
              {l.kind === "spring" ? (
                <>
                  <path
                    d={spring(a, b)}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                  />
                  <path
                    d={spring(a, b)}
                    fill="none"
                    stroke={selected === l.id ? "#ba9147" : "#9986ae"}
                    strokeWidth="2.5"
                  />
                </>
              ) : (
                <path
                  d={
                    pulley
                      ? `M ${X(a.x)} ${Y(a.y)} L ${X(pulley.x - 0.4)} ${Y(pulley.y)} Q ${X(pulley.x)} ${Y(pulley.y) - 0.8 * scale} ${X(pulley.x + 0.4)} ${Y(pulley.y)} L ${X(b.x)} ${Y(b.y)}`
                      : `M ${X(a.x)} ${Y(a.y)} L ${X(b.x)} ${Y(b.y)}`
                  }
                  fill="none"
                  stroke={selected === l.id ? "#ba9147" : "#64a5a1"}
                  strokeWidth="3"
                  strokeDasharray={
                    current?.regime === "slack" ? "6 5" : undefined
                  }
                />
              )}
              <text
                x={(X(a.x) + X(b.x)) / 2}
                y={(Y(a.y) + Y(b.y)) / 2 - 15}
                fill={l.kind === "spring" ? "#9986ae" : "#64a5a1"}
                fontSize="10"
              >
                {l.id}{" "}
                {l.kind === "rope" && current
                  ? `T = ${f(current.tension || 0)} N`
                  : ""}
              </text>
            </g>
          );
        })}
        {scene.objects.filter(isDynamic).map((o, i) => {
          const b = position(o.id);
          const rope = scene.connections.find((l) => l.kind === "rope");
          const labelOffset =
            model === "pulley" ? (rope?.a === o.id ? -30 : 30) : 0;
          return (
            <g
              key={o.id}
              data-testid={`multi-${o.id}`}
              className="draggable"
              onPointerDown={(ev) => {
                if (!hand) down(ev, o.id);
              }}
            >
              <title>
                {o.label} · {f(o.mass)} kg
              </title>
              <rect
                x={X(b.x) - Math.max(18, (o.width * scale) / 2) - 3}
                y={Y(b.y) - (o.height * scale) / 2 - 30}
                width={Math.max(36, o.width * scale) + 6}
                height={o.height * scale + 35}
                fill="transparent"
                pointerEvents="all"
              />
              {o.kind === "mass" ? (
                <circle
                  cx={X(b.x)}
                  cy={Y(b.y)}
                  r={Math.max(12, scale * 0.28)}
                  fill={["#729879", "#b99a6b", "#888cb5"][i % 3]}
                  stroke={selected === o.id ? "#d0aa51" : "var(--surface)"}
                  strokeWidth="3"
                />
              ) : (
                <rect
                  x={X(b.x) - (o.width * scale) / 2}
                  y={Y(b.y) - (o.height * scale) / 2}
                  width={o.width * scale}
                  height={o.height * scale}
                  rx="6"
                  fill={
                    o.kind === "platform"
                      ? "#6d8774"
                      : ["#729879", "#b99a6b", "#888cb5"][i % 3]
                  }
                  stroke={selected === o.id ? "#d0aa51" : "#566b56"}
                  strokeWidth={selected === o.id ? 3 : 1.5}
                />
              )}
              <text
                x={X(b.x) + labelOffset}
                y={Y(b.y) - (o.height * scale) / 2 - 13}
                fill="var(--ink)"
                textAnchor={
                  labelOffset < 0 ? "end" : labelOffset > 0 ? "start" : "middle"
                }
                fontSize="12"
              >
                {o.label} · {f(o.mass, 1)} kg
              </text>
            </g>
          );
        })}
        {vectors.force &&
          vectorBodies.flatMap((b) =>
            b.forces.map((a: Force, i) =>
              !vectors.kinds[a.kind] || Math.hypot(a.fx, a.fy) < 1e-8 ? null : (
                <g
                  className="multi-vector force-vector"
                  data-force-kind={a.kind}
                  key={`${b.id}-${i}`}
                  opacity={pair && pair !== a.pair ? 0.2 : 1}
                >
                  <line
                    x1={X(b.x)}
                    y1={Y(b.y)}
                    x2={X(b.x) + a.fx * scale * 0.08 * vectors.scale}
                    y2={Y(b.y) - a.fy * scale * 0.08 * vectors.scale}
                    stroke={forceColors[a.kind]}
                    strokeWidth={pair === a.pair && pair ? 4 : 2}
                    markerEnd={`url(#multi-arrow-${a.kind})`}
                  />
                  {vectors.labels && (
                    <text
                      x={X(b.x) + a.fx * scale * 0.08 * vectors.scale + 6}
                      y={Y(b.y) - a.fy * scale * 0.08 * vectors.scale - 7}
                      fontSize="10"
                      fill={forceColors[a.kind]}
                      paintOrder="stroke"
                      stroke="var(--stage)"
                      strokeWidth="3"
                    >
                      {a.label} {f(Math.hypot(a.fx, a.fy), 1)} N
                    </text>
                  )}
                </g>
              ),
            ),
          )}
        {vectorBodies.map((b) => (
          <g key={`motion-${b.id}`}>
            {vectors.velocity &&
              motionArrow(
                b.id,
                X(b.x),
                Y(b.y) - 45,
                b.vx * 12 * vectors.scale,
                -b.vy * 12 * vectors.scale,
                "velocity",
                `v = (${f(b.vx)}, ${f(b.vy)}) m/s`,
              )}
            {vectors.acceleration &&
              motionArrow(
                b.id,
                X(b.x),
                Y(b.y) - 85,
                b.ax * 12 * vectors.scale,
                -b.ay * 12 * vectors.scale,
                "acceleration",
                `a = (${f(b.ax)}, ${f(b.ay)}) m/s²`,
              )}
          </g>
        ))}
        {scene.external
          .filter(
            (a) =>
              tool === "select" &&
              (selected === a.id || forceIsVisible("external", vectors)),
          )
          .map((a) => {
            const b = position(a.body);
            return (
              b && (
                <g
                  key={a.id}
                  onPointerDown={(ev) => down(ev, a.id, "force")}
                  className="draggable"
                  data-testid={`force-${a.id}`}
                >
                  <line
                    x1={X(b.x)}
                    y1={Y(b.y)}
                    x2={X(b.x) + a.fx * scale * 0.08 * vectors.scale}
                    y2={Y(b.y) - a.fy * scale * 0.08 * vectors.scale}
                    stroke={forceColors.external}
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={X(b.x) + a.fx * scale * 0.08 * vectors.scale}
                    cy={Y(b.y) - a.fy * scale * 0.08 * vectors.scale}
                    r="7"
                    fill="var(--surface)"
                    stroke={forceColors.external}
                    strokeWidth="2"
                  />
                </g>
              )
            );
          })}
        {current && (
          <g className="multi-vector">
            <circle
              cx={X(current.cx)}
              cy={Y(current.cy)}
              r="5"
              fill="none"
              stroke="var(--ink)"
            />
            <path
              d={`M ${X(current.cx) - 9} ${Y(current.cy)} h18 M ${X(current.cx)} ${Y(current.cy) - 9} v18`}
              stroke="var(--ink)"
            />
            <text
              x={X(current.cx) + 12}
              y={Y(current.cy) + 16}
              fill="var(--ink)"
              fontSize="10"
            >
              重心
            </text>
          </g>
        )}
        {ghost && (
          <g pointerEvents="none">
            <circle
              cx={ghost.x}
              cy={ghost.y}
              r="16"
              fill="#96aa6e33"
              stroke="#8ba473"
              strokeDasharray="4 3"
            />
            <text
              x={ghost.x + 20}
              y={ghost.y - 16}
              fill="var(--green)"
              fontSize="12"
              paintOrder="stroke"
              stroke="var(--stage)"
              strokeWidth="3"
            >
              {ghost.label}
            </text>
          </g>
        )}
        {endpoint && scene.objects.some((o) => o.id === endpoint) && (
          <g pointerEvents="none">
            <circle
              cx={X(position(endpoint).x)}
              cy={Y(position(endpoint).y)}
              r="30"
              fill="none"
              stroke="#cf9d40"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
            <text
              x={X(position(endpoint).x)}
              y={Y(position(endpoint).y) + 47}
              textAnchor="middle"
              fill="#a37f30"
              fontSize="12"
            >
              第1端を選択済み
            </text>
          </g>
        )}
        {!scene.objects.length && (
          <g>
            <text
              x="450"
              y="190"
              textAnchor="middle"
              fill="var(--green)"
              fontSize="20"
            >
              ここから、実験をつくろう。
            </text>
            <text
              x="450"
              y="225"
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="12"
            >
              左のパレットからドラッグ、またはプリセットを選択
            </text>
          </g>
        )}
        <text x="18" y="412" fill="var(--muted)" fontSize="10">
          力：1 N = {f(scale * 0.08 * vectors.scale)} 図内単位 /
          速度・加速度：12 × {vectors.scale} 図内単位／各SI単位 ·{" "}
          {model === "unsupported"
            ? "構成を確認してください"
            : model === "springs"
              ? "水平ガイド上の運動"
              : "SI単位系"}
          　（外力の丸い先端はドラッグ可能）
        </text>
      </svg>
    </div>
  );
}
