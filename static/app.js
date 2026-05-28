// ── Theme toggle ──────────────────────────────────────────────────────────
(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').textContent = saved === 'dark' ? '🌙' : '☀️';
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('themeToggle').textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('theme', next);
}

// ── Tab switching ──────────────────────────────────────────────────────────
const TAB_INPUTS = { dns: 'host', email: 'emailDomain', whois: 'whoisQuery', propagation: 'propHost', traceroute: 'trHost' };

function switchTab(name) {
  // Grab current value from whichever tab is active
  const activeTab = document.querySelector('.tab-btn.active');
  const currentTabName = activeTab ? activeTab.getAttribute('data-tab') : null;
  const currentVal = currentTabName ? (document.getElementById(TAB_INPUTS[currentTabName])?.value.trim() || '') : '';

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + name);
  });

  // Carry value to destination input
  if (currentVal) {
    const destInput = document.getElementById(TAB_INPUTS[name]);
    if (destInput && !destInput.value) destInput.value = currentVal;
  }
}

// ── Nameserver providers ───────────────────────────────────────────────────
const NS_MAP = {
  global:        '',
  google_p:      '8.8.8.8',
  google_s:      '8.8.4.4',
  cloudflare_p:  '1.1.1.1',
  cloudflare_s:  '1.0.0.1',
  opendns_p:     '208.67.222.222',
  opendns_s:     '208.67.220.220',
  quad9_p:       '9.9.9.9',
  quad9_s:       '149.112.112.112',
  yandex_p:      '77.88.8.8',
  yandex_s:      '77.88.8.1',
  custom:        null,
};

function onProviderChange(selectId, customId) {
  const sel = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  custom.style.display = sel.value === 'custom' ? 'block' : 'none';
}

function getNameserver(selectId, customId) {
  const val = document.getElementById(selectId).value;
  if (val === 'custom') return document.getElementById(customId).value.trim();
  return NS_MAP[val] || '';
}


const TYPES = ['A','AAAA','MX','TXT','CNAME','NS','SOA','PTR','SRV','CAA','ANY'];
let activeType = 'A';

const grid = document.getElementById('typeGrid');
TYPES.forEach(t => {
  const el = document.createElement('div');
  el.className = 'type-chip' + (t === 'A' ? ' active' : '');
  el.textContent = t;
  el.onclick = () => {
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    activeType = t;
  };
  grid.appendChild(el);
});

function highlight(text) {
  return text
    .replace(/\b(A|AAAA|MX|TXT|CNAME|NS|SOA|PTR|SRV|CAA|ANY|IN)\b/g, '<span class="hl-type">$1</span>')
    .replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '<span class="hl-ip">$1</span>')
    .replace(/\b([0-9a-f:]{7,39})\b/gi, m => m.includes(':') ? `<span class="hl-ip">${m}</span>` : m)
    .replace(/\b(\d+)\s+(IN|A|AAAA)/g, '<span class="hl-ttl">$1</span> $2');
}

async function doLookup() {
  const host = document.getElementById('host').value.trim();
  if (!host) { document.getElementById('host').focus(); return; }

  const card = document.getElementById('outputCard');
  const out = document.getElementById('output');
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const cmdLine = document.getElementById('cmdLine');
  const btn = document.getElementById('lookupBtn');

  card.style.display = 'block';
  out.className = '';
  out.innerHTML = '';
  dot.className = 'dot loading';
  statusText.textContent = 'Querying…';
  cmdLine.innerHTML = '';
  btn.disabled = true;

  try {
    const res = await fetch('/lookup', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        host, type: activeType,
        verbose: document.getElementById('verboseToggle').checked,
        nameserver: getNameserver('nsProvider', 'nsCustom')
      })
    });
    const data = await res.json();
    if (data.error) {
      dot.className = 'dot err';
      statusText.textContent = 'Error';
      out.className = 'error-out';
      out.textContent = data.error;
    } else {
      const lines = data.output.trim();
      dot.className = 'dot ok';
      statusText.textContent = `${activeType} · ${host}`;
      cmdLine.innerHTML = `<span>$</span>${data.command}`;
      if (!lines) {
        out.className = 'no-results';
        out.textContent = '(no records returned)';
      } else if (document.getElementById('autoToggle').checked) {
        out.innerHTML = highlight(lines.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
      } else {
        out.textContent = lines;
      }
    }
  } catch(e) {
    dot.className = 'dot err';
    statusText.textContent = 'Request failed';
    out.className = 'error-out';
    out.textContent = 'Could not reach the API. Is the container running?';
  }
  btn.disabled = false;
}

function copyOutput() {
  navigator.clipboard.writeText(document.getElementById('output').textContent).catch(()=>{});
  const btn = document.querySelector('.copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

document.getElementById('host').addEventListener('keydown', e => { if(e.key==='Enter') doLookup(); });
document.getElementById('emailDomain').addEventListener('keydown', e => { if(e.key==='Enter') doEmailAuth(); });

// ── Raw toggle ─────────────────────────────────────────────────────────────
function toggleRaw(id, btn) {
  const el = document.getElementById(id);
  const show = el.style.display === 'none' || el.style.display === '';
  el.style.display = show ? 'block' : 'none';
  btn.textContent = show ? 'Hide raw' : 'Show raw';
}

// ── API helper ─────────────────────────────────────────────────────────────
async function digQuery(host, type, nameserver) {
  const res = await fetch('/lookup', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ host, type, verbose: false, nameserver })
  });
  return res.json();
}

// Extract the actual TXT record value from dig output
function extractTxtValue(raw, prefix) {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith(';') || line.trim() === '') continue;
    const m = line.match(/"([^"]+)"/g);
    if (m) {
      const joined = m.map(s => s.replace(/"/g,'')).join('');
      if (!prefix || joined.toLowerCase().startsWith(prefix.toLowerCase())) return joined;
    }
  }
  return null;
}

// ── SPF Parsing ────────────────────────────────────────────────────────────
const SPF_MECH_INFO = {
  'ip4':     { label: 'ip4',      cls: 'mech-pass',    desc: 'Authorizes this IPv4 address or CIDR range to send mail.' },
  'ip6':     { label: 'ip6',      cls: 'mech-pass',    desc: 'Authorizes this IPv6 address or CIDR range to send mail.' },
  'a':       { label: 'a',        cls: 'mech-pass',    desc: "Authorizes the domain's A/AAAA records to send mail." },
  'mx':      { label: 'mx',       cls: 'mech-pass',    desc: "Authorizes the domain's MX servers to send mail." },
  'include': { label: 'include',  cls: 'mech-include', desc: 'Delegates to another domain\'s SPF record (recursive lookup).' },
  'exists':  { label: 'exists',   cls: 'mech-neutral', desc: 'Passes if the given domain resolves.' },
  'ptr':     { label: 'ptr',      cls: 'mech-neutral', desc: 'PTR-based check (deprecated, avoid using).' },
  'redirect':{ label: 'redirect', cls: 'mech-modifier',desc: 'Replace this SPF record entirely with the target domain\'s SPF.' },
  'exp':     { label: 'exp',      cls: 'mech-modifier',desc: 'Explanation string to return on failure.' },
  'all':     { label: 'all',      cls: '',             desc: '' },
};

const QUALIFIER_INFO = {
  '+': { cls: 'mech-pass',     label: '+pass',     desc: 'PASS — Authorized to send.' },
  '-': { cls: 'mech-fail',     label: '-fail',     desc: 'FAIL — Not authorized; reject.' },
  '~': { cls: 'mech-softfail', label: '~softfail', desc: 'SOFTFAIL — Suspicious; accept but mark.' },
  '?': { cls: 'mech-neutral',  label: '?neutral',  desc: 'NEUTRAL — No policy stated.' },
};

function parseSpf(record) {
  const parts = record.trim().split(/\s+/);
  const rows = [];
  for (const part of parts) {
    if (part.toLowerCase() === 'v=spf1') {
      rows.push({ mech: 'v=spf1', val: '', desc: 'SPF version identifier — required first token.' });
      continue;
    }
    let qualifier = '+';
    let token = part;
    if (['+','-','~','?'].includes(part[0])) {
      qualifier = part[0];
      token = part.slice(1);
    }
    const [mechName, mechVal] = token.split(':', 2);
    const mLow = mechName.toLowerCase();

    if (mLow === 'all') {
      const q = QUALIFIER_INFO[qualifier] || QUALIFIER_INFO['+'];
      const allDescs = {
        '+': 'Catch-all PASS — any sender passes. Very permissive, not recommended.',
        '-': 'Catch-all FAIL — any sender not matched above is rejected. Strict enforcement.',
        '~': 'Catch-all SOFTFAIL — unmatched senders are accepted but flagged. Typical testing stance.',
        '?': 'Catch-all NEUTRAL — no assertion about unmatched senders.',
      };
      rows.push({ mech: 'all', qualifier, cls: q.cls, label: q.label, val: '', desc: allDescs[qualifier] });
      continue;
    }

    const info = SPF_MECH_INFO[mLow] || { label: mLow, cls: 'mech-neutral', desc: 'Unknown mechanism.' };
    const qInfo = QUALIFIER_INFO[qualifier] || QUALIFIER_INFO['+'];
    const isModifier = mLow === 'redirect' || mLow === 'exp';

    rows.push({
      mech: mLow,
      qualifier: isModifier ? null : qualifier,
      cls: isModifier ? info.cls : (qualifier !== '+' ? qInfo.cls : info.cls),
      label: info.label,
      val: mechVal || '',
      desc: info.desc + (isModifier ? '' : (qualifier !== '+' ? ' ' + qInfo.desc : '')),
    });
  }
  return rows;
}

function renderSpf(record, rawOutput) {
  const section = document.getElementById('spfSection');
  const badge = document.getElementById('spfBadge');
  const tbody = document.getElementById('spfBody');
  const note = document.getElementById('spfNote');
  const rawEl = document.getElementById('spfRaw');

  section.style.display = 'block';
  rawEl.textContent = rawOutput;

  if (!record) {
    badge.className = 'auth-badge badge-missing';
    badge.textContent = 'Not found';
    tbody.innerHTML = `<tr><td colspan="3" style="padding:1rem 1.25rem; color:var(--text-muted); font-family:var(--mono); font-size:0.8rem;">No SPF record found for this domain.</td></tr>`;
    return;
  }

  badge.className = 'auth-badge badge-found';
  badge.textContent = 'Found';

  const rows = parseSpf(record);
  tbody.innerHTML = rows.map(r => {
    const mechCell = r.mech === 'v=spf1'
      ? `<span class="mech-tag mech-include">${r.mech}</span>`
      : `<span class="mech-tag ${r.cls}">${r.label}</span>`;
    const valCell = r.val ? `<span style="color:var(--green)">${esc(r.val)}</span>` : (r.qualifier ? `<span style="color:var(--text-muted)">—</span>` : '');
    return `<tr>
      <td class="td-key">${mechCell}</td>
      <td class="td-val">${valCell}</td>
      <td class="td-desc">${esc(r.desc)}</td>
    </tr>`;
  }).join('');

  // Count includes (RFC 7208 limit is 10 DNS lookups)
  const includeCount = rows.filter(r => ['include','a','mx','exists','ptr','redirect'].includes(r.mech)).length;
  if (includeCount > 8) {
    note.style.display = 'block';
    note.innerHTML = `⚠ ${includeCount} DNS-lookup mechanisms found. RFC 7208 limits SPF to 10 total lookups — exceeding this causes a PermError.`;
  }
}

// ── DMARC Parsing ──────────────────────────────────────────────────────────
const DMARC_TAGS = {
  'v':      { name: 'Version',             desc: v => 'Must be DMARC1.' },
  'p':      { name: 'Policy',              desc: v => ({ none:'Monitor only — no action taken on failing mail.', quarantine:'Move failing mail to spam/junk.', reject:'Reject failing mail outright.' }[v] || v) },
  'sp':     { name: 'Subdomain policy',    desc: v => ({ none:'Subdomains: monitor only.', quarantine:'Subdomains: quarantine failing mail.', reject:'Subdomains: reject failing mail.' }[v] || `Overrides p= for subdomains. Value: ${v}`) },
  'rua':    { name: 'Aggregate reports',   desc: v => `Send aggregate XML reports to: ${v}` },
  'ruf':    { name: 'Forensic reports',    desc: v => `Send failure/forensic reports to: ${v}` },
  'pct':    { name: 'Percentage',          desc: v => `Apply policy to ${v}% of failing messages (default 100).` },
  'adkim':  { name: 'DKIM alignment',      desc: v => v==='s' ? 'Strict — DKIM d= must exactly match From domain.' : 'Relaxed — DKIM d= can be a subdomain of From domain (default).' },
  'aspf':   { name: 'SPF alignment',       desc: v => v==='s' ? 'Strict — SPF envelope-from must exactly match From domain.' : 'Relaxed — SPF domain can be a parent of From domain (default).' },
  'fo':     { name: 'Failure options',     desc: v => {
    const opts = { '0':'Report if both DKIM and SPF fail (default).','1':'Report if either DKIM or SPF fail.','d':'Report if DKIM fails.','s':'Report if SPF fails.' };
    return v.split(':').map(x => opts[x] || x).join(' | ');
  }},
  'rf':     { name: 'Report format',       desc: v => `Failure report format: ${v}` },
  'ri':     { name: 'Report interval',     desc: v => `Request aggregate reports every ${v} seconds (default 86400 = 24h).` },
};

function parseDmarc(record) {
  const pairs = record.split(';').map(s => s.trim()).filter(Boolean);
  return pairs.map(pair => {
    const eq = pair.indexOf('=');
    if (eq === -1) return { tag: pair, val: '', name: pair, desc: '' };
    const tag = pair.slice(0,eq).trim().toLowerCase();
    const val = pair.slice(eq+1).trim();
    const info = DMARC_TAGS[tag];
    return {
      tag,
      val,
      name: info ? info.name : tag,
      desc: info ? info.desc(val) : '',
    };
  });
}

function policyClass(val) {
  return { none:'policy-none', quarantine:'policy-quarantine', reject:'policy-reject' }[val] || 'policy-none';
}

function renderDmarc(record, rawOutput) {
  const section = document.getElementById('dmarcSection');
  const badge = document.getElementById('dmarcBadge');
  const tbody = document.getElementById('dmarcBody');
  const note = document.getElementById('dmarcNote');
  const rawEl = document.getElementById('dmarcRaw');

  section.style.display = 'block';
  rawEl.textContent = rawOutput;

  if (!record) {
    badge.className = 'auth-badge badge-missing';
    badge.textContent = 'Not found';
    tbody.innerHTML = `<tr><td colspan="3" style="padding:1rem 1.25rem; color:var(--text-muted); font-family:var(--mono); font-size:0.8rem;">No DMARC record found at _dmarc.[domain].</td></tr>`;
    return;
  }

  badge.className = 'auth-badge badge-found';
  badge.textContent = 'Found';

  const rows = parseDmarc(record);
  tbody.innerHTML = rows.map(r => {
    let valCell;
    if (r.tag === 'p' || r.tag === 'sp') {
      valCell = `<span class="policy-indicator ${policyClass(r.val)}">${esc(r.val)}</span>`;
    } else {
      valCell = `<span style="color:var(--green); word-break:break-all;">${esc(r.val)}</span>`;
    }
    return `<tr>
      <td class="td-key" style="color:var(--accent)">${esc(r.tag)}</td>
      <td class="td-val">${valCell}<br><span style="font-size:0.7rem;color:var(--text-muted)">${esc(r.name)}</span></td>
      <td class="td-desc">${esc(r.desc)}</td>
    </tr>`;
  }).join('');

  const pRow = rows.find(r => r.tag === 'p');
  if (pRow && pRow.val === 'none') {
    note.style.display = 'block';
    note.innerHTML = `ℹ p=none means DMARC is in monitoring mode only — failing mail is not rejected or quarantined. Move to p=quarantine or p=reject to enforce.`;
  }
  const ruaRow = rows.find(r => r.tag === 'rua');
  if (!ruaRow) {
    note.style.display = 'block';
    note.innerHTML = (note.innerHTML ? note.innerHTML + '<br>' : '') + `⚠ No rua= tag — you will not receive aggregate DMARC reports. Add rua=mailto:... to monitor results.`;
  }
}

// ── Email Auth orchestrator ────────────────────────────────────────────────
async function doEmailAuth() {
  const domain = document.getElementById('emailDomain').value.trim();
  if (!domain) { document.getElementById('emailDomain').focus(); return; }
  const ns = getNameserver('emailNsProvider', 'emailNsCustom');
  const btn = document.getElementById('emailBtn');
  btn.disabled = true;

  // Show sections in loading state
  ['spfSection','dmarcSection'].forEach(id => {
    document.getElementById(id).style.display = 'block';
  });
  document.getElementById('spfBadge').className = 'auth-badge badge-loading';
  document.getElementById('spfBadge').textContent = 'Checking…';
  document.getElementById('dmarcBadge').className = 'auth-badge badge-loading';
  document.getElementById('dmarcBadge').textContent = 'Checking…';
  document.getElementById('spfBody').innerHTML = '';
  document.getElementById('dmarcBody').innerHTML = '';
  document.getElementById('spfNote').style.display = 'none';
  document.getElementById('dmarcNote').style.display = 'none';
  document.getElementById('spfRaw').style.display = 'none';
  document.getElementById('dmarcRaw').style.display = 'none';
  document.querySelectorAll('.raw-toggle').forEach(b => b.textContent = 'Show raw');

  // Fire both queries in parallel
  const [spfData, dmarcData] = await Promise.all([
    digQuery(domain, 'TXT', ns).catch(e => ({ error: e.message })),
    digQuery(`_dmarc.${domain}`, 'TXT', ns).catch(e => ({ error: e.message })),
  ]);

  // SPF — find v=spf1 line
  const spfRaw = spfData.output || spfData.error || '';
  const spfRecord = extractTxtValue(spfRaw, 'v=spf1');
  renderSpf(spfRecord, spfRaw);

  // DMARC — find v=DMARC1 line
  const dmarcRaw = dmarcData.output || dmarcData.error || '';
  const dmarcRecord = extractTxtValue(dmarcRaw, 'v=DMARC1');
  renderDmarc(dmarcRecord, dmarcRaw);

  btn.disabled = false;
}

// ── WHOIS / IP Lookup ─────────────────────────────────────────────────────

document.getElementById('whoisQuery').addEventListener('keydown', e => { if(e.key==='Enter') doWhois(); });

// Human-readable labels for WHOIS domain fields
const DOMAIN_LABELS = {
  domain_name:        'Domain',
  registrar:          'Registrar',
  registrar_url:      'Registrar URL',
  whois_server:       'WHOIS Server',
  referral_url:       'Referral URL',
  updated_date:       'Updated',
  creation_date:      'Created',
  expiration_date:    'Expires',
  name_servers:       'Name Servers',
  status:             'Status',
  emails:             'Contact Email',
  dnssec:             'DNSSEC',
  name:               'Registrant Name',
  org:                'Organization',
  address:            'Address',
  city:               'City',
  state:              'State',
  zipcode:            'ZIP',
  country:            'Country',
};

// Human-readable labels for IP fields
const IP_LABELS = {
  ip:           'IP Address',
  type:         'Type',
  hostname:     'Hostname',
  org:          'Organization',
  asn:          'ASN',
  city:         'City',
  region:       'Region',
  country:      'Country',
  country_code: 'Country Code',
  postal:       'Postal Code',
  latitude:     'Latitude',
  longitude:    'Longitude',
  timezone:     'Timezone',
};

function whoisValClass(key, val) {
  if (['ip','domain_name'].includes(key)) return 'highlight';
  if (key === 'expiration_date') {
    const d = new Date(val);
    const days = (d - Date.now()) / 86400000;
    if (days < 30) return 'red';
    if (days < 90) return 'yellow';
    return 'green';
  }
  if (key === 'creation_date' || key === 'updated_date') return 'green';
  if (key === 'org' || key === 'asn') return 'whois-val';
  return '';
}

function renderWhoisGrid(data, labelMap) {
  const grid = document.getElementById('whoisGrid');
  let html = '';
  for (const [key, label] of Object.entries(labelMap)) {
    const val = data[key];
    if (!val) continue;
    const cls = whoisValClass(key, Array.isArray(val) ? val[0] : val);
    let valHtml;
    if (Array.isArray(val)) {
      valHtml = `<ul>${val.map(v => `<li>${esc(v)}</li>`).join('')}</ul>`;
    } else {
      valHtml = esc(String(val));
    }
    html += `<div class="whois-key">${label}</div><div class="whois-val ${cls}">${valHtml}</div>`;
  }
  // Any extra fields not in our label map
  for (const [key, val] of Object.entries(data)) {
    if (Object.keys(labelMap).includes(key) || key === 'source') continue;
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const valStr = Array.isArray(val) ? val.join(', ') : String(val);
    html += `<div class="whois-key">${esc(label)}</div><div class="whois-val">${esc(valStr)}</div>`;
  }
  grid.innerHTML = html;
}

let lastWhoisData = null;

async function doWhois() {
  const query = document.getElementById('whoisQuery').value.trim();
  if (!query) { document.getElementById('whoisQuery').focus(); return; }

  const result = document.getElementById('whoisResult');
  const badge = document.getElementById('whoisBadge');
  const typeLabel = document.getElementById('whoisTypeLabel');
  const source = document.getElementById('whoisSource');
  const btn = document.getElementById('whoisBtn');

  result.style.display = 'block';
  badge.className = 'auth-badge badge-loading';
  badge.textContent = 'Querying…';
  document.getElementById('whoisGrid').innerHTML = '';
  source.textContent = '';
  btn.disabled = true;
  lastWhoisData = null;

  try {
    const res = await fetch('/whois', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ query })
    });
    const data = await res.json();

    if (data.error) {
      badge.className = 'auth-badge badge-missing';
      badge.textContent = 'Error';
      typeLabel.textContent = 'WHOIS / IP';
      document.getElementById('whoisGrid').innerHTML =
        `<div class="whois-key">Error</div><div class="whois-val red">${esc(data.error)}</div>`;
    } else if (data.type === 'ip') {
      typeLabel.textContent = 'IP Geolocation';
      badge.className = 'auth-badge badge-found';
      badge.textContent = data.data.type || 'IP';
      lastWhoisData = data.data;
      renderWhoisGrid(data.data, IP_LABELS);
      source.textContent = `Data source: ${data.data.source}`;
    } else {
      typeLabel.textContent = 'WHOIS';
      badge.className = 'auth-badge badge-found';
      badge.textContent = 'Domain';
      lastWhoisData = data.data;
      renderWhoisGrid(data.data, DOMAIN_LABELS);
      source.textContent = 'Data source: WHOIS protocol (python-whois)';
    }
  } catch(e) {
    badge.className = 'auth-badge badge-missing';
    badge.textContent = 'Failed';
    document.getElementById('whoisGrid').innerHTML =
      `<div class="whois-key">Error</div><div class="whois-val red">Could not reach the API.</div>`;
  }
  btn.disabled = false;
}

function copyWhois() {
  if (!lastWhoisData) return;
  const text = Object.entries(lastWhoisData)
    .filter(([k]) => k !== 'source')
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
  navigator.clipboard.writeText(text).catch(()=>{});
  const btn = document.querySelector('#whoisResult .copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

// ── Global Propagation ────────────────────────────────────────────────────

document.getElementById('propHost').addEventListener('keydown', e => { if(e.key==='Enter') doPropagation(); });

const RESOLVER_COUNT = 17;

function propCardHtml(r) {
  return `
    <div class="prop-card ${r.match || 'loading'}" id="prop-${r.ip.replace(/\./g,'-').replace(/:/g,'-')}">
      <div class="prop-card-top">
        <span class="prop-flag">${r.flag}</span>
        <span class="prop-label">${esc(r.label)}</span>
        <span class="prop-status-dot ${r.match || 'loading'}"></span>
      </div>
      <div class="prop-location">${esc(r.location)} · ${esc(r.ip)}</div>
      <div class="prop-answer ${r.match || ''}">${esc(r.answer || '…')}</div>
    </div>`;
}

async function doPropagation() {
  const host = document.getElementById('propHost').value.trim();
  if (!host) { document.getElementById('propHost').focus(); return; }
  const type = document.getElementById('propType').value;
  const btn = document.getElementById('propBtn');
  const summary = document.getElementById('propSummary');
  const grid = document.getElementById('propGrid');

  btn.disabled = true;

  // Show loading skeleton
  summary.style.display = 'block';
  grid.style.display = 'grid';
  document.getElementById('propMatchCount').textContent = '…';
  document.getElementById('propTotal').textContent = RESOLVER_COUNT;
  document.getElementById('propConsensus').innerHTML = '';
  document.getElementById('propBar').style.width = '0%';

  // Render placeholder cards
  const placeholders = Array.from({length: RESOLVER_COUNT}, (_, i) =>
    `<div class="prop-card loading">
      <div class="prop-card-top"><span class="prop-flag">🌐</span><span class="prop-label">Checking…</span><span class="prop-status-dot loading"></span></div>
      <div class="prop-location">—</div>
      <div class="prop-answer">querying…</div>
    </div>`
  ).join('');
  grid.innerHTML = placeholders;

  try {
    const res = await fetch('/propagation', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ host, type })
    });
    const data = await res.json();

    if (data.error) {
      grid.innerHTML = `<div style="padding:1rem; font-family:var(--mono); color:var(--red); font-size:0.8rem; grid-column:1/-1">${esc(data.error)}</div>`;
      btn.disabled = false;
      return;
    }

    // Render result cards
    grid.innerHTML = data.results.map(r => propCardHtml(r)).join('');

    // Update summary
    const pct = Math.round((data.match_count / data.total) * 100);
    document.getElementById('propMatchCount').textContent = data.match_count;
    document.getElementById('propTotal').textContent = data.total;
    document.getElementById('propBar').style.width = pct + '%';
    document.getElementById('propBar').style.background =
      pct === 100 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';

    if (data.consensus) {
      document.getElementById('propConsensus').innerHTML =
        `Consensus: <strong>${esc(data.consensus)}</strong>`;
    } else {
      document.getElementById('propConsensus').innerHTML =
        `<span style="color:var(--red)">No consensus — resolvers disagree</span>`;
    }

  } catch(e) {
    grid.innerHTML = `<div style="padding:1rem; font-family:var(--mono); color:var(--red); font-size:0.8rem; grid-column:1/-1">Request failed — is the container running?</div>`;
  }

  btn.disabled = false;
}


// ── Traceroute ────────────────────────────────────────────────────────────
const TR_SID = 'tr-' + Math.random().toString(36).slice(2);
let trEventSource = null;

document.getElementById('trHost').addEventListener('keydown', e => { if(e.key==='Enter') doTraceroute(); });

function highlightTrLine(line) {
  // MTR report header line
  if (line.startsWith('Start:') || line.startsWith('HOST:')) {
    return `<span style="color:var(--text-muted)">${line}</span>`;
  }
  // MTR column header row
  if (line.match(/Loss%.*Snt.*Last.*Avg/)) {
    return `<span style="color:var(--text-dim)">${line}</span>`;
  }
  // MTR hop row: "  1.|-- 192.168.1.1   0.0%  10   1.2  1.5  1.1  2.3  0.3"
  // Highlight IPs in blue, loss % in red if >0, times in green
  return line
    .replace(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g, '<span class="tr-hop-ip">$1</span>')
    .replace(/([1-9]\d*\.\d+%)/g, '<span class="tr-hop-star">$1</span>')  // non-zero loss
    .replace(/\b(0\.0%)/g, '<span class="tr-hop-time">$1</span>')          // zero loss
    .replace(/(\d+\.\d+)(?=\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+)/g, '<span class="tr-hop-time">$1</span>') // timing cols
    .replace(/\?\?\?/g, '<span class="tr-hop-star">???</span>');
}

function doTraceroute() {
  const host = document.getElementById('trHost').value.trim();
  if (!host) { document.getElementById('trHost').focus(); return; }

  // Stop any existing trace
  if (trEventSource) { trEventSource.close(); trEventSource = null; }

  const wrap = document.getElementById('trWrap');
  const output = document.getElementById('trOutput');
  const dot = document.getElementById('trDot');
  const statusText = document.getElementById('trStatusText');
  const startBtn = document.getElementById('trStartBtn');
  const stopBtn = document.getElementById('trStopBtn');

  wrap.style.display = 'block';
  output.style.display = 'block';
  output.innerHTML = '';
  dot.className = 'dot loading';
  statusText.textContent = `MTR to ${host}…`;
  startBtn.disabled = true;
  stopBtn.style.display = 'inline-block';

  const url = `/traceroute?host=${encodeURIComponent(host)}&sid=${TR_SID}`;
  trEventSource = new EventSource(url);

  trEventSource.onmessage = (e) => {
    const line = e.data;
    if (line === '__DONE__') {
      trEventSource.close();
      trEventSource = null;
      dot.className = 'dot ok';
      statusText.textContent = `Complete — ${host}`;
      startBtn.disabled = false;
      stopBtn.style.display = 'none';
      return;
    }
    if (line.startsWith('ERROR:')) {
      output.innerHTML += `<span style="color:var(--red)">${esc(line)}</span>\n`;
      dot.className = 'dot err';
      statusText.textContent = 'Error';
      startBtn.disabled = false;
      stopBtn.style.display = 'none';
      trEventSource.close();
      trEventSource = null;
      return;
    }
    output.innerHTML += highlightTrLine(esc(line)) + '\n';
    output.scrollTop = output.scrollHeight;
  };

  trEventSource.onerror = () => {
    if (trEventSource) {
      trEventSource.close();
      trEventSource = null;
    }
    dot.className = 'dot err';
    statusText.textContent = 'Connection lost';
    startBtn.disabled = false;
    stopBtn.style.display = 'none';
  };
}

async function stopTraceroute() {
  if (trEventSource) { trEventSource.close(); trEventSource = null; }
  await fetch('/traceroute/stop', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ sid: TR_SID })
  });
  const dot = document.getElementById('trDot');
  const statusText = document.getElementById('trStatusText');
  dot.className = 'dot err';
  statusText.textContent = 'Stopped';
  document.getElementById('trStartBtn').disabled = false;
  document.getElementById('trStopBtn').style.display = 'none';
  const output = document.getElementById('trOutput');
  output.innerHTML += `\n<span style="color:var(--yellow)">— trace stopped by user —</span>`;
}

function copyTr() {
  const text = document.getElementById('trOutput').innerText;
  navigator.clipboard.writeText(text).catch(()=>{});
  const btn = document.querySelector('#trWrap .copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
