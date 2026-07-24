// ---------------------------------------------------------------------------
// social.js — Social Media Manager: curate a month of posts per business.
// Brand kit (phone/website/logo/colors) → AI 30-day calendar (pillars, times,
// cities, services from the Strategy tab) → written captions + hooks → brand-
// injected images (nano-banana) and Reels (Kling) → review/approve.
// Scheduling/publishing happens in GoHighLevel — this tab curates.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoSocialProfile, seoSocialProfileSave, seoSocialLogoUpload, seoSocialPlanMonth, seoSocialWriteBatch, seoSocialMediaBatch, seoSocialRegenMedia, seoSocialRefresh, seoSocialCalendar, seoSocialUpdatePost, seoSocialApprove, seoSocialReject, seoSocialApproveAll, seoSocialGhlStatus, seoSocialGhlConnect, seoSocialGhlSetAccounts, seoSocialGhlDisconnect, seoSocialGhlPush, seoSocialGhlOauthStart, seoSocialGhlRefreshAccounts, seoSocialPhotos, seoSocialDriveLink, seoSocialPhotosSync, seoSocialPhotoDelete, seoSocialDriveOauthStart, seoSocialDriveStatus, seoSocialDriveFolders, seoSocialDrivePick, seoSocialDriveDisconnect, seoPhotoCatalog, seoPhotoAnalyze, seoPhotoMatch } from './store.js';
import { Card, Btn, Input, Textarea, Select, Field } from './ui.js';

const PILLAR = {
  educational: ['📘', 'bg-sky-100 text-sky-700'],
  proof: ['🏆', 'bg-emerald-100 text-emerald-700'],
  local: ['📍', 'bg-amber-100 text-amber-700'],
  bts: ['👷', 'bg-violet-100 text-violet-700'],
  engagement: ['💬', 'bg-pink-100 text-pink-700'],
  promo: ['🏷️', 'bg-rose-100 text-rose-700'],
};
const STATUS = {
  planned: 'bg-slate-100 text-slate-500',
  written: 'bg-sky-100 text-sky-700',
  media_pending: 'bg-amber-100 text-amber-700',
  ready: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-600',
};
const PLATFORMS = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['gbp', 'Google Business'], ['tiktok', 'TikTok']];
// Status filter chips for the calendar card grid.
const POST_FILTERS = [
  ['all', 'All', () => true],
  ['ready', '👀 To review', (p) => p.status === 'ready'],
  ['approved', '✓ Approved', (p) => p.status === 'approved' && !p.ghl_post_id],
  ['draft', '✍️ Drafting', (p) => p.status === 'planned' || p.status === 'written'],
  ['media_pending', '🎨 Generating', (p) => p.status === 'media_pending'],
  ['pushed', '🚀 Scheduled', (p) => !!p.ghl_post_id],
  ['rejected', '✕ Rejected', (p) => p.status === 'rejected'],
];
// Shown when the browser can't decode a stored photo (e.g. a raw HEIC that
// hasn't been converted yet) — Sync re-imports/converts and clears these.
const BROKEN_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112"><rect width="112" height="112" fill="#f1f5f9"/><text x="56" y="50" text-anchor="middle" font-size="12" fill="#94a3b8" font-family="sans-serif">not viewable</text><text x="56" y="68" text-anchor="middle" font-size="12" fill="#94a3b8" font-family="sans-serif">press Sync</text></svg>');
const imgFallback = (e) => { if (e.target.src !== BROKEN_IMG) e.target.src = BROKEN_IMG; };
const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function BrandKit({ site, onBanner }) {
  const [p, setP] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [f, setF] = useState({});

  useEffect(() => {
    setP(null); setLogoUrl(null); setOpen(false);
    if (site) seoSocialProfile(site).then((r) => {
      setP(r.profile || {}); setLogoUrl(r.logoUrl);
      const pr = r.profile || {};
      setF({ phone: pr.phone || '', website: pr.website || '', bookingUrl: pr.booking_url || '', brandColor1: pr.brand_color1 || '', brandColor2: pr.brand_color2 || '', voiceNotes: pr.voice_notes || '', postsPerDay: pr.plan?.postsPerDay || 1, reelsPerMonth: pr.plan?.reelsPerMonth ?? 3, platforms: new Set(pr.plan?.platforms || ['facebook', 'instagram']) });
      if (!r.profile) setOpen(true);
    }).catch((e) => { setErr(e.message); setP({}); });
  }, [site]);

  const save = async () => {
    setBusy('save'); setErr('');
    try {
      await seoSocialProfileSave(site, { phone: f.phone, website: f.website, bookingUrl: f.bookingUrl, brandColor1: f.brandColor1, brandColor2: f.brandColor2, voiceNotes: f.voiceNotes, plan: { postsPerDay: Number(f.postsPerDay), reelsPerMonth: Number(f.reelsPerMonth), platforms: [...f.platforms] } });
      onBanner('✅ Brand kit saved.'); setOpen(false);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const upload = (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setErr('Logo must be under 3MB.'); return; }
    setBusy('logo'); setErr('');
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const b64 = String(rd.result).split(',')[1];
        await seoSocialLogoUpload(site, b64, file.type);
        // Trust only what the server persisted — re-read the profile so the
        // preview can never show a logo the database doesn't actually have.
        const r = await seoSocialProfile(site);
        if (r.logoUrl) { setLogoUrl(r.logoUrl); onBanner('🖼 Logo saved — it will be placed on every generated image.'); }
        else { setLogoUrl(null); setErr('The logo did not persist — please try the upload again.'); }
      } catch (e) { setErr(`Logo upload failed: ${e.message}`); } finally { setBusy(''); }
    };
    rd.onerror = () => { setErr('Could not read that file — try a PNG or JPEG.'); setBusy(''); };
    rd.readAsDataURL(file);
  };
  const togglePlat = (id) => setF((x) => { const n = new Set(x.platforms); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, platforms: n }; });

  if (p === null) return html`<${Card}><div class="p-4 text-sm text-slate-400">Loading brand kit…</div></${Card}>`;
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-3 min-w-0">
        ${logoUrl ? html`<img src=${logoUrl} alt="logo" class="h-9 w-9 rounded-lg object-contain bg-white border border-slate-100" />` : html`<div class="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">🏷</div>`}
        <div class="min-w-0">
          <div class="font-semibold text-slate-800">Brand kit & plan</div>
          <div class="text-xs text-slate-400 truncate">${[f.phone, f.website].filter(Boolean).join(' · ') || 'Phone, website, logo and colors — injected into every generated image.'} · ${f.postsPerDay}/day · ${f.reelsPerMonth} Reels/mo</div>
        </div>
      </div>
      <${Btn} size="sm" variant=${open ? 'ghost' : 'secondary'} onClick=${() => setOpen(!open)}>${open ? 'Close' : '✏️ Edit'}</${Btn}>
    </div>
    ${err && html`<div class="text-xs text-rose-600 mt-2">${err}</div>`}
    ${open && html`<div class="mt-3 pt-3 border-t border-slate-100 space-y-3">
      <div class="grid sm:grid-cols-2 gap-3">
        <${Field} label="Phone (shown on promos + CTAs)"><${Input} value=${f.phone} onInput=${(v) => setF({ ...f, phone: v })} placeholder="(352) 555-0134" /></${Field}>
        <${Field} label="Website"><${Input} value=${f.website} onInput=${(v) => setF({ ...f, website: v })} placeholder="https://acme.com" /></${Field}>
        <${Field} label="Booking link (optional)"><${Input} value=${f.bookingUrl} onInput=${(v) => setF({ ...f, bookingUrl: v })} placeholder="https://acme.com/book" /></${Field}>
        <div class="grid grid-cols-2 gap-2">
          <${Field} label="Brand color 1"><${Input} value=${f.brandColor1} onInput=${(v) => setF({ ...f, brandColor1: v })} placeholder="#0f766e" /></${Field}>
          <${Field} label="Brand color 2"><${Input} value=${f.brandColor2} onInput=${(v) => setF({ ...f, brandColor2: v })} placeholder="#f59e0b" /></${Field}>
        </div>
      </div>
      <${Field} label="Voice notes (optional — tone, do/don't say)"><${Textarea} value=${f.voiceNotes} onInput=${(v) => setF({ ...f, voiceNotes: v })} rows=${2} placeholder="Family-owned since 2004; never mention competitor names; friendly but no slang…" /></${Field}>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="text-[11px] text-slate-400 block mb-1">Logo (PNG with transparency works best)</label>
          <div class="flex items-center gap-2">
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled=${busy === 'logo'} onChange=${(e) => upload(e.target.files?.[0])} class="text-xs" />
            ${busy === 'logo' && html`<span class="text-xs text-sky-600 animate-pulse whitespace-nowrap">Uploading…</span>`}
          </div>
        </div>
        <${Select} value=${String(f.postsPerDay)} onChange=${(v) => setF({ ...f, postsPerDay: v })} options=${[{ value: '1', label: '1 post / day' }, { value: '2', label: '2 posts / day' }, { value: '3', label: '3 posts / day' }]} />
        <${Select} value=${String(f.reelsPerMonth)} onChange=${(v) => setF({ ...f, reelsPerMonth: v })} options=${[0, 2, 3, 4, 6, 8, 12].map((n) => ({ value: String(n), label: `${n} Reels / month` }))} />
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${PLATFORMS.map(([id, label]) => html`<button onClick=${() => togglePlat(id)}
          class=${cx('text-xs px-2.5 py-1 rounded-full border', f.platforms?.has(id) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500')}>${label}</button>`)}
      </div>
      <${Btn} onClick=${save} disabled=${busy === 'save'}>${busy === 'save' ? 'Saving…' : 'Save brand kit'}</${Btn}>
    </div>`}
  </div></${Card}>`;
}

const PLAT_ICON = { facebook: '📘', instagram: '📸', google: '🅶', gmb: '🅶', tiktok: '🎵', 'tiktok-business': '🎵', linkedin: '💼', twitter: '🐦' };

// Real-photo library: pull from a link-shared Google Drive folder and/or the
// linked Job Tracker company's photos tagged "social". These photos become
// reference images for generation (authentic proof/BTS posts).
export function PhotoLibrary({ site, onBanner, photos, setPhotos }) {
  const [driveUrl, setDriveUrl] = useState('');
  const [jtLinked, setJtLinked] = useState(false);
  const [drive, setDrive] = useState({ connected: false, email: null, folderId: null, folderName: null });
  const [folders, setFolders] = useState(null);
  const [folderQ, setFolderQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = () => seoSocialPhotos(site).then((r) => {
    setPhotos(r.photos || []); setDriveUrl(r.driveFolderUrl || ''); setJtLinked(!!r.jtLinked);
    setDrive({ connected: !!r.driveConnected, email: r.driveEmail || null, folderId: r.driveFolderId || null, folderName: r.driveFolderName || r.driveFolderUrl || null });
  }).catch((e) => { setErr(e.message); setPhotos([]); });
  useEffect(() => { setPhotos(null); setErr(''); setOpen(false); setFolders(null); if (site) load(); }, [site]);

  // Google sign-in: open consent in a new tab, poll until the callback lands.
  const signInGoogle = async () => {
    setBusy('goauth'); setErr('');
    try {
      const r = await seoSocialDriveOauthStart(site);
      window.open(r.url, '_blank', 'noopener');
      let ticks = 0;
      const iv = setInterval(async () => {
        ticks++;
        if (ticks > 45) { clearInterval(iv); setBusy(''); return; }
        try {
          const s = await seoSocialDriveStatus(site);
          if (s.connected) {
            clearInterval(iv); setBusy('');
            setDrive({ connected: true, email: s.email, folderId: s.folderId, folderName: s.folderName });
            onBanner(`📁 Google Drive connected${s.email ? ` as ${s.email}` : ''} — now pick the photo folder.`);
          }
        } catch (_) { /* keep polling */ }
      }, 4000);
    } catch (e) { setErr(e.message); setBusy(''); }
  };
  const loadFolders = async () => {
    setBusy('folders'); setErr('');
    try { const r = await seoSocialDriveFolders(site, folderQ); setFolders(r.folders || []); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const pickFolder = async (f) => {
    setBusy('pick'); setErr('');
    try {
      await seoSocialDrivePick(site, f.id, f.name);
      setDrive((d) => ({ ...d, folderId: f.id, folderName: f.name })); setFolders(null);
      onBanner(`📁 Photo folder set to “${f.name}” — click Sync to import.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const saveDrive = async () => {
    setBusy('drive'); setErr('');
    try {
      const r = await seoSocialDriveLink(site, driveUrl.trim());
      onBanner(r.cleared ? 'Drive folder unlinked.' : `📁 Drive folder linked — ${r.imagesVisible} image(s) visible. Click Sync to import.`);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const sync = async () => {
    setBusy('sync'); setErr('');
    try {
      const r = await seoSocialPhotosSync(site);
      onBanner(`📷 Imported ${r.imported} new photo(s) — ${r.driveSeen} image(s) across ${r.foldersScanned || 1} Drive folder(s), ${r.jtSeen} social-tagged in Job Tracker${r.jtLinked ? '' : ' (no Job Tracker company linked)'}.`);
      if (r.errors?.length) setErr(r.errors.join(' · '));
      await load();
      // AI-label anything not yet analyzed so the post matcher can use it.
      let labeled = 0;
      for (let i = 0; i < 12; i++) {
        const a = await seoPhotoAnalyze(site);
        labeled += a.analyzed || 0;
        if (!a.remaining) break;
        onBanner(`🧠 Reading photos so AI can match them to posts… ${a.remaining} left`);
      }
      if (labeled > 0) onBanner(`🧠 ${labeled} photo(s) analyzed — AI can now match them to posts automatically.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const del = async (p) => { try { await seoSocialPhotoDelete(site, p.id); await load(); } catch (e) { setErr(e.message); } };

  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="min-w-0">
        <div class="font-semibold text-slate-800">📷 Photo library <span class="text-xs font-normal text-slate-400">— ${photos === null ? '…' : `${photos.length} real photos`}</span></div>
        <div class="text-xs text-slate-400 truncate">Real photos make proof posts authentic — pulled from the client's Google Drive and Job Tracker photos tagged “social”.</div>
      </div>
      <div class="flex items-center gap-2">
        <${Btn} size="sm" variant="secondary" onClick=${sync} disabled=${busy === 'sync'}>${busy === 'sync' ? 'Syncing…' : '↻ Sync photos'}</${Btn}>
        <${Btn} size="sm" variant=${open ? 'ghost' : 'secondary'} onClick=${() => setOpen(!open)}>${open ? 'Close' : '⚙ Sources'}</${Btn}>
      </div>
    </div>
    ${err && html`<div class="text-xs text-rose-600 mt-2">${err}</div>`}
    ${open && html`<div class="mt-3 pt-3 border-t border-slate-100 space-y-3">
      <div class="space-y-2">
        <div class="text-xs font-medium text-slate-500">Google Drive</div>
        ${drive.connected ? html`
          <div class="text-xs text-slate-500">Signed in ✓${drive.email ? ` as ${drive.email}` : ''}${drive.folderName ? html` · folder: <span class="font-medium text-slate-700">${drive.folderName}</span>` : ' · no folder picked yet'}
            <button onClick=${async () => { if (confirm('Disconnect Google Drive for this business?')) { await seoSocialDriveDisconnect(site); await load(); } }} class="ml-2 text-slate-400 hover:text-rose-600 underline">disconnect</button>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <div class="min-w-[200px]"><label class="text-[11px] text-slate-400">Find the photo folder</label><${Input} value=${folderQ} onInput=${setFolderQ} placeholder="folder name…" /></div>
            <${Btn} size="sm" variant="secondary" onClick=${loadFolders} disabled=${busy === 'folders'}>${busy === 'folders' ? 'Loading…' : '🔍 Browse folders'}</${Btn}>
          </div>
          ${folders !== null && html`<div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            ${folders.length === 0 ? html`<div class="text-xs text-slate-400">No folders found.</div>` : folders.map((f) => html`
              <button onClick=${() => pickFolder(f)} disabled=${busy === 'pick'}
                class=${cx('text-xs px-2.5 py-1 rounded-full border', drive.folderId === f.id ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:border-brand-300')}>📁 ${f.name}</button>`)}
          </div>`}`
        : html`
          <${Btn} variant="cta" onClick=${signInGoogle} disabled=${busy === 'goauth'}>${busy === 'goauth' ? 'Waiting for Google… (finish sign-in in the other tab)' : '🔑 Sign in with Google'}</${Btn}>
          <p class="text-xs text-slate-500">Sign in with the Google account that can see the client's photos, then pick the folder — no sharing settings needed.</p>`}
        <details>
          <summary class="text-xs text-slate-400 cursor-pointer">Advanced: paste a public folder link instead</summary>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <div class="flex-1 min-w-[260px]"><label class="text-[11px] text-slate-400">Folder link (shared “Anyone with the link — Viewer”)</label><${Input} value=${driveUrl} onInput=${setDriveUrl} placeholder="https://drive.google.com/drive/folders/…" /></div>
            <${Btn} size="sm" onClick=${saveDrive} disabled=${busy === 'drive'}>${busy === 'drive' ? 'Checking…' : 'Save folder'}</${Btn}>
          </div>
        </details>
      </div>
      <p class="text-xs text-slate-500">Job Tracker: photos tagged with the <span class="font-medium">social</span> category on the linked company ${jtLinked ? html`<span class="text-emerald-600">(company linked ✓)</span>` : html`<span class="text-amber-600">(link a company on this page first)</span>`} import automatically on Sync.</p>
    </div>`}
    ${photos !== null && photos.length > 0 && html`<div class="mt-3 flex flex-wrap gap-2">
      ${photos.slice(0, 24).map((p) => html`<div class="relative group">
        <img src=${p.url} alt=${p.name || 'photo'} loading="lazy" onError=${imgFallback} title=${`${p.source === 'drive' ? '📁 Drive' : p.source === 'jobtracker' ? '🧰 Job Tracker' : 'Upload'}${p.name ? ' · ' + p.name : ''}`} class="h-28 w-28 object-cover rounded-lg border border-slate-100" />
        <button onClick=${() => del(p)} class="absolute -top-1.5 -right-1.5 hidden group-hover:block bg-rose-600 text-white rounded-full w-5 h-5 text-xs leading-none">✕</button>
      </div>`)}
      ${photos.length > 24 && html`<div class="h-28 w-28 rounded-lg bg-slate-50 flex items-center justify-center text-xs text-slate-400">+${photos.length - 24}</div>`}
    </div>`}
  </div></${Card}>`;
}

// GoHighLevel Social Planner connection: paste the sub-account's Private
// Integration token once; approved posts push as scheduled GHL posts.
export function GhlCard({ site, onBanner }) {
  const [st, setSt] = useState(null); // { connected, ghl }
  const [open, setOpen] = useState(false);
  const [locId, setLocId] = useState('');
  const [token, setToken] = useState('');
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = () => seoSocialGhlStatus(site).then((r) => { setSt(r); setSel(new Set(r.ghl?.selected || [])); }).catch((e) => { setErr(e.message); setSt({ connected: false }); });
  useEffect(() => { setSt(null); setErr(''); setOpen(false); if (site) load(); }, [site]);

  const connect = async () => {
    setBusy('conn'); setErr('');
    try {
      const r = await seoSocialGhlConnect(site, locId.trim(), token.trim());
      setToken(''); setOpen(false);
      onBanner(`🔗 GoHighLevel connected — ${r.accounts.length} social account(s) found${r.userName ? `, posting as ${r.userName}` : ''}.`);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  // OAuth sign-in: open GHL's consent in a new tab, then poll until the
  // callback stores the connection (or ~3 minutes pass).
  const signIn = async () => {
    setBusy('oauth'); setErr('');
    try {
      const r = await seoSocialGhlOauthStart(site);
      window.open(r.url, '_blank', 'noopener');
      let ticks = 0;
      const iv = setInterval(async () => {
        ticks++;
        if (ticks > 45) { clearInterval(iv); setBusy(''); return; }
        try {
          const s = await seoSocialGhlStatus(site);
          if (s.connected && s.ghl?.authMode === 'oauth') {
            clearInterval(iv); setBusy(''); setSt(s); setSel(new Set(s.ghl?.selected || []));
            onBanner(`🔗 GoHighLevel connected via sign-in — ${(s.ghl?.accounts || []).length} social account(s)${s.ghl?.userName ? `, posting as ${s.ghl.userName}` : ''}.`);
          }
        } catch (_) { /* keep polling */ }
      }, 4000);
    } catch (e) { setErr(e.message); setBusy(''); }
  };
  const toggleAcc = (id) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const saveSel = async () => {
    setBusy('sel'); setErr('');
    try { await seoSocialGhlSetAccounts(site, [...sel]); onBanner('✅ Posting accounts saved.'); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (st === null) return html`<${Card}><div class="p-4 text-sm text-slate-400">Checking GoHighLevel…</div></${Card}>`;
  const g = st.ghl;
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="min-w-0">
        <div class="font-semibold text-slate-800">🚀 GoHighLevel <span class="text-xs font-normal text-slate-400">— scheduling &amp; publishing</span></div>
        <div class="text-xs text-slate-400 truncate">${st.connected ? `${g.authMode === 'oauth' ? 'Signed in ✓' : 'Connected'} · location ${g.locationId}${g.userName ? ` · posts as ${g.userName}` : ''}${g.timezone ? ` · ${g.timezone}` : ''}` : 'Sign in to the client’s GHL sub-account to push approved posts into its Social Planner.'}</div>
      </div>
      <div class="flex items-center gap-2">
        ${st.connected && html`<button onClick=${async () => { if (confirm('Disconnect GoHighLevel for this business?')) { await seoSocialGhlDisconnect(site); await load(); } }} class="text-xs text-slate-400 hover:text-rose-600 underline">disconnect</button>`}
        <${Btn} size="sm" variant=${open ? 'ghost' : 'secondary'} onClick=${() => setOpen(!open)}>${open ? 'Close' : st.connected ? '⚙ Manage' : '🔗 Connect'}</${Btn}>
      </div>
    </div>
    ${err && html`<div class="text-xs text-rose-600 mt-2">${err}</div>`}
    ${open && html`<div class="mt-3 pt-3 border-t border-slate-100 space-y-3">
      ${st.connected && (g.accounts || []).length > 0 && html`<div>
        <div class="text-xs font-medium text-slate-500 mb-1.5">Post to these accounts</div>
        <div class="flex flex-wrap gap-1.5">
          ${(g.accounts || []).map((a) => html`<button onClick=${() => toggleAcc(a.id)}
            class=${cx('text-xs px-2.5 py-1 rounded-full border flex items-center gap-1', sel.has(a.id) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-400')}>
            <span>${PLAT_ICON[a.platform] || '🌐'}</span>${a.name}</button>`)}
        </div>
        <div class="mt-2"><${Btn} size="sm" onClick=${saveSel} disabled=${busy === 'sel'}>${busy === 'sel' ? 'Saving…' : 'Save accounts'}</${Btn}></div>
      </div>`}
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <${Btn} variant="cta" onClick=${signIn} disabled=${busy === 'oauth'}>${busy === 'oauth' ? 'Waiting for GoHighLevel… (finish sign-in in the other tab)' : st.connected ? '🔑 Sign in again' : '🔑 Sign in with GoHighLevel'}</${Btn}>
          ${st.connected && st.ghl?.authMode === 'oauth' && html`<${Btn} size="sm" variant="secondary" onClick=${async () => { setBusy('ref'); try { await seoSocialGhlRefreshAccounts(site); await load(); onBanner('↻ Social accounts refreshed from GoHighLevel.'); } catch (e) { setErr(e.message); } finally { setBusy(''); } }} disabled=${!!busy}>↻ Refresh accounts</${Btn}>`}
        </div>
        <p class="text-xs text-slate-500">Pick the client's sub-account on the GoHighLevel screen — everything else connects automatically.</p>
        <details>
          <summary class="text-xs text-slate-400 cursor-pointer">Advanced: connect with a Private Integration token instead</summary>
          <div class="mt-2 space-y-2">
            <p class="text-xs text-slate-500">In the client's GHL <span class="font-medium">sub-account</span>: Settings → <span class="font-medium">Private Integrations</span> → New Integration with scopes <span class="font-medium">View Social Planner, Edit Social Planner, View Users, View Locations</span> → copy the token. The Location ID is in Settings → Business Profile.</p>
            <div class="flex flex-wrap items-end gap-2">
              <div class="min-w-[180px]"><label class="text-[11px] text-slate-400">Location ID</label><${Input} value=${locId} onInput=${setLocId} placeholder="ve9EPM428h8vShlRW1KT" /></div>
              <div class="flex-1 min-w-[240px]"><label class="text-[11px] text-slate-400">Private Integration token</label><${Input} type="password" value=${token} onInput=${setToken} placeholder="pit-…" /></div>
              <${Btn} size="sm" onClick=${connect} disabled=${busy === 'conn' || !locId.trim() || !token.trim()}>${busy === 'conn' ? 'Connecting…' : st.connected ? 'Reconnect' : 'Connect'}</${Btn}>
            </div>
          </div>
        </details>
      </div>
    </div>`}
  </div></${Card}>`;
}

// Relevance of a library photo to a post, from the AI description/tags —
// used only to ORDER the picker (selection stays fully manual).
function photoScore(p, post) {
  const hay = `${(Array.isArray(p.tags) ? p.tags.join(' ') : '')} ${p.description || ''} ${p.name || ''}`.toLowerCase();
  const needles = `${post.topic || ''} ${post.target_service || ''} ${post.target_city || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let s = 0;
  for (const w of new Set(needles)) if (hay.includes(w)) s++;
  return s;
}

// Full-screen review mode: one post at a time, big media preview, one-tap
// decisions with auto-advance and a progress bar — built so a month of
// content can be reviewed in one fast pass instead of 30 modal round-trips.
function ReviewModal({ site, posts, revId, setRevId, library, onClose, onChanged }) {
  const idx = posts.findIndex((p) => p.id === revId);
  const post = idx >= 0 ? posts[idx] : null;
  const [f, setF] = useState(null);
  const [refSel, setRefSel] = useState(new Set());
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!post) return;
    setF({ caption: post.caption || '', overlay: post.overlay_text || '', tags: (post.hashtags || []).join(' '), cta: post.cta || '', prompt: post.format === 'video' ? (post.video_prompt || '') : (post.image_prompt || '') });
    setRefSel(new Set(Array.isArray(post.ref_photos) ? post.ref_photos : []));
    setErr('');
  }, [revId]);
  const total = posts.length;
  const decided = posts.filter((p) => p.status === 'approved' || p.status === 'rejected').length;
  const readyLeft = posts.filter((p) => p.status === 'ready').length;
  const go = (d) => { if (!total) return; setRevId(posts[(idx + d + total) % total].id); };
  // After a decision, jump straight to the next post awaiting review.
  const advance = () => {
    const after = [...posts.slice(idx + 1), ...posts.slice(0, idx)];
    const nxt = after.find((p) => p.status === 'ready');
    if (nxt) setRevId(nxt.id);
  };
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  });
  if (!post || !f) return null;
  const media = (post.media_urls || [])[0];
  const [pic, ptone] = PILLAR[post.pillar] || ['📄', 'bg-slate-100 text-slate-600'];
  const toggleRef = (url) => setRefSel((p) => { const n = new Set(p); if (n.has(url)) n.delete(url); else if (n.size < 3) n.add(url); return n; });
  const saveFields = () => seoSocialUpdatePost(site, post.id, {
    caption: f.caption, overlayText: f.overlay, cta: f.cta,
    hashtags: f.tags.split(/[\s,]+/).filter(Boolean),
    refPhotos: [...refSel],
    ...(post.format === 'video' ? { videoPrompt: f.prompt } : { imagePrompt: f.prompt }),
  });
  const run = async (name, fn, next) => { setBusy(name); setErr(''); try { await fn(); await onChanged(); if (next) advance(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const doSave = () => run('save', saveFields, false);
  const doApprove = () => run('ok', async () => { await saveFields(); await seoSocialApprove(site, post.id); }, true);
  const doReject = () => run('no', () => seoSocialReject(site, post.id, 'rejected in review'), true);
  const doRegen = () => run('regen', async () => { await saveFields(); await seoSocialRegenMedia(site, post.id); }, false);
  const dateLabel = new Date(post.post_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return html`<div class="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden fade-in">
      <div class="px-4 pt-3 pb-2 border-b border-slate-100">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <button onClick=${() => go(-1)} title="Previous (←)" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600">‹</button>
            <button onClick=${() => go(1)} title="Next (→)" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600">›</button>
            <div class="text-sm font-semibold text-slate-800 truncate">${dateLabel} · ${post.post_time}${post.format === 'video' ? ' · 🎬 Reel' : ''}</div>
            <span class=${cx('text-[11px] px-2 py-0.5 rounded-full shrink-0', ptone)}>${pic} ${post.pillar}</span>
            <span class=${cx('text-[11px] px-2 py-0.5 rounded-full shrink-0', post.ghl_post_id ? 'bg-emerald-600 text-white' : STATUS[post.status] || '')}>${post.ghl_post_id ? '🚀 scheduled' : post.status.replace('_', ' ')}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-xs text-slate-400 whitespace-nowrap hidden sm:block">${decided}/${total} decided${readyLeft ? ` · ${readyLeft} to review` : ''}</div>
            <button onClick=${onClose} class="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
          </div>
        </div>
        <div class="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-emerald-400 transition-all" style=${`width:${total ? Math.round((decided / total) * 100) : 0}%`}></div></div>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        ${readyLeft === 0 && html`<div class="mb-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm px-3 py-2">🎉 Every post has a decision — close this and hit <span class="font-semibold">Push to GHL</span> to schedule the approved ones.</div>`}
        <div class="grid md:grid-cols-2 gap-4">
          <div class="rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center min-h-[280px] overflow-hidden self-start">
            ${media ? (post.format === 'video'
              ? html`<video src=${media} controls class="max-h-[62vh] w-full object-contain"></video>`
              : html`<img src=${media} alt="post media" onError=${imgFallback} class="max-h-[62vh] w-full object-contain" />`)
            : post.status === 'media_pending' ? html`<div class="text-center text-sm text-slate-400 animate-pulse py-16 px-6">🎨 Generating media…<div class="text-xs mt-1">this updates by itself when it finishes</div></div>`
            : html`<div class=${cx('text-center py-16 px-6 w-full h-full flex flex-col items-center justify-center', ptone)}><div class="text-4xl">${pic}</div><div class="text-xs mt-2 opacity-80">No media yet — write/generate first</div></div>`}
          </div>
          <div class="space-y-3 min-w-0">
            ${post.topic && html`<div class="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">📋 ${post.topic}${post.target_city ? ` · 📍 ${post.target_city}` : ''}${post.target_service ? ` · 🛠 ${post.target_service}` : ''}</div>`}
            ${post.reject_reason && html`<div class="text-xs text-rose-600 bg-rose-50 rounded px-2 py-1">${post.reject_reason}</div>`}
            <${Field} label="Caption"><${Textarea} value=${f.caption} onInput=${(v) => setF({ ...f, caption: v })} rows=${7} /></${Field}>
            <div class="grid sm:grid-cols-2 gap-3">
              ${post.format === 'image' && html`<${Field} label="On-image headline (3-8 words)"><${Input} value=${f.overlay} onInput=${(v) => setF({ ...f, overlay: v })} /></${Field}>`}
              ${post.format === 'image' && html`<${Field} label="CTA button text (2-5 words)"><${Input} value=${f.cta} onInput=${(v) => setF({ ...f, cta: v })} placeholder="Get Your Free Estimate" /></${Field}>`}
            </div>
            <${Field} label="Hashtags"><${Input} value=${f.tags} onInput=${(v) => setF({ ...f, tags: v })} placeholder="#roofrepairocala #ocalaroofer" /></${Field}>
            <details><summary class="text-xs text-slate-400 cursor-pointer">${post.format === 'video' ? 'Video' : 'Image'} generation prompt</summary>
              <div class="mt-2"><${Textarea} value=${f.prompt} onInput=${(v) => setF({ ...f, prompt: v })} rows=${4} /></div>
            </details>
            ${post.format === 'image' && (library || []).length > 0 && html`<div>
              <div class="text-xs font-medium text-slate-500 mb-1">Real photos for this post <span class="font-normal text-slate-400">— best matches first, pick up to 3 (then Regenerate)</span></div>
              <div class="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                ${(library || []).map((p) => ({ p, s: photoScore(p, post) })).sort((a, b) => b.s - a.s).map(({ p, s }) => html`<button onClick=${() => toggleRef(p.url)} title=${p.description || p.name || ''}
                  class=${cx('relative rounded-lg overflow-hidden border-2', refSel.has(p.url) ? 'border-brand-500' : 'border-transparent opacity-70 hover:opacity-100')}>
                  <img src=${p.url} alt="" loading="lazy" onError=${imgFallback} class="h-24 w-24 object-cover" />
                  ${refSel.has(p.url) && html`<span class="absolute top-1 right-1 bg-brand-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✓</span>`}
                  ${!refSel.has(p.url) && s > 0 && html`<span class="absolute top-1 right-1 bg-white/85 rounded-full px-1 text-xs" title="matches this topic">✨</span>`}</button>`)}
              </div>
            </div>`}
          </div>
        </div>
      </div>
      <div class="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          ${post.status !== 'rejected' && html`<${Btn} size="sm" variant="danger" onClick=${doReject} disabled=${!!busy}>${busy === 'no' ? '…' : '✕ Reject'}</${Btn}>`}
          ${(post.status === 'written' || post.status === 'ready' || post.status === 'rejected') && html`<${Btn} size="sm" variant="secondary" onClick=${doRegen} disabled=${!!busy}>${busy === 'regen' ? 'Starting…' : media ? '↻ Regenerate' : '🎨 Generate media'}</${Btn}>`}
          ${err && html`<span class="text-xs text-rose-600">${err}</span>`}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-300 hidden md:block">← → to browse</span>
          <${Btn} size="sm" onClick=${doSave} disabled=${!!busy}>${busy === 'save' ? 'Saving…' : '💾 Save'}</${Btn}>
          ${post.status === 'approved'
            ? html`<${Btn} size="sm" variant="success" disabled=${true}>✓ Approved</${Btn}>`
            : html`<${Btn} variant="success" onClick=${doApprove} disabled=${!!busy || !media}>${busy === 'ok' ? '…' : '✓ Approve & next'}</${Btn}>`}
        </div>
      </div>
    </div>
  </div>`;
}

export function Social() {
  useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [month, setMonth] = useState(nextMonth());
  const [cal, setCal] = useState(null);   // calendar row or null
  const [posts, setPosts] = useState([]);
  const [photos, setPhotos] = useState(null); // real-photo library (shared w/ ReviewModal)
  const [revId, setRevId] = useState(null);   // post open in review mode
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const load = async (s = site, m = month) => {
    if (!s) return;
    try { const r = await seoSocialCalendar(s, m); setCal(r.calendar); setPosts(r.posts || []); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { setCal(null); setPosts([]); setErr(''); if (site) load(site, month); }, [site, month]);
  // Photo library feeds the per-post picker (managed in the Business tab).
  // Catalog includes AI descriptions/tags so the picker can sort by relevance.
  useEffect(() => { setPhotos(null); if (site) seoPhotoCatalog(site).then((r) => setPhotos(r.photos || [])).catch(() => setPhotos([])); }, [site]);

  // Poll while media is generating.
  useEffect(() => {
    if (!cal || !posts.some((p) => p.status === 'media_pending')) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try { const r = await seoSocialRefresh(site, cal.id); setPosts(r.posts || []); } catch { /* keep */ }
    }, 8000);
    return () => clearInterval(t);
  }, [cal?.id, posts.some((p) => p.status === 'media_pending')]);

  const planMonth = async () => {
    if (cal && !confirm('Re-planning replaces the existing calendar for this month (all drafts). Continue?')) return;
    setBusy('plan'); setErr(''); setProg('🧠 Planning the month — pillars, topics, cities, times…');
    try {
      const r = await seoSocialPlanMonth(site, month);
      setProg(`✍️ Writing captions for ${r.posts} posts…`);
      let remaining = r.posts;
      while (remaining > 0) {
        const w = await seoSocialWriteBatch(site, r.calendarId, 8);
        remaining = w.remaining;
        setProg(`✍️ Writing captions… ${remaining} to go`);
      }
      setProg(''); setBanner(`📅 Calendar ready — ${r.posts} posts planned & written. Review them, then generate media.`);
      await load();
    } catch (e) { setErr(e.message); setProg(''); } finally { setBusy(''); }
  };

  const genMedia = async () => {
    setBusy('media'); setErr('');
    try {
      // Before generating, let AI assign real customer photos to posts that
      // don't have any picked yet — real photos beat pure AI imagery.
      try {
        setProg('🔍 Matching real photos from the library to this month’s posts…');
        const m = await seoPhotoMatch(site, month);
        if (m.matched > 0) setBanner(`✨ ${m.matched} post(s) will be built from real customer photos.`);
      } catch (_) { /* matching is best-effort — generation proceeds regardless */ }
      const pending = posts.filter((p) => p.status === 'written').length;
      setProg(`🎨 Generating media for ${pending} posts (runs in batches)…`);
      let started = 1;
      while (started > 0) {
        const r = await seoSocialMediaBatch(site, cal.id, 4);
        started = r.started;
        if (r.errors?.length) setErr(r.errors.join(' · '));
        if (started) setProg(`🎨 Started ${started} more generations — they finish in the background…`);
        if (started) await new Promise((res) => setTimeout(res, 12000));
      }
      setProg(''); setBanner('🎨 All media generations started — previews appear as they finish (auto-refreshing).');
      await load();
    } catch (e) { setErr(e.message); setProg(''); } finally { setBusy(''); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading social manager…</div>`;
  if (sites.length === 0) return html`<div class="max-w-5xl mx-auto p-6"><${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}></div>`;

  const counts = posts.reduce((m, p) => { m[p.status] = (m[p.status] || 0) + 1; return m; }, {});
  const activeFilter = POST_FILTERS.find(([k]) => k === filter) || POST_FILTERS[0];
  const shown = filter === 'all' ? posts : posts.filter(activeFilter[2]);
  const readyCount = counts.ready || 0;
  const toPush = posts.filter((p) => p.status === 'approved' && !p.ghl_post_id).length;
  const pushedCount = posts.filter((p) => p.ghl_post_id).length;

  const pushGhl = async () => {
    setBusy('push'); setErr(''); setProg(`🚀 Pushing ${toPush} approved posts to GoHighLevel…`);
    try {
      const r = await seoSocialGhlPush(site, cal.id);
      setProg('');
      setBanner(`🚀 ${r.pushed} post(s) scheduled in GoHighLevel${r.skipped ? ` — ${r.skipped} skipped` : ''}.`);
      if (r.errors?.length) setErr(r.errors.join(' · '));
      await load();
    } catch (e) { setErr(e.message); setProg(''); } finally { setBusy(''); }
  };

  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Social Media</h1>
        <p class="text-sm text-slate-500">A month of posts, curated from your services and service area. Approved content exports to GoHighLevel for scheduling.</p>
      </div>
      <div class="flex items-center gap-2">
        ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
        <${Input} type="month" value=${month} onInput=${setMonth} class="w-40" />
      </div>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700 flex items-center justify-between"><span>${err}</span><button onClick=${() => setErr('')} class="opacity-60 ml-2">✕</button></div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-800 flex items-center justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60 ml-2">✕</button></div>`}
    ${prog && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-sky-50 text-sky-800">${prog}</div>`}

    <div class="text-xs text-slate-400">Brand kit, photo sources, and integrations now live in the <span class="font-medium">🏢 Business</span> tab.</div>

    <${Card}><div class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div class="font-semibold text-slate-800">📅 ${new Date(month + '-15T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          ${cal && html`<span class="text-xs font-normal text-slate-400"> — ${posts.length} posts · ${counts.approved || 0} approved · ${readyCount} ready · ${(counts.written || 0) + (counts.planned || 0)} drafted · ${counts.media_pending || 0} generating</span>`}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${cal && posts.some((p) => p.status === 'written') && html`<${Btn} size="sm" variant="cta" onClick=${genMedia} disabled=${!!busy}>${busy === 'media' ? 'Generating…' : '🎨 Generate all media'}</${Btn}>`}
          ${cal && readyCount > 0 && html`<${Btn} size="sm" variant="cta" onClick=${() => setRevId((posts.find((p) => p.status === 'ready') || posts[0]).id)} disabled=${!!busy}>👀 Review ${readyCount}</${Btn}>`}
          ${cal && readyCount > 0 && html`<${Btn} size="sm" variant="success" onClick=${async () => { await seoSocialApproveAll(site, cal.id); setBanner(`✓ ${readyCount} posts approved.`); await load(); }} disabled=${!!busy}>✓ Approve all</${Btn}>`}
          ${cal && toPush > 0 && html`<${Btn} size="sm" variant="cta" onClick=${pushGhl} disabled=${!!busy}>${busy === 'push' ? 'Pushing…' : `🚀 Push ${toPush} to GHL`}</${Btn}>`}
          ${cal && pushedCount > 0 && toPush === 0 && html`<span class="text-xs text-emerald-600">🚀 ${pushedCount} scheduled in GHL</span>`}
          <${Btn} size="sm" onClick=${planMonth} disabled=${!!busy}>${busy === 'plan' ? 'Planning…' : cal ? '↻ Re-plan month' : '🧠 Plan this month'}</${Btn}>
        </div>
      </div>
      ${!cal ? html`<div class="text-sm text-slate-400 py-8 text-center">No calendar for this month yet — set up the brand kit above, then click <span class="font-medium">Plan this month</span>.</div>` : html`
        ${cal.strategy?.idealClient && html`<div class="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3"><span class="font-medium">Ideal client:</span> ${cal.strategy.idealClient}${cal.strategy.themes?.length ? html`<span class="font-medium"> · Themes:</span> ${cal.strategy.themes.join(' · ')}` : ''}</div>`}
        <div class="flex flex-wrap gap-1.5 mb-3">
          ${POST_FILTERS.map(([k, label, fn]) => {
            const n = k === 'all' ? posts.length : posts.filter(fn).length;
            if (!n && k !== 'all') return null;
            return html`<button onClick=${() => setFilter(k)} class=${cx('text-xs px-2.5 py-1 rounded-full border transition-colors', filter === k ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300')}>${label} ${n}</button>`;
          })}
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          ${shown.map((p) => {
            const [ic, tone] = PILLAR[p.pillar] || ['📄', 'bg-slate-100 text-slate-600'];
            const m = (p.media_urls || [])[0];
            return html`<button onClick=${() => setRevId(p.id)} title=${p.topic || ''}
              class=${cx('group text-left rounded-xl overflow-hidden border bg-white hover:shadow-md transition-shadow', p.status === 'rejected' ? 'opacity-50 border-slate-100' : 'border-slate-200 hover:border-brand-400')}>
              <div class=${cx('relative h-40 flex items-center justify-center overflow-hidden', !m && tone)}>
                ${m ? (p.format === 'video'
                  ? html`<video src=${m} muted playsinline preload="metadata" class="h-full w-full object-cover"></video>`
                  : html`<img src=${m} alt="" loading="lazy" onError=${imgFallback} class="h-full w-full object-cover" />`)
                : p.status === 'media_pending' ? html`<div class="text-xs text-slate-500 animate-pulse text-center px-3">🎨 Generating…</div>`
                : html`<div class="text-center px-3"><div class="text-3xl">${ic}</div><div class="text-[11px] mt-1 opacity-80 overflow-hidden max-h-8">${p.topic || p.pillar}</div></div>`}
                ${p.format === 'video' && html`<span class="absolute top-1.5 left-1.5 text-xs bg-slate-900/50 text-white rounded px-1">🎬</span>`}
                <span class=${cx('absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium', p.ghl_post_id ? 'bg-emerald-600 text-white' : STATUS[p.status] || '')}>${p.ghl_post_id ? '🚀' : p.status.replace('_', ' ')}</span>
              </div>
              <div class="px-2.5 py-2">
                <div class="text-[11px] text-slate-400">${new Date(p.post_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${p.post_time} ${ic}</div>
                <div class="text-xs text-slate-700 truncate">${p.hook || p.overlay_text || p.topic || p.pillar}</div>
              </div>
            </button>`;
          })}
          ${shown.length === 0 && html`<div class="col-span-full text-sm text-slate-400 py-8 text-center">Nothing in this filter.</div>`}
        </div>`}
    </div></${Card}>

    ${revId && html`<${ReviewModal} site=${site} posts=${posts} revId=${revId} setRevId=${setRevId} library=${photos || []} onClose=${() => setRevId(null)} onChanged=${load} />`}
  </div>`;
}
