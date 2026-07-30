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
import { useStore, getActiveAccountId, seoLoadSites, seoSiteBuilderGet, seoSiteBuilderGenerate, seoSiteBuilderLink, seoSiteBuilderPageCopy, seoSiteBuilderPageGet } from './store.js';
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

// Renders a generated page copy deck (SEO meta, H1, sections, FAQ, CTA, links,
// image specs, client flags).
function CopyDeck({ copy, page }) {
  const meta = [['Focus keyword', copy.focus_keyword], ['SEO title', copy.meta_title], ['Meta description', copy.meta_description], ['URL', copy.url_slug || page.url], ['Schema', copy.schema]].filter(([, v]) => v);
  return html`<div class="space-y-3">
    <div class="rounded-lg bg-slate-50 border border-slate-100 p-2.5 space-y-1">
      ${meta.map(([k, v]) => html`<div class="text-[12px]"><span class="text-slate-400">${k}:</span> <span class="text-slate-700">${v}</span></div>`)}
    </div>
    ${copy.h1 && html`<h3 class="text-base font-bold text-slate-800">${copy.h1}</h3>`}
    ${(copy.sections || []).map((s) => html`<div>
      <div class="font-semibold text-slate-700">${s.h2}</div>
      ${String(s.body || '').split(/\n\n+/).filter(Boolean).map((para) => html`<p class="text-slate-600 mt-1 whitespace-pre-line">${para}</p>`)}
    </div>`)}
    ${(copy.faqs || []).length ? html`<div><div class="font-semibold text-slate-700 mb-1">FAQ</div>
      ${copy.faqs.map((f) => html`<div class="mb-2"><div class="text-slate-700 font-medium">${f.q}</div><div class="text-slate-600">${f.a}</div></div>`)}
    </div>` : ''}
    ${copy.primary_cta && html`<div class="text-[12px]"><span class="text-slate-400">Primary CTA:</span> <span class="text-brand-700 font-medium">${copy.primary_cta}</span></div>`}
    ${(copy.internal_links || []).length ? html`<div class="text-[12px]"><div class="text-slate-400 mb-0.5">Internal links</div>${copy.internal_links.map((l) => html`<div class="text-slate-600">${l.anchor} → <code class="text-slate-400 break-all">${l.target}</code></div>`)}</div>` : ''}
    ${(copy.image_specs || []).length ? html`<div class="text-[12px]"><div class="text-slate-400 mb-0.5">Images</div>${copy.image_specs.map((im) => html`<div class="text-slate-600">${im.placement}: ${im.description} <span class="text-slate-400">(alt: ${im.alt})</span></div>`)}</div>` : ''}
    ${(copy.flags || []).length ? html`<div class="rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-[12px]"><div class="font-medium text-amber-700 mb-0.5">⚠ Confirm with client before publishing</div>${copy.flags.map((fl) => html`<div class="text-amber-700">• ${fl}</div>`)}</div>` : ''}
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
  const [links, setLinks] = useState({}); // suggested page url → live page url (owner-set)
  const [haveCopy, setHaveCopy] = useState(new Set()); // page urls that already have a copy deck
  const [copyBusy, setCopyBusy] = useState(''); // page url currently generating
  const [copyModal, setCopyModal] = useState(null); // { page, copy, generatedAt }
  const [bulk, setBulk] = useState(null); // { done, total } while generating all

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }).catch(() => setSites([])); }, [accountId]);
  useEffect(() => {
    setErr(''); if (!site) { setData(null); return; }
    setData(undefined);
    seoSiteBuilderGet(site).then((r) => setData(r?.plan ? r : null)).catch((e) => { setErr(e.message); setData(null); });
  }, [site]);
  // Keep the local link map + copy-status set in sync with the backend.
  useEffect(() => { setLinks(data && data.links && typeof data.links === 'object' ? { ...data.links } : {}); }, [data]);
  useEffect(() => { setHaveCopy(new Set(data && Array.isArray(data.copied) ? data.copied : [])); }, [data]);

  const generate = async () => {
    setBusy(true); setErr('');
    try { const r = await seoSiteBuilderGenerate(site); setData(r); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const plan = data && data.plan ? data.plan : null;
  const stats = data && data.stats ? data.stats : null;

  // Live pages from the connected site, for the per-suggestion "link to a live
  // page" picker. A page counts as live if it auto-matched OR the owner linked it.
  const livePages = (plan && plan.wp && Array.isArray(plan.wp.livePages)) ? plan.wp.livePages : [];
  const liveMap = {}; for (const lp of livePages) liveMap[lp.url] = lp.title;
  const canLink = !!(plan && plan.wp && plan.wp.connected && livePages.length);
  const isLive = (p) => !!links[p.url] || p.autoMatch;
  const allPages = plan ? plan.sections.flatMap((s) => s.pages) : [];
  const liveCount = allPages.filter(isLive).length;
  const buildCount = allPages.length - liveCount;
  const showLive = !!(plan && plan.wp && (plan.wp.checked || Object.keys(links).length));

  const linkPage = (pageUrl, val) => {
    const v = String(val || '').trim();
    if (v && liveMap[v] === undefined) return; // only accept a real live page (or clear)
    setLinks((prev) => { const n = { ...prev }; if (v) n[pageUrl] = v; else delete n[pageUrl]; return n; });
    seoSiteBuilderLink(site, pageUrl, v).catch((e) => setErr(e.message));
  };

  // --- Page copy generation ---
  const genCopy = async (page) => {
    setCopyBusy(page.url); setErr('');
    try {
      const r = await seoSiteBuilderPageCopy(site, page.url);
      setHaveCopy((prev) => new Set(prev).add(page.url));
      setCopyModal({ page, copy: r.copy, generatedAt: r.generatedAt });
    } catch (e) { setErr(`Copy for ${page.title}: ${e.message}`); }
    finally { setCopyBusy(''); }
  };
  const viewCopy = async (page) => {
    setCopyBusy(page.url); setErr('');
    try { const r = await seoSiteBuilderPageGet(site, page.url); setCopyModal({ page, copy: r.copy, generatedAt: r.generatedAt }); }
    catch (e) { setErr(e.message); }
    finally { setCopyBusy(''); }
  };
  const genAllCopy = async () => {
    const targets = allPages.filter((p) => !haveCopy.has(p.url));
    if (!targets.length) return;
    setErr(''); setBulk({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      try { await seoSiteBuilderPageCopy(site, targets[i].url); setHaveCopy((prev) => new Set(prev).add(targets[i].url)); }
      catch (e) { setErr(`Stopped on ${targets[i].title}: ${e.message}`); setBulk(null); return; }
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
  };
  const copyDeckMd = (page, copy) => {
    if (!copy) return '';
    const L = [`# ${copy.h1 || page.title}`, ''];
    if (copy.focus_keyword) L.push(`**Focus keyword:** ${copy.focus_keyword}`);
    if (copy.meta_title) L.push(`**SEO title:** ${copy.meta_title}`);
    if (copy.meta_description) L.push(`**Meta description:** ${copy.meta_description}`);
    L.push(`**URL:** ${copy.url_slug || page.url}`);
    if (copy.schema) L.push(`**Schema:** ${copy.schema}`);
    L.push('');
    for (const s of (copy.sections || [])) { L.push(`## ${s.h2}`); L.push(''); L.push(s.body); L.push(''); }
    if ((copy.faqs || []).length) { L.push('## FAQ'); L.push(''); for (const f of copy.faqs) { L.push(`**${f.q}**`); L.push(''); L.push(f.a); L.push(''); } }
    if (copy.primary_cta) { L.push(`**Primary CTA:** ${copy.primary_cta}`); L.push(''); }
    if ((copy.internal_links || []).length) { L.push('**Internal links:**'); for (const l of copy.internal_links) L.push(`- ${l.anchor} → ${l.target}`); L.push(''); }
    if ((copy.image_specs || []).length) { L.push('**Images:**'); for (const im of copy.image_specs) L.push(`- ${im.placement}: ${im.description} (alt: "${im.alt}")`); L.push(''); }
    if ((copy.flags || []).length) { L.push('**⚠ Confirm with client:**'); for (const fl of copy.flags) L.push(`- ${fl}`); }
    return L.join('\n');
  };

  const urlList = () => plan ? plan.sections.flatMap((s) => s.pages.map((p) => p.url)).join('\n') : '';
  const markdown = () => {
    if (!plan) return '';
    const b = plan.business || {};
    const out = [`# Website strategy — ${b.name || ''}`, ''];
    if (b.industry) out.push(`Industry: ${b.industry}`);
    if (b.homeCity || b.state) out.push(`Based in: ${[b.homeCity, b.state].filter(Boolean).join(', ')}`);
    out.push(`Total pages planned: ${allPages.length}` + (showLive ? ` (${liveCount} already live, ${buildCount} to build)` : ''));
    out.push('');
    for (const sec of plan.sections) {
      if (!sec.pages.length) continue;
      out.push(`## ${sec.label} (${sec.pages.length})`);
      if (sec.desc) out.push(`_${sec.desc}_`);
      for (const p of sec.pages) out.push(`- ${p.url} — ${p.title}${showLive ? ` [${isLive(p) ? 'live' : 'build'}]` : ''}${links[p.url] ? ` (→ ${links[p.url]})` : ''}${p.purpose ? `  \n  ${p.purpose}` : ''}`);
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
          <div class="flex items-center gap-2 flex-wrap">
            ${bulk
              ? html`<span class="text-xs text-slate-500">Writing copy… ${bulk.done}/${bulk.total}</span>`
              : html`<${Btn} size="sm" variant="secondary" onClick=${genAllCopy} disabled=${haveCopy.size >= allPages.length}>✍️ ${haveCopy.size >= allPages.length ? 'All copy written' : `Write copy for all (${allPages.length - haveCopy.size})`}</${Btn}>`}
            <${Btn} size="sm" variant="secondary" onClick=${() => copy(urlList(), 'urls')}>${copied === 'urls' ? '✓ Copied' : 'Copy URLs'}</${Btn}>
            <${Btn} size="sm" variant="secondary" onClick=${() => copy(markdown(), 'md')}>${copied === 'md' ? '✓ Copied' : 'Copy as document'}</${Btn}>
          </div>
        </div>
        ${haveCopy.size > 0 && html`<div class="text-[11px] text-slate-400">✍️ Copy written for ${haveCopy.size} of ${allPages.length} pages. Copy is saved and survives regeneration.</div>`}

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <${Stat} label="Total pages" value=${allPages.length || (stats?.total ?? 0)} />
          <${Stat} label="To build" value=${showLive ? buildCount : (allPages.length || (stats?.total ?? 0))} tone="text-amber-600" />
          <${Stat} label=${showLive ? 'Already live' : 'Live pages'} value=${showLive ? liveCount : '—'} tone="text-emerald-600" />
          <${Stat} label="Priority geo cities" value=${(plan.geo?.topCities || []).length} tone="text-violet-600" />
        </div>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span>${plan.pillarsUsed || 0} categories · ${plan.servicesUsed || 0} services · ${plan.counties || 0} counties · ${plan.cities || 0} cities</span>
          ${plan.wp?.checked
            ? html`<span class="text-emerald-600">✓ Cross-checked against ${plan.wp.url} (${plan.wp.existingPages} live pages${plan.wp.source === 'sitemap' ? ', via sitemap' : ''}) — pages already on the site are marked “live”.</span>`
            : plan.wp?.connected
              ? html`<span class="text-amber-600">⚠ Connected to ${plan.wp.url}, but its live pages couldn’t be read just now (the site or the Ops Dash Connector plugin didn’t respond, or a firewall blocked it). Every page is shown as “to build” — try Regenerate.</span>`
              : html`<span class="text-amber-600">⚠ No connected WordPress site — every page is shown as “to build”. Connect the site (Business tab) to see what already exists.</span>`}
        </div>
        ${(plan.geo?.topCities || []).length > 0 && html`<div class="text-[11px] text-slate-400">Geo priority cities: ${(plan.geo.topCities).join(', ')}</div>`}
        ${canLink && html`<div class="text-[11px] text-slate-400">Tip: for any page a match was missed on, use the “Live page” picker beside it to connect the suggestion to the page that already exists on your site.</div>`}
      </div></${Card}>

      ${canLink && html`<datalist id="ob-live-pages">${livePages.map((lp) => html`<option value=${lp.url}>${lp.title}</option>`)}</datalist>`}

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
                ${showLive && html`<span class=${cx('text-[10px] px-1.5 py-0.5 rounded-full', isLive(p) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>${isLive(p) ? (links[p.url] ? 'linked' : 'live') : 'build'}</span>`}
                ${haveCopy.has(p.url)
                  ? html`<button onClick=${() => viewCopy(p)} disabled=${copyBusy === p.url || !!bulk} class="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100">${copyBusy === p.url ? '…' : '✍️ view copy'}</button>`
                  : html`<button onClick=${() => genCopy(p)} disabled=${copyBusy === p.url || !!bulk} class="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700">${copyBusy === p.url ? 'writing…' : '✍️ write copy'}</button>`}
              </div>
              ${p.purpose && html`<div class="text-[11px] text-slate-400">${p.purpose}</div>`}
              ${canLink && !p.autoMatch && html`<div class="flex items-center gap-1.5 mt-1">
                <span class="text-[10px] text-slate-400 shrink-0">Live page:</span>
                <input list="ob-live-pages" value=${links[p.url] || ''} onChange=${(e) => linkPage(p.url, e.target.value)}
                  placeholder="link a page that already exists…" class="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 w-64 max-w-full focus:border-brand-400 outline-none" />
                ${links[p.url] && html`<span class="text-[10px] text-emerald-600 truncate max-w-[160px]" title=${links[p.url]}>→ ${liveMap[links[p.url]] || links[p.url]}</span>`}
                ${links[p.url] && html`<button onClick=${() => linkPage(p.url, '')} class="text-slate-300 hover:text-rose-600 text-[11px] shrink-0" title="Unlink">✕</button>`}
              </div>`}
            </div>
          </div>`)}
        </div>
      </div></${Card}>`)}
    `}

    ${copyModal && html`<div class="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick=${() => setCopyModal(null)}>
      <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8" onClick=${(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
          <div class="min-w-0">
            <div class="font-semibold text-slate-800 truncate">${copyModal.page.title} <span class="text-slate-400 font-normal">copy</span></div>
            <code class="text-[11px] text-slate-400 break-all">${copyModal.page.url}</code>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <${Btn} size="sm" variant="secondary" onClick=${() => copy(copyDeckMd(copyModal.page, copyModal.copy), 'deck')}>${copied === 'deck' ? '✓ Copied' : 'Copy'}</${Btn}>
            <${Btn} size="sm" variant="ghost" onClick=${() => genCopy(copyModal.page)} disabled=${copyBusy === copyModal.page.url}>${copyBusy === copyModal.page.url ? '…' : '↻ Regenerate'}</${Btn}>
            <button onClick=${() => setCopyModal(null)} class="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
          </div>
        </div>
        <div class="p-4">
          ${copyModal.copy ? html`<${CopyDeck} copy=${copyModal.copy} page=${copyModal.page} />` : html`<div class="text-sm text-slate-400">No copy stored for this page yet.</div>`}
        </div>
      </div>
    </div>`}
  </div>`;
}
