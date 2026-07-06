// ---------------------------------------------------------------------------
// keywords.js — Keyword intelligence: the keyword database built from GSC, with
// search-intent classification, topic clusters, and an opportunity score.
// (Volume/CPC columns light up once Google Ads Keyword Planner is connected.)
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadKeywords, seoKeywordsRebuild, seoSetBrandTerms, seoBriefGenerate, seoLoadBriefs } from './store.js';
import { Card, Btn, Select, Input, Modal } from './ui.js';

const num = (n) => (n || 0).toLocaleString();
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
  const [showBrief, setShowBrief] = useState(null);
  const [briefBusy, setBriefBusy] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const loadKw = async (sid) => { setRows(await seoLoadKeywords(sid)); };
  useEffect(() => { if (site) { loadKw(site); seoLoadBriefs(site).then(setBriefs); } else { setRows([]); setBriefs([]); } }, [site]);
  useEffect(() => { const s = (sites || []).find((x) => x.id === site); setBrand((s?.brand_terms || []).join(', ')); }, [site, sites]);

  const rebuild = async () => {
    setBusy(true); setErr(''); setBanner('');
    try { const r = await seoKeywordsRebuild(site); setBanner(`Built ${num(r.keywords)} keywords from Search Console.`); await loadKw(site); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveBrand = async () => {
    setBusy(true); setErr(''); setBanner('');
    try {
      const terms = brand.split(',').map((t) => t.trim()).filter(Boolean);
      await seoSetBrandTerms(site, terms);
      setSites(await seoLoadSites());
      await seoKeywordsRebuild(site);
      setBanner('Brand terms saved — keywords rebuilt.');
      await loadKw(site);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const genBrief = async (cl) => {
    setBriefBusy(cl); setErr('');
    try { const r = await seoBriefGenerate(site, cl); setShowBrief(r.brief); setBriefs(await seoLoadBriefs(site)); }
    catch (e) { setErr(e.message); } finally { setBriefBusy(''); }
  };
  const openBrief = (cl) => { const b = briefs.find((x) => x.cluster === cl); if (b) setShowBrief(b); else genBrief(cl); };
  const briefFor = (cl) => briefs.some((x) => x.cluster === cl);

  const clusters = useMemo(() => {
    const m = new Map();
    for (const k of rows) { let c = m.get(k.cluster); if (!c) { c = { cluster: k.cluster, count: 0, impressions: 0, oppSum: 0, intents: {} }; m.set(k.cluster, c); } c.count++; c.impressions += k.impressions; c.oppSum += Number(k.opportunity); c.intents[k.intent] = (c.intents[k.intent] || 0) + 1; }
    return [...m.values()].map((c) => ({ ...c, avgOpp: Math.round(c.oppSum / c.count), topIntent: Object.entries(c.intents).sort((a, b) => b[1] - a[1])[0]?.[0] })).sort((a, b) => b.oppSum - a.oppSum);
  }, [rows]);

  const clusterOptions = useMemo(() => ['all', ...[...new Set(rows.map((r) => r.cluster))].sort()], [rows]);
  const filtered = useMemo(() => rows.filter((r) =>
    (intent === 'all' || r.intent === intent) && (cluster === 'all' || r.cluster === cluster) && (!q || r.keyword.toLowerCase().includes(q.toLowerCase()))
  ), [rows, intent, cluster, q]);

  const stats = useMemo(() => ({ total: rows.length, clusters: clusters.length, high: rows.filter((r) => r.opportunity >= 75).length, avg: rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.opportunity), 0) / rows.length) : 0 }), [rows, clusters]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading keywords…</div>`;

  const Head = () => html`<div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-xl font-bold text-slate-800">Keyword Intelligence</h1>
      <p class="text-sm text-slate-500">Your keyword database — intent, topic clusters, and opportunity, built from Search Console.</p>
    </div>
    <div class="flex items-center gap-2">
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
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

    ${rows.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No keywords yet. Click <span class="font-medium">Build / refresh</span> to generate the keyword database from your Search Console data.</div></${Card}>`
      : html`
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${[['Keywords', num(stats.total)], ['Topic clusters', num(stats.clusters)], ['High opportunity', num(stats.high), 'score ≥ 75'], ['Avg opportunity', stats.avg]]
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
                <th class="py-1.5 pr-3">Opp.</th><th class="py-1.5 pr-3">Keyword</th><th class="py-1.5 pr-3">Intent</th><th class="py-1.5 pr-3">Cluster</th>
                <th class="py-1.5 pr-3 text-right">Impr.</th><th class="py-1.5 pr-3 text-right">Pos.</th><th class="py-1.5 pr-3">Recommended action</th></tr></thead>
              <tbody>${filtered.slice(0, 250).map((k) => html`<tr class="border-b border-slate-50">
                <td class="py-1.5 pr-3"><${Pill} cls=${oppColor(k.opportunity)}>${k.opportunity}</${Pill}></td>
                <td class="py-1.5 pr-3 font-medium text-slate-800 max-w-xs truncate">${k.keyword}</td>
                <td class="py-1.5 pr-3"><${Pill} cls=${intentColor[k.intent] || 'bg-slate-100 text-slate-600'}>${k.intent}</${Pill}></td>
                <td class="py-1.5 pr-3 text-slate-500 truncate max-w-[8rem]">${k.cluster}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${num(k.impressions)}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${posf(k.position)}</td>
                <td class="py-1.5 pr-3 text-slate-600">${k.recommended_action}</td>
              </tr>`)}</tbody>
            </table>
            ${filtered.length > 250 && html`<div class="text-xs text-slate-400 pt-2">Showing top 250 of ${num(filtered.length)}.</div>`}
          </div></${Card}>`
          : view === 'clusters'
          ? html`<${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
              <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                <th class="py-1.5 pr-3">Cluster</th><th class="py-1.5 pr-3 text-right">Keywords</th><th class="py-1.5 pr-3 text-right">Impr.</th><th class="py-1.5 pr-3 text-right">Avg opp.</th><th class="py-1.5 pr-3">Primary intent</th><th class="py-1.5 pr-3"></th></tr></thead>
              <tbody>${clusters.map((c) => html`<tr class="border-b border-slate-50">
                <td class="py-1.5 pr-3 font-medium text-slate-800 cursor-pointer hover:text-brand-700" onClick=${() => { setCluster(c.cluster); setView('keywords'); }}>${c.cluster}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${c.count}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${num(c.impressions)}</td>
                <td class="py-1.5 pr-3 text-right"><${Pill} cls=${oppColor(c.avgOpp)}>${c.avgOpp}</${Pill}></td>
                <td class="py-1.5 pr-3"><${Pill} cls=${intentColor[c.topIntent] || 'bg-slate-100 text-slate-600'}>${c.topIntent}</${Pill}></td>
                <td class="py-1.5 pr-3 text-right"><button onClick=${() => openBrief(c.cluster)} disabled=${briefBusy === c.cluster} class=${cx('text-xs px-2 py-1 rounded-lg border whitespace-nowrap', briefFor(c.cluster) ? 'border-brand-200 text-brand-700 bg-brand-50' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>${briefBusy === c.cluster ? 'Writing…' : briefFor(c.cluster) ? 'View brief' : '✨ Brief'}</button></td>
              </tr>`)}</tbody>
            </table></div></${Card}>`
          : html`<${Card}><div class="p-3">
              ${briefs.length === 0
                ? html`<div class="p-6 text-center text-sm text-slate-500">No briefs yet. Open <span class="font-medium">Clusters</span> and click ✨ Brief on a topic to generate a page brief with AI.</div>`
                : html`<div class="divide-y divide-slate-100">${briefs.map((b) => html`<button onClick=${() => setShowBrief(b)} class="w-full text-left py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded">
                    <div class="min-w-0"><div class="font-medium text-slate-800">${b.cluster}</div><div class="text-xs text-slate-500 truncate">${b.title}</div></div>
                    <${Pill} cls="bg-slate-100 text-slate-600 shrink-0">${(b.page_type || '').replace('_', ' ')}</${Pill}>
                  </button>`)}</div>`}
            </div></${Card}>`}
      `}
    ${showBrief && html`<${BriefModal} brief=${showBrief} busy=${briefBusy === showBrief.cluster} onClose=${() => setShowBrief(null)} onRegen=${() => genBrief(showBrief.cluster)} />`}
  </div>`;
}

function BriefModal({ brief, busy, onClose, onRegen }) {
  const label = { text: 'text-xs font-semibold text-slate-400 uppercase tracking-wide' };
  return html`<${Modal} title=${`Content brief — ${brief.cluster}`} wide onClose=${onClose}
    footer=${html`<div class="flex justify-between items-center w-full"><span class="text-xs text-slate-400">AI-generated · edit before publishing</span><${Btn} size="sm" onClick=${onRegen} disabled=${busy}>${busy ? 'Regenerating…' : 'Regenerate'}</${Btn}></div>`}>
    <div class="space-y-4 text-sm">
      <div class="flex flex-wrap gap-2">
        <${Pill} cls="bg-brand-100 text-brand-700">${(brief.page_type || '').replace('_', ' ')}</${Pill}>
        <${Pill} cls="bg-slate-100 text-slate-600">Schema: ${brief.schema_type}</${Pill}>
      </div>
      <div><div class=${label.text}>Title tag</div><div class="text-slate-800 font-medium">${brief.title}</div></div>
      <div><div class=${label.text}>Meta description</div><div class="text-slate-600">${brief.meta}</div></div>
      <div><div class=${label.text}>H1</div><div class="text-slate-800 font-medium">${brief.h1}</div></div>
      <div><div class=${cx(label.text, 'mb-1')}>Outline</div>
        <div class="space-y-2">${(brief.outline || []).map((s) => html`<div>
          <div class="font-medium text-slate-800">${s.h2}</div>
          <ul class="list-disc ml-5 text-slate-600">${(s.points || []).map((p) => html`<li>${p}</li>`)}</ul>
        </div>`)}</div>
      </div>
      <div><div class=${cx(label.text, 'mb-1')}>FAQs</div>
        <div class="space-y-2">${(brief.faqs || []).map((f) => html`<div><div class="font-medium text-slate-700">${f.q}</div><div class="text-slate-600">${f.a}</div></div>`)}</div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><div class=${cx(label.text, 'mb-1')}>Internal links</div><ul class="list-disc ml-5 text-slate-600">${(brief.internal_links || []).map((l) => html`<li>${l}</li>`)}</ul></div>
        <div><div class=${cx(label.text, 'mb-1')}>Target keywords</div><div class="text-slate-500 text-xs leading-relaxed">${(brief.keywords || []).slice(0, 15).join(' · ')}</div></div>
      </div>
      <div><div class=${label.text}>Call to action</div><div class="text-slate-700">${brief.cta}</div></div>
    </div>
  </${Modal}>`;
}
