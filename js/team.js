// ---------------------------------------------------------------------------
// team.js — THIS business's team only. Users here can access just this
// business (agency staff are managed in Agency settings ⚙, platform admins in
// the All-agencies console). Invite by email (creates the login with a
// one-time temp password), set role (owner/admin/member), tab access, remove.
// A read-only "Your agency" card shows the managing agency's contact details.
// Shared pieces (TempPw, PwModal, AccountsModal, JtAgencyCard) are exported
// for agency.js.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, activeAccount, seoTeamList, seoTeamAdd, seoTeamSetRole, seoTeamRemove, seoTeamSetPassword, seoTeamSendReset, seoTeamDeleteUser, seoTeamSetTabs, seoUserAccounts, seoUserSetAccounts, seoAgencyInfo, jtAgencyStatus, jtAgencySet, jtAgencyUsers, jtAgencyTaskCreate } from './store.js';
import { Card, Btn, Input, Textarea, Select, Modal, Field } from './ui.js';

const ROLE_OPTS = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }, { value: 'owner', label: 'Owner' }];
const roleTone = (r) => r === 'owner' ? 'bg-violet-100 text-violet-700' : r === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600';
const TAB_OPTS = [['dashboard', '▣ Dashboard'], ['seo', '🔍 SEO'], ['profile', '🏢 Business'], ['keywords', '🔑 Keywords'], ['social', '📣 Social'], ['autoblog', '🤖 Autoblogger'], ['competitors', '⚔️ Competitors'], ['ranks', '📈 Ranks'], ['local', '📍 Local'], ['audit', '🩺 Audit'], ['backlinks', '🔗 Backlinks'], ['ads', '💰 Google Ads'], ['analytics', '📶 Analytics'], ['jt', '📊 Job Tracker'], ['team', '👥 Team']];

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

// Owner-level only: directly set a user's password.
export function PwModal({ m, onClose, onSave }) {
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

// Owner-only: pick which businesses an agency member can access (or all).
export function AccountsModal({ m, accounts, onClose, onSave }) {
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
  return html`<${Modal} title=${`Business access — ${m.email || 'member'}`} onClose=${onClose}>
    <div class="space-y-3">
      <div class="flex gap-2">
        <button onClick=${() => setMode('all')} class=${cx('flex-1 px-3 py-2 rounded-lg border text-sm', mode === 'all' ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500')}>All businesses</button>
        <button onClick=${() => setMode('some')} class=${cx('flex-1 px-3 py-2 rounded-lg border text-sm', mode === 'some' ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500')}>Only chosen businesses</button>
      </div>
      ${mode === 'all'
        ? html`<p class="text-xs text-slate-500">This member is added to every business — including ones you create later.</p>`
        : html`<div class="space-y-1.5 max-h-64 overflow-y-auto">
            <p class="text-xs text-slate-500">Tick the businesses this member may work on. New businesses will <span class="font-medium">not</span> be added automatically.</p>
            ${(accounts || []).map((a) => html`<label class=${cx('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer', sel.has(a.id) ? 'border-brand-300 bg-brand-50/50 text-slate-800' : 'border-slate-200 text-slate-500')}>
              <input type="checkbox" checked=${sel.has(a.id)} onChange=${() => toggle(a.id)} class="accent-brand-600" />${a.name}
            </label>`)}
            <div class="text-xs text-slate-400">${sel.size} business(es) selected</div>
          </div>`}
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy || (mode === 'some' && sel.size === 0)}>${busy ? 'Saving…' : 'Save access'}</${Btn}>
    </div>
  </${Modal}>`;
}

// Owner-only: pick which of this agency's businesses a REGULAR user (client
// login, not agency staff) can view. Staff access is managed in Agency
// settings instead.
function BizAccessModal({ m, onClose, onSave }) {
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    seoUserAccounts(m.userId)
      .then((r) => { setRows(r.accounts || []); setSel(new Set((r.accounts || []).filter((a) => a.member).map((a) => a.id))); })
      .catch((e) => { setErr(e.message); setRows([]); });
  }, [m.userId]);
  const toggle = (id) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = async () => {
    setBusy(true); setErr('');
    try { await onSave([...sel]); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title=${`Business access — ${m.email || 'user'}`} onClose=${onClose}>
    <div class="space-y-3">
      <p class="text-xs text-slate-500">Tick the businesses this user can view. Unticking removes their access (their login is kept). Their role within each business is managed on that business's Team tab.</p>
      ${rows === null ? html`<div class="text-sm text-slate-400 py-2">Loading…</div>` : html`
        <div class="space-y-1.5 max-h-64 overflow-y-auto">
          ${rows.map((a) => html`<label class=${cx('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer', sel.has(a.id) ? 'border-brand-300 bg-brand-50/50 text-slate-800' : 'border-slate-200 text-slate-500')}>
            <input type="checkbox" checked=${sel.has(a.id)} onChange=${() => toggle(a.id)} class="accent-brand-600" />
            <span class="flex-1 truncate">${a.name}</span>
            ${a.member && a.role && html`<span class=${cx('text-[10px] px-1.5 py-0.5 rounded', roleTone(a.role))}>${a.role}</span>`}
          </label>`)}
        </div>
        <div class="text-xs text-slate-400">${sel.size} of ${rows.length} businesses</div>`}
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${save} disabled=${busy || rows === null}>${busy ? 'Saving…' : 'Save access'}</${Btn}>
    </div>
  </${Modal}>`;
}

// Agency ↔ Job Tracker: link the agency's own JT company, then assign tasks
// from Ops Dash that land in that company's Tasks tab / My Day.
export function JtAgencyCard({ onBanner }) {
  const [st, setSt] = useState(null); // { companyId, companyName, canPick, companies }
  const [pick, setPick] = useState('');
  const [users, setUsers] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const r = await jtAgencyStatus();
      setSt(r); setPick(r.companyId || '');
      if (r.companyId) { try { const u = await jtAgencyUsers(); setUsers(u.users || []); } catch { setUsers([]); } }
    } catch (e) { setErr(e.message); setSt({}); }
  };
  useEffect(() => { load(); }, []);

  const saveLink = async () => {
    setBusy('link'); setErr('');
    try { await jtAgencySet(pick || null); await load(); onBanner(pick ? '🔗 Job Tracker account linked.' : 'Job Tracker account unlinked.'); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const createTask = async () => {
    if (!title.trim()) { setErr('Give the task a title.'); return; }
    setBusy('task'); setErr('');
    try {
      await jtAgencyTaskCreate({ title: title.trim(), description: desc.trim(), dueDate: dueDate || null, dueTime: dueTime || null, assigneeId: assignee || null });
      setTitle(''); setDesc(''); setDueDate(''); setDueTime(''); setAssignee('');
      onBanner('✅ Task sent to Job Tracker — it will show in that user’s Tasks / My Day.');
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (st === null) return html`<${Card}><div class="p-4 text-sm text-slate-400">Loading Job Tracker link…</div></${Card}>`;
  return html`<${Card}><div class="p-4 border-l-4 border-teal-300">
    <div class="font-semibold text-slate-800 mb-1">Job Tracker <span class="text-xs font-normal text-slate-400">— the agency's own JT account</span></div>
    <p class="text-xs text-slate-400 mb-3">Link the Job Tracker company that belongs to this agency. Tasks assigned here show up as to-dos in that company's Job Tracker (Tasks tab + My Day).</p>
    ${err && html`<div class="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700 mb-2">${err}</div>`}

    ${st.canPick ? html`<div class="flex flex-wrap items-end gap-2 mb-3">
      <div class="flex-1 min-w-[220px]">
        <label class="text-[11px] text-slate-400">Job Tracker company</label>
        <${Select} value=${pick} onChange=${setPick} options=${[{ value: '', label: '— not linked —' }, ...(st.companies || []).map((c) => ({ value: c.id, label: c.name }))]} />
      </div>
      <${Btn} size="sm" onClick=${saveLink} disabled=${busy === 'link' || pick === (st.companyId || '')}>${busy === 'link' ? 'Saving…' : 'Save link'}</${Btn}>
    </div>` : html`<div class="text-sm mb-3 ${st.companyName ? 'text-slate-700' : 'text-slate-400'}">${st.companyName ? html`Linked to <span class="font-medium">${st.companyName}</span>.` : 'Not linked yet — ask your platform admin to link your Job Tracker account.'}</div>`}

    ${st.companyId && html`<div class="pt-3 border-t border-slate-100 space-y-2">
      <div class="text-sm font-medium text-slate-700">Assign a task${st.companyName ? html` <span class="text-xs font-normal text-slate-400">→ ${st.companyName}</span>` : ''}</div>
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex-1 min-w-[220px]">
          <label class="text-[11px] text-slate-400">Task title</label>
          <${Input} value=${title} onInput=${setTitle} placeholder="Follow up on the Smith proposal" />
        </div>
        <div class="min-w-[170px]">
          <label class="text-[11px] text-slate-400">Assign to</label>
          <${Select} value=${assignee} onChange=${setAssignee} options=${[{ value: '', label: 'Unassigned' }, ...((users || []).map((u) => ({ value: u.id, label: u.name })))]} />
        </div>
      </div>
      <${Textarea} value=${desc} onInput=${setDesc} rows=${2} placeholder="Details (optional)" />
      <div class="flex flex-wrap items-end gap-2">
        <div>
          <label class="text-[11px] text-slate-400">Due date</label>
          <${Input} type="date" value=${dueDate} onInput=${setDueDate} />
        </div>
        <div>
          <label class="text-[11px] text-slate-400">Due time</label>
          <${Input} type="time" value=${dueTime} onInput=${setDueTime} />
        </div>
        <${Btn} size="sm" variant="cta" onClick=${createTask} disabled=${busy === 'task' || !title.trim()}>${busy === 'task' ? 'Sending…' : '📌 Send task to Job Tracker'}</${Btn}>
      </div>
    </div>`}
  </div></${Card}>`;
}

export function TempPw({ cred, onClose }) {
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

// Read-only card for business users: who runs this account + how to reach them.
function YourAgencyCard({ accountId }) {
  const [ag, setAg] = useState(undefined); // undefined = loading, null = none
  useEffect(() => { setAg(undefined); seoAgencyInfo(accountId).then((r) => setAg(r.agency || null)).catch(() => setAg(null)); }, [accountId]);
  if (!ag) return null;
  const hasContact = ag.contactName || ag.contactEmail || ag.contactPhone || ag.contactWebsite;
  return html`<${Card}><div class="p-4 border-l-4 border-slate-200">
    <div class="font-semibold text-slate-800 mb-1">Your agency</div>
    <p class="text-xs text-slate-400 mb-2">This business is managed by <span class="font-medium text-slate-600">${ag.name}</span>.</p>
    ${hasContact ? html`<div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
      ${ag.contactName && html`<div>👤 ${ag.contactName}</div>`}
      ${ag.contactEmail && html`<div>✉ <a href=${`mailto:${ag.contactEmail}`} class="text-brand-700 hover:underline">${ag.contactEmail}</a></div>`}
      ${ag.contactPhone && html`<div>📞 <a href=${`tel:${ag.contactPhone}`} class="text-brand-700 hover:underline">${ag.contactPhone}</a></div>`}
      ${ag.contactWebsite && html`<div>🌐 <a href=${ag.contactWebsite.startsWith('http') ? ag.contactWebsite : `https://${ag.contactWebsite}`} target="_blank" rel="noopener" class="text-brand-700 hover:underline">${ag.contactWebsite.replace(/^https?:\/\//, '')}</a></div>`}
    </div>` : html`<div class="text-xs text-slate-400">No contact details on file.</div>`}
  </div></${Card}>`;
}

export function Team() {
  useStore();
  const accountId = getActiveAccountId();
  const acct = activeAccount();
  const [data, setData] = useState(null); // { members, admin, agency }
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [cred, setCred] = useState(null);
  const [banner, setBanner] = useState('');
  const [tabsFor, setTabsFor] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [bizFor, setBizFor] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = async () => { setData(await seoTeamList()); };
  useEffect(() => { setData(null); setErr(''); setCred(null); if (accountId) load().catch((e) => { setErr(e.message); setData({ members: [], admin: false, agency: false }); }); }, [accountId]);

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
  const remove = async (m) => { if (!confirm(`Remove ${m.email || 'this user'} from ${acct?.name || 'this business'}?`)) return; setErr(''); try { await seoTeamRemove(m.userId); await load(); } catch (e) { setErr(e.message); } };
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
    if (!confirm(`Permanently DELETE the login for ${m.email || 'this user'}?\n\nThis removes them from EVERY business and cannot be undone.`)) return;
    setErr(''); setBanner('');
    try { await seoTeamDeleteUser(m.userId); setBanner(`Deleted ${m.email}.`); await load(); } catch (e) { setErr(e.message); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create a business first.</div>`;
  if (!data) return html`<div class="p-8 text-sm text-slate-400">Loading team…</div>`;

  // Agency staff (owners + members) have access through the agency, not this
  // business — they're managed in Agency settings and hidden here.
  const bizMembers = (data.members || []).filter((m) => !m.isAgency && !m.agencyTier);
  const staffCount = (data.members || []).length - bizMembers.length;

  return html`<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
    <div>
      <h1 class="text-xl font-bold text-slate-800">Team</h1>
      <p class="text-sm text-slate-500">People who can access <span class="font-medium">${acct?.name || 'this business'}</span> — just this business, nothing else.</p>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-sky-50 text-sky-800 flex items-center justify-between"><span class="break-all">${banner}</span><button onClick=${() => setBanner('')} class="opacity-60 hover:opacity-100 ml-2">✕</button></div>`}
    ${cred && html`<${TempPw} cred=${cred} onClose=${() => setCred(null)} />`}

    <${Card}><div class="p-4">
      <div class="font-semibold text-slate-800 mb-1">This business's team</div>
      <p class="text-xs text-slate-400 mb-3">Members see data; admins can run tools and connect integrations; owners can also manage the team.</p>
      <div class="divide-y divide-slate-50">
        ${bizMembers.length === 0 && html`<div class="text-sm text-slate-400 py-1">No business-level users yet — invite the first one below.</div>`}
        ${bizMembers.map((m) => html`<div class="flex items-center gap-3 py-2.5 flex-wrap">
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm text-slate-500 shrink-0">${(m.email || '?')[0].toUpperCase()}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-slate-800 truncate">${m.email || m.userId}${m.you ? html`<span class="text-xs text-slate-400"> (you)</span>` : ''}</div>
            ${m.tabAccess && html`<span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">${m.tabAccess.length} tabs</span>`}
          </div>
          ${data.admin && !m.you
            ? html`<${Select} value=${m.role} onChange=${(v) => setMemberRole(m, v)} options=${ROLE_OPTS} />`
            : html`<span class=${cx('text-[11px] font-semibold px-2 py-0.5 rounded-full', roleTone(m.role))}>${m.role}</span>`}
          ${data.admin && !m.you && html`<div class="flex items-center gap-2 text-sm">
            ${data.agency && html`<button title="Which businesses this user can view" onClick=${() => setBizFor(m)} class="text-slate-400 hover:text-slate-700">🏢</button>`}
            <button title="Tab access" onClick=${() => setTabsFor(m)} class="text-slate-400 hover:text-slate-700">🗂</button>
            <button title="Send password-reset email" onClick=${() => sendReset(m)} class="text-slate-400 hover:text-slate-700">✉</button>
            <button title="Copy a reset link" onClick=${() => copyResetLink(m)} class="text-slate-400 hover:text-slate-700">🔗</button>
            ${data.agency && html`<button title="Set password directly" onClick=${() => setPwFor(m)} class="text-slate-400 hover:text-slate-700">🔑</button>`}
            <button title="Remove from this business" onClick=${() => remove(m)} class="text-xs text-slate-400 hover:text-rose-600 underline">remove</button>
            ${data.agency && html`<button title="Delete login entirely (all businesses)" onClick=${() => delUser(m)} class="text-slate-300 hover:text-rose-600">🗑</button>`}
          </div>`}
        </div>`)}
      </div>
      ${data.admin && html`<div class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-slate-100">
        <div class="flex-1 min-w-[220px]">
          <label class="text-[11px] text-slate-400">Invite by email</label>
          <${Input} value=${email} onInput=${setEmail} placeholder="teammate@company.com" />
        </div>
        <${Select} value=${role} onChange=${setRole} options=${ROLE_OPTS} />
        <${Btn} size="sm" onClick=${add} disabled=${busy === 'add'}>${busy === 'add' ? 'Adding…' : '+ Add to this business'}</${Btn}>
      </div>`}
      ${data.agency && staffCount > 0 && html`<div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
        ${staffCount} agency staff also ${staffCount === 1 ? 'has' : 'have'} access through the agency — manage them in <a href="#/agency" class="text-brand-700 hover:underline">⚙ Agency settings</a>.
      </div>`}
    </div></${Card}>

    <${YourAgencyCard} accountId=${accountId} />

    ${tabsFor && html`<${TabsModal} m=${tabsFor} onClose=${() => setTabsFor(null)} onSave=${async (tabs) => { await seoTeamSetTabs(tabsFor.userId, tabs); await load(); }} />`}
    ${pwFor && html`<${PwModal} m=${pwFor} onClose=${() => setPwFor(null)} onSave=${async (pw) => { await seoTeamSetPassword(pwFor.userId, pw); setBanner(`🔑 Password updated for ${pwFor.email}.`); }} />`}
    ${bizFor && html`<${BizAccessModal} m=${bizFor} onClose=${() => setBizFor(null)} onSave=${async (ids) => { await seoUserSetAccounts(bizFor.userId, ids); setBanner(`🏢 Business access updated for ${bizFor.email}.`); await load(); }} />`}
  </div>`;
}
