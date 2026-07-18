// ---------------------------------------------------------------------------
// trends.js — 12-month SEO history & analysis. Charts the monthly GSC rollups
// (seo_monthly_site), shows MoM + YoY deltas for the latest full month, surfaces
// rising/declining queries (last 3 full months vs the prior 3), and offers a
// Claude analysis of trajectory/seasonality/actions. Backfill pulls 13 months
// so the newest month always has a year-ago comparison.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { seoLoadMonthly, seoLoadMonthlyQueries, seoGscBackfill, seoTrendsAi } from './store.js';
import { Card, Btn } from './ui.js';

const num = (n) => (n || 0).toLocaleString();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return `${MONTHS[m - 1]}${m === 1 ? ` '${String(y).slice(2)}` : ''}`; };
const METRICS = [['clicks', 'Clicks'], ['impressions', 'Impressions'], ['ctr', 'CTR'], ['position', 'Avg position']];

function deltaOf(cur, prev, lowerBetter = false) {
  if (cur == null || prev == null || !Number(prev)) return null;
  const d = ((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100;
  return { d, good: lowerBetter ? d < 0 : d > 0 };
}
const DeltaBadge = ({ dd, label }) => dd == null
  ? html`<span class="text-[11px] text-slate-300">${label}: —</span>`
  : html`<span class=${cx('text-[11px] font-semibold', dd.good ? 'text-emerald-600' : 'text-rose-600')}>${label}: ${dd.d > 0 ? '▲' : '▼'}${Math.abs(dd.d).toFixed(0)}%</span>`;

export function Chart({ months, metric, partialMk }) {
  const vals = months.map((m) => (metric === 'ctr' ? Number(m.ctr) * 100 : Number(m[metric])));
  const w = 640, h = 190, padB = 20, padL = 4;
  const bw = (w - padL * 2) / months.length;
  const fmtV = (v) => metric === 'ctr' ? `${v.toFixed(2)}%` : metric === 'position' ? v.toFixed(1) : num(Math.round(v));

  if (metric === 'position') {
    const vmin = Math.max(0.9, Math.min(...vals)), vmax = Math.max(...vals, vmin + 1);
    const y = (v) => 10 + ((v - vmin) / (vmax - vmin)) * (h - padB - 20);
    const pts = vals.map((v, i) => `${(padL + i * bw + bw / 2).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return html`<svg viewBox=${`0 0 ${w} ${h}`} class="w-full" style="max-height:190px">
      <polyline points=${pts} fill="none" stroke="#6366f1" stroke-width="2.5" />
      ${vals.map((v, i) => html`<circle cx=${(padL + i * bw + bw / 2).toFixed(1)} cy=${y(v).toFixed(1)} r="3.5" fill=${months[i].month === partialMk ? '#c7d2fe' : '#6366f1'}><title>${months[i].month}: position ${v.toFixed(1)}</title></circle>`)}
      ${months.map((m, i) => html`<text x=${(padL + i * bw + bw / 2).toFixed(1)} y=${h - 4} text-anchor="middle" style="font-size:9.5px;fill:#94a3b8">${mLabel(m.month)}</text>`)}
      <text x=${w - 4} y="12" text-anchor="end" style="font-size:10px;fill:#94a3b8">higher on chart = closer to #1</text>
    </svg>`;
  }

  const vmax = Math.max(...vals, 1);
  return html`<svg viewBox=${`0 0 ${w} ${h}`} class="w-full" style="max-height:190px">
    ${vals.map((v, i) => {
      const bh = Math.max(1.5, (v / vmax) * (h - padB - 24));
      const partial = months[i].month === partialMk;
      return html`<g>
        <rect x=${(padL + i * bw + bw * 0.14).toFixed(1)} y=${(h - padB - bh).toFixed(1)} width=${(bw * 0.72).toFixed(1)} height=${bh.toFixed(1)} rx="3" fill=${partial ? '#c7d2fe' : '#6366f1'}><title>${months[i].month}: ${fmtV(v)}${partial ? ' (month in progress)' : ''}</title></rect>
        <text x=${(padL + i * bw + bw / 2).toFixed(1)} y=${(h - padB - bh - 4).toFixed(1)} text-anchor="middle" style="font-size:9px;fill:#64748b">${fmtV(v)}</text>
      </g>`;
    })}
    ${months.map((m, i) => html`<text x=${(padL + i * bw + bw / 2).toFixed(1)} y=${h - 4} text-anchor="middle" style="font-size:9.5px;fill:#94a3b8">${mLabel(m.month)}</text>`)}
  </svg>`;
}

function Movers({ title, rows, up }) {
  return html`<${Card}><div class="p-3">
    <div class="text-sm font-semibold text-slate-700 mb-1.5">${title} <span class="text-[11px] font-normal text-slate-400">last 3 full months vs prior 3</span></div>
    ${rows.length === 0 ? html`<div class="text-xs text-slate-400">Nothing significant.</div>`
      : html`<div class="space-y-1">${rows.map((m) => html`<div class="flex items-center gap-2 text-sm">
          <span class=${cx('font-semibold text-xs tabular-nums w-14 shrink-0', up ? 'text-emerald-600' : 'text-rose-600')}>${up ? '+' : ''}${num(m.d)}</span>
          <span class="flex-1 min-w-0 truncate text-slate-700">${m.q}</span>
          <span class="text-[11px] text-slate-400 tabular-nums shrink-0">${num(m.p)} → ${num(m.r)} clicks</span>
        </div>`)}</div>`}
  </div></${Card}>`;
}

function Analysis({ a }) {
  if (!a) return null;
  const tone = a.trajectory === 'growing' ? 'bg-emerald-100 text-emerald-700' : a.trajectory === 'declining' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600';
  return html`<${Card}><div class="p-4 border-l-4 border-brand-400">
    <div class="flex items-center gap-2 mb-1 flex-wrap">
      <span class="font-semibold text-slate-800">✨ 12-month analysis</span>
      <span class=${cx('text-[11px] font-bold px-2 py-0.5 rounded-full uppercase', tone)}>${a.trajectory || ''}</span>
    </div>
    <p class="text-sm text-slate-700 leading-relaxed">${a.summary}</p>
    ${a.seasonality && html`<p class="text-sm text-slate-500 mt-1">🗓 ${a.seasonality}</p>`}
    <div class="grid sm:grid-cols-2 gap-3 mt-3">
      <div><div class="text-xs font-semibold text-emerald-700 mb-1">Wins</div>${(a.wins || []).map((w) => html`<div class="text-[13px] text-slate-600">• ${w}</div>`)}</div>
      <div><div class="text-xs font-semibold text-rose-700 mb-1">Concerns</div>${(a.concerns || []).map((w) => html`<div class="text-[13px] text-slate-600">• ${w}</div>`)}</div>
    </div>
    ${(a.actions || []).length > 0 && html`<div class="mt-3 pt-2 border-t border-slate-100">
      <div class="text-xs font-semibold text-slate-500 mb-1">Do next</div>
      <ol class="list-decimal ml-5 space-y-0.5 text-[13px] text-slate-700">${a.actions.map((x) => html`<li>${x}</li>`)}</ol>
    </div>`}
  </div></${Card}>`;
}

export function Trends({ siteId, canRun = true }) {
  const [months, setMonths] = useState(null);
  const [mq, setMq] = useState([]);
  const [metric, setMetric] = useState('clicks');
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const m = await seoLoadMonthly(siteId);
    setMonths(m);
    if (m.length) {
      const since = m.map((x) => x.month).slice(-7)[0];
      setMq(await seoLoadMonthlyQueries(siteId, since));
    } else setMq([]);
  };
  useEffect(() => { setMonths(null); setMq([]); setAnalysis(null); setErr(''); if (siteId) load().catch((e) => setErr(e.message)); }, [siteId]);

  const backfill = async () => { setBusy('bf'); setErr(''); try { await seoGscBackfill(siteId); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const analyze = async () => { setBusy('ai'); setErr(''); try { const d = await seoTrendsAi(siteId); setAnalysis(d.analysis); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  if (months === null) return html`<div class="p-6 text-sm text-slate-400">Loading…</div>`;

  const nowMk = new Date().toISOString().slice(0, 7);
  const partialMk = months.length && months[months.length - 1].month === nowMk ? nowMk : null;
  const full = months.filter((m) => m.month !== partialMk);
  const latest = full[full.length - 1] || null;
  const prev = full[full.length - 2] || null;
  const yoyKey = latest ? `${Number(latest.month.slice(0, 4)) - 1}${latest.month.slice(4)}` : null;
  const yoy = months.find((m) => m.month === yoyKey) || null;

  // movers: last 3 full months vs prior 3
  const fullKeys = full.map((m) => m.month);
  const recent = new Set(fullKeys.slice(-3)), prior = new Set(fullKeys.slice(-6, -3));
  const agg = new Map();
  for (const r of mq) {
    if (!recent.has(r.month) && !prior.has(r.month)) continue;
    let a = agg.get(r.query); if (!a) { a = { q: r.query, r: 0, p: 0 }; agg.set(r.query, a); }
    if (recent.has(r.month)) a.r += r.clicks; else a.p += r.clicks;
  }
  const movers = [...agg.values()].map((a) => ({ ...a, d: a.r - a.p })).filter((m) => Math.abs(m.d) >= 2);
  const rising = movers.filter((m) => m.d > 0).sort((a, b) => b.d - a.d).slice(0, 8);
  const declining = movers.filter((m) => m.d < 0).sort((a, b) => a.d - b.d).slice(0, 8);

  return html`<div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div class="font-semibold text-slate-800">12-month organic trend</div>
        <div class="text-xs text-slate-400">${months.length ? `${months[0].month} → ${months[months.length - 1].month}${partialMk ? ' (current month in progress)' : ''} · refreshed with every sync` : 'No history built yet'}</div>
      </div>
      <div class="flex items-center gap-2">
        ${canRun && months.length > 0 && html`<${Btn} size="sm" variant="ghost" onClick=${analyze} disabled=${busy === 'ai'}>${busy === 'ai' ? 'Thinking…' : (analysis ? '↻ Re-analyze' : '✨ Analyze')}</${Btn}>`}
        ${canRun && html`<${Btn} size="sm" variant=${months.length ? 'secondary' : 'primary'} onClick=${backfill} disabled=${busy === 'bf'}>${busy === 'bf' ? 'Pulling 13 months…' : (months.length ? '↻ Rebuild history' : 'Build 12-month history')}</${Btn}>`}
      </div>
    </div>
    ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
    ${busy === 'bf' && html`<div class="text-xs text-slate-400">Pulling 13 months of Search Console data (totals + top queries per month) — ~15s.</div>`}

    ${months.length === 0 && !busy
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">${canRun ? 'Build the history to unlock monthly trends, year-over-year comparisons, seasonality, and rising/declining queries.' : 'No history yet — ask an account admin to build it.'}</div></${Card}>`
      : months.length > 0 && html`
        ${latest && html`<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          ${[['Clicks', latest.clicks, prev?.clicks, yoy?.clicks, false],
            ['Impressions', latest.impressions, prev?.impressions, yoy?.impressions, false],
            ['CTR', Number(latest.ctr) * 100, prev ? Number(prev.ctr) * 100 : null, yoy ? Number(yoy.ctr) * 100 : null, false],
            ['Avg position', Number(latest.position), prev ? Number(prev.position) : null, yoy ? Number(yoy.position) : null, true]]
            .map(([k, cur, pv, yv, lower]) => html`<${Card}><div class="p-3">
              <div class="text-[11px] text-slate-400">${k} · ${mLabel(latest.month)} (latest full month)</div>
              <div class="text-lg font-semibold text-slate-800">${k === 'CTR' ? `${cur.toFixed(2)}%` : k === 'Avg position' ? cur.toFixed(1) : num(cur)}</div>
              <div class="flex gap-3 mt-0.5">
                <${DeltaBadge} dd=${deltaOf(cur, pv, lower)} label="MoM" />
                <${DeltaBadge} dd=${deltaOf(cur, yv, lower)} label="YoY" />
              </div>
            </div></${Card}>`)}
        </div>`}

        <${Card}><div class="p-4">
          <div class="flex items-center gap-1 mb-2">
            ${METRICS.map(([id, label]) => html`<button onClick=${() => setMetric(id)} class=${cx('px-2.5 py-1 rounded-full text-xs border', metric === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>${label}</button>`)}
          </div>
          <${Chart} months=${months} metric=${metric} partialMk=${partialMk} />
        </div></${Card}>

        ${analysis && html`<${Analysis} a=${analysis} />`}

        <div class="grid md:grid-cols-2 gap-3">
          <${Movers} title="📈 Rising queries" rows=${rising} up=${true} />
          <${Movers} title="📉 Declining queries" rows=${declining} up=${false} />
        </div>
      `}
  </div>`;
}
