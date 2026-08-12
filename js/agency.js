// ---------------------------------------------------------------------------
// agency.js — Agency Settings (⚙ in the sidebar; agency owners + supers).
// Everything agency-level lives here, NOT on a business's Team tab:
//  - contact details shown to every business on their Team tab
//  - agency owners (full access to every business in the agency)
//  - agency members (employees, all businesses or a chosen subset)
//  - the agency's own Job Tracker link + task assignment
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getUserEmail, getCurrentAgency, seoAgencyList, seoAgencyGrant, seoAgencyRevoke, seoMemberGrant, seoMemberSetAccounts, seoMemberSetTier, seoMemberRevoke, seoTeamSendReset, seoTeamSetPassword, seoAgencyInfo, seoAgencyUpdateInfo, seoAdsStatus, seoAdsSetPlatformToken, seoAdsClearPlatformToken, seoUsageSummary } from './store.js';
import { Card, Btn, Input, Field, Select } from './ui.js';
import { TempPw, PwModal, AccountsModal, JtAgencyCard } from './team.js';

// Contact details businesses see on their Team tab ("Your agency" card).
function ContactCard({ onBanner }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = () => seoAgencyInfo().then((r) => setForm({
    contactName: r.agency?.contactName || '', contactEmail: r.agency?.contactEmail || '',
    contactPhone: r.agency?.contactPhone || '', contactWebsite: r.agency?.contactWebsite || '',
    socialDirectorEmail: r.agency?.socialDirectorEmail || '',
    blogManagerEmail: r.agency?.blogManagerEmail || '',
  })).catch((e) => { setErr(e.message); setForm({ contactName: '', contactEmail: '', contactPhone: '', contactWebsite: '', socialDirectorEmail: '', blogManagerEmail: '' }); });
  useEffect(() => { load(); }, []);
  const setF = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true); setErr('');
    try { await seoAgencyUpdateInfo(form); await load(); onBanner('✅ Agency details saved.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return html`<${Card}><div class="p-4">
    <div class="font-semibold text-slate-800 mb-1">Contact details <span class="text-xs font-normal text-slate-400">— visible to your businesses</span></div>
    <p class="text-xs text-slate-400 mb-3">Every business in this agency sees these on their Team tab, so they always know who runs their account and how to reach you.</p>
    ${form === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
      <div class="grid sm:grid-cols-2 gap-3">
        <${Field} label="Contact name"><${Input} value=${form.contactName} onInput=${setF('contactName')} placeholder="Jane at Acme Marketing" /></${Field}>
        <${Field} label="Contact email"><${Input} value=${form.contactEmail} onInput=${setF('contactEmail')} placeholder="support@youragency.com" /></${Field}>
        <${Field} label="Phone"><${Input} value=${form.contactPhone} onInput=${setF('contactPhone')} placeholder="(555) 555-0100" /></${Field}>
        <${Field} label="Website"><${Input} value=${form.contactWebsite} onInput=${setF('contactWebsite')} placeholder="https://youragency.com" /></${Field}>
      </div>
      <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div class="text-sm font-medium text-slate-700">🔔 Social media director <span class="text-xs font-normal text-slate-400">— internal, never shown to businesses</span></div>
        <p class="text-xs text-slate-400 mt-0.5 mb-2">Gets an email when a client approves their social posts (with the auto-schedule result), and a heads-up when the approval loop needs a human eye — a client asking for a second round of changes, or posts that couldn't push to GoHighLevel. Leave empty to turn the alerts off.</p>
        <${Field} label="Alert email"><${Input} type="email" value=${form.socialDirectorEmail} onInput=${setF('socialDirectorEmail')} placeholder="director@youragency.com" /></${Field}>
      </div>
      <div class="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div class="text-sm font-medium text-slate-700">📝 Blog manager <span class="text-xs font-normal text-slate-400">— internal, never shown to businesses</span></div>
        <p class="text-xs text-slate-400 mt-0.5 mb-2">Gets an email every time an automated blog publishes to any client website (with the live link), and an alert when a client rejects 3 articles in a row and their autoblogger pauses. Leave empty to turn the alerts off.</p>
        <${Field} label="Alert email"><${Input} type="email" value=${form.blogManagerEmail} onInput=${setF('blogManagerEmail')} placeholder="content@youragency.com" /></${Field}>
      </div>
      ${err && html`<div class="text-sm text-rose-600 mt-2">${err}</div>`}
      <div class="mt-3"><${Btn} size="sm" onClick=${save} disabled=${busy}>${busy ? 'Saving…' : 'Save agency details'}</${Btn}></div>`}
  </div></${Card}>`;
}

// ONE-TIME Google Ads setup for the WHOLE PLATFORM. Google requires a developer
// token before any app can read Ads data (Gmail sign-in alone can't); there is
// exactly one, the platform operator's. The super-admin enters it once here
// (app_secrets.google_ads_developer_token) and from then on every user — this
// agency, other agencies, and businesses with their own ad account — just signs
// in with Google. Non-super owners only see the status, nothing to enter.
// Actual API spend per business for a month: AI text (seo_api_usage ledger),
// kie.ai images/video (real credits reported per task), geogrid map scans.
function ApiCostsCard() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setData(null); setErr(''); seoUsageSummary(month).then(setData).catch((e) => setErr(e.message)); }, [month]);
  const shift = (n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const usd = (v) => `$${(v || 0).toFixed(2)}`;
  const label = (() => { try { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }); } catch { return month; } })();
  const cur = new Date().toISOString().slice(0, 7);
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between gap-3 flex-wrap mb-1">
      <div class="font-semibold text-slate-800">💸 API costs by business <span class="text-xs font-normal text-slate-400">— what each account actually consumed</span></div>
      <div class="flex items-center gap-1 text-sm">
        <button onClick=${() => shift(-1)} class="px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">‹</button>
        <span class="font-medium text-slate-700 min-w-[9rem] text-center">${label}</span>
        <button onClick=${() => shift(1)} disabled=${month >= cur} class="px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">›</button>
      </div>
    </div>
    <p class="text-xs text-slate-400 mb-3">Images & video are actual kie.ai credits per generation; map scans are geogrid points at cost; keyword research is DataForSEO's own per-pull charge; notifications are emails sent (approval requests, alerts, digests) at the per-email rate. AI writing and notifications cover calls logged since tracking began${data?.ai_tracked_since ? ` (${new Date(data.ai_tracked_since).toLocaleDateString()})` : ''} — older activity predates the meter.</p>
    ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
    ${!err && data === null && html`<div class="text-sm text-slate-400">Loading…</div>`}
    ${data && (data.rows || []).length === 0 && html`<div class="text-sm text-slate-400 py-3 text-center">No usage recorded for ${label}.</div>`}
    ${data && data.rows?.length > 0 && html`
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-[11px] uppercase tracking-wide text-slate-400 text-left">
          <th class="py-1.5 pr-3 font-medium">Business</th>
          <th class="py-1.5 pr-3 font-medium text-right">AI writing</th>
          <th class="py-1.5 pr-3 font-medium text-right">Images & video</th>
          <th class="py-1.5 pr-3 font-medium text-right">Map scans</th>
          <th class="py-1.5 pr-3 font-medium text-right">Keyword research</th>
          <th class="py-1.5 pr-3 font-medium text-right">Notifications</th>
          <th class="py-1.5 font-medium text-right">Total</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-50">
          ${data.rows.map((r) => html`<tr>
            <td class="py-2 pr-3 text-slate-800">${r.name}</td>
            <td class="py-2 pr-3 text-right text-slate-600" title="${r.ai_calls} call(s) · ${r.ai_in + r.ai_out} tokens">${usd(r.ai_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600" title="${r.media_images} image(s), ${r.media_videos} video(s) · ${r.media_credits} credits">${usd(r.media_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600" title="${r.grid_scans} scan(s) · ${r.grid_points} grid points">${usd(r.grid_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600" title="${r.research_calls || 0} keyword research pull(s)">${usd(r.research_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600" title="${r.notif_emails || 0} email(s)">${usd(r.notif_usd)}</td>
            <td class="py-2 text-right font-semibold text-slate-800">${usd(r.total_usd)}</td>
          </tr>`)}
        </tbody>
        <tfoot><tr class="border-t border-slate-200">
          <td class="py-2 pr-3 text-xs text-slate-400">Agency total</td><td></td><td></td><td></td><td></td><td></td>
          <td class="py-2 text-right font-bold text-slate-900">${usd(data.totals?.usd)}</td>
        </tr></tfoot>
      </table></div>`}
  </div></${Card}>`;
}

function GoogleAdsTokenCard({ onBanner }) {
  const [st, setSt] = useState(null);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = () => seoAdsStatus().then(setSt).catch((e) => { setErr(e.message); setSt({}); });
  useEffect(() => { load(); }, []);
  const src = st?.dev_token_source;                 // 'platform' | 'agency' | 'account' | null
  const configured = src === 'platform' || src === 'agency' || src === 'account';
  const isSuper = !!st?.superadmin;
  const save = async () => {
    setBusy(true); setErr('');
    try { await seoAdsSetPlatformToken(token.trim()); setToken(''); setOpen(false); await load(); onBanner('✅ Google Ads is set up across the whole platform — everyone just signs in with Google now.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const clear = async () => {
    if (!confirm('Remove the platform Google Ads token? Reporting stops for every business until it is set again.')) return;
    setBusy(true); setErr('');
    try { await seoAdsClearPlatformToken(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
      <div class="font-semibold text-slate-800">Google Ads <span class="text-xs font-normal text-slate-400">— one-time setup for the whole platform</span></div>
      ${st !== null && (configured
        ? html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ connected</span>`
        : html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">not set</span>`)}
    </div>
    <p class="text-xs text-slate-400 mb-3">Google requires one developer token (Basic Access — from your Google Ads Manager account → API Center) before any app can read Ads data. Enter it once here and it covers the entire platform: your agency, every business, and any customer with their own ad account all just sign in with Google and pick their account. Nobody else ever sees this.</p>
    ${st === null ? html`<div class="text-sm text-slate-400">Loading…</div>`
      : configured
        ? html`<div class="text-sm text-emerald-700">✓ Connected for the whole platform. Everyone just signs in with Google and chooses their ad account.${src !== 'platform' ? ' (Currently using an agency-level token.)' : ''}
            ${isSuper && html`<div class="mt-2 flex gap-2"><${Btn} size="sm" onClick=${() => setOpen(!open)}>${open ? 'Cancel' : 'Replace token'}</${Btn}>${src === 'platform' ? html`<${Btn} size="sm" onClick=${clear} disabled=${busy}>Remove</${Btn}>` : ''}</div>`}
          </div>`
        : isSuper
          ? (open ? '' : html`<${Btn} size="sm" onClick=${() => setOpen(true)}>Add platform token</${Btn}>`)
          : html`<div class="text-sm text-slate-500">Your platform administrator is finishing Google Ads setup — there's nothing you need to do here.</div>`}
    ${isSuper && open && html`<div class="space-y-2 pt-3 max-w-md">
      <${Field} label="Developer token"><${Input} value=${token} onInput=${setToken} placeholder="From Google Ads Manager → API Center" /></${Field}>
      <${Btn} size="sm" onClick=${save} disabled=${busy || token.trim().length < 10}>${busy ? 'Saving…' : 'Save for the whole platform'}</${Btn}>
    </div>`}
    ${err && html`<div class="text-xs text-rose-600 mt-2">${err}</div>`}
  </div></${Card}>`;
}

export function AgencySettings() {
  const s = useStore();
  const myEmail = getUserEmail();
  const [agencyName, setAgencyName] = useState('');
  const [owners, setOwners] = useState(null);
  const [members, setMembers] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [aEmail, setAEmail] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mScope, setMScope] = useState('all'); // 'all' | 'some'
  const [mSel, setMSel] = useState(new Set());
  const [cred, setCred] = useState(null);
  const [banner, setBanner] = useState('');
  const [pwFor, setPwFor] = useState(null);
  const [acctFor, setAcctFor] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const ownerLevel = s.identity?.superAdmin || s.identity?.staffRole === 'owner';
  const load = async () => {
    const a = await seoAgencyList();
    setOwners(a.owners || []); setMembers(a.members || []);
    setAccounts((a.accounts || []).sort((x, y) => (x.name || '').localeCompare(y.name || '', undefined, { sensitivity: 'base' })));
    setAgencyName(a.agencyName || '');
  };
  useEffect(() => { if (ownerLevel) load().catch((e) => { setErr(e.message); setOwners([]); setMembers([]); }); }, [s.curAgency?.id]);

  const grantOwner = async () => {
    if (!aEmail.trim()) return;
    setBusy('grant'); setErr(''); setCred(null);
    try {
      const r = await seoAgencyGrant(aEmail.trim());
      if (r.created && r.tempPassword) setCred({ email: aEmail.trim(), password: r.tempPassword });
      setAEmail(''); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const grantMember = async () => {
    if (!mEmail.trim()) return;
    if (mScope === 'some' && mSel.size === 0) { setErr('Pick at least one business, or choose All businesses.'); return; }
    setBusy('mgrant'); setErr(''); setCred(null);
    try {
      const r = await seoMemberGrant(mEmail.trim(), mScope === 'all', mScope === 'some' ? [...mSel] : undefined);
      if (r.created && r.tempPassword) setCred({ email: mEmail.trim(), password: r.tempPassword });
      setMEmail(''); setMScope('all'); setMSel(new Set()); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const revokeOwner = async (st) => { if (!confirm(`Revoke agency-owner access for ${st.email || 'this user'}? They will be removed from every business in this agency.`)) return; setErr(''); try { await seoAgencyRevoke(st.userId); await load(); } catch (e) { setErr(e.message); } };
  const revokeMember = async (st) => { if (!confirm(`Remove agency member ${st.email || 'this user'}? They lose access to their businesses.`)) return; setErr(''); try { await seoMemberRevoke(st.userId); await load(); } catch (e) { setErr(e.message); } };
  const promote = async (st) => { if (!confirm(`Promote ${st.email || 'this member'} to agency OWNER (full access to every business)?`)) return; setErr(''); try { await seoMemberSetTier(st.userId, 'owner'); await load(); } catch (e) { setErr(e.message); } };
  const demote = async (st) => { if (!confirm(`Demote ${st.email || 'this owner'} to agency MEMBER? They keep all businesses but lose staff-management powers.`)) return; setErr(''); try { await seoMemberSetTier(st.userId, 'member'); await load(); } catch (e) { setErr(e.message); } };
  const sendReset = async (m) => { setErr(''); setBanner(''); try { const r = await seoTeamSendReset(m.userId); setBanner(`✉ Password-reset email sent to ${r.email || m.email}.`); } catch (e) { setErr(e.message); } };
  const mToggle = (id) => setMSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (!ownerLevel) return html`<div class="p-8 text-sm text-slate-400">Agency settings are for agency owners.</div>`;

  return html`<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
    <div>
      <h1 class="text-xl font-bold text-slate-800">⚙ Agency settings</h1>
      <p class="text-sm text-slate-500">Your agency's staff and contact details for <span class="font-medium">${agencyName || getCurrentAgency()?.name || 'your agency'}</span>. Who can access an individual business is managed on that business's Team tab.</p>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-sky-50 text-sky-800 flex items-center justify-between"><span class="break-all">${banner}</span><button onClick=${() => setBanner('')} class="opacity-60 hover:opacity-100 ml-2">✕</button></div>`}
    ${cred && html`<${TempPw} cred=${cred} onClose=${() => setCred(null)} />`}

    <${ContactCard} onBanner=${setBanner} />

    <${ApiCostsCard} />

    <${GoogleAdsTokenCard} onBanner=${setBanner} />

    <${Card}><div class="p-4 border-l-4 border-amber-300">
      <div class="font-semibold text-slate-800 mb-1">Agency owners <span class="text-xs font-normal text-slate-400">— full access to every business + staff management</span></div>
      <p class="text-xs text-slate-400 mb-3">Owners are added as admins to every business in this agency automatically (including new ones), receive the End-of-Day activity digest, and can manage all agency staff, businesses, and integrations.</p>
      ${owners === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
        <div class="divide-y divide-slate-50">
          ${owners.map((st) => html`<div class="flex items-center gap-3 py-2.5">
            <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm text-amber-700 shrink-0">${(st.email || '?')[0].toUpperCase()}</div>
            <div class="flex-1 min-w-0 text-sm text-slate-800 truncate">${st.email || st.userId}${st.email === myEmail ? html`<span class="text-xs text-slate-400"> (you)</span>` : ''}</div>
            <span class="text-[11px] text-slate-400">since ${new Date(st.grantedAt).toLocaleDateString()}</span>
            ${st.email !== myEmail && html`<button title="Set password directly" onClick=${() => setPwFor(st)} class="text-slate-400 hover:text-slate-700">🔑</button>`}
            ${st.email !== myEmail && html`<button title="Demote to agency member" onClick=${() => demote(st)} class="text-xs text-slate-400 hover:text-indigo-600 underline">demote</button>`}
            ${st.email !== myEmail && html`<button onClick=${() => revokeOwner(st)} class="text-xs text-slate-400 hover:text-rose-600 underline">revoke</button>`}
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
      <div class="font-semibold text-slate-800 mb-1">Agency members <span class="text-xs font-normal text-slate-400">— employees who work on this agency's businesses</span></div>
      <p class="text-xs text-slate-400 mb-3">Members get every business in this agency by default, or limit them to specific ones. Their activity shows up in your End-of-Day digest, broken down per person.</p>
      ${members === null ? html`<div class="text-sm text-slate-400">Loading…</div>` : html`
        <div class="divide-y divide-slate-50">
          ${members.length === 0 && html`<div class="text-sm text-slate-400 py-1">No agency members yet.</div>`}
          ${members.map((st) => html`<div class="flex items-center gap-3 py-2.5 flex-wrap">
            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm text-indigo-700 shrink-0">${(st.email || '?')[0].toUpperCase()}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-slate-800 truncate">${st.email || st.userId}</div>
              <span class=${cx('text-[10px] px-1.5 py-0.5 rounded', st.unrestricted ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700')}>${st.unrestricted ? 'All businesses' : `${(st.accounts || []).length} business(es)`}</span>
            </div>
            <button title="Set business access" onClick=${() => setAcctFor(st)} class="text-xs text-slate-500 hover:text-indigo-700 underline">businesses</button>
            <button title="Send password-reset email" onClick=${() => sendReset(st)} class="text-slate-400 hover:text-slate-700">✉</button>
            <button title="Set password directly" onClick=${() => setPwFor(st)} class="text-slate-400 hover:text-slate-700">🔑</button>
            <button title="Promote to agency owner" onClick=${() => promote(st)} class="text-xs text-slate-400 hover:text-amber-600 underline">make owner</button>
            <button onClick=${() => revokeMember(st)} class="text-xs text-slate-400 hover:text-rose-600 underline">remove</button>
          </div>`)}
        </div>
        <div class="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <div class="flex flex-wrap items-end gap-2">
            <div class="flex-1 min-w-[220px]">
              <label class="text-[11px] text-slate-400">Add member by email</label>
              <${Input} value=${mEmail} onInput=${setMEmail} placeholder="employee@youragency.com" />
            </div>
            <${Select} value=${mScope} onChange=${setMScope} options=${[{ value: 'all', label: 'All businesses' }, { value: 'some', label: 'Choose businesses' }]} />
            <${Btn} size="sm" variant="cta" onClick=${grantMember} disabled=${busy === 'mgrant'}>${busy === 'mgrant' ? 'Adding…' : '+ Add member'}</${Btn}>
          </div>
          ${mScope === 'some' && html`<div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            ${accounts.map((a) => html`<label class=${cx('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer', mSel.has(a.id) ? 'border-indigo-300 bg-indigo-50/50 text-slate-800' : 'border-slate-200 text-slate-500')}>
              <input type="checkbox" checked=${mSel.has(a.id)} onChange=${() => mToggle(a.id)} class="accent-indigo-600" />${a.name}
            </label>`)}
          </div>`}
        </div>
      `}
    </div></${Card}>

    <${JtAgencyCard} onBanner=${setBanner} />

    ${pwFor && html`<${PwModal} m=${pwFor} onClose=${() => setPwFor(null)} onSave=${async (pw) => { await seoTeamSetPassword(pwFor.userId, pw); setBanner(`🔑 Password updated for ${pwFor.email}.`); }} />`}
    ${acctFor && html`<${AccountsModal} m=${acctFor} accounts=${accounts} onClose=${() => setAcctFor(null)} onSave=${async (ids) => { await seoMemberSetAccounts(acctFor.userId, ids); await load(); }} />`}
  </div>`;
}
