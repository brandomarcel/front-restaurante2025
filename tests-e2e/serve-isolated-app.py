"""Serve a compiled SPA on loopback; API calls must be intercepted by tests."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
parser.add_argument('--port', type=int, default=4228)
args = parser.parse_args()
root = Path(args.directory).resolve()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *values, **options):
        super().__init__(*values, directory=str(root), **options)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith(('/api/', '/socket.io/')):
            self.send_error(503, 'API must be mocked')
            return
        if path.startswith('/portal/'):
            path = path[len('/portal'):]
        candidate = (root / path.lstrip('/')).resolve()
        if not candidate.is_relative_to(root):
            self.send_error(403)
            return
        self.path = path if candidate.is_file() else '/index.html'
        super().do_GET()

ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
