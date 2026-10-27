import { useRef, useState } from "react";
import {
  Hand,
  LocateFixed,
  MousePointer2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Scene, MultiFrame, Force } from "./types";
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
  forceVisible,
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
  forceVisible: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      type: string;
      pan: { x: number; y: number };
    } | null>(null);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [hand, setHand] = useState(false),
    [follow, setFollow] = useState(true),
    [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
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
    if (type === "body") onSelect(id);
    if (tool !== "select" && type === "body") return;
    const q = point(ev.clientX, ev.clientY);
    drag.current = { id, ...q, type, pan };
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
    if (d.type === "force") {
      const a = scene.external.find((f) => f.id === d.id)!,
        b = position(a.body);
      onForce(
        d.id,
        Math.max(-100, Math.min(100, (q.x - X(b.x)) / (scale * 0.08))),
        Math.max(-100, Math.min(100, (Y(b.y) - q.y) / (scale * 0.08))),
      );
    } else onMove(d.id, (q.x - ox) / scale, (oy - q.y) / scale);
  }
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
              : "ドラッグで初期位置を変更 · 外力の先端で向きと大きさを設定"}
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
            onClick={() => setHand(false)}
            className={!hand ? "active" : ""}
          >
            <MousePointer2 size={15} />
          </button>
          <button
            aria-label="実験室の視点移動"
            onClick={() => {
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
            Math.round(((q.x - ox) / scale) * 2) / 2,
            Math.round(((oy - q.y) / scale) * 2) / 2,
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
          else setGhost(q);
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
          {Object.entries(forceColors).map(([kind, color]) => (
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
          ))}
        </defs>
        <rect width="900" height="430" fill="url(#multi-grid)" />
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
        {forceVisible &&
          current?.bodies
            .filter((b) =>
              scene.objects.find((o) => o.id === b.id && isDynamic(o)),
            )
            .filter(
              (b) =>
                !scene.objects.some((o) => o.id === selected && isDynamic(o)) ||
                b.id === selected ||
                (!!pair && b.forces.some((f) => f.pair === pair)),
            )
            .flatMap((b) =>
              b.forces.map((a: Force, i) =>
                Math.hypot(a.fx, a.fy) < 1e-8 ? null : (
                  <g
                    className="multi-vector"
                    key={`${b.id}-${i}`}
                    opacity={pair && pair !== a.pair ? 0.2 : 1}
                  >
                    <line
                      x1={X(b.x)}
                      y1={Y(b.y)}
                      x2={X(b.x) + a.fx * scale * 0.08}
                      y2={Y(b.y) - a.fy * scale * 0.08}
                      stroke={forceColors[a.kind]}
                      strokeWidth={pair === a.pair && pair ? 4 : 2}
                      markerEnd={`url(#multi-arrow-${a.kind})`}
                    />
                    <text
                      x={X(b.x) + a.fx * scale * 0.08 + 6}
                      y={Y(b.y) - a.fy * scale * 0.08 - 7}
                      fontSize="10"
                      fill={forceColors[a.kind]}
                      paintOrder="stroke"
                      stroke="var(--stage)"
                      strokeWidth="3"
                    >
                      {a.label} {f(Math.hypot(a.fx, a.fy), 1)} N
                    </text>
                  </g>
                ),
              ),
            )}
        {scene.external.map((a) => {
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
                  x2={X(b.x) + a.fx * scale * 0.08}
                  y2={Y(b.y) - a.fy * scale * 0.08}
                  stroke={forceColors.external}
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                <circle
                  cx={X(b.x) + a.fx * scale * 0.08}
                  cy={Y(b.y) - a.fy * scale * 0.08}
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
          <circle
            cx={ghost.x}
            cy={ghost.y}
            r="16"
            fill="#96aa6e33"
            stroke="#8ba473"
            strokeDasharray="4 3"
          />
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
          力の矢印：1 N = {f(scale * 0.08)} 図内単位 ·{" "}
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
