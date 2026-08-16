// ---------------------------------------------------------------------------
// localpack.js — Local pack intelligence (the 📍 view inside Competitors).
//
// Google's own Business Profile API only reaches profiles we manage, so none of
// this is visible through it. PlePer scrapes PUBLIC Google Business data for
// ANY listing, and the seo-pleper function stores one append-only snapshot per
// listing per scrape. What we render here is the analysis over those snapshots:
//
//   1. CATEGORY INTELLIGENCE — what the map-pack winners use as their PRIMARY
//      category vs. what the client uses. The single strongest local ranking
//      lever a business controls, and invisible without competitor data.
//   2. REVIEW BENCHMARK — reviews per month, owner response rate, rating,
//      each against the pack median and the pack leader.
//   3. CADENCE BENCHMARK — posts and photos per month vs. the pack.
//   4. AI REVIEW MINING — what competitors' own customers complain about.
//
// Every action that spends PlePer credits shows the cost before it runs.
// This is INTERNAL/agency-lens data — it is deliberately not on the client
// share link.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { Card, Btn, Input } from './ui.js';
import {
  seoPleperStatus, seoPleperIntel, seoPleperDiscoverPreview, seoPleperDiscover,
  seoPleperTeardown, seoPleperAddCompetitor, seoPleperSetCompetitor,
  seoPleperRemoveCompetitor, seoPleperTaskStatus, seoPleperReviewMine, seoPleperDiag,
} from './store.js';

const num = (v) => (v == null ? '—' : Number(v).toLocaleString());
const dec = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const pct = (v) => (v == null ? '—' : `${Math.round(Number(v) * 100)}%`);
const usd = (v) => `$${(Number(v) || 0).toFixed(3).replace(/0$/, '')}`;
const ago = (iso) => {
  if (!iso) return 'never';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
};
// Honest labels for how a number was arrived at. "measured" means we watched
// the count move between two scrapes; "estimated" means we inferred it from
// review timestamps; "thin" means there was not enough history to say.
const BASIS_NOTE = {
  measured: 'measured between two scrapes',
  estimated: 'estimated from review dates',
  thin: 'not enough history yet',
  none: 'none found',
};

// A single "you vs the pack" comparison.
function Bench({ label, b, fmt = num, hint, higherIsBetter = true }) {
  if (!b) return '';
  const you = b.you, med = b.median;
  const tone = you == null || med == null ? 'text-slate-400'
    : (higherIsBetter ? you >= med : you <= med) ? 'text-emerald-600' : 'text-rose-600';
  return html`<div class="rounded-xl border border-slate-200 bg-white p-3">
    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${label}</div>
    <div class=${cx('text-2xl font-extrabold tracking-tight mt-1 tabular-nums', tone)}>${fmt(you)}</div>
    <div class="text-xs text-slate-500 mt-1">
      pack median ${fmt(med)}${b.leaderName ? html` · best ${fmt(b.best)} <span class="text-slate-400">(${b.leaderName})</span>` : ''}
    </div>
    ${hint && html`<div class="text-[11px] text-slate-400 mt-0.5">${hint}</div>`}
  </div>`;
}

function CategoryIntel({ cats }) {
  if (!cats) return '';
  const v = cats.verdict;
  const tone = v?.level === 'act' ? 'bg-amber-50 border-amber-200 text-amber-900'
    : v?.level === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : 'bg-slate-50 border-slate-200 text-slate-700';
  return html`<${Card}><div class="p-4 space-y-3">
    <div>
      <div class="font-semibold text-slate-800">🏷 Category intelligence</div>
      <div class="text-xs text-slate-400">The primary category is the strongest local ranking lever a business controls — this is what the pack actually uses.</div>
    </div>
    ${v && html`<div class=${cx('rounded-xl border px-4 py-3', tone)}>
      <div class="text-sm font-semibold">${v.headline}</div>
      ${v.detail && html`<div class="text-xs mt-1 opacity-90">${v.detail}</div>`}
      ${v.suggested && html`<div class="text-xs mt-2">Change it in the client's Google Business Profile: <span class="font-semibold">${v.suggested}</span></div>`}
    </div>`}
    ${(cats.rows || []).length > 0 && html`<div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
        <th class="py-1.5 pr-3 font-medium">Category</th>
        <th class="py-1.5 pr-3 font-medium text-right">Primary for</th>
        <th class="py-1.5 pr-3 font-medium text-right">Also listed by</th>
        <th class="py-1.5 pr-3 font-medium text-right">Best map rank</th>
        <th class="py-1.5 pr-3 font-medium text-right">Median reviews</th>
        <th class="py-1.5 font-medium">You</th>
      </tr></thead>
      <tbody class="divide-y divide-slate-50">
        ${cats.rows.map((c) => html`<tr class=${cx(c.yoursPrimary && 'bg-brand-50/40')}>
          <td class="py-1.5 pr-3 text-slate-800">${c.category}
            ${c.listings?.length ? html`<div class="text-[11px] text-slate-400 truncate max-w-xs">${c.listings.join(', ')}</div>` : ''}</td>
          <td class="py-1.5 pr-3 text-right tabular-nums font-semibold text-slate-700">${c.primary || '—'}</td>
          <td class="py-1.5 pr-3 text-right tabular-nums text-slate-600">${c.secondary || '—'}</td>
          <td class="py-1.5 pr-3 text-right tabular-nums text-slate-600">${c.bestRank ? `#${c.bestRank}` : '—'}</td>
          <td class="py-1.5 pr-3 text-right tabular-nums text-slate-600">${num(c.medianReviews)}</td>
          <td class="py-1.5">${c.yoursPrimary ? html`<span class="text-xs font-semibold text-brand-700">primary</span>`
            : c.yoursSecondary ? html`<span class="text-xs text-slate-500">listed</span>`
            : html`<span class="text-xs text-slate-300">—</span>`}</td>
        </tr>`)}
      </tbody>
    </table></div>`}
    ${(cats.secondaryGaps || []).length > 0 && html`<div>
      <div class="text-sm font-semibold text-slate-700">Additional categories the pack carries and you don't</div>
      <div class="text-[11px] text-slate-400 mb-1.5">A Google Business Profile allows up to nine additional categories. These are free to add and each one is another way to match a search.</div>
      <div class="flex flex-wrap gap-2">${cats.secondaryGaps.map((g) => html`<span class="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">${g.category} <span class="text-slate-400">· ${g.secondary} listing(s)</span></span>`)}</div>
    </div>`}
  </div></${Card}>`;
}

function Mining({ mining, onRun, busy, canRun }) {
  const [tab, setTab] = useState('themes');
  const p = mining?.payload;
  return html`<${Card}><div class="p-4 space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <div>
        <div class="font-semibold text-slate-800">🧠 What their customers say</div>
        <div class="text-xs text-slate-400">AI topic-mining of the competitor reviews we have on file — their weak spots are your pitch.</div>
      </div>
      <div class="flex-1"></div>
      <${Btn} size="sm" variant="secondary" onClick=${onRun} disabled=${busy || !canRun}>${busy ? 'Reading reviews…' : mining ? 'Re-run' : 'Mine reviews'}</${Btn}>
    </div>
    ${!mining && html`<div class="text-sm text-slate-400">${canRun ? 'Nothing mined yet.' : 'Scrape a competitor first — there are no reviews on file to mine.'}</div>`}
    ${p && html`<div class="space-y-3">
      ${p.summary && html`<div class="rounded-lg bg-brand-50/60 border border-brand-100 px-3 py-2 text-sm text-slate-700">${p.summary}</div>`}
      <div class="flex items-center gap-1.5 flex-wrap">
        ${[['themes', '🗣 Themes'], ['weaknesses', '🎯 Weak spots'], ['ideas', '✍️ Content angles']].map(([id, label]) => html`
          <button onClick=${() => setTab(id)} class=${cx('px-3 py-1.5 rounded-lg text-sm border transition', tab === id ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>${label}</button>`)}
        <div class="flex-1"></div>
        <span class="text-[11px] text-slate-400">${mining.inputs?.reviews || 0} reviews · ${new Date(mining.createdAt).toLocaleDateString()}</span>
      </div>
      ${tab === 'themes' && html`<div class="space-y-2">${(p.themes || []).map((t) => html`
        <div class="rounded-lg border border-slate-100 px-3 py-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium text-slate-800">${t.theme}</span>
            <span class=${cx('text-[10px] px-1.5 py-0.5 rounded-full', t.sentiment === 'negative' ? 'bg-rose-100 text-rose-700' : t.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>${t.sentiment}</span>
            <span class="text-[11px] text-slate-400">${t.mentions} mention(s)${t.competitors?.length ? ` · ${t.competitors.join(', ')}` : ''}</span>
          </div>
          ${t.quote && html`<div class="text-xs text-slate-500 italic mt-1">"${t.quote}"</div>`}
          ${t.soWhat && html`<div class="text-xs text-brand-700 mt-1">→ ${t.soWhat}</div>`}
        </div>`)}</div>`}
      ${tab === 'weaknesses' && html`<div class="space-y-2">${(p.weaknesses || []).map((w) => html`
        <div class="rounded-lg border border-slate-100 px-3 py-2">
          <div class="text-sm font-medium text-slate-800">${w.competitor}: ${w.weakness}</div>
          ${w.evidence && html`<div class="text-xs text-slate-500 mt-0.5">${w.evidence}</div>`}
          ${w.howToWin && html`<div class="text-xs text-emerald-700 mt-1">✓ ${w.howToWin}</div>`}
        </div>`)}
        ${(p.tableStakes || []).length > 0 && html`<div class="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <div class="text-xs font-medium text-slate-600">Table stakes in this market</div>
          <div class="text-xs text-slate-500 mt-0.5">${p.tableStakes.join(' · ')}</div>
        </div>`}
      </div>`}
      ${tab === 'ideas' && html`<div class="grid sm:grid-cols-2 gap-2">${(p.contentIdeas || []).map((c) => html`
        <div class="rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2">
          <div class="text-sm text-slate-800">${c.title}</div>
          <div class="text-xs text-slate-500 mt-0.5">${c.angle}</div>
        </div>`)}</div>`}
    </div>`}
  </div></${Card}>`;
}

export function LocalPack({ site, isSuper }) {
  const [status, setStatus] = useState(null);
  const [intel, setIntel] = useState(null);
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [manual, setManual] = useState('');
  const [manualName, setManualName] = useState('');
  const [confirm, setConfirm] = useState(null); // {kind, credits, usd, detail, run}
  const [watching, setWatching] = useState([]);

  const load = async () => {
    if (!site) return;
    const [s, i] = await Promise.all([seoPleperStatus(site), seoPleperIntel(site)]);
    setStatus(s); setIntel(i);
  };
  useEffect(() => {
    setStatus(null); setIntel(null); setErr(''); setBanner(''); setSel(new Set()); setWatching([]);
    if (site) load().catch((e) => setErr(e.message));
  }, [site]);

  // Scrapes are asynchronous (PlePer batches finish in their own time and call
  // us back), so the page polls the tasks it started until they settle.
  useEffect(() => {
    if (!watching.length) return;
    let dead = false;
    const t = setInterval(async () => {
      const still = [];
      for (const id of watching) {
        try {
          const r = await seoPleperTaskStatus(id);
          if (['pending', 'running'].includes(r.task?.state)) still.push(id);
          else if (r.task?.state === 'fail') setErr(r.task.failMsg || 'A scrape failed.');
        } catch (_) { still.push(id); }
      }
      if (dead) return;
      if (still.length !== watching.length) { await load().catch(() => {}); }
      setWatching(still);
      if (!still.length) setBanner('Scrape finished — the numbers below are up to date.');
    }, 9000);
    return () => { dead = true; clearInterval(t); };
  }, [watching, site]);

  const rows = intel?.rows || [];
  const tracked = rows.filter((r) => !r.isSelf);
  const proposed = intel?.proposed || [];
  const scrapedAny = tracked.some((r) => r.snapshots > 0);

  const toggle = (id) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  const act = async (key, fn, done) => {
    setBusy(key); setErr(''); setBanner('');
    try { const r = await fn(); if (done) setBanner(done(r)); await load(); return r; }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  // Every credit-spending action goes through a confirm step that states the
  // cost in credits AND dollars first.
  const askDiscover = async () => {
    setErr('');
    try {
      const p = await seoPleperDiscoverPreview(site);
      if (!p.targets?.length) {
        setErr(p.missing === 'geography'
          ? 'No target geography yet — set the service area (and mark priority cities) in the Strategy tab first.'
          : 'No keywords to search with — mark your service pages in the Strategy tab, or run the Google Business audit.');
        return;
      }
      setConfirm({
        title: 'Find local competitors',
        detail: `${p.targets.length} map search(es): ${p.keywords.join(', ')} across ${[...new Set(p.targets.map((t) => t.city))].join(', ')}.`,
        credits: p.credits, usd: p.usd,
        run: async () => {
          const r = await act('discover', () => seoPleperDiscover(site));
          if (r?.taskId) {
            setWatching((w) => [...w, r.taskId]);
            setBanner(`Searching ${r.jobs} map view(s) — proposed competitors land here in a minute or two.`);
          }
        },
      });
    } catch (e) { setErr(e.message); }
  };
  const askTeardown = (ids) => {
    if (!ids.length) { setErr('Pick at least one competitor first.'); return; }
    const per = 7;
    setConfirm({
      title: ids.length === 1 ? 'Scrape this competitor' : `Scrape ${ids.length} competitors`,
      detail: `Pulls listing info, reviews, posts, photos, services, products and Q&A (${per} retrievals each) and stores a new snapshot. Snapshots never overwrite — each one adds a point to the trend.`,
      credits: ids.length * per, usd: (ids.length * per * (intel?.usdPerCredit || 0.005)),
      run: async () => {
        const r = await act('teardown', () => seoPleperTeardown(site, ids));
        if (r?.started?.length) {
          setWatching((w) => [...w, ...r.started.map((s) => s.taskId)]);
          setBanner(`Scraping ${r.started.length} listing(s) — this takes a minute or two.`);
          setSel(new Set());
        }
        if (r?.skipped?.length) setErr(r.skipped.map((s) => `${s.name}: ${s.why}`).join(' · '));
      },
    });
  };

  if (!site) return html`<div class="p-8 text-sm text-slate-400">Pick a business first.</div>`;

  return html`<div class="space-y-4">
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}

    ${status && !status.connected && html`<${Card}><div class="p-4">
      <div class="font-semibold text-amber-900">📍 PlePer isn't connected yet</div>
      <p class="text-sm text-slate-600 mt-1">Competitor Google Business data comes from PlePer, which needs an API key on the Supabase project (edge secret <span class="font-mono text-xs">PLEPER_API_KEY</span>, plus <span class="font-mono text-xs">PLEPER_API_SIG</span> if signature checking is switched on in PlePer's API settings). Everything on this page is ready and waiting — the moment the key lands it will start working.</p>
      ${isSuper && html`<div class="mt-3 flex items-center gap-2">
        <${Btn} size="sm" variant="secondary" onClick=${() => act('diag', seoPleperDiag, (r) => r.connected ? `Connected. ${r.note}` : `Not connected: ${r.note}`)} disabled=${busy === 'diag'}>${busy === 'diag' ? 'Testing…' : 'Test the connection'}</${Btn}>
        <span class="text-[11px] text-slate-400">Opens and deletes a test batch — costs nothing.</span>
      </div>`}
    </div></${Card}>`}

    ${confirm && html`<${Card} class="border-amber-200"><div class="p-4">
      <div class="font-semibold text-slate-800">${confirm.title}</div>
      <p class="text-sm text-slate-600 mt-1">${confirm.detail}</p>
      <div class="mt-2 text-sm text-slate-700">Cost: <span class="font-semibold">${confirm.credits} credit(s) — ${usd(confirm.usd)}</span></div>
      <div class="mt-3 flex items-center gap-2">
        <${Btn} size="sm" variant="cta" onClick=${async () => { const c = confirm; setConfirm(null); await c.run(); }} disabled=${!!busy}>Run it</${Btn}>
        <${Btn} size="sm" variant="ghost" onClick=${() => setConfirm(null)}>Cancel</${Btn}>
      </div>
    </div></${Card}>`}

    <div class="flex flex-wrap items-center gap-2">
      <${Btn} size="sm" onClick=${askDiscover} disabled=${!status?.connected || !!busy}>🔎 Find local competitors</${Btn}>
      <${Btn} size="sm" variant="secondary" onClick=${() => askTeardown([...sel])} disabled=${!status?.connected || !sel.size || !!busy}>📥 Scrape selected${sel.size ? ` (${sel.size})` : ''}</${Btn}>
      <div class="flex-1"></div>
      ${watching.length > 0 && html`<span class="text-xs text-slate-400">${watching.length} scrape(s) running…</span>`}
      ${intel?.you && html`<span class="text-[11px] text-slate-400">You: ${intel.you.name}${intel.youBasis === 'audit' ? ' (from the Google Business audit — scrape your own listing for the full picture)' : ''}</span>`}
    </div>

    ${intel === null ? html`<div class="text-sm text-slate-400 py-6">Loading local pack intelligence…</div>` : html`
      ${scrapedAny && html`<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <${Bench} label="Reviews / month" b=${intel.reviews?.velocity} fmt=${(v) => dec(v, 1)} hint=${tracked.some((r) => r.reviewsBasis === 'measured') ? 'measured across repeat scrapes' : 'estimated from review dates until the second scrape'} />
        <${Bench} label="Rating" b=${intel.reviews?.rating} fmt=${(v) => dec(v, 2)} />
        <${Bench} label="Owner replies" b=${intel.reviews?.responseRate} fmt=${pct} hint="share of reviews the owner answered" />
        <${Bench} label="Posts / month" b=${intel.cadence?.posts} fmt=${(v) => dec(v, 1)} hint="Google Business posts" />
      </div>`}

      ${scrapedAny && html`<${CategoryIntel} cats=${intel.categories} />`}

      <${Card}><div class="p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="font-semibold text-slate-800">Tracked listings</div>
          <span class="text-xs text-slate-400">— the benchmark set. Auto-discovery proposes; a human decides.</span>
          <div class="flex-1"></div>
          <${Input} value=${manualName} onInput=${setManualName} placeholder="name (optional)" class="w-40" />
          <${Input} value=${manual} onInput=${setManual} placeholder="paste their Google Maps link…" class="w-64" />
          <${Btn} size="sm" variant="secondary" disabled=${!manual.trim() || busy === 'add'}
            onClick=${() => act('add', () => seoPleperAddCompetitor(site, manual.trim(), manualName.trim()), () => { setManual(''); setManualName(''); return 'Competitor added.'; })}>Add</${Btn}>
        </div>
        ${rows.length === 0
          ? html`<div class="text-sm text-slate-400 py-4 text-center">No listings tracked yet. Use <span class="font-medium">Find local competitors</span>, or paste a competitor's Google Maps link above.</div>`
          : html`<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th class="py-1.5 pr-2 font-medium"></th>
              <th class="py-1.5 pr-3 font-medium">Listing</th>
              <th class="py-1.5 pr-3 font-medium">Primary category</th>
              <th class="py-1.5 pr-3 font-medium text-right">Rating</th>
              <th class="py-1.5 pr-3 font-medium text-right">Reviews</th>
              <th class="py-1.5 pr-3 font-medium text-right">Rev/mo</th>
              <th class="py-1.5 pr-3 font-medium text-right">Replies</th>
              <th class="py-1.5 pr-3 font-medium text-right">Posts/mo</th>
              <th class="py-1.5 pr-3 font-medium text-right">Photos</th>
              <th class="py-1.5 pr-3 font-medium">Last scrape</th>
              <th class="py-1.5 font-medium"></th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              ${rows.map((r) => html`<tr class=${cx(r.isSelf && 'bg-brand-50/40')}>
                <td class="py-1.5 pr-2">${!r.isSelf && html`<input type="checkbox" checked=${sel.has(r.competitorId)} onChange=${() => toggle(r.competitorId)} class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />`}</td>
                <td class="py-1.5 pr-3">
                  <div class="font-medium text-slate-800">${r.name} ${r.isSelf && html`<span class="text-[10px] bg-brand-100 text-brand-800 rounded-full px-1.5 py-0.5">you</span>`}</div>
                  <div class="text-[11px] text-slate-400">${[r.city, r.bestRank ? `best map rank #${r.bestRank}` : null, r.source === 'auto' ? 'found automatically' : null].filter(Boolean).join(' · ')}</div>
                </td>
                <td class="py-1.5 pr-3 text-slate-600">${r.primaryCategory || '—'}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-slate-700">${dec(r.rating, 1)}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-slate-700">${num(r.reviewCount)}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-slate-700" title=${BASIS_NOTE[r.reviewsBasis] || ''}>${dec(r.reviewsPerMonth, 1)}${r.reviewsBasis === 'measured' ? html`<span class="text-emerald-500 text-[10px] align-super">✓</span>` : ''}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-slate-700">${pct(r.responseRate)}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-slate-700">${dec(r.postsPerMonth, 1)}</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-slate-700">${num(r.photoCount)}</td>
                <td class="py-1.5 pr-3 text-slate-500">${ago(r.lastScrapedAt)}${r.snapshots > 1 ? html`<span class="text-[11px] text-slate-400"> · ${r.snapshots} snapshots</span>` : ''}</td>
                <td class="py-1.5 text-right whitespace-nowrap">
                  <button title="Scrape this listing now" onClick=${() => askTeardown([r.competitorId])} class="text-xs text-slate-400 hover:text-brand-700 underline">scrape</button>
                  ${!r.isSelf && html`<button title="Not a competitor" onClick=${() => act('set', () => seoPleperSetCompetitor(site, r.competitorId, { status: 'dismissed' }), () => 'Removed from the benchmark set.')} class="ml-2 text-xs text-slate-300 hover:text-rose-600">✕</button>`}
                </td>
              </tr>`)}
            </tbody>
          </table></div>`}
        ${scrapedAny && html`<div class="text-[11px] text-slate-400">Rev/mo marked <span class="text-emerald-500">✓</span> was measured across two scrapes; the rest is estimated from review dates. Tracked listings re-scrape automatically once a month so the measured figure takes over.</div>`}
      </div></${Card}>

      ${proposed.length > 0 && html`<${Card}><div class="p-4">
        <div class="font-semibold text-slate-800">Proposed by map search <span class="text-xs font-normal text-slate-400">— ${proposed.length} listing(s) found in the pack. Track the real competitors; dismiss the rest.</span></div>
        <div class="mt-2 space-y-1.5">${proposed.map((p) => html`<div class="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-slate-800 truncate">${p.name}</div>
            <div class="text-[11px] text-slate-400 truncate">${[p.primaryCategory, p.city, p.bestRank ? `#${p.bestRank}` : null, `seen ${p.seenCount}×`].filter(Boolean).join(' · ')}${p.discoveredFrom?.length ? ` — ${p.discoveredFrom.map((d) => `"${d.keyword}" in ${d.city}`).slice(-2).join(', ')}` : ''}</div>
          </div>
          <${Btn} size="sm" variant="secondary" onClick=${() => act('set', () => seoPleperSetCompetitor(site, p.competitorId, { status: 'tracked' }), () => `Tracking ${p.name}.`)}>Track</${Btn}>
          <button title="Not a competitor" onClick=${() => act('set', () => seoPleperSetCompetitor(site, p.competitorId, { status: 'dismissed' }))} class="text-slate-300 hover:text-rose-600 px-1">✕</button>
        </div>`)}</div>
      </div></${Card}>`}

      ${(intel?.serviceGaps || []).length > 0 && html`<${Card}><div class="p-4">
        <div class="font-semibold text-slate-800">Services the pack lists and you don't</div>
        <div class="text-[11px] text-slate-400 mb-2">Services on a Google Business Profile are free, searchable, and most local businesses leave them empty. Each one below is listed by at least two competitors.</div>
        <div class="flex flex-wrap gap-2">${intel.serviceGaps.map((s) => html`<span class="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">${s.name} <span class="text-slate-400">· ${s.competitors}</span></span>`)}</div>
      </div></${Card}>`}

      <${Mining} mining=${intel?.mining} canRun=${scrapedAny} busy=${busy === 'mine'}
        onRun=${() => act('mine', () => seoPleperReviewMine(site), () => 'Review mining finished.')} />
    `}
  </div>`;
}
