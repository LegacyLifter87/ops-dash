// ---------------------------------------------------------------------------
// ranks.js — Rank Tracking: keyword positions over time from GSC snapshots
// (seo_rank_history). Snapshots are captured on every sync + a daily cron.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadRankHistory } from './store.js';
import { Card, Select } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const posf = (n) => (n ? n.toFixed(1) : '—');
const num = (n) => (n || 0).toLocaleString();

function Spark({ series }) {
  if (!series || series.length < 2) return html`<span class="text-slate-300 text-xs">—</span>`;
  const w = 64, h = 18, ps = series.map((s) => s.position);
  const min = Math.min(...ps), max = Math.max(...ps), range = (max - min) || 1;
  // lower position = better, so draw it higher on the chart (smaller y)
  const pts = series.map((s, i) => `${((i / (series.length - 1)) * w).toFixed(1)},${(((s.position - min) / range) * h).toFixed(1)}`).join(' ');
  const improved = ps[ps.length - 1] <= ps[0];
  return html`<svg width=${w} height=${h} class="inline-block align-middle"><polyline points=${pts} fill="none" stroke=${improved ? '#10b981' : '#f43f5e'} stroke-width="1.5" /></svg>`;
}

export function Ranks() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [hist, setHist] = useState([]);
  const sortR = useSort('impressions', 'desc');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  useEffect(() => { if (site) seoLoadRankHistory(site).then(setHist); else setHist([]); }, [site]);

  const rows = useMemo(() => {
    const byK = new Map();
    for (const r of hist) { let a = byK.get(r.keyword); if (!a) { a = { keyword: r.keyword, series: [] }; byK.set(r.keyword, a); } a.series.push({ date: r.snapshot_date, position: Number(r.position), impressions: r.impressions }); }
    const out = [];
    for (const a of byK.values()) {
      a.series.sort((x, y) => (x.date < y.date ? -1 : 1));
      const latest = a.series[a.series.length - 1], prev = a.series.length > 1 ? a.series[a.series.length - 2] : null;
      out.push({ keyword: a.keyword, position: latest.position, impressions: latest.impressions, change: prev ? (prev.position - latest.position) : 0, points: a.series.length, series: a.series });
    }
    return out;
  }, [hist]);

  const sorted = sortR.sort(rows).slice(0, 300);

  const stats = useMemo(() => ({
    tracked: rows.length,
    avg: rows.length ? rows.reduce((s, r) => s + r.position, 0) / rows.length : 0,
    top3: rows.filter((r) => r.position && r.position <= 3).length,
    top10: rows.filter((r) => r.position && r.position <= 10).length,
    up: rows.filter((r) => r.change > 0.3).length,
    down: rows.filter((r) => r.change < -0.3).length,
  }), [rows]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading rank tracking…</div>`;

  const dates = [...new Set(hist.map((h) => h.snapshot_date))].sort();
  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Rank Tracking</h1>
        <p class="text-sm text-slate-500">Keyword positions over time from Search Console. ${dates.length} snapshot${dates.length === 1 ? '' : 's'} · captured on each sync and daily.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
    </div>

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : rows.length === 0
        ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No rank history yet. Sync a site in the <span class="font-medium">SEO</span> tab — positions are captured on each sync (and automatically every day).</div></${Card}>`
        : html`
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            ${[['Tracked', num(stats.tracked)], ['Avg position', posf(stats.avg)], ['In top 3', num(stats.top3)], ['In top 10', num(stats.top10)], ['Improved', num(stats.up)], ['Declined', num(stats.down)]]
              .map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div></div></${Card}>`)}
          </div>
          <${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
              <${SortTh} k="keyword" label="Keyword" sort=${sortR} /><${SortTh} k="position" label="Position" sort=${sortR} right=${true} /><${SortTh} k="change" label="Change" sort=${sortR} right=${true} /><th class="py-1.5 pr-3">Trend</th><${SortTh} k="impressions" label="Impr." sort=${sortR} right=${true} /></tr></thead>
            <tbody>${sorted.map((r) => html`<tr class="border-b border-slate-50">
              <td class="py-1.5 pr-3 font-medium text-slate-800 max-w-xs truncate">${r.keyword}</td>
              <td class="py-1.5 pr-3 text-right tabular-nums">${posf(r.position)}</td>
              <td class=${cx('py-1.5 pr-3 text-right tabular-nums', r.change > 0.3 ? 'text-emerald-600' : r.change < -0.3 ? 'text-rose-600' : 'text-slate-400')}>${r.points < 2 ? '—' : r.change > 0 ? `▲ ${r.change.toFixed(1)}` : r.change < 0 ? `▼ ${Math.abs(r.change).toFixed(1)}` : '0'}</td>
              <td class="py-1.5 pr-3"><${Spark} series=${r.series} /></td>
              <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.impressions)}</td>
            </tr>`)}</tbody>
          </table></div></${Card}>
        `}
  </div>`;
}
