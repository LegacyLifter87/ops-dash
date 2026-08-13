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
import { useStore, getActiveAccountId, activeAccount, reportSummary, reportShareList, reportShareCreate, reportShareRevoke, reportSetTerms, seoLoadSites } from './store.js';
import { Card, Btn, Modal, Field, Input, Select } from './ui.js';
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
  useEffect(() => { load(); }, [accountId, siteId, months, view]);

  const onAction = (kind) => {
    if (kind === 'jt') location.hash = '/jt';
    if (kind === 'terms') setShowTerms(true);
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
        <${ReportBody} data=${data} onAction=${onAction} />
      </div>`}

      ${showShare && html`<${ShareModal} accountId=${accountId} siteId=${siteId} onClose=${() => setShowShare(false)} />`}
      ${showTerms && html`<${TermsModal} acct=${acct} onClose=${() => setShowTerms(false)} onSaved=${load} />`}
    </div>`;
}
