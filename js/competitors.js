// ---------------------------------------------------------------------------
// competitors.js — Competitor Intelligence: discover organic competitors, then
// the keyword gap (what they rank for that you don't) and content-gap themes.
// Powered by DataForSEO Labs via the seo-competitors function.
// Deep Research: skill-driven competitive research runs (docs/
// competitive-research-skill.md) — decision frame → universe → evidence
// ledger → weighted scorecard → insights → opportunities → experiments →
// 30/60/90 plan. Report is AI-written server-side from the data on file.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadCompetitors, seoLoadGap, seoCompetitorsDiscover, seoCompetitorGap, seoAddCompetitor, seoResearchRun, seoResearchList, seoResearchGet, seoResearchDelete } from './store.js';
import { Card, Btn, Select, Input } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const num = (n) => (n || 0).toLocaleString();
const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const short = (u) => { try { const x = new URL(u.startsWith('http') ? u : 'https://' + u); return x.pathname === '/' ? '' : x.pathname; } catch { return u; } };
const STOP = new Set('a,an,the,for,to,of,in,on,at,my,your,you,is,are,how,do,near,me,best,top,cost,price,vs,and,or,with,what,why,service,services,company,near,and'.split(','));

// ── Deep research (skill-driven) ────────────────────────────────────────────
const DIMS = [['visibility', 'Visibility', 12], ['positioning', 'Positioning', 9], ['offer', 'Offer', 12], ['proof', 'Proof', 12], ['reviews', 'Reviews', 10], ['conversion', 'Conversion', 12], ['content', 'Content', 8], ['paid', 'Paid demand', 6], ['cx', 'Customer exp.', 12], ['momentum', 'Momentum', 7]];
const CONF_MULT = { high: 1, medium: 0.75, low: 0.5 };
const KIND_TONE = { fact: 'bg-emerald-100 text-emerald-700', estimate: 'bg-sky-100 text-sky-700', inference: 'bg-amber-100 text-amber-700', hypothesis: 'bg-violet-100 text-violet-700' };
const OPP_TONE = { parity: 'bg-amber-100 text-amber-700', differentiation: 'bg-violet-100 text-violet-700', execution: 'bg-sky-100 text-sky-700', 'white-space': 'bg-emerald-100 text-emerald-700' };
const UNI_TONE = { direct: 'bg-rose-100 text-rose-700', indirect: 'bg-amber-100 text-amber-700', substitute: 'bg-slate-200 text-slate-600', aspirational: 'bg-violet-100 text-violet-700' };
const CONF_TONE = { high: 'text-emerald-600', medium: 'text-amber-600', low: 'text-rose-500' };
// Skill scoring: score 1-5 × confidence multiplier (high 1.00 / med .75 / low .50).
const weightedPct = (scores) => {
  let got = 0, max = 0;
  for (const [k, , w] of DIMS) { const c = scores?.[k]; if (!c) continue; got += w * (Number(c.s) || 0) * (CONF_MULT[c.c] ?? 0.75); max += w * 5; }
  return max ? Math.round((got / max) * 100) : 0;
};
const scoreTone = (s) => s >= 4 ? 'text-emerald-700 font-semibold' : s >= 3 ? 'text-slate-700' : 'text-rose-600';

function PlanColumn({ title, items }) {
  return html`<div class="flex-1 min-w-[220px]">
    <div class="text-sm font-semibold text-slate-700 mb-2">${title}</div>
    <div class="space-y-2">
      ${(items || []).map((a) => html`<div class="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
        <div class="text-sm text-slate-800">${a.action}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${a.owner}${a.metric ? ` · ${a.metric}` : ''}${a.target ? ` → ${a.target}` : ''}</div>
      </div>`)}
    </div>
  </div>`;
}

function ResearchReport({ run, onDelete }) {
  const r = run.report || {};
  const [tab, setTab] = useState('overview');
  const tabs = [['overview', '📋 Overview'], ['scorecard', '📊 Scorecard'], ['insights', '💡 Insights'], ['plan', '🗓 Plan'], ['ledger', '🧾 Evidence']];
  const uniGroups = useMemo(() => {
    const g = { direct: [], indirect: [], substitute: [], aspirational: [] };
    for (const u of r.universe || []) (g[u.type] || g.direct).push(u);
    return g;
  }, [r]);
  return html`<div class="space-y-3">
    <div class="rounded-xl bg-slate-800 text-slate-100 px-4 py-3">
      <div class="text-[11px] uppercase tracking-wide text-slate-400 mb-1">The decision this research informs</div>
      <div class="text-sm">${r.frame || run.decision}</div>
    </div>

    <div class="flex items-center gap-1.5 flex-wrap">
      ${tabs.map(([id, label]) => html`<button onClick=${() => setTab(id)} class=${cx('px-3 py-1.5 rounded-lg text-sm border transition', tab === id ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>${label}</button>`)}
      <div class="flex-1"></div>
      <button onClick=${onDelete} class="text-xs text-slate-400 hover:text-rose-600 underline">delete run</button>
    </div>

    ${tab === 'overview' && html`<div class="space-y-3">
      <div class="rounded-lg bg-brand-50/60 border border-brand-100 px-4 py-3 text-sm text-slate-700">${r.brief}</div>
      <div>
        <div class="text-sm font-semibold text-slate-700 mb-2">Competitor universe</div>
        <div class="grid sm:grid-cols-2 gap-2">
          ${(r.universe || []).map((u) => html`<div class="rounded-lg border border-slate-100 px-3 py-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-slate-800 truncate">${u.name}</span>
              <span class=${cx('text-[10px] px-1.5 py-0.5 rounded-full shrink-0', UNI_TONE[u.type] || UNI_TONE.direct)}>${u.type}</span>
            </div>
            ${u.note && html`<div class="text-xs text-slate-500 mt-0.5">${u.note}</div>`}
          </div>`)}
        </div>
      </div>
      <div>
        <div class="text-sm font-semibold text-slate-700 mb-2">Opportunities <span class="text-xs font-normal text-slate-400">— parity = catch up · differentiation = stand out · execution = do it better · white-space = unserved need</span></div>
        <div class="space-y-2">
          ${(r.opportunities || []).slice().sort((a, b) => (b.priority || 0) - (a.priority || 0)).map((o) => html`<div class="rounded-lg border border-slate-100 px-3 py-2 flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center text-sm font-semibold shrink-0" title="Priority (1-10)">${o.priority ?? '—'}</div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap"><span class="text-sm font-medium text-slate-800">${o.title}</span><span class=${cx('text-[10px] px-1.5 py-0.5 rounded-full', OPP_TONE[o.type] || 'bg-slate-100 text-slate-600')}>${o.type}</span></div>
              <div class="text-xs text-slate-500 mt-0.5">${o.rationale}</div>
            </div>
          </div>`)}
        </div>
      </div>
      <div>
        <div class="text-sm font-semibold text-slate-700 mb-2">Experiments to run</div>
        <div class="grid md:grid-cols-2 gap-2">
          ${(r.experiments || []).map((x) => html`<div class="rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2 text-xs space-y-1">
            <div class="text-sm text-slate-800">${x.hypothesis}</div>
            <div class="text-slate-500"><span class="font-medium">Metric:</span> ${x.metric} · <span class="font-medium">Duration:</span> ${x.duration}</div>
            <div class="text-slate-500"><span class="font-medium">Guardrails:</span> ${x.guardrails}</div>
            <div class="text-slate-500"><span class="font-medium">Decision rule:</span> ${x.decisionRule}</div>
          </div>`)}
        </div>
      </div>
    </div>`}

    ${tab === 'scorecard' && html`<div class="space-y-2">
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
          <th class="py-1.5 pr-3">Dimension <span class="font-normal">(weight)</span></th>
          ${(r.scorecard || []).map((c) => html`<th class=${cx('py-1.5 px-2 text-center', c.you && 'text-brand-700')}>${c.you ? 'You' : c.name}</th>`)}
        </tr></thead>
        <tbody>
          ${DIMS.map(([k, label, w]) => html`<tr class="border-b border-slate-50">
            <td class="py-1.5 pr-3 text-slate-600">${label} <span class="text-[10px] text-slate-300">(${w})</span></td>
            ${(r.scorecard || []).map((c) => { const cell = c.scores?.[k]; return html`<td class=${cx('py-1.5 px-2 text-center tabular-nums', c.you && 'bg-brand-50/40')}>
              ${cell ? html`<span class=${scoreTone(Number(cell.s) || 0)}>${cell.s}</span><span class=${cx('text-[9px] ml-1 align-middle', CONF_TONE[cell.c] || 'text-slate-300')} title=${`${cell.c} confidence`}>●</span>` : '—'}
            </td>`; })}
          </tr>`)}
          <tr>
            <td class="py-2 pr-3 font-semibold text-slate-700">Weighted total</td>
            ${(r.scorecard || []).map((c) => html`<td class=${cx('py-2 px-2 text-center font-semibold tabular-nums', c.you ? 'bg-brand-50/40 text-brand-700' : 'text-slate-700')}>${weightedPct(c.scores)}%</td>`)}
          </tr>
        </tbody>
      </table></div>
      <div class="text-[11px] text-slate-400">Scores are 1–5 discounted by evidence confidence (● <span class="text-emerald-600">high</span> ×1.0 · <span class="text-amber-600">medium</span> ×0.75 · <span class="text-rose-500">low</span> ×0.5), then weighted per the research skill. A low score with low confidence means "probably weak, verify it" — not a settled fact.</div>
    </div>`}

    ${tab === 'insights' && html`<div class="space-y-2">
      ${(r.insights || []).map((i, idx) => html`<details class="rounded-lg border border-slate-100 px-3 py-2 group" open=${idx === 0}>
        <summary class="cursor-pointer text-sm font-medium text-slate-800 select-none">💡 ${i.observation}</summary>
        <div class="mt-2 space-y-1 text-xs">
          ${[['Pattern', i.pattern], ['What it means', i.meaning], ['Business impact', i.impact]].map(([k, v]) => v && html`<div><span class="font-medium text-slate-500">${k}:</span> <span class="text-slate-700">${v}</span></div>`)}
          <div class="rounded bg-brand-50/60 px-2 py-1.5 text-slate-700 mt-1"><span class="font-medium">→ Do:</span> ${i.action} <span class="text-slate-400">· measure: ${i.measure}</span></div>
        </div>
      </details>`)}
    </div>`}

    ${tab === 'plan' && html`<div class="space-y-3">
      <div class="flex flex-wrap gap-4">
        <${PlanColumn} title="First 30 days" items=${r.plan?.d30} />
        <${PlanColumn} title="Days 31–60" items=${r.plan?.d60} />
        <${PlanColumn} title="Days 61–90" items=${r.plan?.d90} />
      </div>
      ${r.refresh && html`<div class="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500"><span class="font-medium text-slate-600">🔄 Keep it fresh:</span> ${r.refresh}</div>`}
    </div>`}

    ${tab === 'ledger' && html`<div class="space-y-2">
      <div class="overflow-x-auto"><table class="w-full text-xs">
        <thead><tr class="text-left text-slate-400 border-b border-slate-100"><th class="py-1.5 pr-3">Competitor</th><th class="py-1.5 pr-3">Observation</th><th class="py-1.5 pr-3">Type</th><th class="py-1.5 pr-3">Conf.</th><th class="py-1.5 pr-3">So what</th></tr></thead>
        <tbody>${(r.ledger || []).map((l) => html`<tr class="border-b border-slate-50 align-top">
          <td class="py-1.5 pr-3 font-medium text-slate-700 whitespace-nowrap">${l.competitor}</td>
          <td class="py-1.5 pr-3 text-slate-700">${l.observation}<div class="text-[10px] text-slate-400">${l.source}</div></td>
          <td class="py-1.5 pr-3"><span class=${cx('px-1.5 py-0.5 rounded-full whitespace-nowrap', KIND_TONE[l.kind] || 'bg-slate-100 text-slate-600')}>${l.kind}</span></td>
          <td class=${cx('py-1.5 pr-3 whitespace-nowrap', CONF_TONE[l.confidence] || '')}>${l.confidence}</td>
          <td class="py-1.5 pr-3 text-slate-500">${l.interpretation}${l.action ? html`<div class="text-brand-700">→ ${l.action}</div>` : ''}</td>
        </tr>`)}</tbody>
      </table></div>
      ${(r.limitations || []).length > 0 && html`<div class="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
        <span class="font-medium">Limitations of this research:</span>
        <ul class="list-disc ml-4 mt-1 space-y-0.5">${r.limitations.map((l) => html`<li>${l}</li>`)}</ul>
      </div>`}
    </div>`}
  </div>`;
}

function DeepResearch({ site }) {
  const [runs, setRuns] = useState(null);
  const [sel, setSel] = useState('');
  const [run, setRun] = useState(null);
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState('');
  const [geography, setGeography] = useState('');
  const [segment, setSegment] = useState('');
  const [deadline, setDeadline] = useState('');
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadRuns = async (pick) => {
    const r = await seoResearchList(site);
    const rows = r.runs || [];
    setRuns(rows);
    const target = pick || rows.find((x) => x.status === 'ready')?.id || '';
    setSel(target ? String(target) : '');
  };
  useEffect(() => { setRuns(null); setRun(null); setSel(''); setErr(''); if (site) loadRuns().catch((e) => { setErr(e.message); setRuns([]); }); }, [site]);
  useEffect(() => {
    if (!sel) { setRun(null); return; }
    setRun(null);
    seoResearchGet(site, Number(sel)).then((r) => setRun(r.run)).catch((e) => setErr(e.message));
  }, [sel, site]);

  const start = async () => {
    if (!decision.trim()) { setErr('Tell it the decision this research should inform — that is what makes the research useful.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await seoResearchRun(site, { decision: decision.trim(), geography: geography.trim(), segment: segment.trim(), deadline: deadline.trim(), outcome: outcome.trim() });
      setOpen(false); setDecision(''); setGeography(''); setSegment(''); setDeadline(''); setOutcome('');
      await loadRuns(r.researchId);
    } catch (e) { setErr(e.message); await loadRuns().catch(() => { }); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!run || !confirm('Delete this research run?')) return;
    try { await seoResearchDelete(site, run.id); setRun(null); await loadRuns(); } catch (e) { setErr(e.message); }
  };

  return html`<${Card}><div class="p-4">
    <div class="flex flex-wrap items-center gap-2 mb-1">
      <div class="font-semibold text-slate-800">🔬 Deep research</div>
      <span class="text-xs text-slate-400">— evidence → insight → decision → action, with everything labeled fact / estimate / inference / hypothesis</span>
      <div class="flex-1"></div>
      ${runs && runs.length > 0 && html`<${Select} value=${sel} onChange=${setSel} options=${runs.map((x) => ({ value: String(x.id), label: `${new Date(x.created_at).toLocaleDateString()} — ${(x.decision || 'research').slice(0, 60)}${x.status !== 'ready' ? ` (${x.status})` : ''}` }))} />`}
      <${Btn} size="sm" variant=${open ? 'ghost' : 'cta'} onClick=${() => { setOpen(!open); setErr(''); }}>${open ? 'Cancel' : '+ New research'}</${Btn}>
    </div>
    ${err && html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700 my-2">${err}</div>`}

    ${open && html`<div class="rounded-xl border border-slate-100 bg-slate-50/50 p-3 my-3 space-y-2">
      <div>
        <label class="text-[11px] text-slate-400">What decision should this research inform? <span class="text-rose-400">*</span></label>
        <${Input} value=${decision} onInput=${setDecision} placeholder=${'e.g. "Which service should we push hardest this fall?" or "How do we win more shed-installation jobs?"'} />
      </div>
      <div class="grid sm:grid-cols-2 gap-2">
        <div><label class="text-[11px] text-slate-400">Geography (blank = saved service area)</label><${Input} value=${geography} onInput=${setGeography} placeholder="Marion County, FL" /></div>
        <div><label class="text-[11px] text-slate-400">Customer segment (blank = inferred)</label><${Input} value=${segment} onInput=${setSegment} placeholder="homeowners 35-65" /></div>
        <div><label class="text-[11px] text-slate-400">Deadline</label><${Input} value=${deadline} onInput=${setDeadline} placeholder="end of Q3" /></div>
        <div><label class="text-[11px] text-slate-400">Success looks like</label><${Input} value=${outcome} onInput=${setOutcome} placeholder="+10 booked estimates/mo" /></div>
      </div>
      <div class="flex items-center gap-3">
        <${Btn} size="sm" variant="cta" onClick=${start} disabled=${busy}>${busy ? 'Researching… (about a minute)' : '🔬 Run competitive research'}</${Btn}>
        <span class="text-[11px] text-slate-400">Uses your competitors, gap keywords, service area, service pages, and Google Business audit as evidence.</span>
      </div>
    </div>`}

    ${busy && !open && html`<div class="text-sm text-slate-400 py-2">Researching… this takes about a minute.</div>`}
    ${runs === null ? html`<div class="text-sm text-slate-400 py-2">Loading research…</div>`
      : runs.length === 0 && !open ? html`<div class="text-sm text-slate-400 py-2">No research yet. Run one to get a competitor universe, weighted scorecard, evidence ledger, and a 30/60/90 plan — all tied to a decision you need to make.</div>`
      : run && run.status === 'ready' ? html`<div class="mt-2"><${ResearchReport} run=${run} onDelete=${del} /></div>`
      : run && run.status === 'failed' ? html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700 mt-2">This run failed: ${run.error || 'unknown error'} <button onClick=${del} class="underline ml-2">delete it</button></div>`
      : sel ? html`<div class="text-sm text-slate-400 py-2 mt-1">Loading report…</div>` : ''}
  </div></${Card}>`;
}

export function Competitors() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [comps, setComps] = useState([]);
  const [active, setActive] = useState('');
  const [gap, setGap] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [manual, setManual] = useState('');
  const sort = useSort('volume', 'desc');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const loadComps = async (sid) => setComps(await seoLoadCompetitors(sid));
  useEffect(() => { if (site) { loadComps(site); setActive(''); setGap([]); } else setComps([]); }, [site]);
  useEffect(() => { if (site && active) seoLoadGap(site, active).then(setGap); else setGap([]); }, [active, site]);

  const discover = async () => { setBusy('discover'); setErr(''); setBanner(''); try { const r = await seoCompetitorsDiscover(site); setBanner(`Found ${num(r.found)} competitor(s).`); await loadComps(site); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const addManual = async () => { if (!manual.trim()) return; setBusy('add'); setErr(''); try { const r = await seoAddCompetitor(site, manual); setManual(''); await loadComps(site); if (r.competitor) setActive(r.competitor.competitor_domain); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const runGap = async (domain) => { setActive(domain); setBusy('gap:' + domain); setErr(''); try { const r = await seoCompetitorGap(site, domain); setBanner(`${num(r.missing)} keywords they rank for that you don't, ${num(r.gap - r.missing)} where you're weaker.`); setGap(await seoLoadGap(site, domain)); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  const themes = useMemo(() => {
    const bf = new Map();
    for (const g of gap) {
      const core = g.keyword.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
      for (let i = 0; i < core.length - 1; i++) { const bg = core[i] + ' ' + core[i + 1]; let e = bf.get(bg); if (!e) { e = { theme: bg, count: 0, volume: 0 }; bf.set(bg, e); } e.count++; e.volume += g.volume; }
    }
    return [...bf.values()].filter((t) => t.count >= 2).sort((a, b) => b.volume - a.volume).slice(0, 10);
  }, [gap]);

  const stats = useMemo(() => ({ total: gap.length, missing: gap.filter((g) => g.gap_type === 'missing').length, volume: gap.reduce((s, g) => s + g.volume, 0) }), [gap]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading competitors…</div>`;

  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Competitor Intelligence</h1>
        <p class="text-sm text-slate-500">Who outranks you, and exactly which keywords &amp; topics they win that you don't.</p>
      </div>
      <div class="flex items-center gap-2">
        ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
        ${site && html`<${Btn} onClick=${discover} disabled=${busy === 'discover'}>${busy === 'discover' ? 'Finding…' : 'Find competitors'}</${Btn}>`}
      </div>
    </div>
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : html`
        <${DeepResearch} site=${site} key=${site} />
        <div class="grid lg:grid-cols-3 gap-4">
          <div class="lg:col-span-1 space-y-3">
            <${Card}><div class="p-3">
              <div class="font-semibold text-slate-800 mb-2">Competitors</div>
              <div class="flex gap-2 mb-3">
                <${Input} value=${manual} onInput=${setManual} placeholder="add a domain…" class="flex-1" />
                <${Btn} size="sm" onClick=${addManual} disabled=${busy === 'add'}>Add</${Btn}>
              </div>
              ${comps.length === 0
                ? html`<div class="text-sm text-slate-400 py-4 text-center">No competitors yet. Click <span class="font-medium">Find competitors</span> or add one above.</div>`
                : html`<div class="space-y-1">${comps.map((c) => html`<button onClick=${() => runGap(c.competitor_domain)}
                    class=${cx('w-full text-left px-2.5 py-2 rounded-lg border transition', active === c.competitor_domain ? 'border-brand-300 bg-brand-50' : 'border-slate-100 hover:border-slate-200')}>
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-medium text-slate-800 truncate">${c.competitor_domain}</span>
                      ${busy === 'gap:' + c.competitor_domain ? html`<span class="text-xs text-slate-400">analyzing…</span>` : c.source === 'manual' ? html`<span class="text-[10px] text-slate-400">manual</span>` : ''}
                    </div>
                    <div class="text-xs text-slate-500">${num(c.common_keywords)} shared kw · ${c.etv ? money(c.etv) + ' est. traffic' : ''}</div>
                  </button>`)}</div>`}
            </div></${Card}>
          </div>

          <div class="lg:col-span-2 space-y-4">
            ${!active
              ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Select a competitor to see the keyword &amp; content gap — what they rank for that you don't.</div></${Card}>`
              : gap.length === 0 && busy !== 'gap:' + active
                ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No gap analyzed yet for <span class="font-medium">${active}</span>. ${busy ? 'Analyzing…' : 'Click the competitor again to analyze.'}</div></${Card}>`
                : html`
                  <div class="grid grid-cols-3 gap-3">
                    ${[['Gap keywords', num(stats.total)], ['Not ranking', num(stats.missing)], ['Total volume/mo', num(stats.volume)]].map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div></div></${Card}>`)}
                  </div>
                  ${themes.length > 0 && html`<${Card}><div class="p-3">
                    <div class="font-semibold text-slate-800 mb-1">Content gap — topics ${active} covers that you're missing</div>
                    <div class="flex flex-wrap gap-2 mt-2">${themes.map((t) => html`<span class="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">${t.theme} <span class="text-slate-400">· ${num(t.volume)}/mo</span></span>`)}</div>
                  </div></${Card}>`}
                  <${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
                    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                      <${SortTh} k="keyword" label="Keyword" sort=${sort} /><${SortTh} k="volume" label="Volume" sort=${sort} right=${true} /><${SortTh} k="competitor_position" label="Their pos" sort=${sort} right=${true} /><${SortTh} k="client_position" label="Your pos" sort=${sort} right=${true} /><th class="py-1.5 pr-3">Gap</th></tr></thead>
                    <tbody>${sort.sort(gap).slice(0, 250).map((g) => html`<tr class="border-b border-slate-50">
                      <td class="py-1.5 pr-3 font-medium text-slate-800 max-w-xs truncate">${g.competitor_url ? html`<a href=${g.competitor_url.startsWith('http') ? g.competitor_url : 'https://' + g.competitor_url} target="_blank" rel="noopener" class="hover:text-brand-700" title=${g.competitor_url}>${g.keyword}</a>` : g.keyword}</td>
                      <td class="py-1.5 pr-3 text-right tabular-nums">${num(g.volume)}</td>
                      <td class="py-1.5 pr-3 text-right tabular-nums">${g.competitor_position || '—'}</td>
                      <td class=${cx('py-1.5 pr-3 text-right tabular-nums', g.client_position == null && 'text-slate-300')}>${g.client_position == null ? '—' : g.client_position}</td>
                      <td class="py-1.5 pr-3"><span class=${cx('text-xs font-medium px-2 py-0.5 rounded-full', g.gap_type === 'missing' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>${g.gap_type === 'missing' ? 'not ranking' : 'weaker'}</span></td>
                    </tr>`)}</tbody>
                  </table></div></${Card}>
                `}
          </div>
        </div>
      `}
  </div>`;
}
