import os
import urllib.request
import hashlib
import subprocess
import time
import socket
import concurrent.futures


def get_local_ip(retries=10, delay=5):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    for attempt in range(retries):
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            print(f"[WARN] Network not ready. Retry {attempt + 1}/{retries}...")
            time.sleep(delay)
    raise RuntimeError("Network is unreachable after several retries.")


def get_subnet_base(ip: str) -> str:
    return '.'.join(ip.split('.')[:3]) + "."  # e.g. "192.168.1.34" → "192.168.1"


# === CONFIGURATION ===
MAIN_SCRIPT = "/home/user/uav/uav_main.py"
TARGET_PORT = 8080  # The port your GCS/laptop update server listens on
SCAN_BASE = get_subnet_base(get_local_ip())


# === NETWORK SCANNING UTILITIES ===

def ping_host(ip, port=TARGET_PORT, timeout=1):
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except:
        return False



def is_valid_update_server(ip):
    try:
        print(f"[DEBUG] Pinging {ip} via http://{ip}:{TARGET_PORT}/ping")
        with urllib.request.urlopen(f"http://{ip}:{TARGET_PORT}/ping", timeout=2) as resp:
            return resp.read().strip() == b"hello-uav"
    except:
        return False


def check_ip(ip):
    reachable = ping_host(ip)
    valid = is_valid_update_server(ip)
    print(
        f"[CHECKED] {ip} checked, ping host {'success' if reachable else 'failed'}, ping server {'success' if valid else 'failed'}")

    if valid:
        print(f"[FOUND] Update server at {ip}")
        return f"http://{ip}:{TARGET_PORT}"

    return None


def discover_update_server():
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = []
        for i in range(1, 255):
            ip = f"{SCAN_BASE}{i}"
            futures.append(executor.submit(check_ip, ip))
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                return result
    print("No update server found.")
    return None


# === HASH & UPDATE LOGIC ===

def fetch_remote_file(url):
    print("Fetching remote file...")
    with urllib.request.urlopen(url, timeout=5) as resp:
        print("Fetched")
        return resp.read()


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_local_file(path) -> str:
    if not os.path.exists(path):
        return None
    with open(path, 'rb') as f:
        return hash_bytes(f.read())


def update_main_script(remote_script: bytes) -> bool:
    try:
        compile(remote_script, MAIN_SCRIPT, 'exec')  # Validate Python syntax before saving
        with open(MAIN_SCRIPT, 'wb') as f:
            f.write(remote_script)
        print("uav_main.py updated.")
        return True
    except Exception as e:
        print("Update failed:", e)
        return False


uav_process = None

def run_main(server_ip: str):
    global uav_process
    try:
        uav_process = subprocess.Popen(
            ["python3", MAIN_SCRIPT, "--server-ip", server_ip]
        )
        print(f"Started UAV main script (PID {uav_process.pid}) → server {server_ip}")
    except Exception as e:
        print("Failed to start UAV main script:", e)

def stop_main():
    global uav_process
    if uav_process and uav_process.poll() is None:  # still running
        print(f"Stopping UAV main script with PID {uav_process.pid}")
        uav_process.terminate()
        try:
            uav_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            print("Force killing unresponsive script...")
            uav_process.kill()
        uav_process = None

# === MAIN LOOP ===

def main():
    print("=== UAV Runner ===")
    update_server = None

    while True:
        print("=== Updating Server ===")
        if not update_server:
            update_server = discover_update_server()
            print("Discovered update server:", update_server)

        if update_server:
            try:
                remote_script = fetch_remote_file(f"{update_server}/uav_main.py")
                remote_hash = hash_bytes(remote_script)
                local_hash = hash_local_file(MAIN_SCRIPT)
                print(remote_script[:100].decode('utf-8', errors='replace'))

                if remote_hash != local_hash:
                    print("New version detected. Updating...")
                    stop_main()  # Kill old
                    if update_main_script(remote_script):
                        print("Update successful. Restarting UAV main script.")
                        run_main(update_server.split("://", 1)[1].split(":", 1)[0])
                    else:
                        print("Update failed. Will retry in 10s.")
                else:
                    if uav_process is None or uav_process.poll() is not None:
                        print("No update needed. Script not running, starting...")
                        run_main(update_server.split("://", 1)[1].split(":", 1)[0])
                    else:
                        print("No update needed. Script already running.")
            except Exception as e:
                print(f"[ERROR] Update failed: {e}")
                print("Forgetting current update server and rescanning next round.")
                update_server = None
        else:
            print("No update server found. Retrying...")

        print("Sleeping 10 seconds...")
        time.sleep(10)



if __name__ == "__main__":
    print("=== Starting ===")
    main()  # Don't wrap this in a while loop
