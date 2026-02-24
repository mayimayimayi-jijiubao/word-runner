#!/usr/bin/env python3
"""带 no-cache 头的本地 HTTP 服务器，防止浏览器缓存旧文件"""
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
print(f"🚀 No-cache server on http://localhost:{port}")
http.server.HTTPServer(('', port), NoCacheHandler).serve_forever()
