"""
Local mock API for interactive-map. Serves static files from repo root and
implements /api/maps, /api/maps/:id, /api/maps/:id/markers, /api/image/* so
the map tool works fully offline. Data is stored under .local-dev-data/.
Python 3 stdlib only. Usage: python local-maps-server.py [port]
"""

import base64
import json
import mimetypes
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import unquote, urlparse

# Paths: script lives in tools/interactive-map/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
DATA_DIR = os.path.join(SCRIPT_DIR, ".local-dev-data")

INDEX_KEY = "maps/index.json"
META_PREFIX = "maps/meta/"
MARKERS_PREFIX = "maps/markers/"
IMAGES_PREFIX = "maps/images/"
MARKER_IMAGES_PREFIX = "maps/marker-images/"
MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_MARKER_IMAGE_BYTES = 5 * 1024 * 1024


def _data_path(key):
    """Key like maps/index.json or maps/meta/foo.json -> absolute path under DATA_DIR."""
    return os.path.join(DATA_DIR, key)


def _ensure_dir(path):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)


def _generate_id():
    import random
    import time
    return "map-" + str(int(time.time() * 1000)) + "-" + "".join(
        random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=7)
    )


def get_index():
    p = _data_path(INDEX_KEY)
    if not os.path.isfile(p):
        return []
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def put_index(entries):
    _ensure_dir(_data_path(INDEX_KEY))
    with open(_data_path(INDEX_KEY), "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=0)


def get_json(key):
    p = _data_path(key)
    if not os.path.isfile(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def put_json(key, data):
    p = _data_path(key)
    _ensure_dir(p)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=0)


def meta_key(map_id):
    return META_PREFIX + map_id + ".json"


def markers_key(map_id):
    return MARKERS_PREFIX + map_id + ".json"


def decode_data_url(data_url, max_bytes=MAX_IMAGE_BYTES):
    m = re.match(r"^data:([^;]+);base64,(.+)$", data_url.strip())
    if not m:
        raise ValueError("Invalid data URL")
    content_type = m.group(1).strip()
    b64 = re.sub(r"\s", "", m.group(2))
    raw = base64.b64decode(b64)
    if len(raw) > max_bytes:
        raise ValueError("Image too large (max {} MB)".format(max_bytes // (1024 * 1024)))
    ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "png"
    return raw, content_type, ext


def save_map_image(map_id, data_url):
    raw, content_type, ext = decode_data_url(data_url)
    key = IMAGES_PREFIX + map_id + "." + ext
    p = _data_path(key)
    _ensure_dir(p)
    with open(p, "wb") as f:
        f.write(raw)
    return key


def save_marker_image(map_id, data_url):
    raw, content_type, ext = decode_data_url(data_url, MAX_MARKER_IMAGE_BYTES)
    import random
    import time
    fid = str(int(time.time() * 1000)) + "-" + "".join(
        random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=9)
    )
    key = MARKER_IMAGES_PREFIX + map_id + "/" + fid + "." + ext
    p = _data_path(key)
    _ensure_dir(p)
    with open(p, "wb") as f:
        f.write(raw)
    return key


def read_image(key):
    p = _data_path(key)
    if not os.path.isfile(p):
        return None, None
    with open(p, "rb") as f:
        body = f.read()
    ct = mimetypes.guess_type(p)[0] or "image/png"
    return body, ct


class LocalMapsHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def send_error_json(self, message, status=400):
        self.send_json({"error": message}, status)

    def read_body_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return None
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        path = unquote(urlparse(self.path).path).replace("\\", "/")
        path = path.rstrip("/") or "/"

        # /api/maps
        if path == "/api/maps":
            list_ = get_index()
            return self.send_json(list_)

        # /api/maps/<id>
        m = re.match(r"^/api/maps/([^/]+)$", path)
        if m:
            map_id = m.group(1)
            meta = get_json(meta_key(map_id))
            if not meta:
                return self.send_error_json("Map not found", 404)
            out = {
                "id": meta["id"],
                "name": meta["name"],
                "bounds": meta["bounds"],
                "imageUrl": meta.get("imageUrl") or "/api/image/" + meta.get("imageKey", ""),
            }
            if isinstance(meta.get("mapWidthFeet"), (int, float)) and meta["mapWidthFeet"] > 0:
                out["mapWidthFeet"] = meta["mapWidthFeet"]
            return self.send_json(out)

        # /api/maps/<id>/markers
        m = re.match(r"^/api/maps/([^/]+)/markers$", path)
        if m:
            map_id = m.group(1)
            if not get_json(meta_key(map_id)):
                return self.send_error_json("Map not found", 404)
            markers = get_json(markers_key(map_id))
            return self.send_json(markers if isinstance(markers, list) else [])

        # /api/image/<key> (key may contain slashes)
        if path.startswith("/api/image/"):
            key = path[len("/api/image/"):].lstrip("/")
            if not key:
                self.send_error(404)
                return
            body, content_type = read_image(key)
            if body is None:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(body)
            return

        # Static file
        if path.startswith("/"):
            path = path[1:]
        local = os.path.join(REPO_ROOT, path)
        if not os.path.abspath(local).startswith(REPO_ROOT) or ".." in path:
            self.send_error(404)
            return
        if os.path.isdir(local):
            local = os.path.join(local, "index.html")
        if not os.path.isfile(local):
            self.send_error(404)
            return
        self.send_response(200)
        ct, _ = mimetypes.guess_type(local)
        if ct:
            self.send_header("Content-Type", ct)
        self.end_headers()
        with open(local, "rb") as f:
            self.wfile.write(f.read())

    def do_POST(self):
        path = unquote(urlparse(self.path).path).replace("\\", "/")

        if path != "/api/maps":
            self.send_error(404)
            return

        body = self.read_body_json()
        if not body:
            return self.send_error_json("Invalid JSON body", 400)

        name = (body.get("name") or "").strip()
        if not name:
            return self.send_error_json("name is required", 400)
        bounds = body.get("bounds")
        if not bounds or not isinstance(bounds.get("width"), (int, float)) or not isinstance(bounds.get("height"), (int, float)):
            return self.send_error_json("bounds with width and height is required", 400)
        image_data = body.get("imageData") or ""
        if not isinstance(image_data, str) or not image_data.startswith("data:image/"):
            return self.send_error_json("imageData (data URL) is required", 400)

        map_id = _generate_id()
        try:
            image_key_stored = save_map_image(map_id, image_data)
        except ValueError as e:
            status = 413 if "too large" in str(e) else 400
            return self.send_error_json(str(e), status)

        image_url = "/api/image/" + image_key_stored
        map_width_feet = body.get("mapWidthFeet")
        if isinstance(map_width_feet, (int, float)) and map_width_feet > 0:
            map_width_feet = float(map_width_feet)
        else:
            map_width_feet = None
        meta = {
            "id": map_id,
            "name": name,
            "bounds": {"width": bounds["width"], "height": bounds["height"]},
            "imageKey": image_key_stored,
            "imageUrl": image_url,
        }
        if map_width_feet is not None:
            meta["mapWidthFeet"] = map_width_feet
        put_json(meta_key(map_id), meta)
        put_json(markers_key(map_id), [])
        index = get_index()
        if not any(e.get("id") == map_id for e in index):
            index.append({"id": map_id, "name": name})
        put_index(index)

        resp = {"id": map_id, "name": name, "bounds": meta["bounds"], "imageUrl": image_url}
        if meta.get("mapWidthFeet") is not None:
            resp["mapWidthFeet"] = meta["mapWidthFeet"]
        self.send_json(resp, 201)

    def do_PATCH(self):
        path = unquote(urlparse(self.path).path).replace("\\", "/")

        m = re.match(r"^/api/maps/([^/]+)$", path)
        if not m:
            self.send_error(404)
            return
        map_id = m.group(1)
        meta = get_json(meta_key(map_id))
        if not meta:
            return self.send_error_json("Map not found", 404)

        body = self.read_body_json()
        if body is None:
            return self.send_error_json("Invalid JSON body", 400)

        if "name" in body and isinstance(body["name"], str):
            trimmed = body["name"].strip()
            if trimmed:
                meta["name"] = trimmed
        if "mapWidthFeet" in body:
            v = body["mapWidthFeet"]
            if v is None or v == "":
                meta.pop("mapWidthFeet", None)
            elif isinstance(v, (int, float)) and v > 0:
                meta["mapWidthFeet"] = float(v)

        put_json(meta_key(map_id), meta)
        if meta.get("name"):
            index = get_index()
            for i, e in enumerate(index):
                if e.get("id") == map_id:
                    index[i] = {"id": map_id, "name": meta["name"]}
                    break
            put_index(index)

        out = {
            "id": meta["id"],
            "name": meta["name"],
            "bounds": meta["bounds"],
            "imageUrl": meta.get("imageUrl") or "/api/image/" + meta.get("imageKey", ""),
        }
        if isinstance(meta.get("mapWidthFeet"), (int, float)) and meta["mapWidthFeet"] > 0:
            out["mapWidthFeet"] = meta["mapWidthFeet"]
        self.send_json(out)

    def do_PUT(self):
        path = unquote(urlparse(self.path).path).replace("\\", "/")

        m = re.match(r"^/api/maps/([^/]+)/markers$", path)
        if not m:
            self.send_error(404)
            return

        map_id = m.group(1)
        if not get_json(meta_key(map_id)):
            return self.send_error_json("Map not found", 404)

        body = self.read_body_json()
        if body is None:
            return self.send_error_json("Invalid JSON body", 400)
        markers = body.get("markers")
        if not isinstance(markers, list):
            markers = []

        for i, m in enumerate(markers):
            if not isinstance(m, dict):
                continue
            image_data = m.get("imageData")
            if isinstance(image_data, str) and image_data.startswith("data:image/"):
                try:
                    key = save_marker_image(map_id, image_data)
                    markers[i] = {k: v for k, v in m.items() if k != "imageData"}
                    markers[i]["imageUrl"] = "/api/image/" + key
                except ValueError as e:
                    return self.send_error_json(str(e) or "Failed to upload marker image", 400)

        put_json(markers_key(map_id), markers)
        self.send_json(markers)

    def do_DELETE(self):
        path = unquote(urlparse(self.path).path).replace("\\", "/")

        m = re.match(r"^/api/maps/([^/]+)$", path)
        if not m:
            self.send_error(404)
            return

        map_id = m.group(1)
        meta = get_json(meta_key(map_id))
        if not meta:
            return self.send_error_json("Map not found", 404)

        def delete_key(key):
            p = _data_path(key)
            if os.path.isfile(p):
                os.remove(p)

        delete_key(meta_key(map_id))
        delete_key(markers_key(map_id))
        if meta.get("imageKey"):
            delete_key(meta["imageKey"])
        marker_images_dir = _data_path(MARKER_IMAGES_PREFIX + map_id)
        if os.path.isdir(marker_images_dir):
            for f in os.listdir(marker_images_dir):
                delete_key(MARKER_IMAGES_PREFIX + map_id + "/" + f)

        index = get_index()
        index = [e for e in index if e.get("id") != map_id]
        put_index(index)

        self.send_json({"deleted": map_id})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = HTTPServer(("", port), LocalMapsHandler)
    print("Interactive Map local server at http://localhost:{}/".format(port))
    print("Open: http://localhost:{}/tools/interactive-map/".format(port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()


if __name__ == "__main__":
    main()
