"""Two masses, one fixed pulley, one unilateral ideal rope. Exact event solution."""

import math
from .schema import force, body_frame, frame


def geometry(scene):
    rope = next(l for l in scene.connections if l.kind == "rope")
    pulley = scene.by_id[rope.pulley]
    incline = next((o for o in scene.objects if o.kind == "incline"), None)
    angle = math.radians(incline.angle) if incline else 0
    directions = [
        (-math.cos(angle), -math.sin(angle)) if incline else (0.0, -1.0),
        (0.0, -1.0),
    ]
    origins = [(pulley.x - 0.4, pulley.y), (pulley.x + 0.4, pulley.y)]
    bodies = [scene.by_id[rope.a], scene.by_id[rope.b]]
    q = [
        (b.x - o[0]) * e[0] + (b.y - o[1]) * e[1]
        for b, o, e in zip(bodies, origins, directions)
    ]
    v = [b.vx * e[0] + b.vy * e[1] for b, e in zip(bodies, directions)]
    return rope, pulley, incline, bodies, directions, origins, q, v


def catch_time(gap, velocity, acceleration):
    if gap <= 1e-10 and velocity > 1e-10:
        return 0.0
    if abs(acceleration) < 1e-12:
        return gap / velocity if gap > 1e-10 and velocity > 1e-10 else math.inf
    discriminant = velocity * velocity + 2 * acceleration * gap
    if discriminant < 0:
        return math.inf
    roots = [
        (-velocity + sign * math.sqrt(discriminant)) / acceleration for sign in [-1, 1]
    ]
    return min(
        (t for t in roots if t > 1e-9 and velocity + acceleration * t > 1e-9),
        default=math.inf,
    )


class PulleyModel:
    name = "pulley"
    assumptions = [
        "固定・質量0・摩擦なしの滑車1個と、質量0・伸びない糸1本。回転慣性なし。",
        "糸の長さは滑車の円弧の定数部分を除いた2本の直線部分の和です。",
        "物体は図の直線方向に運動。斜面は摩擦なし。経路に垂直な外力・初速度は未対応。",
        "たるみ中は張力0。張り直しは完全非弾性の拘束衝撃とし、失われる運動エネルギーを記録します。",
        "物体が滑車に到達する直前で停止。滑車を通過する構成は未対応です。",
    ]

    def __init__(self, scene):
        self.scene = scene
        (
            self.rope,
            self.pulley,
            self.incline,
            self.bodies,
            self.directions,
            self.origins,
            self.q0,
            self.v0,
        ) = geometry(scene)
        self.free_a = [
            -scene.g * e[1]
            + sum(f * v for f, v in zip(scene.applied(b.id), e)) / b.mass
            for b, e in zip(self.bodies, self.directions)
        ]
        inv = sum(1 / b.mass for b in self.bodies)
        self.candidate = sum(self.free_a) / inv
        gap = self.rope.rest - sum(self.q0)
        self.initial_taut = (
            gap <= 1e-8 and abs(sum(self.v0)) < 1e-9 and self.candidate >= 0
        )
        self.catch = (
            math.inf
            if self.initial_taut
            else catch_time(max(0, gap), sum(self.v0), sum(self.free_a))
        )
        self.loss = 0.0
        if math.isfinite(self.catch):
            self.qc = [
                q + v * self.catch + 0.5 * a * self.catch**2
                for q, v, a in zip(self.q0, self.v0, self.free_a)
            ]
            before = [v + a * self.catch for v, a in zip(self.v0, self.free_a)]
            impulse = sum(before) / inv
            self.vc = [v - impulse / b.mass for v, b in zip(before, self.bodies)]
            self.loss = 0.5 * sum(
                b.mass * (v * v - w * w)
                for b, v, w in zip(self.bodies, before, self.vc)
            )
        self.equations = [
            r"m_1\ddot q_1=Q_1-T,\quad m_2\ddot q_2=Q_2-T",
            r"q_1+q_2\leq L,\quad T\geq0,\quad T(L-q_1-q_2)=0",
            r"\dot q_1+\dot q_2=0,\quad\ddot q_1+\ddot q_2=0\quad\text{(張力状態)}",
            r"T=\frac{Q_1/m_1+Q_2/m_2}{1/m_1+1/m_2}\geq0",
            r"(m_1+m_2)\ddot q_1=Q_1-Q_2\quad\text{(張力状態)}",
        ]
        self.derivation = [
            "① 各物体の進行方向 qᵢ を、滑車から離れる向きに取る。張力はそれぞれ −T。",
            "② 重力・外力の経路方向成分を Qᵢ と置き、mᵢq̈ᵢ = Qᵢ−T を作る。斜面側の重力は mg sinθ。",
            "③ 糸が張っている間だけ q₁+q₂=L。1回微分して速度、2回微分して加速度の関係を得る。",
            "④ 2式を質量で割って足し、q̈₁+q̈₂=0 を代入して T を求める。T が負なら拘束を解除し、T=0で別々に動く。",
            "⑤ たるみを使い切った瞬間に拘束衝撃を適用。J=(v₁+v₂)/(1/m₁+1/m₂) により速度和を0にする。",
            "⑥ 滑車の支持力は、動く2物体だけを系とした場合の外力。張力は一般にCartesianベクトルとしては相殺しない。経路方向の2式を引くと消去できる。",
        ]
        self.meta = {
            "candidateTension": self.candidate,
            "catchTime": self.catch if math.isfinite(self.catch) else None,
            "catchEnergyLoss": self.loss,
            "bodyIds": [b.id for b in self.bodies],
        }
        self.modes = []

    def at(self, t, before=False):
        if self.initial_taut:
            tension = self.candidate
            acc = [a - tension / b.mass for a, b in zip(self.free_a, self.bodies)]
            q = [q + v * t + 0.5 * a * t * t for q, v, a in zip(self.q0, self.v0, acc)]
            v = [v + a * t for v, a in zip(self.v0, acc)]
            lost = 0.0
        elif t >= self.catch and not before:
            tension = max(0, self.candidate)
            acc = [a - tension / b.mass for a, b in zip(self.free_a, self.bodies)]
            dt = t - self.catch
            q = [
                q + v * dt + 0.5 * a * dt * dt for q, v, a in zip(self.qc, self.vc, acc)
            ]
            v = [v + a * dt for v, a in zip(self.vc, acc)]
            lost = self.loss
        else:
            tension = 0.0
            acc = self.free_a
            q = [q + v * t + 0.5 * a * t * t for q, v, a in zip(self.q0, self.v0, acc)]
            v = [v + a * t for v, a in zip(self.v0, acc)]
            lost = 0.0
        states = []
        pulleyforces = []
        for i, (b, e, o) in enumerate(zip(self.bodies, self.directions, self.origins)):
            forces = [force("gravity", 0, -b.mass * self.scene.g, "mg")]
            forces.extend(
                force("external", f.fx, f.fy, "F", source=f.id)
                for f in self.scene.external
                if f.body == b.id
            )
            forces.append(
                force(
                    "tension",
                    -tension * e[0],
                    -tension * e[1],
                    "T",
                    f"{self.rope.id}-{i}",
                    self.pulley.id,
                )
            )
            pulleyforces.append(
                force(
                    "tension",
                    tension * e[0],
                    tension * e[1],
                    f"T{i+1}",
                    f"{self.rope.id}-{i}",
                    b.id,
                )
            )
            if i == 0 and self.incline:
                normal = (-e[1], e[0])
                # Pick the upward normal to the incline.
                if normal[1] < 0:
                    normal = (-normal[0], -normal[1])
                applied = self.scene.applied(b.id)
                n = -(
                    applied[0] * normal[0]
                    + (applied[1] - b.mass * self.scene.g) * normal[1]
                )
                forces.append(force("normal", n * normal[0], n * normal[1], "N"))
            states.append(
                body_frame(
                    b,
                    o[0] + q[i] * e[0],
                    o[1] + q[i] * e[1],
                    v[i] * e[0],
                    v[i] * e[1],
                    forces,
                    q=q[i],
                )
            )
        pulleyforces.append(
            force(
                "fixed",
                -sum(f["fx"] for f in pulleyforces),
                -sum(f["fy"] for f in pulleyforces),
                "固定支点の力",
            )
        )
        states.append(
            body_frame(self.pulley, self.pulley.x, self.pulley.y, 0, 0, pulleyforces)
        )
        taut = (
            self.initial_taut or (t >= self.catch and not before)
        ) and self.candidate >= 0
        return frame(
            self.scene,
            t,
            states,
            dissipated=lost,
            tension=tension,
            ropeLength=sum(q),
            regime="taut" if taut else "slack",
        )

    def boundary(self, result):
        return any(b.get("q", 1) <= 0.45 for b in result["bodies"])
