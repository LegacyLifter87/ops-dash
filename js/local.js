// ---------------------------------------------------------------------------
// local.js — Local SEO: map-pack geo-grid heatmap. Shows where the business
// ranks in Google Maps across a grid of points around it (green = top 3, red =
// invisible). Powered by DataForSEO maps results at precise coordinates.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadGeogrids, seoGeogridRun } from './store.js';
import { Card, Btn, Select, Input } from './ui.js';

const cellColor = (r) => r == null ? 'bg-slate-200 text-slate-400' : r <= 3 ? 'bg-emerald-500 text-white' : r <= 10 ? 'bg-amber-400 text-white' : r <= 20 ? 'bg-orange-500 text-white' : 'bg-rose-500 text-white';

export function Local() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [grids, setGrids] = useState([]);
  const [current, setCurrent] = useState(null);
  const [kw, setKw] = useState('');
  const [address, setAddress] = useState('');
  const [gridSize, setGridSize] = useState('5');
  const [spacing, setSpacing] = useState('1');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const load = async (sid) => { const g = await seoLoadGeogrids(sid); setGrids(g); setCurrent(g[0] || null); if (g[0]) { setKw(g[0].keyword); setAddress(g[0].location_label || ''); } };
  useEffect(() => { if (site) load(site); else { setGrids([]); setCurrent(null); } }, [site]);

  const run = async () => {
    if (!kw.trim() || !address.trim()) { setErr('Enter a keyword and a business address/city.'); return; }
    setBusy(true); setErr('');
    try { await seoGeogridRun(site, { keyword: kw.trim(), address: address.trim(), gridSize: Number(gridSize), spacing: Number(spacing) }); await load(site); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading…</div>`;

  const g = current;
  const size = g?.grid_size || 5;
  const cells = g ? [...(g.points || [])].sort((a, b) => (a.row - b.row) || (a.col - b.col)) : [];
  const top3 = g ? (g.points || []).filter((p) => p.rank != null && p.rank <= 3).length : 0;

  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Local SEO — Geo-Grid</h1>
        <p class="text-sm text-slate-500">Where you rank in the Google map pack across the area around your business.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
    </div>

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : html`
        <${Card}><div class="p-3 space-y-2">
          <div class="grid sm:grid-cols-2 gap-2">
            <${Input} value=${kw} onInput=${setKw} placeholder="keyword e.g. chimney sweep" />
            <${Input} value=${address} onInput=${setAddress} placeholder="business address or city, e.g. Ocala, FL" />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-slate-500">Grid</span>
            <${Select} value=${gridSize} onChange=${setGridSize} options=${[{ value: '3', label: '3×3' }, { value: '5', label: '5×5' }, { value: '7', label: '7×7' }]} />
            <span class="text-xs text-slate-500">Spacing</span>
            <${Select} value=${spacing} onChange=${setSpacing} options=${[{ value: '0.5', label: '0.5 mi' }, { value: '1', label: '1 mi' }, { value: '2', label: '2 mi' }]} />
            <${Btn} size="sm" onClick=${run} disabled=${busy}>${busy ? 'Scanning…' : 'Run geo-grid'}</${Btn}>
            ${grids.length > 0 && html`<${Select} value=${g?.id || ''} onChange=${(v) => { const sel = grids.find((x) => x.id === v); setCurrent(sel); if (sel) { setKw(sel.keyword); setAddress(sel.location_label || ''); } }} options=${grids.map((x) => ({ value: x.id, label: x.keyword }))} />`}
          </div>
          ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
          ${busy && html`<div class="text-xs text-slate-400">Checking map rank at ${size * size} points — this takes ~30s.</div>`}
        </div></${Card}>

        ${g && html`
          <div class="grid grid-cols-3 gap-3">
            ${[['Avg map rank', g.avg_rank != null ? Number(g.avg_rank).toFixed(1) : '—'], ['Visible points', `${g.found}/${g.total}`], ['In top 3', `${top3}/${g.total}`]].map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div></div></${Card}>`)}
          </div>
          <${Card}><div class="p-4">
            <div class="flex items-center justify-between mb-3">
              <div><div class="font-semibold text-slate-800">"${g.keyword}"</div><div class="text-xs text-slate-400 truncate max-w-md">${g.location_label || ''}</div></div>
              <div class="flex items-center gap-2 text-[11px] text-slate-500">
                <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-500"></span>1–3</span>
                <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-400"></span>4–10</span>
                <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-orange-500"></span>11–20</span>
                <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-rose-500"></span>20+</span>
                <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-200"></span>none</span>
              </div>
            </div>
            <div class="mx-auto" style=${`display:grid;grid-template-columns:repeat(${size},minmax(0,1fr));gap:6px;max-width:${size * 56}px`}>
              ${cells.map((p) => html`<div class=${cx('aspect-square rounded-lg flex items-center justify-center text-sm font-bold', cellColor(p.rank))} title=${`${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}>${p.rank == null ? '—' : p.rank > 20 ? '20+' : p.rank}</div>`)}
            </div>
            <div class="text-[11px] text-slate-400 text-center mt-2">Each cell = the map-pack position at that spot. Center = your business. ${g.spacing_miles} mi spacing.</div>
          </div></${Card}>
        `}
      `}
  </div>`;
}
