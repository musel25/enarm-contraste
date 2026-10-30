"""Run the production manifest check against a response delivered in chunks."""

import http.server
from pathlib import Path
import subprocess
import tempfile
import re
import threading
import time
import unittest


class DeploymentResponseTest(unittest.TestCase):
    def test_first_deployment_rollback_removes_new_api_enablement_and_keeps_data(self):
        script = (Path(__file__).resolve().parents[1] / "scripts/deploy.sh").read_text()
        rollback = re.search(r"rollback\(\) \{\n.*?\n\}\n", script, re.S).group()
        with tempfile.TemporaryDirectory(prefix="enarm-rollback-") as directory:
            root = Path(directory)
            units = root / "units"
            units.mkdir()
            uploads = root / "uploads"
            uploads.mkdir()
            for name in ("enarm-progress.service", "enarm-progress-backup.service", "enarm-progress-backup.timer"):
                (units / name).write_text("# ENARM Contraste progress\nnew unit")
            (root / "site-current").symlink_to("new-site")
            (root / "api-current").symlink_to("failed-api")
            (root / "config").write_text("new config")
            (root / "config.previous").write_text("old config")
            (root / "progress.sqlite").write_text("saved student data")
            rollback = rollback.replace("/etc/systemd/system/", f"{units}/")
            command = '''
sudo() {
  if [[ "$1" == "-n" ]]; then shift; fi
  if [[ "$1" == "systemctl" ]]; then printf '%s\\n' "$*" >> "$task_root/systemctl.log"; return 0; fi
  if [[ "$1" == "nginx" ]]; then return 0; fi
  command "$@"
}
task_root=$1
current="$task_root/site-current"
api_current="$task_root/api-current"
config="$task_root/config"
backup="$task_root/config.previous"
unit_upload="$task_root/uploads"
previous=old-site
previous_api=""
''' + rollback + "\nfalse\nrollback\n"
            result = subprocess.run(["bash", "-c", command, "bash", directory], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertFalse((root / "api-current").is_symlink(), "A failed API must not remain current")
            self.assertFalse((units / "enarm-progress.service").exists(), "A new API unit must not survive first-deploy rollback")
            self.assertEqual((root / "progress.sqlite").read_text(), "saved student data")
            self.assertEqual((root / "config").read_text(), "old config")
            self.assertIn("disable --now enarm-progress.service", (root / "systemctl.log").read_text())

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
