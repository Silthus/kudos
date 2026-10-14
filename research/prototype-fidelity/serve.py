from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
root=sys.argv[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=root,**kwargs)
 def do_GET(self):
  path=self.path.split('?')[0]
  if not (Path(root)/path.lstrip('/')).is_file():self.path='/audit-preview.html'
  super().do_GET()
ThreadingHTTPServer(('0.0.0.0',int(sys.argv[2])),Handler).serve_forever()
