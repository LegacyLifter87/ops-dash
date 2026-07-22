// ---------------------------------------------------------------------------
// ads.js — Google Ads reporting (full insight). Per-client OAuth connection,
// then GAQL-synced account/campaign/keyword/search-term performance plus
// Google's own optimization recommendations. Account-scoped (no site selector).
// Live data needs app_secrets.google_ads_developer_token (Google-approved).
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoAdsStatus, seoAdsConnect, seoAdsCustomers, seoAdsSelectCustomer, seoAdsSync, seoAdsDisconnect, seoAdsSetDevToken, seoAdsClearDevToken } from './store.js';
import { Card, Btn, Select, Modal, Input } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const Pill = ({ children, cls }) => html`<span class=${cx('inline-block px-2 py-0.5 rounded-full text-xs font-medium', cls)}>${children}</span>`;
const num = (n) => Math.round(n || 0).toLocaleString();
const money = (n, cur) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: (n || 0) >= 100 ? 0 : 2 }).format(n || 0);
const pct = (n, d = 1) => (n == null ? '—' : (n * 100).toFixed(d) + '%');
const dec = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d));
const chanLabel = (c) => ({ SEARCH: 'Search', DISPLAY: 'Display', SHOPPING: 'Shopping', VIDEO: 'Video', PERFORMANCE_MAX: 'Perf Max', LOCAL: 'Local', LOCAL_SERVICES: 'Local Services', DISCOVERY: 'Demand Gen' }[c] || c || '—');
const statusCls = (s) => (s === 'ENABLED' ? 'bg-emerald-100 text-emerald-700' : s === 'PAUSED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500');
const recLabel = (t) => String(t || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

export function Ads() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [picker, setPicker] = useState(null); // customer list when choosing
  const [view, setView] = useState('campaigns');

  const load = async () => { try { setSt(await seoAdsStatus()); } catch (e) { setErr(e.message); } };
  useEffect(() => { if (accountId) { setSt(null); setErr(''); load(); } }, [accountId]);

  // OAuth return banner (?ads=connected|error), then strip the param.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const r = p.get('ads');
    if (!r) return;
    setBanner(r === 'connected' ? 'Google Ads connected — now choose which ad account to report on.' : 'Google Ads connection failed or was cancelled.');
    p.delete('ads'); const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }, []);

  const connect = async () => {
    setBusy('connect'); setErr('');
    try { const r = await seoAdsConnect(); if (r.url) location.href = r.url; } catch (e) { setErr(e.message); setBusy(''); }
  };
  const openPicker = async () => {
    setBusy('customers'); setErr('');
    try { const r = await seoAdsCustomers(); setPicker(r.customers || []); } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const pick = async (c) => {
    setBusy('pick'); setErr('');
    try {
      await seoAdsSelectCustomer({ customerId: c.id, name: c.name, currency: c.currency, loginCustomerId: c.login_customer_id });
      setPicker(null); await load(); await sync();
    } catch (e) { setErr(e.message); setBusy(''); }
  };
  const sync = async () => {
    setBusy('sync'); setErr(''); setBanner('');
    try { const r = await seoAdsSync(); setBanner(`Synced — ${num(r.counts?.campaigns)} campaigns, ${num(r.counts?.keywords)} keywords, ${num(r.counts?.search_terms)} search terms.`); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const disconnect = async () => {
    if (!confirm('Disconnect Google Ads for this account? Stored report data is removed.')) return;
    setBusy('disc'); setErr('');
    try { await seoAdsDisconnect(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (st === null && !err) return html`<div class="p-8 text-sm text-slate-400">Loading Google Ads…</div>`;

  const cur = st?.customer?.currency;
  const snaps = st?.snapshots || {};
  const wrap = (inner) => html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Google Ads</h1>
        <p class="text-sm text-slate-500">Live paid-search performance — spend, conversions, keywords, and what people actually searched. Last 30 days.</p>
      </div>
      ${st?.connected && st?.customer && html`<div class="flex items-center gap-2 flex-wrap">
        <${Pill} cls="bg-slate-100 text-slate-600">${st.customer.name || st.customer.id}</${Pill}>
        <${Btn} onClick=${sync} disabled=${!!busy}>${busy === 'sync' ? 'Syncing…' : '↻ Sync'}</${Btn}>
        <${Btn} size="sm" onClick=${disconnect} disabled=${!!busy}>Disconnect</${Btn}>
      </div>`}
    </div>
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${inner}
    ${st?.agency && html`<${DevTokenCard} st=${st} onChange=${load} />`}
    ${picker && html`<${CustomerPicker} customers=${picker} busy=${busy === 'pick'} onPick=${pick} onClose=${() => setPicker(null)} />`}
  </div>`;

  // --- not connected ---
  if (!st?.connected) {
    return wrap(html`<${Card}><div class="p-6 space-y-3 text-sm">
      <div class="font-semibold text-slate-800">Connect Google Ads</div>
      <p class="text-slate-600">Sign in with the Google account that has access to this client's Google Ads, then pick the ad account. Ops Dash pulls spend, conversions, campaigns, keywords, search terms, and Google's optimization recommendations into one dashboard.</p>
      ${!st?.dev_token_configured && html`<div class="rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">
        <span class="font-medium">Developer token not set.</span> The Google Ads API needs a developer token (Basic Access) from your Google Ads Manager account → API Center. You can connect now, but syncing stays disabled until the token is approved and saved. Approval usually takes 1–3 business days.
      </div>`}
      <div><${Btn} onClick=${connect} disabled=${!!busy}>${busy === 'connect' ? 'Redirecting…' : 'Connect Google Ads'}</${Btn}></div>
    </div></${Card}>`);
  }

  // --- connected, no customer chosen ---
  if (!st?.customer) {
    return wrap(html`<${Card}><div class="p-6 space-y-3 text-sm">
      <div class="font-semibold text-slate-800">Choose the ad account</div>
      <p class="text-slate-600">Connected as <span class="font-medium">${st.email || 'Google'}</span>. Pick which Google Ads account to report on.</p>
      ${!st?.dev_token_configured && html`<div class="rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800"><span class="font-medium">Developer token not set yet</span> — listing accounts needs it. Add it, then choose the account.</div>`}
      <div><${Btn} onClick=${openPicker} disabled=${!!busy || !st.dev_token_configured}>${busy === 'customers' ? 'Loading…' : 'Choose account'}</${Btn}></div>
    </div></${Card}>`);
  }

  // --- connected + customer ---
  const s = st.summary || {};
  const daily = snaps.daily || [];
  const tiles = [
    ['Spend', money(s.cost, cur)], ['Conversions', dec(s.conversions, s.conversions >= 10 ? 0 : 1)],
    ['Cost / conv', s.cpa ? money(s.cpa, cur) : '—'], ['Conv. value', money(s.conv_value, cur)],
    ['ROAS', s.roas ? dec(s.roas) + '×' : '—'], ['Clicks', num(s.clicks)],
    ['Impressions', num(s.impressions)], ['CTR', pct(s.ctr)], ['Avg CPC', money(s.avg_cpc, cur)],
  ];

  return wrap(html`
    ${!st.last_sync ? html`<${Card}><div class="p-6 text-center text-sm text-slate-500">Account selected. Click <span class="font-medium">↻ Sync</span> to pull the last 30 days.</div></${Card}>`
      : html`
      <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
        ${tiles.map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-[11px] text-slate-400">${k}</div><div class="text-base font-semibold text-slate-800 tabular-nums">${v}</div></div></${Card}>`)}
      </div>
      ${daily.length > 1 && html`<${Card}><div class="p-4"><${TrendChart} daily=${daily} cur=${cur} /></div></${Card}>`}

      <${Card}><div class="p-3">
        <div class="flex gap-1 border-b border-slate-100 mb-2 flex-wrap">
          ${[['campaigns', `Campaigns (${(snaps.campaigns || []).length})`], ['keywords', `Keywords (${(snaps.keywords || []).length})`], ['search_terms', `Search terms (${(snaps.search_terms || []).length})`], ['recommendations', `Recommendations (${(snaps.recommendations || []).length})`]]
            .map(([id, label]) => html`<button onClick=${() => setView(id)} class=${cx('px-3 py-2 text-sm -mb-px border-b-2', view === id ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate-500')}>${label}</button>`)}
        </div>
        ${view === 'campaigns' && html`<${CampaignsTable} rows=${snaps.campaigns || []} cur=${cur} />`}
        ${view === 'keywords' && html`<${KeywordsTable} rows=${snaps.keywords || []} cur=${cur} />`}
        ${view === 'search_terms' && html`<${SearchTermsTable} rows=${snaps.search_terms || []} cur=${cur} />`}
        ${view === 'recommendations' && html`<${RecsTable} rows=${snaps.recommendations || []} />`}
      </div></${Card}>`}
  `);
}

// Agency-only. The default is ONE shared platform developer token covering every
// connected client (Google's documented multi-user workflow) — this is the opt-in
// override for a reseller who wants their own quota and API-terms accountability.
function DevTokenCard({ st, onChange }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const own = st.dev_token_own;
  const save = async () => {
    setBusy(true); setErr('');
    try { await seoAdsSetDevToken(token.trim(), label.trim()); setToken(''); setLabel(''); setOpen(false); await onChange(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const clear = async () => {
    if (!confirm('Remove this account\'s own developer token and fall back to the platform token?')) return;
    setBusy(true); setErr('');
    try { await seoAdsClearDevToken(); await onChange(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const srcPill = st.dev_token_source === 'account'
    ? html`<${Pill} cls="bg-brand-100 text-brand-700">own token</${Pill}>`
    : st.dev_token_source === 'platform'
      ? html`<${Pill} cls="bg-slate-100 text-slate-600">platform token</${Pill}>`
      : html`<${Pill} cls="bg-amber-100 text-amber-700">none configured</${Pill}>`;
  return html`<${Card}><div class="p-4 space-y-2 text-sm">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="font-medium text-slate-700">Developer token</span>${srcPill}
        ${own && html`<code class="text-xs text-slate-400">${own.masked}${own.label ? ' · ' + own.label : ''}</code>`}
      </div>
      <div class="flex gap-2">
        ${own && html`<${Btn} size="sm" onClick=${clear} disabled=${busy}>Use platform token</${Btn}>`}
        <${Btn} size="sm" onClick=${() => setOpen(!open)}>${open ? 'Cancel' : own ? 'Replace' : 'Use own token'}</${Btn}>
      </div>
    </div>
    <p class="text-xs text-slate-500">One shared platform token covers every client that connects — clients never need their own. Override it here only if this account should bill against its own Google Ads API quota.</p>
    ${open && html`<div class="space-y-2 pt-1">
      <${Input} value=${token} onInput=${setToken} placeholder="Developer token from Google Ads Manager → API Center" />
      <${Input} value=${label} onInput=${setLabel} placeholder="Label (e.g. Acme Agency MCC) — optional" />
      <${Btn} size="sm" onClick=${save} disabled=${busy || token.trim().length < 10}>${busy ? 'Saving…' : 'Save token'}</${Btn}>
    </div>`}
    ${err && html`<div class="text-xs text-rose-600">${err}</div>`}
  </div></${Card}>`;
}

function CustomerPicker({ customers, busy, onPick, onClose }) {
  return html`<${Modal} title="Choose a Google Ads account" onClose=${onClose}>
    <div class="space-y-2 text-sm">
      ${customers.length === 0 ? html`<div class="text-slate-500 py-4 text-center">No ad accounts were accessible with this Google login.</div>`
        : customers.map((c) => html`<button onClick=${() => onPick(c)} disabled=${busy} class="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 flex items-center justify-between gap-2">
          <div><div class="font-medium text-slate-800">${c.name}</div><div class="text-xs text-slate-400">${c.id}${c.login_customer_id ? ' · under manager ' + c.login_customer_id : ''}</div></div>
          <span class="text-xs text-slate-400">${c.currency || ''}</span>
        </button>`)}
    </div>
  </${Modal}>`;
}

function TrendChart({ daily, cur }) {
  const [metric, setMetric] = useState('cost');
  const opts = [['cost', 'Spend'], ['clicks', 'Clicks'], ['conversions', 'Conversions'], ['impressions', 'Impressions']];
  const vals = daily.map((d) => Number(d[metric] || 0));
  const max = Math.max(1, ...vals);
  const W = 720, H = 120, pad = 4;
  const step = daily.length > 1 ? (W - pad * 2) / (daily.length - 1) : 0;
  const pts = vals.map((v, i) => `${pad + i * step},${H - pad - (v / max) * (H - pad * 2)}`).join(' ');
  const total = vals.reduce((a, b) => a + b, 0);
  const fmt = metric === 'cost' ? (v) => money(v, cur) : (v) => num(v);
  return html`<div>
    <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
      <div class="flex gap-1">${opts.map(([id, label]) => html`<button onClick=${() => setMetric(id)} class=${cx('text-xs px-2 py-1 rounded', metric === id ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-100')}>${label}</button>`)}</div>
      <div class="text-xs text-slate-400">30-day total: <span class="font-semibold text-slate-700">${fmt(total)}</span></div>
    </div>
    <svg viewBox=${`0 0 ${W} ${H}`} class="w-full" preserveAspectRatio="none" style="height:120px">
      <polyline fill="none" stroke="#0d9488" stroke-width="2" points=${pts} />
    </svg>
    <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>${daily[0]?.day || ''}</span><span>${daily[daily.length - 1]?.day || ''}</span></div>
  </div>`;
}

function CampaignsTable({ rows, cur }) {
  const sort = useSort('cost', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No campaign data.</div>`;
  return html`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="name" label="Campaign" sort=${sort} /><th class="py-1.5 pr-3">Type</th><th class="py-1.5 pr-3">Status</th>
      <${SortTh} k="cost" label="Spend" sort=${sort} right=${true} /><${SortTh} k="clicks" label="Clicks" sort=${sort} right=${true} />
      <${SortTh} k="ctr" label="CTR" sort=${sort} right=${true} /><${SortTh} k="avg_cpc" label="CPC" sort=${sort} right=${true} />
      <${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /><${SortTh} k="cpa" label="CPA" sort=${sort} right=${true} />
      <${SortTh} k="roas" label="ROAS" sort=${sort} right=${true} /><${SortTh} k="impr_share" label="Impr. share" sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 font-medium text-slate-800 max-w-xs truncate">${r.name}</td>
      <td class="py-1.5 pr-3 text-slate-500">${chanLabel(r.channel)}</td>
      <td class="py-1.5 pr-3"><${Pill} cls=${statusCls(r.status)}>${(r.status || '').toLowerCase()}</${Pill}></td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${money(r.cost, cur)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.clicks)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${pct(r.ctr)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${money(r.avg_cpc, cur)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${dec(r.conversions, r.conversions >= 10 ? 0 : 1)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${r.cpa ? money(r.cpa, cur) : '—'}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${r.roas ? dec(r.roas) + '×' : '—'}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums ${r.impr_share != null && r.impr_share < 0.5 ? 'text-amber-600' : ''}">${pct(r.impr_share, 0)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function KeywordsTable({ rows, cur }) {
  const sort = useSort('cost', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No keyword data (only keyword-targeted campaigns report keywords).</div>`;
  const qCls = (q) => (q == null ? 'text-slate-300' : q >= 7 ? 'text-emerald-600' : q >= 5 ? 'text-amber-600' : 'text-rose-600');
  return html`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="keyword" label="Keyword" sort=${sort} /><th class="py-1.5 pr-3">Match</th><${SortTh} k="quality" label="QS" sort=${sort} right=${true} />
      <${SortTh} k="cost" label="Spend" sort=${sort} right=${true} /><${SortTh} k="clicks" label="Clicks" sort=${sort} right=${true} />
      <${SortTh} k="avg_cpc" label="CPC" sort=${sort} right=${true} /><${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} />
      <${SortTh} k="cpa" label="CPA" sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).slice(0, 300).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 text-slate-800">${r.keyword}<span class="block text-[11px] text-slate-400 truncate">${r.campaign}</span></td>
      <td class="py-1.5 pr-3 text-slate-500 text-xs">${(r.match || '').toLowerCase()}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums font-medium ${qCls(r.quality)}">${r.quality ?? '—'}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${money(r.cost, cur)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.clicks)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${money(r.avg_cpc, cur)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${dec(r.conversions, r.conversions >= 10 ? 0 : 1)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${r.cpa ? money(r.cpa, cur) : '—'}</td>
    </tr>`)}</tbody>
  </table>${rows.length > 300 && html`<div class="text-xs text-slate-400 pt-2">Showing top 300 of ${num(rows.length)}.</div>`}</div>`;
}

function SearchTermsTable({ rows, cur }) {
  const sort = useSort('cost', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No search-term data.</div>`;
  return html`<div class="overflow-x-auto">
    <p class="text-xs text-slate-500 mb-2">The exact queries that triggered your ads — mine these for negative keywords (wasted spend) and new content topics (high-intent terms).</p>
    <table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="term" label="Search term" sort=${sort} /><th class="py-1.5 pr-3">Campaign</th>
      <${SortTh} k="cost" label="Spend" sort=${sort} right=${true} /><${SortTh} k="clicks" label="Clicks" sort=${sort} right=${true} />
      <${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /><${SortTh} k="cpa" label="CPA" sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 text-slate-800">${r.term}</td>
      <td class="py-1.5 pr-3 text-slate-400 text-xs max-w-[12rem] truncate">${r.campaign}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${money(r.cost, cur)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.clicks)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums ${!r.conversions && r.cost > 0 ? 'text-amber-600' : ''}">${dec(r.conversions, r.conversions >= 10 ? 0 : 1)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${r.cpa ? money(r.cpa, cur) : '—'}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function RecsTable({ rows }) {
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No open recommendations from Google right now. 🎉</div>`;
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows) { const k = r.type || 'OTHER'; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  return html`<div class="space-y-2">
    <p class="text-xs text-slate-500">Google's own optimization suggestions for this account, grouped by type. Review and apply the high-value ones directly in Google Ads.</p>
    ${groups.map(([type, count]) => html`<div class="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
      <span class="text-slate-800">${recLabel(type)}</span>
      <${Pill} cls="bg-brand-100 text-brand-700">${count}</${Pill}>
    </div>`)}
  </div>`;
}
