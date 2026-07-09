// ---------------------------------------------------------------------------
// team.js — user control panel. Two tiers, mirroring the Job Tracker model:
//  1) This account's team: invite users by email (creates the login with a
//     one-time temp password), set role (owner/admin/member), remove.
//  2) Agency staff (agency-only): grant a user access to ALL accounts —
//     implemented as admin membership fanned out to every account, including
//     future ones (DB trigger) — list, revoke.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, activeAccount, seoTeamList, seoTeamAdd, seoTeamSetRole, seoTeamRemove, seoAgencyList, seoAgencyGrant, seoAgencyRevoke } from './store.js';
import { Card, Btn, Input, Select } from './ui.js';

const ROLE_OPTS = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }, { value: 'owner', label: 'Owner' }];
const roleTone = (r) => r === 'owner' ? 'bg-violet-100 text-violet-700' : r === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600';

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

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (!data) return html`<div class="p-8 text-sm text-slate-400">Loading team…</div>`;

  return html`<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
    <div>
      <h1 class="text-xl font-bold text-slate-800">Team</h1>
      <p class="text-sm text-slate-500">Who can access <span class="font-medium">${acct?.name || 'this account'}</span>${data.agency ? ' — plus agency-wide staff.' : '.'}</p>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${cred && html`<${TempPw} cred=${cred} onClose=${() => setCred(null)} />`}

    <${Card}><div class="p-4">
      <div class="font-semibold text-slate-800 mb-1">This account's team</div>
      <p class="text-xs text-slate-400 mb-3">Members see data; admins can run tools and connect integrations; owners can also manage the team.</p>
      <div class="divide-y divide-slate-50">
        ${(data.members || []).map((m) => html`<div class="flex items-center gap-3 py-2.5">
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm text-slate-500 shrink-0">${(m.email || '?')[0].toUpperCase()}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-slate-800 truncate">${m.email || m.userId}${m.you ? html`<span class="text-xs text-slate-400"> (you)</span>` : ''}</div>
            ${m.isAgency && html`<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">AGENCY — all accounts</span>`}
          </div>
          ${data.admin && !m.you && !m.isAgency
            ? html`<${Select} value=${m.role} onChange=${(v) => setMemberRole(m, v)} options=${ROLE_OPTS} />`
            : html`<span class=${cx('text-[11px] font-semibold px-2 py-0.5 rounded-full', roleTone(m.role))}>${m.role}</span>`}
          ${data.admin && !m.you && !m.isAgency && html`<button onClick=${() => remove(m)} class="text-xs text-slate-400 hover:text-rose-600 underline">remove</button>`}
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
  </div>`;
}
