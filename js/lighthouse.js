// ---------------------------------------------------------------------------
// lighthouse.js — the real Google Lighthouse report, in-portal. Runs Lighthouse
// server-side via PageSpeed Insights (SEO, Performance, Accessibility, Best
// Practices), then renders every audit with Google's own fix guidance, the
// specific failing elements, CrUX field data, and an optional AI fix plan.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLighthouseRun, seoLighthouseLoad, seoLighthouseFixPlan } from './store.js';
import { Card, Btn, Select, Input } from './ui.js';

// Lighthouse thresholds: green >=90, amber 50-89, red <50 (score is 0..1).
const scoreTone = (s) => s == null ? '#94a3b8' : s >= 0.9 ? '#0cce6b' : s >= 0.5 ? '#ffa400' : '#ff4e42';
const pct = (s) => s == null ? '–' : Math.round(s * 100);
const CAT_LABEL = { seo: 'SEO', performance: 'Performance', accessibility: 'Accessibility', 'best-practices': 'Best Practices' };
const cruxTone = (c) => c === 'FAST' || c === 'GOOD' ? 'text-emerald-600' : c === 'AVERAGE' || c === 'NEEDS_IMPROVEMENT' ? 'text-amber-600' : c === 'SLOW' || c === 'POOR' ? 'text-rose-600' : 'text-slate-500';
const fmtMs = (n) => n == null ? '–' : n >= 1000 ? (n / 1000).toFixed(1) + ' s' : Math.round(n) + ' ms';

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// Lighthouse descriptions are light markdown: [text](url) links + `code`.
function lhHtml(text) {
  let s = esc(text);
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-brand-700 underline">$1<\/a>');
  s = s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 text-[12px] text-slate-700">$1<\/code>');
  return { __html: s };
}

// Classify an audit into pass / fail / review buckets.
function statusOf(a) {
  if (['manual', 'notApplicable', 'error'].includes(a.mode)) return 'na';
  if (a.mode === 'informative') return 'info';
  if (a.score == null) return 'info';
  return a.score >= 0.9 ? 'pass' : 'fail';
}

function Ring({ score, size = 76, label }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, off = c * (1 - (score || 0)), col = scoreTone(score);
  return html`<div class="flex flex-col items-center gap-1">
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="#e2e8f0" stroke-width="6" />
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${col} stroke-width="6" stroke-linecap="round" stroke-dasharray=${c} stroke-dashoffset=${off} transform=${`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" style=${`font-size:${size * 0.3}px;font-weight:800;fill:${col}`}>${pct(score)}</text>
    </svg>
    <div class="text-xs font-medium text-slate-600">${label}</div>
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

function AuditRow({ a }) {
  const [open, setOpen] = useState(false);
  const st = statusOf(a);
  const dot = st === 'pass' ? 'bg-emerald-500' : st === 'fail' ? 'bg-rose-500' : st === 'info' ? 'bg-sky-400' : 'bg-slate-300';
  const mark = st === 'pass' ? '✓' : st === 'fail' ? '!' : st === 'info' ? 'i' : '–';
  const hasBody = (a.description && a.description.trim()) || (a.items && a.items.length);
  return html`<div class="border-b border-slate-100 last:border-0">
    <button onClick=${() => hasBody && setOpen((o) => !o)} class=${cx('w-full flex items-center gap-3 py-2.5 text-left', hasBody && 'hover:bg-slate-50')}>
      <span class=${cx('shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold', dot)}>${mark}</span>
      <span class="flex-1 min-w-0 text-sm text-slate-800">${a.title}</span>
      ${a.displayValue && html`<span class=${cx('shrink-0 text-xs font-semibold', st === 'fail' ? 'text-rose-600' : 'text-slate-500')}>${a.displayValue}</span>`}
      ${hasBody && html`<span class=${cx('shrink-0 text-slate-300 text-xs transition-transform', open && 'rotate-90')}>▶</span>`}
    </button>
    ${open && hasBody && html`<div class="pl-8 pr-2 pb-3 -mt-1">
      ${a.description && html`<p class="text-[13px] text-slate-600 leading-relaxed" dangerouslySetInnerHTML=${lhHtml(a.description)}></p>`}
      <${ItemsTable} items=${a.items} />
    </div>`}
  </div>`;
}

function CategorySection({ cat, defaultOpen }) {
  const [showPass, setShowPass] = useState(false);
  const audits = cat.audits || [];
  const fails = audits.filter((a) => statusOf(a) === 'fail').sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const review = audits.filter((a) => ['info', 'na'].includes(statusOf(a)));
  const pass = audits.filter((a) => statusOf(a) === 'pass');
  return html`<${Card}><div class="p-4">
    <div class="flex items-center gap-3 mb-1">
      <${Ring} score=${cat.score} size=${56} label="" />
      <div>
        <div class="font-semibold text-slate-800">${CAT_LABEL[cat.id] || cat.title}</div>
        <div class="text-xs text-slate-400">${fails.length} to fix · ${pass.length} passed${review.length ? ` · ${review.length} to review` : ''}</div>
      </div>
    </div>
    <div class="mt-2">
      ${fails.length === 0 && html`<div class="text-sm text-emerald-600 py-2">✓ No failing audits in this category.</div>`}
      ${fails.map((a) => html`<${AuditRow} a=${a} />`)}
      ${review.length > 0 && html`<div class="mt-2 pt-2 border-t border-slate-100">
        <div class="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Manual / informational</div>
        ${review.map((a) => html`<${AuditRow} a=${a} />`)}
      </div>`}
      ${pass.length > 0 && html`<div class="mt-2 pt-2 border-t border-slate-100">
        <button onClick=${() => setShowPass((v) => !v)} class="text-xs text-slate-500 hover:text-slate-700">${showPass ? '▾ Hide' : `▸ Show ${pass.length}`} passed audits</button>
        ${showPass && html`<div class="mt-1">${pass.map((a) => html`<${AuditRow} a=${a} />`)}</div>`}
      </div>`}
    </div>
  </div></${Card}>`;
}

function CruxBand({ crux }) {
  if (!crux) return null;
  const rows = [['LCP', crux.lcp, fmtMs], ['INP', crux.inp, (v) => v == null ? '–' : Math.round(v) + ' ms'], ['CLS', crux.cls, (v) => v == null ? '–' : (v / 100).toFixed(2)], ['FCP', crux.fcp, fmtMs], ['TTFB', crux.ttfb, fmtMs]].filter(([, m]) => m);
  if (!rows.length) return null;
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between mb-2">
      <div class="font-semibold text-slate-800">Field data — real users (28-day CrUX)</div>
      <span class=${cx('text-xs font-semibold', cruxTone(crux.overall))}>${(crux.overall || '').replace('_', ' ') || '—'}</span>
    </div>
    <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
      ${rows.map(([k, m, f]) => html`<div>
        <div class="text-[11px] text-slate-400">${k}</div>
        <div class=${cx('text-base font-semibold', cruxTone(m.cat))}>${f(m.p)}</div>
      </div>`)}
    </div>
  </div></${Card}>`;
}

function FixPlan({ plan }) {
  if (!plan) return null;
  const priTone = (p) => p === 'high' ? 'bg-rose-100 text-rose-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return html`<${Card}><div class="p-4">
    <div class="font-semibold text-slate-800 mb-1">✨ AI fix plan</div>
    <p class="text-sm text-slate-600 mb-3">${plan.summary || ''}</p>
    <div class="space-y-2">${(plan.items || []).map((it) => html`<div class="rounded-lg border border-slate-100 p-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class=${cx('text-[11px] font-bold px-2 py-0.5 rounded-full', priTone(it.priority))}>${(it.priority || '').toUpperCase()}</span>
        <span class="font-medium text-slate-800">${it.title}</span>
        ${it.effort && html`<span class="text-[11px] text-slate-400">· ${it.effort} effort</span>`}
      </div>
      ${it.impact && html`<div class="text-xs text-emerald-700 mt-1">Impact: ${it.impact}</div>`}
      ${Array.isArray(it.steps) && html`<ol class="list-decimal ml-5 mt-1.5 space-y-0.5 text-[13px] text-slate-600">${it.steps.map((s) => html`<li dangerouslySetInnerHTML=${lhHtml(s)}></li>`)}</ol>`}
    </div>`)}</div>
  </div></${Card}>`;
}

export function Lighthouse() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [reports, setReports] = useState([]);
  const [current, setCurrent] = useState(null);
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState('mobile');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const load = async (sid) => { const r = await seoLighthouseLoad(sid); setReports(r); setCurrent(r[0] || null); if (r[0]) { setUrl(r[0].url); setStrategy(r[0].strategy); } };
  useEffect(() => { if (site) load(site).catch((e) => setErr(e.message)); else { setReports([]); setCurrent(null); } }, [site]);

  const run = async () => {
    setBusy('run'); setErr('');
    try { const d = await seoLighthouseRun(site, { url: url.trim(), strategy }); const r = await seoLighthouseLoad(site); setReports(r); setCurrent(d.report || r[0]); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const genFix = async () => {
    setBusy('ai'); setErr('');
    try { const d = await seoLighthouseFixPlan(site, { url: current.url, strategy: current.strategy }); setCurrent({ ...current, fix_plan: d.fix_plan }); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading…</div>`;

  const g = current;
  return html`<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Lighthouse</h1>
        <p class="text-sm text-slate-500">Google's full SEO, performance, accessibility & best-practices audit — with fixes.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
    </div>

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : html`
        <${Card}><div class="p-3 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <${Input} value=${url} onInput=${setUrl} placeholder="homepage (leave blank) or a specific URL to test" class="flex-1 min-w-[240px]" />
            <${Select} value=${strategy} onChange=${setStrategy} options=${[{ value: 'mobile', label: '📱 Mobile' }, { value: 'desktop', label: '🖥 Desktop' }]} />
            <${Btn} size="sm" onClick=${run} disabled=${busy === 'run'}>${busy === 'run' ? 'Running Lighthouse…' : 'Run report'}</${Btn}>
            ${reports.length > 0 && html`<${Select} value=${g?.id || ''} onChange=${(v) => { const sel = reports.find((x) => x.id === v); setCurrent(sel); if (sel) { setUrl(sel.url); setStrategy(sel.strategy); } }} options=${reports.map((x) => ({ value: x.id, label: `${x.url.replace(/^https?:\/\//, '')} · ${x.strategy}` }))} />`}
          </div>
          ${busy === 'run' && html`<div class="text-xs text-slate-400">Lighthouse renders the page in a headless browser and runs ~50 audits — this takes 20–40s.</div>`}
          ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
        </div></${Card}>

        ${!g && !busy && html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Run a report to see the full Lighthouse breakdown.</div></${Card}>`}

        ${g && html`
          <${Card}><div class="p-4">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div class="min-w-0">
                <div class="font-semibold text-slate-800 truncate">${(g.final_url || g.url).replace(/^https?:\/\//, '')}</div>
                <div class="text-xs text-slate-400">${g.strategy} · Lighthouse ${g.lh_version || ''} · ${new Date(g.fetched_at).toLocaleString()}</div>
              </div>
              <${Btn} size="sm" variant="ghost" onClick=${genFix} disabled=${busy === 'ai'}>${busy === 'ai' ? 'Thinking…' : (g.fix_plan ? '↻ Regenerate fix plan' : '✨ Generate fix plan')}</${Btn}>
            </div>
            <div class="grid grid-cols-4 gap-2">
              ${(g.categories || []).map((c) => html`<${Ring} score=${c.score} label=${CAT_LABEL[c.id] || c.title} />`)}
            </div>
            <div class="flex items-center justify-center gap-4 mt-3 text-[11px] text-slate-400">
              <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:#ff4e42"></span>0–49</span>
              <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:#ffa400"></span>50–89</span>
              <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:#0cce6b"></span>90–100</span>
            </div>
          </div></${Card}>

          <${CruxBand} crux=${g.crux} />
          <${FixPlan} plan=${g.fix_plan} />
          ${(g.categories || []).map((c) => html`<${CategorySection} cat=${c} />`)}
        `}
      `}
  </div>`;
}
