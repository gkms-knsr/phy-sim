"""Vercel's Python Function. The normal UI computes in its browser worker."""

from http.server import BaseHTTPRequestHandler
from server.http_api import JsonApiMixin


class handler(JsonApiMixin, BaseHTTPRequestHandler):
    do_GET = JsonApiMixin.handle_api
    do_POST = JsonApiMixin.handle_api
    do_PUT = JsonApiMixin.handle_api
    do_PATCH = JsonApiMixin.handle_api
    do_DELETE = JsonApiMixin.handle_api
    do_OPTIONS = JsonApiMixin.handle_api
    do_HEAD = JsonApiMixin.handle_api
