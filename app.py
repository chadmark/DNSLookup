# =============================================================================
# DNS Lookup Tool — Flask Backend
# =============================================================================
# Author      : Markley Technologies
# Last Edit   : 05-27-2026
# GitHub      : https://github.com/chadmark/MSP-Scripts/tree/main/docker/DNSlookup
# Environment : Docker (python:3.12-slim + dnsutils)
# Requires    : Flask 3.0.3, dnsutils (dig)
# Version     : 1.0
#
# Changelog:
#   1.0 - 05-27-2026 - Initial release
# =============================================================================

from flask import Flask, request, jsonify, send_from_directory
import subprocess
import os

app = Flask(__name__, static_folder="static")

ALLOWED_TYPES = {"A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "PTR", "SRV", "CAA", "ANY"}


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/lookup", methods=["POST"])
def lookup():
    data = request.get_json()
    host = data.get("host", "").strip()
    record_type = data.get("type", "A").upper()
    verbose = data.get("verbose", False)
    nameserver = data.get("nameserver", "").strip()

    if not host:
        return jsonify({"error": "No hostname provided."}), 400

    if record_type not in ALLOWED_TYPES:
        return jsonify({"error": f"Record type '{record_type}' is not allowed."}), 400

    # Build dig command
    cmd = ["dig"]
    if nameserver:
        cmd.append(f"@{nameserver}")
    cmd.append(host)
    cmd.append(record_type)

    if not verbose:
        cmd += ["+noall", "+answer", "+question"]
    else:
        cmd += ["+stats", "+comments"]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10
        )
        output = result.stdout or result.stderr or "(no output)"
        return jsonify({"output": output, "command": " ".join(cmd)})
    except subprocess.TimeoutExpired:
        return jsonify({"error": "DNS query timed out."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
