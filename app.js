/* ─────────────────────────────────────────────
   CHFM Tender Pricing Tool — app.js
   ───────────────────────────────────────────── */

'use strict';

// ── State ──────────────────────────────────────
let parsedItems = [];
let pricedItems  = [];
let currentStep  = 1;
let appMode      = 'demo'; // 'demo' | 'live'

// ── Demo SOR database ──────────────────────────
// Realistic NatFed 8 SOR codes, descriptions and 2024 base rates.
// Keyword arrays drive fuzzy matching against tender descriptions.
const DEMO_SOR = [
  // Drainage
  { code: 'D.110', desc: 'Excavate trench, max depth 1.0m',               unit: 'm3',  rate: 48.50,  keys: ['excavat','trench','dig','footpath','main line','connect pipework'] },
  { code: 'D.120', desc: 'Excavate trench, max depth 1.5m',               unit: 'm3',  rate: 62.00,  keys: ['1200mm','1.2m','depth 1.2','invert 1200'] },
  { code: 'D.211', desc: 'Lay 75mm UPVC drainage pipe',                   unit: 'm',   rate: 24.80,  keys: ['75mm','ducting','flexible ducting','install pipe','lay pipe'] },
  { code: 'D.212', desc: 'Lay 100mm UPVC drainage pipe',                  unit: 'm',   rate: 29.50,  keys: ['100mm','pipe footpath','install 100','100 mm diameter'] },
  { code: 'D.310', desc: 'Connect to existing drain, depth ≤1.2m',        unit: 'Nr',  rate: 185.00, keys: ['connect','main line','existing drain','connection','drain connect'] },
  { code: 'D.410', desc: 'Preformed plastic silt trap, depth ≤0.6m',      unit: 'Nr',  rate: 320.00, keys: ['silt trap','silt','trap','plastic trap','preformed'] },
  { code: 'D.420', desc: 'Non-return valve, 75–100mm pipework',           unit: 'Nr',  rate: 145.00, keys: ['non-return','non return','valve','check valve'] },
  { code: 'D.510', desc: 'Core through wall/floor and seal, 75mm dia.',   unit: 'Nr',  rate: 95.00,  keys: ['core','coring','re-seal','seal around','penetrat','bore'] },
  { code: 'D.520', desc: 'Backfill trench with excavated material',       unit: 'm3',  rate: 18.50,  keys: ['backfill','reinstat','fill trench'] },
  { code: 'D.530', desc: 'Dispose of excavated material off site',        unit: 'm3',  rate: 38.00,  keys: ['dispos','disposal','off site','waste','arising'] },

  // Groundworks / filling
  { code: 'E.110', desc: 'Fill with 6–10mm gravel/hardcore, depth ≤200mm', unit: 'm2', rate: 14.20, keys: ['grit','gravel','hardcore','6-10mm','level solum','solum level','fill','200mm'] },
  { code: 'E.120', desc: 'Remove and dispose of contaminated fill',       unit: 't',   rate: 52.00,  keys: ['clean out','silt','mud','insulation residual','clear','contaminated','clean solum'] },

  // Concrete
  { code: 'C.310', desc: 'In-situ concrete, Class C, 150mm thick',       unit: 'm2',  rate: 68.50,  keys: ['concrete','class c','150mm','in-situ','slab','floor','false floor'] },
  { code: 'C.320', desc: 'A393 / A343 mesh reinforcement',               unit: 'm2',  rate: 12.80,  keys: ['mesh','reinforcement','a343','a393','steel mesh','rebar'] },
  { code: 'C.311', desc: 'Waterproof membrane, 1200 gauge + 200mm lap',  unit: 'm2',  rate: 9.50,   keys: ['membrane','waterproof','damp proof','overlap','lap up wall'] },

  // Specialist / attenuation
  { code: 'Z.110', desc: 'Supply & install attenuation unit to solum',   unit: 'm2',  rate: 95.00,  keys: ['attenuat','crate','storage unit','solum unit','terram'] },
  { code: 'Z.120', desc: 'Terram geotextile wrapping to drainage unit',  unit: 'm2',  rate: 11.50,  keys: ['terram','geotextile','wrap','fabric','wrapped in'] },

  // Plumbing
  { code: 'P.110', desc: 'Pump water from excavation, day rate',         unit: 'Days',rate: 185.00, keys: ['pump','pumping','remove water','dewater','drain water','remove water from'] },
  { code: 'P.220', desc: 'Isolate and protect existing services',        unit: 'Sum', rate: 280.00, keys: ['services','cable','electric','existing service','protect service','temporary remov','divert','service provider'] },

  // Joinery
  { code: 'J.110', desc: 'Remove and reinstate existing floorboards',    unit: 'Sum', rate: 420.00, keys: ['floorboard','floor board','joist','timber floor','reinstate floor','re-use','existing floor'] },
  { code: 'J.120', desc: 'Floor coverings — temporary removal/replace',  unit: 'm2',  rate: 22.00,  keys: ['floor covering','vinyl','carpet','covering','floor cover'] },

  // Preliminaries
  { code: 'A.110', desc: 'Welfare facilities provision',                  unit: 'Sum', rate: 350.00, keys: ['welfare','toilet','facilities','site cabin','welfare facilit'] },
  { code: 'A.120', desc: 'Making good & reinstate site on completion',   unit: 'Sum', rate: 480.00, keys: ['making good','reinstat','pavings','ground','grass','beds','completion','tidy','clear site'] },
  { code: 'A.130', desc: 'Maintain site access throughout works',        unit: 'Sum', rate: 120.00, keys: ['maintain access','access','both properties','continuity of access'] },
  { code: 'A.140', desc: 'Temporary works: support of services',         unit: 'Sum', rate: 220.00, keys: ['temporary support','support service','support of service','temp support'] },
  { code: 'A.150', desc: 'Site demobilisation and remobilisation',       unit: 'Sum', rate: 650.00, keys: ['withdraw','remobilise','3 weeks','between phase','demobil','stand down'] },
];

// ── Demo matching engine ───────────────────────
function demoMatch(item) {
  const text = (item.ref + ' ' + item.desc + ' ' + item.unit).toLowerCase();

  let best = null, bestScore = -1;
  for (const sor of DEMO_SOR) {
    let score = 0;
    for (const kw of sor.keys) {
      if (text.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > bestScore) { bestScore = score; best = sor; }
  }

  const declaredUnit = item.unit.trim();
  const sorUnit      = best ? best.unit : 'Sum';
  const resolvedUnit = (declaredUnit && declaredUnit !== 'Sum') ? declaredUnit : sorUnit;

  const confidence = best && bestScore > 0
    ? Math.min(97, Math.round(48 + bestScore * 2.8))
    : 32;

  return {
    sorCode:    best ? best.code : 'A.999',
    sorDesc:    best ? best.desc : 'Provisional — manual review required',
    unit:       resolvedUnit,
    baseRate:   best ? best.rate : 150.00,
    confidence,
    notes:      bestScore > 10 ? 'Strong keyword match'
              : bestScore > 4  ? 'Partial match — verify SOR code'
              :                  'Low confidence — manual review advised',
  };
}

// ── Mode toggle ────────────────────────────────
function setMode(mode) {
  appMode = mode;
  document.getElementById('btn-demo').classList.toggle('active', mode === 'demo');
  document.getElementById('btn-live').classList.toggle('active', mode === 'live');
  document.getElementById('demo-notice').style.display      = mode === 'demo' ? 'flex' : 'none';
  document.getElementById('live-api-section').style.display = mode === 'live' ? 'block' : 'none';
}

// ── Step navigation ────────────────────────────
function goStep(n) {
  if (n > 1 && parsedItems.length === 0) return;
  if (n === 4 && pricedItems.length === 0) return;

  currentStep = n;
  document.querySelectorAll('.panel').forEach((p, i) => p.classList.toggle('active', i + 1 === n));
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 === n)    s.classList.add('active');
    else if (i + 1 < n) s.classList.add('done');
  });

  if (n === 4 && pricedItems.length > 0) {
    syncAdj(document.getElementById('adj-slider').value);
    renderFinalTable();
    renderSummaryStats();
  }
}

// ── Adjustment sliders ─────────────────────────
function updateAdj() {
  setAdjDisplay('adj-display', parseFloat(document.getElementById('adj-slider').value));
}

function syncAdj(value) {
  const v = parseFloat(value);
  document.getElementById('adj-slider').value   = v;
  document.getElementById('adj-slider-2').value = v;
  setAdjDisplay('adj-display',   v);
  setAdjDisplay('adj-display-2', v);
  if (pricedItems.length > 0) recalcTotals();
}

function setAdjDisplay(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%';
  el.className   = 'adj-badge ' + (v < 0 ? 'neg' : v > 0 ? 'pos' : '');
}

document.addEventListener('DOMContentLoaded', () => {
  const s2 = document.getElementById('adj-slider-2');
  if (s2) s2.addEventListener('input', () => syncAdj(s2.value));
});

// ── API key visibility ─────────────────────────
function toggleApiKeyVis() {
  const inp = document.getElementById('api-key-input');
  const btn = document.getElementById('vis-btn');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
}

// ── Sample tender ──────────────────────────────
function loadSampleTender() {
  document.getElementById('tender-paste').value = [
    'A\tRemove water from solum by means of pumping\tDays\t3',
    'B\tSupply and install 75mm flexible ducting to all services within the solum\tm\t20',
    'C\tLevel solum by means of 6-10mm grit/gravel; maximum depth 200mm\tm2\t70',
    'D\tSupply and install attenuation units wrapped in Terram within solum; 450mm deep x 500mm wide x 1000mm long\tm2\t70',
    'E\tCover with waterproof membrane and overlap up wall by 200mm; fill with Class C concrete with A343 mesh reinforcement; 150mm thick\tm2\t70',
    'F\tSupply and install non-return valve in pipework between silt trap and main line connection\tNr\t1',
    'G\tSupply and install preformed plastic silt trap in footpath; maximum depth to invert 600mm\tNr\t1',
    'H\tConnect new pipework to existing main line; maximum depth to invert 1200mm\tNr\t1',
    'I\tSupply and install 75mm diameter pipe between levels of building; include coring and re-sealing\tm\t1',
    'J\tSupply and install 100mm diameter pipe in footpath; include excavation, disposal and reinstatement\tm\t4',
    'K\tTemporary support of services during excavation and backfilling\tSum\t1',
    'L\tMaking good all site areas upon completion; reinstating pavings, ground and grass as existing\tSum\t1',
  ].join('\n');
}

// ── Parse tender text ──────────────────────────
function parseTender() {
  const raw = document.getElementById('tender-paste').value.trim();
  if (!raw) { alert('Please paste some tender items first.'); return; }

  const lines = raw.split('\n').filter(l => l.trim());
  parsedItems = [];

  for (const line of lines) {
    const parts = line.trim().split(/\t|\s{2,}/);
    if (parts.length < 2) continue;

    const ref = parts[0].trim();
    let desc = '', unit = 'Sum', qty = 1;

    if (parts.length >= 4) {
      desc = parts.slice(1, parts.length - 2).join(' ').trim();
      unit = parts[parts.length - 2].trim();
      qty  = parseFloat(parts[parts.length - 1]) || 1;
    } else if (parts.length === 3) {
      desc = parts[1].trim();
      const last = parts[2].trim();
      if (/^\d+(\.\d+)?$/.test(last)) qty = parseFloat(last);
      else unit = last;
    } else {
      desc = parts.slice(1).join(' ').trim();
    }

    if (ref && desc) {
      parsedItems.push({ ref, desc, unit, qty, sorCode: '', sorDesc: '', baseRate: 0, rate: 0, confidence: 0, notes: '', override: false });
    }
  }

  if (parsedItems.length === 0) {
    alert('No items could be parsed. Each line needs:\nRef  Description  Unit  Quantity\n(separated by tabs or double spaces).');
    return;
  }

  document.getElementById('item-count').textContent = parsedItems.length;
  renderPreviewTable();
  document.getElementById('parsed-preview').classList.remove('hidden');
}

function renderPreviewTable() {
  const wrap = document.getElementById('preview-table-wrap');
  let html = `<table><thead><tr><th>Ref</th><th>Description</th><th>Unit</th><th>Qty</th></tr></thead><tbody>`;
  for (const it of parsedItems) {
    html += `<tr><td style="font-weight:600">${esc(it.ref)}</td><td>${esc(it.desc)}</td><td>${esc(it.unit)}</td><td>${it.qty}</td></tr>`;
  }
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// ── Run matching ───────────────────────────────
async function startMatching() {
  if (parsedItems.length === 0) { alert('No items to match.'); return; }
  if (appMode === 'live') {
    const apiKey = document.getElementById('api-key-input').value.trim();
    if (!apiKey) { alert('Please enter your Anthropic API key, or switch to Demo mode.'); return; }
    await runLiveMatching(apiKey);
  } else {
    await runDemoMatching();
  }
}

// ── Demo matching ──────────────────────────────
async function runDemoMatching() {
  goStep(3);
  const log    = document.getElementById('match-log');
  const status = document.getElementById('match-status');
  log.textContent = '';

  const addLog    = (msg) => { log.textContent += msg + '\n'; log.scrollTop = 9999; };
  const setStatus = (msg, cls) => { status.className = 'status-msg ' + cls; status.innerHTML = msg; };

  const adj = parseFloat(document.getElementById('adj-slider').value);
  setStatus('<span class="dots"><span></span><span></span><span></span></span> Running demo NatFed 8 SOR matching…', 'processing');
  addLog('DEMO MODE — Built-in NatFed 8 SOR lookup table');
  addLog(`Matching ${parsedItems.length} items | Adjustment: ${adj >= 0 ? '+' : ''}${adj}%`);
  addLog('─'.repeat(55));

  pricedItems = [];
  for (let i = 0; i < parsedItems.length; i++) {
    const it = parsedItems[i];
    await delay(110 + Math.random() * 90);

    const match        = demoMatch(it);
    const adjustedRate = parseFloat((match.baseRate * (1 + adj / 100)).toFixed(2));

    pricedItems.push({ ...it, ...match, rate: adjustedRate, override: false });

    addLog(`  ${it.ref}: ${match.sorCode} — £${adjustedRate.toFixed(2)}/${match.unit} (${match.confidence}% conf)`);
    setStatus(`<span class="dots"><span></span><span></span><span></span></span> Matching item ${i + 1} of ${parsedItems.length}…`, 'processing');
  }

  addLog('─'.repeat(55));
  const total = pricedItems.reduce((s, it) => s + it.rate * it.qty, 0);
  addLog(`✓ All ${pricedItems.length} items matched`);
  addLog(`  Tender total: £${total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);

  setStatus('✓ Demo matching complete — review items below, then proceed to export.', 'success');
  renderMatchTable();
  document.getElementById('match-results-wrap').classList.remove('hidden');
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── Live AI matching ───────────────────────────
async function runLiveMatching(apiKey) {
  goStep(3);
  const log    = document.getElementById('match-log');
  const status = document.getElementById('match-status');
  log.textContent = '';

  const addLog    = (msg) => { log.textContent += msg + '\n'; log.scrollTop = 9999; };
  const setStatus = (msg, cls) => { status.className = 'status-msg ' + cls; status.innerHTML = msg; };

  const adj          = parseFloat(document.getElementById('adj-slider').value);
  const region       = document.getElementById('region-select').value;
  const contractType = document.getElementById('contract-type').value;

  setStatus('<span class="dots"><span></span><span></span><span></span></span> Sending items to Claude for NatFed 8 SOR matching…', 'processing');
  addLog('LIVE MODE — Claude API (claude-sonnet-4-20250514)');
  addLog(`Region: ${region} | Contract: ${contractType} | Adj: ${adj >= 0 ? '+' : ''}${adj}%`);
  addLog('─'.repeat(55));

  const itemsText = parsedItems
    .map((it, i) => `${i + 1}. Ref:${it.ref} | Description: "${it.desc}" | Unit: ${it.unit} | Qty: ${it.qty}`)
    .join('\n');

  try {
    addLog('→ Sending request…');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(itemsText, adj, region, contractType) }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw  = (data.content[0]?.text || '').trim();
    addLog('← Response received, parsing…');

    let results;
    try {
      results = JSON.parse(raw.replace(/^```(?:json)?|```$/gm, '').trim());
    } catch (e) {
      throw new Error('Could not parse AI response as JSON.\n' + raw.substring(0, 400));
    }

    if (!Array.isArray(results)) throw new Error('AI response was not a JSON array.');

    pricedItems = parsedItems.map((it, i) => {
      const m = results.find(r => r.index === i + 1 || r.ref === it.ref) || {};
      addLog(`  ${it.ref}: ${m.sorCode || 'UNMATCHED'} — £${(m.adjustedRate || 0).toFixed(2)}/${m.unit || it.unit} (${m.confidence || 0}%)`);
      return {
        ...it,
        sorCode:    m.sorCode     || 'UNMATCHED',
        sorDesc:    m.sorDesc     || '',
        unit:       m.unit        || it.unit,
        baseRate:   m.baseRate    || 0,
        rate:       m.adjustedRate != null ? parseFloat(m.adjustedRate.toFixed(2)) : 0,
        confidence: m.confidence  || 0,
        notes:      m.notes       || '',
        override:   false,
      };
    });

    setStatus('✓ All items matched successfully.', 'success');
    renderMatchTable();
    document.getElementById('match-results-wrap').classList.remove('hidden');

  } catch (err) {
    addLog('\n✗ Error: ' + err.message);
    setStatus('✗ Live matching failed — see log. Switch to Demo mode to continue.', 'error');
    console.error(err);
  }
}

function buildPrompt(itemsText, adj, region, contractType) {
  return `You are a quantity surveyor expert in the NHF/NatFed Schedule of Rates version 8.0 (NatFed 8 SOR), used for housing repairs and maintenance in the UK.

Match each tender line item to the most appropriate NatFed 8 SOR code and provide a realistic rate in GBP.

Context: Region: ${region} | Contract: ${contractType} | Adjustment: ${adj >= 0 ? '+' : ''}${adj}%

NatFed 8 sections: A=Prelims, C=Concrete, D=Drainage/Groundworks, E=Excavation/Fill, J=Joinery, P=Plumbing, Z=Waterproofing

Return a JSON array. Each object: index(int), ref(str), sorCode(str), sorDesc(str≤60), unit(m|m2|m3|Nr|Sum|Days|Hours|t), baseRate(num), adjustedRate(num,2dp), confidence(0-100), notes(str≤80).

Items:
${itemsText}

Return ONLY the raw JSON array starting with [ and ending with ].`;
}

// ── Render tables ──────────────────────────────
function renderMatchTable() {
  const wrap = document.getElementById('match-table-wrap');
  let html = `<table><thead><tr><th>Ref</th><th>Description</th><th>SOR Code</th><th>Unit</th><th>Qty</th><th>Rate £</th><th>Total £</th><th>Conf.</th></tr></thead><tbody>`;
  for (const it of pricedItems) {
    html += `<tr>
      <td style="font-weight:600">${esc(it.ref)}</td>
      <td style="max-width:220px;font-size:11px">${esc(it.desc)}</td>
      <td><span class="sor-badge">${esc(it.sorCode)}</span></td>
      <td>${esc(it.unit)}</td><td>${it.qty}</td>
      <td>£${it.rate.toFixed(2)}</td>
      <td>£${(it.rate * it.qty).toFixed(2)}</td>
      <td><span style="font-size:11px;color:var(--muted)">${it.confidence}%</span>
          <div class="conf-bar"><div class="conf-fill ${confCls(it.confidence)}" style="width:${it.confidence}%"></div></div></td>
    </tr>`;
  }
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function recalcTotals() {
  const adj = parseFloat(document.getElementById('adj-slider').value);
  for (const it of pricedItems) {
    if (!it.override) it.rate = parseFloat((it.baseRate * (1 + adj / 100)).toFixed(2));
  }
  renderFinalTable();
  renderSummaryStats();
}

function renderFinalTable() {
  const wrap = document.getElementById('final-table-wrap');
  if (!wrap) return;
  let total = 0;
  let html  = `<table><thead><tr><th>Ref</th><th>Description</th><th>SOR Code</th><th>SOR Description</th><th>Unit</th><th>Qty</th><th>Rate £</th><th>Total £</th><th>Conf.</th></tr></thead><tbody>`;

  for (let i = 0; i < pricedItems.length; i++) {
    const it        = pricedItems[i];
    const lineTotal = it.rate * it.qty;
    total          += lineTotal;
    html += `<tr>
      <td style="font-weight:600">${esc(it.ref)}</td>
      <td style="font-size:11px;max-width:150px">${esc(it.desc)}</td>
      <td><span class="sor-badge">${esc(it.sorCode)}</span></td>
      <td style="font-size:11px;color:var(--muted);max-width:130px">${esc(it.sorDesc)}</td>
      <td>${esc(it.unit)}</td><td>${it.qty}</td>
      <td>
        <input type="number" class="manual-rate" value="${it.rate.toFixed(2)}" step="0.01" min="0" onchange="overrideRate(${i}, this.value)" />
        ${it.override ? '<span class="override-tag">override</span>' : ''}
      </td>
      <td style="font-weight:600">£${lineTotal.toFixed(2)}</td>
      <td><span style="font-size:11px;color:var(--muted)">${it.confidence}%</span>
          <div class="conf-bar"><div class="conf-fill ${confCls(it.confidence)}" style="width:${it.confidence}%"></div></div></td>
    </tr>`;
  }

  html += `<tr class="total-row">
    <td colspan="7" style="text-align:right;font-weight:600;font-size:13px">TENDER TOTAL</td>
    <td style="font-weight:700;font-size:14px;color:var(--green)">£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    <td></td></tr></tbody></table>`;
  wrap.innerHTML = html;
}

function overrideRate(idx, val) {
  pricedItems[idx].rate = parseFloat(val) || 0;
  pricedItems[idx].override = true;
  renderFinalTable();
  renderSummaryStats();
}

function renderSummaryStats() {
  const el = document.getElementById('summary-stats');
  if (!el) return;
  const total     = pricedItems.reduce((s, it) => s + it.rate * it.qty, 0);
  const matched   = pricedItems.filter(it => it.sorCode !== 'UNMATCHED').length;
  const highConf  = pricedItems.filter(it => it.confidence >= 75).length;
  const overrides = pricedItems.filter(it => it.override).length;
  const modeTag   = `<span class="override-tag" style="font-size:10px;vertical-align:middle;margin-left:4px">${appMode}</span>`;

  el.innerHTML = `
    <div class="stat"><div class="lbl">Tender total ${modeTag}</div>
      <div class="val green">£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
    <div class="stat"><div class="lbl">Items matched</div><div class="val">${matched} / ${pricedItems.length}</div></div>
    <div class="stat"><div class="lbl">High confidence</div><div class="val">${highConf} items</div></div>
    <div class="stat"><div class="lbl">Manual overrides</div><div class="val ${overrides > 0 ? 'red' : ''}">${overrides}</div></div>`;
}

// ── Export ─────────────────────────────────────
function exportCSV() {
  const adj = parseFloat(document.getElementById('adj-slider').value);
  let csv   = 'Ref,Description,SOR Code,SOR Description,Unit,Quantity,Base Rate (£),Adjusted Rate (£),Total (£),Confidence (%),Adj %,Notes,Mode\n';
  for (const it of pricedItems) {
    csv += [
      q(it.ref), q(it.desc), q(it.sorCode), q(it.sorDesc), q(it.unit),
      it.qty, it.baseRate.toFixed(2), it.rate.toFixed(2),
      (it.rate * it.qty).toFixed(2), it.confidence,
      (adj >= 0 ? '+' : '') + adj + '%', q(it.notes || ''), q(appMode),
    ].join(',') + '\n';
  }
  downloadBlob(csv, 'CHFM_Priced_Tender.csv', 'text/csv');
}

function exportText() {
  let txt = 'Ref\tDescription\tSOR Code\tUnit\tQty\tRate £\tTotal £\tConf\tNotes\n';
  for (const it of pricedItems) {
    txt += [it.ref, it.desc, it.sorCode, it.unit, it.qty,
            it.rate.toFixed(2), (it.rate * it.qty).toFixed(2),
            it.confidence + '%', it.notes || ''].join('\t') + '\n';
  }
  copyToClipboard(txt, 'Copied to clipboard — paste into Excel or Word');
}

function exportJSON() {
  const payload = {
    exportedAt: new Date().toISOString(), mode: appMode,
    adjustment: parseFloat(document.getElementById('adj-slider').value),
    region: document.getElementById('region-select').value,
    contractType: document.getElementById('contract-type').value,
    items: pricedItems.map(it => ({
      ref: it.ref, description: it.desc, sorCode: it.sorCode, sorDescription: it.sorDesc,
      unit: it.unit, quantity: it.qty, baseRate: it.baseRate, adjustedRate: it.rate,
      lineTotal: parseFloat((it.rate * it.qty).toFixed(2)),
      confidence: it.confidence, manualOverride: it.override, notes: it.notes,
    })),
    tenderTotal: parseFloat(pricedItems.reduce((s, it) => s + it.rate * it.qty, 0).toFixed(2)),
  };
  downloadBlob(JSON.stringify(payload, null, 2), 'CHFM_Priced_Tender.json', 'application/json');
}

function printView() { window.print(); }

// ── Helpers ────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function q(val) { return `"${String(val ?? '').replace(/"/g, '""')}"`; }
function confCls(c) { return c >= 75 ? '' : c >= 50 ? 'med' : 'low'; }

function downloadBlob(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyToClipboard(text, msg) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => alert(msg))
    .catch(() => { const ta = Object.assign(document.createElement('textarea'), { value: text }); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert(msg); });
}
