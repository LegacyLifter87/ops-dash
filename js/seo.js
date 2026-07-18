// ---------------------------------------------------------------------------
// seo.js — SEO module: Google Search Console connection + query mining.
// Account-scoped: all wrappers inject the active accountId; reloads when the
// active account changes. Admins connect/sync; members read.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, seoStatus, seoConnect, seoDisconnect, seoAddSite, seoRemoveSite, seoSync, seoLoadData, getActiveAccountId } from './store.js';
import { Card, Btn, Select } from './ui.js';
import { useSort, SortTh } from './sortable.js';
import { SiteHealth } from './lighthouse.js';
import { Trends } from './trends.js';

const pctf = (n) => `${(n * 100).toFixed(1)}%`;
const num = (n) => (n || 0).toLocaleString();
const posf = (n) => (n ? n.toFixed(1) : '—');
const short = (u) => { try { const x = new URL(u); return x.pathname === '/' ? x.hostname : x.pathname; } catch { return u; } };

function aggByQuery(rows) {
  const m = new Map();
  for (const r of rows) {
    let a = m.get(r.query);
    if (!a) { a = { query: r.query, clicks: 0, impressions: 0, posWt: 0, pages: new Set() }; m.set(r.query, a); }
    a.clicks += r.clicks; a.impressions += r.impressions; a.posWt += (r.position || 0) * (r.impressions || 0);
    if (r.page) a.pages.add(r.page);
  }
  return [...m.values()].map((a) => ({ ...a, ctr: a.impressions ? a.clicks / a.impressions : 0, position: a.impressions ? a.posWt / a.impressions : 0, pageCount: a.pages.size }));
}
const expectedCtr = (p) => (p <= 1 ? 0.28 : p <= 2 ? 0.15 : p <= 3 ? 0.1 : p <= 5 ? 0.06 : p <= 10 ? 0.025 : 0.01);

export function SEO() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [status, setStatus] = useState(null);
  const [activeSite, setActiveSite] = useState('');
  const [data, setData] = useState({ queries: [], pages: [] });
  const [tab, setTab] = useState('health');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const r = q.get('seo');
    if (r) { setBanner(r === 'connected' ? 'Google Search Console connected.' : 'Google connection failed — please try again.'); history.replaceState(null, '', location.pathname + location.hash); }
  }, []);

  const loadStatus = async () => {
    setStatus(null); setActiveSite(''); setData({ queries: [], pages: [] });
    try {
      const st = await seoStatus(); setStatus(st);
      if (st.sites?.length) setActiveSite(st.sites[0].id);
    } catch (e) { setStatus({ connected: false, sites: [] }); setErr(e.message); }
  };
  // reload whenever the active account changes
  useEffect(() => { if (accountId) loadStatus(); }, [accountId]);
  useEffect(() => { if (activeSite) seoLoadData(activeSite).then(setData); }, [activeSite]);

  const isAdmin = status?.admin !== false; // undefined (older) → allow; false → member
  const connect = async () => { setBusy('connect'); setErr(''); try { const r = await seoConnect(); location.href = r.url; } catch (e) { setErr(e.message); setBusy(''); } };
  const disconnect = async () => { if (!confirm('Disconnect Google Search Console?')) return; setBusy('disc'); setErr(''); try { await seoDisconnect(); await loadStatus(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const addSite = async (property) => { if (!property) return; setBusy('add'); setErr(''); try { const r = await seoAddSite(property); await loadStatus(); if (r.site) setActiveSite(r.site.id); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const removeSite = async (id) => { if (!confirm('Remove this site and its synced data?')) return; setBusy('rm'); try { await seoRemoveSite(id); if (activeSite === id) setActiveSite(''); await loadStatus(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const sync = async () => { if (!activeSite) return; setBusy('sync'); setErr(''); try { const r = await seoSync(activeSite); setBanner(`Synced ${num(r.queries)} query rows and ${num(r.pages)} page rows.`); setData(await seoLoadData(activeSite)); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  const views = useMemo(() => {
    const periods = [...new Set(data.queries.map((r) => r.period_start))].sort().reverse();
    const cur = periods[0], prev = periods[1];
    const curRows = data.queries.filter((r) => r.period_start === cur);
    const prevRows = data.queries.filter((r) => r.period_start === prev);
    const curAgg = aggByQuery(curRows);
    const prevMap = new Map(aggByQuery(prevRows).map((a) => [a.query, a]));
    const striking = curAgg.filter((a) => a.position >= 4 && a.position <= 20 && a.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 40);
    const lowCtr = curAgg.filter((a) => a.impressions >= 50 && a.position <= 10 && a.ctr < expectedCtr(a.position) * 0.5).sort((a, b) => b.impressions - a.impressions).slice(0, 40);
    const cannibal = curAgg.filter((a) => a.pageCount > 1).sort((a, b) => b.impressions - a.impressions).slice(0, 40);
    const rising = curAgg.map((a) => { const p = prevMap.get(a.query); return { ...a, prevImp: p?.impressions || 0, isNew: !p, delta: a.impressions - (p?.impressions || 0) }; })
      .filter((a) => (a.isNew && a.impressions >= 10) || a.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 40);
    const curPages = data.pages.filter((r) => r.period_start === cur);
    const pages = [...curPages].sort((a, b) => b.clicks - a.clicks);
    const totals = curAgg.reduce((t, a) => { t.clicks += a.clicks; t.impressions += a.impressions; t.posWt += a.position * a.impressions; return t; }, { clicks: 0, impressions: 0, posWt: 0 });
    return { striking, lowCtr, cannibal, rising, pages, stat: { queries: curAgg.length, clicks: totals.clicks, impressions: totals.impressions, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position: totals.impressions ? totals.posWt / totals.impressions : 0, striking: striking.length, cannibal: cannibal.length } };
  }, [data]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (!status) return html`<div class="p-8 text-sm text-slate-400">Loading SEO…</div>`;

  if (!status.connected) {
    return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <${Header} />
      ${banner && html`<${Note} onClose=${() => setBanner('')}>${banner}</${Note}>`}
      ${err && html`<${Note} err>${err}</${Note}>`}
      <${Card}><div class="p-6 text-center space-y-3">
        <div class="text-4xl">🔍</div>
        <div class="font-semibold text-slate-800">Connect Google Search Console</div>
        <p class="text-sm text-slate-500 max-w-md mx-auto">Pull the real queries this account's sites already rank for — impressions, clicks, CTR, and position — and surface the ranking opportunities hiding in the data.</p>
        ${isAdmin ? html`<${Btn} onClick=${connect} disabled=${busy === 'connect'}>${busy === 'connect' ? 'Redirecting…' : 'Connect Google Search Console'}</${Btn}>`
          : html`<p class="text-sm text-slate-400">Ask an account admin to connect Search Console.</p>`}
      </div></${Card}>
    </div>`;
  }

  const props = (status.properties || []).filter((p) => !(status.sites || []).some((s) => s.gsc_property === p));
  const site = (status.sites || []).find((s) => s.id === activeSite);
  const tabs = [['health', '🩺 Site Health'], ['trends', '📈 Trends'], ['striking', `Striking Distance (${views.striking.length})`], ['lowctr', `Low CTR (${views.lowCtr.length})`], ['rising', `Rising & New (${views.rising.length})`], ['cannibal', `Cannibalization (${views.cannibal.length})`], ['pages', `Pages (${views.pages.length})`]];

  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <${Header} />
    ${banner && html`<${Note} onClose=${() => setBanner('')}>${banner}</${Note}>`}
    ${err && html`<${Note} err>${err}</${Note}>`}
    <${Card}><div class="p-4 flex flex-wrap items-center gap-3 justify-between">
      <div class="text-sm text-slate-600">Connected as <span class="font-medium text-slate-800">${status.email || 'Google account'}</span></div>
      ${isAdmin && html`<div class="flex items-center gap-2">
        ${props.length > 0 && html`<${Select} value="" onChange=${(v) => addSite(v)} options=${[{ value: '', label: busy === 'add' ? 'Adding…' : '+ Add a property…' }, ...props.map((p) => ({ value: p, label: p }))]} />`}
        <button onClick=${disconnect} class="text-sm text-slate-400 hover:text-rose-600 underline">${busy === 'disc' ? 'Disconnecting…' : 'Disconnect'}</button>
      </div>`}
    </div></${Card}>

    ${(status.sites || []).length === 0
      ? html`<${Card}><div class="p-6 text-center text-sm text-slate-500">No sites yet.${isAdmin ? ' Add a Search Console property above to begin.' : ''}${props.length === 0 && isAdmin ? ' (No properties found on this Google account — make sure it has verified Search Console access.)' : ''}</div></${Card}>`
      : html`
        <div class="flex flex-wrap items-center gap-2">
          ${(status.sites || []).map((s) => html`<button onClick=${() => setActiveSite(s.id)} class=${cx('px-3 py-1.5 rounded-lg text-sm border', s.id === activeSite ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>${s.display_name || s.domain}</button>`)}
          ${isAdmin && html`<div class="ml-auto flex items-center gap-2">
            <${Btn} onClick=${sync} disabled=${busy === 'sync'}>${busy === 'sync' ? 'Syncing…' : 'Sync now'}</${Btn}>
            ${site && html`<button onClick=${() => removeSite(site.id)} class="text-sm text-slate-400 hover:text-rose-600 underline">Remove</button>`}
          </div>`}
        </div>

        <div class="flex flex-wrap gap-1 border-b border-slate-200">
          ${tabs.map(([id, label]) => html`<button onClick=${() => setTab(id)} class=${cx('px-3 py-2 text-sm -mb-px border-b-2', tab === id ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700')}>${label}</button>`)}
        </div>
        ${tab === 'health'
          ? html`<${SiteHealth} siteId=${activeSite} domain=${site?.domain} canRun=${isAdmin} />`
          : tab === 'trends'
          ? html`<${Trends} siteId=${activeSite} canRun=${isAdmin} />`
          : data.queries.length === 0
            ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No data synced yet for this site.${isAdmin ? ' Click Sync now to pull the last 28 days from Search Console — or open Site Health above.' : ''}</div></${Card}>`
            : html`
              <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                ${[['Clicks', num(views.stat.clicks)], ['Impressions', num(views.stat.impressions)], ['CTR', pctf(views.stat.ctr)], ['Avg position', posf(views.stat.position)], ['Queries', num(views.stat.queries)], ['Striking dist.', num(views.stat.striking)], ['Cannibalized', num(views.stat.cannibal)]]
                  .map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div></div></${Card}>`)}
              </div>
              ${tab === 'striking' && html`<${QTable} caption="Queries ranking positions 4–20 — close enough that on-page work can push them onto page one." rows=${views.striking} cols=${['query', 'impressions', 'clicks', 'ctr', 'position']} />`}
              ${tab === 'lowctr' && html`<${QTable} caption="Ranking well but under-earning clicks — rewrite the title/meta and add an FAQ to lift CTR." rows=${views.lowCtr} cols=${['query', 'impressions', 'clicks', 'ctr', 'position']} />`}
              ${tab === 'rising' && html`<${QTable} caption="Queries gaining impressions vs the prior 28 days (★ = new)." rows=${views.rising} cols=${['query', 'impressions', 'delta', 'clicks', 'position']} />`}
              ${tab === 'cannibal' && html`<${QTable} caption="One query spread across multiple pages — consolidate or differentiate to stop self-competition." rows=${views.cannibal} cols=${['query', 'pageCount', 'impressions', 'clicks', 'position']} />`}
              ${tab === 'pages' && html`<${PTable} rows=${views.pages} />`}
            `}
      `}
  </div>`;
}

function Header() {
  return html`<div>
    <h1 class="text-xl font-bold text-slate-800">SEO Intelligence</h1>
    <p class="text-sm text-slate-500">Search Console query mining — find the ranking opportunities already in your data.</p>
  </div>`;
}
function Note({ children, err, onClose }) {
  return html`<div class=${cx('rounded-lg px-4 py-2.5 text-sm flex items-center justify-between', err ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
    <span>${children}</span>${onClose && html`<button onClick=${onClose} class="opacity-60 hover:opacity-100">✕</button>`}
  </div>`;
}
function cellVal(r, c) {
  if (c === 'query') return html`<span class="font-medium text-slate-800">${r.isNew ? '★ ' : ''}${r.query}</span>`;
  if (c === 'ctr') return pctf(r.ctr);
  if (c === 'position') return posf(r.position);
  if (c === 'delta') return html`<span class=${r.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>${r.delta >= 0 ? '+' : ''}${num(r.delta)}</span>`;
  if (c === 'pageCount') return `${r.pageCount} pages`;
  return num(r[c]);
}
function QTable({ caption, rows, cols }) {
  const head = { query: 'Query', impressions: 'Impr.', clicks: 'Clicks', ctr: 'CTR', position: 'Pos.', delta: 'Δ Impr.', pageCount: 'Pages' };
  const sort = useSort(cols.find((c) => c !== 'query') || cols[0], 'desc');
  const sorted = sort.sort(rows, { pageCount: (r) => r.pageCount });
  return html`<${Card}><div class="p-3">
    <p class="text-xs text-slate-500 mb-2">${caption}</p>
    <div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">${cols.map((c) => html`<${SortTh} k=${c} label=${head[c]} sort=${sort} right=${c !== 'query'} />`)}</tr></thead>
      <tbody>${sorted.length === 0
        ? html`<tr><td colspan=${cols.length} class="py-4 text-center text-slate-400">Nothing here right now.</td></tr>`
        : sorted.map((r) => html`<tr class="border-b border-slate-50">${cols.map((c) => html`<td class=${cx('py-1.5 pr-3 max-w-xs truncate', c !== 'query' && 'text-right tabular-nums')}>${cellVal(r, c)}</td>`)}</tr>`)}
      </tbody>
    </table></div>
  </div></${Card}>`;
}
function PTable({ rows }) {
  const sort = useSort('clicks', 'desc');
  const [q, setQ] = useState('');
  const CAP = 500;
  const filtered = q ? rows.filter((r) => String(r.page).toLowerCase().includes(q.toLowerCase())) : rows;
  const sorted = sort.sort(filtered, { ctr: (r) => (r.impressions ? r.clicks / r.impressions : 0) });
  const shown = sorted.slice(0, CAP);
  return html`<${Card}><div class="p-3">
    <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
      <p class="text-xs text-slate-500">Every page with Search impressions in the last 28 days (${num(rows.length)}). Click a column to sort.</p>
      <input value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Filter by URL…" class="text-sm px-2.5 py-1.5 border border-slate-200 rounded-lg w-full sm:w-56 focus:outline-none focus:border-brand-400" />
    </div>
    <div class="overflow-x-auto max-h-[70vh] overflow-y-auto"><table class="w-full text-sm">
      <thead class="sticky top-0 bg-white"><tr class="text-left text-xs text-slate-400 border-b border-slate-100"><${SortTh} k="page" label="Page" sort=${sort} /><${SortTh} k="impressions" label="Impr." sort=${sort} right=${true} /><${SortTh} k="clicks" label="Clicks" sort=${sort} right=${true} /><${SortTh} k="ctr" label="CTR" sort=${sort} right=${true} /><${SortTh} k="position" label="Pos." sort=${sort} right=${true} /></tr></thead>
      <tbody>${shown.map((r) => html`<tr class="border-b border-slate-50">
        <td class="py-1.5 pr-3 max-w-sm truncate"><a href=${r.page} target="_blank" rel="noopener" class="text-brand-700 hover:underline">${short(r.page)}</a></td>
        <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.impressions)}</td><td class="py-1.5 pr-3 text-right tabular-nums">${num(r.clicks)}</td>
        <td class="py-1.5 pr-3 text-right tabular-nums">${pctf(r.impressions ? r.clicks / r.impressions : 0)}</td><td class="py-1.5 pr-3 text-right tabular-nums">${posf(r.position)}</td>
      </tr>`)}</tbody>
    </table></div>
    ${sorted.length > CAP && html`<p class="text-xs text-slate-400 pt-2">Showing the top ${CAP} of ${num(sorted.length)} — type in the filter to find a specific page.</p>`}
    ${q && sorted.length === 0 && html`<p class="text-xs text-slate-400 pt-2">No pages match “${q}”.</p>`}
  </div></${Card}>`;
}
