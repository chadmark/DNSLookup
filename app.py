# =============================================================================
# DNS Lookup Tool — Flask Backend
# =============================================================================
# Author      : Markley Technologies
# Last Edit   : 05-27-2026
# GitHub      : https://github.com/chadmark/DNSLookup
# Environment : Docker (python:3.12-slim + dnsutils)
# Requires    : Flask 3.0.3, python-whois, requests, dnsutils (dig)
# Version     : 2.0
#
# Changelog:
#   2.0 - 05-27-2026 - Major release; added WHOIS/IP tab, domain WHOIS via python-whois, IP geolocation with fallback chain, tab nav fix
#   1.3 - 05-27-2026 - Added favicon.ico route
#   1.0 - 05-27-2026 - Initial release
# =============================================================================

from flask import Flask, request, jsonify, send_from_directory
import subprocess
import requests
import whois
import ipaddress
import re

app = Flask(__name__, static_folder="static")

ALLOWED_TYPES = {"A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "PTR", "SRV", "CAA", "ANY"}


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory("static", "favicon.ico", mimetype="image/vnd.microsoft.icon")


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
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = result.stdout or result.stderr or "(no output)"
        return jsonify({"output": output, "command": " ".join(cmd)})
    except subprocess.TimeoutExpired:
        return jsonify({"error": "DNS query timed out."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def is_ip(query):
    try:
        ipaddress.ip_address(query)
        return True
    except ValueError:
        return False


def lookup_ip(ip):
    """Try three free IP geolocation APIs in order, return first success."""
    apis = [
        {
            "url": f"https://ipapi.co/{ip}/json/",
            "map": lambda d: {
                "ip": d.get("ip"), "type": "IPv6" if ":" in str(d.get("ip","")) else "IPv4",
                "hostname": d.get("hostname"), "city": d.get("city"),
                "region": d.get("region"), "country": d.get("country_name"),
                "country_code": d.get("country_code"), "postal": d.get("postal"),
                "latitude": d.get("latitude"), "longitude": d.get("longitude"),
                "org": d.get("org"), "asn": d.get("asn"),
                "timezone": d.get("timezone"), "source": "ipapi.co",
            }
        },
        {
            "url": f"http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query,reverse",
            "map": lambda d: {
                "ip": d.get("query"), "type": "IPv6" if ":" in str(d.get("query","")) else "IPv4",
                "hostname": d.get("reverse"), "city": d.get("city"),
                "region": d.get("regionName"), "country": d.get("country"),
                "country_code": d.get("countryCode"), "postal": d.get("zip"),
                "latitude": d.get("lat"), "longitude": d.get("lon"),
                "org": d.get("org") or d.get("isp"), "asn": d.get("as"),
                "timezone": d.get("timezone"), "source": "ip-api.com",
            }
        },
        {
            "url": f"https://ipwho.is/{ip}",
            "map": lambda d: {
                "ip": d.get("ip"), "type": d.get("type"),
                "hostname": None, "city": d.get("city"),
                "region": d.get("region"), "country": d.get("country"),
                "country_code": d.get("country_code"), "postal": d.get("postal"),
                "latitude": d.get("latitude"), "longitude": d.get("longitude"),
                "org": d.get("connection", {}).get("org"),
                "asn": f"AS{d.get('connection', {}).get('asn','')}",
                "timezone": d.get("timezone", {}).get("id"),
                "source": "ipwho.is",
            }
        },
    ]
    for api in apis:
        try:
            r = requests.get(api["url"], timeout=8, headers={"User-Agent": "dns-lookup-tool/1.4"})
            if r.status_code == 200:
                d = r.json()
                # ip-api returns status field
                if "status" in d and d["status"] == "fail":
                    continue
                return api["map"](d)
        except Exception:
            continue
    return None


def serialize_whois(w):
    """Convert python-whois result to a JSON-safe dict."""
    out = {}
    skip = {"text"}  # raw text — too noisy
    for k, v in w.items() if hasattr(w, "items") else vars(w).items():
        if k.startswith("_") or k in skip:
            continue
        if v is None:
            continue
        if isinstance(v, list):
            # Deduplicate, stringify dates
            seen = []
            for item in v:
                s = str(item) if not isinstance(item, str) else item
                if s not in seen:
                    seen.append(s)
            out[k] = seen if len(seen) > 1 else seen[0] if seen else None
        else:
            out[k] = str(v) if not isinstance(v, str) else v
    return {k: v for k, v in out.items() if v}


@app.route("/whois", methods=["POST"])
def whois_lookup():
    data = request.get_json()
    query = data.get("query", "").strip()

    if not query:
        return jsonify({"error": "No query provided."}), 400

    # Basic sanitization
    if not re.match(r'^[a-zA-Z0-9.\-:_/]+$', query):
        return jsonify({"error": "Invalid characters in query."}), 400

    if is_ip(query):
        result = lookup_ip(query)
        if not result:
            return jsonify({"error": "IP lookup failed — all services unavailable."}), 502
        return jsonify({"type": "ip", "data": result})
    else:
        try:
            w = whois.whois(query)
            if not w or not w.get("domain_name"):
                return jsonify({"error": f"No WHOIS data found for '{query}'."}), 404
            return jsonify({"type": "domain", "data": serialize_whois(w)})
        except Exception as e:
            return jsonify({"error": f"WHOIS lookup failed: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
