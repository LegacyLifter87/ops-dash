// ---------------------------------------------------------------------------
// research.js — 🔍 Research: the keyword & search-trend planner.
//
// Two ways in: look up keywords you already have in mind (typed, or quick-added
// from the site's Search Console queries), or expand a seed into long-tail
// suggestions / related terms / broad ideas. Everything comes back with 12
// months of LOCAL search history, so seasonality and rising terms are visible
// on every row rather than buried in a report.
//
// Results are cached per site + keyword + month, so re-opening the tab and
// re-running the same lookup inside the month costs nothing. Anything that does
// cost money asks first.
//
// Keywords picked here become blogging targets (seo_keyword_targets), which the
// Autoblogger's picker reads alongside Search Console keywords and competitor
// gaps — so a researched keyword gets written about without any further steps.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { seoResearchLoad, seoResearchCached, seoResearchLookup, seoResearchExpand, seoResearchForget, seoListTargets, seoAddTargets, seoUpdateTarget, seoRemoveTarget } from './store.js';
import { Card, Btn, Select, Input, Modal, Field } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const num = (n) => (n == null ? '—' : Number(n).toLocaleString());
const usd = (n) => '$' + (Number(n) || 0).toFixed(Math.abs(Number(n) || 0) < 1 ? 3 : 2);
const pct = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${Number(n).toFixed(0)}%`);
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SOURCE_LABEL = { seed: 'Looked up', idea: 'Suggestion', question: 'Question', related: 'Related' };
const SOURCE_CLS = {
  seed: 'bg-slate-100 text-slate-600', idea: 'bg-blue-100 text-blue-700',
  question: 'bg-violet-100 text-violet-700', related: 'bg-teal-100 text-teal-700',
};
const INTENT_CLS = {
  transactional: 'bg-emerald-100 text-emerald-700', commercial: 'bg-blue-100 text-blue-700',
  informational: 'bg-slate-100 text-slate-600', navigational: 'bg-amber-100 text-amber-700',
};
const EXPAND_MODES = [
  { value: 'suggestions', label: 'Long-tail — phrases containing the seed' },
  { value: 'related', label: 'Related — what else these searchers look for' },
  { value: 'ideas', label: 'Broad ideas — same category, wider net' },
];

const Pill = ({ children, cls }) => html`<span class=${cx('inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', cls)}>${children}</span>`;

// A keyword is "rising"/"falling" on the last quarter vs the quarter before it,
// with the least-squares slope as a sanity check so one freak month doesn't
// flip the label. Pure arithmetic — no AI call.
function trendTag(r) {
  const t = r.trend_pct, s = r.slope;
  if (t == null) return null;
  if (t >= 20 && (s == null || s > 0)) return { label: t >= 60 ? 'Surging' : 'Rising', cls: 'bg-emerald-100 text-emerald-700', dir: 1 };
  if (t <= -20 && (s == null || s < 0)) return { label: t <= -60 ? 'Collapsing' : 'Falling', cls: 'bg-rose-100 text-rose-700', dir: -1 };
  if ((r.seasonality || 0) >= 2.5) return { label: 'Seasonal', cls: 'bg-amber-100 text-amber-700', dir: 0 };
  return null;
}

// 12-month sparkline. Inline SVG keeps it dependency-free and prints cleanly.
function Spark({ months, dir = 0, w = 72, h = 22 }) {
  const vs = (months || []).map((m) => Number(m.v) || 0);
  if (vs.length < 2) return html`<span class="text-slate-300">—</span>`;
  const max = Math.max(...vs), min = Math.min(...vs);
  const span = max - min || 1;
  const dx = w / (vs.length - 1);
  const y = (v) => (h - 2 - ((v - min) / span) * (h - 5)).toFixed(1);
  const pts = vs.map((v, i) => `${(i * dx).toFixed(1)},${y(v)}`).join(' ');
  const stroke = dir > 0 ? '#059669' : dir < 0 ? '#e11d48' : '#64748b';
  const last = vs[vs.length - 1];
  return html`<svg viewBox=${`0 0 ${w} ${h}`} width=${w} height=${h} class="overflow-visible" aria-hidden="true">
    <polyline points=${`0,${h} ${pts} ${w},${h}`} fill=${stroke} opacity="0.10" stroke="none" />
    <polyline points=${pts} fill="none" stroke=${stroke} stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx=${w} cy=${y(last)} r="1.8" fill=${stroke} />
  </svg>`;
}

// Full monthly history for one keyword — the "is this seasonal or is it
// actually growing?" view.
function TrendDetail({ row, onClose, onTarget, blocked }) {
  const ms = row.monthly || [];
  const vs = ms.map((m) => Number(m.v) || 0);
  const max = Math.max(1, ...vs);
  const tag = trendTag(row);
  const peak = ms[vs.indexOf(Math.max(...vs))];
  const low = ms[vs.indexOf(Math.min(...vs))];
  return html`<${Modal} title=${row.keyword} wide onClose=${onClose} footer=${html`
      <${Btn} variant="secondary" onClick=${onClose}>Close</${Btn}>
      ${!blocked && html`<${Btn} onClick=${() => { onTarget(); onClose(); }}>＋ Add as blogging target</${Btn}>`}`}>
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2 items-center">
        ${tag && html`<${Pill} cls=${tag.cls}>${tag.label}</${Pill}>`}
        <${Pill} cls=${SOURCE_CLS[row.source] || SOURCE_CLS.seed}>${SOURCE_LABEL[row.source] || row.source}</${Pill}>
        ${row.intent && html`<${Pill} cls=${INTENT_CLS[row.intent] || 'bg-slate-100 text-slate-600'}>${row.intent}</${Pill}>`}
        <span class="text-xs text-slate-400">Search volume for ${row.location || 'your market'}</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        ${[['Searches / mo', num(row.volume)], ['Last 3 mo', pct(row.trend_pct), 'vs the 3 before'],
          ['Year over year', pct(row.yoy_pct)], ['Difficulty', row.difficulty != null ? `${row.difficulty}/100` : '—'],
          ['CPC', row.cpc ? '$' + Number(row.cpc).toFixed(2) : '—']]
          .map(([k, v, sub]) => html`<div class="rounded-xl border border-slate-200 p-3">
            <div class="text-[11px] text-slate-400">${k}</div>
            <div class="text-lg font-semibold text-slate-800 tabular-nums">${v}</div>
            ${sub && html`<div class="text-[11px] text-slate-400">${sub}</div>`}
          </div>`)}
      </div>

      ${ms.length < 2
        ? html`<div class="text-sm text-slate-400 py-8 text-center">No monthly history for this keyword.</div>`
        : html`<div>
            <div class="text-sm font-medium text-slate-700 mb-2">Monthly search volume</div>
            <div class="flex items-end gap-1 h-40 border-b border-slate-200">
              ${ms.map((m) => html`<div class="flex-1 flex flex-col justify-end items-center group" title=${`${MONTH_ABBR[m.m]} ${m.y}: ${num(m.v)} searches`}>
                <div class="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 tabular-nums">${num(m.v)}</div>
                <div class="w-full rounded-t bg-brand-400 group-hover:bg-brand-600 transition-colors" style=${`height:${Math.max(2, ((Number(m.v) || 0) / max) * 100)}%`}></div>
              </div>`)}
            </div>
            <div class="flex gap-1 mt-1">
              ${ms.map((m) => html`<div class="flex-1 text-center text-[10px] text-slate-400">${MONTH_ABBR[m.m]}</div>`)}
            </div>
            <p class="text-xs text-slate-500 mt-3">
              Busiest month was <span class="font-medium text-slate-700">${peak ? MONTH_ABBR[peak.m] + ' ' + peak.y : '—'}</span> at ${num(peak?.v)} searches;
              quietest was <span class="font-medium text-slate-700">${low ? MONTH_ABBR[low.m] + ' ' + low.y : '—'}</span> at ${num(low?.v)}.
              ${(row.seasonality || 0) >= 2.5 ? ' That is a strong seasonal swing — publish ahead of the peak, not during it.' : ''}
            </p>
          </div>`}
    </div>
  </${Modal}>`;
}

// Nothing bills without showing the number first.
function CostConfirm({ job, onCancel, onGo, busy }) {
  return html`<${Modal} title="This lookup costs money" onClose=${onCancel} footer=${html`
      <${Btn} variant="secondary" onClick=${onCancel} disabled=${busy}>Cancel</${Btn}>
      <${Btn} onClick=${onGo} disabled=${busy}>${busy ? 'Running…' : `Run it — about ${usd(job.estimate)}`}</${Btn}>`}>
    <div class="space-y-3 text-sm text-slate-600">
      <p>${job.summary}</p>
      <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
        <div class="flex justify-between"><span>Estimated DataForSEO charge</span><span class="font-semibold text-slate-800 tabular-nums">${usd(job.estimate)}</span></div>
        ${job.cachedNote && html`<div class="text-xs text-emerald-700 mt-1">${job.cachedNote}</div>`}
      </div>
      <p class="text-xs text-slate-500">
        The real charge is whatever DataForSEO bills for the request — it lands on this business's API cost line in the agency panel.
        Results are cached for the rest of ${job.month ? monthLabel(job.month) : 'the month'}, so looking these up again is free.
      </p>
    </div>
  </${Modal}>`;
}
const monthLabel = (m) => { const [y, mo] = String(m).split('-').map(Number); return `${MONTH_ABBR[mo] || ''} ${y}`; };

export function Research({ site, gscKeywords = [], onTargetsChanged }) {
  const [rows, setRows] = useState([]);
  const [negatives, setNegatives] = useState([]);
  const [targets, setTargets] = useState([]);
  const [month, setMonth] = useState('');
  const [location, setLocation] = useState('');
  const [locSource, setLocSource] = useState('');
  const [locOverride, setLocOverride] = useState('');
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [tab, setTab] = useState('results');

  const [seeds, setSeeds] = useState('');
  const [expandSeed, setExpandSeed] = useState('');
  const [expandMode, setExpandMode] = useState('suggestions');
  const [expandLimit, setExpandLimit] = useState('100');

  const [q, setQ] = useState('');
  const [srcFilter, setSrcFilter] = useState('all');
  const [minVol, setMinVol] = useState('0');
  const [risersOnly, setRisersOnly] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [detail, setDetail] = useState(null);
  const [job, setJob] = useState(null);
  // Keywords from the MOST RECENT pull. Results merge into one volume-sorted
  // list, so a fresh long-tail lookup lands at the bottom and the page looks
  // unchanged — after every pull we narrow the list to what just came back
  // until the user clicks "show all".
  const [justAdded, setJustAdded] = useState(null);
  const sort = useSort('volume', 'desc');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [r, t] = await Promise.all([seoResearchLoad(site, locOverride || undefined), seoListTargets(site)]);
      setRows(r.rows || []); setNegatives(r.negatives || []); setMonth(r.month);
      setLocation(r.location); setLocSource(r.locationSource); setRates(r.rates);
      setTargets(t.targets || []);
      return r.rows || [];
    } catch (e) { setErr(e.message); return []; } finally { setLoading(false); }
  };
  useEffect(() => { if (site) { setPicked(new Set()); setJustAdded(null); load(); } }, [site]);

  // Phrase-level negatives, matching the rule the blog picker uses.
  const blockedBy = (kw) => { const s = ' ' + String(kw).toLowerCase() + ' '; return negatives.find((n) => s.includes(' ' + String(n).toLowerCase().trim() + ' ')); };
  const targetSet = useMemo(() => new Set(targets.map((t) => String(t.keyword).toLowerCase())), [targets]);

  const parseSeeds = (s) => [...new Set(String(s).split(/[\n,]/).map((x) => x.trim().toLowerCase()).filter(Boolean))];

  // --- Billable actions, each gated behind the cost confirmation -------------
  const askLookup = async () => {
    const list = parseSeeds(seeds);
    if (!list.length) { setErr('Enter at least one keyword to look up.'); return; }
    setErr(''); setBanner('');
    setBusy(true);
    try {
      const { fresh, cached } = await seoResearchCached(site, list);
      if (!fresh.length) {
        // Already researched this month: don't dead-end — surface those rows.
        setJustAdded(new Set(cached));
        setTab('results');
        setBanner(`All ${cached.length} of those are already researched this month — showing the cached numbers, no charge.`);
        setSeeds(''); setBusy(false); return;
      }
      const estimate = rates ? rates.volume_task_usd + rates.labs_base_usd + rates.labs_per_keyword_usd * fresh.length : 0.1;
      setJob({
        kind: 'lookup', keywords: fresh, estimate, month,
        summary: `Pulling local search volume, 12-month history and difficulty for ${fresh.length} keyword${fresh.length === 1 ? '' : 's'} in ${location}.`,
        cachedNote: cached.length ? `${cached.length} of the ${list.length} you entered ${cached.length === 1 ? 'is' : 'are'} already cached and won't be charged again.` : '',
      });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const askExpand = () => {
    const seed = expandSeed.trim();
    if (!seed) { setErr('Enter a seed keyword to expand.'); return; }
    setErr(''); setBanner('');
    const lim = Math.max(10, Math.min(rates?.max_ideas || 300, Number(expandLimit) || 100));
    const estimate = rates ? rates.labs_base_usd + rates.labs_per_keyword_usd * lim + rates.volume_task_usd : 0.11;
    const modeLabel = EXPAND_MODES.find((m) => m.value === expandMode)?.label || expandMode;
    setJob({
      kind: 'expand', seed, mode: expandMode, limit: lim, estimate, month,
      summary: `Finding up to ${lim} keywords for “${seed}” (${modeLabel.split(' — ')[0].toLowerCase()}), then pricing every one of them for ${location}.`,
      cachedNote: '',
    });
  };
  const runJob = async () => {
    if (!job) return;
    setBusy(true); setErr('');
    const before = new Set(rows.map((r) => r.keyword));
    try {
      const r = job.kind === 'lookup'
        ? await seoResearchLookup(site, job.keywords, locOverride || undefined)
        : await seoResearchExpand(site, job.seed, job.mode, job.limit, locOverride || undefined);
      setJob(null);
      if (job.kind === 'lookup') setSeeds('');
      setBanner(`Added ${r.added} keyword${r.added === 1 ? '' : 's'} for ${r.location || location}${r.questions ? `, ${r.questions} of them questions` : ''} — charged ${usd(r.cost)}.`);
      const after = await load();
      // Show what this pull produced, not the same volume-sorted top of list.
      const added = after.filter((x) => !before.has(x.keyword)).map((x) => x.keyword);
      const seeded = job.kind === 'lookup' ? job.keywords : [job.seed];
      const focus = added.length ? added : seeded;
      setJustAdded(new Set(focus));
      setTab('results');
    } catch (e) { setErr(e.message); setJob(null); } finally { setBusy(false); }
  };

  // --- Targets ---------------------------------------------------------------
  const addTargets = async (keywords) => {
    const list = keywords.filter((k) => !blockedBy(k) && !targetSet.has(k.toLowerCase()));
    if (!list.length) { setErr('Those are already targets, or blocked by a negative keyword.'); return; }
    setBusy(true); setErr(''); setBanner('');
    try {
      const items = list.map((k) => {
        const r = rows.find((x) => x.keyword === k) || {};
        return { keyword: k, volume: r.volume, cpc: r.cpc, difficulty: r.difficulty, intent: r.intent, trend_pct: r.trend_pct, source: 'research' };
      });
      const r = await seoAddTargets(site, items);
      const blocked = (r.blocked || []).length;
      setBanner(`${r.added} keyword${r.added === 1 ? '' : 's'} added as blogging targets — the Autoblogger will pick ${r.added === 1 ? 'it' : 'them'} up automatically.${blocked ? ` ${blocked} skipped as negative keywords.` : ''}`);
      setPicked(new Set());
      setTargets((await seoListTargets(site)).targets || []);
      onTargetsChanged?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const dropTarget = async (t) => {
    setBusy(true); setErr('');
    try { await seoRemoveTarget(site, t.id); setTargets((await seoListTargets(site)).targets || []); onTargetsChanged?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const toggleTargetStatus = async (t) => {
    setBusy(true); setErr('');
    try { await seoUpdateTarget(site, t.id, { status: t.status === 'active' ? 'paused' : 'active' }); setTargets((await seoListTargets(site)).targets || []); onTargetsChanged?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const forget = async (keywords) => {
    setBusy(true); setErr('');
    try { await seoResearchForget(site, keywords); setPicked(new Set()); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // --- Filtering -------------------------------------------------------------
  const filtered = useMemo(() => {
    const min = Number(minVol) || 0;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!justAdded || justAdded.has(r.keyword))
      && (srcFilter === 'all' || r.source === srcFilter)
      && (!needle || r.keyword.includes(needle))
      && (Number(r.volume) || 0) >= min
      && (!risersOnly || (trendTag(r)?.dir === 1)));
  }, [rows, srcFilter, q, minVol, risersOnly, justAdded]);

  const stats = useMemo(() => {
    const risers = rows.filter((r) => trendTag(r)?.dir === 1).length;
    const fallers = rows.filter((r) => trendTag(r)?.dir === -1).length;
    return { total: rows.length, risers, fallers, questions: rows.filter((r) => r.source === 'question').length,
      volume: rows.reduce((s, r) => s + (Number(r.volume) || 0), 0) };
  }, [rows]);

  const pickable = filtered.filter((r) => !blockedBy(r.keyword) && !targetSet.has(r.keyword.toLowerCase()));
  const allPicked = pickable.length > 0 && pickable.every((r) => picked.has(r.keyword));
  const togglePick = (kw) => setPicked((p) => { const n = new Set(p); if (n.has(kw)) n.delete(kw); else n.add(kw); return n; });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(pickable.map((r) => r.keyword)));

  if (loading) return html`<div class="p-8 text-sm text-slate-400">Loading research…</div>`;

  const quickAdd = gscKeywords.slice(0, 12);

  return html`<div class="space-y-4">
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between gap-3"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700 flex justify-between gap-3"><span>${err}</span><button onClick=${() => setErr('')} class="opacity-60">✕</button></div>`}

    <${Card}><div class="p-4 space-y-4">
      <div class="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-800">Research keywords for ${location}</div>
          <p class="text-xs text-slate-500">
            Volume and trends are for this market${locSource === 'business profile' ? ', taken from the business profile' : locSource === 'manual' ? ', set by hand below' : ' — add a city and state in the 🏢 Business tab to narrow it down'}.
            Results cache until the end of ${month ? monthLabel(month) : 'the month'}.
          </p>
        </div>
        <div class="flex items-end gap-2">
          <${Field} label="Market override" class="w-56">
            <${Input} value=${locOverride} onInput=${setLocOverride} placeholder=${'e.g. Tampa,Florida,United States'} />
          </${Field}>
          <${Btn} size="sm" variant="secondary" onClick=${load} disabled=${busy}>Apply</${Btn}>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="text-sm font-medium text-slate-700">Look up keywords you already have in mind</div>
          <textarea rows="3" value=${seeds} onInput=${(e) => setSeeds(e.target.value)}
            placeholder="One per line, or comma separated&#10;dryer vent cleaning ocala&#10;dryer vent inspection cost"
            class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition"></textarea>
          ${quickAdd.length > 0 && html`<div>
            <div class="text-xs text-slate-400 mb-1">Quick-add from Search Console:</div>
            <div class="flex flex-wrap gap-1.5">
              ${quickAdd.map((k) => html`<button onClick=${() => setSeeds((s) => (s.trim() ? s.replace(/\s*$/, '') + '\n' : '') + k)}
                class="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 max-w-[14rem] truncate">＋ ${k}</button>`)}
            </div>
          </div>`}
          <${Btn} size="sm" onClick=${askLookup} disabled=${busy || !seeds.trim()}>${busy ? 'Checking…' : 'Look up'}</${Btn}>
        </div>

        <div class="space-y-2">
          <div class="text-sm font-medium text-slate-700">Or expand one seed into a list</div>
          <${Input} value=${expandSeed} onInput=${setExpandSeed} placeholder="dryer vent cleaning" />
          <${Select} value=${expandMode} onChange=${setExpandMode} options=${EXPAND_MODES} />
          <div class="flex items-end gap-2">
            <${Field} label="How many" class="w-28"><${Input} value=${expandLimit} onInput=${setExpandLimit} /></${Field}>
            <${Btn} size="sm" onClick=${askExpand} disabled=${busy || !expandSeed.trim()}>Find keywords</${Btn}>
          </div>
          <p class="text-xs text-slate-400">Question-style phrases are tagged automatically so you can write straight to them.</p>
        </div>
      </div>
    </div></${Card}>

    ${rows.length > 0 && html`<div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      ${[['Keywords researched', num(stats.total)], ['Rising', num(stats.risers), 'last 3 mo vs prior 3'],
        ['Falling', num(stats.fallers)], ['Questions', num(stats.questions)], ['Total searches / mo', num(stats.volume)]]
        .map(([k, v, sub]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800 tabular-nums">${v}</div>${sub && html`<div class="text-[11px] text-slate-400">${sub}</div>`}</div></${Card}>`)}
    </div>`}

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-1 border-b border-slate-200">
        ${[['results', `Results (${rows.length})`], ['targets', `Blogging targets (${targets.length})`]].map(([id, label]) => html`
          <button onClick=${() => setTab(id)} class=${cx('px-3 py-2 text-sm -mb-px border-b-2', tab === id ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate-500')}>${label}</button>`)}
      </div>
      ${tab === 'results' && rows.length > 0 && html`<div class="ml-auto flex flex-wrap items-center gap-2">
        ${justAdded && html`<button onClick=${() => setJustAdded(null)} title="Show every researched keyword again"
          class="text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-medium">✨ Latest pull (${justAdded.size}) · show all ${rows.length}</button>`}
        <${Input} value=${q} onInput=${setQ} placeholder="Search…" class="w-36" />
        <${Select} value=${srcFilter} onChange=${setSrcFilter} options=${[{ value: 'all', label: 'All sources' }, ...Object.entries(SOURCE_LABEL).map(([v, l]) => ({ value: v, label: l }))]} />
        <div class="flex items-center gap-1"><span class="text-xs text-slate-500">min vol</span><${Input} value=${minVol} onInput=${setMinVol} class="w-16" /></div>
        <button onClick=${() => setRisersOnly((v) => !v)} class=${cx('text-xs px-2.5 py-1.5 rounded-lg border', risersOnly ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>Rising only</button>
      </div>`}
    </div>

    ${tab === 'targets'
      ? html`<${Card}><div class="p-4 space-y-3">
          <p class="text-xs text-slate-500">
            These feed the Autoblogger directly. Its picker weighs them alongside Search Console keywords and competitor gaps, and skips anything already written, already queued, or blocked by a negative keyword.
          </p>
          ${targets.length === 0
            ? html`<div class="py-10 text-center text-sm text-slate-400">No targets yet. Pick keywords in <span class="font-medium">Results</span> and hit “Add as blogging target”.</div>`
            : html`<div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th class="py-1.5 pr-3">Keyword</th><th class="py-1.5 pr-3 text-right">Vol.</th><th class="py-1.5 pr-3 text-right">Diff.</th>
                  <th class="py-1.5 pr-3">Intent</th><th class="py-1.5 pr-3">Status</th><th class="py-1.5 pr-3">Progress</th><th class="py-1.5"></th>
                </tr></thead>
                <tbody>${targets.map((t) => html`<tr class="border-b border-slate-50">
                  <td class="py-1.5 pr-3 font-medium text-slate-800 max-w-[20rem] truncate">${t.keyword}</td>
                  <td class="py-1.5 pr-3 text-right tabular-nums">${num(t.volume)}</td>
                  <td class="py-1.5 pr-3 text-right tabular-nums">${t.difficulty != null ? t.difficulty : '—'}</td>
                  <td class="py-1.5 pr-3">${t.intent ? html`<${Pill} cls=${INTENT_CLS[t.intent] || 'bg-slate-100 text-slate-600'}>${t.intent}</${Pill}>` : html`<span class="text-slate-300">—</span>`}</td>
                  <td class="py-1.5 pr-3"><${Pill} cls=${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}>${t.status}</${Pill}></td>
                  <td class="py-1.5 pr-3 text-slate-500">${t.progress}</td>
                  <td class="py-1.5 text-right whitespace-nowrap">
                    <button onClick=${() => toggleTargetStatus(t)} disabled=${busy} title=${t.status === 'active' ? 'Pause — keep it here but stop the Autoblogger picking it' : 'Resume'} class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 mr-1 disabled:opacity-40">${t.status === 'active' ? 'Pause' : 'Resume'}</button>
                    <button onClick=${() => dropTarget(t)} disabled=${busy} title="Remove this target" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-500 disabled:opacity-40">✕</button>
                  </td>
                </tr>`)}</tbody>
              </table></div>`}
        </div></${Card}>`
      : rows.length === 0
        ? html`<${Card}><div class="p-10 text-center text-sm text-slate-500">
            No research yet this month. Look up keywords you have in mind, or expand a seed into a list — both fill this table with local volume and 12-month trends.
          </div></${Card}>`
        : html`
          ${picked.size > 0 && html`<div class="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 flex flex-wrap items-center gap-3">
            <span class="text-sm text-brand-800 font-medium">${picked.size} selected</span>
            <${Btn} size="sm" onClick=${() => addTargets([...picked])} disabled=${busy}>＋ Add as blogging target${picked.size === 1 ? '' : 's'}</${Btn}>
            <button onClick=${() => forget([...picked])} disabled=${busy} class="text-xs text-slate-500 hover:text-rose-600 underline">Remove from research</button>
            <button onClick=${() => setPicked(new Set())} class="text-xs text-slate-500 hover:text-slate-800 ml-auto">Clear</button>
          </div>`}
          <${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
              <th class="py-1.5 pr-2 w-8"><input type="checkbox" checked=${allPicked} onChange=${toggleAll} class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /></th>
              <${SortTh} k="keyword" label="Keyword" sort=${sort} />
              <th class="py-1.5 pr-3">12-month trend</th>
              <${SortTh} k="volume" label="Vol./mo" sort=${sort} right=${true} />
              <${SortTh} k="trend_pct" label="Trend" sort=${sort} right=${true} />
              <${SortTh} k="difficulty" label="Diff." sort=${sort} right=${true} />
              <${SortTh} k="cpc" label="CPC" sort=${sort} right=${true} />
              <${SortTh} k="intent" label="Intent" sort=${sort} />
              <${SortTh} k="source" label="Source" sort=${sort} />
              <th class="py-1.5 pr-3"></th>
            </tr></thead>
            <tbody>${sort.sort(filtered).slice(0, 400).map((r) => {
              const blk = blockedBy(r.keyword);
              const isTarget = targetSet.has(r.keyword.toLowerCase());
              const tag = trendTag(r);
              return html`<tr class=${cx('border-b border-slate-50', blk && 'bg-slate-50/60')}>
                <td class="py-1.5 pr-2">
                  <input type="checkbox" disabled=${!!blk || isTarget} checked=${picked.has(r.keyword)} onChange=${() => togglePick(r.keyword)}
                    class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-30" />
                </td>
                <td class=${cx('py-1.5 pr-3 font-medium max-w-[20rem] truncate', blk ? 'text-slate-400 line-through' : 'text-slate-800')}
                    title=${blk ? `Blocked by the negative keyword “${blk}”` : r.keyword}>
                  ${r.keyword}
                  ${isTarget && html`<span class="ml-1.5 text-[10px] text-brand-600">● target</span>`}
                </td>
                <td class="py-1.5 pr-3"><${Spark} months=${r.monthly} dir=${tag?.dir || 0} /></td>
                <td class="py-1.5 pr-3 text-right tabular-nums">${num(r.volume)}</td>
                <td class="py-1.5 pr-3 text-right whitespace-nowrap">
                  ${tag ? html`<${Pill} cls=${tag.cls}>${pct(r.trend_pct)}</${Pill}>` : html`<span class="tabular-nums text-slate-500">${pct(r.trend_pct)}</span>`}
                </td>
                <td class=${cx('py-1.5 pr-3 text-right tabular-nums', r.difficulty == null && 'text-slate-300')}>${r.difficulty != null ? r.difficulty : '—'}</td>
                <td class=${cx('py-1.5 pr-3 text-right tabular-nums', !r.cpc && 'text-slate-300')}>${r.cpc ? '$' + Number(r.cpc).toFixed(2) : '—'}</td>
                <td class="py-1.5 pr-3">${r.intent ? html`<${Pill} cls=${INTENT_CLS[r.intent] || 'bg-slate-100 text-slate-600'}>${r.intent}</${Pill}>` : html`<span class="text-slate-300">—</span>`}</td>
                <td class="py-1.5 pr-3"><${Pill} cls=${SOURCE_CLS[r.source] || SOURCE_CLS.seed}>${SOURCE_LABEL[r.source] || r.source}</${Pill}></td>
                <td class="py-1.5 text-right whitespace-nowrap">
                  <button onClick=${() => setDetail(r)} title="See the full monthly history" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 mr-1">📈</button>
                  ${!blk && !isTarget && html`<button onClick=${() => addTargets([r.keyword])} disabled=${busy} title="Add as a blogging target — the Autoblogger will write about it" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40">＋</button>`}
                </td>
              </tr>`;
            })}</tbody>
          </table>
          ${filtered.length > 400 && html`<div class="text-xs text-slate-400 pt-2">Showing the top 400 of ${num(filtered.length)}.</div>`}
          ${filtered.length === 0 && html`<div class="py-8 text-center text-sm text-slate-400">Nothing matches those filters.</div>`}
        </div></${Card}>`}

    ${detail && html`<${TrendDetail} row=${detail} blocked=${!!blockedBy(detail.keyword) || targetSet.has(detail.keyword.toLowerCase())}
      onClose=${() => setDetail(null)} onTarget=${() => addTargets([detail.keyword])} />`}
    ${job && html`<${CostConfirm} job=${job} busy=${busy} onCancel=${() => setJob(null)} onGo=${runJob} />`}
  </div>`;
}
