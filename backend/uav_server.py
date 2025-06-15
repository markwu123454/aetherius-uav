# update_server.py
import os
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer

class UpdateServer:
    def __init__(self, port=8080, script_name="uav_main.py", log_file="uav_server.log"):
        self.port = port
        self.script_name = script_name

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
        script_name = self.script_name
        basename = os.path.basename(script_name)
        logger = self.logger

        class CustomHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                client_ip = self.client_address[0]
                logger.info(f"Received GET request for {self.path} from {client_ip}")

                if self.path == f"/{basename}":
                    try:
                        with open(script_name, "rb") as f:
                            data = f.read()
                        self.send_response(200)
                        self.send_header("Content-Type", "application/octet-stream")
                        self.end_headers()
                        self.wfile.write(data)
                        logger.info(f"Served {basename} to {client_ip}")
                    except FileNotFoundError:
                        self.send_response(404)
                        self.end_headers()
                        self.wfile.write(b"File not found.")
                        logger.warning(f"{basename} not found for {client_ip}")

                elif self.path == "/ping":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"hello-uav")
                    logger.info(f"Responded to /ping from {client_ip}")

                else:
                    self.send_response(404)
                    self.end_headers()
                    logger.warning(f"Unhandled path {self.path} from {client_ip}")

            def log_message(self, format, *args):
                # suppress default console logging
                return

        return CustomHandler

    def start(self):
        logger = self.logger
        logger.info(f"Starting server, serving '{self.script_name}' on port {self.port}")
        try:
            self.httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received; shutting down.")
            self.shutdown()

    def shutdown(self):
        self.httpd.server_close()
        self.logger.info("Server has been shut down.")

if __name__ == "__main__":
    # Get the directory of the current script (i.e., backend/)
    current_dir = os.path.dirname(os.path.abspath(__file__))

    # Go up one level to the project root
    parent_dir = os.path.dirname(current_dir)

    # Construct the path to uav_main.py in the onboard/ folder
    SCRIPT_FILENAME = "uav_main.py"
    SCRIPT_PATH = os.path.join(parent_dir, "onboard", SCRIPT_FILENAME)

    # Start the update server
    server = UpdateServer(port=8080, script_name=SCRIPT_PATH)
    server.start()
