import http.server
import json
import os
import sys
from pathlib import Path

PORT = 8000
ROOT = Path(__file__).resolve().parent
MENU_FILE = ROOT / 'menu.json'
UPLOADS_DIR = ROOT / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == '/api/menu':
            self._serve_menu()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/menu':
            self._save_menu()
        elif self.path == '/api/upload':
            self._upload_image()
        else:
            self.send_error(404)

    def _serve_menu(self):
        try:
            with open(MENU_FILE, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
            self._send_json(data)
        except FileNotFoundError:
            self._send_json([])
        except Exception as e:
            self.send_error(500, str(e))

    def _save_menu(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            with open(MENU_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._send_json({'ok': True})
        except Exception as e:
            self.send_error(400, str(e))

    def _upload_image(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        import uuid
        ext = '.png'
        filename = f"{uuid.uuid4().hex[:8]}{ext}"
        filepath = UPLOADS_DIR / filename
        with open(filepath, 'wb') as f:
            f.write(body)
        self._send_json({'ok': True, 'path': f'uploads/{filename}'})

    def _send_json(self, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    print(f'焰厨服务器已启动: http://localhost:{PORT}')
    print(f'后台管理: http://localhost:{PORT}/admin.html')
    print('按 Ctrl+C 停止')
    with http.server.HTTPServer(('0.0.0.0', PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n服务器已停止')
