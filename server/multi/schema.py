"""Scene schema and force bookkeeping. Coordinates use SI units, y points up."""

from dataclasses import dataclass, asdict, field
import math

KINDS = {"mass", "block", "platform", "wall", "floor", "incline", "anchor", "pulley"}
DYNAMIC = {"mass", "block", "platform"}
FORCE_KINDS = {
    "external",
    "gravity",
    "spring",
    "friction",
    "normal",
    "tension",
    "contact",
    "fixed",
}


def number(raw, key, default, lo=-100, hi=100):
    value = raw.get(key, default)
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or not lo <= value <= hi
    ):
        raise ValueError(f"{key}: {lo}〜{hi} の有限値が必要です。")
    return float(value)


@dataclass
class Object:
    id: str
    kind: str
    x: float = 0
    y: float = 0
    mass: float = 1
    vx: float = 0
    vy: float = 0
    width: float = 0.8
    height: float = 0.8
    mus: float = 0.5
    muk: float = 0.3
    angle: float = 30
    support: str = ""
    label: str = ""

    @property
    def dynamic(self):
        return self.kind in DYNAMIC


@dataclass
class Connection:
    id: str
    kind: str
    a: str
    b: str
    k: float = 8
    rest: float = 3
    pulley: str = ""


@dataclass
class AppliedForce:
    id: str
    body: str
    fx: float = 0
    fy: float = 0


@dataclass
class Scene:
    objects: list[Object]
    connections: list[Connection]
    external: list[AppliedForce]
    g: float = 9.8
    duration: float = 12
    title: str = "自由実験"

    @property
    def bodies(self):
        return [o for o in self.objects if o.dynamic]

    @property
    def by_id(self):
        return {o.id: o for o in self.objects}

    def applied(self, body):
        forces = [f for f in self.external if f.body == body]
        return sum(f.fx for f in forces), sum(f.fy for f in forces)


def parse_scene(raw):
    if not isinstance(raw, dict):
        raise ValueError("scene はオブジェクトで指定してください。")
    if set(raw)-{'objects','connections','external','g','duration','title'}:
        raise ValueError('未対応のシーン項目があります。回転・一般接触などの設定を無視して計算することはありません。')
    objects, connections, external = (
        raw.get("objects", []),
        raw.get("connections", []),
        raw.get("external", []),
    )
    if not all(isinstance(a, list) for a in [objects, connections, external]):
        raise ValueError("objects / connections / external は配列です。")
    if len(objects) > 24 or len(connections) > 20 or len(external) > 12:
        raise ValueError("上限はオブジェクト24個、接続20本、外力12個です。")
    seen = set()

    def identity(item):
        if not isinstance(item, dict):
            raise ValueError("各要素はオブジェクトです。")
        ident = item.get("id")
        if not isinstance(ident, str) or not ident or len(ident) > 60 or ident in seen:
            raise ValueError("IDは重複しない1〜60文字の文字列です。")
        seen.add(ident)
        return ident

    result = []
    for item in objects:
        ident = identity(item)
        if set(item)-set(Object.__dataclass_fields__):
            raise ValueError('未対応の物体項目があります。回転や追加拘束は未対応です。')
        if item.get("kind") not in KINDS:
            raise ValueError("未定義の物体種別です。")
        obj = Object(
            ident,
            item["kind"],
            x=number(item, "x", 0, -30, 30),
            y=number(item, "y", 0, -30, 30),
            mass=number(item, "mass", 1, 0.1, 20),
            vx=number(item, "vx", 0, -15, 15),
            vy=number(item, "vy", 0, -15, 15),
            width=number(item, "width", 0.8, 0.2, 20),
            height=number(item, "height", 0.8, 0.2, 5),
            mus=number(item, "mus", 0.5, 0, 1.5),
            muk=number(item, "muk", 0.3, 0, 1.5),
            angle=number(item, "angle", 30, 0, 80),
            support=item.get("support", ""),
            label=str(item.get("label", ident))[:40],
        )
        if not isinstance(obj.support, str) or obj.muk > obj.mus:
            raise ValueError("支持物のID、または 0 ≤ μₖ ≤ μₛ を確認してください。")
        result.append(obj)
    if sum(o.dynamic for o in result) > 8:
        raise ValueError("動く物体は8個までです。")
    ids = {o.id for o in result}
    for o in result:
        if o.support and o.support not in ids:
            raise ValueError(f"{o.id}: 支持物がありません。")
    links = []
    for item in connections:
        ident = identity(item)
        if set(item)-set(Connection.__dataclass_fields__):
            raise ValueError('未対応の接続項目があります。')
        if item.get('kind')=='spring' and item.get('pulley',''):
            raise ValueError('ばねを滑車に巻き掛ける構成は未対応です。')
        if not isinstance(item.get('pulley',''),str):
            raise ValueError('経由する滑車はID文字列です。')
        if (
            item.get("kind") not in {"spring", "rope"}
            or item.get("a") not in ids
            or item.get("b") not in ids
            or item["a"] == item["b"]
        ):
            raise ValueError("接続は異なる2つの存在する端点を指定してください。")
        links.append(
            Connection(
                ident,
                item["kind"],
                item["a"],
                item["b"],
                k=number(item, "k", 8, 0.1, 100),
                rest=number(item, "rest", 3, 0.1, 80),
                pulley=item.get("pulley", ""),
            )
        )
    forces = []
    for item in external:
        ident = identity(item)
        if set(item)-set(AppliedForce.__dataclass_fields__):
            raise ValueError('未対応の外力項目があります。')
        if (
            item.get("body") not in ids
            or not next(o for o in result if o.id == item["body"]).dynamic
        ):
            raise ValueError("外力の対象は動く物体です。")
        forces.append(
            AppliedForce(
                ident,
                item["body"],
                number(item, "fx", 0, -100, 100),
                number(item, "fy", 0, -100, 100),
            )
        )
    return Scene(
        result,
        links,
        forces,
        number(raw, "g", 9.8, 0.1, 20),
        number(raw, "duration", 12, 1, 30),
        str(raw.get("title", "自由実験"))[:80],
    )


def force(kind, fx, fy, label, pair="", source=""):
    if kind not in FORCE_KINDS:
        raise ValueError("Unknown force type")
    return dict(kind=kind, fx=fx, fy=fy, label=label, pair=pair, source=source)


def body_frame(obj, x, y, vx, vy, forces, **extra):
    fx, fy = sum(f["fx"] for f in forces), sum(f["fy"] for f in forces)
    return dict(
        id=obj.id,
        x=x,
        y=y,
        vx=vx,
        vy=vy,
        ax=fx / obj.mass if obj.dynamic else 0.0,
        ay=fy / obj.mass if obj.dynamic else 0.0,
        forces=forces,
        **extra,
    )


def frame(scene, t, bodies, spring_energy=0, dissipated=0, **extra):
    dynamic = [b for b in bodies if scene.by_id[b["id"]].dynamic]
    mass = sum(scene.by_id[b["id"]].mass for b in dynamic)
    kinetic = sum(
        0.5 * scene.by_id[b["id"]].mass * (b["vx"] ** 2 + b["vy"] ** 2) for b in dynamic
    )
    potential = (
        sum(scene.by_id[b["id"]].mass * scene.g * b["y"] for b in dynamic)
        + spring_energy
    )
    quantities = {
        key: (
            sum(scene.by_id[b["id"]].mass * b[source] for b in dynamic) / mass
            if mass
            else 0
        )
        for key, source in [("cx", "x"), ("cy", "y"), ("cax", "ax"), ("cay", "ay")]
    }
    px = sum(scene.by_id[b["id"]].mass * b["vx"] for b in dynamic)
    py = sum(scene.by_id[b["id"]].mass * b["vy"] for b in dynamic)
    return dict(
        t=t,
        bodies=bodies,
        kinetic=kinetic,
        potential=potential,
        energy=kinetic + potential,
        dissipated=dissipated,
        px=px,
        py=py,
        **quantities,
        **extra,
    )
