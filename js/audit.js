// ---------------------------------------------------------------------------
// audit.js — Technical SEO Audit + AEO/AI-readiness. Crawls the site's real
// pages for technical issues, and (on demand) runs a Claude AEO/GEO analysis
// per page — how ready it is for AI answer engines to understand and cite.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadAudit, seoAuditRun, seoAuditAi } from './store.js';
import { Card, Btn, Select, Modal } from './ui.js';
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
  const sort = useSort('technical_score', 'asc');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const load = async (sid) => setPages(await seoLoadAudit(sid));
  useEffect(() => { if (site) load(site); else setPages([]); }, [site]);

  const runAudit = async () => {
    setBusy('crawl'); setErr(''); setBanner('');
    try { const r = await seoAuditRun(site); setBanner(`Audited ${num(r.audited)} of ${num(r.pages)} pages.`); await load(site); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const analyzeAi = async (url) => {
    setBusy('ai:' + url); setErr('');
    try { await seoAuditAi(site, url); await load(site); }
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

    ${openPage && html`<${DetailModal} page=${openPage} busy=${busy === 'ai:' + openPage.url} onClose=${() => setOpenUrl(null)} onAi=${() => analyzeAi(openPage.url)} />`}
  </div>`;
}

function DetailModal({ page, busy, onClose, onAi }) {
  const ai = page.ai_insights;
  return html`<${Modal} title=${shortUrl(page.url)} wide onClose=${onClose}
    footer=${html`<div class="flex justify-between items-center w-full"><a href=${page.url} target="_blank" rel="noopener" class="text-xs text-brand-700 underline">Open page ↗</a><${Btn} size="sm" onClick=${onAi} disabled=${busy}>${busy ? 'Analyzing…' : (ai ? 'Re-run AI analysis' : '✨ Run AI / AEO analysis')}</${Btn}></div>`}>
    <div class="space-y-4 text-sm">
      <div class="flex flex-wrap gap-2 items-center">
        <${Pill} cls=${scoreColor(page.technical_score || 0)}>Tech ${page.technical_score ?? '—'}</${Pill}>
        ${page.ai_score != null && html`<${Pill} cls=${scoreColor(page.ai_score)}>AI ${page.ai_score}</${Pill}>`}
        <span class="text-xs text-slate-400">HTTP ${page.status_code} · ${num(page.word_count)} words</span>
      </div>

      <div>
        <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Technical issues (${(page.issues || []).length})</div>
        ${(page.issues || []).length === 0 ? html`<div class="text-emerald-600">No technical issues. 🎉</div>`
          : html`<ul class="space-y-1">${(page.issues || []).map((i) => html`<li class=${cx('flex gap-2', sevColor[i.severity])}><span class="text-[10px] uppercase font-bold mt-0.5">${i.severity}</span><span class="text-slate-700">${i.message}</span></li>`)}</ul>`}
      </div>

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
