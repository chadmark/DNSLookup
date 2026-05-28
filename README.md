# DNS Lookup — Self-Hosted Docker Tool

A self-hosted DNS lookup, email authentication analysis, and WHOIS/IP intelligence tool, powered by `dig`, `python-whois`, Flask, and a dark terminal-style UI. Built for internal MSP/homelab use — deploy alongside existing Docker stacks on any Ubuntu VM.

**Current version: 2.2**

## Changelog

**v2.2 — 05-28-2026**
- Added MTR tab — replaces traceroute for more useful hop-by-hop analysis
- Uses `mtr --report-wide` with 10 cycles per hop — shows loss %, last/avg/best/worst/stddev latency per hop
- Per-hop reverse DNS resolution — shows hostname and IP for each hop
- Streaming SSE output — results appear when MTR completes; status message shown while running
- Stop button kills the MTR process mid-run
- Copy to clipboard on results
- Input value carried from other tabs

**v2.1 — 05-27-2026**
- Added Global Propagation tab — parallel dig across 17 verified public resolvers worldwide
- Resolver list: Google, Cloudflare, OpenDNS, Quad9, Alternate DNS, CleanBrowsing, AdGuard, HiNet, KT, Embratel
- Auto-detects consensus answer; color-coded cards (green = match, red = mismatch, yellow = timeout, gray = no record)
- Progress bar shows agreement percentage at a glance
- Added `/debug/resolvers` endpoint — browser-accessible HTML report testing all resolvers against `google.com A`
- Debug link added to footer (opens in new tab)
- Added light/dark mode toggle with `localStorage` persistence (top-right corner)
- Added vertical dividers between tab buttons
- Fixed button text color for light mode compatibility
- Added version number to footer
- Input value carried between tabs — switching tabs populates the destination input with the current value (does not overwrite if already filled)
- Tab switching refactored to use `data-tab` attributes — fixes index-based nav bug
- Fixed recurring `esc()` function declaration bug (stripped during JS block insertions)
- Added `favicon.ico` (blue `dns` text, multi-size: 16/32/48/64/128/256px)

**v2.0 — 05-27-2026**
- **Major release — WHOIS / IP tab added**
- New `/whois` API endpoint — domain WHOIS via `python-whois` (direct protocol, no API key, no rate limits)
- IP geolocation with automatic three-service fallback chain: `ipapi.co` → `ip-api.com` → `ipwho.is`
- Auto-detects input type (domain vs. IP address) — single input field handles both
- Domain results: registrar, creation/updated/expiry dates (color-coded by urgency), name servers, status, DNSSEC, contact
- IP results: organization, ASN, city, region, country, coordinates, timezone, and which API responded
- Expiry date color coding: red < 30 days, yellow < 90 days, green otherwise
- Copy to clipboard on WHOIS results
- Fixed JS syntax error (`esc()` function declaration dropped during merge) that broke all tab navigation and lookups
- Tab switching refactored to use `data-tab` attributes instead of fragile index-based matching
- Added `favicon.ico` (blue `dns` text, multi-size: 16/32/48/64/128/256px)

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

**WHOIS / IP tab**
- Single input field — automatically detects domain vs. IP address
- Domain WHOIS: registrar, dates, name servers, status, DNSSEC, contact info
- Expiry date color-coded: red (< 30 days), yellow (< 90 days), green (healthy)
- IP geolocation: organization, ASN, city, region, country, coordinates, timezone
- Three-service fallback chain for IP lookups — no single point of failure
- Source attribution shown for every IP result
- Copy to clipboard

**Global Propagation tab**
- Queries 17 verified public resolvers across North America, Europe, Asia Pacific, and South America simultaneously
- Color-coded result cards: green = matches consensus, red = different answer, yellow = timed out, gray = no record
- Progress bar shows overall propagation percentage
- Consensus answer displayed — useful for confirming the correct answer after a DNS change
- Supports A, AAAA, MX, TXT, CNAME, NS, SOA, PTR, SRV, CAA record types
- `/debug/resolvers` endpoint — browser-accessible diagnostic page showing resolver health at a glance

---

```
DNSLookup/
├── app.py                  # Flask API backend
├── static/
│   ├── index.html          # Frontend UI (must be inside static/ subfolder)
│   └── favicon.ico         # Browser tab icon
├── Dockerfile
├── docker-compose.yml
└── README.md
```

> ⚠️ **Important:** `index.html` and `favicon.ico` must live inside the `static/` subfolder — not in the project root. The Dockerfile copies `static/` as a directory. If you download or copy files manually, create the `static/` folder first:
>
> ```bash
> mkdir static
> mv index.html favicon.ico static/
> docker compose up -d --build
> ```

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/chadmark/DNSLookup.git
cd DNSLookup

# 2. Build and start the container
docker compose up -d --build

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

The frontend is a single static HTML file served by Flask. Three API endpoints handle all queries:

- **`/lookup`** — shells out to `dig` via Python `subprocess`; no external DNS libraries
  - Verbose off: `dig +noall +answer +question` — clean records only
  - Verbose on: `dig +stats +comments` — full output with timing, server info, and flags
  - Nameserver: selected provider IP passed as `@<ip>`; "Global" uses the container resolver

- **`/whois`** — uses `python-whois` for domain queries (direct WHOIS protocol, no API key); uses `requests` to call free IP geolocation APIs for IP queries with automatic fallback

- **`/favicon.ico`** — serves the favicon from `static/`

---

## Updating

### Full update from GitHub (recommended)

Required when `app.py`, `Dockerfile`, or `docker-compose.yml` have changed:

```bash
cd ~/docker/DNSLookup
git pull
docker compose down
docker compose up -d --build
```

### Frontend-only update (no rebuild)

If only `index.html` or `favicon.ico` changed:

```bash
cd ~/docker/DNSLookup
git pull
docker compose restart
```

Flask serves `static/` directly from the host filesystem — no rebuild needed for frontend-only changes.

### Checking the current version

```bash
docker compose logs dns-lookup | head -20
```

### Browser cache

If changes aren't showing after a restart, hard-refresh:
- Windows/Linux: `Ctrl + Shift + R`
- macOS: `Cmd + Shift + R`

---

## Requirements

- Docker + Docker Compose (v2)
- No other dependencies — everything is self-contained in the image

## Security Note

Intended for internal/homelab use only. The API endpoints shell out to `dig` and make outbound HTTP requests to geolocation services — do not expose this to the public internet without adding authentication in front of it (e.g. Nginx basic auth or VPN requirement).

---

*Markley Technologies · https://github.com/chadmark/DNSLookup*
