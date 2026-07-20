// ---------------------------------------------------------------------------
// audit.js — Technical SEO Audit + AEO/AI-readiness. Crawls the site's real
// pages for technical issues, and (on demand) runs a Claude AEO/GEO analysis
// per page — how ready it is for AI answer engines to understand and cite.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadAudit, seoAuditDiscover, seoAuditRun, seoAuditAi, seoAuditSpeed, seoSiteAuditRun, seoSiteAuditLoad, seoWpStatus, seoWpSuggestMeta, seoWpUpdateSeo, seoWpFix } from './store.js';
import { Card, Btn, Select, Modal, Input } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const num = (n) => (n || 0).toLocaleString();
const shortUrl = (u) => { try { const x = new URL(u); return (x.pathname === '/' ? x.hostname : x.pathname) + (x.search || ''); } catch { return u; } };
const scoreColor = (s) => (s >= 80 ? 'bg-emerald-500 text-white' : s >= 50 ? 'bg-amber-400 text-white' : 'bg-rose-500 text-white');
const sevColor = { critical: 'text-rose-600', warning: 'text-amber-600', info: 'text-slate-400' };
const Pill = ({ children, cls }) => html`<span class=${cx('inline-block px-2 py-0.5 rounded-full text-xs font-semibold', cls)}>${children}</span>`;

export function Audit() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [openUrl, setOpenUrl] = useState(null);
  const [wpConnected, setWpConnected] = useState(false);
  const [siteAudit, setSiteAudit] = useState(null);
  const sort = useSort('technical_score', 'asc');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const load = async (sid) => setPages(await seoLoadAudit(sid));
  useEffect(() => { if (site) load(site); else setPages([]); }, [site]);
  useEffect(() => { setWpConnected(false); if (site) seoWpStatus(site).then((w) => setWpConnected(!!w?.connected)).catch(() => {}); }, [site]);
  useEffect(() => { setSiteAudit(null); if (site) seoSiteAuditLoad(site).then((d) => setSiteAudit(d.audit)).catch(() => {}); }, [site]);

  const runSiteAudit = async () => {
    setBusy('seo'); setErr(''); setBanner('');
    try { const d = await seoSiteAuditRun(site); setSiteAudit(d.audit); setBanner(`SEO health score: ${d.audit.score}/100 across ${num(d.audit.pages_analyzed)} page(s).`); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const runAudit = async () => {
    setBusy('crawl'); setErr(''); setBanner('');
    try {
      // Full-site discovery: sitemap(s) + Search Console pages, then crawl in chunks.
      setBanner('Discovering pages (sitemap + Search Console)…');
      const d = await seoAuditDiscover(site);
      const urls = d.urls || [];
      if (!urls.length) throw new Error('No pages found to audit — connect Search Console or check the site has a sitemap.');
      let done = 0;
      const CHUNK = 15;
      for (let i = 0; i < urls.length; i += CHUNK) {
        setBanner(`Auditing pages ${num(i + 1)}–${num(Math.min(i + CHUNK, urls.length))} of ${num(urls.length)}…`);
        const r = await seoAuditRun(site, urls.slice(i, i + CHUNK));
        done += r.audited || 0;
        await load(site); // table fills in progressively
      }
      setBanner(`Audited ${num(done)} of ${num(urls.length)} pages${d.from_sitemap ? ` — full site via sitemap (${num(d.from_sitemap)} pages) + Search Console (${num(d.from_gsc)})` : ' — Search Console pages only (no readable sitemap found)'}.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const analyzeAi = async (url) => {
    setBusy('ai:' + url); setErr('');
    try { await seoAuditAi(site, url); await load(site); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const analyzeSpeed = async (url) => {
    setBusy('psi:' + url); setErr('');
    try { await seoAuditSpeed(site, url); await load(site); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const stats = useMemo(() => {
    const sev = { critical: 0, warning: 0, info: 0 };
    for (const p of pages) for (const i of (p.issues || [])) sev[i.severity] = (sev[i.severity] || 0) + 1;
    const scored = pages.filter((p) => p.technical_score != null);
    const aiScored = pages.filter((p) => p.ai_score != null);
    return {
      pages: pages.length,
      avg: scored.length ? Math.round(scored.reduce((s, p) => s + p.technical_score, 0) / scored.length) : 0,
      aiAvg: aiScored.length ? Math.round(aiScored.reduce((s, p) => s + p.ai_score, 0) / aiScored.length) : null,
      sev,
    };
  }, [pages]);

  const issueSummary = useMemo(() => {
    const m = new Map();
    for (const p of pages) for (const i of (p.issues || [])) { const key = i.message; let e = m.get(key); if (!e) { e = { message: i.message, severity: i.severity, count: 0 }; m.set(key, e); } e.count++; }
    const rank = { critical: 0, warning: 1, info: 2 };
    return [...m.values()].sort((a, b) => (rank[a.severity] - rank[b.severity]) || (b.count - a.count));
  }, [pages]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading audit…</div>`;

  const openPage = pages.find((p) => p.url === openUrl);
  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Technical Audit & AI Readiness</h1>
        <p class="text-sm text-slate-500">Crawls your top pages for technical issues, plus AEO/GEO analysis — how ready each page is for AI answer engines to cite.</p>
      </div>
      <div class="flex items-center gap-2">
        ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
        ${site && pages.length > 0 && html`<${Btn} onClick=${runSiteAudit} disabled=${!!busy}>${busy === 'seo' ? 'Scoring…' : '🔎 SEO audit'}</${Btn}>`}
        ${site && html`<${Btn} onClick=${runAudit} disabled=${busy === 'crawl'}>${busy === 'crawl' ? 'Auditing…' : 'Run audit'}</${Btn}>`}
      </div>
    </div>
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : pages.length === 0
        ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No audit yet. Click <span class="font-medium">Run audit</span> to crawl your top pages for technical issues and AI-readiness.</div></${Card}>`
        : html`
          <${SiteAuditPanel} audit=${siteAudit} busy=${busy === 'seo'} onRun=${runSiteAudit} />

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            ${[['Pages', num(stats.pages)], ['Avg tech score', stats.avg], ['Critical', num(stats.sev.critical)], ['Warnings', num(stats.sev.warning)], ['Avg AI score', stats.aiAvg == null ? '—' : stats.aiAvg]]
              .map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div></div></${Card}>`)}
          </div>

          <div class="grid lg:grid-cols-2 gap-4">
            <${Card}><div class="p-4">
              <div class="font-semibold text-slate-800 mb-2">Top issues</div>
              ${issueSummary.length === 0 ? html`<div class="text-sm text-emerald-600">No issues found. 🎉</div>`
                : html`<div class="space-y-1.5">${issueSummary.slice(0, 12).map((i) => html`<div class="flex items-center justify-between text-sm">
                    <span class=${cx('flex items-center gap-2', sevColor[i.severity])}><span class="text-xs uppercase">${i.severity[0]}</span><span class="text-slate-700">${i.message}</span></span>
                    <span class="text-slate-400 tabular-nums">${i.count}</span>
                  </div>`)}</div>`}
            </div></${Card}>
            <${Card}><div class="p-4">
              <div class="font-semibold text-slate-800 mb-1">AI / Answer-Engine readiness</div>
              <p class="text-xs text-slate-500 mb-2">Click <span class="font-medium">AI</span> on any page to analyze how ready it is for ChatGPT, Google AI Overviews, and Perplexity to understand and cite it.</p>
              ${stats.aiAvg == null ? html`<div class="text-sm text-slate-400">No pages analyzed yet.</div>`
                : html`<div class="flex items-center gap-3"><${Pill} cls=${scoreColor(stats.aiAvg)}>${stats.aiAvg}</${Pill}><span class="text-sm text-slate-600">average AI-readiness across ${num(pages.filter((p) => p.ai_score != null).length)} analyzed page(s)</span></div>`}
            </div></${Card}>
          </div>

          ${wpConnected && html`<${AiFixes} pages=${pages} site=${site} onDone=${() => load(site)} />`}

          <${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
              <${SortTh} k="url" label="Page" sort=${sort} /><${SortTh} k="status_code" label="HTTP" sort=${sort} right=${true} /><${SortTh} k="technical_score" label="Tech" sort=${sort} right=${true} /><th class="py-1.5 pr-3 text-right">Issues</th><${SortTh} k="word_count" label="Words" sort=${sort} right=${true} /><${SortTh} k="ai_score" label="AI" sort=${sort} right=${true} /><th class="py-1.5 pr-3"></th></tr></thead>
            <tbody>${sort.sort(pages).map((p) => html`<tr class="border-b border-slate-50">
              <td class="py-1.5 pr-3 max-w-xs truncate"><a href=${p.url} target="_blank" rel="noopener" class="text-brand-700 hover:underline">${shortUrl(p.url)}</a></td>
              <td class="py-1.5 pr-3 text-right tabular-nums ${p.status_code >= 400 || p.status_code === 0 ? 'text-rose-600' : ''}">${p.status_code || '—'}</td>
              <td class="py-1.5 pr-3 text-right"><${Pill} cls=${scoreColor(p.technical_score || 0)}>${p.technical_score ?? '—'}</${Pill}></td>
              <td class="py-1.5 pr-3 text-right tabular-nums text-slate-500">${(p.issues || []).length}</td>
              <td class="py-1.5 pr-3 text-right tabular-nums text-slate-500">${num(p.word_count)}</td>
              <td class="py-1.5 pr-3 text-right">${p.ai_score != null ? html`<${Pill} cls=${scoreColor(p.ai_score)}>${p.ai_score}</${Pill}>` : html`<span class="text-slate-300">—</span>`}</td>
              <td class="py-1.5 pr-3 text-right whitespace-nowrap">
                <button onClick=${() => analyzeAi(p.url)} disabled=${busy === 'ai:' + p.url} class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-50">${busy === 'ai:' + p.url ? '…' : (p.ai_score != null ? '↻ AI' : '✨ AI')}</button>
                <button onClick=${() => setOpenUrl(p.url)} class="text-xs px-2 py-1 rounded-lg text-brand-700 hover:underline">Details</button>
              </td>
            </tr>`)}</tbody>
          </table></div></${Card}>
        `}

    ${openPage && html`<${DetailModal} page=${openPage} site=${site} wpConnected=${wpConnected} busyAi=${busy === 'ai:' + openPage.url} busyPsi=${busy === 'psi:' + openPage.url} onClose=${() => setOpenUrl(null)} onAi=${() => analyzeAi(openPage.url)} onSpeed=${() => analyzeSpeed(openPage.url)} onPushed=${() => load(site)} />`}
  </div>`;
}

// Bulk AI fixes: deploy fixes for audit issues to the live site, page by page,
// through the Ops Dash Connector plugin (needs plugin v1.3+).
const FIXES = [
  { key: 'meta', action: 'fix_meta', icon: '🏷', label: 'Titles & meta descriptions', desc: 'AI writes a keyword-matched title tag and meta description and pushes them into the SEO plugin.', match: (i) => (i.type === 'title' || i.type === 'meta') && /^Missing/.test(i.message) },
  { key: 'schema', action: 'fix_schema', icon: '🧩', label: 'Structured data (schema)', desc: 'AI builds page-appropriate JSON-LD (LocalBusiness, Service, Article…) from your business facts.', match: (i) => i.type === 'schema' },
  { key: 'alts', action: 'fix_alts', icon: '🖼', label: 'Image alt text', desc: 'AI looks at each image and writes descriptive alt text (up to 6 images per page).', match: (i) => i.type === 'alt' },
  { key: 'h1', action: 'fix_h1', icon: '#', label: 'Multiple H1 headings', desc: 'Extra H1s demoted to H2. Elementor-built pages are skipped (fix those in the builder).', match: (i) => i.type === 'h1' && /^Multiple/.test(i.message) },
  { key: 'canonical', action: 'fix_canonical', icon: '🔗', label: 'Canonical tags', desc: 'Adds a self-referencing canonical tag to pages missing one.', match: (i) => i.type === 'canonical' },
];
// Site-wide SEO health: weighted category scores + prioritised findings from
// the whole crawl (seo-site-audit fn), not just per-page technical checks.
const SEV_CLS = { Critical: 'bg-rose-100 text-rose-700', High: 'bg-orange-100 text-orange-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-slate-100 text-slate-600' };
const barColor = (s) => (s >= 80 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-400' : 'bg-rose-500');
const bigScore = (s) => (s >= 80 ? 'text-emerald-600' : s >= 50 ? 'text-amber-500' : 'text-rose-600');

function SiteAuditPanel({ audit, busy, onRun }) {
  const [showAll, setShowAll] = useState(false);
  if (!audit) {
    return html`<${Card}><div class="p-4 flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="font-semibold text-slate-800">Site-wide SEO audit</div>
        <p class="text-xs text-slate-500 max-w-2xl">Scores the whole site — technical, on-page, content, schema, images and AI-search readiness — into one health score with prioritised fixes. Uses the pages already crawled below, plus live robots.txt / sitemap.xml / llms.txt.</p>
      </div>
      <${Btn} onClick=${onRun} disabled=${busy}>${busy ? 'Scoring…' : '🔎 Run SEO audit'}</${Btn}>
    </div></${Card}>`;
  }
  const f = audit.facts || {};
  const cats = audit.categories || [];
  const findings = audit.findings || [];
  const shown = showAll ? findings : findings.slice(0, 8);
  const counts = findings.reduce((a, x) => { a[x.severity] = (a[x.severity] || 0) + 1; return a; }, {});
  const chip = (label, good, extra) => html`<span class=${cx('text-[11px] px-2 py-1 rounded-lg border', good ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500')}>${good ? '✓' : '✕'} ${label}${extra ? ` · ${extra}` : ''}</span>`;
  let when = ''; try { when = new Date(audit.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { /* ignore */ }

  return html`<${Card}><div class="p-4 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-4">
        <div class="text-center">
          <div class=${cx('text-4xl font-bold tabular-nums', bigScore(audit.score))}>${audit.score}</div>
          <div class="text-[11px] text-slate-400">/ 100</div>
        </div>
        <div>
          <div class="font-semibold text-slate-800">SEO health score</div>
          <div class="text-xs text-slate-500">${num(audit.pages_analyzed)} page(s) analyzed${when ? ` · ${when}` : ''}</div>
          <div class="flex flex-wrap gap-1.5 mt-1.5">
            ${['Critical', 'High', 'Medium', 'Low'].filter((s) => counts[s]).map((s) => html`<${Pill} cls=${SEV_CLS[s]}>${counts[s]} ${s}</${Pill}>`)}
            ${findings.length === 0 && html`<span class="text-sm text-emerald-600">No issues found 🎉</span>`}
          </div>
        </div>
      </div>
      <${Btn} onClick=${onRun} disabled=${busy}>${busy ? 'Scoring…' : '↻ Re-run'}</${Btn}>
    </div>

    <div class="grid sm:grid-cols-2 gap-x-6 gap-y-2">
      ${cats.map((c) => html`<div>
        <div class="flex items-center justify-between text-xs mb-0.5">
          <span class="text-slate-600">${c.name} <span class="text-slate-300">${c.weight}%</span></span>
          <span class=${cx('tabular-nums font-medium', c.score == null ? 'text-slate-300' : 'text-slate-700')}>${c.score == null ? 'not measured' : c.score}</span>
        </div>
        <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          ${c.score != null && html`<div class=${cx('h-full rounded-full', barColor(c.score))} style=${`width:${c.score}%`}></div>`}
        </div>
      </div>`)}
    </div>

    <div class="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
      ${chip('robots.txt', !!f.robots_found)}
      ${chip('XML sitemap', !!f.sitemap_url, f.sitemap_urls ? `${num(f.sitemap_urls)} URLs` : '')}
      ${chip('llms.txt', !!f.llms_txt)}
      ${chip('AI crawlers allowed', !(f.ai_blocked || []).length, (f.ai_blocked || []).length ? (f.ai_blocked || []).join(', ') : '')}
      <span class="text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-500">Schema ${f.schema_coverage ?? 0}%</span>
      ${f.images_total ? html`<span class="text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-500">Alt text ${Math.round((1 - (f.images_no_alt || 0) / f.images_total) * 100)}%</span>` : ''}
      <span class="text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-500">Avg ${num(f.avg_words)} words</span>
    </div>

    ${findings.length > 0 && html`<div class="space-y-2 pt-1 border-t border-slate-100">
      <div class="text-sm font-semibold text-slate-700">Prioritised fixes</div>
      ${shown.map((x) => html`<div class="rounded-lg border border-slate-100 p-2.5">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 min-w-0">
            <${Pill} cls=${SEV_CLS[x.severity] || SEV_CLS.Low}>${x.severity}</${Pill}>
            <span class="font-medium text-slate-800">${x.title}</span>
            ${x.count ? html`<span class="text-xs text-slate-400 tabular-nums">${num(x.count)}</span>` : ''}
          </div>
          <span class="text-[11px] text-slate-400">${x.category}</span>
        </div>
        <div class="text-xs text-slate-600 mt-1">${x.detail}</div>
        <div class="text-xs text-brand-700 mt-0.5">→ ${x.recommendation}</div>
      </div>`)}
      ${findings.length > 8 && html`<button onClick=${() => setShowAll(!showAll)} class="text-xs text-slate-500 hover:text-slate-800 underline">${showAll ? 'Show less' : `Show all ${findings.length} findings`}</button>`}
    </div>`}
  </div></${Card}>`;
}

function AiFixes({ pages, site, onDone }) {
  const [busyKey, setBusyKey] = useState('');
  const [prog, setProg] = useState('');
  const [results, setResults] = useState({});
  const cats = useMemo(() => {
    const m = {};
    for (const f of FIXES) m[f.key] = pages.filter((p) => p.status_code > 0 && p.status_code < 400 && (p.issues || []).some(f.match)).map((p) => p.url);
    return m;
  }, [pages]);
  const total = FIXES.reduce((s, f) => s + cats[f.key].length, 0);
  if (!total) return null;
  const run = async (f) => {
    const urls = cats[f.key];
    setBusyKey(f.key);
    let ok = 0, fail = 0, skipped = 0;
    for (let i = 0; i < urls.length; i++) {
      setProg(`${f.label}: page ${i + 1} of ${urls.length}…`);
      try { const r = await seoWpFix(site, f.action, urls[i]); if (r?.skipped) skipped++; else ok++; }
      catch (_) { fail++; }
    }
    setResults((r) => ({ ...r, [f.key]: { ok, fail, skipped } }));
    setBusyKey(''); setProg('');
    onDone && onDone();
  };
  return html`<${Card}><div class="p-4 space-y-3">
    <div>
      <div class="font-semibold text-slate-800">🪄 AI fixes — deploy to WordPress</div>
      <div class="text-xs text-slate-500">Fixes are written by AI per page and pushed live through the Ops Dash Connector plugin. Pages that couldn't be crawled (HTTP 403 / errors) are excluded.</div>
    </div>
    <div class="space-y-2">
      ${FIXES.map((f) => {
        const n = cats[f.key].length;
        const res = results[f.key];
        return html`<div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
          <div class="min-w-0">
            <div class="text-sm font-medium text-slate-800">${f.icon} ${f.label} <span class="text-slate-400 font-normal">— ${num(n)} page${n === 1 ? '' : 's'}</span></div>
            <div class="text-xs text-slate-500">${f.desc}</div>
            ${res && html`<div class="text-xs mt-0.5 ${res.fail ? 'text-amber-700' : 'text-emerald-700'}">Done: ${res.ok} fixed${res.skipped ? `, ${res.skipped} skipped` : ''}${res.fail ? `, ${res.fail} failed` : ''}.</div>`}
          </div>
          <${Btn} size="sm" onClick=${() => run(f)} disabled=${!!busyKey || n === 0}>${busyKey === f.key ? 'Fixing…' : res ? '↻ Re-run' : `Fix ${num(n)}`}</${Btn}>
        </div>`;
      })}
    </div>
    ${prog && html`<div class="text-xs text-brand-700 animate-pulse">${prog}</div>`}
    <div class="text-[11px] text-slate-400">Tip: if the site uses a page cache, flush it after fixing to see changes on the live pages immediately. Re-run the audit afterwards to confirm scores improved.</div>
  </div></${Card}>`;
}

// SEO editor: draft (or AI-suggest) a title tag + meta description and push
// them to the live WordPress page via the Ops Dash Connector plugin.
function SeoPush({ page, site, onPushed }) {
  const c = page.checks || {};
  const [title, setTitle] = useState(c.title || '');
  const [desc, setDesc] = useState(c.metaDesc || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { setTitle(c.title || ''); setDesc(c.metaDesc || ''); setMsg(''); setErr(''); }, [page.url]);
  const suggest = async () => {
    setBusy('suggest'); setErr(''); setMsg('');
    try {
      const r = await seoWpSuggestMeta(site, page.url);
      setTitle(r.seo_title || ''); setDesc(r.meta_description || '');
      setMsg(r.keyword ? `Suggested around "${r.keyword}" — edit freely, then push.` : 'Suggestion ready — edit freely, then push.');
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const push = async () => {
    setBusy('push'); setErr(''); setMsg('');
    try {
      await seoWpUpdateSeo(site, { url: page.url, seoTitle: title.trim(), metaDescription: desc.trim() });
      setMsg('Pushed to WordPress ✓ — the live page now carries this title and description.');
      onPushed && onPushed();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const lenPill = (n, lo, hi) => html`<span class=${cx('tabular-nums', n === 0 ? 'text-slate-300' : n >= lo && n <= hi ? 'text-emerald-600' : 'text-amber-600')}>${n}</span>`;
  return html`<div class="border-t border-slate-100 pt-3 space-y-2">
    <div class="flex items-center justify-between gap-2">
      <div class="text-xs font-semibold text-slate-400 uppercase">SEO editor — push to WordPress</div>
      ${page.seo_pushed_at && html`<span class="text-[11px] text-sky-600">last pushed ${new Date(page.seo_pushed_at).toLocaleString()}</span>`}
    </div>
    <div class="space-y-1">
      <div class="flex justify-between text-[11px] text-slate-400"><span>SEO title (50–60 chars)</span>${lenPill(title.length, 50, 60)}</div>
      <${Input} value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Title tag for this page" />
    </div>
    <div class="space-y-1">
      <div class="flex justify-between text-[11px] text-slate-400"><span>Meta description (150–155 chars)</span>${lenPill(desc.length, 150, 155)}</div>
      <textarea value=${desc} onInput=${(e) => setDesc(e.target.value)} rows="2" placeholder="Meta description for this page" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"></textarea>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <${Btn} size="sm" onClick=${suggest} disabled=${!!busy}>${busy === 'suggest' ? 'Thinking…' : '✨ Suggest'}</${Btn}>
      <${Btn} size="sm" onClick=${push} disabled=${!!busy || (!title.trim() && !desc.trim())}>${busy === 'push' ? 'Pushing…' : '→ Push to live page'}</${Btn}>
    </div>
    ${msg && html`<div class="text-xs text-emerald-700">${msg}</div>`}
    ${err && html`<div class="text-xs text-rose-600">${err}</div>`}
  </div>`;
}

function DetailModal({ page, site, wpConnected, busyAi, busyPsi, onClose, onAi, onSpeed, onPushed }) {
  const ai = page.ai_insights, c = page.checks || {}, cwv = page.cwv;
  const kv = (label, val) => html`<div class="flex justify-between gap-3 py-0.5 border-b border-slate-50"><span class="text-slate-400 shrink-0">${label}</span><span class="text-slate-700 text-right truncate">${val}</span></div>`;
  const yn = (b) => (b ? '✅' : '—');
  return html`<${Modal} title=${shortUrl(page.url)} wide onClose=${onClose}
    footer=${html`<div class="flex justify-between items-center w-full gap-2">
      <a href=${page.url} target="_blank" rel="noopener" class="text-xs text-brand-700 underline">Open page ↗</a>
      <div class="flex gap-2">
        <${Btn} size="sm" onClick=${onSpeed} disabled=${busyPsi}>${busyPsi ? 'Testing…' : (cwv ? '↻ Speed' : '⚡ Speed test')}</${Btn}>
        <${Btn} size="sm" onClick=${onAi} disabled=${busyAi}>${busyAi ? 'Analyzing…' : (ai ? '↻ AI' : '✨ AI / AEO')}</${Btn}>
      </div>
    </div>`}>
    <div class="space-y-4 text-sm">
      <div class="flex flex-wrap gap-2 items-center">
        <${Pill} cls=${scoreColor(page.technical_score || 0)}>Tech ${page.technical_score ?? '—'}</${Pill}>
        ${cwv && html`<${Pill} cls=${scoreColor(cwv.perf)}>Speed ${cwv.perf}</${Pill}>`}
        ${page.ai_score != null && html`<${Pill} cls=${scoreColor(page.ai_score)}>AI ${page.ai_score}</${Pill}>`}
        <span class="text-xs text-slate-400">HTTP ${page.status_code} · ${num(page.word_count)} words</span>
      </div>

      <div>
        <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Technical issues (${(page.issues || []).length})</div>
        ${(page.issues || []).length === 0 ? html`<div class="text-emerald-600">No technical issues. 🎉</div>`
          : html`<ul class="space-y-2">${(page.issues || []).map((i) => html`<li class="flex gap-2">
              <span class=${cx('text-[10px] uppercase font-bold mt-0.5 shrink-0', sevColor[i.severity])}>${i.severity}</span>
              <span><span class="text-slate-800">${i.message}</span>${i.fix && html`<span class="text-slate-500"> — ${i.fix}</span>`}</span>
            </li>`)}</ul>`}
      </div>

      ${cwv && html`<div class="border-t border-slate-100 pt-3">
        <div class="text-xs font-semibold text-slate-400 uppercase mb-2">Core Web Vitals — mobile</div>
        <div class="grid grid-cols-4 gap-2 text-center">
          ${[['Perf', cwv.perf], ['LCP', cwv.lcp != null ? (cwv.lcp / 1000).toFixed(1) + 's' : '—'], ['CLS', cwv.cls != null ? cwv.cls : '—'], ['TBT', cwv.tbt != null ? cwv.tbt + 'ms' : '—']].map(([k, v]) => html`<div class="rounded-lg bg-slate-50 p-2"><div class="text-[11px] text-slate-400">${k}</div><div class="font-bold text-slate-800">${v}</div></div>`)}
        </div>
      </div>`}

      <div class="border-t border-slate-100 pt-3">
        <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Extracted signals</div>
        <div class="text-xs">
          ${kv('Title', c.title || '—')}
          ${kv('Meta', c.metaDesc || '—')}
          ${kv('H1', c.h1Text || '—')}
          ${kv('Headings', `H2×${c.h2Count || 0} · H3×${c.h3Count || 0}`)}
          ${kv('Schema', (c.schemaTypes || []).length ? c.schemaTypes.join(', ') : '—')}
          ${kv('Links', `${c.internalLinks || 0} internal · ${c.externalLinks || 0} external`)}
          ${kv('Signals', `${yn(c.canonical)} canonical · ${yn(c.og)} OG · ${yn(c.viewport)} viewport · ${c.lang || 'no'} lang`)}
          ${kv('Images', `${c.imgs || 0} (${c.imgNoAlt || 0} missing alt)`)}
        </div>
      </div>

      ${wpConnected && html`<${SeoPush} page=${page} site=${site} onPushed=${onPushed} />`}

      ${ai ? html`<div class="border-t border-slate-100 pt-3 space-y-3">
        <div class="text-xs font-semibold text-slate-400 uppercase">AI / Answer-engine readiness</div>
        <div class="grid grid-cols-3 gap-2">
          ${[['Readiness', ai.ai_readiness], ['Entity clarity', ai.entity_clarity], ['Citation potential', ai.citation_potential]].map(([k, v]) => html`<div class="rounded-lg bg-slate-50 p-2 text-center"><div class="text-[11px] text-slate-400">${k}</div><div class="text-lg font-bold text-slate-800">${v ?? '—'}</div></div>`)}
        </div>
        <div class="flex gap-3 text-xs text-slate-500">
          <span>${ai.answer_first ? '✅' : '⚠️'} Answer-first</span>
          <span>${ai.faq_present ? '✅' : '⚠️'} FAQ present</span>
        </div>
        ${ai.summary && html`<p class="text-slate-600">${ai.summary}</p>`}
        ${(ai.strengths || []).length > 0 && html`<div><div class="text-xs font-semibold text-slate-400 uppercase mb-1">Strengths</div><ul class="list-disc ml-5 text-slate-600">${ai.strengths.map((s) => html`<li>${s}</li>`)}</ul></div>`}
        ${(ai.recommendations || []).length > 0 && html`<div><div class="text-xs font-semibold text-slate-400 uppercase mb-1">Recommendations to get cited by AI</div><ul class="list-disc ml-5 text-slate-700">${ai.recommendations.map((s) => html`<li>${s}</li>`)}</ul></div>`}
      </div>` : html`<div class="border-t border-slate-100 pt-3 text-sm text-slate-400">Run the AI / AEO analysis to see how ready this page is for AI answer engines to understand and cite it.</div>`}
    </div>
  </${Modal}>`;
}
