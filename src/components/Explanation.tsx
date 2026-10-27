import katex from "katex";
import { BookOpen, ArrowDown } from "lucide-react";
import type { Mode, Frame, Params, Kind, Result } from "../types";
import { format as f } from "../clock";
export function MathText({ tex }: { tex: string }) {
  return (
    <div
      className="math"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, {
          throwOnError: false,
          displayMode: true,
        }),
      }}
    />
  );
}
function Formula({
  title,
  tex,
  calculation,
}: {
  title: string;
  tex: string;
  calculation: string;
}) {
  return (
    <div className="formula-box">
      <span>{title}</span>
      <MathText tex={tex} />
      <small>{calculation}</small>
    </div>
  );
}
export function Explanation({
  kind,
  p,
  frame: r,
  mode,
  result,
  assumptions,
}: {
  kind: Kind;
  p: Params;
  frame: Frame;
  mode: Mode;
  result: Result | null;
  assumptions: string;
}) {
  const meta = result?.meta || {},
    theta = (p.angle * Math.PI) / 180;
  const intro =
    kind === "linear"
      ? p.a === 0
        ? "速度が変わらなければ、同じ時間に同じ距離を進みます。"
        : `加速度が${p.a > 0 ? "正" : "負"}なので、速度は毎秒 ${f(Math.abs(p.a), 1)} m/s ずつ${p.a > 0 ? "増え" : "減り"}ます。`
      : kind === "incline"
        ? r.regime === "static"
          ? "静止摩擦が重力の斜面方向の分力を打ち消し、物体は静止しています。"
          : `物体は滑走中。動摩擦は${(r.v || 0) < 0 ? "斜面下向き" : "斜面上向き"}に働きます。`
        : kind === "projectile"
          ? r.landed
            ? "ボールが地面に着きました。このモデルでは、着地後は静止します。"
            : "横向きの速度は一定、縦向きの速度は重力で変化します。最高点でも横向きの速度は残ります。"
          : kind === "spring"
            ? "ばねの力は、いつも自然長の位置へ向かいます。物体が中心に近づくほど、弾性エネルギーが運動エネルギーに変わります。"
            : `反発係数 e = ${f(p.e)}。${p.e === 1 ? "運動量と運動エネルギーが保存されます。" : p.e === 0 ? "衝突後は2つの物体が同じ速度で進みます。" : "運動量は保存され、運動エネルギーの一部が失われます。"}`;
  const intuitive =
    kind === "linear"
      ? "速度の矢印は「今、どちらへ進むか」。加速度の矢印は「速度がどちらへ変化するか」。2つの向きが逆なら、物体はまず減速します。"
      : kind === "incline"
        ? "静止摩擦は「いつも最大の力」ではありません。物体を止めるのに必要な分だけ働き、限界を超えると滑り出します。青い重力を、斜面に沿う向きと垂直な向きに分けてみましょう。"
        : kind === "projectile"
          ? "重力はボールを下へ引きますが、横へは引きません。グラフの「速度」を選んで、vₓとvᵧの違いを確かめてみましょう。"
          : kind === "spring"
            ? "端では速さが0、中心では速さが最大です。エネルギーのグラフで2つのエネルギーが交換される様子を見てみましょう。"
            : "同じ質量で完全弾性衝突させると、速度が入れ替わります。反発係数を小さくしても、2物体の運動量の合計は変わりません。";
  return (
    <section className="card explanation">
      <div className="card-heading">
        <h2>
          <BookOpen size={17} />
          {mode === "intuitive" ? "動きを読み解く" : "この運動のしくみ"}
        </h2>
        <span className="tiny-tag">
          {mode === "detail" ? "詳しく学ぶ" : "学びのヒント"}
        </span>
      </div>
      <p className="explanation-intro">{intro}</p>
      {mode === "intuitive" ? (
        <div className="insight-box">{intuitive}</div>
      ) : (
        <>
          {kind === "linear" && (
            <>
              <Formula
                title="01　力と加速度の関係"
                tex="F=ma"
                calculation={`F = ${f(p.m)} × ${f(p.a)} = ${f(p.m * p.a)} N`}
              />
              <div className="formula-arrow">
                <ArrowDown size={13} />
              </div>
              <Formula
                title="02　加速度を積分すると、位置がわかる"
                tex="x=x_0+v_0t+\frac{1}{2}at^2"
                calculation={`x = ${f(p.x0)} + ${f(p.v0)} × ${f(r.t)} + ½ × ${f(p.a)} × ${f(r.t)}² = ${f(r.x)} m`}
              />
              <div className="inline-formula">
                <MathText tex="v=v_0+at" />
                <span>v = {f(r.vx)} m/s</span>
              </div>
            </>
          )}
          {kind === "incline" && (
            <>
              <Formula
                title="01　垂直方向：斜面から離れない"
                tex="N=mg\cos\theta"
                calculation={`N = ${f(p.m)} × ${f(p.g)} × cos ${f(p.angle, 0)}° = ${f(r.normal)} N`}
              />
              <div className="formula-arrow">
                <ArrowDown size={13} />
              </div>
              <Formula
                title="02　斜面方向：下向きを正とする"
                tex="ma_s=mg\sin\theta+f"
                calculation={`${f(p.m)} × ${f(r.a || 0)} = ${f(p.m * p.g * Math.sin(theta))} + (${f(r.friction)}) N`}
              />
              <div className="formula-arrow">
                <ArrowDown size={13} />
              </div>
              <Formula
                title={
                  r.regime === "static"
                    ? "03　静止：摩擦は必要な大きさだけ働く"
                    : "03　滑走：速度と逆向きの動摩擦"
                }
                tex={
                  r.regime === "static"
                    ? String.raw`f_s=-mg\sin\theta,\quad |f_s|\leq\mu_sN`
                    : r.v === 0
                      ? String.raw`f_k=-\mu_kN\quad(v_s=0)`
                      : String.raw`f_k=-\mu_kN\,\operatorname{sgn}(v_s)`
                }
                calculation={
                  r.regime === "static"
                    ? `|fₛ| = ${f(Math.abs(r.friction))} ≤ μₛN = ${f(p.mus * r.normal)} N`
                    : `|fₖ| = ${f(p.muk)} × ${f(r.normal)} = ${f(Math.abs(r.friction))} N`
                }
              />
              <p className="equation-note">
                aₛ = {f(r.a || 0)} m/s² · vₛ = {f(r.v || 0)} m/s
                <br />
                滑り出す条件：mg sinθ &gt;
                μₛN。停止時に静止条件を再判定します。vₛ = 0
                で滑り出す瞬間は下向きの動摩擦を使用します。
              </p>
            </>
          )}
          {kind === "projectile" && (
            <>
              <Formula
                title="01　横方向：外力がないので等速"
                tex="x=x_0+(v_0\cos\theta)t"
                calculation={`着地までの時刻 t′ = ${f(Math.min(r.t, meta.flight || 0))} s。x = ${f(p.x0)} + ${f(p.v0 * Math.cos(theta))} × ${f(Math.min(r.t, meta.flight || 0))} = ${f(r.x)} m`}
              />
              <div className="formula-arrow">
                <ArrowDown size={13} />
              </div>
              <Formula
                title="02　縦方向：重力による等加速度運動"
                tex="y=y_0+(v_0\sin\theta)t-\frac12 gt^2"
                calculation={`y = ${f(p.y0)} + ${f(p.v0 * Math.sin(theta))} × ${f(Math.min(r.t, meta.flight || 0))} − ½ × ${f(p.g)} × ${f(Math.min(r.t, meta.flight || 0))}² = ${f(r.y)} m。着地後は位置を固定。`}
              />
              <div className="inline-formula">
                <MathText
                  tex={
                    r.landed
                      ? String.raw`v_x=v_y=0\quad\text{(着地後)}`
                      : String.raw`v_y=v_0\sin\theta-gt`
                  }
                />
                <span>現在 vᵧ = {f(r.vy)} m/s</span>
              </div>
              <div className="experiment-facts">
                <span>
                  最高点<strong>{f(meta.apex || 0)} m</strong>
                </span>
                <span>
                  飛距離<strong>{f(meta.range || 0)} m</strong>
                </span>
                <span>
                  飛行時間<strong>{f(meta.flight || 0)} s</strong>
                </span>
              </div>
            </>
          )}
          {kind === "spring" && (
            <>
              <Formula
                title="01　フックの法則と運動方程式"
                tex="ma=-kx\quad\Rightarrow\quad a=-\frac{k}{m}x"
                calculation={`a = −(${f(p.k)} / ${f(p.m)}) × ${f(r.x)} = ${f(r.ax)} m/s²`}
              />
              <div className="formula-arrow">
                <ArrowDown size={13} />
              </div>
              <Formula
                title="02　角振動数で振動の速さが決まる"
                tex="\omega=\sqrt{\frac{k}{m}},\quad T=\frac{2\pi}{\omega}"
                calculation={`ω = ${f(Math.sqrt(p.k / p.m))} rad/s、T = ${f(meta.period || 0)} s`}
              />
              <div className="experiment-facts">
                <span>
                  振幅 A<strong>{f(meta.amplitude || 0)} m</strong>
                </span>
                <span>
                  力学的エネルギー<strong>{f(r.energy)} J</strong>
                </span>
              </div>
            </>
          )}
          {kind === "collision" && (
            <>
              <Formula
                title="01　外力がないので運動量を保存"
                tex="m_1u_1+m_2u_2=m_1v_1+m_2v_2"
                calculation={`衝突前 p = ${f(p.m1 * p.v1 + p.m2 * p.v2)} kg·m/s、現在 p = ${f(r.momentum)} kg·m/s`}
              />
              <div className="formula-arrow">
                <ArrowDown size={13} />
              </div>
              <Formula
                title="02　近づく速さと離れる速さの関係"
                tex="v_2-v_1=e(u_1-u_2)"
                calculation={
                  meta.collisionTime == null
                    ? "近づいていないため、この条件では衝突しません。"
                    : `${f(meta.afterV2 || 0)} − (${f(meta.afterV1 || 0)}) = ${f(p.e)} × (${f(p.v1)} − (${f(p.v2)})) m/s`
                }
              />
              <div className="collision-table">
                <span />
                <span>衝突前 u</span>
                <span>衝突後 v（予測）</span>
                <strong>物体 1</strong>
                <span>{f(p.v1)} m/s</span>
                <span>
                  {meta.collisionTime != null ? f(meta.afterV1 || 0) : "—"} m/s
                </span>
                <strong>物体 2</strong>
                <span>{f(p.v2)} m/s</span>
                <span>
                  {meta.collisionTime != null ? f(meta.afterV2 || 0) : "—"} m/s
                </span>
              </div>
              <p className="equation-note">
                衝突による運動エネルギーの減少：{f(meta.energyLoss || 0)} J
              </p>
            </>
          )}
        </>
      )}
      {kind === "linear" && meta.reversal != null && (
        <p className="event-note">
          ↔ {f(meta.reversal)} s で速度が0になり、進む向きが反転します。
        </p>
      )}
      {mode === "detail" && (
        <div className="detail-notes">
          {kind === "linear" ? (
            <>
              <MathText tex="W=\Delta K=\frac12 m(v^2-v_0^2)" />
              <p>
                一定の外力が仕事をするため、運動エネルギーは変化します。基準高さは
                y = 0。外力の仕事と運動エネルギー変化が一致します。
              </p>
            </>
          ) : kind === "incline" ? (
            <>
              <MathText tex="\Delta(K+U)=W_f\leq0" />
              <p>
                摩擦の仕事は負で、滑走中の力学的エネルギーは減少します。静止中は摩擦の仕事は0。N
                = {f(r.normal)} N、静止摩擦の上限は {f(p.mus * r.normal)}{" "}
                N。位置エネルギーは負にもなります。
              </p>
            </>
          ) : kind === "projectile" ? (
            <>
              <MathText tex="t_f=\frac{v_{0y}+\sqrt{v_{0y}^2+2gy_0}}{g}" />
              <MathText tex="R=v_{0x}t_f,\quad K+mgy=\mathrm{const.}" />
              <p>
                飛行中の力学的エネルギーは保存。着地は完全非弾性の停止で、エネルギーは失われます。最高点は
                t = {f(meta.apexTime || 0)}{" "}
                s。地面までの時間が30秒を超える場合は実験終了時も飛行中です。
              </p>
            </>
          ) : kind === "spring" ? (
            <>
              <MathText tex="x=x_0\cos\omega t+\frac{v_0}{\omega}\sin\omega t" />
              <MathText tex="A=\sqrt{x_0^2+(v_0/\omega)^2}" />
              <MathText tex="E=\frac12 mv^2+\frac12 kx^2=\mathrm{const.}" />
              <p>
                K = {f(r.kinetic)} J、U = {f(r.potential)}{" "}
                J。解析解なので数値積分によるエネルギーのドリフトはありません。
              </p>
            </>
          ) : (
            <>
              <MathText tex="v_1=\frac{(m_1-em_2)u_1+(1+e)m_2u_2}{m_1+m_2}" />
              <MathText tex="\Delta K=-\frac12\frac{m_1m_2}{m_1+m_2}(1-e^2)(u_1-u_2)^2" />
              <p>
                u は衝突前、v は衝突後の速度です。接触時刻は{" "}
                {meta.collisionTime != null
                  ? `${f(meta.collisionTime)} s`
                  : "なし"}
                。衝突瞬間の加速度は定義せず、それ以外では0です。e &lt;
                1で失われたエネルギーは変形や熱に移ります。
              </p>
            </>
          )}
        </div>
      )}
      <div className="assumption">
        <span>モデルの仮定</span>
        <p>{assumptions}</p>
      </div>
    </section>
  );
}
