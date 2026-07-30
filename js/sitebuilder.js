// ---------------------------------------------------------------------------
// sitebuilder.js — Site Builder tab: the website strategy document.
// Enumerates every page a local-service site should have (core, conversion,
// compliance, pillar+spoke services, county + city, prioritized geo) from the
// business's services (brand-kit categories) and service area, then flags each
// page against the connected WordPress site (already live vs still to build).
// Backend: seo-sitebuilder fn. This tab renders + exports the plan; it does not
// build pages yet (that's a later increment).
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoSiteBuilderGet, seoSiteBuilderGenerate } from './store.js';
import { Card, Btn, Select } from './ui.js';

const TYPE_BADGE = {
  core: ['Core', 'bg-slate-100 text-slate-600'],
  conversion: ['Convert', 'bg-emerald-100 text-emerald-700'],
  compliance: ['Legal', 'bg-slate-100 text-slate-500'],
  pillar: ['Pillar', 'bg-brand-100 text-brand-700'],
  service: ['Service', 'bg-sky-100 text-sky-700'],
  county: ['County', 'bg-amber-100 text-amber-700'],
  city: ['City', 'bg-amber-50 text-amber-600'],
  geo: ['Geo', 'bg-violet-100 text-violet-700'],
};

function Stat({ label, value, tone }) {
  return html`<div class="rounded-lg border border-slate-100 px-3 py-2">
    <div class=${cx('text-lg font-semibold', tone || 'text-slate-800')}>${value}</div>
    <div class="text-[11px] text-slate-400">${label}</div>
  </div>`;
}

export function SiteBuilder() {
  useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [data, setData] = useState(undefined); // undefined=loading, null=none yet, {plan,stats,generatedAt}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }).catch(() => setSites([])); }, [accountId]);
  useEffect(() => {
    setErr(''); if (!site) { setData(null); return; }
    setData(undefined);
    seoSiteBuilderGet(site).then((r) => setData(r?.plan ? r : null)).catch((e) => { setErr(e.message); setData(null); });
  }, [site]);

  const generate = async () => {
    setBusy(true); setErr('');
    try { const r = await seoSiteBuilderGenerate(site); setData(r); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const plan = data && data.plan ? data.plan : null;
  const stats = data && data.stats ? data.stats : null;

  const urlList = () => plan ? plan.sections.flatMap((s) => s.pages.map((p) => p.url)).join('\n') : '';
  const markdown = () => {
    if (!plan) return '';
    const b = plan.business || {};
    const out = [`# Website strategy — ${b.name || ''}`, ''];
    if (b.industry) out.push(`Industry: ${b.industry}`);
    if (b.homeCity || b.state) out.push(`Based in: ${[b.homeCity, b.state].filter(Boolean).join(', ')}`);
    out.push(`Total pages planned: ${stats?.total ?? ''}` + (plan.wp?.checked ? ` (${stats?.exists ?? 0} already live, ${stats?.new ?? 0} to build)` : ''));
    out.push('');
    for (const sec of plan.sections) {
      if (!sec.pages.length) continue;
      out.push(`## ${sec.label} (${sec.pages.length})`);
      if (sec.desc) out.push(`_${sec.desc}_`);
      for (const p of sec.pages) out.push(`- ${p.url} — ${p.title}${plan.wp?.checked ? ` [${p.status === 'exists' ? 'live' : 'build'}]` : ''}${p.purpose ? `  \n  ${p.purpose}` : ''}`);
      out.push('');
    }
    return out.join('\n');
  };
  const copy = (text, tag) => { navigator.clipboard.writeText(text).then(() => { setCopied(tag); setTimeout(() => setCopied(''), 1500); }, () => {}); };

  return html`<div class="space-y-4">
    <div class="flex items-start justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-lg font-semibold text-slate-800">🧱 Site Builder</h2>
        <p class="text-sm text-slate-500">A complete website page plan built from sound local-SEO structure — core, conversion, and compliance pages, a pillar page per service category with a page for every service, a page for every county and city you serve, and geo landing pages for your priority cities. Each page is checked against your live site.</p>
      </div>
      <div class="flex items-center gap-2">
        ${sites && sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
        <${Btn} variant="cta" onClick=${generate} disabled=${!site || busy}>${busy ? 'Building…' : plan ? '↻ Regenerate' : 'Generate strategy'}</${Btn}>
      </div>
    </div>

    ${err && html`<div class="text-sm text-rose-600 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">${err}</div>`}
    ${busy && html`<${Card}><div class="p-4 text-sm text-slate-500">Analyzing your services, service area, and live site… this takes a few seconds.</div></${Card}>`}

    ${data === undefined && !busy && html`<${Card}><div class="p-4 text-sm text-slate-400">Loading…</div></${Card}>`}
    ${data === null && !busy && html`<${Card}><div class="p-6 text-center">
      <div class="text-4xl mb-2">🗺️</div>
      <div class="font-medium text-slate-700">No strategy generated yet</div>
      <p class="text-sm text-slate-500 mt-1 max-w-lg mx-auto">Generate a full page plan from your service categories (Brand kit, Social tab) and your service area (Strategy tab). The more complete those are, the more complete the plan.</p>
    </div></${Card}>`}

    ${plan && !busy && html`
      <${Card}><div class="p-4 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div class="font-semibold text-slate-800">${plan.business?.name || 'Business'} ${plan.business?.industry ? html`<span class="text-slate-400 font-normal">· ${plan.business.industry}</span>` : ''}</div>
            <div class="text-[11px] text-slate-400">${data.generatedAt ? `Generated ${new Date(data.generatedAt).toLocaleString()}` : ''}${plan.business?.domain ? ` · ${plan.business.domain}` : ''}</div>
          </div>
          <div class="flex items-center gap-2">
            <${Btn} size="sm" variant="secondary" onClick=${() => copy(urlList(), 'urls')}>${copied === 'urls' ? '✓ Copied' : 'Copy URLs'}</${Btn}>
            <${Btn} size="sm" variant="secondary" onClick=${() => copy(markdown(), 'md')}>${copied === 'md' ? '✓ Copied' : 'Copy as document'}</${Btn}>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <${Stat} label="Total pages" value=${stats?.total ?? 0} />
          <${Stat} label="To build" value=${stats?.new ?? 0} tone="text-amber-600" />
          <${Stat} label=${plan.wp?.checked ? 'Already live' : 'Live site not checked'} value=${plan.wp?.checked ? (stats?.exists ?? 0) : '—'} tone="text-emerald-600" />
          <${Stat} label="Priority geo cities" value=${(plan.geo?.topCities || []).length} tone="text-violet-600" />
        </div>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span>${plan.pillarsUsed || 0} categories · ${plan.servicesUsed || 0} services · ${plan.counties || 0} counties · ${plan.cities || 0} cities</span>
          ${plan.wp?.checked
            ? html`<span class="text-emerald-600">✓ Cross-checked against ${plan.wp.url} (${plan.wp.existingPages} live pages)</span>`
            : html`<span class="text-amber-600">⚠ No connected WordPress site — every page is shown as “to build”. Connect the site to see what already exists.</span>`}
        </div>
        ${(plan.geo?.topCities || []).length > 0 && html`<div class="text-[11px] text-slate-400">Geo priority cities: ${(plan.geo.topCities).join(', ')}</div>`}
      </div></${Card}>

      ${plan.sections.filter((s) => s.pages.length).map((sec) => html`<${Card} key=${sec.key}><div class="p-4">
        <div class="flex items-baseline justify-between gap-2 mb-1">
          <div class="font-semibold text-slate-800">${sec.label} <span class="text-slate-400 font-normal">(${sec.pages.length})</span></div>
        </div>
        ${sec.desc && html`<p class="text-xs text-slate-400 mb-2.5">${sec.desc}</p>`}
        <div class="divide-y divide-slate-50">
          ${sec.pages.map((p, i) => html`<div class="flex items-start gap-2 py-1.5" key=${i}>
            <span class=${cx('shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium', (TYPE_BADGE[p.type] || TYPE_BADGE.core)[1])}>${(TYPE_BADGE[p.type] || TYPE_BADGE.core)[0]}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm text-slate-700 font-medium">${p.title}</span>
                <code class="text-[11px] text-slate-400 break-all">${p.url}</code>
                ${plan.wp?.checked && html`<span class=${cx('text-[10px] px-1.5 py-0.5 rounded-full', p.status === 'exists' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>${p.status === 'exists' ? 'live' : 'build'}</span>`}
              </div>
              ${p.purpose && html`<div class="text-[11px] text-slate-400">${p.purpose}</div>`}
            </div>
          </div>`)}
        </div>
      </div></${Card}>`)}
    `}
  </div>`;
}
