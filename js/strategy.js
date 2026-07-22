// ---------------------------------------------------------------------------
// strategy.js — Marketing Strategy tab: the steering wheel for content.
//  1) Service pages: pull the site's sitemap, flag which pages are services
//     (with a human service name) — these become the topics content pushes.
//  2) Service area: pick counties → every city auto-populates from the
//     us_cities reference table; click a city to exclude it. Blog + social
//     generation targets only the included cities.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoStrategySitemap, seoStrategyPages, seoStrategyPagesSave, seoStrategyAreaGet, seoStrategyAreaSave, seoStrategyCounties, seoStrategyCities } from './store.js';
import { Card, Btn, Input, Select } from './ui.js';

const US_STATES = [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']];

// '/services/roof-repair/' → 'Roof Repair'
function slugTitle(path) {
  const seg = String(path || '').split('/').filter(Boolean).pop() || '';
  return seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function Strategy() {
  useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');

  // service pages
  const [pages, setPages] = useState(null);
  const [filter, setFilter] = useState('');
  const [pagesDirty, setPagesDirty] = useState(false);

  // service area
  const [stateCode, setStateCode] = useState('');
  const [counties, setCounties] = useState(null);   // [{county, cities}] for the state
  const [selCounties, setSelCounties] = useState(new Set());
  const [cities, setCities] = useState([]);         // [{city, county, excluded}]
  const [areaDirty, setAreaDirty] = useState(false);

  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);

  const loadAll = async (sid) => {
    setPages(null); setStateCode(''); setCounties(null); setSelCounties(new Set()); setCities([]); setPagesDirty(false); setAreaDirty(false); setErr('');
    try {
      const [p, a] = await Promise.all([seoStrategyPages(sid), seoStrategyAreaGet(sid)]);
      setPages(p.pages || []);
      const area = a.area;
      if (area?.state_code) {
        setStateCode(area.state_code);
        setSelCounties(new Set(area.counties || []));
        setCities(area.cities || []);
        try { const c = await seoStrategyCounties(area.state_code); setCounties(c.counties || []); } catch { setCounties([]); }
      }
    } catch (e) { setErr(e.message); setPages([]); }
  };
  useEffect(() => { if (site) loadAll(site); }, [site]);

  // ── service pages ─────────────────────────────────────────────
  const pullSitemap = async () => {
    setBusy('sitemap'); setErr(''); setBanner('');
    try {
      const r = await seoStrategySitemap(site);
      const p = await seoStrategyPages(site);
      setPages(p.pages || []); setPagesDirty(false);
      setBanner(r.source === 'gsc'
        ? `🔍 No public sitemap — pulled ${r.found} pages from this site's Search Console data instead.`
        : `🗺 Sitemap pulled — ${r.found} pages found.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const togglePage = (url) => {
    setPages((p) => p.map((x) => x.url === url ? { ...x, is_service: !x.is_service, service_name: !x.is_service ? (x.service_name || slugTitle(x.path)) : x.service_name } : x));
    setPagesDirty(true);
  };
  const nameOf = (url, v) => { setPages((p) => p.map((x) => x.url === url ? { ...x, service_name: v } : x)); setPagesDirty(true); };
  const savePages = async () => {
    setBusy('pages'); setErr('');
    try {
      await seoStrategyPagesSave(site, pages.map((p) => ({ url: p.url, is_service: p.is_service, service_name: p.service_name })));
      setPagesDirty(false);
      setBanner(`⭐ ${pages.filter((p) => p.is_service).length} service page(s) saved.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  // ── service area ──────────────────────────────────────────────
  const pickState = async (st) => {
    setStateCode(st); setCounties(null); setSelCounties(new Set()); setCities([]); setAreaDirty(true);
    if (!st) return;
    try { const c = await seoStrategyCounties(st); setCounties(c.counties || []); } catch (e) { setErr(e.message); setCounties([]); }
  };
  const refreshCities = async (st, sel, prev) => {
    if (!sel.size) { setCities([]); return; }
    const r = await seoStrategyCities(st, [...sel]);
    const oldFlag = new Map(prev.map((c) => [`${c.county}|${c.city}`, c.excluded]));
    setCities((r.cities || []).map((c) => ({ city: c.city, county: c.county, excluded: oldFlag.get(`${c.county}|${c.city}`) || false })));
  };
  const toggleCounty = async (county) => {
    const next = new Set(selCounties);
    if (next.has(county)) next.delete(county); else next.add(county);
    setSelCounties(next); setAreaDirty(true);
    try { await refreshCities(stateCode, next, cities); } catch (e) { setErr(e.message); }
  };
  const toggleCity = (c) => {
    setCities((p) => p.map((x) => (x.city === c.city && x.county === c.county) ? { ...x, excluded: !x.excluded } : x));
    setAreaDirty(true);
  };
  const saveArea = async () => {
    setBusy('area'); setErr('');
    try {
      const r = await seoStrategyAreaSave(site, stateCode, [...selCounties], cities);
      setAreaDirty(false);
      setBanner(`📍 Service area saved — ${r.included} of ${r.cities} cities targeted across ${r.counties} count${r.counties === 1 ? 'y' : 'ies'}.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading strategy…</div>`;
  if (sites.length === 0) return html`<div class="max-w-5xl mx-auto p-6"><${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}></div>`;

  const shownPages = (pages || []).filter((p) => !filter || (p.path || p.url).toLowerCase().includes(filter.toLowerCase()));
  const svcCount = (pages || []).filter((p) => p.is_service).length;
  const included = cities.filter((c) => !c.excluded);
  const byCounty = {};
  cities.forEach((c) => { (byCounty[c.county] = byCounty[c.county] || []).push(c); });

  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Marketing Strategy</h1>
        <p class="text-sm text-slate-500">Your services and service area — every blog and social post is steered by what you set here.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-800 flex items-center justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60 hover:opacity-100 ml-2">✕</button></div>`}

    <${Card}><div class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div class="font-semibold text-slate-800">⭐ Service pages <span class="text-xs font-normal text-slate-400">— ${svcCount ? `${svcCount} marked` : 'none marked yet'}</span></div>
        <div class="flex items-center gap-2">
          ${pagesDirty && html`<${Btn} size="sm" variant="cta" onClick=${savePages} disabled=${busy === 'pages'}>${busy === 'pages' ? 'Saving…' : 'Save services'}</${Btn}>`}
          <${Btn} size="sm" variant="secondary" onClick=${pullSitemap} disabled=${busy === 'sitemap' || !site}>${busy === 'sitemap' ? 'Pulling…' : (pages || []).length ? '↻ Re-pull sitemap' : '🗺 Pull sitemap'}</${Btn}>
        </div>
      </div>
      <p class="text-xs text-slate-400 mb-3">Pull the site map, then tick the pages that describe a service you sell. The service name is what content will be written about.</p>
      ${pages === null ? html`<div class="text-sm text-slate-400 py-2">Loading…</div>`
        : (pages || []).length === 0 ? html`<div class="text-sm text-slate-400 py-4 text-center">No pages yet — click <span class="font-medium">Pull sitemap</span>.</div>`
        : html`
          ${pages.length > 15 && html`<div class="mb-2 max-w-xs"><${Input} value=${filter} onInput=${setFilter} placeholder="Filter pages…" /></div>`}
          <div class="max-h-96 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-lg">
            ${shownPages.map((p) => html`<div class=${cx('flex items-center gap-3 px-3 py-1.5 flex-wrap', p.is_service && 'bg-brand-50/40')}>
              <input type="checkbox" checked=${p.is_service} onChange=${() => togglePage(p.url)} class="accent-brand-600 shrink-0" />
              <a href=${p.url} target="_blank" rel="noopener" class="flex-1 min-w-0 text-sm text-slate-600 hover:text-brand-700 truncate" title=${p.url}>${p.path || p.url}</a>
              ${p.is_service && html`<div class="w-56 max-w-full"><${Input} value=${p.service_name || ''} onInput=${(v) => nameOf(p.url, v)} placeholder=${slugTitle(p.path)} /></div>`}
            </div>`)}
          </div>
          <div class="text-[11px] text-slate-400 mt-1.5">${shownPages.length} of ${pages.length} pages shown${pagesDirty ? ' — unsaved changes' : ''}</div>`}
    </div></${Card}>

    <${Card}><div class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div class="font-semibold text-slate-800">📍 Service area <span class="text-xs font-normal text-slate-400">— ${included.length ? `${included.length} cities targeted` : 'not set yet'}</span></div>
        ${areaDirty && html`<${Btn} size="sm" variant="cta" onClick=${saveArea} disabled=${busy === 'area' || !stateCode}>${busy === 'area' ? 'Saving…' : 'Save service area'}</${Btn}>`}
      </div>
      <p class="text-xs text-slate-400 mb-3">Pick the counties you serve — every city in them is added automatically. Click a city to exclude it from marketing content (excluded cities show struck through).</p>
      <div class="flex flex-wrap items-end gap-2 mb-3">
        <div class="min-w-[220px]">
          <label class="text-[11px] text-slate-400">State</label>
          <${Select} value=${stateCode} onChange=${pickState} options=${[{ value: '', label: '— choose a state —' }, ...US_STATES.map(([v, l]) => ({ value: v, label: l }))]} />
        </div>
      </div>
      ${stateCode && (counties === null ? html`<div class="text-sm text-slate-400 py-2">Loading counties…</div>` : html`
        <div class="mb-3">
          <div class="text-xs font-medium text-slate-500 mb-1.5">Counties served</div>
          <div class="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
            ${counties.map((c) => html`<button onClick=${() => toggleCounty(c.county)}
              class=${cx('text-xs px-2.5 py-1 rounded-full border transition', selCounties.has(c.county) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
              ${c.county} <span class="opacity-60">(${c.cities})</span></button>`)}
          </div>
        </div>`)}
      ${Object.keys(byCounty).sort().map((county) => html`<div class="mb-2">
        <div class="text-xs font-medium text-slate-500 mb-1">${county} County <span class="font-normal text-slate-400">— ${byCounty[county].filter((c) => !c.excluded).length} of ${byCounty[county].length} targeted</span></div>
        <div class="flex flex-wrap gap-1.5">
          ${byCounty[county].map((c) => html`<button onClick=${() => toggleCity(c)} title=${c.excluded ? 'Excluded — click to include' : 'Targeted — click to exclude'}
            class=${cx('text-xs px-2.5 py-1 rounded-full border transition', c.excluded ? 'border-slate-200 text-slate-300 line-through' : 'border-emerald-300 bg-emerald-50 text-emerald-800')}>
            ${c.city}</button>`)}
        </div>
      </div>`)}
    </div></${Card}>

    <${Card}><div class="p-4 border-l-4 border-brand-300">
      <div class="font-semibold text-slate-800 mb-1">How this steers your content</div>
      <p class="text-sm text-slate-500">Blog briefs and auto-blogging use your <span class="font-medium">service pages</span> as the topics that matter and write for the <span class="font-medium">targeted cities</span> (local intent, "near me", city + service pages). The Social Media planner will build monthly calendars from the same services and cities. Update this page any time — new content picks it up immediately.</p>
    </div></${Card}>
  </div>`;
}
