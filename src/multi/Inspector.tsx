import { useEffect, useState } from "react";
import type { Scene, LabObject, Connection, ExternalForce } from "./types";
import { isDynamic } from "./types";
function NumberField({
  label,
  value,
  onChange,
  min = -30,
  max = 30,
  unit = "m",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Number(value.toFixed(5)))), [value]);
  function commit() {
    let n = Number(draft);
    if (!draft.trim() || !Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    n = Math.max(min, Math.min(max, n));
    setDraft(String(n));
    onChange(n);
  }
  return (
    <label className="multi-number">
      <span>{label}</span>
      <div>
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step="any"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}
export function Inspector({
  scene,
  selected,
  onObject,
  onConnection,
  onExternal,
  onRemove,
}: {
  scene: Scene;
  selected: string;
  onObject: (id: string, patch: Partial<LabObject>) => void;
  onConnection: (id: string, patch: Partial<Connection>) => void;
  onExternal: (id: string, patch: Partial<ExternalForce>) => void;
  onRemove: (id: string) => void;
}) {
  const o = scene.objects.find((o) => o.id === selected),
    c = scene.connections.find((o) => o.id === selected),
    force = scene.external.find((o) => o.id === selected);
  return (
    <section className="card multi-inspector">
      <div className="card-heading">
        <h2>選択したオブジェクト</h2>
        {selected !== "system" && (o || c || force) && (
          <button
            aria-label="選択したオブジェクトを削除"
            onClick={() => onRemove(selected)}
          >
            削除
          </button>
        )}
      </div>
      <p className="multi-muted">
        変更は一時停止し、初期状態から再計算します。
      </p>
      {o ? (
        <>
          <div className="inspector-name">
            {o.label}
            <span>{o.id}</span>
          </div>
          <label className="multi-text">
            表示名
            <input
              aria-label="オブジェクトの表示名"
              key={o.id}
              defaultValue={o.label}
              onBlur={(e) =>
                onObject(o.id, { label: e.target.value.slice(0, 40) })
              }
            />
          </label>
          <div className="multi-fields">
            {isDynamic(o) && (
              <NumberField
                label="質量"
                value={o.mass}
                onChange={(v) => onObject(o.id, { mass: v })}
                min={0.1}
                max={20}
                unit="kg"
              />
            )}
            <NumberField
              label="初期位置 x"
              value={o.x}
              onChange={(v) => onObject(o.id, { x: v })}
            />
            <NumberField
              label="初期位置 y"
              value={o.y}
              onChange={(v) => onObject(o.id, { y: v })}
            />
            {isDynamic(o) && (
              <>
                <NumberField
                  label="初速度 vₓ"
                  value={o.vx}
                  onChange={(v) => onObject(o.id, { vx: v })}
                  min={-15}
                  max={15}
                  unit="m/s"
                />
                <NumberField
                  label="初速度 vᵧ"
                  value={o.vy}
                  onChange={(v) => onObject(o.id, { vy: v })}
                  min={-15}
                  max={15}
                  unit="m/s"
                />
              </>
            )}
            {isDynamic(o) &&
              scene.objects.find((a) => a.id === o.support)?.kind ===
                "platform" && (
                <>
                  <NumberField
                    label="静止摩擦係数"
                    value={o.mus}
                    onChange={(v) => onObject(o.id, { mus: v })}
                    min={o.muk}
                    max={1.5}
                    unit="—"
                  />
                  <NumberField
                    label="動摩擦係数"
                    value={o.muk}
                    onChange={(v) => onObject(o.id, { muk: v })}
                    min={0}
                    max={o.mus}
                    unit="—"
                  />
                </>
              )}
            {["platform", "block"].includes(o.kind) && (
              <>
                <NumberField
                  label="幅"
                  value={o.width}
                  onChange={(v) => onObject(o.id, { width: v })}
                  min={0.2}
                  max={20}
                />
                <NumberField
                  label="高さ"
                  value={o.height}
                  onChange={(v) => onObject(o.id, { height: v })}
                  min={0.2}
                  max={5}
                />
              </>
            )}
            {o.kind === "incline" && (
              <NumberField
                label="斜面の角度"
                value={o.angle}
                onChange={(v) => onObject(o.id, { angle: v })}
                min={0}
                max={80}
                unit="°"
              />
            )}
          </div>
          {isDynamic(o) && (
            <label className="multi-text">
              支持先
              <select
                aria-label="支持先"
                value={o.support}
                onChange={(e) => onObject(o.id, { support: e.target.value })}
              >
                <option value="">なし（水平ばね網ではガイド）</option>
                {scene.objects
                  .filter(
                    (a) =>
                      a.id !== o.id &&
                      ["platform", "incline", "floor"].includes(a.kind),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <p className="multi-muted">
            {o.kind === "block" ? "ブロックは回転しない並進モデル。" : " "}
            {scene.objects.some((a) => a.kind === "pulley")
              ? "滑車系では経路に平行な速度・外力を指定します。斜面側は摩擦なし。"
              : "ばね網は水平ガイド、台の床は摩擦なしです。"}
          </p>
        </>
      ) : c ? (
        <>
          <div className="inspector-name">
            {c.kind === "spring" ? "ばね" : "理想的な糸"}
            <span>{c.id}</span>
          </div>
          {(["a", "b"] as const).map((key, i) => (
            <label className="multi-text" key={key}>
              第{i + 1}端
              <select
                aria-label={`第${i + 1}端`}
                value={c[key]}
                onChange={(e) => onConnection(c.id, { [key]: e.target.value })}
              >
                {scene.objects
                  .filter(
                    (o) => !["floor", "incline", "pulley"].includes(o.kind),
                  )
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}（{o.id}）
                    </option>
                  ))}
              </select>
            </label>
          ))}
          <div className="multi-fields">
            {c.kind === "spring" && (
              <NumberField
                label="ばね定数"
                value={c.k}
                onChange={(v) => onConnection(c.id, { k: v })}
                min={0.1}
                max={100}
                unit="N/m"
              />
            )}
            <NumberField
              label={c.kind === "spring" ? "自然長" : "糸の長さ"}
              value={c.rest}
              onChange={(v) => onConnection(c.id, { rest: v })}
              min={0.1}
              max={80}
            />
          </div>
          {c.kind === "rope" && (
            <label className="multi-text">
              経由する固定滑車
              <select
                aria-label="経由する固定滑車"
                value={c.pulley}
                onChange={(e) => onConnection(c.id, { pulley: e.target.value })}
              >
                <option value="">選択してください</option>
                {scene.objects
                  .filter((o) => o.kind === "pulley")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <p className="multi-muted">
            {c.kind === "spring"
              ? "水平ガイド上の線形ばね。固定壁・支点にも接続できます。"
              : "糸の長さは円弧の定数部分を除く2経路の和。長くするとたるみを作れます。"}
          </p>
        </>
      ) : force ? (
        <>
          <div className="inspector-name">
            一定外力<span>{force.id}</span>
          </div>
          <label className="multi-text">
            作用する物体
            <select
              aria-label="外力の対象"
              value={force.body}
              onChange={(e) => onExternal(force.id, { body: e.target.value })}
            >
              {scene.objects.filter(isDynamic).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="multi-fields">
            <NumberField
              label="外力 Fₓ"
              value={force.fx}
              onChange={(v) => onExternal(force.id, { fx: v })}
              min={-100}
              max={100}
              unit="N"
            />
            <NumberField
              label="外力 Fᵧ"
              value={force.fy}
              onChange={(v) => onExternal(force.id, { fy: v })}
              min={-100}
              max={100}
              unit="N"
            />
          </div>
        </>
      ) : (
        <p className="multi-muted">
          物体・接続をクリックして、条件を編集してください。「系全体」では重心と内力の相殺を確認できます。
        </p>
      )}
      <details className="multi-support">
        <summary>対応する構成について</summary>
        <ul>
          <li>自由質点：接続・接触形状なし、重力と一定外力。</li>
          <li>台：台1個＋上の物体1個。水平運動、床は摩擦なし。</li>
          <li>
            ばね網：最大8物体。全端点を同じ高さに配置。壁・支点との接続可。
          </li>
          <li>滑車：2物体、固定滑車1個、糸1本。斜面1個まで（摩擦なし）。</li>
          <li>一般の接触、回転、多段滑車、異なるモデルの混在は未対応。</li>
        </ul>
      </details>
    </section>
  );
}
