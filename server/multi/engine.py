"""A conservative topology compiler: unsupported scenes never get fake motion."""

import math
from .schema import parse_scene
from .platform import PlatformModel
from .springs import SpringModel
from .pulley import PulleyModel, geometry
from .free import FreeModel

DT = 1 / 120


def compile_scene(scene):
    reasons = []
    bodies = scene.bodies
    if not bodies:
        return None, ["物体を1個以上配置してください。"]
    if any(not o.dynamic and (abs(o.vx)>1e-9 or abs(o.vy)>1e-9) for o in scene.objects):
        return None,['固定物を動かす拘束は未対応です。壁・支点・滑車の初速度を0にしてください。']
    if any(o.kind == "platform" for o in bodies):
        decks = [o for o in bodies if o.kind == "platform"]
        if len(decks) != 1 or len(bodies) != 2 or scene.connections:
            reasons.append(
                "台モデルは台1個・上の物体1個です。ばねや糸との同時接続は未対応です。"
            )
        else:
            deck = decks[0]
            top = next(o for o in bodies if o.id != deck.id)
            if (
                top.support != deck.id
                or abs(top.y - deck.y - (top.height + deck.height) / 2) > 1e-7
            ):
                reasons.append(
                    "上の物体の支持先を台に指定し、下面を台の上面に合わせてください。"
                )
            if (
                abs(top.x - deck.x) > (deck.width - top.width) / 2
                or deck.width <= top.width
            ):
                reasons.append("上の物体全体を台の範囲内に置いてください。")
            if abs(top.vy) + abs(deck.vy) > 1e-9 or any(
                abs(f.fy) > 1e-9 for f in scene.external
            ):
                reasons.append(
                    "台モデルは水平運動のみです。鉛直初速度・鉛直外力は未対応です。"
                )
            extras = [o for o in scene.objects if not o.dynamic]
            if any(o.kind != "floor" for o in extras) or len(extras) > 1:
                reasons.append("台モデルに追加できる環境は摩擦のない床1個だけです。")
            if extras and abs(extras[0].y - (deck.y - deck.height / 2)) > 1e-7:
                reasons.append("床の高さを台の下面に合わせてください。")
            if not reasons:
                return PlatformModel(scene), []
    elif any(l.kind == "rope" for l in scene.connections) or any(
        o.kind in {"pulley", "incline"} for o in scene.objects
    ):
        ropes = [l for l in scene.connections if l.kind == "rope"]
        pulleys = [o for o in scene.objects if o.kind == "pulley"]
        inclines = [o for o in scene.objects if o.kind == "incline"]
        if (
            len(bodies) != 2
            or len(ropes) != 1
            or len(scene.connections) != 1
            or len(pulleys) != 1
            or len(inclines) > 1
        ):
            reasons.append(
                "滑車モデルは2物体・固定滑車1個・糸1本、斜面は0〜1個です。多段滑車やばねとの混在は未対応です。"
            )
        elif (
            ropes[0].pulley != pulleys[0].id
            or not scene.by_id[ropes[0].a].dynamic
            or not scene.by_id[ropes[0].b].dynamic
        ):
            reasons.append(
                "糸の両端を2つの物体に、経由先を固定滑車に指定してください。"
            )
        else:
            rope, pulley, incline, bs, es, origins, qs, vs = geometry(scene)
            if any(
                o.kind not in {"mass", "block", "pulley", "incline"}
                for o in scene.objects
            ):
                reasons.append(
                    "滑車モデルには追加の壁・床・支点を混在できません。滑車自体を固定支点として扱います。"
                )
            for i, (b, e, o, q) in enumerate(zip(bs, es, origins, qs)):
                if (
                    abs(b.x - o[0] - q * e[0]) + abs(b.y - o[1] - q * e[1]) > 1e-7
                    or q <= 0.45
                ):
                    reasons.append(
                        f"{b.label}: 滑車から伸びる直線経路上に、0.45 mより離して配置してください。"
                    )
                if (
                    abs(b.vx * e[1] - b.vy * e[0]) > 1e-8
                    or abs(
                        scene.applied(b.id)[0] * e[1] - scene.applied(b.id)[1] * e[0]
                    )
                    > 1e-8
                ):
                    reasons.append(
                        f"{b.label}: 初速度と外力を経路に平行にしてください。"
                    )
                if b.support and (not incline or i != 0 or b.support != incline.id):
                    reasons.append(
                        "支持先は糸の第1端の物体に対する斜面だけを指定できます。"
                    )
            if incline and (
                abs(incline.x - origins[0][0]) + abs(incline.y - origins[0][1]) > 1e-7
            ):
                reasons.append(
                    "斜面の基準点を滑車の左接線位置に合わせてください。斜面のみの平行移動は未対応です。"
                )
            if incline and (
                bs[0].support != incline.id or bs[0].mus != 0 or bs[0].muk != 0
            ):
                reasons.append(
                    "斜面側の物体を斜面に支持させ、摩擦係数をともに0にしてください。摩擦付き滑車は未対応です。"
                )
            if sum(qs) > rope.rest + 1e-7:
                reasons.append(
                    "物体までの経路長の和が糸の長さを超えています。初期位置か糸の長さを修正してください。"
                )
            if not reasons:
                return PulleyModel(scene), []
    elif scene.connections and all(l.kind == "spring" for l in scene.connections):
        fixed = [o for o in scene.objects if not o.dynamic]
        if any(o.kind not in {"anchor", "wall"} for o in fixed):
            reasons.append(
                "ばね網で配置できる固定物は壁・固定支点です。床・斜面との接触は未対応です。"
            )
        if any(abs(o.y - bodies[0].y) > 1e-7 for o in scene.objects) or any(
            abs(b.vy) > 1e-9 for b in bodies
        ):
            reasons.append(
                "ばね網は同じ高さの水平ガイド上で扱います。全端点の y をそろえ、鉛直初速度を0にしてください。"
            )
        if any(abs(f.fy) > 1e-9 for f in scene.external):
            reasons.append("水平ばね網への鉛直外力は未対応です。")
        linked = {end for l in scene.connections for end in [l.a, l.b]}
        if any(o.id not in linked for o in scene.objects):
            reasons.append("ばね網では、すべての物体・固定点をばねに接続してください。")
        if any(
            abs(scene.by_id[l.a].x - scene.by_id[l.b].x) < 0.02
            for l in scene.connections
        ):
            reasons.append("ばねの両端を異なる水平位置に置いてください。")
        if any(
            scene.by_id[l.a].dynamic == False and scene.by_id[l.b].dynamic == False
            for l in scene.connections
        ):
            reasons.append("固定点どうしだけのばねは未対応です。")
        if any(b.support for b in bodies):
            reasons.append(
                "ばね網の拘束は水平ガイドです。別の支持先との組み合わせは未対応です。"
            )
        for i, a in enumerate(scene.objects):
            for b in scene.objects[i + 1 :]:
                clearance = (a.width / 2 if a.kind == "block" else 0) + (
                    b.width / 2 if b.kind == "block" else 0
                )
                if (
                    clearance
                    and (a.dynamic or b.dynamic)
                    and abs(a.x - b.x) <= clearance
                ):
                    reasons.append(
                        "ブロックが他の端点と接触しています。接触問題は未対応のため、離して配置してください。"
                    )
        if not reasons:
            return SpringModel(scene), []
    elif not scene.connections and all(
        o.dynamic and not o.support for o in scene.objects
    ):
        if len(bodies) > 1 and any(o.kind == "block" for o in bodies):
            reasons.append(
                "接触し得る複数ブロックの自由運動は未対応です。自由質点にするか、水平ばね網を構成してください。"
            )
        else:
            return FreeModel(scene), []
    else:
        reasons.append(
            "自由質点に接触形状や支持先が加わっています。一般の床・壁との接触は未対応です。対応するプリセットか水平ばね網を使ってください。"
        )
    return None, reasons


def inspect(raw):
    scene = parse_scene(raw)
    model, reasons = compile_scene(scene)
    return (
        scene,
        model,
        dict(
            supported=model is not None,
            model=model.name if model else "unsupported",
            reasons=reasons,
            assumptions=model.assumptions if model else [],
            equations=model.equations if model else [],
            derivation=model.derivation if model else [],
            modes=model.modes if model else [],
            meta=model.meta if model else {},
            dt=DT,
            duration=scene.duration,
            frames=[],
            events=[],
            warning="",
        ),
    )


def simulate_multi(raw):
    scene, model, result = inspect(raw)
    if model is None:
        return result
    frames = []
    warning = ""
    for i in range(round(scene.duration / DT) + 1):
        current = model.at(i * DT)
        if model.boundary(current):
            warning = (
                "台の端で接触が失われます。以降の落下・再衝突は未対応のため、その直前で停止しました。"
                if model.name == "platform"
                else (
                    "物体が滑車に到達します。通過・接触は未対応のため、その直前で停止しました。"
                    if model.name == "pulley"
                    else "ばねの接続端点が重なります。接触・端点逆転は未対応のため、その直前で停止しました。"
                )
            )
            break
        frames.append(current)
    event_t = getattr(model, "catch", getattr(model, "stop", math.inf))
    if math.isfinite(event_t) and frames and 0 <= event_t <= frames[-1]["t"]:
        result["events"] = [model.at(event_t, before=True), model.at(event_t)]
    result.update(
        frames=frames, duration=frames[-1]["t"] if frames else 0, warning=warning
    )
    return result
