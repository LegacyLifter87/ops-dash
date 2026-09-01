// ---------------------------------------------------------------------------
// agencies.js — the PLATFORM console (super admin only). Mirrors Job
// Tracker's "All companies" screen: the super admin lands here, sees every
// agency, creates/renames/deletes them, and enters an agency to work inside
// it. Inside, "← All agencies" (in the sidebar) exits back to this screen.
// ---------------------------------------------------------------------------
import { html, useState, useEffect } from './lib.js';
import { getUserEmail, signOut, enterAgency, seoSuperListAgencies, seoSuperCreateAgency, seoSuperUpdateAgency, seoSuperDeleteAgency, seoSuperListAdmins, seoSuperAddAdmin, seoSuperRemoveAdmin, seoSetAgencyLimits, seoAgencyLimits, seoSuperPlans, seoSuperPlanSave, seoSuperPlanArchive, seoSuperBillingList, seoSuperAssignPlan, seoSuperSetExempt } from './store.js';
import { Btn, Input, Field, Modal } from './ui.js';

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

function RenameAgencyModal({ agency, onClose, onDone }) {
  const [name, setName] = useState(agency.name || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try { await seoSuperUpdateAgency(agency.id, name.trim()); await onDone(); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title=${`Rename agency — ${agency.name}`} onClose=${onClose}>
    <div class="space-y-3">
      <${Field} label="Agency name"><${Input} value=${name} onInput=${setName} placeholder="Acme Marketing" /></${Field}>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy || !name.trim()}>${busy ? 'Saving…' : 'Save name'}</${Btn}>
    </div>
  </${Modal}>`;
}

function DeleteAgencyModal({ agency, onClose, onDone }) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const del = async () => {
    setBusy(true); setErr('');
    try { await seoSuperDeleteAgency(agency.id, confirm); await onDone(); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title=${`Delete agency — ${agency.name}`} onClose=${onClose}>
    <div class="space-y-3">
      <div class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
        This permanently deletes <span class="font-semibold">${agency.name}</span> — including its
        <span class="font-semibold"> ${agency.businesses ?? 0} business${(agency.businesses ?? 0) === 1 ? '' : 'es'}</span> and all their data
        (sites, keywords, rankings, connections, blog queue). Staff logins keep existing but lose all access. This cannot be undone.
      </div>
      <${Field} label=${`Type the agency name to confirm: ${agency.name}`}>
        <${Input} value=${confirm} onInput=${setConfirm} placeholder=${agency.name} />
      </${Field}>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} variant="danger" class="w-full" onClick=${del} disabled=${busy || confirm !== agency.name}>${busy ? 'Deleting…' : 'Delete agency permanently'}</${Btn}>
    </div>
  </${Modal}>`;
}

// Per-agency caps: how many staff sign-ins and businesses an agency may have.
// Enforced at the database (insert triggers), so the caps hold no matter which
// path tries to add — an agency owner simply gets a clear "reached its limit"
// message. Blank = unlimited; existing rows over a new cap stay, the cap only
// blocks NEW additions.
function LimitsModal({ agency, limits, onClose, onDone }) {
  const toStr = (v) => (v == null ? '' : String(v));
  const [staff, setStaff] = useState(toStr(limits?.max_staff));
  const [accounts, setAccounts] = useState(toStr(limits?.max_accounts));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toNum = (s) => { const t = String(s).trim(); if (t === '') return null; const n = Math.floor(Number(t)); return Number.isFinite(n) && n >= 0 ? n : NaN; };
  const save = async () => {
    const ms = toNum(staff), ma = toNum(accounts);
    if (Number.isNaN(ms) || Number.isNaN(ma)) { setErr('Limits must be whole numbers (or blank for unlimited).'); return; }
    setBusy(true); setErr('');
    try { await seoSetAgencyLimits(agency.id, ms, ma); await onDone(); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title=${`Limits — ${agency.name}`} onClose=${onClose}>
    <div class="space-y-3">
      <p class="text-xs text-slate-500">Cap what this agency can add. Blank = unlimited. If they're already over a new cap nothing is removed — the cap just blocks additions until they're back under it (or you raise it).</p>
      <div class="grid grid-cols-2 gap-3">
        <${Field} label=${`Team sign-ins (now: ${agency.staff ?? 0})`}>
          <${Input} type="number" min="0" step="1" value=${staff} onInput=${setStaff} placeholder="unlimited" />
        <//>
        <${Field} label=${`Businesses (now: ${agency.businesses ?? 0})`}>
          <${Input} type="number" min="0" step="1" value=${accounts} onInput=${setAccounts} placeholder="unlimited" />
        <//>
      </div>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy}>${busy ? 'Saving…' : 'Save limits'}</${Btn}>
    </div>
  </${Modal}>`;
}

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;

// Platform plans + per-agency billing. Plans define the monthly base (billed
// as a Stripe subscription) and the staff/business caps; assigning one applies
// the caps immediately and starts billing — right away when the agency has a
// card on file, otherwise the owner completes checkout from their Billing card.
// "Bills to platform" agencies skip the wallet gate and need no card.
function PlansBilling() {
  const [plans, setPlans] = useState(null);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);   // {} = new, {plan} = edit
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const load = async () => {
    try {
      const [p, b] = await Promise.all([seoSuperPlans(), seoSuperBillingList()]);
      setPlans(p.plans || []); setRows(b.agencies || []);
    } catch (e) { setErr(e.message); setPlans([]); }
  };
  useEffect(() => { load(); }, []);
  const assign = async (ag, planId) => {
    const plan = (plans || []).find((p) => p.id === planId);
    const label = plan ? `${plan.name} (${money(plan.monthly_cents)}/mo)` : 'no plan';
    if (!confirm(planId
      ? `Put ${ag.name} on ${label}?\n\nTheir team/business limits update immediately. Billing starts now if they have a card on file — otherwise they'll be asked to enter one, and the subscription starts when they do.`
      : `Take ${ag.name} off their plan?\n\nTheir Stripe subscription is cancelled and their limits are cleared.`)) return;
    setBusy(`a${ag.id}`); setErr(''); setNote('');
    try { const r = await seoSuperAssignPlan(ag.id, planId || null); if (r.note) setNote(`${ag.name}: ${r.note}`); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const toggleExempt = async (ag) => {
    if (!ag.billing_exempt && !confirm(`Bill ${ag.name}'s API usage to the platform?\n\nThey won't need a card or wallet — every API call they make is the platform's cost.`)) return;
    setBusy(`e${ag.id}`); setErr('');
    try { await seoSuperSetExempt(ag.id, !ag.billing_exempt); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const archive = async (p) => {
    if (!confirm(`Archive the "${p.name}" plan?`)) return;
    setErr('');
    try { await seoSuperPlanArchive(p.id); await load(); } catch (e) { setErr(e.message); }
  };
  const subBadge = (s) => {
    if (!s) return '';
    const tone = s === 'active' ? 'bg-emerald-100 text-emerald-700' : s === 'pending_payment' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
    return html`<span class=${`text-[10px] px-1.5 py-0.5 rounded-full ${tone}`}>${s === 'pending_payment' ? 'awaiting card' : s}</span>`;
  };
  return html`<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
      <div class="font-semibold text-slate-800">Plans & billing <span class="text-xs font-normal text-slate-400">— monthly base + API wallet, via Stripe</span></div>
      <${Btn} size="sm" variant=${editing ? 'ghost' : 'secondary'} onClick=${() => setEditing(editing ? null : {})}>${editing ? 'Cancel' : '+ New plan'}</${Btn}>
    </div>
    <p class="text-xs text-slate-400 mb-3">A plan = monthly price (Stripe subscription) + team/business limits. Assign one and billing starts automatically. The wallet is separate: agencies prepay for API usage and calls stop when it's empty — unless you mark them "bills to platform".</p>
    ${err && html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700 mb-2">${err}</div>`}
    ${note && html`<div class="rounded-lg px-3 py-2 text-sm bg-sky-50 text-sky-800 mb-2">${note}</div>`}
    ${editing && html`<${PlanForm} plan=${editing.plan} onClose=${() => setEditing(null)} onDone=${load} />`}
    ${plans === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
      ${plans.filter((p) => p.active).length > 0 && html`<div class="space-y-1.5 mb-4">
        ${plans.filter((p) => p.active).map((p) => html`<div key=${p.id} class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-slate-800">${p.name}</span>
            <span class="text-xs text-slate-500 ml-2">${money(p.monthly_cents)}/mo · ${p.max_accounts ?? '∞'} businesses · ${p.max_staff ?? '∞'} team</span>
            ${!p.stripe_price_id && p.monthly_cents > 0 && html`<span class="text-[10px] text-amber-600 ml-2">no Stripe price yet — re-save once Stripe is configured</span>`}
          </div>
          <span class="text-[11px] text-slate-400">${p.agencies} agenc${p.agencies === 1 ? 'y' : 'ies'}</span>
          <button onClick=${() => setEditing({ plan: p })} class="text-xs text-slate-400 hover:text-brand-700 underline">edit</button>
          <button onClick=${() => archive(p)} class="text-xs text-slate-400 hover:text-rose-600 underline">archive</button>
        </div>`)}
      </div>`}
      <div class="divide-y divide-slate-50">
        ${rows.map((ag) => html`<div key=${ag.id} class="flex items-center gap-3 py-2 flex-wrap">
          <div class="flex-1 min-w-[140px]">
            <div class="text-sm text-slate-800 truncate">${ag.name}</div>
            <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
              ${subBadge(ag.sub_status)}
              ${ag.billing_exempt
                ? html`<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">bills to platform</span>`
                : html`<span class="text-[10px] text-slate-400">wallet ${money(ag.wallet_cents)}</span>`}
            </div>
          </div>
          <select value=${ag.plan_id || ''} disabled=${busy === `a${ag.id}`}
            onChange=${(e) => { const v = e.target.value; e.target.value = ag.plan_id || ''; assign(ag, v || null); }}
            class="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">— no plan —</option>
            ${(plans || []).filter((p) => p.active || p.id === ag.plan_id).map((p) => html`<option value=${p.id} selected=${p.id === ag.plan_id}>${p.name} (${money(p.monthly_cents)}/mo)</option>`)}
          </select>
          <label class="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer" title="API usage bills to the platform — no card or wallet needed">
            <input type="checkbox" checked=${ag.billing_exempt} disabled=${busy === `e${ag.id}`} onChange=${() => toggleExempt(ag)} class="accent-violet-600" />
            platform-billed
          </label>
        </div>`)}
      </div>`}
  </div>`;
}

function PlanForm({ plan, onClose, onDone }) {
  const [name, setName] = useState(plan?.name || '');
  const [monthly, setMonthly] = useState(plan ? String(plan.monthly_cents / 100) : '');
  const [maxAccounts, setMaxAccounts] = useState(plan?.max_accounts == null ? '' : String(plan.max_accounts));
  const [maxStaff, setMaxStaff] = useState(plan?.max_staff == null ? '' : String(plan.max_staff));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await seoSuperPlanSave({ id: plan?.id, name: name.trim(), monthlyUsd: Number(monthly) || 0, maxAccounts, maxStaff });
      await onDone(); onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<div class="rounded-xl border border-brand-200 bg-brand-50/40 p-3 mb-3">
    <div class="text-sm font-medium text-slate-800 mb-2">${plan ? `Edit plan — ${plan.name}` : 'New plan'}</div>
    <div class="grid sm:grid-cols-4 gap-2">
      <div><label class="text-[11px] text-slate-400">Name</label><${Input} value=${name} onInput=${setName} placeholder="Starter" /></div>
      <div><label class="text-[11px] text-slate-400">Monthly (USD)</label><${Input} type="number" min="0" step="1" value=${monthly} onInput=${setMonthly} placeholder="99" /></div>
      <div><label class="text-[11px] text-slate-400">Max businesses</label><${Input} type="number" min="0" step="1" value=${maxAccounts} onInput=${setMaxAccounts} placeholder="unlimited" /></div>
      <div><label class="text-[11px] text-slate-400">Max team sign-ins</label><${Input} type="number" min="0" step="1" value=${maxStaff} onInput=${setMaxStaff} placeholder="unlimited" /></div>
    </div>
    ${plan && html`<p class="text-[11px] text-slate-400 mt-1.5">Changing the price creates a new Stripe price — agencies already subscribed keep the old price until you reassign their plan. Limit changes apply to agencies on this plan the next time you reassign it.</p>`}
    ${err && html`<div class="text-sm text-rose-600 mt-2">${err}</div>`}
    <div class="mt-2"><${Btn} size="sm" onClick=${save} disabled=${busy || !name.trim()}>${busy ? 'Saving…' : plan ? 'Save plan' : 'Create plan'}</${Btn}></div>
  </div>`;
}

// Overall (platform) admins: full access to every agency and business. Logins
// are shared with Job Tracker — an admin here is a JT overall admin too.
function PlatformAdmins() {
  const [admins, setAdmins] = useState(null);
  const [email, setEmail] = useState('');
  const [cred, setCred] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = async () => { try { const r = await seoSuperListAdmins(); setAdmins(r.admins || []); } catch (e) { setErr(e.message); setAdmins([]); } };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!email.trim()) return;
    setBusy(true); setErr(''); setCred(null);
    try {
      const r = await seoSuperAddAdmin(email.trim());
      if (r.created && r.tempPassword) setCred({ email: email.trim(), password: r.tempPassword });
      setEmail(''); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async (a) => {
    if (!confirm(`Remove platform-admin access for ${a.email || 'this user'}?\n\nThey lose access to every agency here AND their overall-admin role in Job Tracker (logins are shared).`)) return;
    setErr('');
    try { await seoSuperRemoveAdmin(a.userId); await load(); } catch (e) { setErr(e.message); }
  };
  return html`<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
    <div class="font-semibold text-slate-800 mb-1">Platform admins <span class="text-xs font-normal text-slate-400">— full access to every agency and business</span></div>
    <p class="text-xs text-slate-400 mb-3">Overall admins can open any agency, manage all staff and businesses, and create or delete agencies. One login is shared with Job Tracker, so this also grants Job Tracker overall-admin.</p>
    ${err && html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700 mb-2">${err}</div>`}
    ${cred && html`<div class="mb-2"><${OwnerCred} cred=${cred} onClose=${() => setCred(null)} /></div>`}
    ${admins === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
      <div class="divide-y divide-slate-50">
        ${admins.map((a) => html`<div class="flex items-center gap-3 py-2.5">
          <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm text-white shrink-0">${(a.email || '?')[0].toUpperCase()}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-slate-800 truncate">${a.email || a.userId}${a.you ? html`<span class="text-xs text-slate-400"> (you)</span>` : ''}</div>
            ${a.name && html`<div class="text-xs text-slate-400 truncate">${a.name}</div>`}
          </div>
          ${!a.you && html`<button onClick=${() => remove(a)} class="text-xs text-slate-400 hover:text-rose-600 underline">remove</button>`}
        </div>`)}
      </div>
      <div class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-slate-100">
        <div class="flex-1 min-w-[220px]">
          <label class="text-[11px] text-slate-400">Add platform admin by email</label>
          <${Input} value=${email} onInput=${setEmail} placeholder="admin@yourplatform.com" />
        </div>
        <${Btn} size="sm" variant="cta" onClick=${add} disabled=${busy}>${busy ? 'Adding…' : '★ Add admin'}</${Btn}>
      </div>`}
  </div>`;
}

export function AgencyConsole() {
  const [agencies, setAgencies] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [cred, setCred] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [limitsFor, setLimitsFor] = useState(null);
  const [limits, setLimits] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const [r, lim] = await Promise.all([seoSuperListAgencies(), seoAgencyLimits().catch(() => ({}))]);
      setAgencies(r.agencies || []); setLimits(lim || {});
    } catch (e) { setErr(e.message); setAgencies([]); }
  };
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
          ${agencies.map((a) => html`<div class="bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-brand-300 hover:shadow-md transition p-4 flex items-center gap-4 flex-wrap">
            <button onClick=${() => enterAgency(a.id, a.name)} class="flex items-center gap-4 flex-1 min-w-0 text-left group">
              <div class="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-lg text-white shrink-0 font-semibold">${(a.name || '?')[0].toUpperCase()}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-slate-800 truncate group-hover:text-brand-700">${a.name}</div>
                <div class="text-xs text-slate-400 truncate">${(a.owners || []).join(', ') || 'no owners yet'}</div>
              </div>
            </button>
            <div class="flex items-center gap-2 flex-wrap">
              ${(() => {
                const lim = limits[a.id] || {};
                const chip = (used, cap, label) => {
                  const at = cap != null && used >= cap;
                  return html`<span class=${`text-[11px] px-2 py-0.5 rounded-full ${at ? 'bg-amber-100 text-amber-700 font-medium' : 'bg-slate-100 text-slate-600'}`}
                    title=${cap != null ? `Limit: ${cap}` : 'No limit set'}>${used}${cap != null ? ` / ${cap}` : ''} ${label}</span>`;
                };
                return html`${chip(a.businesses ?? 0, lim.max_accounts, (a.businesses ?? 0) === 1 && lim.max_accounts == null ? 'business' : 'businesses')}${chip(a.staff ?? 0, lim.max_staff, 'staff')}`;
              })()}
              <button onClick=${() => setLimitsFor(a)} title="Set team & business limits" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700">🎚 Limits</button>
              <button onClick=${() => setRenaming(a)} title="Rename agency" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700">✏️ Rename</button>
              <button onClick=${() => setDeleting(a)} title="Delete agency" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-700">🗑 Delete</button>
              <${Btn} size="sm" onClick=${() => enterAgency(a.id, a.name)}>Open →</${Btn}>
            </div>
          </div>`)}
        </div>`}

      <${PlansBilling} />

      <${PlatformAdmins} />
    </main>

    ${renaming && html`<${RenameAgencyModal} agency=${renaming} onClose=${() => setRenaming(null)} onDone=${load} />`}
    ${deleting && html`<${DeleteAgencyModal} agency=${deleting} onClose=${() => setDeleting(null)} onDone=${load} />`}
    ${limitsFor && html`<${LimitsModal} agency=${limitsFor} limits=${limits[limitsFor.id]} onClose=${() => setLimitsFor(null)} onDone=${load} />`}
  </div>`;
}
