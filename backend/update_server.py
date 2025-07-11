# update_server.py
import os
import json
import logging
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread


class UAVServer:
    def __init__(self, port=55051, base_dir="onboard/rpi"):
        self.port = port
        self.base_dir = os.path.abspath(base_dir)

        # set up a dedicated logger (console only)
        self.logger = logging.getLogger(f"UpdateServer:{port}")
        self.logger.setLevel(logging.INFO)
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

        sh = logging.StreamHandler()
        sh.setFormatter(formatter)

        if not self.logger.handlers:
            self.logger.addHandler(sh)

        self.handler_class = self._make_handler()
        self.httpd = HTTPServer(("", self.port), self.handler_class)

    def _make_handler(self):
        base_dir = self.base_dir
        logger = self.logger

        class CustomHandler(BaseHTTPRequestHandler):
            def list_files(self):
                file_list = []
                for root, dirs, files in os.walk(base_dir):
                    for f in files:
                        rel = os.path.relpath(os.path.join(root, f), base_dir).replace(os.sep, "/")
                        file_list.append(rel)
                return file_list

            def compute_hashes(self):
                hashes = {}
                for rel in self.list_files():
                    path = os.path.join(base_dir, rel)
                    try:
                        with open(path, "rb") as fh:
                            data = fh.read()
                        h = hashlib.sha256(data).hexdigest()
                        hashes[rel] = h
                    except Exception as e:
                        logger.warning(f"Failed to hash {rel}: {e}")
                return hashes

            def do_GET(self):
                client_ip = self.client_address[0]
                logger.info(f"GET {self.path} from {client_ip}")

                if self.path == "/list":
                    files = self.list_files()
                    body = json.dumps(files).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(body)
                    logger.info(f"Served file list ({len(files)} entries) to {client_ip}")
                    return

                elif self.path == "/ping":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"hello-uav")
                    logger.info(f"Responded to /ping from {client_ip}")
                    return

                elif self.path == "/hashes":
                    hashes = self.compute_hashes()
                    body = json.dumps(hashes).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(body)
                    logger.info(f"Served hashes ({len(hashes)} entries) to {client_ip}")
                    return

                # serve any other file under base_dir
                rel_path = self.path.lstrip("/")
                if rel_path:
                    file_path = os.path.join(base_dir, rel_path)
                    if os.path.isfile(file_path):
                        try:
                            with open(file_path, "rb") as f:
                                data = f.read()
                            self.send_response(200)
                            self.send_header("Content-Type", "application/octet-stream")
                            self.end_headers()
                            self.wfile.write(data)
                            logger.info(f"Served {rel_path} to {client_ip}")
                            return
                        except IOError as e:
                            logger.warning(f"Error reading {rel_path}: {e}")

                # fallback 404
                self.send_response(404)
                self.end_headers()
                logger.warning(f"Path not found: {self.path} from {client_ip}")

            def log_message(self, format, *args):
                # suppress default logging
                return

        return CustomHandler

    def start(self):
        logger = self.logger
        logger.info(f"Starting server, serving '{self.base_dir}' on port {self.port}")
        try:
            self.httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received; shutting down.")
            self.shutdown()

    def shutdown(self):
        self.httpd.server_close()
        self.logger.info("Server has been shut down.")

def start_update_server():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(current_dir)
    base_dir = os.path.join(project_dir, "onboard", "rpi")

    server = UAVServer(port=55051, base_dir=base_dir)
    thread = Thread(target=server.start, daemon=True)
    thread.start()

