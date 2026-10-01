#!/usr/bin/env python3
"""Tiny static server for the exported web build.
Serves pre-compressed .gz files with Content-Encoding when available."""
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "build", "web")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".pck": "application/octet-stream",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if path.endswith("/"):
            path += "index.html"
        gz = path + ".gz"
        if os.path.isfile(gz) and "gzip" in self.headers.get("Accept-Encoding", ""):
            try:
                f = open(gz, "rb")
            except OSError:
                return super().send_head()
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(os.fstat(f.fileno()).st_size))
            self.end_headers()
            return f
        return super().send_head()


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"serving {ROOT} on 0.0.0.0:{PORT}")
    server.serve_forever()
