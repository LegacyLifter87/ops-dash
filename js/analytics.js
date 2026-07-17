// ---------------------------------------------------------------------------
// analytics.js — Google Analytics 4 reporting. Per-client OAuth, then GA4 Data
// API-synced traffic: daily trend, channels, landing pages, top pages, devices,
// and top events. Account-scoped (no site selector). No dev-token gate.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoGaStatus, seoGaConnect, seoGaProperties, seoGaSelectProperty, seoGaSync, seoGaInsights, seoGaDisconnect } from './store.js';
import { Card, Btn, Modal } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const Pill = ({ children, cls }) => html`<span class=${cx('inline-block px-2 py-0.5 rounded-full text-xs font-medium', cls)}>${children}</span>`;
const num = (n) => Math.round(n || 0).toLocaleString();
const pct = (n, d = 1) => (n == null ? '—' : (n * 100).toFixed(d) + '%');
const dur = (sec) => { const s = Math.round(sec || 0); const m = Math.floor(s / 60); return m ? `${m}m ${s % 60}s` : `${s}s`; };
const shortUrl = (u) => { try { const x = new URL(u); return x.pathname + (x.search || ''); } catch { return u || '/'; } };

export function Analytics() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [picker, setPicker] = useState(null);
  const [view, setView] = useState('sources');
  const [aiBusy, setAiBusy] = useState(false);

  const load = async () => { try { setSt(await seoGaStatus()); } catch (e) { setErr(e.message); } };
  useEffect(() => { if (accountId) { setSt(null); setErr(''); load(); } }, [accountId]);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const r = p.get('ga');
    if (!r) return;
    setBanner(r === 'connected' ? 'Google Analytics connected — now choose which GA4 property to report on.' : 'Google Analytics connection failed or was cancelled.');
    p.delete('ga'); const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }, []);

  const connect = async () => { setBusy('connect'); setErr(''); try { const r = await seoGaConnect(); if (r.url) location.href = r.url; } catch (e) { setErr(e.message); setBusy(''); } };
  const openPicker = async () => { setBusy('props'); setErr(''); try { const r = await seoGaProperties(); setPicker(r.properties || []); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const pick = async (p) => {
    setBusy('pick'); setErr('');
    try { await seoGaSelectProperty({ propertyId: p.id, name: p.name }); setPicker(null); await load(); await sync(); }
    catch (e) { setErr(e.message); setBusy(''); }
  };
  const sync = async () => {
    setBusy('sync'); setErr(''); setBanner('');
    try { const r = await seoGaSync(); setBanner(`Synced — ${num(r.summary?.sessions)} sessions across ${num(r.counts?.channels)} channels, ${num(r.counts?.landing_pages)} landing pages.`); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const disconnect = async () => {
    if (!confirm('Disconnect Google Analytics for this account? Stored report data is removed.')) return;
    setBusy('disc'); setErr('');
    try { await seoGaDisconnect(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const genInsights = async () => {
    setAiBusy(true); setErr('');
    try { await seoGaInsights(); await load(); } catch (e) { setErr(e.message); } finally { setAiBusy(false); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (st === null && !err) return html`<div class="p-8 text-sm text-slate-400">Loading Google Analytics…</div>`;

  const snaps = st?.snapshots || {};
  const wrap = (inner) => html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Analytics (GA4)</h1>
        <p class="text-sm text-slate-500">On-site behavior — traffic by channel, top landing pages, conversions, and engagement. Last 30 days.</p>
      </div>
      ${st?.connected && st?.property && html`<div class="flex items-center gap-2 flex-wrap">
        <${Pill} cls="bg-slate-100 text-slate-600">${st.property.name || st.property.id}</${Pill}>
        <${Btn} onClick=${sync} disabled=${!!busy}>${busy === 'sync' ? 'Syncing…' : '↻ Sync'}</${Btn}>
        <${Btn} size="sm" onClick=${disconnect} disabled=${!!busy}>Disconnect</${Btn}>
      </div>`}
    </div>
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${inner}
    ${picker && html`<${PropertyPicker} properties=${picker} busy=${busy === 'pick'} onPick=${pick} onClose=${() => setPicker(null)} />`}
  </div>`;

  if (!st?.connected) {
    return wrap(html`<${Card}><div class="p-6 space-y-3 text-sm">
      <div class="font-semibold text-slate-800">Connect Google Analytics</div>
      <p class="text-slate-600">Sign in with the Google account that has access to this client's GA4 property, then pick it. Ops Dash pulls sessions, traffic sources, top pages, conversions, and engagement into one dashboard — the on-site half of the picture that pairs with Search Console and Ads.</p>
      <div><${Btn} onClick=${connect} disabled=${!!busy}>${busy === 'connect' ? 'Redirecting…' : 'Connect Google Analytics'}</${Btn}></div>
    </div></${Card}>`);
  }
  if (!st?.property) {
    return wrap(html`<${Card}><div class="p-6 space-y-3 text-sm">
      <div class="font-semibold text-slate-800">Choose the GA4 property</div>
      <p class="text-slate-600">Connected as <span class="font-medium">${st.email || 'Google'}</span>. Pick which Analytics property to report on.</p>
      <div><${Btn} onClick=${openPicker} disabled=${!!busy}>${busy === 'props' ? 'Loading…' : 'Choose property'}</${Btn}></div>
    </div></${Card}>`);
  }

  const s = st.summary || {};
  const daily = snaps.daily || [];
  const tiles = [
    ['Sessions', num(s.sessions)], ['Users', num(s.users)], ['New users', num(s.new_users)],
    ['Pageviews', num(s.pageviews)], ['Conversions', num(s.conversions)],
    ['Engagement', pct(s.engagement_rate)], ['Avg. session', dur(s.avg_session_sec)],
  ];

  return wrap(html`
    ${!st.last_sync ? html`<${Card}><div class="p-6 text-center text-sm text-slate-500">Property selected. Click <span class="font-medium">↻ Sync</span> to pull the last 30 days.</div></${Card}>`
      : html`
      <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        ${tiles.map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-[11px] text-slate-400">${k}</div><div class="text-base font-semibold text-slate-800 tabular-nums">${v}</div></div></${Card}>`)}
      </div>
      ${daily.length > 1 && html`<${Card}><div class="p-4"><${TrendChart} daily=${daily} /></div></${Card}>`}

      <${InsightsCard} insights=${st.insights} insightsAt=${st.insights_at} busy=${aiBusy} onGen=${genInsights} />

      <${Card}><div class="p-3">
        <div class="flex gap-1 border-b border-slate-100 mb-2 flex-wrap">
          ${[['sources', `Lead sources (${(snaps.source_medium || []).length})`], ['ai', `AI search (${(snaps.ai_referrals || []).length})`], ['channels', `Channels (${(snaps.channels || []).length})`], ['attribution', `Attribution (${(snaps.first_touch || []).length})`], ['geo', `Geography (${(snaps.geo || []).length})`], ['landing_pages', `Landing pages (${(snaps.landing_pages || []).length})`], ['top_pages', `Top pages (${(snaps.top_pages || []).length})`], ['devices', `Devices (${(snaps.devices || []).length})`], ['events', `Events (${(snaps.events || []).length})`]]
            .map(([id, label]) => html`<button onClick=${() => setView(id)} class=${cx('px-3 py-2 text-sm -mb-px border-b-2 whitespace-nowrap', view === id ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate-500')}>${label}</button>`)}
        </div>
        ${view === 'sources' && html`<${SourcesTable} rows=${snaps.source_medium || []} />`}
        ${view === 'ai' && html`<${AiSearchPanel} rows=${snaps.ai_referrals || []} />`}
        ${view === 'channels' && html`<${ChannelsTable} rows=${snaps.channels || []} />`}
        ${view === 'attribution' && html`<${AttributionTable} rows=${snaps.first_touch || []} />`}
        ${view === 'geo' && html`<${GeoTable} rows=${snaps.geo || []} />`}
        ${view === 'landing_pages' && html`<${LandingTable} rows=${snaps.landing_pages || []} />`}
        ${view === 'top_pages' && html`<${TopPagesTable} rows=${snaps.top_pages || []} />`}
        ${view === 'devices' && html`<${DevicesTable} rows=${snaps.devices || []} />`}
        ${view === 'events' && html`<${EventsTable} rows=${snaps.events || []} />`}
      </div></${Card}>`}
  `);
}

function PropertyPicker({ properties, busy, onPick, onClose }) {
  return html`<${Modal} title="Choose a GA4 property" onClose=${onClose}>
    <div class="space-y-2 text-sm">
      ${properties.length === 0 ? html`<div class="text-slate-500 py-4 text-center">No GA4 properties were accessible with this Google login.</div>`
        : properties.map((p) => html`<button onClick=${() => onPick(p)} disabled=${busy} class="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 flex items-center justify-between gap-2">
          <div><div class="font-medium text-slate-800">${p.name}</div><div class="text-xs text-slate-400">${p.account} · ${p.id}</div></div>
        </button>`)}
    </div>
  </${Modal}>`;
}

function TrendChart({ daily }) {
  const [metric, setMetric] = useState('sessions');
  const opts = [['sessions', 'Sessions'], ['users', 'Users'], ['pageviews', 'Pageviews'], ['conversions', 'Conversions']];
  const vals = daily.map((d) => Number(d[metric] || 0));
  const max = Math.max(1, ...vals);
  const W = 720, H = 120, pad = 4;
  const step = daily.length > 1 ? (W - pad * 2) / (daily.length - 1) : 0;
  const pts = vals.map((v, i) => `${pad + i * step},${H - pad - (v / max) * (H - pad * 2)}`).join(' ');
  const total = vals.reduce((a, b) => a + b, 0);
  return html`<div>
    <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
      <div class="flex gap-1">${opts.map(([id, label]) => html`<button onClick=${() => setMetric(id)} class=${cx('text-xs px-2 py-1 rounded', metric === id ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-100')}>${label}</button>`)}</div>
      <div class="text-xs text-slate-400">30-day total: <span class="font-semibold text-slate-700">${num(total)}</span></div>
    </div>
    <svg viewBox=${`0 0 ${W} ${H}`} class="w-full" preserveAspectRatio="none" style="height:120px">
      <polyline fill="none" stroke="#0d9488" stroke-width="2" points=${pts} />
    </svg>
    <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>${daily[0]?.day || ''}</span><span>${daily[daily.length - 1]?.day || ''}</span></div>
  </div>`;
}

function bar(v, max) { return html`<div class="h-1.5 rounded-full bg-brand-400" style=${`width:${Math.max(2, Math.round((v / Math.max(1, max)) * 100))}%`}></div>`; }
const priCls = (p) => (p === 'high' ? 'bg-rose-100 text-rose-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600');

// AI analysis of the metrics — lead sourcing, AI-search visibility, actions.
function InsightsCard({ insights, insightsAt, busy, onGen }) {
  const [open, setOpen] = useState(true);
  if (!insights) {
    return html`<${Card}><div class="p-4 flex items-center justify-between gap-3 flex-wrap">
      <div><div class="font-semibold text-slate-800">✨ AI insights</div>
        <div class="text-xs text-slate-500">Claude reads your traffic, lead sources and AI-search referrals and writes a plain-English analysis with prioritized actions.</div></div>
      <${Btn} onClick=${onGen} disabled=${busy}>${busy ? 'Analyzing…' : 'Generate insights'}</${Btn}>
    </div></${Card}>`;
  }
  const i = insights;
  return html`<${Card}><div class="p-4 space-y-3">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="font-semibold text-slate-800">✨ AI insights</div>
      <div class="flex items-center gap-2">
        ${insightsAt && html`<span class="text-[11px] text-slate-400">${new Date(insightsAt).toLocaleString()}</span>`}
        <${Btn} size="sm" onClick=${onGen} disabled=${busy}>${busy ? 'Analyzing…' : '↻ Refresh'}</${Btn}>
        <button onClick=${() => setOpen(!open)} class="text-xs text-slate-500">${open ? 'Hide' : 'Show'}</button>
      </div>
    </div>
    ${i.headline && html`<div class="text-sm text-slate-700 font-medium">${i.headline}</div>`}
    ${open && html`<div class="space-y-3">
      ${(i.lead_sources || []).length > 0 && html`<div>
        <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Where the leads come from</div>
        <ul class="list-disc ml-5 text-sm text-slate-700 space-y-0.5">${i.lead_sources.map((t) => html`<li>${t}</li>`)}</ul>
      </div>`}
      ${i.ai_search && html`<div class="rounded-lg bg-violet-50 border border-violet-100 p-3">
        <div class="text-xs font-semibold text-violet-700 uppercase mb-1">AI search visibility ${i.ai_search.present ? '' : '— none detected yet'}</div>
        <div class="text-sm text-slate-700">${i.ai_search.summary}</div>
      </div>`}
      ${(i.opportunities || []).length > 0 && html`<div>
        <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Opportunities</div>
        <div class="space-y-1.5">${i.opportunities.map((o) => html`<div class="flex gap-2 text-sm">
          <${Pill} cls=${priCls(o.priority)}>${o.priority || 'med'}</${Pill}>
          <span><span class="font-medium text-slate-800">${o.title}</span> <span class="text-slate-600">— ${o.detail}</span></span>
        </div>`)}</div>
      </div>`}
      ${(i.watchouts || []).length > 0 && html`<div>
        <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Watch-outs</div>
        <ul class="list-disc ml-5 text-sm text-amber-700 space-y-0.5">${i.watchouts.map((t) => html`<li>${t}</li>`)}</ul>
      </div>`}
    </div>`}
  </${Card}>`;
}

function SourcesTable({ rows }) {
  const sort = useSort('sessions', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No source data.</div>`;
  return html`<div class="overflow-x-auto">
    <p class="text-xs text-slate-500 mb-2">Every traffic source and medium, ranked. This is the real lead-sourcing view — <span class="font-medium">google / organic</span>, <span class="font-medium">google / cpc</span>, direct, referrals, and each site that sends you visitors.</p>
    <table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="source_medium" label="Source / medium" sort=${sort} /><${SortTh} k="sessions" label="Sessions" sort=${sort} right=${true} />
      <${SortTh} k="engaged" label="Engaged" sort=${sort} right=${true} /><${SortTh} k="engagement_rate" label="Engagement" sort=${sort} right=${true} />
      <${SortTh} k="avg_sec" label="Avg. time" sort=${sort} right=${true} /><${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 text-slate-800">${r.source_medium}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.sessions)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.engaged)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${pct(r.engagement_rate)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${dur(r.avg_sec)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums font-medium ${r.conversions > 0 ? 'text-emerald-600' : 'text-slate-400'}">${num(r.conversions)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function AiSearchPanel({ rows }) {
  // Group per-source rows into engines.
  const engines = {};
  for (const r of rows) {
    const e = engines[r.engine] || (engines[r.engine] = { engine: r.engine, sessions: 0, engaged: 0, conversions: 0, sources: [] });
    e.sessions += r.sessions; e.engaged += r.engaged; e.conversions += r.conversions; e.sources.push(r.source);
  }
  const list = Object.values(engines).sort((a, b) => b.sessions - a.sessions);
  const total = list.reduce((a, e) => a + e.sessions, 0);
  return html`<div class="space-y-3">
    <p class="text-xs text-slate-500">Referrals from AI assistants and answer engines — visitors who found the business through <span class="font-medium">ChatGPT, Perplexity, Gemini, Copilot, Claude</span> and similar. This traffic normally hides inside "Referral"; here it's pulled out and named.</p>
    ${list.length === 0
      ? html`<div class="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No AI-engine referrals detected in the last 30 days. As AI search grows this is worth watching — being cited by ChatGPT or Perplexity is the new "ranking #1."</div>`
      : html`<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${list.map((e) => html`<div class="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
            <div class="flex items-center justify-between"><span class="font-semibold text-slate-800">${e.engine}</span><${Pill} cls="bg-violet-100 text-violet-700">${total ? Math.round((e.sessions / total) * 100) : 0}%</${Pill}></div>
            <div class="mt-1 text-2xl font-bold text-slate-800 tabular-nums">${num(e.sessions)}</div>
            <div class="text-xs text-slate-500">sessions · ${num(e.engaged)} engaged · ${num(e.conversions)} conv.</div>
          </div>`)}
        </div>`}
    <div class="text-[11px] text-slate-400">Note: Google's <span class="font-medium">AI Overviews</span> and <span class="font-medium">AI Mode</span> clicks are reported by Google as ordinary <span class="font-medium">google / organic</span> — GA4 can't separate them, so they're counted under Organic Search, not here.</div>
  </div>`;
}

function AttributionTable({ rows }) {
  const sort = useSort('users', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No attribution data.</div>`;
  const max = Math.max(...rows.map((r) => r.users || 0), 1);
  return html`<div class="overflow-x-auto">
    <p class="text-xs text-slate-500 mb-2">First-touch attribution — the channel that <span class="font-medium">first</span> brought each user to the site (vs. the Channels tab, which is the last-click session source). Shows what's actually <span class="font-medium">discovering</span> new customers.</p>
    <table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="channel" label="First-touch channel" sort=${sort} /><th class="py-1.5 pr-3 w-40"></th>
      <${SortTh} k="users" label="Users" sort=${sort} right=${true} /><${SortTh} k="new_users" label="New users" sort=${sort} right=${true} />
      <${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 font-medium text-slate-800">${r.channel}</td>
      <td class="py-1.5 pr-3">${bar(r.users, max)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.users)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.new_users)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.conversions)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function GeoTable({ rows }) {
  const sort = useSort('sessions', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No geographic data.</div>`;
  const max = Math.max(...rows.map((r) => r.sessions || 0), 1);
  return html`<div class="overflow-x-auto">
    <p class="text-xs text-slate-500 mb-2">Where visitors are — for a local business, traffic clustering in the service area is a good sign; lots of out-of-area sessions can mean wasted spend or off-target content.</p>
    <table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="city" label="City" sort=${sort} /><th class="py-1.5 pr-3 w-40"></th>
      <${SortTh} k="sessions" label="Sessions" sort=${sort} right=${true} /><${SortTh} k="users" label="Users" sort=${sort} right=${true} />
      <${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 text-slate-800">${r.city || '(not set)'}</td>
      <td class="py-1.5 pr-3">${bar(r.sessions, max)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.sessions)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.users)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.conversions)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function ChannelsTable({ rows }) {
  const sort = useSort('sessions', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No channel data.</div>`;
  const max = Math.max(...rows.map((r) => r.sessions || 0), 1);
  return html`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="channel" label="Channel" sort=${sort} /><th class="py-1.5 pr-3 w-40"></th>
      <${SortTh} k="sessions" label="Sessions" sort=${sort} right=${true} /><${SortTh} k="users" label="Users" sort=${sort} right=${true} />
      <${SortTh} k="engaged" label="Engaged" sort=${sort} right=${true} /><${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 font-medium text-slate-800">${r.channel}</td>
      <td class="py-1.5 pr-3">${bar(r.sessions, max)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.sessions)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.users)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.engaged)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.conversions)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function LandingTable({ rows }) {
  const sort = useSort('sessions', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No landing-page data.</div>`;
  return html`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="page" label="Landing page" sort=${sort} /><${SortTh} k="sessions" label="Sessions" sort=${sort} right=${true} />
      <${SortTh} k="engagement_rate" label="Engagement" sort=${sort} right=${true} /><${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 text-slate-800 max-w-md truncate">${shortUrl(r.page)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.sessions)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${pct(r.engagement_rate)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.conversions)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function TopPagesTable({ rows }) {
  const sort = useSort('pageviews', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No page data.</div>`;
  return html`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="page" label="Page" sort=${sort} /><${SortTh} k="pageviews" label="Views" sort=${sort} right=${true} />
      <${SortTh} k="users" label="Users" sort=${sort} right=${true} /><${SortTh} k="engagement_rate" label="Engagement" sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 text-slate-800 max-w-md truncate">${shortUrl(r.page)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.pageviews)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.users)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${pct(r.engagement_rate)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function DevicesTable({ rows }) {
  const sort = useSort('sessions', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No device data.</div>`;
  const max = Math.max(...rows.map((r) => r.sessions || 0), 1);
  return html`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="device" label="Device" sort=${sort} /><th class="py-1.5 pr-3 w-40"></th>
      <${SortTh} k="sessions" label="Sessions" sort=${sort} right=${true} /><${SortTh} k="users" label="Users" sort=${sort} right=${true} />
      <${SortTh} k="conversions" label="Conv." sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 font-medium text-slate-800 capitalize">${r.device}</td>
      <td class="py-1.5 pr-3">${bar(r.sessions, max)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.sessions)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.users)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.conversions)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function EventsTable({ rows }) {
  const sort = useSort('count', 'desc');
  if (!rows.length) return html`<div class="p-6 text-center text-sm text-slate-400">No event data.</div>`;
  const max = Math.max(...rows.map((r) => r.count || 0), 1);
  return html`<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
      <${SortTh} k="event" label="Event" sort=${sort} /><th class="py-1.5 pr-3 w-40"></th><${SortTh} k="count" label="Count" sort=${sort} right=${true} /></tr></thead>
    <tbody>${sort.sort(rows).map((r) => html`<tr class="border-b border-slate-50">
      <td class="py-1.5 pr-3 text-slate-800 font-mono text-xs">${r.event}</td>
      <td class="py-1.5 pr-3">${bar(r.count, max)}</td>
      <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.count)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}
