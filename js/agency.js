// ---------------------------------------------------------------------------
// agency.js — Agency Settings (⚙ in the sidebar; agency owners + supers).
// Everything agency-level lives here, NOT on a business's Team tab:
//  - contact details shown to every business on their Team tab
//  - agency owners (full access to every business in the agency)
//  - agency members (employees, all businesses or a chosen subset)
//  - the agency's own Job Tracker link + task assignment
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getUserEmail, getCurrentAgency, seoAgencyList, seoAgencyGrant, seoAgencyRevoke, seoMemberGrant, seoMemberSetAccounts, seoMemberSetTier, seoMemberRevoke, seoTeamSendReset, seoTeamSetPassword, seoAgencyInfo, seoAgencyUpdateInfo, seoAdsStatus, seoAdsSetPlatformToken, seoAdsClearPlatformToken, seoUsageSummary, seoGbpAgencyStatus, seoGbpAgencyConnect, seoGbpAgencyDisconnect, seoGbpAgencyPortfolio, seoBingAgencyStatus, seoBingAgencyConnect, seoBingAgencyDisconnect, seoBingAgencyPortfolio, blOverview, blSync, blLink, blUnlink } from './store.js';
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
// AI visibility (the same ledger, split out by the 'ai-visibility-' feature
// prefix so multi-provider answer-engine spend never lands in AI writing),
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
    <p class="text-xs text-slate-400 mb-3">Images & video are actual kie.ai credits per generation; map scans are geogrid points at cost; local intel is competitor Google Business scrapes at PlePer’s per-credit rate; keyword research is DataForSEO's own per-pull charge; AI visibility is every answer-engine probe, extraction and suggestion run (across all model providers, billed at each provider's rate); notifications are emails sent (approval requests, alerts, digests) at the per-email rate. AI writing and notifications cover calls logged since tracking began${data?.ai_tracked_since ? ` (${new Date(data.ai_tracked_since).toLocaleDateString()})` : ''} — older activity predates the meter.</p>
    ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
    ${!err && data === null && html`<div class="text-sm text-slate-400">Loading…</div>`}
    ${data && (data.rows || []).length === 0 && html`<div class="text-sm text-slate-400 py-3 text-center">No usage recorded for ${label}.</div>`}
    ${data && data.rows?.length > 0 && html`
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-[11px] uppercase tracking-wide text-slate-400 text-left">
          <th class="py-1.5 pr-3 font-medium">Business</th>
          <th class="py-1.5 pr-3 font-medium text-right whitespace-nowrap">AI writing</th>
          <th class="py-1.5 pr-3 font-medium text-right whitespace-nowrap">AI visibility</th>
          <th class="py-1.5 pr-3 font-medium text-right whitespace-nowrap">Images & video</th>
          <th class="py-1.5 pr-3 font-medium text-right whitespace-nowrap">Map scans</th>
          <th class="py-1.5 pr-3 font-medium text-right whitespace-nowrap">Keyword research</th>
          <th class="py-1.5 pr-3 font-medium text-right whitespace-nowrap">Local intel</th>
          <th class="py-1.5 pr-3 font-medium text-right whitespace-nowrap">Notifications</th>
          <th class="py-1.5 font-medium text-right whitespace-nowrap">Total</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-50">
          ${data.rows.map((r) => html`<tr>
            <td class="py-2 pr-3 text-slate-800">${r.name}</td>
            <td class="py-2 pr-3 text-right text-slate-600 whitespace-nowrap" title="${r.ai_calls} call(s) · ${r.ai_in + r.ai_out} tokens">${usd(r.ai_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600 whitespace-nowrap" title="${r.aivis_calls || 0} answer-engine call(s) · ${(r.aivis_in || 0) + (r.aivis_out || 0)} tokens">${usd(r.aivis_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600 whitespace-nowrap" title="${r.media_images} image(s), ${r.media_videos} video(s) · ${r.media_credits} credits">${usd(r.media_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600 whitespace-nowrap" title="${r.grid_scans} scan(s) · ${r.grid_points} grid points">${usd(r.grid_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600 whitespace-nowrap" title="${r.research_calls || 0} keyword research pull(s)">${usd(r.research_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600 whitespace-nowrap" title="${r.local_scrapes || 0} Google Business scrape(s) · ${r.local_credits || 0} credits">${usd(r.local_usd)}</td>
            <td class="py-2 pr-3 text-right text-slate-600 whitespace-nowrap" title="${r.notif_emails || 0} email(s)">${usd(r.notif_usd)}</td>
            <td class="py-2 text-right font-semibold text-slate-800 whitespace-nowrap">${usd(r.total_usd)}</td>
          </tr>`)}
        </tbody>
        <tfoot><tr class="border-t border-slate-200">
          <td class="py-2 pr-3 text-xs text-slate-400">Agency total</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
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

// ONE Google Business Profile sign-in for the entire agency. Agencies normally
// hold manager access to every client's profile under a single Google login, so
// signing in here once replaces a separate OAuth dance per business — each
// business then just picks its profile out of the portfolio (Local → Profile).
// Citations (BrightLocal). PHASE 1 = mapping + visibility only.
//
// This card deliberately cannot BUILD citations. Confirming a Citation Builder
// campaign spends credits AND submits the client's name/address/phone to
// public directories — the money comes back, the bad NAP does not. So the
// order is: prove the mapping is right and make the existing state visible
// first, then put building behind an explicit confirm with a NAP pre-flight.
function CitationsCard({ onBanner }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = () => blOverview().then(setSt).catch((e) => {
    if (/unknown action|not authorized/i.test(e.message || '')) setSt({ pending: true });
    else { setErr(e.message); setSt({}); }
  });
  useEffect(() => { load(); }, []);

  const sync = async () => {
    setBusy('sync'); setErr('');
    try {
      const d = await blSync();
      await load();
      onBanner(`✅ BrightLocal synced — ${d.locations} location(s), ${d.campaigns} campaign(s), ${d.matched} linked to a business.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const link = async (locationId, accountId) => {
    if (!accountId) return;
    setBusy(`l${locationId}`); setErr('');
    try { await blLink(locationId, accountId); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const unlink = async (locationId) => {
    setBusy(`u${locationId}`); setErr('');
    try { await blUnlink(locationId); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const locs = st?.locations || [];
  const camps = st?.campaigns || [];
  const accounts = st?.accounts || [];
  const linked = locs.filter((l) => l.account_id);
  const unmatched = locs.filter((l) => !l.account_id);
  const paid = camps.filter((c) => c.paid === true);
  const drafts = camps.filter((c) => c.paid === false || c.status === 'saved');
  const built = paid.reduce((a, c) => a + (c.citations_ordered || 0), 0);
  const acctName = (id) => accounts.find((a) => a.id === id)?.name || '—';

  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
      <div class="font-semibold text-slate-800">🔗 Citations <span class="text-xs font-normal text-slate-400">— BrightLocal listings</span></div>
      ${st !== null && !st.pending && html`<span class=${cx('text-[11px] px-2 py-0.5 rounded-full', (st.credits || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
        ${(st.credits || 0) > 0 ? `${st.credits} credits` : 'no credits'}
      </span>`}
    </div>
    <p class="text-xs text-slate-400 mb-3">Mirrors your BrightLocal account so citation work shows up next to everything else. Read-only for now — buying a campaign spends credits and pushes the business's name, address and phone out to public directories, so that step will sit behind its own confirmation rather than a button here.</p>

    ${st === null ? html`<div class="text-sm text-slate-400">Loading…</div>`
      : st.pending ? html`<div class="text-sm text-slate-500">Citations aren't switched on for this dashboard yet.</div>`
      : html`
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Citations built</div><div class="text-lg font-bold text-slate-800 tabular-nums">${built}</div></div>
        <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Businesses linked</div><div class="text-lg font-bold text-slate-800 tabular-nums">${linked.length}<span class="text-xs font-normal text-slate-400"> / ${locs.length}</span></div></div>
        <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Paid campaigns</div><div class="text-lg font-bold text-slate-800 tabular-nums">${paid.length}</div></div>
        <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Unbought drafts</div><div class=${cx('text-lg font-bold tabular-nums', drafts.length ? 'text-amber-600' : 'text-slate-800')}>${drafts.length}</div></div>
      </div>

      ${(st.credits || 0) === 0 && html`<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        No citation credits on the account. Campaigns can be planned, but nothing can be submitted until credits are bought in BrightLocal.
      </div>`}

      ${paid.length > 0 && html`<div class="mt-3">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Already built</div>
        <div class="space-y-1">
          ${paid.map((c) => html`
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="truncate text-slate-700">${c.account_id ? acctName(c.account_id) : (c.name || 'Unlinked location')}</span>
              <span class="shrink-0 text-xs text-slate-400 tabular-nums">
                ${c.citations_ordered} listings · ${c.package_id} · ${c.submission_date ? new Date(c.submission_date).toLocaleDateString() : c.status}
              </span>
            </div>`)}
        </div>
      </div>`}

      ${drafts.length > 0 && html`<div class="mt-3">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Started but never bought</div>
        <div class="space-y-1">
          ${drafts.map((c) => html`
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="truncate text-slate-700">${c.account_id ? acctName(c.account_id) : (c.name || 'Unlinked location')}</span>
              <span class="shrink-0 text-xs text-amber-600">draft${c.creation_date ? ` · ${new Date(c.creation_date).toLocaleDateString()}` : ''}</span>
            </div>`)}
        </div>
      </div>`}

      ${unmatched.length > 0 && html`<div class="mt-3">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">In BrightLocal, not matched to a business</div>
        <div class="space-y-1.5">
          ${unmatched.map((l) => html`
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="min-w-0">
                <div class="text-sm text-slate-700 truncate">${l.business_name}</div>
                <div class="text-[11px] text-slate-400 truncate">${[l.city, l.website_url].filter(Boolean).join(' · ')}</div>
              </div>
              <${Select} value="" onChange=${(v) => v && link(l.location_id, v)}
                options=${[{ value: '', label: 'Link to…' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]} />
            </div>`)}
        </div>
        <div class="text-[11px] text-slate-400 mt-1.5">Leave these unlinked if they are no longer clients — nothing syncs for a location that is not attached to a business.</div>
      </div>`}

      ${linked.length > 0 && html`<details class="mt-3">
        <summary class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 cursor-pointer">Linked locations (${linked.length})</summary>
        <div class="space-y-1 mt-1.5">
          ${linked.map((l) => html`
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="truncate text-slate-700">${l.business_name} <span class="text-slate-400">→ ${acctName(l.account_id)}</span></span>
              <span class="shrink-0 flex items-center gap-2">
                <span class="text-[11px] text-slate-400">${l.match_method === 'manual' ? 'set by hand' : l.match_method === 'auto_domain' ? 'matched by website' : 'matched by name'}</span>
                <button onClick=${() => unlink(l.location_id)} disabled=${busy === `u${l.location_id}`} class="text-[11px] text-slate-400 hover:text-rose-600 underline">unlink</button>
              </span>
            </div>`)}
        </div>
      </details>`}

      <div class="flex flex-wrap items-center gap-2 mt-3">
        <${Btn} size="sm" variant="secondary" onClick=${sync} disabled=${busy === 'sync'}>${busy === 'sync' ? 'Syncing…' : '↻ Sync from BrightLocal'}</${Btn}>
        <span class="text-[11px] text-slate-400">Runs automatically once a day.</span>
      </div>`}
    ${err && html`<div class="text-xs text-rose-600 mt-2">${err}</div>`}
  </div></${Card}>`;
}

function GbpAgencyCard({ onBanner }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  // Until seo-gbp v8 is deployed the agency actions don't exist yet — stay
  // quietly inert rather than showing the raw "No account."/"Unknown action".
  const load = () => seoGbpAgencyStatus().then(setSt).catch((e) => {
    if (/no account|unknown action/i.test(e.message || '')) setSt({ connected: false, canManage: false, pending: true });
    else { setErr(e.message); setSt({}); }
  });
  useEffect(() => {
    load();
    // Returning from Google's consent screen (seo-gbp-callback → ?gbp=agency).
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('gbp') === 'agency') { onBanner('✅ Google Business Profile connected for the agency — every business can now pick its profile from the portfolio.'); history.replaceState(null, '', location.pathname + location.hash); }
      else if (q.get('gbp') === 'error') { setErr('Google sign-in did not complete. Try again.'); history.replaceState(null, '', location.pathname + location.hash); }
    } catch { /* ignore */ }
  }, []);
  const connect = async () => {
    setBusy('connect'); setErr('');
    try { const d = await seoGbpAgencyConnect(); location.href = d.url; }
    catch (e) { setErr(e.message); setBusy(''); }
  };
  const refresh = async () => {
    setBusy('refresh'); setErr('');
    try { const d = await seoGbpAgencyPortfolio(true); await load(); if (d.note) onBanner(d.note); else onBanner(`✅ Portfolio refreshed — ${(d.locations || []).length} profile(s) reachable.`); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const disconnect = async () => {
    if (!confirm('Disconnect the agency Google Business Profile sign-in?\n\nBusinesses using it lose their live profile data until the agency signs in again (or each one connects its own Google account). Nothing changes on Google itself.')) return;
    setBusy('disc'); setErr('');
    try { await seoGbpAgencyDisconnect(); await load(); onBanner('Agency Google Business Profile sign-in removed.'); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const stale = st?.portfolio_at && (Date.now() - new Date(st.portfolio_at).getTime()) > 86400000;
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
      <div class="font-semibold text-slate-800">📍 Google Business Profile <span class="text-xs font-normal text-slate-400">— one sign-in for every client profile</span></div>
      ${st !== null && !st.pending && (st.connected
        ? html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ connected</span>`
        : html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">not connected</span>`)}
    </div>
    <p class="text-xs text-slate-400 mb-3">Sign in once with the Google account that already manages your clients' profiles. Every business then just picks its profile from that portfolio — no separate Google sign-in per client. It also keeps you well clear of Google's ~100-live-token limit per Google account, which is what used to knock connections offline: one grant instead of one per business. Businesses whose owner keeps their own Google account can still connect it themselves on their Local tab; that keeps working exactly as before.</p>
    ${st === null ? html`<div class="text-sm text-slate-400">Loading…</div>`
      : st.connected ? html`
        <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div class="text-sm text-slate-800">Signed in as <span class="font-medium">${st.email || 'a Google account'}</span></div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Profiles reachable</div><div class="text-lg font-bold text-slate-800 tabular-nums">${st.locations == null ? '—' : st.locations.toLocaleString()}</div></div>
            <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Google accounts</div><div class="text-lg font-bold text-slate-800 tabular-nums">${st.accounts == null ? '—' : st.accounts}</div></div>
            <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Businesses using it</div><div class="text-lg font-bold text-slate-800 tabular-nums">${st.attached || 0}<span class="text-xs font-normal text-slate-400"> / ${st.businesses || 0}</span></div></div>
          </div>
          <div class="text-[11px] text-slate-400 mt-2">
            ${st.portfolio_at ? `Portfolio listed ${new Date(st.portfolio_at).toLocaleString()}${stale ? ' — refresh to pick up new client profiles' : ''}` : 'Portfolio not listed yet — refresh to pull it from Google.'}
          </div>
          ${st.canManage && html`<div class="flex flex-wrap items-center gap-2 mt-3">
            <${Btn} size="sm" variant="secondary" onClick=${refresh} disabled=${busy === 'refresh'}>${busy === 'refresh' ? 'Listing profiles…' : '↻ Refresh portfolio'}</${Btn}>
            <${Btn} size="sm" variant="ghost" onClick=${connect} disabled=${busy === 'connect'}>${busy === 'connect' ? 'Redirecting…' : '🔑 Sign in again'}</${Btn}>
            <button onClick=${disconnect} disabled=${busy === 'disc'} class="text-xs text-slate-400 hover:text-rose-600 underline">Disconnect</button>
          </div>`}
        </div>`
      : st.pending ? html`<div class="text-sm text-slate-500">Agency sign-in isn't switched on for this dashboard yet.</div>`
      : st.canManage ? html`<${Btn} size="sm" variant="cta" onClick=${connect} disabled=${busy === 'connect'}>${busy === 'connect' ? 'Redirecting…' : 'Sign in with Google'}</${Btn}>`
        : html`<div class="text-sm text-slate-500">An agency owner needs to sign in before profiles can be picked from the portfolio.</div>`}
    ${err && html`<div class="text-xs text-rose-600 mt-2">${err}</div>`}
  </div></${Card}>`;
}

// Bing Webmaster Tools — the Search Console of the Microsoft side, and the
// index that feeds Copilot and ChatGPT search. Agency-first for a harder reason
// than GBP: a Bing API KEY only ever covers one Bing account, so OAuth is the
// only thing that makes this work for more than one agency.
function BingAgencyCard({ onBanner }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = () => seoBingAgencyStatus().then(setSt).catch((e) => {
    if (/no account|unknown action/i.test(e.message || '')) setSt({ connected: false, canManage: false, pending: true });
    else { setErr(e.message); setSt({}); }
  });
  useEffect(() => {
    load();
    // Returning from Bing's consent screen (seo-bing-callback → ?bing=agency).
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('bing') === 'agency') { onBanner('✅ Bing connected for the agency — every business can now pick its verified site.'); history.replaceState(null, '', location.pathname + location.hash); }
      else if (q.get('bing') === 'error') { setErr('Bing sign-in did not complete. Try again.'); history.replaceState(null, '', location.pathname + location.hash); }
    } catch { /* ignore */ }
  }, []);
  const connect = async () => {
    setBusy('connect'); setErr('');
    try { const d = await seoBingAgencyConnect(); location.href = d.url; }
    catch (e) { setErr(e.message); setBusy(''); }
  };
  const refresh = async () => {
    setBusy('refresh'); setErr('');
    try { const d = await seoBingAgencyPortfolio(true); await load(); onBanner(`✅ Site list refreshed — ${(d.sites || []).length} verified site(s) reachable.`); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const disconnect = async () => {
    if (!confirm('Disconnect the agency Bing sign-in?\n\nBusinesses using it lose their Bing data until the agency signs in again. Nothing changes inside Bing Webmaster Tools itself.')) return;
    setBusy('disc'); setErr('');
    try { await seoBingAgencyDisconnect(); await load(); onBanner('Agency Bing sign-in removed.'); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const stale = st?.portfolio_at && (Date.now() - new Date(st.portfolio_at).getTime()) > 86400000;
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
      <div class="font-semibold text-slate-800">🔎 Bing Webmaster Tools <span class="text-xs font-normal text-slate-400">— one sign-in for every client site</span></div>
      ${st !== null && !st.pending && (st.connected
        ? html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ connected</span>`
        : html`<span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">not connected</span>`)}
    </div>
    <p class="text-xs text-slate-400 mb-3">Sign in once with the Bing account that holds your clients' verified sites — every business then picks its site from that list. Bing matters more than its search share suggests: it is the index behind Copilot and ChatGPT search, so this is where AI-search visibility is measured from the index side. We ask for <span class="font-medium">read-only</span> access; we can never submit or remove URLs on a client site.</p>
    <p class="text-xs text-slate-400 mb-3">⚠️ Bing only returns data for sites <span class="font-medium">verified in that Bing account</span>. If yours are empty, open Bing Webmaster Tools and use <span class="font-medium">Import from Google Search Console</span> — it carries the verification across for every property at once, with no DNS changes.</p>
    ${st === null ? html`<div class="text-sm text-slate-400">Loading…</div>`
      : st.connected ? html`
        <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div class="text-sm text-slate-800">Signed in${st.email ? html` as <span class="font-medium">${st.email}</span>` : ' to Bing'}</div>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Verified sites</div><div class="text-lg font-bold text-slate-800 tabular-nums">${st.sites == null ? '—' : st.sites.toLocaleString()}</div></div>
            <div class="rounded-lg bg-white border border-slate-200 p-2.5"><div class="text-[11px] text-slate-400">Businesses using it</div><div class="text-lg font-bold text-slate-800 tabular-nums">${st.attached || 0}<span class="text-xs font-normal text-slate-400"> / ${st.businesses || 0}</span></div></div>
          </div>
          <div class="text-[11px] text-slate-400 mt-2">
            ${st.portfolio_at ? `Site list read ${new Date(st.portfolio_at).toLocaleString()}${stale ? ' — refresh to pick up newly verified sites' : ''}` : 'Site list not read yet — refresh to pull it from Bing.'}
          </div>
          ${st.canManage && html`<div class="flex flex-wrap items-center gap-2 mt-3">
            <${Btn} size="sm" variant="secondary" onClick=${refresh} disabled=${busy === 'refresh'}>${busy === 'refresh' ? 'Listing sites…' : '↻ Refresh site list'}</${Btn}>
            <${Btn} size="sm" variant="ghost" onClick=${connect} disabled=${busy === 'connect'}>${busy === 'connect' ? 'Redirecting…' : '🔑 Sign in again'}</${Btn}>
            <button onClick=${disconnect} disabled=${busy === 'disc'} class="text-xs text-slate-400 hover:text-rose-600 underline">Disconnect</button>
          </div>`}
        </div>`
      : st.pending ? html`<div class="text-sm text-slate-500">Bing isn't switched on for this dashboard yet.</div>`
      : st.canManage ? html`<${Btn} size="sm" variant="cta" onClick=${connect} disabled=${busy === 'connect'}>${busy === 'connect' ? 'Redirecting…' : 'Sign in with Bing'}</${Btn}>`
        : html`<div class="text-sm text-slate-500">An agency owner needs to sign in before sites can be picked.</div>`}
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

    <${GbpAgencyCard} onBanner=${setBanner} />
    <${BingAgencyCard} onBanner=${setBanner} />

    <${CitationsCard} onBanner=${setBanner} />

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
