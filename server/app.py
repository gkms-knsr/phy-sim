"""Optional local HTTP API plus static files; no third-party dependencies."""

import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from .http_api import JsonApiMixin

ROOT = Path(__file__).resolve().parent.parent / "dist"


class Handler(JsonApiMixin, SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlparse(self.path).path.startswith("/api/"):
            self.handle_api()
        else:
            super().do_GET()

    do_POST = JsonApiMixin.handle_api
    do_PUT = JsonApiMixin.handle_api
    do_PATCH = JsonApiMixin.handle_api
    do_DELETE = JsonApiMixin.handle_api
    do_OPTIONS = JsonApiMixin.handle_api


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    print(f"PHYSICA optional API: http://127.0.0.1:{args.port}", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
