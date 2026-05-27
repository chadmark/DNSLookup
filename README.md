# DNS Lookup — Self-Hosted Docker Tool

A self-hosted DNS lookup and email authentication analysis tool, powered by `dig`, Flask, and a dark terminal-style UI. Built for internal MSP/homelab use — deploy alongside existing Docker stacks on any Ubuntu VM.

**Current version: 1.2**

## Changelog

**v1.2 — 05-27-2026**
- Replaced freeform nameserver text input with a provider dropdown on both tabs
- Providers: Google (primary/secondary), Cloudflare, OpenDNS, Quad9, Yandex
- "Global (default)" option uses the container's system resolver with no `@` flag passed to `dig`
- "Custom…" option reveals a free-text input for internal resolvers (Pi-hole, AD DNS, etc.)
- Both tabs share the same provider list and nameserver resolution logic

**v1.1 — 05-27-2026**
- Added Email Auth tab with SPF and DMARC analysis
- SPF breakdown: parses all mechanisms with qualifier color-coding; warns on RFC 7208 10-lookup limit
- DMARC breakdown: decodes all tags with human-readable descriptions and policy severity indicator
- "Show raw" toggle on both SPF and DMARC sections
- Flags common misconfigurations (`p=none`, missing `rua=`)
- Fixed page centering — wrapped layout in `max-width: 720px; margin: 0 auto` container

**v1.0 — 05-27-2026**
- Initial release
- DNS Lookup tab: A, AAAA, MX, TXT, CNAME, NS, SOA, PTR, SRV, CAA, ANY record types
- Verbose toggle, syntax highlighting, copy to clipboard
- Displays exact `dig` command used for every query

---

## Features

**DNS Lookup tab**
- Record types: A, AAAA, MX, TXT, CNAME, NS, SOA, PTR, SRV, CAA, ANY
- Nameserver dropdown — Google, Cloudflare, OpenDNS, Quad9, Yandex (primary and secondary), Global default, or Custom
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

---

## File Structure

```
DNSLookup/
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

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/chadmark/DNSLookup.git
cd DNSLookup

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

---

## How It Works

The frontend is a single static HTML file served by Flask. All DNS queries go through a `/lookup` API endpoint that shells out to `dig` via Python `subprocess`. No external DNS libraries — just `dnsutils` installed in the container.

- **Verbose off:** `dig +noall +answer +question` — clean records only
- **Verbose on:** `dig +stats +comments` — full output with timing, server info, and flags
- **SPF/DMARC:** fires two parallel `TXT` lookups (`domain` and `_dmarc.domain`), parses the results in the browser
- **Nameserver:** selected provider IP is passed as `@<ip>` to `dig`; "Global" passes nothing and uses the container resolver

## Updating

### Full update from GitHub (recommended)

Pulls the latest code and rebuilds the container image from scratch:

```bash
cd ~/docker/DNSLookup
git pull
docker compose down
docker compose up -d --build
```

Use this when `app.py`, `Dockerfile`, or `docker-compose.yml` have changed, or when you're unsure what changed.

### Frontend-only update (no rebuild)

If only `index.html` or `favicon.ico` changed, you can skip the rebuild and just restart:

```bash
cd ~/docker/DNSLookup
git pull
docker compose restart
```

This works because Flask serves `static/` directly from the host filesystem — the container doesn't need to be rebuilt to pick up file changes in that folder.

### Checking the current version

The version is noted at the top of this README and in the `app.py` header. To confirm what's running in the container:

```bash
docker compose logs dns-lookup | head -20
```

### Browser cache

If changes aren't showing after a restart, hard-refresh the browser to clear cached CSS/JS:
- Windows/Linux: `Ctrl + Shift + R`
- macOS: `Cmd + Shift + R`

---

## Requirements

- Docker + Docker Compose (v2)
- No other dependencies — everything is self-contained in the image

## Security Note

Intended for internal/homelab use only. The `/lookup` endpoint runs `dig` via subprocess — do not expose this to the public internet without adding authentication in front of it (e.g. Nginx basic auth or a VPN requirement).

---

*Markley Technologies · https://github.com/chadmark/DNSLookup*
