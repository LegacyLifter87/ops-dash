// ---------------------------------------------------------------------------
// dashboard.js — SEO Command Center. Aggregates every signal into a visibility
// score + headline stats, module summaries, an AI executive summary, and the
// prioritized action plan (AI Recommendation Engine) from seo-overview.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, activeAccount, getUserEmail, seoLoadSites, seoOverview, seoOverviewAiSummary } from './store.js';
import { Card, Btn, Select } from './ui.js';

const num = (n) => (n || 0).toLocaleString();
const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const posf = (n) => (n ? n.toFixed(1) : '—');
const scoreColor = (s) => (s >= 70 ? '#10b981' : s >= 45 ? '#f59e0b' : '#f43f5e');
const priColor = (p) => (p >= 80 ? 'bg-rose-100 text-rose-700' : p >= 65 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600');
const recIcon = { optimize: '🎯', technical: '🩺', content: '✍️', competitor: '⚔️', ctr: '🔤', authority: '🔗' };

function Gauge({ score }) {
  const r = 46, c = 2 * Math.PI * r, off = c * (1 - (score || 0) / 100), col = scoreColor(score || 0);
  return html`<svg viewBox="0 0 110 110" class="w-28 h-28">
    <circle cx="55" cy="55" r=${r} fill="none" stroke="#e2e8f0" stroke-width="9" />
    <circle cx="55" cy="55" r=${r} fill="none" stroke=${col} stroke-width="9" stroke-linecap="round" stroke-dasharray=${c} stroke-dashoffset=${off} transform="rotate(-90 55 55)" />
    <text x="55" y="52" text-anchor="middle" class="fill-slate-800" style="font-size:26px;font-weight:800">${score ?? '—'}</text>
    <text x="55" y="70" text-anchor="middle" class="fill-slate-400" style="font-size:10px">/ 100</text>
  </svg>`;
}

export function Dashboard({ navigate }) {
  useStore();
  const accountId = getActiveAccountId();
  const acct = activeAccount();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [ov, setOv] = useState(null);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const load = async (sid) => { setOv(null); setSummary(''); setErr(''); if (!sid) return; setBusy('load'); try { setOv(await seoOverview(sid)); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  useEffect(() => { if (site) load(site); }, [site]);
  const genSummary = async () => { setBusy('ai'); setErr(''); try { const r = await seoOverviewAiSummary(site); setSummary(r.summary); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  const s = ov?.stats;
  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">${acct?.name || 'Command Center'}</h1>
        <p class="text-sm text-slate-500">SEO Command Center · ${getUserEmail()}</p>
      </div>
      <div class="flex items-center gap-2">
        ${sites && sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((x) => ({ value: x.id, label: x.display_name || x.domain }))} />`}
        ${site && html`<${Btn} size="sm" onClick=${() => load(site)} disabled=${busy === 'load'}>${busy === 'load' ? 'Loading…' : 'Refresh'}</${Btn}>`}
      </div>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

    ${sites === null ? html`<div class="p-8 text-sm text-slate-400">Loading…</div>`
      : sites.length === 0 ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Google Search Console in the <button onClick=${() => navigate('seo')} class="text-brand-700 underline">SEO</button> tab to light up your Command Center.</div></${Card}>`
        : busy === 'load' && !ov ? html`<div class="p-8 text-sm text-slate-400">Building overview…</div>`
          : !ov ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No data yet. Sync Search Console and build your keyword database first.</div></${Card}>`
            : html`
      <div class="grid lg:grid-cols-3 gap-4">
        <${Card}><div class="p-4 flex items-center gap-4">
          <${Gauge} score=${ov.visibility} />
          <div>
            <div class="text-xs font-semibold text-slate-400 uppercase">Organic visibility</div>
            <div class="text-sm text-slate-600 mt-1">Blends rankings, reach, technical health &amp; authority into one score for <span class="font-medium">${ov.site}</span>.</div>
          </div>
        </div></${Card}>
        <div class="lg:col-span-2"><${Card}><div class="p-4">
          <div class="flex items-center justify-between">
            <div class="text-xs font-semibold text-slate-400 uppercase">AI summary</div>
            <${Btn} size="sm" onClick=${genSummary} disabled=${busy === 'ai'}>${busy === 'ai' ? 'Thinking…' : (summary ? 'Regenerate' : '✨ Summarize')}</${Btn}>
          </div>
          <p class="text-sm text-slate-700 mt-2 leading-relaxed">${summary || 'Click Summarize for a plain-English readout of where organic search stands and the top priorities this month.'}</p>
        </div></${Card}></div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        ${[['Clicks/mo', num(s.clicks)], ['Impressions', num(s.impressions)], ['Avg position', posf(s.avgPos)], ['Top 3', num(s.top3)], ['Top 10', num(s.top10)], ['Keywords', num(s.totalKw)], ['High opp.', num(s.highOpp)], ['Est. $/mo', s.estValue > 0 ? money(s.estValue) : '—']]
          .map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-[11px] text-slate-400">${k}</div><div class="text-base font-semibold text-slate-800">${v}</div></div></${Card}>`)}
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${[
          ['audit', '🩺', 'Technical health', s.avgTech != null ? `${s.avgTech}/100` : '—', `${num(s.criticals)} critical · ${num(s.auditPages)} pages`],
          ['backlinks', '🔗', 'Authority', s.domainRank != null ? `rank ${s.domainRank}` : '—', `${num(s.refDomains)} referring domains`],
          ['competitors', '⚔️', 'Competitors', num(s.competitors), `${num(s.gap)} gap keywords`],
          ['keywords', '✍️', 'Content', `${num(s.briefs)} briefs`, `${num(s.striking)} striking-distance kw`],
        ].map(([tab, icon, title, big, sub]) => html`<${Card}><button onClick=${() => navigate(tab)} class="w-full text-left p-4 hover:bg-slate-50">
            <div class="text-xl">${icon}</div>
            <div class="text-xs text-slate-400 mt-1">${title}</div>
            <div class="text-lg font-semibold text-slate-800">${big}</div>
            <div class="text-[11px] text-slate-400">${sub}</div>
          </button></${Card}>`)}
      </div>

      <${Card}><div class="p-4">
        <div class="font-semibold text-slate-800 mb-1">Do these first</div>
        <p class="text-xs text-slate-400 mb-3">Prioritized across every signal — rankings, technical, content gaps, competitors, and CTR.</p>
        ${ov.recommendations.length === 0
          ? html`<div class="text-sm text-slate-400">No recommendations yet — sync data and run the audit, keyword, and competitor tools to populate this.</div>`
          : html`<div class="space-y-2">${ov.recommendations.map((r) => html`<div class="flex items-start gap-3 py-2 border-b border-slate-50">
              <span class=${cx('text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5', priColor(r.priority))}>${r.priority}</span>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-slate-800">${recIcon[r.type] || '•'} ${r.title}</div>
                <div class="text-xs text-slate-500">${r.detail}</div>
              </div>
              <div class="text-right shrink-0">
                ${r.impact && html`<div class="text-xs font-medium text-emerald-700">${r.impact}</div>`}
                <button onClick=${() => navigate(r.tab)} class="text-xs text-brand-700 hover:underline">Open →</button>
              </div>
            </div>`)}</div>`}
      </div></${Card}>
    `}
  </div>`;
}
