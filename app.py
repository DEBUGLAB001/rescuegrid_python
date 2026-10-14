"""RescueGrid Flask Application.

Serves the control room operations dashboard and REST API.
Renders server-side Jinja2 templates and supports live state polling.
"""

import os
import glob
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
    """Compute combined hash of frontend templates, static assets, and backend modules."""
    hasher = hashlib.md5()
    watch_files = [
        os.path.join("static", "styles.css"),
        os.path.join("static", "app.js")
    ]
    # Watch all HTML templates
    watch_files.extend(glob.glob(os.path.join("templates", "*.html")))
    # Also watch all python backend domain modules
    py_files = glob.glob(os.path.join("rescuegrid", "*.py"))
    watch_files.extend(py_files)

    for filepath in sorted(watch_files):
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
@app.route("/map")
def index():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return render_template("map.html", state=state, current_page="map")


@app.route("/incidents")
def incidents_page():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return render_template("incidents.html", state=state, current_page="incidents")


@app.route("/dispatch")
def dispatch_page():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return render_template("dispatch.html", state=state, current_page="dispatch")


@app.route("/facilities")
def facilities_page():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return render_template("facilities.html", state=state, current_page="facilities")


@app.route("/routing")
def routing_page():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return render_template("routing.html", state=state, current_page="routing")


@app.route("/standby")
def standby_page():
    service = get_service()
    state = service.get_full_state()
    state["asset_version"] = compute_asset_hash()
    return render_template("standby.html", state=state, current_page="standby")


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
    """Returns version hash of templates, assets, and backend domain logic."""
    asset_hash = compute_asset_hash()
    return jsonify({
        "asset_version": asset_hash,
        "timestamp": int(time.time())
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
