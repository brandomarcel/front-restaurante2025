"""Serve an isolated compiled Angular app; never proxy API calls to a backend."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
parser.add_argument('--port', type=int, default=4218)
args = parser.parse_args()
root = Path(args.directory).resolve()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *values, **options):
        super().__init__(*values, directory=str(root), **options)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith(('/api/', '/socket.io/')):
            self.send_error(503, 'Tests must mock API requests')
            return
        if path.startswith('/portal/'):
            self.path = path[len('/portal'):]
        candidate = (root / self.path.split('?')[0].lstrip('/')).resolve()
        if not candidate.is_relative_to(root):
            self.send_error(403)
            return
        if not candidate.is_file():
            self.path = '/index.html'
        super().do_GET()


ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
