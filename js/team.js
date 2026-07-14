// ---------------------------------------------------------------------------
// team.js — user control panel. Two tiers, mirroring the Job Tracker model:
//  1) This account's team: invite users by email (creates the login with a
//     one-time temp password), set role (owner/admin/member), remove.
//  2) Agency staff (agency-only): grant a user access to ALL accounts —
//     implemented as admin membership fanned out to every account, including
//     future ones (DB trigger) — list, revoke.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, activeAccount, seoTeamList, seoTeamAdd, seoTeamSetRole, seoTeamRemove, seoAgencyList, seoAgencyGrant, seoAgencyRevoke, seoTeamSetPassword, seoTeamSendReset, seoTeamDeleteUser, seoTeamSetTabs } from './store.js';
import { Card, Btn, Input, Select, Modal, Field } from './ui.js';

const ROLE_OPTS = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }, { value: 'owner', label: 'Owner' }];
const roleTone = (r) => r === 'owner' ? 'bg-violet-100 text-violet-700' : r === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600';
const TAB_OPTS = [['dashboard', '▣ Dashboard'], ['seo', '🔍 SEO'], ['keywords', '🔑 Keywords'], ['competitors', '⚔️ Competitors'], ['ranks', '📈 Ranks'], ['local', '📍 Local'], ['audit', '🩺 Audit'], ['backlinks', '🔗 Backlinks'], ['jt', '📊 Business'], ['team', '👥 Team']];

// Per-member tab access editor. null / all-checked = full access.
function TabsModal({ m, onClose, onSave }) {
  const [sel, setSel] = useState(new Set(m.tabAccess || TAB_OPTS.map(([id]) => id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toggle = (id) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); n.add('dashboard'); return n; });
  const save = async () => {
    setBusy(true); setErr('');
    try { const tabs = sel.size >= TAB_OPTS.length ? null : [...sel]; await onSave(tabs); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title=${`Tab access — ${m.email || 'user'}`} onClose=${onClose}>
    <div class="space-y-3">
      <p class="text-xs text-slate-500">Choose which tabs this user sees in this account. Dashboard is always included.</p>
      <div class="grid grid-cols-2 gap-1.5">
        ${TAB_OPTS.map(([id, label]) => html`<label class=${cx('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer', sel.has(id) ? 'border-brand-300 bg-brand-50/50 text-slate-800' : 'border-slate-200 text-slate-400')}>
          <input type="checkbox" checked=${sel.has(id)} disabled=${id === 'dashboard'} onChange=${() => toggle(id)} class="accent-brand-600" />${label}
        </label>`)}
      </div>
      <div class="flex items-center justify-between">
        <button onClick=${() => setSel(new Set(TAB_OPTS.map(([id]) => id)))} class="text-xs text-slate-400 underline hover:text-slate-600">Select all</button>
        <div class="text-xs text-slate-400">${sel.size >= TAB_OPTS.length ? 'Full access' : `${sel.size} of ${TAB_OPTS.length} tabs`}</div>
      </div>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy}>${busy ? 'Saving…' : 'Save tab access'}</${Btn}>
    </div>
  </${Modal}>`;
}

// Agency-only: directly set a member's password.
function PwModal({ m, onClose, onSave }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    setBusy(true); setErr('');
    try { await onSave(pw); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title=${`Set password — ${m.email || 'user'}`} onClose=${onClose}>
    <div class="space-y-3">
      <${Field} label="New password"><${Input} type="text" value=${pw} onInput=${setPw} placeholder="min. 8 characters" /></${Field}>
      <p class="text-xs text-slate-400">They can sign in with this immediately. Prefer “send reset email” when possible — then only they ever know the password.</p>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy}>${busy ? 'Saving…' : 'Set password'}</${Btn}>
    </div>
  </${Modal}>`;
}

function TempPw({ cred, onClose }) {
  const copy = () => { try { navigator.clipboard.writeText(`${cred.email} / ${cred.password}`); } catch { /* ignore */ } };
  return html`<div class="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
    <div class="font-medium text-emerald-800">Login created for ${cred.email}</div>
    <div class="mt-1 text-emerald-900">Temp password: <code class="px-1.5 py-0.5 rounded bg-white border border-emerald-200 font-mono">${cred.password}</code>
      <button onClick=${copy} class="ml-2 text-xs underline text-emerald-700">copy</button>
    </div>
    <div class="text-xs text-emerald-700 mt-1">Share it with them securely — this is shown only once. They sign in at ops.legacybuilder.app and should change it.</div>
    <button onClick=${onClose} class="text-xs text-emerald-600 underline mt-1">dismiss</button>
  </div>`;
}

export function Team() {
  useStore();
  const accountId = getActiveAccountId();
  const acct = activeAccount();
  const [data, setData] = useState(null); // { members, admin, agency }
  const [staff, setStaff] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [aEmail, setAEmail] = useState('');
  const [cred, setCred] = useState(null);
  const [banner, setBanner] = useState('');
  const [tabsFor, setTabsFor] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const d = await seoTeamList();
    setData(d);
    if (d.agency) { try { const a = await seoAgencyList(); setStaff(a.staff || []); } catch { /* non-fatal */ } }
  };
  useEffect(() => { setData(null); setStaff(null); setErr(''); setCred(null); if (accountId) load().catch((e) => { setErr(e.message); setData({ members: [], admin: false, agency: false }); }); }, [accountId]);

  const add = async () => {
    if (!email.trim()) return;
    setBusy('add'); setErr(''); setCred(null);
    try {
      const r = await seoTeamAdd(email.trim(), role);
      if (r.created && r.tempPassword) setCred({ email: email.trim(), password: r.tempPassword });
      setEmail(''); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const setMemberRole = async (m, newRole) => { setErr(''); try { await seoTeamSetRole(m.userId, newRole); await load(); } catch (e) { setErr(e.message); } };
  const remove = async (m) => { if (!confirm(`Remove ${m.email || 'this user'} from ${acct?.name || 'this account'}?`)) return; setErr(''); try { await seoTeamRemove(m.userId); await load(); } catch (e) { setErr(e.message); } };
  const grant = async () => {
    if (!aEmail.trim()) return;
    setBusy('grant'); setErr(''); setCred(null);
    try {
      const r = await seoAgencyGrant(aEmail.trim());
      if (r.created && r.tempPassword) setCred({ email: aEmail.trim(), password: r.tempPassword });
      setAEmail(''); const a = await seoAgencyList(); setStaff(a.staff || []); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const revoke = async (s) => { if (!confirm(`Revoke agency access for ${s.email || 'this user'}? They will be removed from ALL accounts.`)) return; setErr(''); try { await seoAgencyRevoke(s.userId); const a = await seoAgencyList(); setStaff(a.staff || []); await load(); } catch (e) { setErr(e.message); } };
  const sendReset = async (m) => { setErr(''); setBanner(''); try { const r = await seoTeamSendReset(m.userId); setBanner(`✉ Password-reset email sent to ${r.email || m.email}.`); } catch (e) { setErr(e.message); } };
  const copyResetLink = async (m) => {
    setErr(''); setBanner('');
    try {
      const r = await seoTeamSendReset(m.userId, 'link');
      if (!r.link) { setErr('No link returned.'); return; }
      try { await navigator.clipboard.writeText(r.link); setBanner(`🔗 Reset link copied for ${m.email} — send it to them however you like. It's single-use.`); }
      catch { setBanner(`Reset link for ${m.email}: ${r.link}`); }
    } catch (e) { setErr(e.message); }
  };
  const delUser = async (m) => {
    if (!confirm(`Permanently DELETE the login for ${m.email || 'this user'}?\n\nThis removes them from EVERY account and cannot be undone.`)) return;
    setErr(''); setBanner('');
    try { await seoTeamDeleteUser(m.userId); setBanner(`Deleted ${m.email}.`); await load(); } catch (e) { setErr(e.message); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (!data) return html`<div class="p-8 text-sm text-slate-400">Loading team…</div>`;

  return html`<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
    <div>
      <h1 class="text-xl font-bold text-slate-800">Team</h1>
      <p class="text-sm text-slate-500">Who can access <span class="font-medium">${acct?.name || 'this account'}</span>${data.agency ? ' — plus agency-wide staff.' : '.'}</p>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-sky-50 text-sky-800 flex items-center justify-between"><span class="break-all">${banner}</span><button onClick=${() => setBanner('')} class="opacity-60 hover:opacity-100 ml-2">✕</button></div>`}
    ${cred && html`<${TempPw} cred=${cred} onClose=${() => setCred(null)} />`}

    <${Card}><div class="p-4">
      <div class="font-semibold text-slate-800 mb-1">This account's team</div>
      <p class="text-xs text-slate-400 mb-3">Members see data; admins can run tools and connect integrations; owners can also manage the team.</p>
      <div class="divide-y divide-slate-50">
        ${(data.members || []).map((m) => html`<div class="flex items-center gap-3 py-2.5 flex-wrap">
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm text-slate-500 shrink-0">${(m.email || '?')[0].toUpperCase()}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-slate-800 truncate">${m.email || m.userId}${m.you ? html`<span class="text-xs text-slate-400"> (you)</span>` : ''}</div>
            <div class="flex items-center gap-1.5">
              ${m.isAgency && html`<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">AGENCY — all accounts</span>`}
              ${m.tabAccess && html`<span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">${m.tabAccess.length} tabs</span>`}
            </div>
          </div>
          ${data.admin && !m.you && !m.isAgency
            ? html`<${Select} value=${m.role} onChange=${(v) => setMemberRole(m, v)} options=${ROLE_OPTS} />`
            : html`<span class=${cx('text-[11px] font-semibold px-2 py-0.5 rounded-full', roleTone(m.role))}>${m.role}</span>`}
          ${data.admin && !m.you && !m.isAgency && html`<div class="flex items-center gap-2 text-sm">
            <button title="Tab access" onClick=${() => setTabsFor(m)} class="text-slate-400 hover:text-slate-700">🗂</button>
            <button title="Send password-reset email" onClick=${() => sendReset(m)} class="text-slate-400 hover:text-slate-700">✉</button>
            <button title="Copy a reset link" onClick=${() => copyResetLink(m)} class="text-slate-400 hover:text-slate-700">🔗</button>
            ${data.agency && html`<button title="Set password directly" onClick=${() => setPwFor(m)} class="text-slate-400 hover:text-slate-700">🔑</button>`}
            <button title="Remove from this account" onClick=${() => remove(m)} class="text-xs text-slate-400 hover:text-rose-600 underline">remove</button>
            ${data.agency && html`<button title="Delete login entirely (all accounts)" onClick=${() => delUser(m)} class="text-slate-300 hover:text-rose-600">🗑</button>`}
          </div>`}
          ${data.agency && !m.you && m.isAgency && html`<div class="flex items-center gap-2">
            <button title="Send password-reset email" onClick=${() => sendReset(m)} class="text-slate-400 hover:text-slate-700 text-sm">✉</button>
            <span class="text-[11px] text-slate-400" title="Agency staff have full access everywhere — role, tabs, and removal are managed in the Agency staff section below.">managed in Agency staff ↓</span>
          </div>`}
        </div>`)}
      </div>
      ${data.admin && html`<div class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-slate-100">
        <div class="flex-1 min-w-[220px]">
          <label class="text-[11px] text-slate-400">Invite by email</label>
          <${Input} value=${email} onInput=${setEmail} placeholder="teammate@company.com" />
        </div>
        <${Select} value=${role} onChange=${setRole} options=${ROLE_OPTS} />
        <${Btn} size="sm" onClick=${add} disabled=${busy === 'add'}>${busy === 'add' ? 'Adding…' : '+ Add to this account'}</${Btn}>
      </div>`}
    </div></${Card}>

    ${data.agency && html`<${Card}><div class="p-4 border-l-4 border-amber-300">
      <div class="font-semibold text-slate-800 mb-1">Agency staff <span class="text-xs font-normal text-slate-400">— access to ALL accounts</span></div>
      <p class="text-xs text-slate-400 mb-3">Agency staff are added as admins to every account automatically — including accounts created later. Revoking removes them from all accounts.</p>
      ${staff === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
        <div class="divide-y divide-slate-50">
          ${staff.length === 0 && html`<div class="text-sm text-slate-400 py-1">No agency staff yet — just you.</div>`}
          ${staff.map((s) => html`<div class="flex items-center gap-3 py-2.5">
            <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm text-amber-700 shrink-0">${(s.email || '?')[0].toUpperCase()}</div>
            <div class="flex-1 min-w-0 text-sm text-slate-800 truncate">${s.email || s.userId}</div>
            <span class="text-[11px] text-slate-400">since ${new Date(s.grantedAt).toLocaleDateString()}</span>
            <button onClick=${() => revoke(s)} class="text-xs text-slate-400 hover:text-rose-600 underline">revoke</button>
          </div>`)}
        </div>
        <div class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-slate-100">
          <div class="flex-1 min-w-[220px]">
            <label class="text-[11px] text-slate-400">Grant agency access by email</label>
            <${Input} value=${aEmail} onInput=${setAEmail} placeholder="staff@youragency.com" />
          </div>
          <${Btn} size="sm" variant="cta" onClick=${grant} disabled=${busy === 'grant'}>${busy === 'grant' ? 'Granting…' : '★ Grant agency access'}</${Btn}>
        </div>
      `}
    </div></${Card}>`}

    ${tabsFor && html`<${TabsModal} m=${tabsFor} onClose=${() => setTabsFor(null)} onSave=${async (tabs) => { await seoTeamSetTabs(tabsFor.userId, tabs); await load(); }} />`}
    ${pwFor && html`<${PwModal} m=${pwFor} onClose=${() => setPwFor(null)} onSave=${async (pw) => { await seoTeamSetPassword(pwFor.userId, pw); setBanner(`🔑 Password updated for ${pwFor.email}.`); }} />`}
  </div>`;
}
