// ---------------------------------------------------------------------------
// team.js — user control panel. Tiers:
//  1) This account's team: invite users by email (creates the login with a
//     one-time temp password), set role (owner/admin/member), remove.
//  2) Agency staff (owner-only): OWNERS have blanket access to ALL accounts;
//     MEMBERS are employees with per-account access (all accounts by default,
//     or an owner-assigned subset). Owners grant / limit / promote / revoke.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, activeAccount, getUserEmail, seoTeamList, seoTeamAdd, seoTeamSetRole, seoTeamRemove, seoAgencyList, seoAgencyGrant, seoAgencyRevoke, seoMemberGrant, seoMemberSetAccounts, seoMemberSetTier, seoMemberRevoke, seoTeamSetPassword, seoTeamSendReset, seoTeamDeleteUser, seoTeamSetTabs } from './store.js';
import { Card, Btn, Input, Select, Modal, Field } from './ui.js';

const ROLE_OPTS = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }, { value: 'owner', label: 'Owner' }];
const roleTone = (r) => r === 'owner' ? 'bg-violet-100 text-violet-700' : r === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600';
const TAB_OPTS = [['dashboard', '▣ Dashboard'], ['seo', '🔍 SEO'], ['keywords', '🔑 Keywords'], ['autoblog', '🤖 Automation'], ['competitors', '⚔️ Competitors'], ['ranks', '📈 Ranks'], ['local', '📍 Local'], ['audit', '🩺 Audit'], ['backlinks', '🔗 Backlinks'], ['ads', '💰 Google Ads'], ['analytics', '📶 Analytics'], ['jt', '📊 Business'], ['team', '👥 Team']];

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

// Owner-only: pick which accounts an agency member can access (or all).
function AccountsModal({ m, accounts, onClose, onSave }) {
  const [mode, setMode] = useState(m.unrestricted ? 'all' : 'some');
  const [sel, setSel] = useState(new Set((m.accounts || []).map((a) => a.id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toggle = (id) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = async () => {
    setBusy(true); setErr('');
    try { await onSave(mode === 'all' ? null : [...sel]); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title=${`Account access — ${m.email || 'member'}`} onClose=${onClose}>
    <div class="space-y-3">
      <div class="flex gap-2">
        <button onClick=${() => setMode('all')} class=${cx('flex-1 px-3 py-2 rounded-lg border text-sm', mode === 'all' ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500')}>All accounts</button>
        <button onClick=${() => setMode('some')} class=${cx('flex-1 px-3 py-2 rounded-lg border text-sm', mode === 'some' ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500')}>Only chosen accounts</button>
      </div>
      ${mode === 'all'
        ? html`<p class="text-xs text-slate-500">This member is added to every account — including accounts you create later.</p>`
        : html`<div class="space-y-1.5 max-h-64 overflow-y-auto">
            <p class="text-xs text-slate-500">Tick the accounts this member may work on. New accounts will <span class="font-medium">not</span> be added automatically.</p>
            ${(accounts || []).map((a) => html`<label class=${cx('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer', sel.has(a.id) ? 'border-brand-300 bg-brand-50/50 text-slate-800' : 'border-slate-200 text-slate-500')}>
              <input type="checkbox" checked=${sel.has(a.id)} onChange=${() => toggle(a.id)} class="accent-brand-600" />${a.name}
            </label>`)}
            <div class="text-xs text-slate-400">${sel.size} account(s) selected</div>
          </div>`}
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy || (mode === 'some' && sel.size === 0)}>${busy ? 'Saving…' : 'Save access'}</${Btn}>
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
  const myEmail = getUserEmail();
  const [data, setData] = useState(null); // { members, admin, agency }
  const [owners, setOwners] = useState(null);
  const [members, setMembers] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [aEmail, setAEmail] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mScope, setMScope] = useState('all'); // 'all' | 'some'
  const [mSel, setMSel] = useState(new Set());
  const [cred, setCred] = useState(null);
  const [banner, setBanner] = useState('');
  const [tabsFor, setTabsFor] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [acctFor, setAcctFor] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const loadAgency = async () => { const a = await seoAgencyList(); setOwners(a.owners || []); setMembers(a.members || []); setAccounts(a.accounts || []); };
  const load = async () => {
    const d = await seoTeamList();
    setData(d);
    if (d.agency) { try { await loadAgency(); } catch { /* non-fatal */ } }
  };
  useEffect(() => { setData(null); setOwners(null); setMembers(null); setErr(''); setCred(null); if (accountId) load().catch((e) => { setErr(e.message); setData({ members: [], admin: false, agency: false }); }); }, [accountId]);

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
  const grantOwner = async () => {
    if (!aEmail.trim()) return;
    setBusy('grant'); setErr(''); setCred(null);
    try {
      const r = await seoAgencyGrant(aEmail.trim());
      if (r.created && r.tempPassword) setCred({ email: aEmail.trim(), password: r.tempPassword });
      setAEmail(''); await loadAgency(); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const grantMember = async () => {
    if (!mEmail.trim()) return;
    if (mScope === 'some' && mSel.size === 0) { setErr('Pick at least one account, or choose All accounts.'); return; }
    setBusy('mgrant'); setErr(''); setCred(null);
    try {
      const r = await seoMemberGrant(mEmail.trim(), mScope === 'all', mScope === 'some' ? [...mSel] : undefined);
      if (r.created && r.tempPassword) setCred({ email: mEmail.trim(), password: r.tempPassword });
      setMEmail(''); setMScope('all'); setMSel(new Set()); await loadAgency(); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const revokeOwner = async (s) => { if (!confirm(`Revoke agency-owner access for ${s.email || 'this user'}? They will be removed from ALL accounts.`)) return; setErr(''); try { await seoAgencyRevoke(s.userId); await loadAgency(); await load(); } catch (e) { setErr(e.message); } };
  const revokeMember = async (s) => { if (!confirm(`Remove agency member ${s.email || 'this user'}? They lose access to their accounts.`)) return; setErr(''); try { await seoMemberRevoke(s.userId); await loadAgency(); await load(); } catch (e) { setErr(e.message); } };
  const promote = async (s) => { if (!confirm(`Promote ${s.email || 'this member'} to agency OWNER (full access to every account)?`)) return; setErr(''); try { await seoMemberSetTier(s.userId, 'owner'); await loadAgency(); await load(); } catch (e) { setErr(e.message); } };
  const demote = async (s) => { if (!confirm(`Demote ${s.email || 'this owner'} to agency MEMBER? They keep all accounts but lose staff-management powers.`)) return; setErr(''); try { await seoMemberSetTier(s.userId, 'member'); await loadAgency(); await load(); } catch (e) { setErr(e.message); } };
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
    try { await seoTeamDeleteUser(m.userId); setBanner(`Deleted ${m.email}.`); await loadAgency(); await load(); } catch (e) { setErr(e.message); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (!data) return html`<div class="p-8 text-sm text-slate-400">Loading team…</div>`;

  const mToggle = (id) => setMSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
              ${m.agencyTier === 'owner' && html`<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">AGENCY OWNER — all accounts</span>`}
              ${m.agencyTier === 'member' && html`<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">AGENCY MEMBER</span>`}
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
            ${data.agency && m.agencyTier !== 'member' && html`<button title="Delete login entirely (all accounts)" onClick=${() => delUser(m)} class="text-slate-300 hover:text-rose-600">🗑</button>`}
          </div>`}
          ${data.agency && !m.you && m.isAgency && html`<div class="flex items-center gap-2 text-sm">
            <button title="Tab access (this account)" onClick=${() => setTabsFor(m)} class="text-slate-400 hover:text-slate-700">🗂</button>
            <button title="Send password-reset email" onClick=${() => sendReset(m)} class="text-slate-400 hover:text-slate-700">✉</button>
            <button title="Copy a reset link" onClick=${() => copyResetLink(m)} class="text-slate-400 hover:text-slate-700">🔗</button>
            <button title="Set password directly" onClick=${() => setPwFor(m)} class="text-slate-400 hover:text-slate-700">🔑</button>
            <span class="text-[11px] text-slate-400" title="Agency owners are on every account. Manage them in Agency staff below.">agency ↓</span>
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
      <div class="font-semibold text-slate-800 mb-1">Agency owners <span class="text-xs font-normal text-slate-400">— full access to ALL accounts + staff management</span></div>
      <p class="text-xs text-slate-400 mb-3">Owners are added as admins to every account automatically, receive the End-of-Day activity digest, and can manage all agency staff.</p>
      ${owners === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
        <div class="divide-y divide-slate-50">
          ${owners.map((s) => html`<div class="flex items-center gap-3 py-2.5">
            <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm text-amber-700 shrink-0">${(s.email || '?')[0].toUpperCase()}</div>
            <div class="flex-1 min-w-0 text-sm text-slate-800 truncate">${s.email || s.userId}${s.email === myEmail ? html`<span class="text-xs text-slate-400"> (you)</span>` : ''}</div>
            <span class="text-[11px] text-slate-400">since ${new Date(s.grantedAt).toLocaleDateString()}</span>
            ${s.email !== myEmail && html`<button title="Demote to agency member" onClick=${() => demote(s)} class="text-xs text-slate-400 hover:text-indigo-600 underline">demote</button>`}
            ${s.email !== myEmail && html`<button onClick=${() => revokeOwner(s)} class="text-xs text-slate-400 hover:text-rose-600 underline">revoke</button>`}
          </div>`)}
        </div>
        <div class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-slate-100">
          <div class="flex-1 min-w-[220px]">
            <label class="text-[11px] text-slate-400">Grant owner access by email</label>
            <${Input} value=${aEmail} onInput=${setAEmail} placeholder="owner@youragency.com" />
          </div>
          <${Btn} size="sm" variant="cta" onClick=${grantOwner} disabled=${busy === 'grant'}>${busy === 'grant' ? 'Granting…' : '★ Grant owner'}</${Btn}>
        </div>
      `}
    </div></${Card}>

    <${Card}><div class="p-4 border-l-4 border-indigo-300">
      <div class="font-semibold text-slate-800 mb-1">Agency members <span class="text-xs font-normal text-slate-400">— employees who work on accounts</span></div>
      <p class="text-xs text-slate-400 mb-3">Members get every account by default, or limit them to specific accounts. Their activity shows up in your End-of-Day digest, broken down per person.</p>
      ${members === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
        <div class="divide-y divide-slate-50">
          ${members.length === 0 && html`<div class="text-sm text-slate-400 py-1">No agency members yet.</div>`}
          ${members.map((s) => html`<div class="flex items-center gap-3 py-2.5 flex-wrap">
            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm text-indigo-700 shrink-0">${(s.email || '?')[0].toUpperCase()}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-slate-800 truncate">${s.email || s.userId}</div>
              <span class=${cx('text-[10px] px-1.5 py-0.5 rounded', s.unrestricted ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700')}>${s.unrestricted ? 'All accounts' : `${(s.accounts || []).length} account(s)`}</span>
            </div>
            <button title="Set account access" onClick=${() => setAcctFor(s)} class="text-xs text-slate-500 hover:text-indigo-700 underline">accounts</button>
            <button title="Send password-reset email" onClick=${() => sendReset(s)} class="text-slate-400 hover:text-slate-700">✉</button>
            <button title="Promote to agency owner" onClick=${() => promote(s)} class="text-xs text-slate-400 hover:text-amber-600 underline">make owner</button>
            <button onClick=${() => revokeMember(s)} class="text-xs text-slate-400 hover:text-rose-600 underline">remove</button>
          </div>`)}
        </div>
        <div class="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <div class="flex flex-wrap items-end gap-2">
            <div class="flex-1 min-w-[220px]">
              <label class="text-[11px] text-slate-400">Add member by email</label>
              <${Input} value=${mEmail} onInput=${setMEmail} placeholder="employee@youragency.com" />
            </div>
            <${Select} value=${mScope} onChange=${setMScope} options=${[{ value: 'all', label: 'All accounts' }, { value: 'some', label: 'Choose accounts' }]} />
            <${Btn} size="sm" variant="cta" onClick=${grantMember} disabled=${busy === 'mgrant'}>${busy === 'mgrant' ? 'Adding…' : '+ Add member'}</${Btn}>
          </div>
          ${mScope === 'some' && html`<div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            ${accounts.map((a) => html`<label class=${cx('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer', mSel.has(a.id) ? 'border-indigo-300 bg-indigo-50/50 text-slate-800' : 'border-slate-200 text-slate-500')}>
              <input type="checkbox" checked=${mSel.has(a.id)} onChange=${() => mToggle(a.id)} class="accent-indigo-600" />${a.name}
            </label>`)}
          </div>`}
        </div>
      `}
    </div></${Card}>`}

    ${tabsFor && html`<${TabsModal} m=${tabsFor} onClose=${() => setTabsFor(null)} onSave=${async (tabs) => { await seoTeamSetTabs(tabsFor.userId, tabs); await load(); }} />`}
    ${pwFor && html`<${PwModal} m=${pwFor} onClose=${() => setPwFor(null)} onSave=${async (pw) => { await seoTeamSetPassword(pwFor.userId, pw); setBanner(`🔑 Password updated for ${pwFor.email}.`); }} />`}
    ${acctFor && html`<${AccountsModal} m=${acctFor} accounts=${accounts} onClose=${() => setAcctFor(null)} onSave=${async (ids) => { await seoMemberSetAccounts(acctFor.userId, ids); await loadAgency(); await load(); }} />`}
  </div>`;
}
