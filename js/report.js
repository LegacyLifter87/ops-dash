// ---------------------------------------------------------------------------
// report.js — the Reporting tab: the flagship cross-channel client report.
//
// The report itself lives in report-body.js and is shared verbatim with the
// public share page, so what the client opens is what the agency sent. This
// file adds only the things that never leave the app: the Agency/Client lens
// toggle, the reporting window, the commercial terms, and share-link
// management.
//
// Decision (2026-08-12): the share link and the future emailed report ALWAYS
// send the Client lens. That is enforced server-side in seo-report — the
// toggle here only changes what THIS user sees.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, activeAccount, reportSummary, reportShareList, reportShareCreate, reportShareRevoke, reportSetTerms, seoLoadSites,
  aivisSummary, aivisStatus, aivisSuggest, aivisSavePrompts, aivisSaveSettings, aivisEstimate, aivisRunStart, aivisRunTick, aivisDiag, gbpPerfSummary, oppsSummary } from './store.js';
import { Card, Btn, Modal, Field, Input, Select, Checkbox, Textarea } from './ui.js';
import { ReportBody } from './report-body.js';
import { ensureVizCss } from './report-view.js';

const WINDOWS = [
  { value: '1', label: 'This month' },
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
];

function ShareModal({ accountId, siteId, onClose }) {
  const [shares, setShares] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [label, setLabel] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    setErr('');
    try { const r = await reportShareList(); setShares(r.shares || []); }
    catch (e) { setErr(e.message); setShares([]); }
  };
  useEffect(() => { load(); }, [accountId]);

  const create = async () => {
    setBusy('create'); setErr('');
    try { await reportShareCreate(siteId, label.trim()); setLabel(''); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const revoke = async (id) => {
    if (!confirm('Turn off this link? Anyone holding it will see a "link turned off" page immediately.')) return;
    setBusy(id); setErr('');
    try { await reportShareRevoke(id); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const copy = async (url, id) => {
    try { await navigator.clipboard.writeText(url); setCopied(id); setTimeout(() => setCopied(''), 1800); }
    catch { window.prompt('Copy this link:', url); }
  };

  const live = (shares || []).filter((s) => !s.revoked_at);
  const dead = (shares || []).filter((s) => s.revoked_at);

  return html`<${Modal} title="Share this report" wide onClose=${onClose}>
    <div class="space-y-4">
      <p class="text-sm text-slate-600">
        A share link opens the report with no login, read-only, and <span class="font-semibold">always in the Client view</span> —
        your costs, margin and API spend are never included. Revoke a link at any time.
      </p>
      ${err && html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700">${err}</div>`}

      <div class="flex flex-col sm:flex-row gap-2 sm:items-end">
        <${Field} label="Label (optional)" class="flex-1">
          <${Input} value=${label} onInput=${setLabel} placeholder="e.g. Monthly report for Dave" />
        </${Field}>
        <${Btn} onClick=${create} disabled=${busy === 'create'} class="shrink-0">${busy === 'create' ? 'Creating…' : '+ New link'}</${Btn}>
      </div>

      ${shares === null ? html`<div class="text-sm text-slate-400 py-4">Loading links…</div>` : html`
        <div class="space-y-2">
          ${live.length === 0 && html`<div class="text-sm text-slate-400 py-2">No active links yet.</div>`}
          ${live.map((s) => html`
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-slate-800 truncate">${s.label || 'Client report link'}</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    Created ${new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    ${s.view_count > 0
                      ? ` · opened ${s.view_count} time${s.view_count === 1 ? '' : 's'}${s.last_viewed_at ? `, last ${new Date(s.last_viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`
                      : ' · not opened yet'}
                  </div>
                </div>
                <button onClick=${() => revoke(s.id)} disabled=${busy === s.id}
                  class="shrink-0 text-xs text-slate-400 hover:text-rose-600 underline">${busy === s.id ? 'Revoking…' : 'Revoke'}</button>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <input readonly value=${s.url} onClick=${(e) => e.target.select()}
                  class="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600" />
                <${Btn} size="sm" variant="secondary" onClick=${() => copy(s.url, s.id)} class="shrink-0">${copied === s.id ? '✓ Copied' : 'Copy'}</${Btn}>
                <a href=${s.url} target="_blank" rel="noopener"
                  class="shrink-0 text-xs text-brand-600 hover:underline whitespace-nowrap">Open ↗</a>
              </div>
            </div>`)}
        </div>
        ${dead.length > 0 && html`
          <details>
            <summary class="text-xs text-slate-400 cursor-pointer select-none">${dead.length} revoked link${dead.length === 1 ? '' : 's'}</summary>
            <div class="mt-2 space-y-1">
              ${dead.map((s) => html`<div class="text-xs text-slate-400 line-through truncate">${s.label || 'Client report link'}</div>`)}
            </div>
          </details>`}`}
    </div>
  </${Modal}>`;
}

function TermsModal({ acct, onClose, onSaved }) {
  const [fee, setFee] = useState(acct?.monthly_fee == null ? '' : String(acct.monthly_fee));
  const [ticket, setTicket] = useState(acct?.avg_ticket == null ? '' : String(acct.avg_ticket));
  const [ltv, setLtv] = useState(String(acct?.ltv_multiple ?? 1));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await reportSetTerms({
        monthlyFee: fee === '' ? null : Number(fee),
        avgTicket: ticket === '' ? null : Number(ticket),
        ltvMultiple: Number(ltv) || 1,
      });
      onSaved?.(); onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title="Commercial terms" onClose=${onClose}>
    <div class="space-y-3">
      <p class="text-xs text-slate-500">
        These three numbers turn the report into a real P&L. They are agency-only — a client never sees the fee.
      </p>
      <${Field} label="Monthly retainer ($)" hint="What this business pays you per month. Leave blank if there's no retainer — the P&L will say so rather than assume $0.">
        <${Input} type="number" value=${fee} onInput=${setFee} placeholder="1500" />
      </${Field}>
      <${Field} label="Average job value ($)" hint="Only used for businesses with NO Job Tracker link. Linked businesses compute the real ticket from measured revenue.">
        <${Input} type="number" value=${ticket} onInput=${setTicket} placeholder="4200" />
      </${Field}>
      <${Field} label="Lifetime value multiple" hint="Repeat and referral work as a multiple of the first job's gross profit. 1 = count the first job only (conservative).">
        <${Input} type="number" step="0.1" value=${ltv} onInput=${setLtv} placeholder="1.0" />
      </${Field}>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy}>${busy ? 'Saving…' : 'Save terms'}</${Btn}>
    </div>
  </${Modal}>`;
}

// ---------------------------------------------------------------------------
// AI search visibility — the agency-only control panel for the report section.
//
// Everything here is deliberately agency-side: the prompt set, which engines
// are connected, what a run will cost, and the diagnostics. A client never sees
// any of it — the share link renders the section's results only.
// ---------------------------------------------------------------------------
const INTENTS = [
  { value: 'local', label: 'Local ("who does X near me")' },
  { value: 'service', label: 'Service (a specific job)' },
  { value: 'cost', label: 'Cost ("how much does X cost")' },
  { value: 'comparison', label: 'Comparison ("X vs Y")' },
  { value: 'brand', label: 'Brand (names the business)' },
  { value: 'other', label: 'Other' },
];

function AivisModal({ siteId, onClose, onRan }) {
  const [st, setSt] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null);   // pending run estimate
  const [progress, setProgress] = useState(null);
  const [diag, setDiag] = useState(null);

  const load = async () => {
    setErr('');
    try {
      const r = await aivisStatus(siteId);
      setSt(r);
      setPrompts((r.prompts || []).filter((p) => p.active !== false));
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [siteId]);

  const setPrompt = (i, patch) => setPrompts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addPrompt = () => setPrompts((ps) => [...ps, { prompt: '', intent: 'local', source: 'manual' }]);
  const removePrompt = (i) => setPrompts((ps) => ps.filter((_, j) => j !== i));

  const suggest = async () => {
    setBusy('suggest'); setErr(''); setMsg('');
    try {
      const r = await aivisSuggest(siteId);
      // Never clobber human wording: suggestions are appended, and anything
      // already present (case-insensitively) is skipped.
      const have = new Set(prompts.map((p) => String(p.prompt || '').trim().toLowerCase()));
      const add = (r.prompts || [])
        .filter((p) => p.prompt && !have.has(String(p.prompt).trim().toLowerCase()))
        .map((p) => ({ prompt: p.prompt, intent: p.intent || 'local', source: 'ai' }));
      setPrompts((ps) => [...ps, ...add]);
      setMsg(add.length ? `Added ${add.length} suggested question${add.length === 1 ? '' : 's'} — edit anything that doesn't sound like your customers, then save.` : 'No new suggestions — the set already covers them.');
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const save = async () => {
    setBusy('save'); setErr(''); setMsg('');
    try {
      const clean = prompts.filter((p) => String(p.prompt || '').trim());
      const r = await aivisSavePrompts(siteId, clean.map((p) => ({ id: p.id, prompt: p.prompt, intent: p.intent, source: p.source })));
      setPrompts((r.prompts || []).filter((p) => p.active !== false));
      setMsg('Saved.');
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const saveSettings = async (patch) => {
    setErr('');
    try { const r = await aivisSaveSettings(siteId, patch); setSt((s) => ({ ...s, settings: r.settings })); }
    catch (e) { setErr(e.message); }
  };

  // Cost is confirmed BEFORE anything is spent — never after.
  const askToRun = async () => {
    setBusy('estimate'); setErr(''); setMsg('');
    try { const r = await aivisEstimate(siteId); setConfirm(r.estimate); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const doRun = async () => {
    setConfirm(null); setBusy('run'); setErr('');
    try {
      const r = await aivisRunStart(siteId);
      setProgress({ done: 0, total: r.run?.items_total || 0 });
      // Drive the drain from here so the operator watches it finish; the cron
      // would pick it up anyway if this tab is closed mid-run.
      let guard = 0;
      for (;;) {
        const t = await aivisRunTick(r.run.id);
        setProgress({ done: t.done || 0, total: t.total || r.run.items_total || 0 });
        if (t.state !== 'running' || (t.remaining || 0) <= 0 || ++guard > 200) break;
      }
      setMsg('Measurement complete.');
      await load();
      onRan?.();
    } catch (e) { setErr(e.message); } finally { setBusy(''); setProgress(null); }
  };

  const runDiag = async () => {
    setBusy('diag'); setErr(''); setDiag(null);
    try { const r = await aivisDiag(); setDiag(r.providers || []); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const s = st?.settings || {};
  const providers = st?.providers || [];
  const ready = providers.filter((p) => p.ready);
  const lastRun = (st?.runs || [])[0];

  return html`<${Modal} title="AI search visibility" wide onClose=${onClose}>
    <div class="space-y-5">
      <p class="text-sm text-slate-600">
        We ask each AI assistant the questions your client's customers actually type, then record whether the business
        was named, whether it was linked to, and who got named instead. Results are stored for every run, so the
        month-over-month trend builds itself. <span class="font-semibold">This is a sample, not a ranking</span> — the
        report says so on the client's behalf.
      </p>

      ${err && html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700">${err}</div>`}
      ${msg && html`<div class="rounded-lg px-3 py-2 text-sm bg-emerald-50 text-emerald-700">${msg}</div>`}

      <!-- ── engines ────────────────────────────────────────────────────── -->
      <div>
        <div class="text-sm font-semibold text-slate-800 mb-1.5">Assistants</div>
        <div class="flex flex-wrap gap-2">
          ${providers.map((p) => html`
            <span class=${cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
              p.ready ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-500 ring-slate-400/20')}>
              <span class=${cx('h-1.5 w-1.5 rounded-full', p.ready ? 'bg-emerald-500' : 'bg-slate-400')}></span>
              ${p.label}${p.ready ? '' : ' — no key'}
            </span>`)}
        </div>
        <p class="text-xs text-slate-500 mt-1.5">
          An assistant with no key is skipped and reported as “not measured”, never as an absence.
          Add the key as an edge secret, then re-check below.
        </p>
        <div class="mt-2 flex items-center gap-2 flex-wrap">
          <${Btn} size="sm" variant="secondary" onClick=${runDiag} disabled=${busy === 'diag'}>
            ${busy === 'diag' ? 'Checking…' : 'Check every key now'}
          </${Btn}>
          ${lastRun && html`<span class="text-xs text-slate-400">
            Last run ${new Date(lastRun.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${lastRun.state} · ${lastRun.items_done}/${lastRun.items_total} asks
          </span>`}
        </div>
        ${diag && html`
          <div class="mt-2 space-y-1">
            ${diag.map((d) => html`
              <div class="flex items-start gap-2 text-xs rounded-lg px-2.5 py-1.5 bg-slate-50">
                <span class=${cx('font-semibold shrink-0', d.ok ? 'text-emerald-700' : 'text-rose-600')}>${d.ok ? '✓' : '✕'}</span>
                <span class="font-medium text-slate-700 shrink-0 w-40 truncate">${d.label}</span>
                <span class="text-slate-500 flex-1 min-w-0 break-words">
                  ${d.ok ? `${d.model} · ${d.ms}ms · ${d.sources ?? 0} sources` : (d.error || 'failed')}
                </span>
              </div>`)}
          </div>`}
      </div>

      <!-- ── cadence ────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <${Field} label="Asks per question" hint="Assistants are non-deterministic. More than one ask is what turns a yes/no into an honest rate.">
          <${Select} value=${String(s.repeats ?? 2)} onChange=${(v) => saveSettings({ repeats: Number(v) })}
            options=${[1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: `${v}×` }))} />
        </${Field}>
        <${Field} label="Monthly run day" hint="1–28.">
          <${Input} type="number" value=${String(s.run_day ?? 3)} onInput=${(v) => saveSettings({ runDay: Number(v) })} />
        </${Field}>
        <${Field} label="Automatic" hint="Run every month without being asked.">
          <div class="pt-2">
            <${Checkbox} checked=${s.auto_monthly !== false} onChange=${(v) => saveSettings({ autoMonthly: v })} label="Run monthly" />
          </div>
        </${Field}>
      </div>

      <!-- ── the prompt set ─────────────────────────────────────────────── -->
      <div>
        <div class="flex items-center justify-between gap-3 flex-wrap mb-1.5">
          <div class="text-sm font-semibold text-slate-800">
            The questions ${prompts.length > 0 && html`<span class="font-normal text-slate-400">· ${prompts.length}</span>`}
          </div>
          <div class="flex items-center gap-2">
            <${Btn} size="sm" variant="secondary" onClick=${suggest} disabled=${busy === 'suggest'}>
              ${busy === 'suggest' ? 'Thinking…' : '✨ Suggest from the brand kit'}
            </${Btn}>
            <${Btn} size="sm" variant="secondary" onClick=${addPrompt}>+ Add</${Btn}>
          </div>
        </div>
        <p class="text-xs text-slate-500 mb-2">
          Write them the way a customer types, not the way a marketer writes. Only the one “brand” question should name the
          business — the rest are there to find out whether it comes up unprompted.
        </p>
        ${prompts.length === 0 && html`<div class="text-sm text-slate-400 py-3">No questions yet — suggest a starting set, then edit it.</div>`}
        <div class="space-y-2">
          ${prompts.map((p, i) => html`
            <div class="flex items-start gap-2">
              <${Input} value=${p.prompt} onInput=${(v) => setPrompt(i, { prompt: v })} placeholder="best pool builder in ocala" class="flex-1" />
              <${Select} value=${p.intent || 'local'} onChange=${(v) => setPrompt(i, { intent: v })} options=${INTENTS} class="w-40 shrink-0 text-xs" />
              <button onClick=${() => removePrompt(i)} title="Remove"
                class="shrink-0 text-slate-300 hover:text-rose-600 px-2 min-h-[2.75rem] lg:min-h-0 flex items-center">✕</button>
            </div>`)}
        </div>
        <div class="mt-3 flex items-center gap-2 flex-wrap">
          <${Btn} onClick=${save} disabled=${busy === 'save'}>${busy === 'save' ? 'Saving…' : 'Save questions'}</${Btn}>
          <${Btn} variant="secondary" onClick=${askToRun} disabled=${!!busy || !prompts.length || !ready.length}>
            ${busy === 'estimate' ? 'Pricing…' : 'Run now'}
          </${Btn}>
          ${!ready.length && html`<span class="text-xs text-slate-400">Connect at least one assistant first.</span>`}
        </div>
      </div>

      <!-- ── the "notes" the section carries ────────────────────────────── -->
      <${Field} label="Note on the report (optional)" hint="Shown to the agency only — the client section carries its own method note.">
        <${Textarea} value=${s.notes || ''} rows=${2} onInput=${(v) => setSt((x) => ({ ...x, settings: { ...x.settings, notes: v } }))} />
      </${Field}>
      <${Btn} size="sm" variant="secondary" onClick=${() => saveSettings({ notes: s.notes || '' })}>Save note</${Btn}>

      <!-- ── run progress ───────────────────────────────────────────────── -->
      ${progress && html`
        <div class="rounded-xl border border-slate-200 p-3">
          <div class="flex items-baseline justify-between text-sm">
            <span class="text-slate-700">Asking the assistants…</span>
            <span class="tabular-nums text-slate-500">${progress.done} / ${progress.total}</span>
          </div>
          <div class="h-2 mt-1.5 rounded-full bg-slate-100">
            <div class="h-2 rounded-full bg-brand-600 transition-all" style=${`width:${Math.min(100, (progress.done / Math.max(1, progress.total)) * 100)}%`}></div>
          </div>
          <p class="text-xs text-slate-400 mt-1.5">Safe to close — the scheduler finishes anything left over.</p>
        </div>`}
    </div>

    <!-- Cost confirmation. Nothing is spent until this is accepted. -->
    ${confirm && html`
      <${Modal} title="Run this measurement?" onClose=${() => setConfirm(null)}>
        <div class="space-y-3">
          <p class="text-sm text-slate-600">
            ${confirm.prompts} question${confirm.prompts === 1 ? '' : 's'} × ${confirm.providers.length} assistant${confirm.providers.length === 1 ? '' : 's'}
            × ${confirm.repeats} ask${confirm.repeats === 1 ? '' : 's'} = <span class="font-semibold">${confirm.asks} answers</span>.
          </p>
          <div class="rounded-xl bg-slate-50 p-3">
            <div class="text-xs uppercase tracking-wide text-slate-400 font-semibold">Estimated API cost</div>
            <div class="text-2xl font-bold text-slate-800 tabular-nums">
              $${confirm.low.toFixed(2)} – $${confirm.high.toFixed(2)}
            </div>
            <div class="text-xs text-slate-500 mt-1">
              Charged by ${confirm.providers.map((p) => p.label).join(', ')}. Every call is logged to the agency cost panel.
            </div>
          </div>
          ${confirm.skipped?.length > 0 && html`
            <p class="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Not included: ${confirm.skipped.map((p) => p.label).join(', ')} — no API key yet.
            </p>`}
          <div class="flex gap-2">
            <${Btn} class="flex-1" onClick=${doRun}>Run it</${Btn}>
            <${Btn} variant="secondary" onClick=${() => setConfirm(null)}>Cancel</${Btn}>
          </div>
        </div>
      </${Modal}>`}
  </${Modal}>`;
}

export function Report() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const acct = activeAccount();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState('agency');
  const [months, setMonths] = useState('3');
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showAivis, setShowAivis] = useState(false);
  const [aivis, setAivis] = useState(null);
  const [gbp, setGbp] = useState(null);
  const [opps, setOpps] = useState(null);

  useEffect(() => { ensureVizCss(); }, []);
  useEffect(() => {
    if (!accountId) return;
    let dead = false;
    seoLoadSites().then((s) => { if (!dead) { setSites(s); if (!s.some((x) => x.id === siteId)) setSiteId(s[0]?.id || ''); } });
    return () => { dead = true; };
  }, [accountId]);

  const load = async () => {
    if (!accountId) return;
    setErr('');
    // Hold the previous render rather than flashing a skeleton on refetch.
    setLoading(true);
    try { setData(await reportSummary({ siteId: siteId || undefined, months: Number(months), view })); }
    catch (e) { setErr(e.message); setData(null); }
    finally { setLoading(false); }
  };
  // Fetched separately and never awaited by `load`: a slow or failing AI
  // measurement must not hold up (or take down) the money report.
  const loadAivis = async () => {
    if (!accountId) return;
    try { const r = await aivisSummary({ siteId: siteId || undefined, months: 6, view }); setAivis(r.section || null); }
    catch (_) { setAivis(null); }
  };

  // Same contract as loadAivis: its own function, its own failure. Google's
  // Performance API has small per-minute quotas, so a throttle here must cost
  // the profile section alone and never the report. Not keyed on siteId --
  // a Google Business Profile belongs to the BUSINESS, not to one website.
  const loadGbp = async () => {
    if (!accountId) return;
    try { const r = await gbpPerfSummary({ months: 13, view }); setGbp(r.section || null); }
    catch (_) { setGbp(null); }
  };

  useEffect(() => { load(); }, [accountId, siteId, months, view]);
  useEffect(() => { loadAivis(); }, [accountId, siteId, view]);
  // Opportunity finder: keyed on siteId, unlike GBP — it is entirely about
  // one website's Search Console history.
  const loadOpps = async () => {
    if (!accountId) return;
    try { const r = await oppsSummary({ siteId: siteId || undefined }); setOpps(r.section || null); }
    catch (_) { setOpps(null); }
  };

  useEffect(() => { loadGbp(); }, [accountId, view]);
  useEffect(() => { loadOpps(); }, [accountId, siteId]);

  const onAction = (kind) => {
    if (kind === 'jt') location.hash = '/jt';
    if (kind === 'terms') setShowTerms(true);
    if (kind === 'aivis') setShowAivis(true);
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create a business first.</div>`;

  const controls = html`
    <div class="flex flex-wrap items-center gap-2">
      ${sites.length > 1 && html`<${Select} value=${siteId} onChange=${setSiteId} class="text-sm w-auto"
        options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
      <${Select} value=${months} onChange=${setMonths} options=${WINDOWS} class="text-sm w-auto" />
      <div class="inline-flex rounded-xl border border-slate-300 overflow-hidden bg-white">
        ${[['agency', 'Agency'], ['client', 'Client']].map(([v, l]) => html`
          <button onClick=${() => setView(v)}
            class=${cx('px-3 py-2 text-sm font-semibold transition', view === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50')}>${l}</button>`)}
      </div>
      <${Btn} size="sm" variant="secondary" onClick=${() => setShowAivis(true)}>✨ AI visibility</${Btn}>
      <${Btn} size="sm" variant="secondary" onClick=${() => setShowTerms(true)}>Terms</${Btn}>
      <${Btn} size="sm" onClick=${() => setShowShare(true)}>Share ↗</${Btn}>
    </div>`;

  return html`
    <div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-800">Reporting</h1>
          <p class="text-sm text-slate-500">
            The whole picture in one page — spend, visibility, demand, booked work, revenue and profit.
          </p>
        </div>
        ${controls}
      </div>

      ${view === 'client' && html`
        <div class="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          You're previewing exactly what the client sees. Share links and emailed reports always send this view.
        </div>`}

      ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

      ${!data && loading && html`<div class="py-24 text-center text-sm text-slate-400">Building the report…</div>`}
      ${!data && !loading && !err && html`<div class="py-24 text-center text-sm text-slate-400">No report data yet.</div>`}
      ${data && html`<div class=${cx('transition-opacity', loading && 'opacity-60')}>
        <${ReportBody} data=${data} aivis=${aivis} gbp=${gbp} opps=${opps} onAction=${onAction} />
      </div>`}

      ${showShare && html`<${ShareModal} accountId=${accountId} siteId=${siteId} onClose=${() => setShowShare(false)} />`}
      ${showTerms && html`<${TermsModal} acct=${acct} onClose=${() => setShowTerms(false)} onSaved=${load} />`}
      ${showAivis && siteId && html`<${AivisModal} siteId=${siteId} onClose=${() => setShowAivis(false)} onRan=${loadAivis} />`}
      ${showAivis && !siteId && html`
        <${Modal} title="AI search visibility" onClose=${() => setShowAivis(false)}>
          <p class="text-sm text-slate-600">Add a website to this business first — the questions and results are tracked per site.</p>
        </${Modal}>`}
    </div>`;
}
