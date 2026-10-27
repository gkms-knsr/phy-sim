"""HTTP adapter shared by the local server and the optional Vercel Function."""

import gzip
from urllib.parse import urlparse, parse_qs
from .service import dispatch_transport, dumps

MAX_RESPONSE_BYTES = 4_000_000  # Leave headroom below the platform payload limit.


class JsonApiMixin:
    def api_path(self):
        url = urlparse(self.path)
        # Vercel rewrites /api/* to one Function, carrying the original suffix.
        route = parse_qs(url.query).get("route", [None])[0]
        return "/api/" + route.lstrip("/") if route is not None else url.path

    def send_api_json(self, status, text):
        payload = text.encode("utf-8")
        accepts_gzip = False
        for encoding in self.headers.get("Accept-Encoding", "").lower().split(","):
            parts = [p.strip() for p in encoding.split(";")]
            if parts[0] == "gzip":
                quality = 1.0
                for parameter in parts[1:]:
                    if parameter.startswith("q="):
                        try:
                            quality = float(parameter[2:])
                        except ValueError:
                            quality = 0.0
                accepts_gzip = quality > 0
                break
        compressed = accepts_gzip and len(payload) > 1024
        if compressed:
            payload = gzip.compress(payload, compresslevel=5, mtime=0)
        if len(payload) > MAX_RESPONSE_BYTES:
            status, compressed = 413, False
            payload = dumps(
                {
                    "error": "計算結果がHTTP APIのサイズ上限を超えました。画面のブラウザ内計算を使用するか、実験時間・物体数を減らしてください。"
                }
            ).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("X-Content-Type-Options", "nosniff")
        if compressed:
            self.send_header("Content-Encoding", "gzip")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def handle_api(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 0 or size > 65536:
                self.send_api_json(
                    413, dumps({"error": "リクエストのサイズが不正です。"})
                )
                return
            body = self.rfile.read(size).decode("utf-8") if size else None
            status, text = dispatch_transport(
                dumps({"method": self.command, "path": self.api_path(), "body": body})
            )
            self.send_api_json(status, text)
        except (ValueError, UnicodeError):
            self.send_api_json(
                400, dumps({"error": "本文をUTF-8のJSON形式で指定してください。"})
            )
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.send_api_json(
                500,
                dumps(
                    {
                        "error": "計算APIでエラーが発生しました。条件を確認して再試行してください。"
                    }
                ),
            )
