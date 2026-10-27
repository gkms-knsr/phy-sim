from dataclasses import asdict
import math
from .schema import parse_scene


def platform_scene(mus=0.6, muk=0.3):
    return {
        "title": "台の上の物体",
        "objects": [
            {
                "id": "deck",
                "kind": "platform",
                "label": "台 M",
                "mass": 4,
                "x": 0,
                "y": 0,
                "width": 16,
                "height": 0.6,
            },
            {
                "id": "load",
                "kind": "block",
                "label": "物体 m",
                "mass": 1,
                "x": 0,
                "y": 0.7,
                "width": 0.8,
                "height": 0.8,
                "support": "deck",
                "mus": mus,
                "muk": muk,
            },
            {
                "id": "floor",
                "kind": "floor",
                "label": "摩擦のない床",
                "x": 0,
                "y": -0.3,
            },
        ],
        "external": [{"id": "push", "body": "deck", "fx": 8, "fy": 0}],
    }


def spring_scene(count=2, walls=True):
    objects = [
        {
            "id": f"m{i+1}",
            "kind": "mass",
            "label": f"物体 {i+1}",
            "mass": 1,
            "x": (i - (count - 1) / 2) * 3 + (0.4 if i == 0 else -0.2),
            "y": 0,
        }
        for i in range(count)
    ]
    links = [
        {
            "id": f"k{i+1}",
            "kind": "spring",
            "a": f"m{i+1}",
            "b": f"m{i+2}",
            "k": 8,
            "rest": 3,
        }
        for i in range(count - 1)
    ]
    if walls:
        objects += [
            {
                "id": "left",
                "kind": "wall",
                "label": "左の固定壁",
                "x": -(count + 1) / 2 * 3,
                "y": 0,
            },
            {
                "id": "right",
                "kind": "wall",
                "label": "右の固定壁",
                "x": (count + 1) / 2 * 3,
                "y": 0,
            },
        ]
        links += [
            {"id": "kL", "kind": "spring", "a": "left", "b": "m1", "k": 8, "rest": 3},
            {
                "id": "kR",
                "kind": "spring",
                "a": f"m{count}",
                "b": "right",
                "k": 8,
                "rest": 3,
            },
        ]
    return dict(title="連成ばね振動", objects=objects, connections=links)


def pulley_scene(incline=False):
    px, py = 0, 4
    angle = math.pi / 6
    objects = [
        {
            "id": "m1",
            "kind": "block",
            "label": "物体 1",
            "mass": 2,
            "x": -0.4 - 3 * math.cos(angle) if incline else -0.4,
            "y": py - 3 * math.sin(angle) if incline else 1,
            "support": "slope" if incline else "",
            "mus": 0,
            "muk": 0,
        },
        {
            "id": "m2",
            "kind": "block",
            "label": "物体 2",
            "mass": 1 if incline else 3,
            "x": 0.4,
            "y": 1,
        },
        {"id": "pulley", "kind": "pulley", "label": "固定滑車", "x": px, "y": py},
    ]
    if incline:
        objects.append(
            {
                "id": "slope",
                "kind": "incline",
                "label": "摩擦なしの斜面",
                "x": -0.4,
                "y": py,
                "angle": 30,
            }
        )
    return dict(
        title="斜面と滑車" if incline else "2物体の滑車",
        objects=objects,
        connections=[
            {
                "id": "rope",
                "kind": "rope",
                "a": "m1",
                "b": "m2",
                "pulley": "pulley",
                "rest": 6,
            }
        ],
    )


def presets():
    definitions = [
        (
            "platform-free",
            "台の上の物体（摩擦なし）",
            "台だけが加速。上の物体の慣性を観察。",
            platform_scene(0, 0),
        ),
        (
            "platform-stick",
            "台の上の物体（静止摩擦あり）",
            "内力が打ち消し合い、一体となって動く。",
            platform_scene(),
        ),
        (
            "platform-slip",
            "台の上の物体（滑りあり）",
            "必要な摩擦と最大静止摩擦を比較。",
            platform_scene(0.08, 0.05),
        ),
    ]
    definitions += [
        (
            "spring-two",
            "2物体を1本のばねで接続",
            "外力なし。運動量と重心運動を確認。",
            spring_scene(walls=False),
        ),
        (
            "spring-three",
            "2物体を3本のばねで接続",
            "同位相・逆位相の固有モードを比較。",
            spring_scene(),
        ),
    ]
    definitions += [
        (
            "pulley-two",
            "2物体の滑車問題",
            "糸の長さ一定から加速度の関係を導く。",
            pulley_scene(),
        ),
        (
            "pulley-incline",
            "斜面と滑車を組み合わせた問題",
            "斜面方向の重力と張力を比較。",
            pulley_scene(True),
        ),
    ]
    definitions += [
        (
            "spring-chain",
            "ばねで接続された3物体",
            "3体に拡張した連成振動。",
            spring_scene(3),
        )
    ]
    return [
        dict(
            id=ident, name=name, description=description, scene=asdict(parse_scene(raw))
        )
        for ident, name, description, raw in definitions
    ]
