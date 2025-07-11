#/\home\user\uav\
import os
import sys
import json
import signal
import socket
import tempfile
import threading
import hashlib
import urllib.request
import concurrent.futures
import multiprocessing
import subprocess
import time

TARGET_PORT = 55051

def get_local_ip(retries=10, delay=5):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    for _ in range(retries):
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            time.sleep(delay)
    raise RuntimeError("Network is unreachable after several retries")

def get_subnet_base(ip: str) -> str:
    return '.'.join(ip.split('.')[:3]) + '.'

def fetch_remote(url, timeout=5):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.read()

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

class UAVRunner:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.main_script = os.path.join(self.base_dir, "uav_main.py")
        self.scan_base = get_subnet_base(get_local_ip())
        self.shutdown_event = threading.Event()
        self.uav_proc = None
        self.stdout_thread = None

        # graceful exit on SIGINT/SIGTERM
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, self._on_signal)

    def _on_signal(self, signum, frame):
        print(f"\n[INFO] Caught signal {signum}, shutting down...")
        self.shutdown_event.set()

    def _log(self, level, msg):
        print(f"[{level}] {msg}", flush=True)

    def _discover_update_server(self):
        def check(ip):
            try:
                data = fetch_remote(f"http://{ip}:{TARGET_PORT}/ping", timeout=2)
                return ip if data.strip() == b"hello-uav" else None
            except:
                return None

        subnet = self.scan_base
        cpu = multiprocessing.cpu_count()
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(16, cpu*2)) as ex:
            futures = {ex.submit(check, f"{subnet}{i}"): i for i in range(1, 255)}
            for fut in concurrent.futures.as_completed(futures):
                ip = fut.result()
                if ip:
                    return f"http://{ip}:{55052}"
        return None

    def _fetch_remote_hashes(self, server):
        try:
            data = fetch_remote(f"{server}/hashes")
            return json.loads(data)
        except Exception as e:
            self._log("DEBUG", f"Failed to fetch hashes: {e}")
            return None

    def _sync_files(self, server) -> bool:
        """Returns True if any file changed."""
        remote_hashes = self._fetch_remote_hashes(server)
        if remote_hashes is None:
            self._log("WARN", "No hashes endpoint; skipping sync")
            return False

        changed = False
        for relpath, remote_hash in remote_hashes.items():
            local_path = os.path.join(self.base_dir, relpath)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            # local hash
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    local_hash = sha256_bytes(f.read())
            else:
                local_hash = None

            if local_hash != remote_hash:
                self._log("UPDATE", relpath)
                data = fetch_remote(f"{server}/{relpath}")
                # atomic replace
                with tempfile.NamedTemporaryFile(dir=os.path.dirname(local_path), delete=False) as tf:
                    tf.write(data)
                os.replace(tf.name, local_path)
                changed = True
        return changed

    def _start_uav(self, host):
        """Launch uav_main.py in its own process group."""
        if self.uav_proc and self.uav_proc.poll() is None:
            return  # already running

        preexec = os.setsid if os.name != 'nt' else None
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

        self.uav_proc = subprocess.Popen(
            [sys.executable, self.main_script, "--server-ip", host],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1,
            preexec_fn=preexec, creationflags=creationflags
        )

        def drain_stdout():
            for line in self.uav_proc.stdout:
                print(line.rstrip(), flush=True)

        self.stdout_thread = threading.Thread(target=drain_stdout, daemon=True)
        self.stdout_thread.start()
        self._log("INFO", f"Started UAV script PID {self.uav_proc.pid}")

    def _stop_uav(self):
        if not self.uav_proc or self.uav_proc.poll() is not None:
            return
        pid = self.uav_proc.pid
        self._log("INFO", f"Terminating UAV script PID {pid}")
        # kill the whole process group if possible
        if os.name != 'nt':
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        else:
            self.uav_proc.send_signal(signal.CTRL_BREAK_EVENT)
        try:
            self.uav_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self._log("WARN", "UAV script unresponsive; killing")
            self.uav_proc.kill()
        finally:
            self.uav_proc = None

    def run(self):
        update_server = None
        try:
            while not self.shutdown_event.is_set():
                if not update_server:
                    update_server = self._discover_update_server()
                    if not update_server:
                        self._log("WARN", "No update server; retrying in 10s")
                        if self.shutdown_event.wait(10):
                            break
                        continue
                    self._log("INFO", f"Found update server: {update_server}")

                changed = self._sync_files(update_server)
                host = update_server.split("://",1)[1].split(":",1)[0]

                if changed:
                    self._stop_uav()
                    self._start_uav(host)
                elif not self.uav_proc or self.uav_proc.poll() is not None:
                    self._start_uav(host)
                else:
                    self._log("DEBUG", "No update; UAV script running")

                # wait up to 10s, but exit immediately on shutdown
                if self.shutdown_event.wait(10):
                    break

        finally:
            self._cleanup()

    def _cleanup(self):
        self._stop_uav()
        self._log("INFO", "Shutdown complete.")

if __name__ == "__main__":
    try:
        UAVRunner().run()
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
