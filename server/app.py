"""Local-only threaded API and production static server; standard library only."""

import argparse
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from .physics import simulate
from .multi.engine import simulate_multi, inspect
from .multi.presets import presets
from .multi.schema import parse_scene
from dataclasses import asdict

ROOT = Path(__file__).resolve().parent.parent / "dist"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, value, status=200):
        data = json.dumps(
            value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
        ).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if urlparse(self.path).path == "/api/multi/presets":
            self.send_json(presets())
        elif urlparse(self.path).path == "/api/health":
            self.send_json({"status": "ok", "engine": "Python / analytical", "hz": 120})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path not in {
            "/api/simulate",
            "/api/multi/simulate",
            "/api/multi/validate",
            "/api/multi/normalize",
        }:
            self.send_json({"error": "Not found"}, 404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= (65536 if self.path.startswith("/api/multi/") else 8192):
                raise ValueError("リクエストサイズが不正です。")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("JSONオブジェクトが必要です。")
            if self.path == "/api/multi/simulate":
                result = simulate_multi(data.get("scene"))
            elif self.path == "/api/multi/normalize":
                result = asdict(parse_scene(data.get("scene")))
            elif self.path == "/api/multi/validate":
                result = inspect(data.get("scene"))[2]
            else:
                result = simulate(data.get("kind"), data.get("params", {}))
            self.send_json(result)
        except (ValueError, TypeError, KeyError) as e:
            self.send_json({"error": str(e)}, 400)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    print(f"PHYSICA Python server: http://127.0.0.1:{args.port}", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
