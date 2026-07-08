// ---------------------------------------------------------------------------
// local.js — Local SEO: map-pack geo-grid heatmap. Shows where the business
// ranks in Google Maps across a grid of points around it (green = top 3, red =
// invisible). Powered by DataForSEO maps results at precise coordinates.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useRef, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadGeogrids, seoGeogridRun } from './store.js';
import { Card, Btn, Select, Input } from './ui.js';
import { ProfileAudit } from './gbp.js';
import { Citations } from './citations.js';

const cellColor = (r) => r == null ? 'bg-slate-200 text-slate-400' : r <= 3 ? 'bg-emerald-500 text-white' : r <= 10 ? 'bg-amber-400 text-white' : r <= 20 ? 'bg-orange-500 text-white' : 'bg-rose-500 text-white';
const pointColor = (r) => r == null ? '#94a3b8' : r <= 3 ? '#10b981' : r <= 10 ? '#f59e0b' : r <= 20 ? '#f97316' : '#ef4444';

let _leafletCss = false;
function ensureLeafletCss() { if (_leafletCss || document.getElementById('leaflet-css')) return; _leafletCss = true; const l = document.createElement('link'); l.id = 'leaflet-css'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); }

// Geo-grid overlaid on a real map (Leaflet + free OpenStreetMap tiles).
function GridMap({ grid }) {
  const elRef = useRef(null), map = useRef(null), layer = useRef(null), Lref = useRef(null);
  const [failed, setFailed] = useState(false);

  const draw = () => {
    const L = Lref.current, m = map.current, lg = layer.current;
    if (!L || !m || !lg || !grid) return;
    lg.clearLayers();
    const pts = grid.points || [], latlngs = [];
    for (const p of pts) {
      const label = p.rank == null ? '—' : p.rank > 20 ? '20+' : String(p.rank);
      const icon = L.divIcon({ html: `<div style="width:30px;height:30px;border-radius:9999px;background:${pointColor(p.rank)};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px system-ui,sans-serif">${label}</div>`, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
      L.marker([p.lat, p.lng], { icon }).addTo(lg);
      latlngs.push([p.lat, p.lng]);
    }
    L.circleMarker([grid.center_lat, grid.center_lng], { radius: 5, color: '#0f172a', weight: 2, fillColor: '#0f172a', fillOpacity: 1 }).addTo(lg).bindTooltip('Business');
    if (latlngs.length) m.fitBounds(latlngs, { padding: [30, 30], maxZoom: 15 });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        ensureLeafletCss();
        const Lmod = await import('https://esm.sh/leaflet@1.9.4');
        const L = Lmod.default || Lmod;
        if (cancelled || !elRef.current || map.current) return;
        Lref.current = L;
        const m = L.map(elRef.current, { scrollWheelZoom: false }).setView([Number(grid.center_lat), Number(grid.center_lng)], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(m);
        layer.current = L.layerGroup().addTo(m);
        map.current = m;
        setTimeout(() => { m.invalidateSize(); draw(); }, 60);
      } catch (_) { if (!cancelled) setFailed(true); }
    })();
    return () => { cancelled = true; if (map.current) { map.current.remove(); map.current = null; } };
  }, []);
  useEffect(() => { draw(); }, [grid?.id]);

  if (failed) return html`<div class="text-sm text-slate-400 p-6 text-center">Map couldn't load — check your connection.</div>`;
  return html`<div ref=${elRef} class="border border-slate-200 rounded-xl overflow-hidden" style="height:460px"></div>`;
}

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
  const [view, setView] = useState('grid');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  // Returned from the Google Business Profile OAuth flow → open Profile Audit.
  useEffect(() => { const q = new URLSearchParams(location.search); if (q.get('gbp')) { setView('profile'); history.replaceState(null, '', location.pathname + location.hash); } }, []);
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
  const siteObj = sites?.find((x) => x.id === site);
  const top3 = g ? (g.points || []).filter((p) => p.rank != null && p.rank <= 3).length : 0;

  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Local SEO</h1>
        <p class="text-sm text-slate-500">Map-pack rankings across your area and your Google Business Profile.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
    </div>

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : html`
        <div class="flex gap-1 border-b border-slate-200">
          ${[['grid', '📍 Geo-Grid'], ['profile', '🏢 Profile Audit'], ['citations', '📑 Citations']].map(([id, label]) => html`<button onClick=${() => setView(id)} class=${cx('px-3 py-2 text-sm -mb-px border-b-2', view === id ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700')}>${label}</button>`)}
        </div>
        ${view === 'citations'
          ? html`<${Citations} siteId=${site} domain=${siteObj?.domain} />`
          : view === 'profile'
          ? html`<${ProfileAudit} siteId=${site} defaultName=${siteObj?.display_name || siteObj?.domain || ''} domain=${siteObj?.domain} />`
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
          ${busy && html`<div class="text-xs text-slate-400">Checking map rank at ${Number(gridSize) * Number(gridSize)} points — this takes ~30s.</div>`}
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
            <${GridMap} grid=${g} />
            <div class="text-[11px] text-slate-400 text-center mt-2">Each marker = your Google Maps position at that spot. Black dot = the business. ${g.spacing_miles} mi spacing.</div>
          </div></${Card}>
        `}
        `}
      `}
  </div>`;
}
