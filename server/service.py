"""Shared JSON API for browser Python, local HTTP, and Vercel Functions.

This module has no networking or platform dependencies. Physics stays in the
existing analytical / constrained-model modules.
"""

import json
from dataclasses import asdict
from .physics import simulate
from .multi.engine import simulate_multi, inspect
from .multi.presets import presets
from .multi.schema import parse_scene

GET_PATHS = {"/api/health", "/api/multi/presets"}
POST_PATHS = {
    "/api/simulate",
    "/api/multi/simulate",
    "/api/multi/validate",
    "/api/multi/normalize",
}


def dumps(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def reject_constant(value):
    raise ValueError(f"JSONに有限でない数値 {value} は使えません。")


def loads(value):
    return json.loads(value, parse_constant=reject_constant)


def dispatch(method, path, data=None):
    path = path.split("?", 1)[0].rstrip("/")
    if path not in GET_PATHS | POST_PATHS:
        return 404, {"error": "指定された計算APIはありません。"}
    expected = "GET" if path in GET_PATHS else "POST"
    if method != expected:
        return 405, {
            "error": f"このAPIは {expected} で呼び出してください。",
            "allowed": expected,
        }
    try:
        if path == "/api/health":
            return 200, {
                "status": "ok",
                "engine": "Python / analytical + Verlet",
                "hz": 120,
            }
        if path == "/api/multi/presets":
            return 200, presets()
        if not isinstance(data, dict):
            raise ValueError("JSONオブジェクトが必要です。")
        if path == "/api/simulate":
            return 200, simulate(data.get("kind"), data.get("params", {}))
        if path == "/api/multi/simulate":
            return 200, simulate_multi(data.get("scene"))
        if path == "/api/multi/validate":
            return 200, inspect(data.get("scene"))[2]
        return 200, asdict(parse_scene(data.get("scene")))
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        return 400, {"error": str(exc)}
    except Exception:
        return 500, {
            "error": "計算を完了できませんでした。条件を確認して再試行してください。"
        }


def dispatch_transport(request_json):
    """Primitive (HTTP status, JSON text) tuple, avoiding Python proxy leaks."""
    try:
        request = loads(request_json)
        if not isinstance(request, dict):
            raise ValueError("リクエストはJSONオブジェクトで指定してください。")
        method, path = request.get("method", "GET"), request.get("path", "")
        if not isinstance(method, str) or not isinstance(path, str):
            raise ValueError("method と path は文字列です。")
        body = request.get("body")
        data = None
        if method == "POST":
            if not isinstance(body, str) or not body:
                raise ValueError("JSON形式の本文が必要です。")
            if len(body.encode("utf-8")) > (
                65536 if path.startswith("/api/multi/") else 8192
            ):
                return 413, dumps({"error": "リクエストのサイズが大きすぎます。"})
            data = loads(body)
        status, value = dispatch(method, path, data)
        return status, dumps(value)
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        return 400, dumps({"error": str(exc)})
