"""Horizontal spring networks; velocity Verlet with stiffness-controlled substeps."""

import math
from .schema import force, body_frame, frame


class SpringModel:
    name = "springs"
    assumptions = [
        "水平ガイド上の並進。重力はガイドの抗力とつり合います。物体の回転・衝突は扱いません。",
        "ばねは質量0の線形ばね。接続端点の順序が逆転する直前で停止します。",
        "速度Verlet法。内部刻みは1/480秒以下、かつ最大角振動数の上界×刻み ≤ 0.025。",
    ]

    def __init__(self, scene):
        self.scene = scene
        self.bodies = scene.bodies
        self.ids = [b.id for b in self.bodies]
        self.index = {b.id: i for i, b in enumerate(self.bodies)}
        self.x = [b.x for b in self.bodies]
        self.v = [b.vx for b in self.bodies]
        self.current_t = 0.0
        self.encountered_boundary = False
        self.links = scene.connections
        by = scene.by_id
        self.orientation = {
            l.id: 1 if by[l.b].x > by[l.a].x else -1 for l in self.links
        }
        self.matrix = [[0.0 for _ in self.bodies] for _ in self.bodies]
        for l in self.links:
            if l.a in self.index:
                self.matrix[self.index[l.a]][self.index[l.a]] += l.k
            if l.b in self.index:
                self.matrix[self.index[l.b]][self.index[l.b]] += l.k
            if l.a in self.index and l.b in self.index:
                i, j = self.index[l.a], self.index[l.b]
                self.matrix[i][j] -= l.k
                self.matrix[j][i] -= l.k
        upper = max(
            (
                sum(abs(v) for v in row) / b.mass
                for row, b in zip(self.matrix, self.bodies)
            ),
            default=0,
        )
        self.substeps = max(4, math.ceil((1 / 120) * math.sqrt(upper) / 0.025))
        self.meta = {
            "substeps": self.substeps,
            "internalDt": 1 / 120 / self.substeps,
            "stiffnessMatrix": self.matrix,
            "bodyIds": self.ids,
        }
        self.equations = []
        for i, b in enumerate(self.bodies):
            terms = []
            for l in self.links:
                if b.id in (l.a, l.b):
                    other = l.b if l.a == b.id else l.a
                    terms.append(f"F_{{{i+1},{self.links.index(l)+1}}}")
            self.equations.append(
                f"{b.mass:g}\\,\\ddot x_{{{i+1}}}="
                + "+".join(terms)
                + f"+({scene.applied(b.id)[0]:g})"
            )
        if len(self.bodies) == 2:
            self.equations.extend(
                [
                    r"m_1\ddot\xi_1=-K_{11}\xi_1-K_{12}\xi_2",
                    r"m_2\ddot\xi_2=-K_{21}\xi_1-K_{22}\xi_2",
                    r"\det(K-\omega^2M)=0",
                ]
            )
        if len(self.bodies) == 2:
            K = self.matrix
            self.equations.append(
                f"K=\\begin{{pmatrix}}{K[0][0]:g}&{K[0][1]:g}\\\\{K[1][0]:g}&{K[1][1]:g}\\end{{pmatrix}}\\,\\mathrm{{N/m}}"
            )
            self.equations.append(
                f"{self.bodies[0].mass:g}\\ddot\\xi_1=-({K[0][0]:g})\\xi_1-({K[0][1]:g})\\xi_2"
            )
            self.equations.append(
                f"{self.bodies[1].mass:g}\\ddot\\xi_2=-({K[1][0]:g})\\xi_1-({K[1][1]:g})\\xi_2"
            )
        self.derivation = [
            "① 各物体を水平ガイドから取り出す。重力と抗力は鉛直方向につり合う。",
            "② 接続ごとの伸び δ = (x_b−x_a)−符号付き自然長 を求め、両端に +kδ と −kδ を加える。",
            "③ 物体ごとにばね力と外力を足し、mᵢẍᵢ = ΣFᵢ を作る。固定端の反力は動く物体系にとって外力。",
            "④ 平衡点からの変位 ξ を使うと Mξ̈ = −Kξ。2質点なら det(K−ω²M)=0 から2つの固有振動数を求める。",
            "⑤ 固有ベクトルと同じ比率で初期変位を与えると、ひとつの固有モードだけを励起できる。",
        ]
        self.modes = self.eigenmodes()
        self.meta["equilibrium"] = self.equilibrium()

    def forces(self, x):
        by = self.scene.by_id
        positions = {
            o.id: x[self.index[o.id]] if o.id in self.index else o.x
            for o in self.scene.objects
        }
        forces = {o.id: [] for o in self.scene.objects}
        energy = 0.0
        for l in self.links:
            delta = positions[l.b] - positions[l.a] - self.orientation[l.id] * l.rest
            value = l.k * delta
            forces[l.a].append(force("spring", value, 0, l.id, l.id, l.b))
            forces[l.b].append(force("spring", -value, 0, l.id, l.id, l.a))
            energy += 0.5 * l.k * delta * delta
        for b in self.scene.objects:
            if b.dynamic:
                forces[b.id].extend(
                    [
                        force("gravity", 0, -b.mass * self.scene.g, "mg"),
                        force("normal", 0, b.mass * self.scene.g, "ガイドの抗力"),
                    ]
                )
                forces[b.id].extend(
                    force("external", f.fx, f.fy, "F", source=f.id)
                    for f in self.scene.external
                    if f.body == b.id
                )
            elif forces[b.id]:
                forces[b.id].append(
                    force("fixed", -sum(f["fx"] for f in forces[b.id]), 0, "固定拘束")
                )
        return forces, energy

    def accelerations(self, x):
        forces, _ = self.forces(x)
        return [sum(f["fx"] for f in forces[b.id]) / b.mass for b in self.bodies]

    def at(self, t):
        if t < self.current_t - 1e-10:
            raise ValueError("数値解は時刻順に評価してください。")
        count = max(
            1, math.ceil((t - self.current_t) / (1 / 120 / self.substeps) - 1e-8)
        )
        h = (t - self.current_t) / count
        for _ in range(count):
            a = self.accelerations(self.x)
            new = [
                x + v * h + 0.5 * acc * h * h for x, v, acc in zip(self.x, self.v, a)
            ]
            next_a = self.accelerations(new)
            self.v = [v + 0.5 * (a0 + a1) * h for v, a0, a1 in zip(self.v, a, next_a)]
            self.x = new
            if self.boundary_positions():
                self.encountered_boundary = True
        self.current_t = t
        forces, energy = self.forces(self.x)
        states = [
            body_frame(
                b,
                self.x[self.index[b.id]] if b.dynamic else b.x,
                b.y,
                self.v[self.index[b.id]] if b.dynamic else 0,
                0,
                forces[b.id],
            )
            for b in self.scene.objects
            if b.dynamic or forces[b.id]
        ]
        return frame(self.scene, t, states, spring_energy=energy)

    def boundary_positions(self):
        objects = self.scene.objects
        positions = {
            o.id: self.x[self.index[o.id]] if o.dynamic else o.x for o in objects
        }
        if any(
            (positions[l.b] - positions[l.a]) * self.orientation[l.id] <= 0.02
            for l in self.links
        ):
            return True
        for i, a in enumerate(objects):
            for b in objects[i + 1 :]:
                clearance = (a.width / 2 if a.kind == "block" else 0) + (
                    b.width / 2 if b.kind == "block" else 0
                )
                if clearance and (a.dynamic or b.dynamic):
                    sign = 1 if b.x > a.x else -1
                    if (positions[b.id] - positions[a.id]) * sign <= clearance:
                        return True
        return False

    def boundary(self, result):
        return self.encountered_boundary or self.boundary_positions()

    def eigenmodes(self):
        if len(self.bodies) != 2:
            return []
        m1, m2 = [b.mass for b in self.bodies]
        a, d = self.matrix[0][0] / m1, self.matrix[1][1] / m2
        b = self.matrix[0][1] / math.sqrt(m1 * m2)
        discriminant = math.hypot(a - d, 2 * b)
        result = []
        for i, value in enumerate(
            [(a + d - discriminant) / 2, (a + d + discriminant) / 2]
        ):
            value = max(0.0, value)
            if abs(b) > 1e-12:
                vector = [b / math.sqrt(m1), (value - a) / math.sqrt(m2)]
            else:
                vector = [1.0, 0.0] if (a <= d) == (i == 0) else [0.0, 1.0]
            norm = max(abs(v) for v in vector)
            vector = [v / norm for v in vector]
            if next(v for v in vector if abs(v) > 1e-12) < 0:
                vector = [-v for v in vector]
            omega = math.sqrt(value)
            result.append(
                dict(
                    omega=omega,
                    frequency=omega / (2 * math.pi),
                    period=2 * math.pi / omega if omega > 1e-10 else None,
                    vector=vector,
                )
            )
        return result

    def equilibrium(self):
        # Solve K x = F(0). For an unanchored network fix the current mass-weighted center.
        n = len(self.bodies)
        rhs = self.accelerations([0.0] * n)
        augmented = [
            self.matrix[i][:] + [rhs[i] * self.bodies[i].mass] for i in range(n)
        ]
        anchored = any(
            not self.scene.by_id[l.a].dynamic or not self.scene.by_id[l.b].dynamic
            for l in self.links
        )
        if not anchored:
            if abs(sum(self.scene.applied(b.id)[0] for b in self.bodies)) > 1e-8:
                return None
            augmented[-1] = [b.mass for b in self.bodies] + [
                sum(b.mass * b.x for b in self.bodies)
            ]
        for col in range(n):
            pivot = max(range(col, n), key=lambda i: abs(augmented[i][col]))
            if abs(augmented[pivot][col]) < 1e-10:
                return None
            augmented[col], augmented[pivot] = augmented[pivot], augmented[col]
            scale = augmented[col][col]
            augmented[col] = [v / scale for v in augmented[col]]
            for i in range(n):
                if i != col:
                    scale = augmented[i][col]
                    augmented[i] = [
                        v - scale * w for v, w in zip(augmented[i], augmented[col])
                    ]
        return [row[-1] for row in augmented]
