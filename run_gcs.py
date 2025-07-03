# run_all.py

import subprocess
import signal
import sys
import os

children = []

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

    root = os.path.dirname(os.path.abspath(__file__))

    # Backend
    backend_dir = os.path.join(root, "backend")
    uvicorn_cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "55050", "--reload"]
    uv = start_process(uvicorn_cmd, cwd=backend_dir)

    # Frontend
    frontend_dir = os.path.join(root, "frontend")
    if sys.platform.startswith("win"):
        vite_cmd = ["npx.cmd", "vite", "--host", "0.0.0.0"]
    else:
        vite_cmd = ["npx", "vite", "--host", "0.0.0.0"]
    vt = start_process(vite_cmd, cwd=frontend_dir)

    try:
        ret1 = uv.wait()
        ret2 = vt.wait()
        return max(ret1, ret2)
    finally:
        cleanup()

if __name__ == "__main__":
    sys.exit(main())
