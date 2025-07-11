import subprocess
import signal
import sys
import socket
import shutil
from pathlib import Path

children = []

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 1))
        return s.getsockname()[0]
    finally:
        s.close()

def ensure_https_cert(cert_dir: Path):
    ip = get_local_ip()
    cert = cert_dir / f"{ip}.pem"
    key = cert_dir / f"{ip}-key.pem"

    if not shutil.which("mkcert"):
        print("❌ mkcert not found. Install it first: https://github.com/FiloSottile/mkcert", file=sys.stderr)
        sys.exit(1)

    subprocess.run(["mkcert", "-install"], check=True)

    if not cert.exists() or not key.exists():
        subprocess.run([
            "mkcert",
            "-cert-file", str(cert),
            "-key-file", str(key),
            ip, "localhost", "127.0.0.1"
        ], check=True)

    return cert, key, ip

def start_process(cmd, cwd):
    try:
        p = subprocess.Popen(cmd, cwd=cwd)
    except FileNotFoundError:
        print(f"❌ Could not find {cmd[0]!r}. "
              "Make sure it’s installed and on your PATH.", file=sys.stderr)
        sys.exit(1)
    children.append(p)
    return p

def cleanup():
    for p in children:
        if p.poll() is None:
            try: p.terminate()
            except: p.kill()

def on_signal(signum, frame):
    cleanup()
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    root = Path(__file__).resolve().parent

    # ✅ Setup HTTPS
    cert, key, ip = ensure_https_cert(root)

    # Backend
    backend_dir = root / "backend"
    uvicorn_cmd = [
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", "55050",
        "--ssl-certfile", str(cert),
        "--ssl-keyfile", str(key),
        "--reload"
    ]
    uv = start_process(uvicorn_cmd, cwd=backend_dir)

    # Frontend
    frontend_dir = root / "frontend"
    vite_cmd = (["npx.cmd", "vite", "--host", ip] if sys.platform.startswith("win")
                else ["npx", "vite", "--host", ip])
    vt = start_process(vite_cmd, cwd=frontend_dir)

    try:
        ret1 = uv.wait()
        ret2 = vt.wait()
        return max(ret1, ret2)
    finally:
        cleanup()

if __name__ == "__main__":
    sys.exit(main())
