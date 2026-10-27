import { SlidersHorizontal } from "lucide-react";
import type { InteractionSettings, VectorSettings } from "./interaction";
import { defaultInteraction, defaultVectors, forceNames } from "./interaction";
import { forceColors } from "./types";
export function EditorControls({
  interaction,
  onInteraction,
  vectors,
  onVectors,
}: {
  interaction: InteractionSettings;
  onInteraction: (settings: InteractionSettings) => void;
  vectors: VectorSettings;
  onVectors: (settings: VectorSettings) => void;
}) {
  return (
    <div className="lab-editor-controls">
      <div className="lab-move-controls">
        <strong>
          <SlidersHorizontal size={14} />
          操作の調整
        </strong>
        <label>
          位置の移動幅
          <select
            aria-label="位置の移動幅"
            value={interaction.positionStep}
            onChange={(e) =>
              onInteraction({
                ...interaction,
                positionStep: Number(e.target.value),
              })
            }
          >
            {[0.01, 0.05, 0.1, 0.25, 0.5, 1].map((n) => (
              <option key={n} value={n}>
                {n} mずつ
              </option>
            ))}
          </select>
        </label>
        <label>
          外力の変更幅
          <select
            aria-label="外力の変更幅"
            value={interaction.forceStep}
            onChange={(e) =>
              onInteraction({
                ...interaction,
                forceStep: Number(e.target.value),
              })
            }
          >
            {[0.1, 0.5, 1, 5].map((n) => (
              <option key={n} value={n}>
                {n} Nずつ
              </option>
            ))}
          </select>
        </label>
        <label>
          ドラッグ感度
          <select
            aria-label="ドラッグ感度"
            value={interaction.sensitivity}
            onChange={(e) =>
              onInteraction({
                ...interaction,
                sensitivity: Number(e.target.value),
              })
            }
          >
            {[
              [0.25, "ゆっくり（¼）"],
              [0.5, "ゆっくり（½）"],
              [1, "標準"],
              [2, "大きく（2倍）"],
            ].map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="lab-control-note">
        小さく動かしたいときは移動幅を小さく。動かしすぎるときは感度を下げます。手入力なら任意の値を設定できます。
      </p>
      <div className="lab-vector-toggles" aria-label="表示の切り替え">
        {(
          [
            ["force", "力の矢印"],
            ["velocity", "速度の矢印"],
            ["acceleration", "加速度の矢印"],
            ["trail", "軌跡"],
            ["grid", "グリッド"],
          ] as const
        ).map(([key, name]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={vectors[key]}
              onChange={(e) =>
                onVectors({ ...vectors, [key]: e.target.checked })
              }
            />
            {name}
          </label>
        ))}
      </div>
      <details className="lab-vector-details">
        <summary>力の種類・矢印の長さを調整</summary>
        <div className="lab-force-types">
          {Object.entries(forceNames).map(([key, name]) => (
            <label key={key}>
              <input
                type="checkbox"
                aria-label={`${name}の表示`}
                checked={vectors.kinds[key as keyof typeof vectors.kinds]}
                onChange={(e) =>
                  onVectors({
                    ...vectors,
                    kinds: { ...vectors.kinds, [key]: e.target.checked },
                  })
                }
              />
              <i
                style={{
                  background: forceColors[key as keyof typeof forceColors],
                }}
              />
              {name}
            </label>
          ))}
        </div>
        <div className="lab-vector-size">
          <label>
            矢印の表示倍率
            <select
              aria-label="矢印の表示倍率"
              value={vectors.scale}
              onChange={(e) =>
                onVectors({ ...vectors, scale: Number(e.target.value) })
              }
            >
              {[0.25, 0.5, 1, 1.5, 2].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={vectors.labels}
              onChange={(e) =>
                onVectors({ ...vectors, labels: e.target.checked })
              }
            />
            記号と大きさを表示
          </label>
          <button
            onClick={() => {
              onInteraction({ ...defaultInteraction });
              onVectors(defaultVectors());
            }}
          >
            操作・表示を初期設定に戻す
          </button>
        </div>
        <p className="lab-control-note">
          表示倍率は図の長さだけを変えます。力の値や運動は変わりません。非表示の力も運動方程式には含まれます。
        </p>
      </details>
    </div>
  );
}
