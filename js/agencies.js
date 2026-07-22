// ---------------------------------------------------------------------------
// agencies.js — the PLATFORM console (super admin only). Mirrors Job
// Tracker's "All companies" screen: the super admin lands here, sees every
// agency, creates new ones, and enters an agency to work inside it. Inside,
// "← All agencies" (in the sidebar) exits back to this screen.
// ---------------------------------------------------------------------------
import { html, useState, useEffect } from './lib.js';
import { getUserEmail, signOut, enterAgency, seoSuperListAgencies, seoSuperCreateAgency } from './store.js';
import { Btn, Input, Field } from './ui.js';

function OwnerCred({ cred, onClose }) {
  const copy = () => { try { navigator.clipboard.writeText(`${cred.email} / ${cred.password}`); } catch { /* ignore */ } };
  return html`<div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
    <div class="font-medium text-emerald-800">Owner login created for ${cred.email}</div>
    <div class="mt-1 text-emerald-900">Temp password: <code class="px-1.5 py-0.5 rounded bg-white border border-emerald-200 font-mono">${cred.password}</code>
      <button onClick=${copy} class="ml-2 text-xs underline text-emerald-700">copy</button>
    </div>
    <div class="text-xs text-emerald-700 mt-1">Share it securely — this is shown only once. They sign in at ops.legacybuilder.app, land in their new agency, and create their first business.</div>
    <button onClick=${onClose} class="text-xs text-emerald-600 underline mt-1">dismiss</button>
  </div>`;
}

export function AgencyConsole() {
  const [agencies, setAgencies] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [cred, setCred] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => { try { const r = await seoSuperListAgencies(); setAgencies(r.agencies || []); } catch (e) { setErr(e.message); setAgencies([]); } };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !ownerEmail.trim()) { setErr('Agency name and owner email are both required.'); return; }
    setBusy(true); setErr(''); setCred(null);
    try {
      const r = await seoSuperCreateAgency(name.trim(), ownerEmail.trim());
      if (r.tempPassword) setCred({ email: ownerEmail.trim(), password: r.tempPassword });
      setName(''); setOwnerEmail(''); setOpen(false); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return html`<div class="min-h-screen bg-slate-50">
    <header class="bg-gradient-to-r from-slate-900 to-slate-950 text-white">
      <div class="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
        <div class="h-9 w-9 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-lg">◑</div>
        <div class="flex-1 min-w-0">
          <div class="font-bold tracking-tight leading-tight">Ops Dashboard</div>
          <div class="text-[11px] uppercase tracking-wide text-slate-400">Platform console</div>
        </div>
        <div class="text-right text-xs text-slate-400">
          <div class="truncate max-w-[180px]">${getUserEmail()}</div>
          <button onClick=${signOut} class="underline hover:text-white">Sign out</button>
        </div>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 class="text-xl font-bold text-slate-800">Agencies</h1>
          <p class="text-sm text-slate-500">Pick an agency to work inside it, or create a new one. Each agency only ever sees its own businesses, staff, and connections.</p>
        </div>
        <${Btn} variant=${open ? 'ghost' : 'cta'} onClick=${() => { setOpen(!open); setErr(''); }}>${open ? 'Cancel' : '+ New agency'}</${Btn}>
      </div>

      ${err && html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700">${err}</div>`}
      ${cred && html`<${OwnerCred} cred=${cred} onClose=${() => setCred(null)} />`}

      ${open && html`<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div class="font-semibold text-slate-800 mb-2">New agency</div>
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex-1 min-w-[180px]">
            <label class="text-[11px] text-slate-400">Agency name</label>
            <${Input} value=${name} onInput=${setName} placeholder="Acme Marketing" />
          </div>
          <div class="flex-1 min-w-[220px]">
            <label class="text-[11px] text-slate-400">First owner's email</label>
            <${Input} value=${ownerEmail} onInput=${setOwnerEmail} placeholder="owner@acme.com" />
          </div>
          <${Btn} variant="cta" onClick=${create} disabled=${busy}>${busy ? 'Creating…' : 'Create agency'}</${Btn}>
        </div>
        <p class="text-xs text-slate-400 mt-2">If the owner's login doesn't exist yet it's created with a one-time temp password. They manage their own businesses, team, and Google connections from there.</p>
      </div>`}

      ${agencies === null ? html`<div class="text-sm text-slate-400 py-8 text-center">Loading agencies…</div>` : agencies.length === 0 ? html`
        <div class="text-sm text-slate-400 py-8 text-center">No agencies yet — create the first one.</div>` : html`
        <div class="space-y-3">
          ${agencies.map((a) => html`<button onClick=${() => enterAgency(a.id, a.name)}
            class="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-brand-300 hover:shadow-md transition p-4 flex items-center gap-4 flex-wrap group">
            <div class="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-lg text-white shrink-0 font-semibold">${(a.name || '?')[0].toUpperCase()}</div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-slate-800 truncate">${a.name}</div>
              <div class="text-xs text-slate-400 truncate">${(a.owners || []).join(', ') || 'no owners yet'}</div>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${a.businesses ?? 0} business${(a.businesses ?? 0) === 1 ? '' : 'es'}</span>
              <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${a.staff ?? 0} staff</span>
              <span class="text-sm text-brand-600 font-medium group-hover:translate-x-0.5 transition">Open →</span>
            </div>
          </button>`)}
        </div>`}
    </main>
  </div>`;
}
