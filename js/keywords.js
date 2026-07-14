// ---------------------------------------------------------------------------
// keywords.js — Keyword intelligence: the keyword database built from GSC, with
// search-intent classification, topic clusters, and an opportunity score.
// (Volume/CPC columns light up once Google Ads Keyword Planner is connected.)
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, activeAccount, seoLoadSites, seoLoadKeywords, seoKeywordsRebuild, seoSetBrandTerms, seoBriefGenerate, seoLoadBriefs, seoSetEconomics, seoDfsEnrichKeywords } from './store.js';
import { Card, Btn, Select, Input, Modal } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const num = (n) => (n || 0).toLocaleString();
const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const posf = (n) => (n ? n.toFixed(1) : '—');
const intentColor = {
  emergency: 'bg-rose-100 text-rose-700', transactional: 'bg-emerald-100 text-emerald-700', local: 'bg-teal-100 text-teal-700',
  commercial: 'bg-blue-100 text-blue-700', comparison: 'bg-violet-100 text-violet-700', informational: 'bg-slate-100 text-slate-600', navigational: 'bg-amber-100 text-amber-700',
};
const oppColor = (o) => (o >= 75 ? 'bg-emerald-500 text-white' : o >= 60 ? 'bg-amber-400 text-white' : o >= 40 ? 'bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-400');
const Pill = ({ children, cls }) => html`<span class=${cx('inline-block px-2 py-0.5 rounded-full text-xs font-medium', cls)}>${children}</span>`;

export function Keywords() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('keywords');
  const [intent, setIntent] = useState('all');
  const [cluster, setCluster] = useState('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [brand, setBrand] = useState('');
  const [briefs, setBriefs] = useState([]);
  const [openCluster, setOpenCluster] = useState(null);
  const [openKind, setOpenKind] = useState('cluster'); // 'cluster' | 'keyword' — what openCluster refers to
  const [briefBusy, setBriefBusy] = useState('');
  const [econ, setEcon] = useState(null);
  const [marginPct, setMarginPct] = useState(45);
  const [leadPct, setLeadPct] = useState(3);
  const sortKw = useSort('opportunity', 'desc');
  const sortCl = useSort('count', 'desc');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const loadKw = async (sid) => { setRows(await seoLoadKeywords(sid)); };
  useEffect(() => { if (site) { loadKw(site); seoLoadBriefs(site).then(setBriefs); } else { setRows([]); setBriefs([]); } }, [site]);
  useEffect(() => { const s = (sites || []).find((x) => x.id === site); setBrand((s?.brand_terms || []).join(', ')); }, [site, sites]);
  useEffect(() => { const a = activeAccount(); if (a) { if (a.assumed_margin != null) setMarginPct(Math.round(a.assumed_margin * 100)); if (a.lead_rate != null) setLeadPct(+(a.lead_rate * 100).toFixed(1)); } }, [accountId]);

  const rebuild = async () => {
    setBusy(true); setErr(''); setBanner('');
    try { const r = await seoKeywordsRebuild(site); setEcon(r.economics); setBanner(`Built ${num(r.keywords)} keywords from Search Console.`); await loadKw(site); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveEconomics = async () => {
    setBusy(true); setErr(''); setBanner('');
    try {
      await seoSetEconomics((Number(marginPct) || 0) / 100, (Number(leadPct) || 0) / 100);
      const r = await seoKeywordsRebuild(site); setEcon(r.economics);
      setBanner('Revenue model saved — keywords rescored by dollar potential.');
      await loadKw(site);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const dfsEnrich = async () => {
    setBusy(true); setErr(''); setBanner('');
    try { const r = await seoDfsEnrichKeywords(site); setBanner(`Pulled search volume, CPC & difficulty for ${num(r.enriched)} keywords.`); await loadKw(site); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveBrand = async () => {
    setBusy(true); setErr(''); setBanner('');
    try {
      const terms = brand.split(',').map((t) => t.trim()).filter(Boolean);
      await seoSetBrandTerms(site, terms);
      setSites(await seoLoadSites());
      { const r = await seoKeywordsRebuild(site); setEcon(r.economics); }
      setBanner('Brand terms saved — keywords rebuilt.');
      await loadKw(site);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const genBrief = async (key, kind, format) => {
    setBriefBusy(key); setErr('');
    try {
      const startedAt = Date.now();
      const r = await seoBriefGenerate(site, kind === 'keyword' ? { keyword: key } : { cluster: key }, format);
      if (r?.brief) { setBriefs(await seoLoadBriefs(site)); return; } // sync path
      // Background path: the writer researches + writes server-side; poll for the result.
      for (let i = 0; i < 40; i++) {
        await new Promise((res) => setTimeout(res, 6000));
        const bs = await seoLoadBriefs(site);
        const b = bs.find((x) => x.cluster === key && x.created_at && new Date(x.created_at).getTime() >= startedAt - 60000);
        if (b) { setBriefs(bs); return; }
      }
      setErr('The writer is taking unusually long — check the Briefs tab in a couple of minutes, or try again.');
    } catch (e) { setErr(e.message); } finally { setBriefBusy(''); }
  };
  const briefFor = (cl) => briefs.some((x) => x.cluster === cl);
  const openContent = (key, kind) => { setOpenKind(kind); setOpenCluster(key); };

  const clusters = useMemo(() => {
    const m = new Map();
    for (const k of rows) { let c = m.get(k.cluster); if (!c) { c = { cluster: k.cluster, count: 0, impressions: 0, oppSum: 0, intents: {} }; m.set(k.cluster, c); } c.count++; c.impressions += k.impressions; c.oppSum += Number(k.opportunity); c.intents[k.intent] = (c.intents[k.intent] || 0) + 1; }
    return [...m.values()].map((c) => ({ ...c, avgOpp: Math.round(c.oppSum / c.count), topIntent: Object.entries(c.intents).sort((a, b) => b[1] - a[1])[0]?.[0] })).sort((a, b) => b.oppSum - a.oppSum);
  }, [rows]);

  const clusterOptions = useMemo(() => ['all', ...[...new Set(rows.map((r) => r.cluster))].sort()], [rows]);
  const filtered = useMemo(() => rows.filter((r) =>
    (intent === 'all' || r.intent === intent) && (cluster === 'all' || r.cluster === cluster) && (!q || r.keyword.toLowerCase().includes(q.toLowerCase()))
  ), [rows, intent, cluster, q]);

  const stats = useMemo(() => ({ total: rows.length, clusters: clusters.length, high: rows.filter((r) => r.opportunity >= 75).length, avg: rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.opportunity), 0) / rows.length) : 0, value: rows.reduce((s, r) => s + Number(r.est_value || 0), 0) }), [rows, clusters]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading keywords…</div>`;

  const Head = () => html`<div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-xl font-bold text-slate-800">Keyword Intelligence</h1>
      <p class="text-sm text-slate-500">Your keyword database — intent, topic clusters, and opportunity, built from Search Console.</p>
    </div>
    <div class="flex items-center gap-2">
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
      ${site && html`<button onClick=${dfsEnrich} disabled=${busy} class="text-sm px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-50">Volume + difficulty</button>`}
      ${site && html`<${Btn} onClick=${rebuild} disabled=${busy}>${busy ? 'Building…' : 'Build / refresh'}</${Btn}>`}
    </div>
  </div>`;

  if (sites.length === 0) {
    return html`<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4"><${Head} />
      <${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Google Search Console and add a site in the <span class="font-medium">SEO</span> tab first — the keyword database is built from your synced search data.</div></${Card}>
    </div>`;
  }

  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <${Head} />
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

    <${Card}><div class="p-3 flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-slate-700">Brand terms</span>
      <span class="text-xs text-slate-400 hidden sm:inline">matches are tagged navigational & down-ranked</span>
      <${Input} value=${brand} onInput=${setBrand} placeholder="your name, company, domain…" class="flex-1 min-w-[12rem]" />
      <${Btn} size="sm" onClick=${saveBrand} disabled=${busy || !site}>${busy ? 'Saving…' : 'Save & rebuild'}</${Btn}>
    </div></${Card}>

    <${Card}><div class="p-3 flex flex-wrap items-center gap-3">
      <span class="text-sm font-medium text-slate-700">Revenue model</span>
      <div class="flex items-center gap-1"><${Input} value=${String(marginPct)} onInput=${(v) => setMarginPct(v)} class="w-16" /><span class="text-xs text-slate-500">% margin</span></div>
      <div class="flex items-center gap-1"><${Input} value=${String(leadPct)} onInput=${(v) => setLeadPct(v)} class="w-16" /><span class="text-xs text-slate-500">% visitor→lead</span></div>
      <${Btn} size="sm" onClick=${saveEconomics} disabled=${busy || !site}>${busy ? 'Saving…' : 'Save & rescore'}</${Btn}>
      ${econ && econ.linked
        ? html`<span class="text-xs text-slate-500">Real JT data: avg job ${money(econ.avgJob)} · win ${(econ.winRate * 100).toFixed(0)}% → ${money(econ.profitPerCustomer)}/job</span>`
        : html`<span class="text-xs text-amber-600">Link a Job Tracker company (Business tab) to power $ estimates.</span>`}
    </div></${Card}>

    ${rows.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No keywords yet. Click <span class="font-medium">Build / refresh</span> to generate the keyword database from your Search Console data.</div></${Card}>`
      : html`
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          ${[['Keywords', num(stats.total)], ['Topic clusters', num(stats.clusters)], ['High opportunity', num(stats.high), 'score ≥ 75'], ['Avg opportunity', stats.avg], ['Est. $/mo', stats.value > 0 ? money(stats.value) : '—', 'at top-3 rankings']]
            .map(([k, v, sub]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div>${sub && html`<div class="text-[11px] text-slate-400">${sub}</div>`}</div></${Card}>`)}
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex gap-1 border-b border-slate-200">
            ${[['keywords', 'Keywords'], ['clusters', `Clusters (${stats.clusters})`], ['briefs', `Briefs (${briefs.length})`]].map(([id, label]) => html`<button onClick=${() => setView(id)} class=${cx('px-3 py-2 text-sm -mb-px border-b-2', view === id ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate-500')}>${label}</button>`)}
          </div>
          ${view === 'keywords' && html`<div class="ml-auto flex flex-wrap items-center gap-2">
            <${Input} value=${q} onInput=${setQ} placeholder="Search…" class="w-40" />
            <${Select} value=${intent} onChange=${setIntent} options=${['all', 'emergency', 'transactional', 'local', 'commercial', 'comparison', 'informational'].map((i) => ({ value: i, label: i === 'all' ? 'All intents' : i }))} />
            <${Select} value=${cluster} onChange=${setCluster} options=${clusterOptions.map((c) => ({ value: c, label: c === 'all' ? 'All clusters' : c }))} />
          </div>`}
        </div>

        ${view === 'keywords'
          ? html`<${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
              <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                <${SortTh} k="opportunity" label="Opp." sort=${sortKw} /><${SortTh} k="keyword" label="Keyword" sort=${sortKw} /><${SortTh} k="intent" label="Intent" sort=${sortKw} /><${SortTh} k="cluster" label="Cluster" sort=${sortKw} />
                <${SortTh} k="impressions" label="Impr." sort=${sortKw} right=${true} /><${SortTh} k="volume" label="Vol." sort=${sortKw} right=${true} /><${SortTh} k="cpc" label="CPC" sort=${sortKw} right=${true} /><${SortTh} k="difficulty" label="Diff." sort=${sortKw} right=${true} /><${SortTh} k="position" label="Pos." sort=${sortKw} right=${true} /><${SortTh} k="est_value" label="$/mo" sort=${sortKw} right=${true} /><${SortTh} k="recommended_action" label="Recommended action" sort=${sortKw} /><th class="py-1.5 pr-3"></th></tr></thead>
              <tbody>${sortKw.sort(filtered).slice(0, 250).map((k) => html`<tr class="border-b border-slate-50">
                <td class="py-1.5 pr-3"><${Pill} cls=${oppColor(k.opportunity)}>${k.opportunity}</${Pill}></td>
                <td class="py-1.5 pr-3 font-medium text-slate-800 max-w-xs truncate">${k.keyword}</td>
                <td class="py-1.5 pr-3"><${Pill} cls=${intentColor[k.intent] || 'bg-slate-100 text-slate-600'}>${k.intent}</${Pill}></td>
                <td class="py-1.5 pr-3 text-slate-500 truncate max-w-[8rem]">${k.cluster}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${num(k.impressions)}</td>
                <td class=${cx('py-1.5 pr-3 text-right tabular-nums', k.volume == null && 'text-slate-300')}>${k.volume != null ? num(k.volume) : '—'}</td>
                <td class=${cx('py-1.5 pr-3 text-right tabular-nums', !k.cpc && 'text-slate-300')}>${k.cpc ? '$' + Number(k.cpc).toFixed(2) : '—'}</td>
                <td class=${cx('py-1.5 pr-3 text-right tabular-nums', k.difficulty == null && 'text-slate-300')}>${k.difficulty != null ? k.difficulty : '—'}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${posf(k.position)}</td>
                <td class=${cx('py-1.5 pr-3 text-right tabular-nums font-medium', k.est_value > 0 ? 'text-emerald-700' : 'text-slate-300')}>${k.est_value > 0 ? money(k.est_value) : '—'}</td>
                <td class="py-1.5 pr-3 text-slate-600">${k.recommended_action}</td>
                <td class="py-1.5 pr-1 text-right"><button title=${briefFor(k.keyword) ? 'View the content written for this keyword' : 'Write a blog post or page targeting this keyword'} onClick=${() => openContent(k.keyword, 'keyword')} class=${cx('text-xs px-2 py-1 rounded-lg border whitespace-nowrap', briefFor(k.keyword) ? 'border-brand-200 text-brand-700 bg-brand-50' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>${briefFor(k.keyword) ? 'View' : '✨'}</button></td>
              </tr>`)}</tbody>
            </table>
            ${filtered.length > 250 && html`<div class="text-xs text-slate-400 pt-2">Showing top 250 of ${num(filtered.length)}.</div>`}
          </div></${Card}>`
          : view === 'clusters'
          ? html`<${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
              <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                <${SortTh} k="cluster" label="Cluster" sort=${sortCl} /><${SortTh} k="count" label="Keywords" sort=${sortCl} right=${true} /><${SortTh} k="impressions" label="Impr." sort=${sortCl} right=${true} /><${SortTh} k="avgOpp" label="Avg opp." sort=${sortCl} right=${true} /><${SortTh} k="topIntent" label="Primary intent" sort=${sortCl} /><th class="py-1.5 pr-3"></th></tr></thead>
              <tbody>${sortCl.sort(clusters).map((c) => html`<tr class="border-b border-slate-50">
                <td class="py-1.5 pr-3 font-medium text-slate-800 cursor-pointer hover:text-brand-700" onClick=${() => { setCluster(c.cluster); setView('keywords'); }}>${c.cluster}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${c.count}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${num(c.impressions)}</td>
                <td class="py-1.5 pr-3 text-right"><${Pill} cls=${oppColor(c.avgOpp)}>${c.avgOpp}</${Pill}></td>
                <td class="py-1.5 pr-3"><${Pill} cls=${intentColor[c.topIntent] || 'bg-slate-100 text-slate-600'}>${c.topIntent}</${Pill}></td>
                <td class="py-1.5 pr-3 text-right"><button onClick=${() => openContent(c.cluster, 'cluster')} class=${cx('text-xs px-2 py-1 rounded-lg border whitespace-nowrap', briefFor(c.cluster) ? 'border-brand-200 text-brand-700 bg-brand-50' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>${briefFor(c.cluster) ? 'View content' : '✨ Write'}</button></td>
              </tr>`)}</tbody>
            </table></div></${Card}>`
          : html`<${Card}><div class="p-3">
              ${briefs.length === 0
                ? html`<div class="p-6 text-center text-sm text-slate-500">No briefs yet. Open <span class="font-medium">Clusters</span> and click ✨ Brief on a topic to generate a page brief with AI.</div>`
                : html`<div class="divide-y divide-slate-100">${briefs.map((b) => html`<button onClick=${() => openContent(b.cluster, clusters.some((c) => c.cluster === b.cluster) ? 'cluster' : 'keyword')} class="w-full text-left py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded">
                    <div class="min-w-0"><div class="font-medium text-slate-800">${b.cluster}</div><div class="text-xs text-slate-500 truncate">${b.title}</div></div>
                    <${Pill} cls="bg-slate-100 text-slate-600 shrink-0">${(b.format || b.page_type || '').replace('_', ' ')}</${Pill}>
                  </button>`)}</div>`}
            </div></${Card}>`}
      `}
    ${openCluster && html`<${ContentModal} cluster=${openCluster} brief=${briefs.find((b) => b.cluster === openCluster)} busy=${briefBusy === openCluster} error=${err} onClose=${() => setOpenCluster(null)} onGen=${(fmt) => genBrief(openCluster, openKind, fmt)} />`}
  </div>`;
}

// Minimal, safe Markdown -> preact vnodes (headings, bold, links, lists, paragraphs).
function mdInline(s) {
  const parts = []; const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let m, last = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[2] !== undefined) parts.push(html`<strong>${m[2]}</strong>`);
    else parts.push(html`<a href=${m[5]} target="_blank" rel="noopener" class="text-brand-700 underline">${m[4]}</a>`);
    last = re.lastIndex;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
function mdRender(md) {
  const out = []; let list = null; let table = null;
  const flushList = () => { if (list) { out.push(html`<ul class="list-disc ml-5 space-y-1 text-slate-700">${list}</ul>`); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const rows = table.map((l) => l.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()))
      .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
    table = null;
    if (!rows.length) return;
    const [head, ...rest] = rows;
    out.push(html`<div class="overflow-x-auto my-2"><table class="w-full text-sm border border-slate-200 rounded-lg">
      <thead><tr class="bg-slate-50">${head.map((c) => html`<th class="text-left px-3 py-1.5 font-semibold text-slate-700 border-b border-slate-200">${mdInline(c)}</th>`)}</tr></thead>
      <tbody>${rest.map((r) => html`<tr class="border-b border-slate-100 last:border-0">${r.map((c) => html`<td class="px-3 py-1.5 text-slate-700 align-top">${mdInline(c)}</td>`)}</tr>`)}</tbody>
    </table></div>`);
  };
  const flush = () => { flushList(); flushTable(); };
  for (const ln of (md || '').split(/\r?\n/)) {
    if (/^\s*\|.*\|\s*$/.test(ln)) { flushList(); if (!table) table = []; table.push(ln); }
    else if (/^\s*###\s+/.test(ln)) { flush(); out.push(html`<h3 class="font-semibold text-slate-800 mt-3">${mdInline(ln.replace(/^\s*###\s+/, ''))}</h3>`); }
    else if (/^\s*##\s+/.test(ln)) { flush(); out.push(html`<h2 class="text-lg font-bold text-slate-800 mt-4">${mdInline(ln.replace(/^\s*##\s+/, ''))}</h2>`); }
    else if (/^\s*#\s+/.test(ln)) { flush(); out.push(html`<h1 class="text-xl font-bold text-slate-900 mt-1">${mdInline(ln.replace(/^\s*#\s+/, ''))}</h1>`); }
    else if (/^\s*[-*]\s+/.test(ln)) { flushTable(); if (!list) list = []; list.push(html`<li>${mdInline(ln.replace(/^\s*[-*]\s+/, ''))}</li>`); }
    else if (ln.trim() === '') { flush(); }
    else { flush(); out.push(html`<p class="text-slate-700">${mdInline(ln)}</p>`); }
  }
  flush();
  return out;
}

function ContentModal({ cluster, brief, busy, error, onClose, onGen }) {
  const [copied, setCopied] = useState(false);
  const has = brief && brief.content;
  const copy = async () => { try { await navigator.clipboard.writeText(brief.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) { /* ignore */ } };
  const footer = has ? html`<div class="flex justify-between items-center w-full gap-2">
    <div class="flex gap-2">
      <${Btn} size="sm" onClick=${() => onGen('blog')} disabled=${busy}>${busy ? '…' : 'Rewrite as blog'}</${Btn}>
      <${Btn} size="sm" onClick=${() => onGen('service')} disabled=${busy}>${busy ? '…' : 'Rewrite as page'}</${Btn}>
    </div>
    <${Btn} size="sm" onClick=${copy}>${copied ? 'Copied ✓' : 'Copy markdown'}</${Btn}>
  </div>` : null;
  return html`<${Modal} title=${`Content — ${cluster}`} wide onClose=${onClose} footer=${footer}>
    ${!has ? html`<div class="text-center space-y-4 py-4">
        <div class="text-sm text-slate-600">Generate publish-ready copy for <span class="font-medium">${cluster}</span>. Pick the format:</div>
        <div class="flex justify-center gap-3">
          <${Btn} onClick=${() => onGen('blog')} disabled=${busy}>${busy ? 'Writing…' : '📝 Blog post'}</${Btn}>
          <${Btn} onClick=${() => onGen('service')} disabled=${busy}>${busy ? 'Writing…' : '🧰 Service page'}</${Btn}>
        </div>
        ${busy && html`<div class="text-xs text-slate-500 animate-pulse">Researching authorities, writing, and quality-checking — usually 1–3 minutes. You can close this and check the Briefs tab later.</div>`}
        ${error && html`<div class="text-sm text-rose-600">${error}</div>`}
        <div class="text-xs text-slate-400">Includes SEO title/meta, internal links to your existing pages, and researched citations of industry authorities (licensing boards, governing bodies, supporting sources).</div>
      </div>`
      : html`<div class="space-y-4 text-sm">
        <div class="flex flex-wrap gap-2 items-center">
          <${Pill} cls="bg-brand-100 text-brand-700">${(brief.format || brief.page_type || '').replace('_', ' ')}</${Pill}>
          <${Pill} cls="bg-slate-100 text-slate-600">Schema: ${brief.schema_type}</${Pill}>
          ${brief.slug && html`<span class="text-xs text-slate-400">/${brief.slug}</span>`}
        </div>
        <div class="rounded-lg bg-slate-50 p-3 space-y-1">
          <div><span class="text-xs font-semibold text-slate-400 uppercase">Title</span> <span class="text-slate-800">${brief.title}</span></div>
          <div><span class="text-xs font-semibold text-slate-400 uppercase">Meta</span> <span class="text-slate-600">${brief.meta}</span></div>
        </div>
        <article class="space-y-2">${mdRender(brief.content)}</article>
        ${(brief.internal_links || []).length > 0 && html`<div class="pt-2 border-t border-slate-100">
          <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Internal links used</div>
          <ul class="list-disc ml-5 text-slate-600">${brief.internal_links.map((l) => html`<li><a href=${l.url} target="_blank" rel="noopener" class="text-brand-700 underline">${l.anchor}</a></li>`)}</ul>
        </div>`}
        ${(brief.external_links || []).length > 0 && html`<div class="pt-2 border-t border-slate-100">
          <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Authority citations <span class="font-normal normal-case text-slate-400">— researched &amp; verified external sources</span></div>
          <ul class="list-disc ml-5 text-slate-600">${brief.external_links.map((l) => html`<li>
            <a href=${l.url} target="_blank" rel="noopener" class="text-brand-700 underline">${l.anchor}</a>
            ${l.source_type && html`<span class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">${String(l.source_type).replace('_', ' ')}</span>`}
          </li>`)}</ul>
        </div>`}
      </div>`}
  </${Modal}>`;
}
