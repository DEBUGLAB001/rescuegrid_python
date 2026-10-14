"""RescueGrid Flask Application.

Serves the control room operations dashboard and REST API.
"""

import os
import hashlib
import time
from flask import Flask, render_template, jsonify, make_response, request
from rescuegrid.service import get_service

app = Flask(__name__, template_folder="templates", static_folder="static")

# Middleware to support preview proxy prefix (e.g. /runtime/<id>/preview/...)
class ProxyPrefixMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path_info = environ.get("PATH_INFO", "")
        # If path starts with /runtime/<something>/preview
        if "/preview/" in path_info:
            parts = path_info.split("/preview", 1)
            if len(parts) > 1:
                environ["PATH_INFO"] = parts[1] or "/"
        elif path_info.endswith("/preview"):
            environ["PATH_INFO"] = "/"
        return self.wsgi_app(environ, start_response)

app.wsgi_app = ProxyPrefixMiddleware(app.wsgi_app)


def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.after_request
def apply_caching_controls(response):
    return add_no_cache_headers(response)


def compute_asset_hash() -> str:
    """Compute combined hash of frontend templates and static assets."""
    hasher = hashlib.md5()
    watch_files = [
        os.path.join("templates", "index.html"),
        os.path.join("static", "styles.css"),
        os.path.join("static", "app.js")
    ]
    for filepath in watch_files:
        if os.path.exists(filepath):
            try:
                mtime = os.path.getmtime(filepath)
                hasher.update(f"{filepath}:{mtime}".encode("utf-8"))
                with open(filepath, "rb") as f:
                    hasher.update(f.read())
            except Exception:
                pass
    return hasher.hexdigest()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/state", methods=["GET"])
def get_state():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return jsonify(state)


@app.route("/api/recompute", methods=["POST"])
def recompute_state():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return jsonify(state)


@app.route("/api/version", methods=["GET"])
def get_version():
    """Returns version hash of templates and static assets to trigger hot reload."""
    asset_hash = compute_asset_hash()
    return jsonify({
        "asset_version": asset_hash,
        "timestamp": int(time.time())
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
