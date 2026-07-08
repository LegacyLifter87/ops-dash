// ---------------------------------------------------------------------------
// citations.js — Citation builder (Phase 1). Maintains one source-of-truth NAP
// profile (incl. former names), then scans major directories to find listings,
// compare each against the source of truth, and flag missing / inconsistent /
// stale-former-name citations with deep links to fix them. Push/sync = Phase 2.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { seoCitationsLoad, seoCitationsSaveProfile, seoCitationsScan } from './store.js';
import { Card, Btn, Input } from './ui.js';

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
