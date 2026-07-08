// ---------------------------------------------------------------------------
// lighthouse.js — Site Health. The real Google Lighthouse audit (via PageSpeed
// Insights), run for MOBILE + DESKTOP together and merged into one streamlined,
// visual report: side-by-side category scores, lab Core Web Vitals per device,
// a single de-duplicated issue list (with which device each fails on) carrying
// Google's own fix guidance + the offending elements, CrUX field data, and an
// optional AI fix plan. Embedded inside the SEO tab (not a standalone page).
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { seoLighthouseRun, seoLighthouseLoad, seoLighthouseFixPlan } from './store.js';

// Lighthouse thresholds: green >=90, amber 50-89, red <50 (score is 0..1).
const scoreTone = (s) => s == null ? '#94a3b8' : s >= 0.9 ? '#0cce6b' : s >= 0.5 ? '#ffa400' : '#ff4e42';
const metricText = (s) => s == null ? 'text-slate-400' : s >= 0.9 ? 'text-emerald-600' : s >= 0.5 ? 'text-amber-600' : 'text-rose-600';
const pct = (s) => s == null ? '–' : Math.round(s * 100);
const CAT_ORDER = ['seo', 'performance', 'accessibility', 'best-practices'];
const CAT_LABEL = { seo: 'SEO', performance: 'Performance', accessibility: 'Accessibility', 'best-practices': 'Best Practices' };
const METRICS = [
  { id: 'largest-contentful-paint', label: 'LCP', hint: 'Largest Contentful Paint' },
  { id: 'total-blocking-time', label: 'TBT', hint: 'Total Blocking Time' },
  { id: 'cumulative-layout-shift', label: 'CLS', hint: 'Cumulative Layout Shift' },
  { id: 'first-contentful-paint', label: 'FCP', hint: 'First Contentful Paint' },
  { id: 'speed-index', label: 'SI', hint: 'Speed Index' },
  { id: 'interactive', label: 'TTI', hint: 'Time to Interactive' },
];
const cruxTone = (c) => c === 'FAST' || c === 'GOOD' ? 'text-emerald-600' : c === 'AVERAGE' || c === 'NEEDS_IMPROVEMENT' ? 'text-amber-600' : c === 'SLOW' || c === 'POOR' ? 'text-rose-600' : 'text-slate-500';
const fmtMs = (n) => n == null ? '–' : n >= 1000 ? (n / 1000).toFixed(1) + ' s' : Math.round(n) + ' ms';

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function lhHtml(text) {
  let s = esc(text);
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-brand-700 underline">$1<\/a>');
  s = s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 text-[12px] text-slate-700">$1<\/code>');
  return { __html: s };
}
function statusOf(a) {
  if (['manual', 'notApplicable', 'error'].includes(a.mode)) return 'na';
  if (a.mode === 'informative' || a.score == null) return 'info';
  return a.score >= 0.9 ? 'pass' : 'fail';
}
const catScore = (rep, cid) => rep ? (rep.categories || []).find((c) => c.id === cid)?.score ?? null : null;
function auditById(rep) { const m = new Map(); if (rep) for (const c of rep.categories || []) for (const a of c.audits || []) m.set(a.id, a); return m; }
function pickLatestPair(reports) {
  if (!reports || !reports.length) return null;
  const url = reports[0].url;
  return { url, mobile: reports.find((r) => r.url === url && r.strategy === 'mobile') || null, desktop: reports.find((r) => r.url === url && r.strategy === 'desktop') || null };
}

function Ring({ score, size = 72, label }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, off = c * (1 - (score || 0)), col = scoreTone(score);
  return html`<div class="flex flex-col items-center gap-1">
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="#e2e8f0" stroke-width="6" />
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${col} stroke-width="6" stroke-linecap="round" stroke-dasharray=${c} stroke-dashoffset=${off} transform=${`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" style=${`font-size:${size * 0.3}px;font-weight:800;fill:${col}`}>${pct(score)}</text>
    </svg>
    ${label && html`<div class="text-[11px] text-slate-500">${label}</div>`}
  </div>`;
}

function CatCard({ cid, mobile, desktop }) {
  return html`<div class="rounded-xl border border-slate-200 bg-white p-3">
    <div class="text-sm font-semibold text-slate-700 text-center mb-2">${CAT_LABEL[cid]}</div>
    <div class="flex items-center justify-center gap-3">
      <${Ring} score=${catScore(mobile, cid)} size=${64} label="📱 Mobile" />
      <${Ring} score=${catScore(desktop, cid)} size=${64} label="🖥 Desktop" />
    </div>
  </div>`;
}

function Vitals({ mobile, desktop }) {
  const mob = auditById(mobile), desk = auditById(desktop);
  const rows = METRICS.map((mt) => ({ ...mt, m: mob.get(mt.id), d: desk.get(mt.id) })).filter((r) => r.m || r.d);
  if (!rows.length) return null;
  return html`<div class="rounded-xl border border-slate-200 bg-white p-4">
    <div class="font-semibold text-slate-800 mb-0.5">Core Web Vitals — lab</div>
    <p class="text-xs text-slate-400 mb-2">Measured in a controlled test. LCP, TBT &amp; CLS drive Google's page-experience signal.</p>
    <div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="text-xs text-slate-400 border-b border-slate-100"><th class="text-left font-medium py-1">Metric</th><th class="text-right font-medium py-1">📱 Mobile</th><th class="text-right font-medium py-1">🖥 Desktop</th></tr></thead>
      <tbody>${rows.map((r) => html`<tr class="border-b border-slate-50">
        <td class="py-1.5"><span class="font-medium text-slate-700">${r.label}</span> <span class="text-[11px] text-slate-400">${r.hint}</span></td>
        <td class=${cx('py-1.5 text-right font-semibold tabular-nums', metricText(r.m?.score))}>${r.m?.displayValue || '–'}</td>
        <td class=${cx('py-1.5 text-right font-semibold tabular-nums', metricText(r.d?.score))}>${r.d?.displayValue || '–'}</td>
      </tr>`)}</tbody>
    </table></div>
  </div>`;
}

function CruxBand({ crux }) {
  if (!crux) return null;
  const rows = [['LCP', crux.lcp, fmtMs], ['INP', crux.inp, (v) => v == null ? '–' : Math.round(v) + ' ms'], ['CLS', crux.cls, (v) => v == null ? '–' : (v / 100).toFixed(2)], ['FCP', crux.fcp, fmtMs], ['TTFB', crux.ttfb, fmtMs]].filter(([, m]) => m);
  if (!rows.length) return null;
  return html`<div class="rounded-xl border border-slate-200 bg-white p-4">
    <div class="flex items-center justify-between mb-2">
      <div><span class="font-semibold text-slate-800">Field data</span> <span class="text-xs text-slate-400">— real Chrome users, 28 days</span></div>
      <span class=${cx('text-xs font-semibold', cruxTone(crux.overall))}>${(crux.overall || '').replace(/_/g, ' ') || '—'}</span>
    </div>
    <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
      ${rows.map(([k, m, f]) => html`<div><div class="text-[11px] text-slate-400">${k}</div><div class=${cx('text-base font-semibold', cruxTone(m.cat))}>${f(m.p)}</div></div>`)}
    </div>
  </div>`;
}

function ItemsTable({ items }) {
  if (!items || !items.length) return null;
  return html`<div class="mt-2 space-y-1.5">
    ${items.map((it) => {
      const prim = Object.entries(it).filter(([k, v]) => k !== 'node' && k !== 'subItems' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'));
      return html`<div class="text-[12px] bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
        ${prim.length > 0 && html`<div class="flex flex-wrap gap-x-4 gap-y-0.5">${prim.map(([k, v]) => html`<span><span class="text-slate-400">${k}:</span> <span class="text-slate-700 font-medium break-all">${String(v)}</span></span>`)}</div>`}
        ${it.node?.snippet && html`<code class="block mt-1 text-[11px] text-rose-700 break-all whitespace-pre-wrap">${it.node.snippet}</code>`}
        ${it.node?.selector && html`<div class="text-[11px] text-slate-400 break-all">${it.node.selector}</div>`}
        ${Array.isArray(it.subItems) && it.subItems.map((s) => html`<div class="text-[11px] text-slate-500 break-all pl-2">• ${s}</div>`)}
      </div>`;
    })}
  </div>`;
}

// One row per failing audit, merged across devices.
function IssueRow({ issue }) {
  const [open, setOpen] = useState(false);
  const both = issue.devices.mobile && issue.devices.desktop;
  const items = issue.devices.mobile?.items || issue.devices.desktop?.items;
  const hasBody = (issue.description && issue.description.trim()) || (items && items.length);
  return html`<div class="border-b border-slate-100 last:border-0">
    <button onClick=${() => hasBody && setOpen((o) => !o)} class=${cx('w-full flex items-center gap-2.5 py-2.5 text-left', hasBody && 'hover:bg-slate-50')}>
      <span class="shrink-0 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white text-[11px] font-bold">!</span>
      <span class="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">${CAT_LABEL[issue.catId] || issue.catId}</span>
      <span class="flex-1 min-w-0 text-sm text-slate-800">${issue.title}</span>
      <span class="shrink-0 flex items-center gap-1 text-xs" title=${both ? 'Fails on mobile & desktop' : issue.devices.mobile ? 'Fails on mobile' : 'Fails on desktop'}>
        <span class=${issue.devices.mobile ? '' : 'opacity-20'}>📱</span><span class=${issue.devices.desktop ? '' : 'opacity-20'}>🖥</span>
      </span>
      ${hasBody && html`<span class=${cx('shrink-0 text-slate-300 text-xs transition-transform', open && 'rotate-90')}>▶</span>`}
    </button>
    ${open && hasBody && html`<div class="pl-7 pr-2 pb-3 -mt-1">
      ${(issue.devices.mobile?.displayValue || issue.devices.desktop?.displayValue) && html`<div class="text-xs text-slate-500 mb-1">
        ${issue.devices.mobile?.displayValue && html`<span class="mr-3">📱 ${issue.devices.mobile.displayValue}</span>`}
        ${issue.devices.desktop?.displayValue && html`<span>🖥 ${issue.devices.desktop.displayValue}</span>`}
      </div>`}
      ${issue.description && html`<p class="text-[13px] text-slate-600 leading-relaxed" dangerouslySetInnerHTML=${lhHtml(issue.description)}></p>`}
      <${ItemsTable} items=${items} />
    </div>`}
  </div>`;
}

function buildIssues(mobile, desktop) {
  const map = new Map();
  const add = (rep, device) => {
    if (!rep) return;
    for (const c of rep.categories || []) for (const a of c.audits || []) {
      if (statusOf(a) !== 'fail') continue;
      let e = map.get(a.id);
      if (!e) { e = { id: a.id, title: a.title, catId: c.id, weight: a.weight || 0, description: a.description || '', devices: {} }; map.set(a.id, e); }
      e.weight = Math.max(e.weight, a.weight || 0);
      if ((a.description || '').length > e.description.length) e.description = a.description;
      e.devices[device] = { displayValue: a.displayValue, items: a.items };
    }
  };
  add(mobile, 'mobile'); add(desktop, 'desktop');
  return [...map.values()].sort((x, y) => {
    const bx = x.devices.mobile && x.devices.desktop ? 1 : 0, by = y.devices.mobile && y.devices.desktop ? 1 : 0;
    const rank = { seo: 0, performance: 1, 'best-practices': 2, accessibility: 3 };
    return (by - bx) || (y.weight - x.weight) || ((rank[x.catId] ?? 9) - (rank[y.catId] ?? 9));
  });
}

function FixPlan({ plan }) {
  if (!plan) return null;
  const priTone = (p) => p === 'high' ? 'bg-rose-100 text-rose-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return html`<div class="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
    <div class="font-semibold text-slate-800 mb-1">✨ AI fix plan</div>
    <p class="text-sm text-slate-600 mb-3">${plan.summary || ''}</p>
    <div class="space-y-2">${(plan.items || []).map((it) => html`<div class="rounded-lg border border-slate-200 bg-white p-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class=${cx('text-[11px] font-bold px-2 py-0.5 rounded-full', priTone(it.priority))}>${(it.priority || '').toUpperCase()}</span>
        <span class="font-medium text-slate-800">${it.title}</span>
        ${it.effort && html`<span class="text-[11px] text-slate-400">· ${it.effort} effort</span>`}
      </div>
      ${it.impact && html`<div class="text-xs text-emerald-700 mt-1">Impact: ${it.impact}</div>`}
      ${Array.isArray(it.steps) && html`<ol class="list-decimal ml-5 mt-1.5 space-y-0.5 text-[13px] text-slate-600">${it.steps.map((s) => html`<li dangerouslySetInnerHTML=${lhHtml(s)}></li>`)}</ol>`}
    </div>`)}</div>
  </div>`;
}

export function SiteHealth({ siteId, domain, canRun = true }) {
  const [pair, setPair] = useState(null);
  const [url, setUrl] = useState('');
  const [fixPlan, setFixPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPair(null); setFixPlan(null); setUrl(''); setLoaded(false); setErr('');
    if (!siteId) return;
    let cancelled = false;
    seoLighthouseLoad(siteId).then((reports) => {
      if (cancelled) return;
      const p = pickLatestPair(reports);
      setPair(p); setUrl(p?.url || ''); setFixPlan(p?.mobile?.fix_plan || p?.desktop?.fix_plan || null); setLoaded(true);
    }).catch((e) => { if (!cancelled) { setErr(e.message); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [siteId]);

  const run = async () => {
    setBusy('run'); setErr(''); setFixPlan(null);
    try {
      const d = await seoLighthouseRun(siteId, { url: url.trim() });
      const m = d.mobile || null, dk = d.desktop || null;
      setPair({ url: (m || dk)?.url || url, mobile: m, desktop: dk });
      if (d.mobileError && d.desktopError) setErr(`Both runs failed: ${d.mobileError}`);
      else if (d.mobileError) setErr(`Mobile run failed: ${d.mobileError}`);
      else if (d.desktopError) setErr(`Desktop run failed: ${d.desktopError}`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const genFix = async () => {
    setBusy('ai'); setErr('');
    try { const d = await seoLighthouseFixPlan(siteId, { url: pair.url, strategy: 'mobile' }); setFixPlan(d.fix_plan); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const has = pair && (pair.mobile || pair.desktop);
  const ref = pair?.mobile || pair?.desktop;
  const issues = has ? buildIssues(pair.mobile, pair.desktop) : [];
  const crux = pair?.mobile?.crux || pair?.desktop?.crux || null;
  const runLabel = busy === 'run' ? 'Running mobile + desktop…' : has ? '↻ Re-run' : 'Run health check';

  return html`<div class="space-y-3">
    <div class="rounded-xl border border-slate-200 bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-slate-800">Site Health <span class="text-xs font-normal text-slate-400">· Google Lighthouse, mobile + desktop</span></div>
          ${has && html`<div class="text-xs text-slate-400 truncate">${(ref.final_url || ref.url).replace(/^https?:\/\//, '')} · ${new Date(ref.fetched_at).toLocaleString()}</div>`}
        </div>
        ${canRun && html`<input value=${url} onInput=${(e) => setUrl(e.target.value)} placeholder=${`homepage (${domain || 'blank'}) or a URL`} class="text-sm px-3 py-1.5 rounded-lg border border-slate-300 focus:border-brand-400 focus:ring-1 focus:ring-brand-300 outline-none w-full sm:w-72" />`}
        ${canRun && html`<button onClick=${run} disabled=${busy === 'run'} class="text-sm font-semibold px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">${runLabel}</button>`}
      </div>
      ${busy === 'run' && html`<div class="text-xs text-slate-400 mt-2">Rendering the page in a headless browser on mobile, then desktop, running ~50 audits each — usually 40–60s.</div>`}
      ${err && html`<div class="text-sm text-rose-600 mt-2">${err}</div>`}
    </div>

    ${!has && !busy && loaded && html`<div class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      ${canRun ? 'Run a health check to see the full Lighthouse breakdown for mobile and desktop side by side.' : 'No health check yet — ask an account admin to run one.'}
    </div>`}
    ${!loaded && !busy && html`<div class="p-6 text-sm text-slate-400">Loading…</div>`}

    ${has && html`
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${CAT_ORDER.map((cid) => html`<${CatCard} cid=${cid} mobile=${pair.mobile} desktop=${pair.desktop} />`)}
      </div>
      <div class="flex items-center justify-center gap-4 text-[11px] text-slate-400">
        <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:#ff4e42"></span>0–49</span>
        <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:#ffa400"></span>50–89</span>
        <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:#0cce6b"></span>90–100</span>
      </div>

      <div class="grid lg:grid-cols-2 gap-3">
        <${Vitals} mobile=${pair.mobile} desktop=${pair.desktop} />
        <${CruxBand} crux=${crux} />
      </div>

      ${fixPlan && html`<${FixPlan} plan=${fixPlan} />`}

      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div>
            <span class="font-semibold text-slate-800">Issues to fix</span>
            <span class="text-xs text-slate-400 ml-1">${issues.length} across mobile &amp; desktop · sorted by impact</span>
          </div>
          ${canRun && issues.length > 0 && html`<button onClick=${genFix} disabled=${busy === 'ai'} class="text-sm font-medium px-3 py-1.5 rounded-lg text-brand-700 hover:bg-brand-50 disabled:opacity-50">${busy === 'ai' ? 'Thinking…' : (fixPlan ? '↻ Regenerate fix plan' : '✨ Generate fix plan')}</button>`}
        </div>
        ${issues.length === 0
          ? html`<div class="text-sm text-emerald-600 py-3">✓ No failing audits on either device — this page is in great shape.</div>`
          : html`<div>${issues.map((i) => html`<${IssueRow} issue=${i} />`)}</div>`}
      </div>
    `}
  </div>`;
}
