// ---------------------------------------------------------------------------
// autoblog.js — Blog Automation. Per-site cadence, auto keyword strategy,
// auto-publish to WordPress, and an optional approval → schedule flow.
// Approval OFF: a cron generates + publishes on cadence, hands-free.
// Approval ON: "Generate batch" → review → approve → auto-scheduled publishing.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadBriefs, seoAutoblogStatus, seoAutoblogSave, seoAutoblogPlanBatch, seoAutoblogGenerateOne, seoAutoblogApprove, seoAutoblogReject, seoAutoblogPublishOne, seoAutoblogRetry, seoAutoblogRemove, seoAutoblogEditPost, seoWpCategories, seoWpCreateCategory, seoSetBlogPriorities, seoBlogPrioritySuggestions } from './store.js';
import { Card, Btn, Select, Input, Textarea, Modal } from './ui.js';
import { mdRender } from './keywords.js';
import { BriefsLibrary } from './briefs.js';

const REJECT_REASONS = ['Off-topic / wrong angle', 'Weak or generic writing', 'Wrong tone or voice', 'Factually off', 'Not worth targeting'];

const CADENCE_OPTS = [[1, '1 / week'], [3, '3 / week'], [7, 'Daily'], [21, '3 / day']];
// Image sources are checkboxes now — pick any mix. The publisher always
// prioritizes customer photos first, then AI, then stock, using each source
// to fill whatever slots the one before it couldn't.
const IMG_OPTS = [
  ['client', '📷 Customer photos', 'real photos from the linked Job Tracker company'],
  ['ai', '✨ AI generated', 'kie.ai images tailored to the article'],
  ['stock', '🖼 Stock photos', 'Pexels, free'],
];
const PUB_OPTS = [{ value: 'publish', label: 'Publish live' }, { value: 'draft', label: 'Save as WP draft' }];
// status → [emoji, label, tone]
const SMETA = {
  planned: ['⏳', 'Planned', 'bg-slate-100 text-slate-600'],
  generating: ['✍️', 'Writing…', 'bg-amber-100 text-amber-700'],
  drafted: ['📄', 'Draft ready', 'bg-sky-100 text-sky-700'],
  pending_approval: ['👀', 'Needs approval', 'bg-amber-100 text-amber-700'],
  pending_client: ['📧', 'With the client', 'bg-violet-100 text-violet-700'],
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
  const [briefs, setBriefs] = useState(null);   // cached seo_briefs for this site
  const [preview, setPreview] = useState(null);  // { row, brief }
  const [pvBusy, setPvBusy] = useState(0);       // queueId being loaded/acted on
  const [reject, setReject] = useState(null);    // { id, keyword } — row being rejected
  const [cats, setCats] = useState(null);        // WP categories: null=loading, {list, outdated}
  const [newCat, setNewCat] = useState('');
  const [catBusy, setCatBusy] = useState(false);

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }).catch((e) => setErr(e.message)); }, [accountId]);

  const loadCats = (sid) => seoWpCategories(sid)
    .then((r) => setCats({ list: r.categories || [], outdated: !!r.plugin_outdated }))
    .catch(() => setCats({ list: [], outdated: false }));

  const load = async (sid) => {
    if (!sid) return;
    setErr('');
    try {
      const d = await seoAutoblogStatus(sid);
      setSt(d);
      const s = d.schedule || {};
      setCfg({ enabled: !!s.enabled, cadence_per_week: s.cadence_per_week || 3, approval_required: s.approval_required !== false && s.approval_required !== undefined ? !!s.approval_required : true, publish_mode: s.publish_mode || 'publish', image_sources: Array.isArray(s.image_sources) ? s.image_sources : (s.image_source && s.image_source !== 'none' ? [s.image_source] : ['stock']), client_approval_email: s.client_approval_email || '', client_approval_cc: s.client_approval_cc || '' });
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { if (site) { setSt(null); setCfg(null); setBriefs(null); setPreview(null); setCats(null); load(site); loadCats(site); } }, [site]);

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    setCatBusy(true); setErr('');
    try { await seoWpCreateCategory(site, name); setNewCat(''); await loadCats(site); setBanner(`Category “${name}” created on the WordPress site.`); }
    catch (e) { setErr(e.message); } finally { setCatBusy(false); }
  };

  const setRowCategory = async (q, v) => {
    setRowBusy(q.id); setErr('');
    try { await seoAutoblogEditPost(site, q.id, { category: v }); await load(site); }
    catch (e) { setErr(e.message); } finally { setRowBusy(0); }
  };

  const setC = (k, v) => setCfg((p) => ({ ...p, [k]: v }));

  // Load & open the written draft for a queue row (brief cluster === its keyword).
  const openPreview = async (row) => {
    setPvBusy(row.id); setErr('');
    try {
      let bs = briefs;
      if (!bs) { bs = await seoLoadBriefs(site); setBriefs(bs); }
      const brief = (bs || []).find((b) => b.cluster === row.keyword);
      if (!brief || !brief.content) { setErr('The written content for this post could not be loaded yet — try ↻ refresh.'); return; }
      setPreview({ row, brief });
    } catch (e) { setErr(e.message); } finally { setPvBusy(0); }
  };
  // Approve / reject / publish from inside the preview modal.
  const pvAct = async (fn, label) => {
    if (!preview) return;
    const id = preview.row.id;
    setPvBusy(id); setErr('');
    try { const r = await fn(site, id); if (label) setBanner(label(r)); setPreview(null); await load(site); }
    catch (e) { setErr(e.message); } finally { setPvBusy(0); }
  };
  // Save edited title/H1/meta/content back to the brief (blocked once live).
  const pvSave = async (patch) => {
    if (!preview) return false;
    const id = preview.row.id;
    setPvBusy(id); setErr('');
    try {
      const r = await seoAutoblogEditPost(site, id, patch);
      setBanner('Post updated — the edited version is what will publish.');
      setBriefs(null);
      setPreview((p) => (p ? { row: { ...p.row, title: patch.title || p.row.title }, brief: r.brief || { ...p.brief, ...patch } } : p));
      await load(site);
      return true;
    } catch (e) { setErr(e.message); return false; } finally { setPvBusy(0); }
  };

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
        setBriefs(null); await load(site);
      }
      setBanner(`Generated ${planned.length} draft(s) — click “read” to review, then approve.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); setProgress(''); }
  };

  const rowAct = async (fn, id, label, invalidate) => {
    setRowBusy(id); setErr(''); setBanner('');
    try { const r = await fn(site, id); if (label) setBanner(label(r)); if (invalidate) setBriefs(null); await load(site); }
    catch (e) { setErr(e.message); } finally { setRowBusy(0); }
  };

  // Reject with a reason (feeds the generator's learning; optionally blocks the keyword).
  const doReject = async (reason, markNeg) => {
    const id = reject?.id; if (!id) return;
    setReject(null); setPreview(null); setRowBusy(id); setErr(''); setBanner('');
    try {
      await seoAutoblogReject(site, id, reason, markNeg);
      setBanner(markNeg ? 'Rejected — and that keyword is now blocked from future blogging.' : 'Rejected. The generator will learn from this.');
      setBriefs(null); await load(site);
    } catch (e) { setErr(e.message); } finally { setRowBusy(0); }
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
        <h1 class="text-xl font-bold text-slate-800">Autoblogger 🤖</h1>
        <p class="text-sm text-slate-500">Auto-select strategic keywords, write on a cadence, and publish to WordPress — with optional approval.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((x) => ({ value: x.id, label: x.display_name || x.domain }))} />`}
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${st && !st.wp_connected && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-amber-50 text-amber-800">⚠ WordPress isn't connected for this site — connect the plugin in the <span class="font-medium">SEO</span> tab, or posts will only be written as drafts here, not published.</div>`}
    ${st?.schedule?.paused_reason && !st.schedule.enabled && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-amber-50 text-amber-800 border border-amber-200">
      <span class="font-medium">⏸ Autoblogging paused itself:</span> ${st.schedule.paused_reason}
      <span class="block text-xs mt-1 text-amber-700">Review the client's rejection feedback in the queue below, adjust the direction, then turn Automation back on and save — the rejection counter resets.</span>
    </div>`}

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

      <div>
        <label class="text-[11px] uppercase tracking-wide text-slate-400">Image sources</label>
        <div class="grid sm:grid-cols-3 gap-1.5 mt-1">
          ${IMG_OPTS.map(([id, label, hint]) => {
            const on = (cfg.image_sources || []).includes(id);
            const toggle = () => setC('image_sources', on ? (cfg.image_sources || []).filter((x) => x !== id) : [...(cfg.image_sources || []), id]);
            return html`<label class=${cx('flex items-start gap-2 px-2.5 py-2 rounded-lg border text-sm cursor-pointer', on ? 'border-brand-300 bg-brand-50/50 text-slate-800' : 'border-slate-200 text-slate-500')}>
              <input type="checkbox" checked=${on} onChange=${toggle} class="accent-brand-600 mt-0.5" />
              <span class="min-w-0"><span class="block">${label}</span><span class="block text-[10px] text-slate-400">${hint}</span></span>
            </label>`;
          })}
        </div>
        <p class="text-[11px] text-slate-400 mt-1">${(cfg.image_sources || []).length === 0
          ? 'No sources checked — posts publish without images.'
          : 'Customer photos are always used first; the other checked sources fill any slots left over.'}</p>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
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
            ? 'When on, the system auto-writes drafts on your cadence and holds them here for review — nothing publishes until you approve it. Approved posts then auto-schedule and publish themselves. (You can still generate a batch on demand.)'
            : 'Hands-free — the system writes and publishes on the cadence automatically. No review step.'}</span>
        </span>
      </label>

      <div class="rounded-lg border ${cfg.client_approval_email ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200'} p-3">
        <div class="text-sm font-medium text-slate-800">📧 Customer approval</div>
        <p class="text-xs text-slate-500 mt-0.5 mb-2">Enter the client's email and every finished article goes <span class="font-medium">straight to them</span> for review — they get a private link to read it, make light edits, and approve (publishes live instantly) or reject with feedback (a replacement is written automatically). 3 rejections in a row pause the autoblogger and alert your team. Leave empty to keep approvals in this dashboard.</p>
        <div class="grid sm:grid-cols-2 gap-3">
          <div><label class="text-[11px] uppercase tracking-wide text-slate-400">Customer approval email</label><${Input} type="email" value=${cfg.client_approval_email} onInput=${(v) => setC('client_approval_email', v)} placeholder="client@theirbusiness.com" class="mt-1" /></div>
          <div><label class="text-[11px] uppercase tracking-wide text-slate-400">CC <span class="normal-case">(optional)</span></label><${Input} type="email" value=${cfg.client_approval_cc} onInput=${(v) => setC('client_approval_cc', v)} placeholder="office@theirbusiness.com" class="mt-1" /></div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 flex-wrap pt-1">
        <div class="text-xs text-slate-400">${st?.keywords_available ?? 0} strategic keyword(s) available to write about.</div>
        <${Btn} onClick=${save} disabled=${!!busy}>${busy === 'save' ? 'Saving…' : 'Save settings'}</${Btn}>
      </div>
    </div></${Card}>

    <${PrioritiesCard} site=${site} schedule=${st?.schedule} onBanner=${setBanner} onSaved=${() => load(site)} />

    ${approval && cfg.enabled && html`<${Card}><div class="p-4 text-sm text-slate-600">
      <span class="font-medium text-amber-700">Auto-drafting is on.</span> The system checks every ~10 minutes and writes drafts on your cadence into the queue below for review — it keeps a rolling buffer ready and pauses new drafts once enough are waiting. Approve the ones you want and they auto-schedule and publish; <span class="font-medium">nothing posts until you approve it.</span> ${st?.schedule?.next_run_at ? `Next draft around ${when(st.schedule.next_run_at)}.` : ''}
    </div></${Card}>`}

    ${approval && html`<${Card}><div class="p-4 space-y-3">
      <div class="font-semibold text-slate-800">Generate a batch now</div>
      <p class="text-xs text-slate-400">On-demand: picks your most strategic un-written keywords and drafts them immediately. Approve the keepers — they'll auto-schedule at your cadence and publish themselves.</p>
      <div class="flex items-end gap-2 flex-wrap">
        <div><label class="text-[11px] text-slate-400">How many</label><${Input} type="number" min="1" max="14" value=${batchN} onInput=${(v) => setBatchN(Math.max(1, Math.min(14, Number(v) || 1)))} class="w-24" /></div>
        <${Btn} onClick=${runBatch} disabled=${!!busy}>${busy === 'batch' ? 'Working…' : `✍️ Generate ${batchN} draft(s)`}</${Btn}>
        ${progress && html`<span class="text-xs text-slate-500">${progress}</span>`}
      </div>
    </div></${Card}>`}

    ${!approval && cfg.enabled && html`<${Card}><div class="p-4 text-sm text-slate-600">
      <span class="font-medium text-emerald-700">Hands-free mode is on.</span> The system checks every ~10 minutes and, when this site is due, writes the next post and publishes it. ${st?.schedule?.next_run_at ? `Next post around ${when(st.schedule.next_run_at)}.` : ''} You can still see everything it does below.
    </div></${Card}>`}

    ${st?.wp_connected && html`<${Card}><div class="p-4">
      <div class="font-semibold text-slate-800">WordPress categories</div>
      <p class="text-xs text-slate-400 mt-0.5 mb-2">The AI files each new article into the best fit from these (you can override per article in the queue below). Posts with no category use the site's default.</p>
      ${cats === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
        ${cats.outdated && html`<div class="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">The site's connector plugin is older than 1.9.0 — categories appear here after it self-updates (within the hour).</div>`}
        <div class="flex flex-wrap gap-1.5 mb-2">
          ${cats.list.length === 0 && !cats.outdated && html`<span class="text-xs text-slate-400">No categories on this site yet — add one below.</span>`}
          ${cats.list.map((c) => html`<span class="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">🏷 ${c.name}${c.count ? html` <span class="text-slate-400">· ${c.count}</span>` : ''}</span>`)}
        </div>
        <div class="flex items-center gap-2">
          <${Input} value=${newCat} onInput=${setNewCat} placeholder="New category name (created on the WP site)" class="max-w-xs" />
          <${Btn} size="sm" onClick=${addCat} disabled=${catBusy || !newCat.trim()}>${catBusy ? 'Adding…' : '＋ Add'}</${Btn}>
        </div>`}
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
                <div class="text-sm text-slate-800 truncate">
                  ${q.title || q.keyword}
                  ${(q.cluster || '').startsWith('Competitor gap') && html` <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 align-middle" title=${q.cluster}>⚔️ ${q.cluster.replace('Competitor gap · ', 'gap vs ')}</span>`}
                </div>
                <div class="text-[11px] text-slate-400 truncate">
                  ${q.title ? `${q.keyword} · ` : ''}${q.status === 'approved' && q.scheduled_for ? `publishes ${when(q.scheduled_for)}` : ''}
                  ${q.status === 'published' && q.wp_link ? html`<a href=${q.wp_link} target="_blank" class="text-brand-600 hover:underline">view live ↗</a>` : ''}
                  ${q.status === 'failed' && q.error ? html`<span class="text-rose-500">${q.error}</span>` : ''}
                </div>
              </div>
              <div class="flex items-center gap-2 text-xs">
                ${b && html`<span class="text-slate-400">working…</span>`}
                ${!b && q.brief_id && q.status !== 'published' && (cats?.list?.length || q.category) && html`
                  <select value=${q.category || ''} onChange=${(e) => setRowCategory(q, e.target.value)} title="WordPress category"
                    class="text-[11px] border border-slate-200 rounded-md px-1 py-0.5 text-slate-500 bg-white max-w-[9rem]">
                    <option value="">🏷 default</option>
                    ${(cats?.list || []).map((c) => html`<option value=${c.name}>🏷 ${c.name}</option>`)}
                    ${q.category && !(cats?.list || []).some((c) => c.name === q.category) && html`<option value=${q.category}>🏷 ${q.category}</option>`}
                  </select>`}
                ${!b && q.status === 'published' && q.category && html`<span class="text-[11px] text-slate-400">🏷 ${q.category}</span>`}
                ${!b && q.brief_id && html`<button onClick=${() => openPreview(q)} class="text-brand-700 hover:underline">${pvBusy === q.id ? '…' : '📖 read'}</button>`}
                ${!b && ['planned', 'failed'].includes(q.status) && html`<button onClick=${() => rowAct(q.status === 'failed' ? seoAutoblogRetry : seoAutoblogGenerateOne, q.id, null, true)} class="text-brand-700 hover:underline">${q.status === 'failed' ? 'retry' : 'write it'}</button>`}
                ${!b && ['pending_approval', 'drafted'].includes(q.status) && html`
                  <button onClick=${() => rowAct(seoAutoblogApprove, q.id, (r) => r.gated ? (r.emailed ? 'Sent to the client for their approval — it publishes when they approve.' : 'Queued for client approval, but the email could not be sent — check the customer approval email.') : `Approved — publishes ${when(r.scheduled_for)}.`)} class="text-emerald-700 font-medium hover:underline">approve</button>
                  <button onClick=${() => setReject({ id: q.id, keyword: q.keyword })} class="text-slate-400 hover:text-rose-600">reject</button>`}
                ${!b && q.status === 'approved' && html`
                  <button onClick=${() => rowAct(seoAutoblogPublishOne, q.id, () => 'Published.')} class="text-emerald-700 hover:underline">publish now</button>
                  <button onClick=${() => setReject({ id: q.id, keyword: q.keyword })} class="text-slate-400 hover:text-rose-600">cancel</button>`}
                ${!b && ['planned', 'failed', 'rejected', 'drafted', 'pending_approval'].includes(q.status) && html`<button onClick=${() => rowAct(seoAutoblogRemove, q.id)} class="text-slate-300 hover:text-rose-600">✕</button>`}
              </div>
            </div>`;
          })}
        </div>`}
    </div></${Card}>`}

    ${site && html`<${BriefsLibrary} site=${site} />`}

    ${preview && html`<${PreviewModal} row=${preview.row} brief=${preview.brief} busy=${pvBusy === preview.row.id}
      onClose=${() => setPreview(null)}
      onApprove=${() => pvAct(seoAutoblogApprove, (r) => r.gated ? (r.emailed ? 'Sent to the client for their approval — it publishes when they approve.' : 'Queued for client approval, but the email could not be sent — check the customer approval email.') : `Approved — publishes ${when(r.scheduled_for)}.`)}
      onReject=${() => setReject({ id: preview.row.id, keyword: preview.row.keyword })}
      onPublish=${() => pvAct(seoAutoblogPublishOne, () => 'Published.')}
      onSave=${pvSave} />`}

    ${reject && html`<${RejectModal} keyword=${reject.keyword} onClose=${() => setReject(null)} onConfirm=${doReject} />`}
  </div>`;
}

// Capture WHY a draft was rejected — the reason trains the generator, and the
// optional toggle blocks the keyword from ever being written/auto-pulled again.
// What to write about first — ordered service + service-area priorities.
// Saved via its own RPC (the schedule table is server-only); the keyword
// picker BOOSTS matching topics by rank, it never filters — so an over-narrow
// list can't starve the blogger, it just stops steering once priorities are
// exhausted for the month.
function PrioritiesCard({ site, schedule, onBanner, onSaved }) {
  const [services, setServices] = useState([]);
  const [areas, setAreas] = useState([]);
  const [sug, setSug] = useState({ services: [], areas: [] });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setServices(Array.isArray(schedule?.priority_services) ? schedule.priority_services : []);
    setAreas(Array.isArray(schedule?.priority_areas) ? schedule.priority_areas : []);
    setDirty(false);
  }, [site, schedule?.updated_at]);
  useEffect(() => { if (site) seoBlogPrioritySuggestions(site).then(setSug).catch(() => setSug({ services: [], areas: [] })); }, [site]);
  const save = async () => {
    setBusy(true); setErr('');
    try { await seoSetBlogPriorities(site, services, areas); setDirty(false); onBanner('✅ Blog priorities saved — the next drafts will favor them, top of the list first.'); onSaved?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const List = ({ label, hint, items, setItems, suggestions, placeholder }) => {
    const [input, setInput] = useState('');
    const add = (v) => { const t = String(v || '').trim(); if (!t || items.some((x) => x.toLowerCase() === t.toLowerCase()) || items.length >= 12) return; setItems([...items, t]); setDirty(true); setInput(''); };
    const remove = (i) => { setItems(items.filter((_, j) => j !== i)); setDirty(true); };
    const up = (i) => { if (i === 0) return; const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setItems(n); setDirty(true); };
    const unused = suggestions.filter((s) => !items.some((x) => x.toLowerCase() === s.toLowerCase())).slice(0, 8);
    return html`<div>
      <label class="text-[11px] uppercase tracking-wide text-slate-400">${label}</label>
      <p class="text-[11px] text-slate-400 mb-1.5">${hint}</p>
      ${items.length > 0 && html`<div class="space-y-1 mb-2">
        ${items.map((it, i) => html`<div key=${it} class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5">
          <span class="text-xs font-bold text-brand-700 w-5 shrink-0">#${i + 1}</span>
          <span class="text-sm text-slate-700 truncate flex-1">${it}</span>
          ${i > 0 && html`<button onClick=${() => up(i)} title="Move up" class="text-slate-400 hover:text-brand-700 text-sm px-1">↑</button>`}
          <button onClick=${() => remove(i)} title="Remove" class="text-slate-400 hover:text-rose-600 text-sm px-1">✕</button>
        </div>`)}
      </div>`}
      <div class="flex gap-2">
        <input value=${input} onInput=${(e) => setInput(e.target.value)}
          onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
          placeholder=${placeholder} class="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <${Btn} size="sm" variant="secondary" onClick=${() => add(input)} disabled=${!input.trim()}>+ Add</${Btn}>
      </div>
      ${unused.length > 0 && html`<div class="flex flex-wrap gap-1.5 mt-2">
        ${unused.map((s) => html`<button key=${s} onClick=${() => add(s)}
          class="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50">+ ${s}</button>`)}
      </div>`}
    </div>`;
  };
  return html`<${Card}><div class="p-4 space-y-4">
    <div>
      <div class="font-semibold text-slate-800">🎯 What to write about first</div>
      <p class="text-xs text-slate-400 mt-0.5">Steer the autoblogger toward the services and areas that matter most right now. Order matters — #1 gets the strongest push. This boosts matching topics in the keyword strategy; it never blocks anything, so the blogger keeps writing even when a priority runs out of fresh topics.</p>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <${List} label="Priority services" hint="e.g. the service line you want more work for"
        items=${services} setItems=${setServices} suggestions=${sug.services} placeholder="e.g. chimney sweep" />
      <${List} label="Priority areas" hint="Cities or towns to favor in topics"
        items=${areas} setItems=${setAreas} suggestions=${sug.areas} placeholder="e.g. Gainesville" />
    </div>
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="text-[11px] text-slate-400">${services.length === 0 && areas.length === 0 ? 'No priorities set — the blogger picks purely on strategy scores.' : `${services.length} service(s), ${areas.length} area(s) prioritized.`}</div>
      <${Btn} size="sm" onClick=${save} disabled=${busy || !dirty}>${busy ? 'Saving…' : dirty ? 'Save priorities' : 'Saved'}</${Btn}>
    </div>
    ${err && html`<div class="text-xs text-rose-600">${err}</div>`}
  </div></${Card}>`;
}

function RejectModal({ keyword, onClose, onConfirm }) {
  const [sel, setSel] = useState('');
  const [note, setNote] = useState('');
  const [neg, setNeg] = useState(false);
  const pick = (r) => { setSel(r); if (r === 'Not worth targeting') setNeg(true); };
  const reason = [sel, note.trim()].filter(Boolean).join(' — ') || null;
  const footer = html`<div class="flex items-center justify-end gap-2">
    <${Btn} size="sm" onClick=${onClose}>Cancel</${Btn}>
    <${Btn} size="sm" variant="cta" onClick=${() => onConfirm(reason, neg)} disabled=${!sel && !note.trim()}>Reject</${Btn}>
  </div>`;
  return html`<${Modal} title="Reject this draft" onClose=${onClose} footer=${footer}>
    <div class="space-y-3 text-sm">
      <p class="text-xs text-slate-500">Tell the generator why — it learns from your reasons and stops repeating what you reject.</p>
      <div class="flex flex-wrap gap-2">${REJECT_REASONS.map((r) => html`<button onClick=${() => pick(r)} class=${cx('px-3 py-1.5 rounded-lg border text-sm', sel === r ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>${r}</button>`)}</div>
      <${Textarea} value=${note} onInput=${setNote} rows=${2} placeholder="Optional: a specific note on what to fix or avoid…" />
      ${keyword && html`<label class="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 p-2.5">
        <input type="checkbox" checked=${neg} onChange=${(e) => setNeg(e.target.checked)} class="accent-rose-600 w-4 h-4 mt-0.5" />
        <span><span class="font-medium text-slate-800">Also block “${keyword}” from future blogging</span><span class="block text-xs text-slate-500">Adds it to negative keywords — never auto-pulled or written again, at any opportunity score. Queues as a Google Ads negative too.</span></span>
      </label>`}
    </div>
  </${Modal}>`;
}

// Preview of a generated draft, with approve/reject/publish inline — plus an
// edit mode (title/H1/meta/markdown content) for anything not yet live.
function PreviewModal({ row, brief, busy, onClose, onApprove, onReject, onPublish, onSave }) {
  const st = row.status;
  const editable = st !== 'published';
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ title: brief.title || '', h1: brief.h1 || '', meta: brief.meta || '', content: brief.content || '' });
  const setF = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const dirty = d.title !== (brief.title || '') || d.h1 !== (brief.h1 || '') || d.meta !== (brief.meta || '') || d.content !== (brief.content || '');
  const save = async () => { if (await onSave(d)) setEdit(false); };
  const cancelEdit = () => { setD({ title: brief.title || '', h1: brief.h1 || '', meta: brief.meta || '', content: brief.content || '' }); setEdit(false); };

  const footer = edit
    ? html`<div class="flex items-center justify-end gap-2 flex-wrap">
        <span class="text-xs text-slate-400 mr-auto">Edits save to the draft — the edited version is what publishes.</span>
        <${Btn} size="sm" onClick=${cancelEdit} disabled=${busy}>Cancel</${Btn}>
        <${Btn} size="sm" variant="cta" onClick=${save} disabled=${busy || !dirty || !d.title.trim() || !d.content.trim()}>${busy ? 'Saving…' : '💾 Save changes'}</${Btn}>
      </div>`
    : html`<div class="flex items-center justify-end gap-2 flex-wrap">
        ${st === 'published' && brief.wp_link && html`<a href=${brief.wp_link} target="_blank" rel="noopener" class="text-sm text-brand-700 underline self-center mr-auto">view live ↗</a>`}
        ${editable && html`<${Btn} size="sm" onClick=${() => setEdit(true)} disabled=${busy}>✏️ Edit</${Btn}>`}
        ${['pending_approval', 'drafted'].includes(st) && html`<${Btn} size="sm" onClick=${onReject} disabled=${busy}>Reject</${Btn}>`}
        ${['pending_approval', 'drafted'].includes(st) && html`<${Btn} size="sm" variant="cta" onClick=${onApprove} disabled=${busy}>${busy ? 'Scheduling…' : '✓ Approve & schedule'}</${Btn}>`}
        ${st === 'approved' && html`<${Btn} size="sm" variant="cta" onClick=${onPublish} disabled=${busy}>${busy ? 'Publishing…' : 'Publish now'}</${Btn}>`}
        <${Btn} size="sm" onClick=${onClose}>Close</${Btn}>
      </div>`;

  return html`<${Modal} title=${edit ? `Editing: ${brief.title || row.keyword}` : (brief.title || row.keyword)} wide onClose=${onClose} footer=${footer}>
    <div class="space-y-3 text-sm">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">${String(brief.format || brief.page_type || 'blog').replace('_', ' ')}</span>
        ${brief.schema_type && html`<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Schema: ${brief.schema_type}</span>`}
        ${brief.slug && html`<span class="text-slate-400">/${brief.slug}</span>`}
        ${row.status === 'approved' && row.scheduled_for && html`<span class="text-emerald-700">🗓️ publishes ${new Date(row.scheduled_for).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>`}
      </div>
      ${edit ? html`
        <div class="space-y-2">
          <div><label class="text-[11px] font-semibold text-slate-400 uppercase">SEO Title</label><${Input} value=${d.title} onInput=${(v) => setF('title', v)} class="mt-0.5" /></div>
          <div><label class="text-[11px] font-semibold text-slate-400 uppercase">H1</label><${Input} value=${d.h1} onInput=${(v) => setF('h1', v)} class="mt-0.5" /></div>
          <div><label class="text-[11px] font-semibold text-slate-400 uppercase">Meta description</label><${Textarea} value=${d.meta} onInput=${(v) => setF('meta', v)} rows=${2} class="mt-0.5" /></div>
          <div>
            <label class="text-[11px] font-semibold text-slate-400 uppercase">Content (markdown)</label>
            <p class="text-[11px] text-slate-400 mb-0.5">Keep the <span class="font-medium">[IMAGE: …]</span> lines where you want photos — they're filled at publish time. Headings use ## / ###.</p>
            <${Textarea} value=${d.content} onInput=${(v) => setF('content', v)} rows=${18} class="mt-0.5 font-mono text-xs" />
          </div>
        </div>`
      : html`
        <div class="rounded-lg bg-slate-50 p-3 space-y-1">
          <div><span class="text-[11px] font-semibold text-slate-400 uppercase">SEO Title</span> <span class="text-slate-800">${brief.title}</span></div>
          ${brief.h1 && html`<div><span class="text-[11px] font-semibold text-slate-400 uppercase">H1</span> <span class="text-slate-800">${brief.h1}</span></div>`}
          <div><span class="text-[11px] font-semibold text-slate-400 uppercase">Meta</span> <span class="text-slate-600">${brief.meta}</span></div>
        </div>
        <div class="text-[11px] text-slate-400">📷 <span class="font-medium">[IMAGE: …]</span> markers below are filled with real photos at publish time, per your image setting.</div>
        <article class="space-y-2 max-h-[55vh] overflow-y-auto pr-1 border-t border-slate-100 pt-3">${mdRender(brief.content)}</article>
        ${(brief.external_links || []).length > 0 && html`<div class="pt-2 border-t border-slate-100 text-xs">
          <span class="font-semibold text-slate-400 uppercase">Authority sources</span>
          <ul class="list-disc ml-5 text-slate-600 mt-1">${brief.external_links.map((l) => html`<li><a href=${l.url} target="_blank" rel="noopener" class="text-brand-700 underline">${l.anchor}</a></li>`)}</ul>
        </div>`}`}
    </div>
  </${Modal}>`;
}
