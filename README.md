# DNS Lookup — Self-Hosted Docker Tool

A self-hosted DNS lookup and email authentication analysis tool, powered by `dig`, Flask, and a dark terminal-style UI. Built for internal MSP/homelab use — deploy alongside existing Docker stacks on any Ubuntu VM.

## Features

**DNS Lookup tab**
- Record types: A, AAAA, MX, TXT, CNAME, NS, SOA, PTR, SRV, CAA, ANY
- Optional custom nameserver (e.g. `8.8.8.8`, `1.1.1.1`, or an internal resolver)
- Verbose toggle — clean answer-only output vs. full `dig` stats and comments
- Syntax highlighting for record types, IPs, and TTLs
- Displays the exact `dig` command used for every query
- One-click copy of raw output

**Email Auth tab (SPF / DMARC)**
- Analyzes SPF and DMARC records in parallel with a single domain lookup
- SPF breakdown — parses every mechanism (`ip4:`, `ip6:`, `include:`, `a`, `mx`, `redirect=`, `all`) with qualifier color-coding and descriptions; warns if approaching the RFC 7208 10-lookup limit
- DMARC breakdown — decodes all tags (`p=`, `sp=`, `rua=`, `ruf=`, `pct=`, `adkim=`, `aspf=`, `fo=`) with human-readable descriptions and a visual policy severity indicator
- "Show raw" toggle on both sections to see the underlying `dig` output
- Flags common misconfigurations (e.g. `p=none` monitoring-only, missing `rua=`)

## File Structure

```
DNSlookup/
├── app.py                  # Flask API backend
├── static/
│   └── index.html          # Frontend UI (must be inside static/ subfolder)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

> ⚠️ **Important:** `index.html` must live inside the `static/` subfolder — not in the project root. The Dockerfile copies `static/` as a directory. If you download or copy files manually, create the `static/` folder first and place `index.html` inside it before running `docker compose up`.
>
> ```bash
> mkdir static
> mv index.html static/
> docker compose up -d --build
> ```

## Quick Start

```bash
# 1. Clone the repo (or copy the DNSlookup folder to your server)
git clone https://github.com/chadmark/MSP-Scripts.git
cd MSP-Scripts/docker/DNSlookup

# 2. Build and start the container
docker compose up -d

# 3. Open in browser
http://<server-ip>:5000
```

## Changing the Host Port

The container always listens internally on port `5000`. Only the left side of the port mapping needs to change:

```yaml
# docker-compose.yml
ports:
  - "8080:5000"   # Change 8080 to any available host port
```

Then restart:
```bash
docker compose down && docker compose up -d
```

## How It Works

The frontend is a single static HTML file served by Flask. All DNS queries go through a `/lookup` API endpoint that shells out to `dig` via Python `subprocess`. No external DNS libraries — just `dnsutils` installed in the container.

- **Verbose off:** `dig +noall +answer +question` — clean records only
- **Verbose on:** `dig +stats +comments` — full output with timing, server info, and flags
- **SPF/DMARC:** fires two parallel `TXT` lookups (`domain` and `_dmarc.domain`), parses the results in the browser

## Updating

To pull in a new version of `index.html` without a full rebuild:

```bash
cp index.html static/
docker compose restart
```

If CSS or layout changes aren't showing after restart, hard-refresh the browser:
- Windows/Linux: `Ctrl + Shift + R`
- macOS: `Cmd + Shift + R`

## Requirements

- Docker + Docker Compose (v2)
- No other dependencies — everything is self-contained in the image

## Security Note

Intended for internal/homelab use only. The `/lookup` endpoint runs `dig` via subprocess — do not expose this to the public internet without adding authentication in front of it (e.g. Nginx basic auth or a VPN requirement).

---

*Markley Technologies — MSP Scripts · docker/DNSlookup*
