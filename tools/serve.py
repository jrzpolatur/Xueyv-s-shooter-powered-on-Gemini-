#!/usr/bin/env python3
"""Static server for build/web with correct MIME types for Godot web exports
(.wasm streaming instantiation requires application/wasm) plus a /client-log
endpoint that prints browser-side errors to stdout (used for debugging from
the sandbox). Usage: python3 tools/serve.py [port]"""
import http.server
import json
import os
import socketserver
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "build", "web")
ROOT = os.path.normpath(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".pck": "application/octet-stream",
        ".html": "text/html",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_POST(self):
        if self.path == "/client-log":
            length = int(self.headers.get("Content-Length", "0"))
            data = self.rfile.read(length).decode("utf-8", "replace")
            try:
                for line in json.loads(data):
                    print("[client]", line, flush=True)
            except Exception:
                print("[client]", data, flush=True)
            self.send_response(204)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        print("[http]", fmt % args, flush=True)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with Server(("", port), Handler) as httpd:
        print(f"Serving {ROOT}")
        print(f"URL: http://0.0.0.0:{port}", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
