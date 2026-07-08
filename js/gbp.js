// ---------------------------------------------------------------------------
// gbp.js — Google Business Profile audit. Pulls the public profile (via
// DataForSEO) and scores completeness/optimization, extracts the default
// keywords/services/categories Google already associates with the business,
// lists prioritized fixes with guidance, and offers an AI optimization plan.
// Owner sign-in (business.manage) for private metrics is a gated add-on.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { seoGbpAudit, seoGbpLoad, seoGbpAiPlan, seoGbpStatus, seoGbpConnect, seoGbpDisconnect, seoGbpLocations, seoGbpSelectLocation, seoGbpMetrics } from './store.js';
import { Card, Btn, Input } from './ui.js';

const nfmt = (n) => (n || 0).toLocaleString();

const sevTone = (s) => s === 'critical' ? 'bg-rose-500' : s === 'warning' ? 'bg-amber-400' : 'bg-sky-400';
const sevRank = { critical: 0, warning: 1, info: 2 };
const scoreCol = (s) => s == null ? '#94a3b8' : s >= 80 ? '#10b981' : s >= 55 ? '#f59e0b' : '#f43f5e';

function ScoreRing({ score, size = 96 }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, off = c * (1 - (score || 0) / 100), col = scoreCol(score);
  return html`<svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="#e2e8f0" stroke-width="8" />
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${col} stroke-width="8" stroke-linecap="round" stroke-dasharray=${c} stroke-dashoffset=${off} transform=${`rotate(-90 ${size / 2} ${size / 2})`} />
    <text x="50%" y="46%" dominant-baseline="central" text-anchor="middle" style=${`font-size:${size * 0.32}px;font-weight:800;fill:${col}`}>${score ?? '–'}</text>
    <text x="50%" y="66%" text-anchor="middle" style="font-size:10px;fill:#94a3b8">/ 100</text>
  </svg>`;
}

function Chips({ items, tone = 'slate' }) {
  if (!items || !items.length) return html`<span class="text-xs text-slate-400">—</span>`;
  const t = tone === 'brand' ? 'bg-brand-50 text-brand-700 border-brand-100' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200';
  return html`<div class="flex flex-wrap gap-1.5">${items.map((x) => html`<span class=${cx('text-xs px-2 py-0.5 rounded-full border', t)}>${x}</span>`)}</div>`;
}

function Stars({ value, votes }) {
  if (value == null) return html`<span class="text-sm text-slate-400">No rating</span>`;
  const full = Math.round(value);
  return html`<span class="text-sm text-slate-700"><span class="text-amber-400">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span> <span class="font-semibold">${value}</span> <span class="text-slate-400">(${votes})</span></span>`;
}

function DistBars({ dist }) {
  if (!dist) return null;
  const total = Object.values(dist).reduce((a, b) => a + (b || 0), 0) || 1;
  return html`<div class="space-y-0.5">${[5, 4, 3, 2, 1].map((n) => html`<div class="flex items-center gap-2 text-[11px]">
    <span class="w-3 text-slate-400">${n}</span>
    <div class="flex-1 h-2 rounded bg-slate-100 overflow-hidden"><div class="h-full bg-amber-400" style=${`width:${((dist[n] || 0) / total) * 100}%`}></div></div>
    <span class="w-8 text-right text-slate-400 tabular-nums">${dist[n] || 0}</span>
  </div>`)}</div>`;
}

function AiPlan({ plan }) {
  if (!plan) return null;
  const priTone = (p) => p === 'high' ? 'bg-rose-100 text-rose-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return html`<${Card}><div class="p-4 border-l-4 border-brand-400">
    <div class="font-semibold text-slate-800 mb-1">✨ AI optimization plan</div>
    <p class="text-sm text-slate-600 mb-3">${plan.summary || ''}</p>
    <div class="space-y-2">${(plan.items || []).map((it) => html`<div class="rounded-lg border border-slate-200 p-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class=${cx('text-[11px] font-bold px-2 py-0.5 rounded-full', priTone(it.priority))}>${(it.priority || '').toUpperCase()}</span>
        <span class="font-medium text-slate-800">${it.title}</span>
        ${it.effort && html`<span class="text-[11px] text-slate-400">· ${it.effort} effort</span>`}
      </div>
      ${it.impact && html`<div class="text-xs text-emerald-700 mt-1">Impact: ${it.impact}</div>`}
      ${Array.isArray(it.steps) && html`<ol class="list-decimal ml-5 mt-1.5 space-y-0.5 text-[13px] text-slate-600">${it.steps.map((s) => html`<li>${s}</li>`)}</ol>`}
    </div>`)}</div>
  </div></${Card}>`;
}

function Sparkline({ values, color = '#6366f1', h = 40 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1), w = 240, step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`);
  return html`<svg viewBox=${`0 0 ${w} ${h}`} preserveAspectRatio="none" class="w-full" style=${`height:${h}px`}>
    <polyline points=${pts.join(' ')} fill="none" stroke=${color} stroke-width="1.5" />
    <polygon points=${`0,${h} ${pts.join(' ')} ${w},${h}`} fill=${color} opacity="0.08" />
  </svg>`;
}

// Accept "locations/123", a bare numeric id, or a pasted Business Profile URL.
// From a URL we take the LONGEST digit run (GBP location IDs are ~15-21 digits).
function normLocId(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/locations\/(\d+)/);
  if (m) return `locations/${m[1]}`;
  const runs = (s.match(/\d{6,}/g) || []).sort((a, b) => b.length - a.length);
  return runs.length ? `locations/${runs[0]}` : null;
}

function GbpLive({ canRun }) {
  const [st, setSt] = useState(null);
  const [locs, setLocs] = useState(null);
  const [manualId, setManualId] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = async () => { try { setSt(await seoGbpStatus()); } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, []);

  const connect = async () => { setBusy('connect'); setErr(''); try { const d = await seoGbpConnect(); location.href = d.url; } catch (e) { setErr(e.message); setBusy(''); } };
  const disconnect = async () => { if (!confirm('Disconnect Google Business Profile?')) return; setBusy('disc'); try { await seoGbpDisconnect(); setLocs(null); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const pickLocations = async () => { setBusy('locs'); setErr(''); try { const d = await seoGbpLocations(); setLocs(d.locations || []); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const choose = async (l) => { setBusy('sel'); setErr(''); try { await seoGbpSelectLocation({ locationId: l.id, title: l.title, address: l.address }); setLocs(null); await load(); await refresh(); } catch (e) { setErr(e.message); setBusy(''); } };
  const useManual = async () => { const id = normLocId(manualId); if (!id) { setErr('Enter a numeric location ID (the long number), or locations/<id>.'); return; } await choose({ id, title: 'My location', address: '' }); };
  const refresh = async () => { setBusy('metrics'); setErr(''); try { const d = await seoGbpMetrics(); setSt((s) => ({ ...s, metrics: d.metrics, search_keywords: d.search_keywords, metrics_at: d.metrics_at })); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  if (!st) return null;

  // Not connected — invite / gated note.
  if (!st.connected) {
    return html`<${Card}><div class="p-4 flex flex-wrap items-center gap-3 justify-between">
      <div class="min-w-0">
        <div class="font-semibold text-slate-800">Connect Google Business Profile <span class="text-xs font-normal text-slate-400">— private metrics</span></div>
        <div class="text-xs text-slate-500 mt-0.5">Sign in with the Google account that manages the profile to see impressions, calls, direction requests, website clicks, and the exact search terms customers used.</div>
      </div>
      ${canRun ? html`<${Btn} size="sm" onClick=${connect} disabled=${busy === 'connect'}>${busy === 'connect' ? 'Redirecting…' : 'Connect'}</${Btn}>` : html`<span class="text-xs text-slate-400">Ask an admin to connect.</span>`}
      ${err && html`<div class="w-full text-sm text-rose-600">${err}</div>`}
    </div></${Card}>`;
  }

  // Connected but no location chosen — pick one.
  if (!st.location) {
    return html`<${Card}><div class="p-4 space-y-2">
      <div class="flex items-center justify-between">
        <div class="text-sm text-slate-600">Connected as <span class="font-medium text-slate-800">${st.email}</span></div>
        <button onClick=${disconnect} class="text-xs text-slate-400 hover:text-rose-600 underline">Disconnect</button>
      </div>
      ${!locs ? html`<${Btn} size="sm" onClick=${pickLocations} disabled=${busy === 'locs'}>${busy === 'locs' ? 'Loading…' : 'Choose your business location'}</${Btn}>`
        : locs.length === 0 ? html`<div class="text-sm text-slate-500">No locations found on this Google account. Make sure it manages a verified profile.</div>`
          : html`<div class="space-y-1">${locs.map((l) => html`<button onClick=${() => choose(l)} disabled=${busy === 'sel'} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50/40">
              <div class="text-sm font-medium text-slate-800">${l.title}</div><div class="text-xs text-slate-400">${l.address || l.id}</div>
            </button>`)}</div>`}
      <div class="pt-2 mt-1 border-t border-slate-100">
        <div class="text-xs text-slate-500 mb-1">Or enter your location ID directly <span class="text-slate-400">— skips the Account Management API entirely</span>:</div>
        <div class="flex gap-2">
          <${Input} value=${manualId} onInput=${setManualId} placeholder="locations/123… or the long number" />
          <${Btn} size="sm" variant="secondary" onClick=${useManual} disabled=${busy === 'sel' || busy === 'metrics'}>${busy === 'sel' || busy === 'metrics' ? '…' : 'Use ID'}</${Btn}>
        </div>
        <div class="text-[11px] text-slate-400 mt-1">Find it in Business Profile Manager (business.google.com): open the location, then copy the long number from the address bar.</div>
      </div>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
    </div></${Card}>`;
  }

  // Connected + location — metrics.
  const m = st.metrics, T = (m && m.totals) || {};
  const impr = ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'].reduce((a, k) => a + (T[k] || 0), 0);
  const maps = (T.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (T.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0);
  const search = (T.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (T.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
  const mobile = (T.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0) + (T.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
  const tiles = [['Impressions', impr], ['Calls', T.CALL_CLICKS || 0], ['Website clicks', T.WEBSITE_CLICKS || 0], ['Directions', T.BUSINESS_DIRECTION_REQUESTS || 0], ['Messages', T.BUSINESS_CONVERSATIONS || 0], ['Bookings', T.BUSINESS_BOOKINGS || 0]];
  const kws = st.search_keywords || [];

  return html`<${Card}><div class="p-4 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="font-semibold text-slate-800 flex items-center gap-2">${st.location.title} <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">● Live</span></div>
        <div class="text-xs text-slate-400">${st.location.address || ''} · ${st.email}${m ? ` · last 90 days` : ''}</div>
      </div>
      <div class="flex items-center gap-2">
        ${canRun && html`<${Btn} size="sm" variant="secondary" onClick=${refresh} disabled=${busy === 'metrics'}>${busy === 'metrics' ? 'Loading…' : (m ? '↻ Refresh' : 'Load metrics')}</${Btn}>`}
        <button onClick=${disconnect} class="text-xs text-slate-400 hover:text-rose-600 underline">Disconnect</button>
      </div>
    </div>
    ${err && html`<div class="text-sm text-rose-600">${err}</div>`}

    ${!m ? html`<div class="text-sm text-slate-400">Click “Load metrics” to pull the last 90 days.</div>` : html`
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        ${tiles.map(([k, v]) => html`<div class="rounded-lg bg-slate-50 border border-slate-100 p-2.5"><div class="text-[11px] text-slate-400">${k}</div><div class="text-lg font-bold text-slate-800 tabular-nums">${nfmt(v)}</div></div>`)}
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 mb-0.5"><span>Daily impressions</span><span>Search ${nfmt(search)} · Maps ${nfmt(maps)} · Mobile ${impr ? Math.round((mobile / impr) * 100) : 0}%</span></div>
          <${Sparkline} values=${(m.daily || []).map((d) => d.impressions)} />
        </div>
        <div>
          <div class="text-[11px] text-slate-400 mb-1">Top search terms customers used <span class="text-slate-300">(Google's own data)</span></div>
          ${kws.length === 0 ? html`<div class="text-xs text-slate-400">No keyword data yet.</div>`
            : html`<div class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">${kws.slice(0, 24).map((k) => html`<span class="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">${k.keyword}${k.value ? html` <span class="text-brand-400">${k.isThreshold ? '<' : ''}${nfmt(k.value)}</span>` : ''}</span>`)}</div>`}
        </div>
      </div>
      ${st.metrics_at && html`<div class="text-[11px] text-slate-400">Updated ${new Date(st.metrics_at).toLocaleString()}</div>`}
    `}
  </div></${Card}>`;
}

export function ProfileAudit({ siteId, defaultName = '', domain, canRun = true }) {
  const [report, setReport] = useState(null);
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setReport(null); setErr(''); setLoaded(false); setName(defaultName || '');
    if (!siteId) return;
    let cancelled = false;
    seoGbpLoad(siteId).then((r) => { if (cancelled) return; setReport(r); if (r) { setName(r.business_name); setLoc(r.location_label === 'United States' ? '' : (r.location_label || '')); } setLoaded(true); })
      .catch((e) => { if (!cancelled) { setErr(e.message); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [siteId]);

  const run = async () => {
    if (!name.trim()) { setErr('Enter the business name exactly as it appears on Google Maps.'); return; }
    setBusy('run'); setErr('');
    try { const d = await seoGbpAudit(siteId, { businessName: name.trim(), location: loc.trim() }); setReport(d.report); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const genPlan = async () => {
    setBusy('ai'); setErr('');
    try { const d = await seoGbpAiPlan(siteId); setReport({ ...report, ai_plan: d.ai_plan }); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const p = report?.profile;
  const issues = report ? [...(report.issues || [])].sort((a, b) => (sevRank[a.severity] - sevRank[b.severity])) : [];
  const ex = report?.extracted;

  return html`<div class="space-y-4">
    <${GbpLive} canRun=${canRun} />
    <${Card}><div class="p-3 space-y-2">
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex-1 min-w-[200px]">
          <label class="text-[11px] text-slate-400">Business name (as on Google Maps)</label>
          <${Input} value=${name} onInput=${setName} placeholder=${domain || 'e.g. Always Home Repair'} />
        </div>
        <div class="w-40">
          <label class="text-[11px] text-slate-400">City/State (optional)</label>
          <${Input} value=${loc} onInput=${setLoc} placeholder="e.g. Ocala, FL" />
        </div>
        ${canRun && html`<${Btn} size="sm" onClick=${run} disabled=${busy === 'run'}>${busy === 'run' ? 'Auditing…' : (report ? '↻ Re-audit' : 'Audit profile')}</${Btn}>`}
      </div>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <div class="text-[11px] text-slate-400">Reads your public Google Business Profile — no sign-in needed. Sign-in for private metrics (calls, directions, searches) is coming once Google approves API access.</div>
    </div></${Card}>

    ${!report && !busy && loaded && html`<${Card}><div class="p-8 text-center text-sm text-slate-500">${canRun ? 'Audit your Google Business Profile to score its completeness, extract the keywords & services Google already associates with you, and get a prioritized fix list.' : 'No profile audit yet — ask an account admin to run one.'}</div></${Card}>`}
    ${busy === 'run' && html`<div class="p-6 text-sm text-slate-400">Looking up the profile on Google…</div>`}

    ${report && p && html`
      <${Card}><div class="p-4">
        <div class="flex items-start gap-4 flex-wrap">
          <${ScoreRing} score=${report.score} />
          <div class="flex-1 min-w-[220px]">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-lg font-bold text-slate-800">${p.title || report.business_name}</span>
              ${p.is_claimed ? html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Claimed</span>` : html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Unclaimed</span>`}
            </div>
            <div class="text-sm text-slate-500 mt-0.5">${p.category || 'No category'}</div>
            <div class="mt-1"><${Stars} value=${p.rating?.value} votes=${p.rating?.votes} /></div>
            ${p.address && html`<div class="text-xs text-slate-400 mt-1">${p.address}</div>`}
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              <span>📷 ${p.total_photos} photos</span>
              <span>${p.hours_present ? '🕒 Hours set' : '⚠ No hours'}</span>
              <span>${p.phone ? '📞 ' + p.phone : '⚠ No phone'}</span>
              ${p.url && html`<a href=${p.url} target="_blank" rel="noopener" class="text-brand-700 hover:underline">🔗 Website</a>`}
            </div>
          </div>
          ${p.rating_distribution && html`<div class="w-40"><div class="text-[11px] text-slate-400 mb-1">Review breakdown</div><${DistBars} dist=${p.rating_distribution} /></div>`}
        </div>
      </div></${Card}>

      <div class="grid md:grid-cols-3 gap-3">
        <${Card}><div class="p-3"><div class="text-xs font-semibold text-slate-500 mb-1.5">Categories</div><${Chips} items=${ex?.categories} tone="brand" /></div></${Card}>
        <${Card}><div class="p-3"><div class="text-xs font-semibold text-slate-500 mb-1.5">Services on profile</div><${Chips} items=${ex?.services} tone="emerald" /></div></${Card}>
        <${Card}><div class="p-3"><div class="text-xs font-semibold text-slate-500 mb-1.5">What customers mention</div><${Chips} items=${ex?.review_topics?.slice(0, 12)} /></div></${Card}>
      </div>

      ${ex?.keywords?.length > 0 && html`<${Card}><div class="p-3">
        <div class="text-xs font-semibold text-slate-500 mb-1.5">Default keywords from your profile <span class="font-normal text-slate-400">— seed these into keyword & content work</span></div>
        <${Chips} items=${ex.keywords} />
      </div></${Card}>`}

      ${report.ai_plan && html`<${AiPlan} plan=${report.ai_plan} />`}

      <${Card}><div class="p-4">
        <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div><span class="font-semibold text-slate-800">Fix list</span> <span class="text-xs text-slate-400 ml-1">${issues.length} findings · most impactful first</span></div>
          ${canRun && issues.length > 0 && html`<${Btn} size="sm" variant="ghost" onClick=${genPlan} disabled=${busy === 'ai'}>${busy === 'ai' ? 'Thinking…' : (report.ai_plan ? '↻ Regenerate plan' : '✨ Generate AI plan')}</${Btn}>`}
        </div>
        ${issues.length === 0
          ? html`<div class="text-sm text-emerald-600 py-2">✓ Profile looks fully optimized — nice work.</div>`
          : html`<div class="divide-y divide-slate-50">${issues.map((i) => html`<div class="flex items-start gap-3 py-2.5">
              <span class=${cx('shrink-0 w-2.5 h-2.5 rounded-full mt-1.5', sevTone(i.severity))}></span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-slate-800"><span class="text-[11px] font-medium text-slate-400 mr-1.5">${i.area}</span>${i.message}</div>
                <div class="text-xs text-slate-500 mt-0.5">${i.fix}</div>
              </div>
            </div>`)}</div>`}
      </div></${Card}>

      ${p.description && html`<${Card}><div class="p-3"><div class="text-xs font-semibold text-slate-500 mb-1">Current description <span class="font-normal text-slate-400">(${p.description.length} chars)</span></div><p class="text-sm text-slate-600">${p.description}</p></div></${Card}>`}
      ${p.attributes?.length > 0 && html`<${Card}><div class="p-3"><div class="text-xs font-semibold text-slate-500 mb-1.5">Attributes</div><${Chips} items=${p.attributes} /></div></${Card}>`}

      <div class="text-center text-[11px] text-slate-400">Audited ${new Date(report.fetched_at).toLocaleString()} · public profile data</div>
    `}
  </div>`;
}
