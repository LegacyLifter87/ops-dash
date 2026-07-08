// ---------------------------------------------------------------------------
// citations.js — Citation builder (Phase 1). Maintains one source-of-truth NAP
// profile (incl. former names), then scans major directories to find listings,
// compare each against the source of truth, and flag missing / inconsistent /
// stale-former-name citations with deep links to fix them. Push/sync = Phase 2.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { seoCitationsLoad, seoCitationsSaveProfile, seoCitationsScan, seoFbStatus, seoFbConnect, seoFbDisconnect, seoFbPages, seoFbSelectPage, seoFbGet, seoFbUpdate } from './store.js';
import { Card, Btn, Input } from './ui.js';

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

export function Citations({ siteId, domain, canRun = true }) {
  const [f, setF] = useState(null);
  const [cites, setCites] = useState([]);
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);

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
        <div class="font-semibold text-slate-800 mb-2">Directory listings</div>
        <div class="divide-y divide-slate-50">
          ${cites.map((c) => html`<div class="flex items-start gap-3 py-2.5">
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
            </div>
            ${c.url
              ? html`<a href=${c.url} target="_blank" rel="noopener" class="shrink-0 text-xs text-brand-700 hover:underline">View / edit ↗</a>`
              : html`<a href=${`https://www.google.com/search?q=${encodeURIComponent((f.business_name || '') + ' ' + c.directory)}`} target="_blank" rel="noopener" class="shrink-0 text-xs text-slate-400 hover:underline">Add listing ↗</a>`}
          </div>`)}
        </div>
      </div></${Card}>

      <div class="text-[11px] text-slate-400 text-center">Phase 1: discovery + consistency. One-click remote editing/sync per directory is coming next — starting with the profiles we can push to directly (Google Business Profile first).</div>
    `}
  </div>`;
}
