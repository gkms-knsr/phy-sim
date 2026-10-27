import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import type { Scene, MultiResult } from "./types";
import { isDynamic } from "./types";
export function diagnostic(scene: Scene, message: string) {
  const bodies = scene.objects.filter(isDynamic),
    first = bodies[0];
  let hint = "対応する実験の組み合わせと、右側の条件を確認してください。",
    targets: string[] = [];
  if (message.includes("接続できません")) {
    hint =
      "計算サーバーとの通信を確認できません。アプリを起動し直してページを再読み込みしてください。";
  } else if (message.includes("同じ高さ")) {
    hint = `全端点の「初期位置 y」を ${first?.y ?? 0} m にそろえ、「初速度 vᵧ」を0にします。`;
    targets = scene.objects
      .filter((o) => o.y !== first?.y || o.vy !== 0)
      .map((o) => o.id);
  } else if (message.includes("すべての物体・固定点")) {
    hint =
      "まだ接続されていない物体です。「ばね」を選び、2つの端点をクリックして接続してください。";
    const linked = new Set(scene.connections.flatMap((c) => [c.a, c.b]));
    targets = scene.objects.filter((o) => !linked.has(o.id)).map((o) => o.id);
  } else if (message.includes("糸の長さを超え")) {
    hint = "糸を選び「糸の長さ」を長くするか、物体を滑車へ近づけてください。";
    targets = scene.connections
      .filter((c) => c.kind === "rope")
      .map((c) => c.id);
  } else if (message.includes("経由先") || message.includes("糸の両端")) {
    hint = "糸の編集欄で2つの端点と「経由する固定滑車」を指定してください。";
    targets = scene.connections
      .filter((c) => c.kind === "rope")
      .map((c) => c.id);
  } else if (
    message.includes("鉛直外力") ||
    message.includes("鉛直初速度") ||
    message.includes("水平運動のみ")
  ) {
    hint =
      "水平方向だけに動くモデルです。「初速度 vᵧ」と外力Fᵧを0にしてください。";
    targets = [
      ...bodies.filter((o) => o.vy !== 0).map((o) => o.id),
      ...scene.external.filter((a) => a.fy !== 0).map((a) => a.id),
    ];
  } else if (message.includes("支持先を台") || message.includes("下面を台")) {
    const deck = scene.objects.find((o) => o.kind === "platform"),
      top = bodies.find((o) => o.kind !== "platform");
    hint =
      deck && top
        ? `上の物体の「支持先」を「${deck.label}」にし、「初期位置 y」を ${Number((deck.y + (deck.height + top.height) / 2).toFixed(8))} m に合わせてください。`
        : "上の物体を選び「支持先」に台を指定してください。";
    targets = bodies.filter((o) => o.kind !== "platform").map((o) => o.id);
  } else if (
    message.includes("範囲内") ||
    message.includes("離して") ||
    message.includes("接触しています")
  ) {
    hint =
      "図の物体をドラッグするか、「初期位置 x」を変更して接触・はみ出しを解消してください。";
    targets = bodies.filter((o) => o.kind !== "platform").map((o) => o.id);
  } else if (message.includes("経路に平行") || message.includes("直線経路上")) {
    hint =
      "滑車の物体はガイドに沿って動きます。位置はドラッグで合わせ、初速度と外力も経路の方向へ設定してください。";
    targets = [
      ...bodies
        .filter((o) => message.startsWith(o.label + ":"))
        .map((o) => o.id),
      ...scene.external
        .filter((a) =>
          bodies.some(
            (o) => o.id === a.body && message.startsWith(o.label + ":"),
          ),
        )
        .map((a) => a.id),
    ];
  } else if (message.includes("摩擦係数") || message.includes("μ")) {
    hint =
      "静止摩擦係数以上の動摩擦係数は設定できません。斜面＋滑車のモデルでは、斜面側は摩擦なしです。";
    targets = bodies.filter((o) => o.support).map((o) => o.id);
  } else if (message.includes("床の高さ")) {
    hint = "床を選び「初期位置 y」を台の下面の高さに合わせてください。";
    targets = scene.objects.filter((o) => o.kind === "floor").map((o) => o.id);
  } else if (message.includes("台モデルは台1個"))
    hint =
      "台1個とその上の物体1個だけにします。ばね・糸・追加の物体を組み合わせる計算には対応していません。";
  else if (message.includes("固定滑車1個"))
    hint =
      "物体2個・固定滑車1個・糸1本にします。慣れるまでは「糸と滑車」の例から始められます。";
  return { hint, targets: [...new Set(targets)] };
}
export function RunStatus({
  scene,
  result,
  loading,
  error,
  tool,
  endpoint,
  onSelect,
  onCancel,
  onGuide,
  onAdd,
}: {
  scene: Scene;
  result: MultiResult | null;
  loading: boolean;
  error: string;
  tool: string;
  endpoint: string;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onGuide: () => void;
  onAdd: () => void;
}) {
  const refs = [
    ...scene.objects.map((o) => ({ id: o.id, label: o.label })),
    ...scene.connections.map((o) => ({
      id: o.id,
      label: o.kind === "rope" ? "糸" : "ばね",
    })),
    ...scene.external.map((o) => ({
      id: o.id,
      label: `外力（${scene.objects.find((b) => b.id === o.body)?.label || o.body}）`,
    })),
  ];
  if (loading)
    return (
      <div className="lab-run-state pending" role="status">
        <LoaderCircle size={16} />
        <div>
          <strong>実行できるか確認しています</strong>
          <span>配置・接続と初期条件から運動を計算しています。</span>
        </div>
      </div>
    );
  if (tool !== "select")
    return (
      <div className="lab-run-state attention" role="status">
        <AlertCircle size={17} />
        <div>
          <strong>接続操作の途中です</strong>
          <span>
            {endpoint
              ? `第1端は「${scene.objects.find((o) => o.id === endpoint)?.label || endpoint}」。次に図の第2端をクリックしてください。`
              : "図の第1端、第2端の順にクリックして接続を完成させてください。"}{" "}
            接続が終わると再生できます。
          </span>
          <button onClick={onCancel}>接続をキャンセルして選択に戻る</button>
        </div>
      </div>
    );
  if (!scene.objects.some(isDynamic))
    return (
      <div className="lab-run-state attention" role="alert">
        <AlertCircle size={17} />
        <div>
          <strong>動く物体がないため、まだ実行できません</strong>
          <span>質点かブロックを配置するか、上の実験例を選んでください。</span>
          <button onClick={onAdd}>
            質点を1個追加する
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    );
  if (
    error ||
    (result && !result.supported) ||
    (result?.supported && !result.frames.length)
  ) {
    const reasons = error
      ? [error]
      : result?.reasons.length
        ? result.reasons
        : [
            result?.warning ||
              "初期位置が対応範囲の境界にあります。物体を離して配置してください。",
          ];
    return (
      <section
        className="lab-run-problems"
        role="alert"
        aria-labelledby="lab-run-problem-title"
      >
        <div>
          <AlertCircle size={18} />
          <h3 id="lab-run-problem-title">
            {error
              ? "入力・通信の問題で実行できません"
              : "この組み合わせでは、まだ実行できません"}
          </h3>
        </div>
        <ol>
          {reasons.map((reason, i) => {
            const { hint, targets } = diagnostic(scene, reason);
            return (
              <li key={i}>
                <strong>{reason}</strong>
                <p>{hint}</p>
                <div>
                  {targets.map((id) => (
                    <button key={id} onClick={() => onSelect(id)}>
                      {refs.find((o) => o.id === id)?.label || id}を編集
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
        <button className="lab-problem-guide" onClick={onGuide}>
          <HelpCircle size={14} />
          対応する構成・直し方を見る
        </button>
      </section>
    );
  }
  if (result?.supported)
    return (
      <div className="lab-run-state valid" role="status">
        <CheckCircle2 size={17} />
        <div>
          <strong>
            実行できます
            {result.warning && `（${result.duration.toFixed(2)} sまで）`}
          </strong>
          <span>
            「再生」で開始。条件を変えると一時停止し、時刻0からやり直します。
          </span>
        </div>
      </div>
    );
  return null;
}
