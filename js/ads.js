// ---------------------------------------------------------------------------
// ads.js — Google Ads reporting (full insight). Per-client OAuth connection,
// then GAQL-synced account/campaign/keyword/search-term performance plus
// Google's own optimization recommendations. Account-scoped (no site selector).
// Live data needs app_secrets.google_ads_developer_token (Google-approved).
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoAdsStatus, seoAdsConnect, seoAdsCustomers, seoAdsSelectCustomer, seoAdsSync, seoAdsSyncNegatives, seoAdsDisconnect, seoAdsNgrams, seoAdsAddNegative, seoAdsAudit, seoAdsDismissAlert } from './store.js';
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
  const syncNegs = async () => {
    setBusy('negs'); setErr(''); setBanner('');
    try {
      const r = await seoAdsSyncNegatives();
      setBanner(r.attempted ? `Pushed ${num(r.attempted)} negative keyword${r.attempted === 1 ? '' : 's'} to "${r.listName}" (${num(r.added)} new) — applied to ${num(r.searchCampaigns)} Search campaign${r.searchCampaigns === 1 ? '' : 's'}.` : (r.note || 'Nothing to push.'));
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const dismissAlert = async (id) => {
    try { await seoAdsDismissAlert(id); setSt((s) => ({ ...s, alerts: (s.alerts || []).filter((a) => a.id !== id) })); } catch (e) { setErr(e.message); }
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
        ${(st.negatives_unsynced || 0) > 0 && html`<${Btn} onClick=${syncNegs} disabled=${!!busy}>${busy === 'negs' ? 'Pushing…' : `🚫 Push ${num(st.negatives_unsynced)} negatives`}</${Btn}>`}
        <${Btn} size="sm" onClick=${disconnect} disabled=${!!busy}>Disconnect</${Btn}>
      </div>`}
    </div>
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${inner}
    ${picker && html`<${CustomerPicker} customers=${picker} busy=${busy === 'pick'} onPick=${pick} onClose=${() => setPicker(null)} />`}
  </div>`;

  // --- not connected ---
  if (!st?.connected) {
    return wrap(html`<${Card}><div class="p-6 space-y-3 text-sm">
      <div class="font-semibold text-slate-800">Connect Google Ads</div>
      <p class="text-slate-600">Sign in with the Google account that has access to this client's Google Ads, then pick the ad account. Ops Dash pulls spend, conversions, campaigns, keywords, search terms, and Google's optimization recommendations into one dashboard.</p>
      ${!st?.dev_token_configured && (st?.agency
        ? html`<div class="rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">Your agency's Google Ads connection needs a one-time setup before it can pull data. <button onClick=${() => { location.hash = '/agency'; }} class="font-medium underline hover:text-amber-900">Finish setup in ⚙ Agency settings</button> — you only do this once, then every business just signs in and picks its account.</div>`
        : html`<div class="rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">Your agency is still finishing Google Ads setup. You can connect your account now; reporting turns on once setup is complete.</div>`)}
      <div><${Btn} onClick=${connect} disabled=${!!busy}>${busy === 'connect' ? 'Redirecting…' : 'Connect Google Ads'}</${Btn}></div>
    </div></${Card}>`);
  }

  // --- connected, no customer chosen ---
  if (!st?.customer) {
    return wrap(html`<${Card}><div class="p-6 space-y-3 text-sm">
      <div class="font-semibold text-slate-800">Choose the ad account</div>
      <p class="text-slate-600">Connected as <span class="font-medium">${st.email || 'Google'}</span>. Pick which Google Ads account to report on.</p>
      ${!st?.dev_token_configured && (st?.agency
        ? html`<div class="rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">Before the account list can load, finish the one-time Google Ads setup in <button onClick=${() => { location.hash = '/agency'; }} class="font-medium underline hover:text-amber-900">⚙ Agency settings</button>. Then come back and choose the account.</div>`
        : html`<div class="rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">Your agency is still finishing Google Ads setup — the account list will load once that's done.</div>`)}
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
    ${(st.alerts || []).length > 0 && html`<${AlertsCard} alerts=${st.alerts} admin=${st.admin} onDismiss=${dismissAlert} />`}
    ${!st.last_sync ? html`<${Card}><div class="p-6 text-center text-sm text-slate-500">Account selected. Click <span class="font-medium">↻ Sync</span> to pull the last 30 days.</div></${Card}>`
      : html`
      <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
        ${tiles.map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-[11px] text-slate-400">${k}</div><div class="text-base font-semibold text-slate-800 tabular-nums">${v}</div></div></${Card}>`)}
      </div>
      ${daily.length > 1 && html`<${Card}><div class="p-4"><${TrendChart} daily=${daily} cur=${cur} /></div></${Card}>`}

      <${Card}><div class="p-3">
        <div class="flex gap-1 border-b border-slate-100 mb-2 flex-wrap">
          ${[['campaigns', `Campaigns (${(snaps.campaigns || []).length})`], ['keywords', `Keywords (${(snaps.keywords || []).length})`], ['search_terms', `Search terms (${(snaps.search_terms || []).length})`], ['ngrams', 'N-grams'], ['audit', 'Audit'], ['recommendations', `Recommendations (${(snaps.recommendations || []).length})`]]
            .map(([id, label]) => html`<button onClick=${() => setView(id)} class=${cx('px-3 py-2 text-sm -mb-px border-b-2', view === id ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate-500')}>${label}</button>`)}
        </div>
        ${view === 'campaigns' && html`<${CampaignsTable} rows=${snaps.campaigns || []} cur=${cur} />`}
        ${view === 'keywords' && html`<${KeywordsTable} rows=${snaps.keywords || []} cur=${cur} />`}
        ${view === 'search_terms' && html`<${SearchTermsTable} rows=${snaps.search_terms || []} cur=${cur} />`}
        ${view === 'ngrams' && html`<${NgramsView} cur=${cur} admin=${st.admin} onChange=${load} />`}
        ${view === 'audit' && html`<${AuditView} cur=${cur} />`}
        ${view === 'recommendations' && html`<${RecsTable} rows=${snaps.recommendations || []} />`}
      </div></${Card}>`}
  `);
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

// Open budget/anomaly alerts (written by the daily seo-ads cron; auto-resolve
// when the condition clears, or dismiss here).
function AlertsCard({ alerts, admin, onDismiss }) {
  const sevCls = (s) => (s === 'critical' ? 'bg-rose-50 text-rose-700' : s === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600');
  const sevIcon = (s) => (s === 'critical' ? '🚨' : s === 'warn' ? '⚠️' : 'ℹ️');
  return html`<${Card}><div class="p-4 space-y-2">
    <div class="flex items-center justify-between">
      <div class="font-semibold text-slate-800 text-sm">🔔 Ads alerts</div>
      <span class="text-xs text-slate-400">Checked daily — alerts clear automatically when the condition resolves.</span>
    </div>
    ${alerts.map((a) => html`<div class=${cx('rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-3', sevCls(a.severity))}>
      <div>
        <span class="mr-1">${sevIcon(a.severity)}</span>${a.title}
        <span class="block text-xs opacity-70 mt-0.5">${a.day || ''}${a.detail?.mtd_spend != null ? ` · spent ${money(a.detail.mtd_spend)} vs ${money(a.detail.expected_to_date)} expected to date` : ''}</span>
      </div>
      ${admin && html`<button onClick=${() => onDismiss(a.id)} title="Dismiss" class="opacity-50 hover:opacity-100">✕</button>`}
    </div>`)}
  </div></${Card}>`;
}

// N-gram wasted-spend finder: 1–3-word fragments aggregated across the synced
// search terms — recurring money-burners that no single term makes obvious.
function NgramsView({ cur, admin, onChange }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [wastedOnly, setWastedOnly] = useState(true);
  const [busyGram, setBusyGram] = useState('');
  const [added, setAdded] = useState({});
  const [note, setNote] = useState('');
  useEffect(() => { seoAdsNgrams().then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return html`<div class="p-6 text-center text-sm text-rose-600">${/Unknown action/i.test(err) ? 'The n-gram analyzer is still deploying — check back shortly.' : err}</div>`;
  if (!data) return html`<div class="p-6 text-center text-sm text-slate-400">Crunching n-grams…</div>`;
  if (!data.termCount) return html`<div class="p-6 text-center text-sm text-slate-400">No search-term data yet — run ↻ Sync first.</div>`;
  const rows = (data.grams || []).filter((g) => (wastedOnly ? g.wasted : true));
  const addNeg = async (g) => {
    setBusyGram(g.gram); setNote('');
    try {
      const r = await seoAdsAddNegative(g.gram, 'phrase', `Ads n-gram wasted spend (${money(g.cost, cur)}, ${g.clicks} clicks, 0 conv)`);
      setAdded((m) => ({ ...m, [g.gram]: true }));
      setNote(r.existed ? `"${g.gram}" was already a negative keyword.` : `"${g.gram}" added — ${r.negatives_unsynced} negative${r.negatives_unsynced === 1 ? '' : 's'} ready to push to Google (button in the header).`);
      onChange && onChange();
    } catch (e) { setNote(e.message); } finally { setBusyGram(''); }
  };
  return html`<div>
    <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
      <p class="text-xs text-slate-500 max-w-2xl">Word fragments (1–3 words) aggregated across the top ${num(data.termCount)} search terms by spend. A gram with real spend and <span class="font-medium">zero conversions</span> is wasted money — add it as a negative keyword, then push negatives to Google from the header button.</p>
      <label class="text-xs text-slate-500 flex items-center gap-1.5"><input type="checkbox" checked=${wastedOnly} onChange=${(e) => setWastedOnly(e.target.checked)} /> wasted only</label>
    </div>
    ${note && html`<div class="rounded-lg px-3 py-2 text-xs bg-emerald-50 text-emerald-700 mb-2 flex justify-between"><span>${note}</span><button onClick=${() => setNote('')} class="opacity-60">✕</button></div>`}
    ${rows.length === 0 ? html`<div class="p-6 text-center text-sm text-slate-400">${wastedOnly ? 'No wasted-spend n-grams found. 🎉' : 'No n-gram data.'}</div>` : html`<div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
        <th class="py-1.5 pr-3">N-gram</th><th class="py-1.5 pr-3 text-right">Terms</th><th class="py-1.5 pr-3 text-right">Spend</th>
        <th class="py-1.5 pr-3 text-right">Clicks</th><th class="py-1.5 pr-3 text-right">Conv.</th>${admin && html`<th class="py-1.5"></th>`}</tr></thead>
      <tbody>${rows.map((g) => html`<tr class="border-b border-slate-50">
        <td class="py-1.5 pr-3 text-slate-800 font-medium" title=${(g.examples || []).join('\n')}>${g.gram}${g.wasted && html`<${Pill} cls="bg-amber-100 text-amber-700 ml-2">wasted</${Pill}>`}</td>
        <td class="py-1.5 pr-3 text-right tabular-nums text-slate-500">${num(g.terms)}</td>
        <td class="py-1.5 pr-3 text-right tabular-nums">${money(g.cost, cur)}</td>
        <td class="py-1.5 pr-3 text-right tabular-nums">${num(g.clicks)}</td>
        <td class="py-1.5 pr-3 text-right tabular-nums ${g.wasted ? 'text-amber-600' : ''}">${dec(g.conversions, g.conversions >= 10 ? 0 : 1)}</td>
        ${admin && html`<td class="py-1.5 text-right">
          ${(g.is_negative || added[g.gram]) ? html`<${Pill} cls="bg-emerald-100 text-emerald-700">✓ negative</${Pill}>`
            : html`<${Btn} size="sm" onClick=${() => addNeg(g)} disabled=${busyGram === g.gram}>${busyGram === g.gram ? 'Adding…' : '🚫 Add negative'}</${Btn}>`}
        </td>`}
      </tr>`)}</tbody>
    </table></div>`}
  </div>`;
}

// Account audit checklist v1 — computed from the stored snapshots (no live
// Google calls): budget-limited campaigns, low-QS clusters, wasted search
// terms, campaigns without conversions.
function AuditView({ cur }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { seoAdsAudit().then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return html`<div class="p-6 text-center text-sm text-rose-600">${/Unknown action/i.test(err) ? 'The audit checklist is still deploying — check back shortly.' : err}</div>`;
  if (!data) return html`<div class="p-6 text-center text-sm text-slate-400">Auditing…</div>`;
  const cl = data.checklist || {};
  const CountPill = ({ count, warn }) => html`<${Pill} cls=${count > 0 ? (warn ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700') : 'bg-emerald-100 text-emerald-700'}>${count > 0 ? count : '✓ clear'}</${Pill}>`;
  const Section = ({ title, sub, count, warn, children }) => html`<details class="rounded-lg border border-slate-100">
    <summary class="px-3 py-2.5 text-sm flex items-center justify-between cursor-pointer select-none">
      <span><span class="font-medium text-slate-800">${title}</span><span class="block text-xs text-slate-400">${sub}</span></span>
      <${CountPill} count=${count} warn=${warn} />
    </summary>
    <div class="px-3 pb-3 text-sm">${children}</div>
  </details>`;
  return html`<div class="space-y-2">
    <p class="text-xs text-slate-500">Computed from the last sync${data.synced_at ? ` (${String(data.synced_at).slice(0, 10)})` : ''} — re-sync for fresh numbers.</p>
    <${Section} title="Campaigns limited by budget" sub="Impression share lost because the daily budget ran out" count=${cl.budget_limited?.count || 0}>
      ${!cl.budget_limited?.available ? html`<div class="text-xs text-amber-600">Budget-lost data isn't in this snapshot yet — run ↻ Sync once to capture it.</div>`
        : (cl.budget_limited?.items || []).length === 0 ? html`<div class="text-xs text-slate-400">No enabled campaign is losing meaningful impression share to budget.</div>`
        : (cl.budget_limited.items).map((c) => html`<div class="flex justify-between py-1 border-b border-slate-50"><span class="truncate pr-3">${c.campaign}</span><span class="tabular-nums text-amber-600">${pct(c.budget_lost, 0)} lost</span></div>`)}
    </${Section}>
    <${Section} title="Low Quality Score keywords" sub="QS ≤ 4 — raises your CPCs across the board" count=${cl.low_qs?.count || 0}>
      ${(cl.low_qs?.clusters || []).length === 0 ? html`<div class="text-xs text-slate-400">No low-QS keywords with impressions.</div>`
        : (cl.low_qs.clusters).map((c) => html`<div class="flex justify-between py-1 border-b border-slate-50"><span class="truncate pr-3">${c.group}</span><span class="tabular-nums text-slate-500">${c.keywords} kw · worst QS ${c.worst} · ${money(c.cost, cur)}</span></div>`)}
    </${Section}>
    <${Section} title="Wasted-spend search terms" sub=${`Real spend, zero conversions${cl.wasted_terms?.total_cost ? ` — ${money(cl.wasted_terms.total_cost, cur)} total` : ''}`} count=${cl.wasted_terms?.count || 0}>
      ${(cl.wasted_terms?.items || []).length === 0 ? html`<div class="text-xs text-slate-400">No search term spent ≥ $5 without converting.</div>`
        : (cl.wasted_terms.items).map((t) => html`<div class="flex justify-between py-1 border-b border-slate-50"><span class="truncate pr-3">${t.term}</span><span class="tabular-nums text-slate-500">${money(t.cost, cur)} · ${num(t.clicks)} clicks</span></div>`)}
      <div class="text-xs text-slate-400 mt-2">Mine the N-grams tab for the recurring fragments behind these, then add negatives.</div>
    </${Section}>
    <${Section} title="Campaigns without conversions" sub="≥ 20 clicks and nothing recorded — check conversion tracking" count=${cl.no_conversion?.count || 0} warn=${cl.no_conversion?.tracking_suspect}>
      ${cl.no_conversion?.tracking_suspect && html`<div class="rounded-lg bg-rose-50 text-rose-700 text-xs px-3 py-2 mb-2">No campaign in this account recorded ANY conversion in 30 days — conversion tracking itself may not be set up.</div>`}
      ${(cl.no_conversion?.items || []).length === 0 ? html`<div class="text-xs text-slate-400">Every campaign with meaningful clicks has conversions.</div>`
        : (cl.no_conversion.items).map((c) => html`<div class="flex justify-between py-1 border-b border-slate-50"><span class="truncate pr-3">${c.campaign}</span><span class="tabular-nums text-slate-500">${num(c.clicks)} clicks · ${money(c.cost, cur)}</span></div>`)}
    </${Section}>
  </div>`;
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
