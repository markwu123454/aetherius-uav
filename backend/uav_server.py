# update_server.py
import os
import json
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer

class UAVServer:
    def __init__(self, port=8080, base_dir="onboard/rpi", log_file="uav_server.log"):
        self.port = port
        self.base_dir = base_dir  # serve everything under here

        # set up a dedicated logger
        self.logger = logging.getLogger(f"UpdateServer:{port}")
        self.logger.setLevel(logging.INFO)
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

        fh = logging.FileHandler(log_file)
        fh.setFormatter(formatter)
        sh = logging.StreamHandler()
        sh.setFormatter(formatter)

        # avoid adding handlers multiple times
        if not self.logger.handlers:
            self.logger.addHandler(fh)
            self.logger.addHandler(sh)

        # build and store the handler class that captures our parameters
        self.handler_class = self._make_handler()
        self.httpd = HTTPServer(("", self.port), self.handler_class)

    def _make_handler(self):
        base_dir = os.path.abspath(self.base_dir)
        logger = self.logger

        class CustomHandler(BaseHTTPRequestHandler):
            def list_files(self):
                file_list = []
                for root, dirs, files in os.walk(base_dir):
                    for f in files:
                        # record relative paths with Unix-style separators
                        rel = os.path.relpath(os.path.join(root, f), base_dir).replace(os.sep, "/")
                        file_list.append(rel)
                return file_list

            def do_GET(self):
                client_ip = self.client_address[0]
                path = self.path.lstrip("/")
                logger.info(f"GET {self.path} from {client_ip}")

                if self.path == "/list":
                    # return JSON list of all files
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

                if path:
                    file_path = os.path.join(base_dir, path)
                    if os.path.isfile(file_path):
                        try:
                            with open(file_path, "rb") as f:
                                data = f.read()
                            self.send_response(200)
                            self.send_header("Content-Type", "application/octet-stream")
                            self.end_headers()
                            self.wfile.write(data)
                            logger.info(f"Served {path} to {client_ip}")
                            return
                        except IOError as e:
                            logger.warning(f"Error reading {path}: {e}")
                # fallback 404
                self.send_response(404)
                self.end_headers()
                logger.warning(f"Path not found: {self.path} from {client_ip}")

            def log_message(self, format, *args):
                return  # disable default

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

if __name__ == "__main__":
    # current_dir = project_dir/frontend
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir  = os.path.dirname(current_dir)  # project_dir

    # serve the entire onboard/rpi directory
    base_dir = os.path.join(parent_dir, "onboard", "rpi")

    server = UAVServer(port=8080, base_dir=base_dir)
    server.start()


