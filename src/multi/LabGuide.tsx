import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronRight, HelpCircle, X } from "lucide-react";
export function QuickStart({
  onGuide,
  onPreset,
}: {
  onGuide: () => void;
  onPreset: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(
    () => localStorage.getItem("physica-guide-dismissed") !== "yes",
  );
  return (
    <section className="card lab-quickstart">
      <div>
        <span className="lab-guide-icon">
          <BookOpen size={20} />
        </span>
        <div>
          <h2>はじめての自由実験</h2>
          <p>まずは完成した実験を動かし、条件をひとつ変えてみましょう。</p>
        </div>
        <button
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((v) => !v);
            localStorage.setItem(
              "physica-guide-dismissed",
              expanded ? "yes" : "no",
            );
          }}
        >
          {expanded ? "折りたたむ" : "操作の流れを見る"}
        </button>
      </div>
      {expanded && (
        <>
          <ol className="lab-steps">
            <li>
              <b>1</b>
              <strong>実験を選ぶ</strong>
              <span>下の例、または左のプリセットを選択。</span>
            </li>
            <li>
              <b>2</b>
              <strong>物体を選ぶ</strong>
              <span>図の物体をクリック。右側に編集欄が開きます。</span>
            </li>
            <li>
              <b>3</b>
              <strong>条件を変える</strong>
              <span>数値を入力しEnter。ドラッグは移動幅ごとに調整。</span>
            </li>
            <li>
              <b>4</b>
              <strong>再生して確かめる</strong>
              <span>実行できないときは、再生ボタンの上に理由が出ます。</span>
            </li>
          </ol>
          <div className="lab-guide-presets">
            <span>かんたんな例から：</span>
            <button onClick={() => onPreset("platform-stick")}>
              台と物体
              <ChevronRight size={12} />
            </button>
            <button onClick={() => onPreset("spring-three")}>
              2物体とばね
              <ChevronRight size={12} />
            </button>
            <button onClick={() => onPreset("pulley-two")}>
              糸と滑車
              <ChevronRight size={12} />
            </button>
            <button onClick={onGuide}>
              <HelpCircle size={13} />
              詳しい使い方
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export function LabGuide({
  open,
  onClose,
  onPreset,
}: {
  open: boolean;
  onClose: () => void;
  onPreset: (id: string) => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, [tabindex="0"]',
          ) || [],
        );
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && (i === items.length - 1 || i === -1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key, true);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <section
        ref={dialog}
        className="help-dialog lab-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="dialog-close"
          aria-label="使い方を閉じる"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">YOUR FIRST EXPERIMENT</span>
        <h2 id="lab-guide-title">自由実験室の使い方</h2>
        <p>最初はプリセットから。慣れたら自分の実験を作れます。</p>
        <ol>
          <li>
            <strong>まず動かしてみる</strong>
            <span>
              プリセットを選び「再生」。物体をクリックすると右側で質量・初期位置・初速度を編集できます。入力はEnterか欄から離れたときに反映されます。
            </span>
          </li>
          <li>
            <strong>物体を配置する</strong>
            <span>
              左のパレットから図へドラッグ。クリックでも追加できます。図の物体をドラッグすると一時停止し、離した位置を新しい初期位置にします。壁・床を置いただけでは接触計算は始まりません。
            </span>
          </li>
          <li>
            <strong>ばね・糸で接続する</strong>
            <span>
              「ばね」または「糸」を選び、図の第1端→第2端をクリック。端点名は図の上に表示されます。接続した線、または右の「接続と外力」を選んで、ばね定数・自然長・糸の長さを編集します。Escで接続をキャンセルできます。
            </span>
          </li>
          <li>
            <strong>外力を設定する</strong>
            <span>
              先に物体を選び「外力」を追加。橙色の丸い先端をドラッグして向きと大きさを変えます。右側のFₓ・Fᵧでも指定できます。台・ばね網は水平、滑車は糸の経路方向の力に対応します。
            </span>
          </li>
          <li>
            <strong>操作の細かさ・表示を変える</strong>
            <span>
              図の上の「操作の調整」で位置の移動幅、外力の変更幅、ドラッグ感度を選べます。細かく動きすぎるときは0.5〜1
              mの幅、感度は½か¼がおすすめ。矢印は種類別に切り替えられ、表示倍率を変えても物理量は変わりません。
            </span>
          </li>
          <li>
            <strong>再生できない理由を確認する</strong>
            <span>
              再生ボタンの上に理由と直し方が出ます。「編集する」で対象を選び、右の入力欄を確認してください。入力ミスと未対応の組み合わせを区別します。対応する例は下から読み込めます。
            </span>
          </li>
        </ol>
        <div className="help-tip">
          水平ばね網は全端点を同じ高さに。台は台1個＋上の物体1個。滑車は2物体・固定滑車1個・糸1本です。条件変更はすべて初期状態から再計算します。再生・停止はスペース、視点移動は手のひらツールです。
        </div>
        <div className="lab-guide-presets">
          <button
            onClick={() => {
              onPreset("spring-three");
              onClose();
            }}
          >
            ばねの例を読み込む
            <ChevronRight size={14} />
          </button>
          <button className="primary-button" onClick={onClose}>
            実験に戻る
          </button>
        </div>
      </section>
    </div>
  );
}
