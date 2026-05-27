# =============================================================================
# DNS Lookup Tool — Flask Backend
# =============================================================================
# Author      : Markley Technologies
# Last Edit   : 05-27-2026
# GitHub      : https://github.com/chadmark/DNSLookup
# Environment : Docker (python:3.12-slim + dnsutils)
# Requires    : Flask 3.0.3, python-whois, requests, dnsutils (dig)
# Version     : 2.1
#
# Changelog:
#   2.1 - 05-27-2026 - Added /propagation endpoint; parallel dig across 25 global resolvers via ThreadPoolExecutor
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
from concurrent.futures import ThreadPoolExecutor, as_completed

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


PROPAGATION_RESOLVERS = [
    # North America — US
    {"ip": "8.8.8.8",         "label": "Google",          "location": "United States",        "flag": "🇺🇸"},
    {"ip": "8.8.4.4",         "label": "Google",          "location": "United States",        "flag": "🇺🇸"},
    {"ip": "1.1.1.1",         "label": "Cloudflare",      "location": "United States",        "flag": "🇺🇸"},
    {"ip": "1.0.0.1",         "label": "Cloudflare",      "location": "United States",        "flag": "🇺🇸"},
    {"ip": "208.67.222.222",  "label": "OpenDNS",         "location": "San Francisco, US",    "flag": "🇺🇸"},
    {"ip": "208.67.220.220",  "label": "OpenDNS",         "location": "San Francisco, US",    "flag": "🇺🇸"},
    {"ip": "9.9.9.9",         "label": "Quad9",           "location": "United States",        "flag": "🇺🇸"},
    {"ip": "149.112.112.112", "label": "Quad9",           "location": "United States",        "flag": "🇺🇸"},
    {"ip": "76.76.2.0",       "label": "Alternate DNS",   "location": "United States",        "flag": "🇺🇸"},
    # Europe
    {"ip": "185.228.168.9",   "label": "CleanBrowsing",   "location": "Europe",              "flag": "🇪🇺"},
    {"ip": "185.228.169.9",   "label": "CleanBrowsing",   "location": "Europe",              "flag": "🇪🇺"},
    {"ip": "94.140.14.14",    "label": "AdGuard",         "location": "Europe",              "flag": "🇪🇺"},
    {"ip": "94.140.15.15",    "label": "AdGuard",         "location": "Europe",              "flag": "🇪🇺"},
    # Asia Pacific
    {"ip": "168.95.1.1",      "label": "HiNet",           "location": "Taiwan",              "flag": "🇹🇼"},
    {"ip": "168.95.192.1",    "label": "HiNet",           "location": "Taiwan",              "flag": "🇹🇼"},
    {"ip": "168.126.63.1",    "label": "KT",              "location": "Seoul, South Korea",  "flag": "🇰🇷"},
    # South America
    {"ip": "200.221.11.100",  "label": "Embratel",        "location": "Sao Paulo, Brazil",   "flag": "🇧🇷"},
]


def dig_single(resolver, host, record_type):
    """Run a single dig query against one resolver. Returns a result dict."""
    cmd = ["dig", f"@{resolver['ip']}", host, record_type,
           "+noall", "+answer", "+time=3", "+tries=1"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        raw = result.stdout.strip()
        # Extract answer lines (non-comment, non-empty)
        answers = [
            ln for ln in raw.splitlines()
            if ln.strip() and not ln.startswith(";")
        ]
        # Pull out the data values (last field on each answer line)
        values = list(dict.fromkeys(ln.split()[-1] for ln in answers if ln.split()))
        return {
            **resolver,
            "status": "ok" if values else "nxdomain",
            "values": values,
            "answer": ", ".join(values) if values else "No record",
        }
    except subprocess.TimeoutExpired:
        return {**resolver, "status": "timeout", "values": [], "answer": "Timeout"}
    except Exception as e:
        return {**resolver, "status": "error", "values": [], "answer": str(e)}


@app.route("/propagation", methods=["POST"])
def propagation():
    data = request.get_json()
    host = data.get("host", "").strip()
    record_type = data.get("type", "A").upper()

    if not host:
        return jsonify({"error": "No hostname provided."}), 400
    if record_type not in ALLOWED_TYPES:
        return jsonify({"error": f"Record type '{record_type}' is not allowed."}), 400

    results = []
    with ThreadPoolExecutor(max_workers=25) as executor:
        futures = {
            executor.submit(dig_single, r, host, record_type): r
            for r in PROPAGATION_RESOLVERS
        }
        for future in as_completed(futures):
            results.append(future.result())

    # Sort back to original resolver order
    order = {r["ip"]: i for i, r in enumerate(PROPAGATION_RESOLVERS)}
    results.sort(key=lambda r: order.get(r["ip"], 99))

    # Determine consensus answer (most common non-empty value set)
    value_counts = {}
    for r in results:
        key = "|".join(sorted(r["values"]))
        if key:
            value_counts[key] = value_counts.get(key, 0) + 1
    consensus = max(value_counts, key=value_counts.get) if value_counts else ""

    for r in results:
        key = "|".join(sorted(r["values"]))
        if r["status"] == "timeout":
            r["match"] = "timeout"
        elif r["status"] == "nxdomain" or not r["values"]:
            r["match"] = "nxdomain"
        elif key == consensus:
            r["match"] = "match"
        else:
            r["match"] = "mismatch"

    match_count = sum(1 for r in results if r["match"] == "match")
    return jsonify({
        "results": results,
        "consensus": consensus.replace("|", ", "),
        "match_count": match_count,
        "total": len(results),
    })


@app.route("/debug/resolvers")
def debug_resolvers():
    """Test all resolvers against google.com A and return an HTML report."""
    test_host = "google.com"
    test_type = "A"
    results = []
    with ThreadPoolExecutor(max_workers=25) as executor:
        futures = {executor.submit(dig_single, r, test_host, test_type): r for r in PROPAGATION_RESOLVERS}
        for future in as_completed(futures):
            results.append(future.result())
    order = {r["ip"]: i for i, r in enumerate(PROPAGATION_RESOLVERS)}
    results.sort(key=lambda r: order.get(r["ip"], 99))

    rows = ""
    for r in results:
        color = {"ok": "#3fb950", "timeout": "#e3b341", "nxdomain": "#7d8590", "error": "#f85149"}.get(r["status"], "#7d8590")
        rows += f"""<tr>
            <td>{r['flag']}</td>
            <td><b>{r['label']}</b></td>
            <td>{r['location']}</td>
            <td style="font-family:monospace">{r['ip']}</td>
            <td style="color:{color}; font-weight:700">{r['status'].upper()}</td>
            <td style="font-family:monospace; font-size:0.85em; color:{color}">{r['answer']}</td>
        </tr>"""

    ok = sum(1 for r in results if r["status"] == "ok")
    html = f"""<!DOCTYPE html><html><head><title>Resolver Debug</title>
    <style>
        body {{ font-family: monospace; background: #0d1117; color: #e6edf3; padding: 2rem; }}
        h2 {{ color: #58a6ff; margin-bottom: 0.5rem; }}
        p {{ color: #7d8590; margin-bottom: 1.5rem; font-size: 0.85rem; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th {{ text-align: left; padding: 0.5rem 1rem; color: #7d8590; font-size: 0.75rem;
              text-transform: uppercase; border-bottom: 1px solid #30363d; }}
        td {{ padding: 0.5rem 1rem; border-bottom: 1px solid #21262d; font-size: 0.85rem; }}
        tr:hover td {{ background: #161b22; }}
        .summary {{ color: #3fb950; font-size: 1.1rem; font-weight: bold; margin-bottom: 1rem; }}
    </style></head><body>
    <h2>// DNS Resolver Debug</h2>
    <p>Test query: <b>google.com A</b> — run at {__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
    <div class="summary">{ok} / {len(results)} resolvers responding</div>
    <table>
        <thead><tr><th></th><th>Provider</th><th>Location</th><th>IP</th><th>Status</th><th>Answer</th></tr></thead>
        <tbody>{rows}</tbody>
    </table>
    </body></html>"""
    return html



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
