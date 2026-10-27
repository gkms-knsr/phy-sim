import { useEffect, useRef, useState } from "react";
import FreeLab from "./multi/FreeLab";
import type { Scene } from "./multi/types";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownToLine,
  Atom,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  FlaskConical,
  Grip,
  HelpCircle,
  Lightbulb,
  Maximize2,
  Moon,
  MoveRight,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  SlidersHorizontal,
  Sun,
  Triangle,
  Waves,
  Waypoints,
  X,
} from "lucide-react";
import { experiments, defaults } from "./experiments";
import type { Kind, Mode, Params, Result, Visibility } from "./types";
import { EMPTY } from "./types";
import { frameIndex, nextTime, format as f } from "./clock";
import { Parameter } from "./components/Parameter";
import { Measurements } from "./components/Measurements";
import { Stage } from "./components/Stage";
import { Graph } from "./components/Graph";
import { Explanation } from "./components/Explanation";
const icons = {
  linear: MoveRight,
  incline: Triangle,
  projectile: Waypoints,
  spring: Waves,
  collision: Grip,
};
function LegacyLab({ onFree }: { onFree: () => void }) {
  const [kind, setKind] = useState<Kind>("linear");
  const experiment = experiments.find((e) => e.id === kind)!;
  const [params, setParams] = useState<Params>(() => defaults(experiments[0]));
  const [result, setResult] = useState<Result | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<Mode>("learn");
  const [visible, setVisible] = useState<Visibility>({
    force: false,
    velocity: true,
    acceleration: true,
    trail: true,
    grid: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(
    () => localStorage.getItem("physica-theme") === "dark",
  );
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState("");
  const [preset, setPreset] = useState(0);
  const stageCard = useRef<HTMLElement>(null);
  const isCurrent =
    !!result &&
    result.kind === kind &&
    Object.keys(params).every((k) => result.params[k] === params[k]);
  const ready = isCurrent && !loading && !error;
  const frame = ready
    ? result.frames[frameIndex(time, result.dt, result.frames.length)]
    : EMPTY;
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("physica-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPlaying(false);
    setTime(0);
    const timer = setTimeout(() => {
      fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, params }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "計算できませんでした");
          return data as Result;
        })
        .then((data) => {
          setResult(data);
          setLoading(false);
        })
        .catch((e) => {
          if (e.name !== "AbortError") {
            setError(
              e instanceof TypeError
                ? "計算サーバーに接続できません。アプリを起動し直してください。"
                : e.message || "計算を完了できませんでした。",
            );
            setLoading(false);
          }
        });
    }, 100);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, params]);
  useEffect(() => {
    if (!playing || !ready) return;
    let id = 0;
    let previous: number | null = null;
    const tick = (now: number) => {
      if (previous !== null)
        setTime((t) =>
          nextTime(t, (now - previous!) / 1000, speed, result.duration),
        );
      previous = now;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, ready, speed, result]);
  useEffect(() => {
    if (result && time >= result.duration) setPlaying(false);
  }, [time, result]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        ) &&
        !help
      ) {
        e.preventDefault();
        if (ready) {
          setPlaying((v) => !v);
          if (time >= 30) setTime(0);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, time, help]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const close = document.querySelector<HTMLButtonElement>(".dialog-close");
    close?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelp(false);
      if (e.key === "Tab") {
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(".help-dialog button"),
        );
        const index = els.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        els[(index + (e.shiftKey ? -1 : 1) + els.length) % els.length]?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [help]);
  function edit(p: Params) {
    setPlaying(false);
    setTime(0);
    setPreset(-1);
    setParams((prev) => ({ ...prev, ...p }));
    setNotice("初期条件を更新しました");
  }
  function choose(id: Kind) {
    const e = experiments.find((e) => e.id === id)!;
    setPlaying(false);
    setTime(0);
    setKind(id);
    setParams(defaults(e));
    setPreset(id === "incline" ? -1 : 0);
    setVisible((v) => ({ ...v, force: id === "incline" || id === "spring" }));
  }
  function reset() {
    setPlaying(false);
    setTime(0);
    setNotice("初期状態に戻しました");
  }
  function download() {
    if (!result) return;
    const columns =
      kind === "collision"
        ? ["t", "x", "x2", "vx", "vx2", "momentum", "kinetic"]
        : [
            "t",
            "x",
            ...(["incline", "projectile"].includes(kind) ? ["y"] : []),
            "vx",
            ...(["incline", "projectile"].includes(kind) ? ["vy"] : []),
            "ax",
            ...(["incline", "projectile"].includes(kind) ? ["ay"] : []),
            "kinetic",
            ...(["incline", "projectile", "spring"].includes(kind)
              ? ["potential"]
              : []),
            "energy",
          ];
    const units: Record<string, string> = {
      t: "s",
      x: "m",
      y: "m",
      x2: "m",
      vx: "m/s",
      vy: "m/s",
      vx2: "m/s",
      ax: "m/s²",
      ay: "m/s²",
      momentum: "kg·m/s",
      kinetic: "J",
      potential: "J",
      energy: "J",
    };
    const csv = [
      columns.map((c, i) => `${c} [${units[c]}]`).join(","),
      ...result.frames
        .filter((_, i) => i % 12 === 0)
        .map((r) => columns.map((c) => r[c as keyof typeof r]).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    a.href = url;
    a.download = `physica-${kind}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("解析データを書き出しました");
  }
  const Icon = icons[kind];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="./" aria-label="PHYSICA ホーム">
          <span className="brand-symbol">φ</span>
          <span>
            PHYSICA<small>INTERACTIVE PHYSICS LAB</small>
          </span>
        </a>
        <div className="sidebar-section">
          実験を選ぶ<span>EXPERIMENTS</span>
        </div>
        <nav className="experiment-nav" aria-label="実験選択">
          {experiments.map((e, i) => {
            const I = icons[e.id];
            return (
              <button
                key={e.id}
                className={kind === e.id ? "active" : ""}
                onClick={() => choose(e.id)}
              >
                <span className="nav-icon">
                  <I size={19} />
                </span>
                <span>
                  <small>EXPERIMENT 0{i + 1}</small>
                  {e.short}
                </span>
                {kind === e.id && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
        <button
          className="free-entry"
          onClick={() => {
            setPlaying(false);
            onFree();
          }}
        >
          <FlaskConical size={18} />
          <span>
            自由実験・連成運動<small>NEW · MULTI-BODY LAB</small>
          </span>
          <ChevronRight size={14} />
        </button>
        <div className="sidebar-note">
          <div className="orbit-art">
            <Atom size={47} strokeWidth={0.8} />
            <i />
            <span>?</span>
          </div>
          <p>
            「なぜ？」を、
            <br />
            動かして見つけよう。
          </p>
          <span>
            条件を変えるたびに、
            <br />
            新しい発見が待っています。
          </span>
        </div>
        <div className="sidebar-bottom">
          <span className="online-dot" />
          高校物理の、小さな実験室<span>v1.0</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>実験室</span>
            <ChevronRight size={12} />
            <span>力学</span>
            <ChevronRight size={12} />
            <strong>{experiment.short}</strong>
          </div>
          <div className="top-actions">
            <span className="local-pill">
              <span />
              ローカル実験
            </span>
            <button aria-label="使い方" onClick={() => setHelp(true)}>
              <HelpCircle size={18} />
            </button>
            <button
              aria-label={dark ? "ライトモード" : "ダークモード"}
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span>EXPERIMENT 0{experiments.indexOf(experiment) + 1}</span>
                <i />
                {experiment.english}
              </div>
              <h1>
                {experiment.name}
                <span className="topic-tag">力学</span>
              </h1>
              <p>{experiment.description}</p>
            </div>
            <button className="outline-button" onClick={() => setHelp(true)}>
              <Compass size={15} />
              実験ガイド
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="mode-row">
            <div className="mode-switch" aria-label="表示モード">
              {(
                [
                  ["intuitive", "直感モード"],
                  ["learn", "学習モード"],
                  ["detail", "詳細モード"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={mode === id}
                  className={mode === id ? "active" : ""}
                  onClick={() => setMode(id)}
                >
                  {id === "intuitive" ? (
                    <Lightbulb size={14} />
                  ) : id === "learn" ? (
                    <BookIcon />
                  ) : (
                    <Settings2 size={14} />
                  )}{" "}
                  {label}
                </button>
              ))}
            </div>
            <span className="mode-description">
              {mode === "learn"
                ? "動きと数式を、つなげて理解する"
                : mode === "intuitive"
                  ? "まずは触って、動きを観察しよう"
                  : "仮定と保存則まで、もう一歩深く"}
            </span>
          </div>
          <div className="lab-grid">
            <div className="left-column">
              <section className="card simulation-card" ref={stageCard}>
                <div className="simulation-heading">
                  <div>
                    <Icon size={17} />
                    <strong>シミュレーション</strong>
                    <span className={`status ${playing ? "running" : ""}`}>
                      <i />
                      {loading
                        ? "計算中"
                        : playing
                          ? "実行中"
                          : time >= 30
                            ? "実験終了"
                            : "一時停止"}
                    </span>
                  </div>
                  <button
                    aria-label="シミュレーションを全画面表示"
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen();
                      else
                        stageCard.current
                          ?.requestFullscreen()
                          .catch(() =>
                            setNotice(
                              "このブラウザでは全画面表示を利用できません",
                            ),
                          );
                    }}
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
                <Stage
                  key={kind}
                  experiment={experiment}
                  p={params}
                  frame={frame}
                  result={ready ? result : null}
                  visible={visible}
                  onEdit={edit}
                  onPause={() => setPlaying(false)}
                  mode={mode}
                />
                <div className="visibility-row">
                  {(
                    [
                      ["velocity", "速度", "#d18d39"],
                      ["acceleration", "加速度", "#8e79b5"],
                      ["force", "力", "#57946f"],
                      ["trail", "軌跡", "#779c80"],
                      ["grid", "グリッド", "#a5ada2"],
                    ] as const
                  ).map(([key, label, color]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={visible[key]}
                        onChange={(e) =>
                          setVisible((v) => ({ ...v, [key]: e.target.checked }))
                        }
                      />
                      <span className="custom-check">
                        {visible[key] && <Check size={10} />}
                      </span>
                      <i style={{ background: color }} />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="playback">
                  <div className="transport">
                    <button
                      aria-label="リセット"
                      title="リセット"
                      onClick={reset}
                    >
                      <RotateCcw size={17} />
                    </button>
                    <button
                      className="play-button"
                      disabled={!ready}
                      aria-label={playing ? "一時停止" : "再生"}
                      onClick={() => {
                        if (time >= 30) setTime(0);
                        setPlaying((v) => !v);
                      }}
                    >
                      {playing ? (
                        <Pause size={17} fill="currentColor" />
                      ) : (
                        <Play size={17} fill="currentColor" />
                      )}
                      <span>{playing ? "一時停止" : "再生"}</span>
                    </button>
                    <button
                      aria-label="1ステップ進む"
                      title="1/120秒進む"
                      disabled={!ready}
                      onClick={() => {
                        setPlaying(false);
                        setTime((t) =>
                          Math.min(
                            30,
                            (frameIndex(t, result!.dt, result!.frames.length) +
                              1) *
                              result!.dt,
                          ),
                        );
                      }}
                    >
                      <SkipForward size={17} />
                    </button>
                  </div>
                  <div className="time-display">
                    <span>経過時間</span>
                    <strong>
                      {f(frame.t)}
                      <small>s</small>
                    </strong>
                  </div>
                  <label className="speed-control">
                    再生速度
                    <select
                      aria-label="再生速度"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    >
                      {[0.25, 0.5, 1, 2, 4].map((s) => (
                        <option key={s} value={s}>
                          {s}×
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} />
                  </label>
                </div>
                <div className="timeline-row">
                  <span>0 s</span>
                  <input
                    type="range"
                    aria-label="実験時刻"
                    min="0"
                    max="30"
                    step={1 / 120}
                    value={time}
                    disabled={!ready}
                    onChange={(e) => {
                      setPlaying(false);
                      setTime(Number(e.target.value));
                    }}
                  />
                  <span>30 s</span>
                </div>
                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}
              </section>
              <Measurements
                kind={kind}
                frame={frame}
                result={ready ? result : null}
              />
              <div className="analysis-grid">
                <Graph
                  result={ready ? result : null}
                  time={frame.t}
                  kind={kind}
                />
                <Explanation
                  kind={kind}
                  p={params}
                  frame={frame}
                  mode={mode}
                  result={ready ? result : null}
                  assumptions={experiment.assumptions}
                />
              </div>
              <Measurements
                secondary
                kind={kind}
                frame={frame}
                result={ready ? result : null}
              />
            </div>
            <aside className="right-column">
              <section className="card parameters-card">
                <div className="card-heading">
                  <h2>
                    <SlidersHorizontal size={16} />
                    実験の条件
                  </h2>
                  <button
                    aria-label="条件を初期値に戻す"
                    onClick={() => {
                      setParams(defaults(experiment));
                      setTime(0);
                      setPlaying(false);
                      setPreset(kind === "incline" ? -1 : 0);
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
                <div className="parameter-notice">
                  <RotateCcw size={12} />
                  <span>変更すると初期状態から再計算します</span>
                </div>
                {experiment.params.map((spec) => (
                  <Parameter
                    key={spec.key}
                    spec={spec}
                    value={params[spec.key]}
                    max={spec.key === "muk" ? params.mus : spec.max}
                    min={spec.key === "mus" ? params.muk : spec.min}
                    onChange={(v) => edit({ [spec.key]: v })}
                  />
                ))}
                <div className="parameter-footnote">
                  <span />
                  すべての値はSI単位系です
                </div>
              </section>
              <section className="card presets-card">
                <div className="card-heading">
                  <h2>
                    <FlaskConical size={16} />
                    プリセット
                  </h2>
                  <span className="subtle">まずはここから</span>
                </div>
                {experiment.presets.map((item, i) => (
                  <button
                    key={item.name}
                    className={`preset ${preset === i ? "active" : ""}`}
                    onClick={() => {
                      setParams({ ...defaults(experiment), ...item.values });
                      setTime(0);
                      setPlaying(false);
                      setPreset(i);
                      setNotice(`「${item.name}」を読み込みました`);
                    }}
                  >
                    <span className="preset-num">0{i + 1}</span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                    </span>
                    {preset === i ? (
                      <Check size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                ))}
              </section>
              <div className="discovery">
                <div>
                  <Lightbulb size={17} />
                  <strong>ちょっと、考えてみよう</strong>
                </div>
                <p>
                  {kind === "linear"
                    ? "速度と加速度の矢印が逆を向くとき、物体はどちらに進むでしょう？"
                    : kind === "incline"
                      ? "質量を2倍にすると、滑り出す角度は変わるでしょうか？"
                      : kind === "projectile"
                        ? "投射角30°と60°。飛距離はどう違うでしょう？"
                        : kind === "spring"
                          ? "振幅を2倍にすると、振動の周期も変わるでしょうか？"
                          : "同じ質量で完全弾性衝突すると、2つの速度はどう変わるでしょう？"}
                </p>
                <span>
                  条件を変えて、確かめてみよう
                  <ArrowRight size={14} />
                </span>
              </div>
              <button
                className="export-button"
                disabled={!ready}
                onClick={download}
              >
                <ArrowDownToLine size={15} />
                実験データをCSVで保存
                <ArrowUpRight size={14} />
              </button>
            </aside>
          </div>
          <footer className="workspace-footer">
            <span>
              <Atom size={13} />
              小さな実験が、大きな理解につながる。
            </span>
            <span>さわって学ぶ高校物理 · SI単位系</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      {help && (
        <div className="dialog-overlay" onClick={() => setHelp(false)}>
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="dialog-close"
              aria-label="閉じる"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">WELCOME TO YOUR LAB</span>
            <h2 id="help-title">まずは、動かしてみよう。</h2>
            <p>物理は、観察することから始まります。</p>
            <ol>
              <li>
                <strong>実験を選ぶ</strong>
                <span>左側のメニューから、調べたい運動を選びます。</span>
              </li>
              <li>
                <strong>条件を変える</strong>
                <span>
                  スライダーや数値欄、物体のドラッグで初期条件を設定します。数値はEnterまたは欄から離れると反映されます。
                </span>
              </li>
              <li>
                <strong>再生して観察する</strong>
                <span>
                  再生ボタンまたはスペースキーで開始。1ステップは1/120秒です。30秒で終了し、再生すると最初から始まります。
                </span>
              </li>
              <li>
                <strong>グラフと数式をつなげる</strong>
                <span>
                  表示モードやグラフを切り替えて、運動の理由を確かめましょう。グラフは先の予測も表示します。
                </span>
              </li>
            </ol>
            <div className="help-tip">
              手のひらツールで背景をドラッグすると視点を移動できます。物体が画面から出たら、照準ボタンで追いかけられます。
            </div>
            <button className="primary-button" onClick={() => setHelp(false)}>
              実験をはじめる
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function BookIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M12 5v16M12 5C9 3 5 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Z" />
    </svg>
  );
}

export default function App() {
  const retainedScene = useRef<Scene | null>(null);
  const [free, setFree] = useState(() => window.location.hash === "#free");
  useEffect(() => {
    const update = () => setFree(window.location.hash === "#free");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return free ? (
    <FreeLab
      initialScene={retainedScene.current}
      onRetain={(scene) => {
        retainedScene.current = scene;
      }}
      onBack={() => {
        window.location.hash = "";
        setFree(false);
      }}
    />
  ) : (
    <LegacyLab
      onFree={() => {
        window.location.hash = "free";
        setFree(true);
      }}
    />
  );
}
