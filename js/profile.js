// ---------------------------------------------------------------------------
// profile.js — 🏢 Business Profile: everything about ONE business in one
// place. Brand kit, marketing strategy (service pages + service area),
// photo sources, and integrations (WordPress, GoHighLevel, Job Tracker,
// plus links to the Google connections managed in their tabs).
// ---------------------------------------------------------------------------
import { html, useState, useEffect } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoWpStatus, jtStatus, jtListCompanies, jtLink, jtUnlink } from './store.js';
import { Card, Btn, Select } from './ui.js';
import { BrandKit, GhlCard, PhotoLibrary } from './social.js';
import { Strategy } from './strategy.js';

// WordPress status — the full connect/pairing panel stays in the Keywords
// tab (WordPress publishing); this card shows live state + deep link.
function WpStatusCard({ site }) {
  const [st, setSt] = useState(null);
  useEffect(() => { setSt(null); if (site) seoWpStatus(site).then(setSt).catch(() => setSt(false)); }, [site]);
  const live = st && st.live;
  return html`<${Card}><div class="p-4 flex items-center justify-between flex-wrap gap-2">
    <div class="min-w-0">
      <div class="font-semibold text-slate-800">🔌 WordPress <span class="text-xs font-normal text-slate-400">— publishing & site fixes</span></div>
      <div class="text-xs truncate ${live ? 'text-emerald-600' : 'text-slate-400'}">
        ${st === null ? 'Checking…' : live ? `Connected ✓ ${st.wp_url || ''}${st.plugin_version ? ` · Connector v${st.plugin_version}` : ''}` : 'Not connected — pair the Ops Dash Connector plugin.'}
      </div>
    </div>
    <a href="#/keywords" class="text-xs text-brand-700 underline shrink-0">${live ? 'Manage' : 'Connect'} in Keywords →</a>
  </div></${Card}>`;
}

// Job Tracker company link (account-level; linking is platform-admin only).
function JtLinkCard() {
  const [st, setSt] = useState(null);
  const [companies, setCompanies] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = () => jtStatus().then((r) => {
    setSt(r);
    if (r.agency && r.canManage && companies === null) jtListCompanies().then((c) => setCompanies(c.companies || [])).catch(() => setCompanies([]));
  }).catch((e) => { setErr(e.message); setSt(false); });
  useEffect(() => { load(); }, []);
  const doLink = async () => {
    setBusy(true); setErr('');
    try { await jtLink(pick); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="min-w-0">
        <div class="font-semibold text-slate-800">🧰 Job Tracker <span class="text-xs font-normal text-slate-400">— analytics + social photos + tasks</span></div>
        <div class="text-xs truncate ${st?.linkedCompanyId ? 'text-emerald-600' : 'text-slate-400'}">
          ${st === null ? 'Checking…' : st?.linkedCompanyId ? `Linked to ${st.linkedCompanyName || 'company'} ✓` : 'No Job Tracker company linked.'}
        </div>
      </div>
      ${st?.linkedCompanyId && st?.canManage && html`<button onClick=${async () => { if (confirm('Unlink this Job Tracker company?')) { await jtUnlink(); await load(); } }} class="text-xs text-slate-400 hover:text-rose-600 underline">unlink</button>`}
    </div>
    ${err && html`<div class="text-xs text-rose-600 mt-1">${err}</div>`}
    ${st?.canManage && !st?.linkedCompanyId && companies !== null && html`<div class="flex flex-wrap items-end gap-2 mt-2">
      <${Select} value=${pick} onChange=${setPick} options=${[{ value: '', label: '— choose a company —' }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} />
      <${Btn} size="sm" onClick=${doLink} disabled=${busy || !pick}>${busy ? 'Linking…' : 'Link company'}</${Btn}>
    </div>`}
  </div></${Card}>`;
}

export function Profile() {
  useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [photos, setPhotos] = useState(null);
  const [banner, setBanner] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading business profile…</div>`;
  if (sites.length === 0) return html`<div class="max-w-5xl mx-auto p-6"><${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}></div>`;

  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Business Profile</h1>
        <p class="text-sm text-slate-500">Everything about this business in one place — brand, strategy, photos, and connections.</p>
      </div>
      ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
    </div>
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-800 flex items-center justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60 ml-2">✕</button></div>`}

    <${BrandKit} site=${site} onBanner=${setBanner} />

    <div class="grid lg:grid-cols-2 gap-4 items-start">
      <${WpStatusCard} site=${site} />
      <${JtLinkCard} />
    </div>
    <${GhlCard} site=${site} onBanner=${setBanner} />
    <${PhotoLibrary} site=${site} onBanner=${setBanner} photos=${photos} setPhotos=${setPhotos} />

    <${Card}><div class="p-4">
      <div class="font-semibold text-slate-800 mb-1">🔗 Google connections</div>
      <div class="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
        <a href="#/seo" class="text-brand-700 underline">Search Console → SEO tab</a>
        <a href="#/analytics" class="text-brand-700 underline">Analytics (GA4) → Analytics tab</a>
        <a href="#/ads" class="text-brand-700 underline">Google Ads → Google Ads tab</a>
        <a href="#/local" class="text-brand-700 underline">Business Profile (GBP) → Local tab</a>
      </div>
    </div></${Card}>

    <div>
      <div class="text-sm font-semibold text-slate-700 mb-2 mt-2">🎯 Marketing strategy</div>
      <${Strategy} site=${site} embedded=${true} />
    </div>
  </div>`;
}
