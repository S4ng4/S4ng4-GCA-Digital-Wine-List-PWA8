#!/usr/bin/env python3
"""
Minimal server for GCA Wine List PWA.
- Serves static files from the current directory.
- POST /save-wines-json: writes JSON body to data/wines.json (so Wine Management can persist changes).
Run: python3 server.py
Then open http://localhost:8000/gestione-vini.html
"""

import json
import os
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

WINES_JSON = os.path.join(os.path.dirname(__file__), "data", "wines.json")


class Handler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        # PWA manifest should use application/manifest+json for tablet/phone install
        if path.endswith("manifest.json") or path.endswith("/manifest.json"):
            return "application/manifest+json"
        return super().guess_type(path)

    def do_POST(self):
        if self.path == "/save-wines-json" or self.path == "/save-wines-json/":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode("utf-8"))
                if "wines" not in data or not isinstance(data["wines"], list):
                    self.send_error(400, "JSON must have a 'wines' array")
                    return
                os.makedirs(os.path.dirname(WINES_JSON), exist_ok=True)
                with open(WINES_JSON, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "path": "data/wines.json"}).encode())
            except json.JSONDecodeError as e:
                self.send_error(400, "Invalid JSON: " + str(e))
            except OSError as e:
                self.send_error(500, "Write failed: " + str(e))
            return
        self.send_error(404)

    def log_message(self, format, *args):
        print("[%s] %s" % (self.log_date_time_string(), format % args))


def main():
    port = 8000
    server = HTTPServer(("", port), Handler)
    print("Serving at http://localhost:%s" % port)
    print("Wine Management: http://localhost:%s/gestione-vini.html" % port)
    print("POST /save-wines-json writes to data/wines.json")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
