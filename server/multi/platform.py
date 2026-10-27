"""Two translating bodies on a finite deck. Exact piecewise Coulomb solution."""

import math
from .schema import force, body_frame, frame


class PlatformModel:
    name = "platform"
    assumptions = [
        "水平な台と上のブロックの並進のみ。床は摩擦なし。",
        "0 ≤ μₖ ≤ μₛ。台と物体の摩擦・垂直抗力を作用反作用の対で記録します。",
        "台の端に達した時点で停止します。その後の落下・再接触は未対応です。",
    ]

    def __init__(self, scene):
        self.scene = scene
        self.deck = next(o for o in scene.bodies if o.kind == "platform")
        self.load = next(o for o in scene.bodies if o.id != self.deck.id)
        m, M = self.load.mass, self.deck.mass
        self.fl, self.fd = (
            scene.applied(self.load.id)[0],
            scene.applied(self.deck.id)[0],
        )
        self.needed = m * (self.fl + self.fd) / (m + M) - self.fl
        self.limit = self.load.mus * m * scene.g
        self.equations = [
            r"ma_m=F_m+f,\quad Ma_M=F_M-f",
            r"N=mg,\quad |f_s|\leq\mu_smg",
            r"a_m=a_M=\frac{F_M+F_m}{M+m}\quad\text{(固着)}",
            r"\left|\frac{m(F_M+F_m)}{M+m}-F_m\right|>\mu_smg\quad\text{(滑り出す条件)}",
        ]
        self.derivation = [
            "① 上の物体だけを取り出すと、重力・台からの垂直抗力・摩擦・外力が働く。",
            "② 台には、上の物体の摩擦と垂直抗力の反作用、床の抗力、重力、外力が働く。",
            "③ 固着中は加速度を共通と置き、2式を足す。内力 f が消え、(M+m)a = F_M+F_m。",
            f"④ 必要な静止摩擦 f = {self.needed:.4f} N。限界 μₛmg = {self.limit:.4f} N と比較する。",
            "⑤ 滑走中は相対速度と逆向きに μₖmg。相対速度が0になった瞬間に静止条件を再判定する。",
        ]
        self.start = [self.load.x, self.deck.x, self.load.vx, self.deck.vx]
        self.first = self.accelerations(self.start[2] - self.start[3])
        al, ad, _, regime = self.first
        relative, relative_a = self.start[2] - self.start[3], al - ad
        self.stop = (
            -relative / relative_a
            if (relative > 0 and relative_a < 0) or (relative < 0 and relative_a > 0)
            else math.inf
        )
        self.second = None
        if math.isfinite(self.stop):
            self.restart = self.advance(self.start, self.first, self.stop)
            common = (m * self.restart[2] + M * self.restart[3]) / (m + M)
            self.restart[2] = self.restart[3] = common
            self.second = self.accelerations(0.0)
        self.meta = {
            "requiredFriction": self.needed,
            "staticLimit": self.limit,
            "switchTime": self.stop if math.isfinite(self.stop) else None,
        }
        self.modes = []

    def accelerations(self, relative):
        s, m, M = self.scene, self.load.mass, self.deck.mass
        if abs(relative) < 1e-10 and abs(self.needed) <= self.limit + 1e-10:
            a = (self.fl + self.fd) / (m + M)
            return a, a, self.needed, "sticking"
        drive = self.fl / m - self.fd / M
        direction = (
            (1 if relative > 0 else -1)
            if abs(relative) > 1e-10
            else (1 if drive >= 0 else -1)
        )
        f = -direction * self.load.muk * m * s.g
        return (self.fl + f) / m, (self.fd - f) / M, f, "sliding"

    @staticmethod
    def advance(initial, acc, t):
        x1, x2, v1, v2 = initial
        return [
            x1 + v1 * t + 0.5 * acc[0] * t * t,
            x2 + v2 * t + 0.5 * acc[1] * t * t,
            v1 + acc[0] * t,
            v2 + acc[1] * t,
        ]

    def at(self, t, before=False):
        first_t = min(t, self.stop)
        position = self.advance(self.start, self.first, first_t)
        acc = self.first
        if t >= self.stop and self.second is not None and not before:
            acc = self.second
            position = self.advance(self.restart, acc, t - self.stop)
        x1, x2, v1, v2 = position
        _, _, f, regime = acc
        s, top, deck = self.scene, self.load, self.deck
        n = top.mass * s.g
        topforces = [
            force("gravity", 0, -n, "mg"),
            force("normal", 0, n, "N", "contact-normal", deck.id),
            force("friction", f, 0, "f", "contact-friction", deck.id),
        ]
        deckforces = [
            force("gravity", 0, -deck.mass * s.g, "Mg"),
            force("normal", 0, -n, "−N", "contact-normal", top.id),
            force("normal", 0, (top.mass + deck.mass) * s.g, "床の抗力"),
            force("friction", -f, 0, "−f", "contact-friction", top.id),
        ]
        for obj, forces in [(top, topforces), (deck, deckforces)]:
            forces.extend(
                force("external", a.fx, a.fy, "F", source=a.id)
                for a in s.external
                if a.body == obj.id
            )
        slip1 = abs((position[0] - position[1]) - (self.start[0] - self.start[1]))
        if t >= self.stop and self.second is not None and not before:
            slip1 = abs(
                (self.restart[0] - self.restart[1]) - (self.start[0] - self.start[1])
            ) + abs((x1 - x2) - (self.restart[0] - self.restart[1]))
        dissipated = top.muk * n * slip1
        return frame(
            s,
            t,
            [
                body_frame(top, x1, top.y, v1, 0, topforces),
                body_frame(deck, x2, deck.y, v2, 0, deckforces),
            ],
            dissipated=dissipated,
            regime=regime,
        )

    def boundary(self, result):
        by = {b["id"]: b for b in result["bodies"]}
        return (
            abs(by[self.load.id]["x"] - by[self.deck.id]["x"])
            > (self.deck.width - self.load.width) / 2 + 1e-10
        )
