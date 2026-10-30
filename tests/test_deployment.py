"""Run the production manifest check against a response delivered in chunks."""

import http.server
from pathlib import Path
import subprocess
import threading
import time
import unittest


class DeploymentResponseTest(unittest.TestCase):
    def test_manifest_check_reads_the_complete_response(self):
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                body = b'{"review_status":"cross-reviewed",\n"padding":"' + b"x" * 1_000_000 + b'"}'
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                try:
                    self.wfile.write(body[:1024])
                    self.wfile.flush()
                    time.sleep(0.02)
                    self.wfile.write(body[1024:])
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *_args):
                pass

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            script = (Path(__file__).resolve().parents[1] / "scripts/deploy.sh").read_text()
            command = next(line for line in script.splitlines() if line.startswith("curl ") and "/study/manifest.json" in line)
            command = command.replace("https://enarm.musel.dev/study/manifest.json", f"http://127.0.0.1:{server.server_port}/study/manifest.json")
            result = subprocess.run(["bash", "-o", "pipefail", "-c", command], capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
