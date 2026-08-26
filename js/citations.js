// ---------------------------------------------------------------------------
// citations.js — Citation builder (Phase 1). Maintains one source-of-truth NAP
// profile (incl. former names), then scans major directories to find listings,
// compare each against the source of truth, and flag missing / inconsistent /
// stale-former-name citations with deep links to fix them. Push/sync = Phase 2.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { blPlan, blCreateCampaign, blRefreshLookup, blConfirm, seoCitationsLoad, seoCitationsSaveProfile, seoCitationsScan, seoCitationsRecheck, seoCitationsSetStatus, seoFbStatus, seoFbConnect, seoFbDisconnect, seoFbPages, seoFbSelectPage, seoFbGet, seoFbUpdate } from './store.js';

const STATUS_OPTS = [['todo', 'To do'], ['in_progress', 'In progress'], ['fixed', 'Fixed'], ['ignored', 'Ignored']];
const statusTone = (s) => s === 'fixed' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : s === 'in_progress' ? 'text-amber-700 border-amber-200 bg-amber-50' : s === 'ignored' ? 'text-slate-400 border-slate-200 bg-slate-50' : 'text-slate-600 border-slate-200 bg-white';
import { Card, Btn, Input, Select } from './ui.js';

// Facebook Page sync — connect, pick a Page, compare its NAP to the source of
// truth, edit and push. The first "able to sync" directory besides Google.
function FbSync({ truth, canRun }) {
  const [st, setSt] = useState(null);
  const [pages, setPages] = useState(null);
  const [page, setPage] = useState(null); // live page fields
  const [f, setF] = useState(null); // editable fields
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = async () => { try { const s = await seoFbStatus(); setSt(s); if (s.connected && s.page) loadPage(); } catch (e) { setErr(e.message); } };
  const loadPage = async () => { try { const d = await seoFbGet(); setPage(d.page); setF({ about: d.page.about, phone: d.page.phone, website: d.page.website }); } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, []);

  const connect = async () => { setBusy('c'); setErr(''); try { const d = await seoFbConnect(); location.href = d.url; } catch (e) { setErr(e.message); setBusy(''); } };
  const disconnect = async () => { if (!confirm('Disconnect Facebook?')) return; try { await seoFbDisconnect(); setSt(null); setPages(null); setPage(null); setF(null); await load(); } catch (e) { setErr(e.message); } };
  const listPages = async () => { setBusy('p'); setErr(''); try { const d = await seoFbPages(); setPages(d.pages || []); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const choose = async (id) => { setBusy('s'); setErr(''); try { await seoFbSelectPage(id); setPages(null); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const push = async () => { setBusy('w'); setErr(''); setOk(''); try { await seoFbUpdate(f); setOk('Pushed live to the Facebook Page.'); await loadPage(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const fromTruth = () => { setF((p) => ({ ...p, phone: truth?.phone || p.phone, website: truth?.website || p.website })); setOk(''); };

  const set = (k) => (v) => { setF((p) => ({ ...p, [k]: v })); setOk(''); };
  const mismatch = (a, b) => a && b && String(a).replace(/\D/g, '').slice(-10) !== String(b).replace(/\D/g, '').slice(-10);

  if (!st) return null;

  return html`<${Card}><div class="p-4 space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="font-semibold text-slate-800">Facebook Page sync ${st.connected && st.page ? html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-1">● ${st.page.name}</span>` : ''}</div>
        <div class="text-xs text-slate-400">Two-way: read the Page's listing info, edit it here, push it live.</div>
      </div>
      ${!st.connected
        ? (canRun ? html`<${Btn} size="sm" onClick=${connect} disabled=${busy === 'c'}>${busy === 'c' ? 'Redirecting…' : 'Connect Facebook'}</${Btn}>` : html`<span class="text-xs text-slate-400">Ask an admin to connect.</span>`)
        : html`<button onClick=${disconnect} class="text-xs text-slate-400 hover:text-rose-600 underline">Disconnect</button>`}
    </div>
    ${st.expired && html`<div class="text-xs text-amber-600">Facebook session expired — reconnect to refresh it.</div>`}

    ${st.connected && !st.page && html`<div>
      ${!pages ? html`<${Btn} size="sm" variant="secondary" onClick=${listPages} disabled=${busy === 'p'}>${busy === 'p' ? 'Loading…' : 'Choose your Page'}</${Btn}>`
        : pages.length === 0 ? html`<div class="text-sm text-slate-500">No Pages found on this Facebook account.</div>`
          : html`<div class="space-y-1">${pages.map((p) => html`<button onClick=${() => choose(p.id)} disabled=${busy === 's'} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50/40">
              <div class="text-sm font-medium text-slate-800">${p.name}</div><div class="text-xs text-slate-400">${p.category}</div>
            </button>`)}</div>`}
    </div>`}

    ${st.connected && st.page && f && html`<div class="pt-1 space-y-2">
      ${(mismatch(page?.phone, truth?.phone) || (truth?.website && page?.website && !String(page.website).includes(String(truth.website).replace(/^https?:\/\//, '').replace(/\/.*/, '')))) && html`
        <div class="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">This Page's info differs from your source of truth. <button onClick=${fromTruth} class="underline font-medium">Copy phone & website from source of truth</button></div>`}
      <div>
        <label class="text-[11px] text-slate-400">About <span class="text-slate-300">(${(f.about || '').length}/255)</span></label>
        <textarea value=${f.about} onInput=${(e) => set('about')(e.target.value)} rows="2" maxlength="255" class="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-400 focus:ring-1 focus:ring-brand-300 outline-none"></textarea>
      </div>
      <div class="grid sm:grid-cols-2 gap-2">
        <div><label class="text-[11px] text-slate-400">Phone ${mismatch(page?.phone, truth?.phone) ? html`<span class="text-amber-600">≠ source of truth</span>` : ''}</label><${Input} value=${f.phone} onInput=${set('phone')} /></div>
        <div><label class="text-[11px] text-slate-400">Website</label><${Input} value=${f.website} onInput=${set('website')} /></div>
      </div>
      <div class="flex items-center gap-2">
        ${canRun && html`<${Btn} size="sm" onClick=${push} disabled=${busy === 'w'}>${busy === 'w' ? 'Pushing…' : 'Push to Facebook'}</${Btn}>`}
        ${page?.link && html`<a href=${page.link} target="_blank" rel="noopener" class="text-xs text-brand-700 hover:underline">View Page ↗</a>`}
        ${ok && html`<span class="text-xs text-emerald-600">✓ ${ok}</span>`}
      </div>
      ${page?.address && html`<div class="text-[11px] text-slate-400">Listed address: ${page.address} · address edits are managed on Facebook directly.</div>`}
    </div>`}
    ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
  </div></${Card}>`;
}

const Field = ({ label, value, onInput, placeholder, wide }) => html`<div class=${wide ? 'sm:col-span-2' : ''}>
  <label class="text-[11px] text-slate-400">${label}</label>
  <${Input} value=${value || ''} onInput=${onInput} placeholder=${placeholder || ''} />
</div>`;

// BrightLocal citation building. The ONLY place in this app that spends money
// and publishes a client's details to third parties, so the whole component is
// arranged around making that unmissable rather than convenient:
//   - what will be submitted is shown BEFORE the order, field by field
//   - where it disagrees with our own records is called out, not buried
//   - the order button states the cost and cannot be reached without reading it
//   - the reviewed details are hashed; if they change, the server refuses
function BrightLocalBuilder() {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [pkg, setPkg] = useState('cb25');
  const [pubs, setPubs] = useState(['dataaxle']);
  const [auto, setAuto] = useState(true);
  const [picked, setPicked] = useState([]);
  const [dupes, setDupes] = useState(true);
  const [express, setExpress] = useState(false);
  const [notes, setNotes] = useState('');
  const [showDirs, setShowDirs] = useState(false);

  const load = () => blPlan().then(setPlan).catch((e) => {
    if (/unknown action/i.test(e.message || '')) setPlan({ pending: true });
    else { setErr(e.message); setPlan({}); }
  });
  useEffect(() => { load(); }, []);

  const start = async () => {
    setBusy('start'); setErr(''); setOk('');
    try { await blCreateCampaign(); await load(); setOk('Campaign started. Nothing has been ordered or charged yet.'); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const recheck = async () => {
    setBusy('look'); setErr('');
    try { await blRefreshLookup(plan.campaign.campaign_id); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const listings = ({ cb0: 0, cb10: 10, cb15: 15, cb25: 25, cb30: 30, cb50: 50, cb75: 75, cb100: 100 })[pkg] ?? 0;
  const credits = plan?.credits ?? 0;
  const shortBy = Math.max(0, listings - credits);

  const order = async () => {
    const nap = plan?.nap?.submitting || {};
    const lines = [
      'This spends credits and submits these details to public directories.',
      '',
      `Business:  ${nap.name}`,
      `Address:   ${[nap.street, nap.city, nap.state, nap.zip].filter(Boolean).join(', ')}`,
      `Phone:     ${nap.phone || '—'}`,
      '',
      `Package:   ${pkg} (${listings} listing${listings === 1 ? '' : 's'})`,
      `Sent to:   ${pubs.join(', ')}`,
      auto ? 'Directories: chosen automatically by BrightLocal' : `Directories: ${picked.length} chosen by hand`,
      '',
      'Listings are slow and awkward to correct once published.',
      '',
      'Order this now?',
    ];
    if (!confirm(lines.join('\n'))) return;
    setBusy('order'); setErr(''); setOk('');
    try {
      const r = await blConfirm({
        campaignId: plan.campaign.campaign_id,
        packageId: pkg,
        publishers: pubs,
        autoSelect: auto,
        citations: auto ? [] : picked,
        removeDuplicates: dupes,
        express,
        notes: notes.trim() || undefined,
        napHash: plan.nap.hash,
      });
      setOk(`Ordered — ${r.listings} listing${r.listings === 1 ? '' : 's'} submitted for building.`);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (plan === null) return html`<${Card}><div class="p-4 text-sm text-slate-400">Loading citation builder…</div></${Card}>`;
  if (plan.pending) return null;
  if (plan.ready === false && plan.reason === 'no_location') {
    return html`<${Card}><div class="p-4">
      <div class="font-semibold text-slate-800 mb-1">🏗 Build citations</div>
      <div class="text-sm text-slate-500">${plan.message}</div>
    </div></${Card}>`;
  }

  const nap = plan.nap || {};
  const diffs = (nap.diff || []).filter((d) => d.status === 'differs');
  const unknowns = (nap.diff || []).filter((d) => d.status === 'unknown');
  const lk = plan.lookup;

  return html`<${Card}><div class="p-4 space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="font-semibold text-slate-800">🏗 Build citations <span class="text-xs font-normal text-slate-400">— BrightLocal</span></div>
      <span class=${cx('text-[11px] px-2 py-0.5 rounded-full', credits > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
        ${credits > 0 ? `${credits} credits` : 'no credits'}
      </span>
    </div>

    <!-- What would actually be sent. Shown before anything can be ordered. -->
    <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">What gets submitted</div>
      <div class="space-y-1">
        ${(nap.diff || []).map((d) => html`
          <div class="flex items-baseline justify-between gap-3 text-sm">
            <span class="text-slate-400 capitalize w-20 shrink-0">${d.field}</span>
            <span class="flex-1 text-slate-800 truncate">${d.theirs || html`<span class="text-slate-300">not set</span>`}</span>
            ${d.status === 'differs' && html`<span class="shrink-0 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5">we have "${d.ours}"</span>`}
          </div>`)}
      </div>
      ${diffs.length > 0 && html`<div class="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
        ${diffs.length} detail${diffs.length === 1 ? '' : 's'} disagree with our own record${nap.ours?.source ? ` (${nap.ours.source})` : ''}.
        Fix it in BrightLocal before ordering — this is what will be published.
      </div>`}
      ${diffs.length === 0 && unknowns.length > 0 && html`<div class="mt-2 text-[11px] text-slate-400">
        ${unknowns.length} field${unknowns.length === 1 ? '' : 's'} we have nothing to compare against — check them by eye.
      </div>`}
    </div>

    <!-- Existing listings and their accuracy. Free, and useful on its own. -->
    ${lk && html`<div class="rounded-xl border border-slate-200 p-3">
      <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Already listed</div>
        <button onClick=${recheck} disabled=${busy === 'look'} class="text-[11px] text-slate-400 hover:text-slate-700 underline">${busy === 'look' ? 'checking…' : 'check again'}</button>
      </div>
      ${lk.status === 'processing'
        ? html`<div class="text-sm text-slate-500">BrightLocal is still scanning directories…</div>`
        : html`
          <div class="text-sm text-slate-700">Found on <span class="font-semibold">${lk.found}</span> director${lk.found === 1 ? 'y' : 'ies'}.</div>
          ${Object.entries(lk.mismatches || {}).some(([, n]) => n > 0) && html`
            <div class="text-xs text-slate-500 mt-1">
              Disagreeing with the profile:
              ${Object.entries(lk.mismatches).filter(([, n]) => n > 0).map(([f, n]) => html`<span class="ml-1 text-amber-700">${n} ${f}</span>`)}
            </div>`}
          ${(lk.citations || []).length > 0 && html`<details class="mt-2">
            <summary class="text-[11px] text-slate-400 cursor-pointer">See the listings</summary>
            <div class="space-y-1 mt-1.5">
              ${lk.citations.slice(0, 25).map((c) => html`
                <div class="flex items-baseline justify-between gap-3 text-[13px]">
                  <a href=${c.profile_url} target="_blank" rel="noopener noreferrer" class="truncate text-brand-700 hover:underline">${c.domain}</a>
                  <span class="shrink-0 text-[11px]">
                    ${c.matching_results
                      ? Object.entries(c.matching_results).filter(([, v]) => v === false).map(([f]) => html`<span class="text-amber-700 ml-1">${f} differs</span>`)
                      : html`<span class="text-slate-300">no details</span>`}
                  </span>
                </div>`)}
            </div>
          </details>`}`}
    </div>`}

    ${!plan.campaign ? html`
      <div>
        <div class="text-sm text-slate-600 mb-2">No campaign started for this business yet. Starting one is free — it scans directories and prepares the order without charging anything.</div>
        ${plan.canOrder
          ? html`<${Btn} size="sm" variant="secondary" onClick=${start} disabled=${busy === 'start'}>${busy === 'start' ? 'Starting…' : 'Start a campaign'}</${Btn}>`
          : html`<div class="text-sm text-slate-500">An agency owner needs to start it.</div>`}
      </div>`
    : html`
      <div class="rounded-xl border border-slate-200 p-3 space-y-3">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">The order</div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">How many listings</div>
            <${Select} value=${pkg} onChange=${(e) => setPkg(e.target.value)}>
              ${(plan.packages || []).map((p) => html`<option value=${p.id}>${p.listings === 0 ? 'Aggregators only (no listings)' : `${p.listings} listings`}</option>`)}
            </${Select}>
          </div>
          <div>
            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Data aggregators</div>
            <div class="flex flex-wrap gap-x-3 gap-y-1 pt-1.5">
              ${(plan.availablePublishers || []).map((p) => html`
                <label class="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked=${pubs.includes(p)}
                    onChange=${(e) => setPubs((v) => e.target.checked ? [...v, p] : v.filter((x) => x !== p))} />
                  ${p}
                </label>`)}
            </div>
          </div>
        </div>

        ${listings > 0 && html`<div>
          <label class="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked=${auto} onChange=${(e) => setAuto(e.target.checked)} />
            Let BrightLocal choose the directories
          </label>
          ${!auto && html`<div class="mt-2">
            <button onClick=${() => setShowDirs((v) => !v)} class="text-xs text-brand-700 underline">
              ${showDirs ? 'Hide' : 'Choose'} directories (${picked.length} selected)
            </button>
            ${showDirs && html`<div class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              ${(plan.availableCitations || []).map((d) => html`
                <label class="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked=${picked.includes(d)}
                    onChange=${(e) => setPicked((v) => e.target.checked ? [...v, d] : v.filter((x) => x !== d))} />
                  <span class="truncate">${d}</span>
                </label>`)}
            </div>`}
          </div>`}
        </div>`}

        <div class="flex flex-wrap gap-x-4 gap-y-1">
          <label class="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked=${dupes} onChange=${(e) => setDupes(e.target.checked)} /> Find and remove duplicate listings
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked=${express} onChange=${(e) => setExpress(e.target.checked)} /> Express (submitted within 24h)
          </label>
        </div>

        <div>
          <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Notes for BrightLocal&#39;s submissions team (optional)</div>
          <${Input} value=${notes} onInput=${(e) => setNotes(e.target.value)} placeholder="Anything specific about how this should be handled" />
        </div>

        ${shortBy > 0 && listings > 0 && html`<div class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Not enough credits: this needs ${listings}, the account has ${credits}. Buy ${shortBy} more in BrightLocal to order.
        </div>`}

        <div class="border-t border-slate-200 pt-3">
          <div class="text-xs text-slate-500 mb-2">
            ${listings > 0
              ? html`Ordering spends <span class="font-semibold text-slate-700">${listings} credit${listings === 1 ? '' : 's'}</span> and publishes the details above to ${auto ? 'directories BrightLocal selects' : `${picked.length} chosen director${picked.length === 1 ? 'y' : 'ies'}`}.`
              : html`Aggregators only — no directory listings, so no citation credits are spent.`}
          </div>
          ${plan.canOrder
            ? html`<${Btn} size="sm" variant="cta" onClick=${order}
                disabled=${busy === 'order' || (listings > 0 && shortBy > 0) || !pubs.length || diffs.length > 0}>
                ${busy === 'order' ? 'Ordering…' : listings > 0 ? `Order ${listings} listings` : 'Submit to aggregators'}
              </${Btn}>`
            : html`<div class="text-sm text-slate-500">Only an agency owner can place the order.</div>`}
          ${diffs.length > 0 && html`<div class="text-[11px] text-amber-700 mt-1.5">Ordering is blocked while the details disagree with our record — fix them in BrightLocal first.</div>`}
        </div>
      </div>`}

    ${ok && html`<div class="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">${ok}</div>`}
    ${err && html`<div class="text-xs text-rose-600">${err}</div>`}
  </div></${Card}>`;
}

export function Citations({ siteId, domain, canRun = true }) {
  const [f, setF] = useState(null);
  const [cites, setCites] = useState([]);
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [noteFor, setNoteFor] = useState('');

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    setF(null); setCites([]); setErr(''); setLoaded(false); setSeeded(false);
    if (!siteId) return;
    let cancelled = false;
    seoCitationsLoad(siteId).then((d) => {
      if (cancelled) return;
      const p = d.profile || { website: domain };
      setF({ ...p, former_names: Array.isArray(p.former_names) ? p.former_names.join(', ') : (p.former_names || '') });
      setCites(d.citations || []); setSeeded(!!d.seeded); setLoaded(true);
    }).catch((e) => { if (!cancelled) { setErr(e.message); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [siteId]);

  const save = async () => { setBusy('save'); setErr(''); try { const d = await seoCitationsSaveProfile(siteId, f); const p = d.profile; setF({ ...p, former_names: (p.former_names || []).join(', ') }); setSeeded(false); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const patchLocal = (domain, patch) => setCites((p) => p.map((c) => (c.directory_domain === domain ? { ...c, ...patch } : c)));
  const setStatus = async (c, status) => { patchLocal(c.directory_domain, { status }); try { await seoCitationsSetStatus(siteId, c.directory_domain, { status }); } catch (e) { setErr(e.message); } };
  const saveNotes = async (c, notes) => { patchLocal(c.directory_domain, { notes }); setNoteFor(''); try { await seoCitationsSetStatus(siteId, c.directory_domain, { notes }); } catch (e) { setErr(e.message); } };
  const recheck = async (c) => { setBusy('re:' + c.directory_domain); setErr(''); try { const d = await seoCitationsRecheck(siteId, c.directory_domain); patchLocal(c.directory_domain, d.citation); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const scan = async () => {
    if (!f?.business_name?.trim()) { setErr('Enter and save your business name first.'); return; }
    setBusy('scan'); setErr('');
    try { if (seeded) { await seoCitationsSaveProfile(siteId, f); setSeeded(false); } const d = await seoCitationsScan(siteId); setCites(d.citations || []); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!f && !loaded) return html`<div class="p-6 text-sm text-slate-400">Loading…</div>`;

  const found = cites.filter((c) => c.found);
  const consistent = found.filter((c) => c.name_match && c.phone_match !== false);
  const stale = cites.filter((c) => c.is_former_name);
  const issueCount = cites.reduce((a, c) => a + ((c.issues || []).length), 0);
  const missing = cites.filter((c) => !c.found);

  return html`<div class="space-y-4">
    <${Card}><div class="p-4">
      <div class="flex items-center justify-between mb-2">
        <div><span class="font-semibold text-slate-800">Source of truth</span> <span class="text-xs text-slate-400">— the exact NAP every listing should match</span></div>
        ${canRun && html`<${Btn} size="sm" variant="secondary" onClick=${save} disabled=${busy === 'save'}>${busy === 'save' ? 'Saving…' : 'Save'}</${Btn}>`}
      </div>
      ${seeded && html`<div class="text-[11px] text-emerald-700 bg-emerald-50 rounded px-2 py-1 mb-2">Prefilled from your Google Business Profile audit — review and Save.</div>`}
      <div class="grid sm:grid-cols-2 gap-2">
        <${Field} label="Business name" value=${f.business_name} onInput=${set('business_name')} placeholder="Acme Home Repair" />
        <${Field} label="Former names (comma-separated)" value=${f.former_names} onInput=${set('former_names')} placeholder="Old Name LLC, Previous Brand" />
        <${Field} label="Street" value=${f.street} onInput=${set('street')} placeholder="123 Main St" wide=${true} />
        <${Field} label="City" value=${f.city} onInput=${set('city')} placeholder="Ocala" />
        <div class="grid grid-cols-2 gap-2">
          <${Field} label="State" value=${f.state} onInput=${set('state')} placeholder="FL" />
          <${Field} label="ZIP" value=${f.zip} onInput=${set('zip')} placeholder="34474" />
        </div>
        <${Field} label="Phone" value=${f.phone} onInput=${set('phone')} placeholder="(352) 555-0199" />
        <${Field} label="Website" value=${f.website} onInput=${set('website')} placeholder=${domain || 'example.com'} />
      </div>
      <div class="flex items-center gap-2 mt-3">
        ${canRun && html`<${Btn} size="sm" onClick=${scan} disabled=${busy === 'scan'}>${busy === 'scan' ? 'Scanning directories…' : (cites.length ? '↻ Re-scan citations' : 'Scan citations')}</${Btn}>`}
        <span class="text-[11px] text-slate-400">Searches ~16 major directories for your listings.</span>
      </div>
      ${err && html`<div class="text-sm text-rose-600 mt-2">${err}</div>`}
      ${busy === 'scan' && html`<div class="text-xs text-slate-400 mt-1">Searching directories & matching your name/phone — ~15s.</div>`}
    </div></${Card}>

    <${FbSync} truth=${f} canRun=${canRun} />

    ${cites.length > 0 && html`
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${[['Listings found', `${found.length}/${cites.length}`], ['Consistent', `${consistent.length}/${found.length || 0}`], ['Former-name listings', String(stale.length)], ['Issues to fix', String(issueCount)]]
          .map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div></div></${Card}>`)}
      </div>

      <${Card}><div class="p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div class="font-semibold text-slate-800">Directory listings</div>
          <div class="flex items-center gap-1">
            ${[['all', 'All'], ['issues', 'Needs work'], ['in_progress', 'In progress'], ['fixed', 'Fixed']].map(([id, label]) => html`
              <button onClick=${() => setFilter(id)} class=${cx('px-2.5 py-1 rounded-full text-xs border', filter === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>${label}</button>`)}
          </div>
        </div>
        <div class="divide-y divide-slate-50">
          ${cites.filter((c) => filter === 'all' ? true
            : filter === 'issues' ? (((c.issues || []).length > 0 || !c.found) && !['fixed', 'ignored'].includes(c.status))
              : c.status === filter)
            .map((c) => html`<div class=${cx('py-2.5', ['fixed', 'ignored'].includes(c.status) && 'opacity-55')}>
            <div class="flex items-start gap-3">
              <span class=${cx('shrink-0 w-2.5 h-2.5 rounded-full mt-1.5', c.found ? (c.is_former_name ? 'bg-rose-500' : c.name_match && c.phone_match !== false ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-slate-200')}></span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-800">${c.directory}
                  ${c.found
                    ? (c.is_former_name ? html`<span class="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">former name</span>`
                      : c.name_match && c.phone_match !== false ? html`<span class="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">consistent</span>`
                        : html`<span class="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">check</span>`)
                    : html`<span class="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">not found</span>`}
                </div>
                ${(c.issues || []).map((i) => html`<div class="text-xs text-slate-500">• ${i.msg}${i.fix ? html` — <span class="text-slate-400">${i.fix}</span>` : ''}</div>`)}
                ${!c.found && html`<div class="text-xs text-slate-400">No listing detected — an opportunity to build this citation.</div>`}
                ${c.notes && noteFor !== c.directory_domain && html`<div class="text-xs text-sky-700 mt-0.5">🗒 ${c.notes}</div>`}
                ${noteFor === c.directory_domain && html`<input autofocus value=${c.notes || ''}
                  onBlur=${(e) => saveNotes(c, e.target.value.trim())}
                  onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setNoteFor(''); }}
                  placeholder="add a note… (Enter to save)" class="mt-1 w-full max-w-sm text-xs px-2 py-1 rounded border border-slate-300 focus:border-brand-400 outline-none" />`}
              </div>
              <div class="shrink-0 flex items-center gap-1.5">
                ${canRun && html`<select value=${c.status || 'todo'} onChange=${(e) => setStatus(c, e.target.value)}
                  class=${cx('text-[11px] rounded-md border px-1.5 py-1 outline-none', statusTone(c.status || 'todo'))}>
                  ${STATUS_OPTS.map(([v, l]) => html`<option value=${v}>${l}</option>`)}
                </select>`}
                ${canRun && html`<button title="Add note" onClick=${() => setNoteFor(noteFor === c.directory_domain ? '' : c.directory_domain)} class="text-slate-400 hover:text-slate-700 text-sm">✎</button>`}
                ${canRun && html`<button title="Re-check this directory" onClick=${() => recheck(c)} disabled=${busy === 're:' + c.directory_domain} class="text-slate-400 hover:text-slate-700 text-sm disabled:animate-pulse">↻</button>`}
                ${c.url
                  ? html`<a href=${c.url} target="_blank" rel="noopener" class="text-xs text-brand-700 hover:underline">View ↗</a>`
                  : html`<a href=${`https://www.google.com/search?q=${encodeURIComponent((f.business_name || '') + ' ' + c.directory)}`} target="_blank" rel="noopener" class="text-xs text-slate-400 hover:underline">Add ↗</a>`}
              </div>
            </div>
          </div>`)}
        </div>
      </div></${Card}>

      <${BrightLocalBuilder} />

      <div class="text-[11px] text-slate-400 text-center">Above: what we find and how consistent it is. Below that: building new listings through BrightLocal, which spends credits and publishes to third parties — so it always shows you what will be sent before anything is ordered.</div>
    `}
  </div>`;
}
