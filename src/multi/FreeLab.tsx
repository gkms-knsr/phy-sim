import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  FlaskConical,
  HelpCircle,
  Link2,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  Scene,
  MultiPreset,
  MultiResult,
  LabObject,
  Connection,
  ExternalForce,
  ObjectKind,
} from "./types";
import { isDynamic } from "./types";
import { blankScene, newObject, removeItem, moveObject } from "./editor";
import { frameIndex, nextTime, format as f } from "../clock";
import { MathText } from "../components/Explanation";
import { callPhysics } from "../physics/client";
import { MultiStage } from "./MultiStage";
import { ForceDiagram } from "./ForceDiagram";
import { Inspector } from "./Inspector";
import { MultiGraph } from "./MultiGraph";
import { EditorControls } from "./EditorControls";
import { QuickStart, LabGuide } from "./LabGuide";
import { RunStatus } from "./RunStatus";
import { readInteraction, readVectors, inferEditorModel } from "./interaction";
import "./multi.css";
const palette = [
  ["mass", "●", "質点"],
  ["block", "▣", "剛体ブロック"],
  ["platform", "▰", "動く台"],
  ["wall", "▥", "固定壁"],
  ["floor", "━", "床"],
  ["incline", "◿", "斜面"],
  ["spring", "∿", "ばね"],
  ["rope", "⌁", "糸"],
  ["pulley", "⊙", "固定滑車"],
  ["external", "↗", "外力"],
  ["anchor", "⊕", "固定支点"],
];
export default function FreeLab({
  onBack,
  initialScene,
  onRetain,
}: {
  onBack: () => void;
  initialScene?: Scene | null;
  onRetain?: (scene: Scene) => void;
}) {
  const [scene, setScene] = useState<Scene | null>(initialScene || null),
    [presets, setPresets] = useState<MultiPreset[]>([]),
    [result, setResult] = useState<MultiResult | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [selected, setSelected] = useState("load"),
    [tool, setTool] = useState("select"),
    [endpoint, setEndpoint] = useState(""),
    [vectors, setVectors] = useState(readVectors),
    [interaction, setInteraction] = useState(readInteraction),
    [guideOpen, setGuideOpen] = useState(false),
    [pair, setPair] = useState(""),
    [deriving, setDeriving] = useState(false),
    [step, setStep] = useState(1),
    [notice, setNotice] = useState("");
  const [dark, setDark] = useState(
    () => localStorage.getItem("physica-theme") === "dark",
  );
  const [resultScene, setResultScene] = useState<Scene | null>(null);
  useEffect(() => {
    localStorage.setItem("physica-interaction", JSON.stringify(interaction));
  }, [interaction]);
  useEffect(() => {
    localStorage.setItem("physica-vectors", JSON.stringify(vectors));
  }, [vectors]);
  const sequence = useRef(0),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("physica-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const c = new AbortController();
    callPhysics<MultiPreset[]>("/api/multi/presets", { signal: c.signal })
      .then((items: MultiPreset[]) => {
        setPresets(items);
        setScene(
          initialScene ||
            structuredClone(
              items.find((p) => p.id === "platform-stick")!.scene,
            ),
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(
            e.message ||
              "実験室を準備できませんでした。ページを再読み込みしてください。",
          );
          setLoading(false);
        }
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (scene) onRetain?.(scene);
  }, [scene]);
  useEffect(() => {
    if (!scene) return;
    const c = new AbortController();
    setPlaying(false);
    setTime(0);
    setLoading(true);
    setResult(null);
    setError("");
    const timer = setTimeout(() => {
      callPhysics<MultiResult>("/api/multi/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
        signal: c.signal,
      })
        .then((r) => {
          setResult(r);
          setResultScene(scene);
          setLoading(false);
        })
        .catch((e) => {
          if (e.name !== "AbortError") {
            setError(e.message || "計算を完了できませんでした。");
            setLoading(false);
          }
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [scene]);
  const ready =
    !!result?.supported &&
    !loading &&
    resultScene === scene &&
    !!result.frames.length;
  const canPlay = ready && tool === "select" && !guideOpen;
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const openGuide = () => {
    setPlaying(false);
    setGuideOpen(true);
  };
  const current = ready
    ? result.frames[frameIndex(time, result.dt, result.frames.length)]
    : null;
  useEffect(() => {
    if (!playing || !canPlay) return;
    let id = 0,
      last: number | null = null;
    const tick = (now: number) => {
      if (last !== null)
        setTime((t) =>
          nextTime(t, (now - last!) / 1000, speed, result.duration),
        );
      last = now;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, canPlay, speed, result]);
  useEffect(() => {
    if (result && time >= result.duration) setPlaying(false);
  }, [time, result]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !["INPUT", "SELECT", "BUTTON", "TEXTAREA", "SUMMARY"].includes(
          (e.target as HTMLElement).tagName,
        ) &&
        canPlay
      ) {
        e.preventDefault();
        setPlaying((p) => !p);
        if (time >= result!.duration) setTime(0);
      }
      if (e.key === "Escape" && !guideOpen) {
        setTool("select");
        setEndpoint("");
        setDeriving(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [canPlay, time, result, guideOpen]);
  function change(next: Scene) {
    setPlaying(false);
    setTime(0);
    setScene(next);
    setLoading(true);
    setResult(null);
    setPair("");
  }
  function editTarget(id: string) {
    setTool("select");
    setEndpoint("");
    setSelected(id);
    setPair("");
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(".multi-inspector");
      panel?.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      panel?.focus({ preventScroll: true });
    });
  }
  function loadExample(id: string) {
    const p = presets.find((p) => p.id === id);
    if (p) load(p);
  }
  function uid(prefix: string) {
    let id: string;
    do {
      id = `${prefix}${++sequence.current}`;
    } while (
      scene &&
      [...scene.objects, ...scene.connections, ...scene.external].some(
        (o) => o.id === id,
      )
    );
    return id;
  }
  function select(id: string) {
    if (!scene) return;
    if (tool === "spring" || tool === "rope") {
      if (!scene.objects.some((o) => o.id === id)) return;
      if (!endpoint) {
        setEndpoint(id);
        setNotice("第2端を選択してください");
        return;
      }
      if (endpoint === id) {
        setNotice("異なる端点を選択してください");
        return;
      }
      const a = scene.objects.find((o) => o.id === endpoint)!,
        b = scene.objects.find((o) => o.id === id)!,
        pulley = scene.objects.find((o) => o.kind === "pulley");
      const connection: Connection = {
        id: uid(tool === "spring" ? "k" : "rope"),
        kind: tool,
        a: a.id,
        b: b.id,
        k: 8,
        rest: Math.max(
          0.1,
          tool === "rope" && pulley
            ? Math.hypot(a.x - (pulley.x - 0.4), a.y - pulley.y) +
                Math.hypot(b.x - (pulley.x + 0.4), b.y - pulley.y)
            : Math.abs(a.x - b.x),
        ),
        pulley: pulley?.id || "",
      };
      change({ ...scene, connections: [...scene.connections, connection] });
      setSelected(connection.id);
      setTool("select");
      setEndpoint("");
      return;
    }
    setSelected(id);
    setPair("");
  }
  function add(kind: string, x = 0, y = 0) {
    if (!scene) return;
    if (kind === "spring" || kind === "rope") {
      setPlaying(false);
      setTime(0);
      setTool(kind);
      setEndpoint("");
      setNotice(
        `${kind === "spring" ? "ばね" : "糸"}の第1端を選択してください`,
      );
      return;
    }
    if (kind === "external") {
      const target =
        scene.objects.find((o) => o.id === selected && isDynamic(o)) ||
        scene.objects.find(isDynamic);
      if (!target) {
        setNotice("先に動く物体を配置してください");
        return;
      }
      const force = { id: uid("F"), body: target.id, fx: 8, fy: 0 };
      change({ ...scene, external: [...scene.external, force] });
      setSelected(force.id);
      return;
    }
    if (!palette.some((a) => a[0] === kind)) return;
    const object = newObject(kind as ObjectKind, uid(kind), x, y),
      deck = scene.objects.find((o) => o.kind === "platform");
    if (deck && ["mass", "block"].includes(kind)) {
      object.support = deck.id;
      object.y = deck.y + (deck.height + object.height) / 2;
    }
    if (deck && kind === "floor") object.y = deck.y - deck.height / 2;
    change({ ...scene, objects: [...scene.objects, object] });
    setSelected(object.id);
    setTool("select");
  }
  function updateObject(id: string, patch: Partial<LabObject>) {
    if (!scene) return;
    const original = scene.objects.find((o) => o.id === id);
    if (
      !original ||
      Object.entries(patch).every(
        ([key, value]) => original[key as keyof LabObject] === value,
      )
    )
      return;
    let next = {
      ...scene,
      objects: scene.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    };
    const obj = next.objects.find((o) => o.id === id)!;
    if (
      patch.support &&
      next.objects.find((o) => o.id === patch.support)?.kind === "platform"
    ) {
      const support = next.objects.find((o) => o.id === patch.support)!;
      obj.y = support.y + (support.height + obj.height) / 2;
    }
    if (patch.angle !== undefined && obj.kind === "incline") {
      const link = next.connections.find((c) => c.kind === "rope"),
        pulley = next.objects.find((o) => o.id === link?.pulley),
        body = next.objects.find((o) => o.id === link?.a);
      if (body && pulley) {
        const q = Math.hypot(body.x - (pulley.x - 0.4), body.y - pulley.y),
          a = (patch.angle * Math.PI) / 180;
        next = {
          ...next,
          objects: next.objects.map((o) =>
            o.id === body.id
              ? {
                  ...o,
                  x: pulley.x - 0.4 - q * Math.cos(a),
                  y: pulley.y - q * Math.sin(a),
                }
              : o,
          ),
        };
      }
    }
    change(next);
  }
  function updateConnection(id: string, patch: Partial<Connection>) {
    if (scene)
      change({
        ...scene,
        connections: scene.connections.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      });
  }
  function updateExternal(id: string, patch: Partial<ExternalForce>) {
    if (scene)
      change({
        ...scene,
        external: scene.external.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      });
  }
  function load(p: MultiPreset) {
    change(structuredClone(p.scene));
    setSelected("system");
    setTool("select");
    setEndpoint("");
    setStep(1);
  }
  function save() {
    if (!scene) return;
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify({ version: 1, scene }, null, 2)], {
          type: "application/json",
        }),
      );
    a.href = url;
    a.download = "physica-experiment.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importScene(e: React.ChangeEvent<HTMLInputElement>) {
    const target = e.target,
      chosen = target.files?.[0];
    target.value = "";
    if (!chosen) return;
    try {
      if (chosen.size > 60000)
        throw new Error("60 KB以下のファイルを選択してください");
      const raw = JSON.parse(await chosen.text()),
        candidate = raw.scene ?? raw;
      await callPhysics<MultiResult>("/api/multi/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: candidate }),
      });
      const canonical = await callPhysics<Scene>("/api/multi/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: candidate }),
      });
      change(canonical);
      setSelected("system");
      setNotice("実験を読み込みました");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "読み込めませんでした");
    }
  }
  if (!scene)
    return (
      <div className="multi-loading">
        <button onClick={onBack}>← 基本実験に戻る</button>
        <h1>自由実験室</h1>
        <p>{error || "実験室を準備しています…"}</p>
        <p>
          初回は計算環境の読み込みに少し時間がかかります。ページを閉じずにお待ちください。
        </p>
      </div>
    );
  const dynamic = scene.objects.filter(isDynamic),
    mass = dynamic.reduce((a, b) => a + b.mass, 0),
    regime = current?.regime;
  const status = loading
    ? "構成を確認中"
    : tool !== "select"
      ? "接続操作中"
      : error
        ? "入力を確認してください"
        : !result?.supported
          ? "未対応の構成"
          : playing
            ? "実行中"
            : regime === "sticking"
              ? "一体で運動"
              : regime === "sliding"
                ? "相対的に滑走"
                : regime === "taut"
                  ? "糸が張っている"
                  : regime === "slack"
                    ? "糸がたるんでいる"
                    : "一時停止";
  return (
    <div className="free-lab">
      <header className="multi-header">
        <a className="brand" href="#">
          <span className="brand-symbol">φ</span>
          <span>
            PHYSICA<small>COUPLED MOTION LAB</small>
          </span>
        </a>
        <div>
          <button aria-label="自由実験の使い方" onClick={openGuide}>
            <HelpCircle size={16} />
            使い方
          </button>
          <button onClick={onBack}>
            <ArrowLeft size={15} />
            基本実験に戻る
          </button>
          <button onClick={save}>
            <Download size={15} />
            保存
          </button>
          <button onClick={() => file.current?.click()}>
            <Upload size={15} />
            読み込む
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importScene}
          />
          <button
            aria-label="実験室のテーマ切替"
            onClick={() => setDark((v) => !v)}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      <div className="multi-workspace">
        <aside className="multi-palette">
          <div className="palette-heading">
            <FlaskConical size={18} />
            <h2>実験をつくる</h2>
          </div>
          <p>
            ドラッグして配置
            <br />
            クリックでも追加できます
          </p>
          <div className="palette-items">
            {palette.map(([kind, symbol, label]) => (
              <button
                key={kind}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/physica", kind)
                }
                onClick={() =>
                  add(
                    kind,
                    scene.objects.length
                      ? Math.min(7, scene.objects.length * 1.5 - 3)
                      : 0,
                    0,
                  )
                }
                aria-label={`${label}を追加`}
                className={tool === kind ? "active" : ""}
              >
                <span>{symbol}</span>
                {label}
              </button>
            ))}
          </div>
          <div className="preset-list-heading">
            実験プリセット<span>8 SCENES</span>
          </div>
          <div className="multi-presets">
            {presets.map((p, i) => (
              <button key={p.id} onClick={() => load(p)} title={p.description}>
                <small>{String(i + 1).padStart(2, "0")}</small>
                <span>{p.name}</span>
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
          <button
            className="new-scene"
            onClick={() => {
              change(blankScene());
              setSelected("system");
              setTool("select");
              setEndpoint("");
            }}
          >
            <Plus size={14} />
            空の実験をつくる
          </button>
        </aside>
        <main className="multi-main">
          <div className="multi-title">
            <div>
              <div className="eyebrow">
                FREE EXPLORATION · 力から運動を読み解く
              </div>
              <h1>
                自由実験室<span>連成運動</span>
              </h1>
              <p>ひとつひとつの力を、系全体の運動につなげよう。</p>
            </div>
            <span
              className={`multi-status ${ready ? "valid" : ""}`}
              role="status"
            >
              {ready ? <Check size={13} /> : <Link2 size={13} />} {status}
            </span>
          </div>
          <QuickStart onGuide={openGuide} onPreset={loadExample} />
          <div className="multi-columns">
            <div className="multi-center">
              <section className="card">
                <div className="card-heading">
                  <h2>{scene.title}</h2>
                  <div className="multi-inline-controls">
                    <button
                      className={selected === "system" ? "active" : ""}
                      onClick={() => {
                        setTool("select");
                        setSelected("system");
                        setPair("");
                      }}
                    >
                      系全体を選択
                    </button>
                  </div>
                </div>
                <EditorControls
                  interaction={interaction}
                  onInteraction={setInteraction}
                  vectors={vectors}
                  onVectors={setVectors}
                />
                <MultiStage
                  scene={scene}
                  current={current}
                  selected={selected}
                  onSelect={select}
                  onMove={(id, x, y) =>
                    change(
                      moveObject(
                        scene,
                        id,
                        x,
                        y,
                        result?.model && result.model !== "unsupported"
                          ? result.model
                          : inferEditorModel(scene),
                      ),
                    )
                  }
                  onForce={(id, fx, fy) => updateExternal(id, { fx, fy })}
                  onDrop={add}
                  onPause={() => setPlaying(false)}
                  model={
                    result?.model && result.model !== "unsupported"
                      ? result.model
                      : inferEditorModel(scene)
                  }
                  tool={tool}
                  pair={pair}
                  vectors={vectors}
                  interaction={interaction}
                  frames={result?.frames || []}
                  endpoint={endpoint}
                  onSelectionTool={() => {
                    setTool("select");
                    setEndpoint("");
                  }}
                />
                {tool !== "select" && (
                  <div className="multi-connect-hint">
                    <Link2 size={14} />
                    {endpoint
                      ? `第1端：${endpoint} → 第2端をクリック`
                      : "最初の端点をクリックしてください"}
                    <button
                      onClick={() => {
                        setTool("select");
                        setEndpoint("");
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                )}
                <div id="lab-run-status">
                  <RunStatus
                    scene={scene}
                    result={result}
                    loading={loading}
                    error={error}
                    tool={tool}
                    endpoint={endpoint}
                    onSelect={editTarget}
                    onCancel={() => {
                      setTool("select");
                      setEndpoint("");
                    }}
                    onGuide={openGuide}
                    onAdd={() => add("mass")}
                  />
                </div>
                <div className="multi-playback">
                  <button
                    aria-label="自由実験をリセット"
                    onClick={() => {
                      setPlaying(false);
                      setTime(0);
                    }}
                  >
                    <RotateCcw size={17} />
                  </button>
                  <button
                    className="primary-button"
                    aria-describedby="lab-run-status"
                    disabled={!canPlay}
                    aria-label={
                      playing ? "自由実験を一時停止" : "自由実験を再生"
                    }
                    onClick={() => {
                      if (time >= result!.duration) setTime(0);
                      setPlaying((p) => !p);
                    }}
                  >
                    {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                    {playing ? "一時停止" : "再生"}
                  </button>
                  <button
                    aria-label="自由実験を1ステップ進める"
                    disabled={!canPlay}
                    onClick={() => {
                      setPlaying(false);
                      setTime((t) =>
                        Math.min(
                          result!.duration,
                          (frameIndex(t, result!.dt, result!.frames.length) +
                            1) *
                            result!.dt,
                        ),
                      );
                    }}
                  >
                    <SkipForward size={17} />
                  </button>
                  <strong>
                    {f(current?.t || 0)}
                    <small>s</small>
                  </strong>
                  <select
                    aria-label="自由実験の再生速度"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    {[0.25, 0.5, 1, 2, 4].map((v) => (
                      <option value={v} key={v}>
                        {v}×
                      </option>
                    ))}
                  </select>
                </div>
                <div className="multi-timeline">
                  <span>0 s</span>
                  <input
                    type="range"
                    aria-label="自由実験の時刻"
                    min="0"
                    max={result?.duration || scene.duration}
                    step={result?.dt || 1 / 120}
                    value={time}
                    disabled={!canPlay}
                    onChange={(e) => {
                      setPlaying(false);
                      setTime(Number(e.target.value));
                    }}
                  />
                  <span>{f(result?.duration || scene.duration, 2)} s</span>
                </div>
              </section>
              {result?.warning && (
                <div className="multi-boundary">
                  <strong>
                    {time >= result.duration
                      ? "対応範囲の端で停止しました"
                      : `この条件で実行できる時間：${f(result.duration)} sまで`}
                  </strong>
                  <p>
                    {time >= result.duration
                      ? result.warning
                      : result.warning.replace(
                          "その直前で停止しました",
                          "その直前まで計算します",
                        )}
                  </p>
                </div>
              )}
              <div className="multi-summary card">
                <div>
                  <span>重心位置 (x, y)</span>
                  <strong>
                    ({f(current?.cx || 0)}, {f(current?.cy || 0)})
                    <small>m</small>
                  </strong>
                </div>
                <div>
                  <span>重心加速度 (aₓ, aᵧ)</span>
                  <strong>
                    ({f(current?.cax || 0)}, {f(current?.cay || 0)})
                    <small>m/s²</small>
                  </strong>
                </div>
                <div>
                  <span>力学的エネルギー</span>
                  <strong>
                    {f(current?.energy || 0)}
                    <small>J</small>
                  </strong>
                </div>
                <div>
                  <span>全運動量 (pₓ, pᵧ)</span>
                  <strong>
                    ({f(current?.px || 0)}, {f(current?.py || 0)})
                    <small>kg·m/s</small>
                  </strong>
                </div>
              </div>
              <section className="card multi-body-data">
                <div className="card-heading">
                  <h2>それぞれの物体の運動</h2>
                  <span className="subtle">位置・速度・加速度は世界座標</span>
                </div>
                <div className="multi-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>物体</th>
                        <th>位置 (x, y) [m]</th>
                        <th>速度 (vₓ, vᵧ) [m/s]</th>
                        <th>加速度 (aₓ, aᵧ) [m/s²]</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dynamic.map((o) => {
                        const b = current?.bodies.find((b) => b.id === o.id);
                        return (
                          <tr
                            key={o.id}
                            onClick={() => select(o.id)}
                            className={selected === o.id ? "active" : ""}
                          >
                            <th>
                              <button onClick={() => select(o.id)}>
                                {o.label}
                              </button>
                            </th>
                            <td>
                              ({f(b?.x ?? o.x)}, {f(b?.y ?? o.y)})
                            </td>
                            <td>
                              ({f(b?.vx ?? o.vx)}, {f(b?.vy ?? o.vy)})
                            </td>
                            <td>{b ? `(${f(b.ax)}, ${f(b.ay)})` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <MultiGraph
                scene={scene}
                result={ready ? result : null}
                time={current?.t || 0}
              />
              <ForceDiagram
                objects={scene.objects}
                states={current?.bodies || []}
                selected={selected}
                onPair={setPair}
                vectors={vectors}
              />
              <section className="card multi-equations">
                <div className="card-heading">
                  <h2>力から運動方程式へ</h2>
                  <button
                    className="derive-button"
                    onClick={() => {
                      setDeriving((v) => !v);
                      setStep(1);
                    }}
                  >
                    式の導出を見る
                    <ChevronRight size={14} />
                  </button>
                </div>
                {result?.equations.map((tex, i) => (
                  <MathText key={i} tex={tex} />
                ))}
                {current && (
                  <div className="system-equation">
                    <span>動く物体全体：内力を相殺して重心の式へ</span>
                    <MathText
                      tex={`\\sum \\mathbf F_{\\rm ext}=(${f(mass)})\\,\\mathbf a_G=(${f(mass * current.cax)},${f(mass * current.cay)})\\,\\mathrm N`}
                    />
                    {result?.model === "platform" && (
                      <p>
                        必要な静止摩擦：
                        {f(Number(result.meta.requiredFriction))} N / 限界：
                        {f(Number(result.meta.staticLimit))} N
                      </p>
                    )}
                  </div>
                )}
                {deriving && (
                  <div className="derivation" aria-label="式の段階的な導出">
                    {result?.derivation.slice(0, step).map((text, i) => (
                      <p key={i}>{text}</p>
                    ))}
                    {step < (result?.derivation.length || 0) && (
                      <button onClick={() => setStep((s) => s + 1)}>
                        次のステップへ
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}
                <div className="multi-assumptions">
                  <strong>モデルの仮定と適用条件</strong>
                  {result?.assumptions.map((a) => (
                    <p key={a}>{a}</p>
                  ))}
                </div>
              </section>
            </div>
            <aside className="multi-right">
              <Inspector
                scene={scene}
                selected={selected}
                onObject={updateObject}
                onConnection={updateConnection}
                onExternal={updateExternal}
                positionStep={interaction.positionStep}
                forceStep={interaction.forceStep}
                onRemove={(id) => {
                  change(removeItem(scene, id));
                  setSelected("system");
                }}
              />
              <section className="card multi-inventory">
                <div className="card-heading">
                  <h2>接続と外力</h2>
                </div>
                {[
                  ...scene.connections.map((c) => ({
                    id: c.id,
                    label: `${c.kind === "spring" ? "∿" : "⌁"} ${c.id} · ${c.a} ↔ ${c.b}`,
                  })),
                  ...scene.external.map((c) => ({
                    id: c.id,
                    label: `↗ ${c.id} → ${c.body}`,
                  })),
                ].map((c) => (
                  <button
                    key={c.id}
                    className={selected === c.id ? "active" : ""}
                    onClick={() => {
                      setTool("select");
                      setSelected(c.id);
                    }}
                  >
                    {c.label}
                    <ChevronRight size={12} />
                  </button>
                ))}
                {!scene.connections.length && !scene.external.length && (
                  <p className="multi-muted">
                    ばね・糸は両端をクリックして接続。外力は選択中の物体に追加します。
                  </p>
                )}
              </section>
              {result?.modes.length ? (
                <section className="card multi-modes">
                  <div className="card-heading">
                    <h2>2質点の固有モード</h2>
                  </div>
                  <p className="multi-muted">
                    ξは平衡位置からの変位。質量が異なる場合は振幅比も変わります。
                  </p>
                  {result.modes.map((mode, i) => (
                    <div key={i}>
                      <strong>
                        モード {i + 1} ·{" "}
                        {mode.omega < 1e-8
                          ? "並進（振動数0）"
                          : mode.vector[0] * mode.vector[1] > 0
                            ? "同位相"
                            : "逆位相"}
                      </strong>
                      <p>
                        ω = {f(mode.omega, 3)} rad/s
                        <br />f = {f(mode.frequency, 3)} Hz · T ={" "}
                        {mode.period ? `${f(mode.period, 3)} s` : "—"}
                        <br />
                        振幅比 ({mode.vector.map((v) => f(v, 3)).join(", ")})
                      </p>
                      <div className="mode-shape">
                        {mode.vector.map((v, j) => (
                          <span
                            key={j}
                            style={{ transform: `translateX(${v * 12}px)` }}
                          >
                            {v < 0 ? "←" : "→"} {j + 1}
                          </span>
                        ))}
                      </div>
                      <button
                        disabled={!Array.isArray(result.meta.equilibrium)}
                        onClick={() => {
                          const eq = result.meta.equilibrium as number[];
                          change({
                            ...scene,
                            objects: scene.objects.map((o) => {
                              const j = dynamic.findIndex((b) => b.id === o.id);
                              return j < 0
                                ? o
                                : {
                                    ...o,
                                    x: eq[j] + 0.4 * mode.vector[j],
                                    vx: 0,
                                    vy: 0,
                                  };
                            }),
                          });
                        }}
                      >
                        このモードで初期変位を設定
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}
              <section className="card multi-settings">
                <div className="card-heading">
                  <h2>実験環境</h2>
                </div>
                <label>
                  重力 g [m/s²]
                  <input
                    aria-label="自由実験の重力"
                    type="number"
                    value={scene.g}
                    min=".1"
                    max="20"
                    step=".1"
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 0.1 && v <= 20) change({ ...scene, g: v });
                    }}
                  />
                </label>
                <label>
                  実験時間 [s]
                  <select
                    aria-label="自由実験の実験時間"
                    value={scene.duration}
                    onChange={(e) =>
                      change({ ...scene, duration: Number(e.target.value) })
                    }
                  >
                    {[6, 12, 20, 30].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="multi-muted">
                  物体の位置・速度・外力を変更したら、最初から再計算します。
                </p>
              </section>
            </aside>
          </div>
          <footer className="workspace-footer">
            <span>それぞれの物体に、力と理由がある。</span>
            <span>SI単位系 · 対応する拘束を検証して計算</span>
          </footer>
        </main>
      </div>
      <LabGuide open={guideOpen} onClose={closeGuide} onPreset={loadExample} />
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
