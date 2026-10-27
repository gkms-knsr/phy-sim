"""Unconnected particles in a uniform gravity field, without contact geometry."""

from .schema import force, body_frame, frame


class FreeModel:
    name = "free"
    assumptions = [
        "接続のない質点の並進。ブロックも回転しない質点として扱います。",
        "一様重力と一定外力のみ。床・壁・斜面との衝突や物体どうしの接触は未対応です。",
    ]
    equations = [
        r"m_i\mathbf a_i=m_i\mathbf g+\mathbf F_i",
        r"\mathbf r_i=\mathbf r_{i0}+\mathbf v_{i0}t+\tfrac12\mathbf a_it^2",
    ]
    derivation = [
        "① 各質点に重力と設定した外力を加える。",
        "② 物体ごとに合力を質量で割り、加速度を求める。",
        "③ 一定加速度の解析解で、それぞれ独立に位置と速度を求める。",
    ]
    modes = []
    meta = {}

    def __init__(self, scene):
        self.scene = scene

    def at(self, t):
        states = []
        for b in self.scene.bodies:
            fx, fy = self.scene.applied(b.id)
            ax, ay = fx / b.mass, fy / b.mass - self.scene.g
            forces = [force("gravity", 0, -b.mass * self.scene.g, "mg")]
            forces.extend(
                force("external", f.fx, f.fy, "F", source=f.id)
                for f in self.scene.external
                if f.body == b.id
            )
            states.append(
                body_frame(
                    b,
                    b.x + b.vx * t + 0.5 * ax * t * t,
                    b.y + b.vy * t + 0.5 * ay * t * t,
                    b.vx + ax * t,
                    b.vy + ay * t,
                    forces,
                )
            )
        return frame(self.scene, t, states)

    def boundary(self, result):
        return False
