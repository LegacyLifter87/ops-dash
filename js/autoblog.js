// ---------------------------------------------------------------------------
// autoblog.js — Blog Automation. Per-site cadence, auto keyword strategy,
// auto-publish to WordPress, and an optional approval → schedule flow.
// Approval OFF: a cron generates + publishes on cadence, hands-free.
// Approval ON: "Generate batch" → review → approve → auto-scheduled publishing.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoAutoblogStatus, seoAutoblogSave, seoAutoblogPlanBatch, seoAutoblogGenerateOne, seoAutoblogApprove, seoAutoblogReject, seoAutoblogPublishOne, seoAutoblogRetry, seoAutoblogRemove } from './store.js';
import { Card, Btn, Select, Input } from './ui.js';

const CADENCE_OPTS = [[1, '1 / week'], [3, '3 / week'], [7, 'Daily'], [21, '3 / day']];
const IMG_OPTS = [{ value: 'stock', label: 'Stock photos (Pexels, free)' }, { value: 'ai', label: 'AI-generated (uses credits)' }, { value: 'client', label: 'Client photos (Job Tracker)' }, { value: 'none', label: 'No images' }];
const PUB_OPTS = [{ value: 'publish', label: 'Publish live' }, { value: 'draft', label: 'Save as WP draft' }];
// status → [emoji, label, tone]
const SMETA = {
  planned: ['⏳', 'Planned', 'bg-slate-100 text-slate-600'],
  generating: ['✍️', 'Writing…', 'bg-amber-100 text-amber-700'],
  drafted: ['📄', 'Draft ready', 'bg-sky-100 text-sky-700'],
  pending_approval: ['👀', 'Needs approval', 'bg-amber-100 text-amber-700'],
  approved: ['🗓️', 'Scheduled', 'bg-emerald-100 text-emerald-700'],
  scheduled: ['🗓️', 'Scheduled', 'bg-emerald-100 text-emerald-700'],
  published: ['🌐', 'Published', 'bg-emerald-100 text-emerald-700'],
  failed: ['⚠️', 'Failed', 'bg-rose-100 text-rose-700'],
  rejected: ['🚫', 'Rejected', 'bg-slate-100 text-slate-500'],
};
const when = (iso) => { if (!iso) return ''; try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };

export function Autoblog() {
  useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [st, setSt] = useState(null);
  const [cfg, setCfg] = useState(null);        // editable config draft
  const [busy, setBusy] = useState('');
  const [rowBusy, setRowBusy] = useState(0);   // queueId currently working
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [batchN, setBatchN] = useState(5);
  const [progress, setProgress] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }).catch((e) => setErr(e.message)); }, [accountId]);

  const load = async (sid) => {
    if (!sid) return;
    setErr('');
    try {
      const d = await seoAutoblogStatus(sid);
      setSt(d);
      const s = d.schedule || {};
      setCfg({ enabled: !!s.enabled, cadence_per_week: s.cadence_per_week || 3, approval_required: s.approval_required !== false && s.approval_required !== undefined ? !!s.approval_required : true, publish_mode: s.publish_mode || 'publish', image_source: s.image_source || 'stock' });
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { if (site) { setSt(null); setCfg(null); load(site); } }, [site]);

  const setC = (k, v) => setCfg((p) => ({ ...p, [k]: v }));

  const save = async () => {
    // Live-publish + hands-free is the one combination worth confirming.
    if (cfg.enabled && !cfg.approval_required && cfg.publish_mode === 'publish'
      && !confirm(`Turn on hands-free auto-blogging?\n\nThe system will pick keywords, write ${cfg.cadence_per_week} post(s)/week and PUBLISH them LIVE to this client's site automatically — no review step.`)) return;
    setBusy('save'); setErr(''); setBanner('');
    try { await seoAutoblogSave(site, cfg); setBanner('Automation settings saved.'); await load(site); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const runBatch = async () => {
    setBusy('batch'); setErr(''); setBanner(''); setProgress('Selecting keywords…');
    try {
      const r = await seoAutoblogPlanBatch(site, batchN);
      const planned = r.planned || [];
      if (!planned.length) { setBanner(r.note || 'No new keywords to plan.'); setBusy(''); setProgress(''); await load(site); return; }
      await load(site);
      for (let i = 0; i < planned.length; i++) {
        setProgress(`Writing ${i + 1} of ${planned.length}: “${planned[i].keyword}”…`);
        try { await seoAutoblogGenerateOne(site, planned[i].id); } catch (_) { /* row marked failed server-side */ }
        await load(site);
      }
      setBanner(`Generated ${planned.length} draft(s) — review and approve below.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); setProgress(''); }
  };

  const rowAct = async (fn, id, label) => {
    setRowBusy(id); setErr(''); setBanner('');
    try { const r = await fn(site, id); if (label) setBanner(label(r)); await load(site); }
    catch (e) { setErr(e.message); } finally { setRowBusy(0); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading…</div>`;
  if (!sites.length) return html`<div class="max-w-5xl mx-auto p-6"><${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Google Search Console in the SEO tab to add a site first.</div></${Card}></div>`;

  const queue = st?.queue || [];
  const approval = cfg?.approval_required;
  const reviewables = queue.filter((q) => ['pending_approval', 'drafted', 'generating', 'planned'].includes(q.status));

  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Blog Automation 🤖</h1>
        <p class="text-sm text-slate-500">Auto-select strategic keywords, write on a cadence, and publish to WordPress — with optional approval.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((x) => ({ value: x.id, label: x.display_name || x.domain }))} />`}
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${st && !st.wp_connected && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-amber-50 text-amber-800">⚠ WordPress isn't connected for this site — connect the plugin in the <span class="font-medium">SEO</span> tab, or posts will only be written as drafts here, not published.</div>`}

    ${!cfg ? html`<div class="p-8 text-sm text-slate-400">Loading settings…</div>` : html`
    <${Card}><div class="p-4 space-y-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="font-semibold text-slate-800">Plan</div>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked=${cfg.enabled} onChange=${(e) => setC('enabled', e.target.checked)} class="accent-brand-600 w-4 h-4" />
          <span class=${cfg.enabled ? 'text-emerald-700 font-medium' : 'text-slate-500'}>${cfg.enabled ? 'Automation ON' : 'Automation off'}</span>
        </label>
      </div>

      <div>
        <label class="text-[11px] uppercase tracking-wide text-slate-400">Cadence</label>
        <div class="flex flex-wrap gap-2 mt-1">
          ${CADENCE_OPTS.map(([n, lbl]) => html`<button onClick=${() => setC('cadence_per_week', n)}
            class=${cx('px-3 py-1.5 rounded-lg border text-sm', cfg.cadence_per_week === n ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>${lbl}</button>`)}
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] uppercase tracking-wide text-slate-400">Images</label>
          <${Select} value=${cfg.image_source} onChange=${(v) => setC('image_source', v)} options=${IMG_OPTS} class="mt-1" />
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-wide text-slate-400">Publish as</label>
          <${Select} value=${cfg.publish_mode} onChange=${(v) => setC('publish_mode', v)} options=${PUB_OPTS} class="mt-1" />
        </div>
      </div>

      <label class="flex items-start gap-2 text-sm cursor-pointer rounded-lg border border-slate-200 p-3">
        <input type="checkbox" checked=${cfg.approval_required} onChange=${(e) => setC('approval_required', e.target.checked)} class="accent-brand-600 w-4 h-4 mt-0.5" />
        <span>
          <span class="font-medium text-slate-800">Require approval before publishing</span>
          <span class="block text-xs text-slate-500">${cfg.approval_required
            ? 'You generate a batch, review the drafts, and approve the ones to schedule. Nothing goes live without you.'
            : 'Hands-free — the system writes and publishes on the cadence automatically. No review step.'}</span>
        </span>
      </label>

      <div class="flex items-center justify-between gap-3 flex-wrap pt-1">
        <div class="text-xs text-slate-400">${st?.keywords_available ?? 0} strategic keyword(s) available to write about.</div>
        <${Btn} onClick=${save} disabled=${!!busy}>${busy === 'save' ? 'Saving…' : 'Save settings'}</${Btn}>
      </div>
    </div></${Card}>

    ${approval && html`<${Card}><div class="p-4 space-y-3">
      <div class="font-semibold text-slate-800">Generate a batch to review</div>
      <p class="text-xs text-slate-400">Picks your most strategic un-written keywords and drafts them. Approve the keepers — they'll auto-schedule at your cadence and publish themselves.</p>
      <div class="flex items-end gap-2 flex-wrap">
        <div><label class="text-[11px] text-slate-400">How many</label><${Input} type="number" min="1" max="14" value=${batchN} onInput=${(v) => setBatchN(Math.max(1, Math.min(14, Number(v) || 1)))} class="w-24" /></div>
        <${Btn} onClick=${runBatch} disabled=${!!busy}>${busy === 'batch' ? 'Working…' : `✍️ Generate ${batchN} draft(s)`}</${Btn}>
        ${progress && html`<span class="text-xs text-slate-500">${progress}</span>`}
      </div>
    </div></${Card}>`}

    ${!approval && cfg.enabled && html`<${Card}><div class="p-4 text-sm text-slate-600">
      <span class="font-medium text-emerald-700">Hands-free mode is on.</span> The system checks every ~10 minutes and, when this site is due, writes the next post and publishes it. ${st?.schedule?.next_run_at ? `Next post around ${when(st.schedule.next_run_at)}.` : ''} You can still see everything it does below.
    </div></${Card}>`}

    <${Card}><div class="p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-slate-800">Queue</div>
        <button onClick=${() => load(site)} class="text-xs text-slate-400 hover:text-slate-700">↻ refresh</button>
      </div>
      ${queue.length === 0 ? html`<div class="text-sm text-slate-400 py-4 text-center">Nothing queued yet.</div>` : html`
        <div class="divide-y divide-slate-50">
          ${queue.map((q) => {
            const [emoji, label, tone] = SMETA[q.status] || ['•', q.status, 'bg-slate-100 text-slate-500'];
            const b = rowBusy === q.id;
            return html`<div class="py-2.5 flex items-start gap-3 flex-wrap">
              <span class=${cx('text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5', tone)}>${emoji} ${label}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-slate-800 truncate">${q.title || q.keyword}</div>
                <div class="text-[11px] text-slate-400 truncate">
                  ${q.title ? `${q.keyword} · ` : ''}${q.status === 'approved' && q.scheduled_for ? `publishes ${when(q.scheduled_for)}` : ''}
                  ${q.status === 'published' && q.wp_link ? html`<a href=${q.wp_link} target="_blank" class="text-brand-600 hover:underline">view live ↗</a>` : ''}
                  ${q.status === 'failed' && q.error ? html`<span class="text-rose-500">${q.error}</span>` : ''}
                </div>
              </div>
              <div class="flex items-center gap-2 text-xs">
                ${b && html`<span class="text-slate-400">working…</span>`}
                ${!b && ['planned', 'failed'].includes(q.status) && html`<button onClick=${() => rowAct(q.status === 'failed' ? seoAutoblogRetry : seoAutoblogGenerateOne, q.id)} class="text-brand-700 hover:underline">${q.status === 'failed' ? 'retry' : 'write it'}</button>`}
                ${!b && ['pending_approval', 'drafted'].includes(q.status) && html`
                  <button onClick=${() => rowAct(seoAutoblogApprove, q.id, (r) => `Approved — publishes ${when(r.scheduled_for)}.`)} class="text-emerald-700 font-medium hover:underline">approve</button>
                  <button onClick=${() => rowAct(seoAutoblogReject, q.id)} class="text-slate-400 hover:text-rose-600">reject</button>`}
                ${!b && q.status === 'approved' && html`
                  <button onClick=${() => rowAct(seoAutoblogPublishOne, q.id, () => 'Published.')} class="text-emerald-700 hover:underline">publish now</button>
                  <button onClick=${() => rowAct(seoAutoblogReject, q.id)} class="text-slate-400 hover:text-rose-600">cancel</button>`}
                ${!b && ['planned', 'failed', 'rejected', 'drafted', 'pending_approval'].includes(q.status) && html`<button onClick=${() => rowAct(seoAutoblogRemove, q.id)} class="text-slate-300 hover:text-rose-600">✕</button>`}
              </div>
            </div>`;
          })}
        </div>`}
    </div></${Card}>`}
  </div>`;
}
