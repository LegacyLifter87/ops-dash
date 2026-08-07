// ---------------------------------------------------------------------------
// social.js — Social Media Manager: curate a month of posts per business.
// Brand kit (phone/website/logo/colors) → AI 30-day calendar (pillars, times,
// cities, services from the Strategy tab) → written captions + hooks → brand-
// injected images (nano-banana) and Reels (Kling) → review/approve.
// Scheduling/publishing happens in GoHighLevel — this tab curates.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoAddManualSite, seoSocialRewritePost, seoSocialProfile, seoSocialProfileSave, seoSocialLogoUpload, seoSocialPlanMonth, seoSocialWriteBatch, seoSocialMediaBatch, seoSocialRegenMedia, seoSocialRefresh, seoSocialCalendar, seoSocialUpdatePost, seoSocialApprove, seoSocialReject, seoSocialApproveAll, seoSocialPillarsGet, seoSocialPillarsSave, seoSocialGhlUnschedule, seoSocialGhlStatus, seoSocialGhlConnect, seoSocialGhlSetAccounts, seoSocialGhlDisconnect, seoSocialGhlPush, seoSocialGhlOauthStart, seoSocialGhlRefreshAccounts, seoSocialPhotos, seoSocialDriveLink, seoSocialPhotosSync, seoSocialPhotoDelete, seoSocialDriveOauthStart, seoSocialDriveStatus, seoSocialDriveBrowse, seoSocialDrivePick, seoSocialDriveDisconnect, seoPhotoCatalog, seoPhotoAnalyze, seoPhotoMatch, seoSocialBadgeUpload, seoSocialBadgeDelete, seoSocialCertUpload, seoSocialReviewsSync, seoSocialReviewsList, seoStrategyPages, seoApprovalStatus, seoApprovalSendNow, seoAutopilotStatus, seoAutopilotRunNow } from './store.js';
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
// Visual aesthetics the owner can approve for image generation (skill doc §10).
const AESTHETICS = [
  ['industrial-rugged', '🔧 Industrial / Rugged', 'Dark neutrals + safety accent, heavy type, worksite photos — contractors, electrical, washing, generators'],
  ['documentary', '📷 Documentary / Real', 'Real crew and job sites, natural light, location labels — authentic and trustworthy'],
  ['organic-natural', '🌿 Organic / Natural', 'Earth tones, soft greens, sunlight — lawn, landscape, outdoor'],
  ['luxury-minimal', '✨ Luxury Minimal', 'Negative space, refined serif, deep neutrals — premium remodel, flooring, offices'],
  ['editorial', '📰 Editorial', 'Magazine labels, serif headlines, art-directed photos — authority and premium positioning'],
  ['corporate-clean', '🏢 Corporate Clean', 'Brand-color blocks, clean sans, icons — professional and B2B'],
  ['bold-minimalism', '🎯 Bold Minimal', 'One saturated color, oversized type, few elements — energy without clutter'],
  ['retro-local', '🏷 Retro Local', 'Vintage badge, "since YYYY", warm grading — established family businesses'],
  ['playful-pop', '🎉 Playful Pop', 'Primary colors, halftone, starbursts — events and giveaways only'],
];
// Brand voices the owner can approve — mirrors the visual style selector.
// Pick any; the AI chooses ONE per month from the approved set (or freely
// when none are picked) and every caption is written in it.
const VOICES = [
  ['neighborly-expert', '🏡 Neighborly Expert', 'The trusted pro next door — warm plain talk, practical tips'],
  ['straight-shooter', '🎯 Straight Shooter', 'No fluff — short blunt sentences, facts and honest prices up front'],
  ['premium-concierge', '🤵 Premium Concierge', 'Polished, gracious, white-glove calm — never salesy'],
  ['coach-educator', '📚 Coach / Educator', 'Teaches first — step-by-step, empowering'],
  ['family-values', '👨‍👩‍👧 Family Values', 'Community-rooted, multi-generation warmth, "since YYYY" pride'],
  ['high-energy', '⚡ High Energy', 'Fast, punchy, exclamation-friendly — giveaways and events only'],
  ['calm-reassuring', '🕊 Calm & Reassuring', 'Steady empathy for stressful jobs — storm damage, repairs'],
  ['witty-playful', '😄 Witty & Playful', 'Light humor and personality, still professional'],
  ['technical-authority', '🔬 Technical Authority', 'Specs, standards and code references — engineering-minded buyers'],
];
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

// --- US holiday catalog for the month planner ------------------------------
// Federal holidays + widely celebrated national days + a few fun ones so every
// month has something. Floating dates are computed (nth weekday, last weekday,
// Easter via the anonymous Gregorian computus). solemn = honor-first, never
// promotional (enforced by the planner/writer prompts).
const nthDow = (y, mo, dow, n) => { const first = new Date(y, mo - 1, 1).getDay(); return 1 + ((dow - first + 7) % 7) + (n - 1) * 7; };
const lastDow = (y, mo, dow) => { const days = new Date(y, mo, 0).getDate(); const last = new Date(y, mo - 1, days).getDay(); return days - ((last - dow + 7) % 7); };
function easterDay(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { mo: Math.floor((h + l - 7 * m + 114) / 31), day: ((h + l - 7 * m + 114) % 31) + 1 };
}
export function holidaysForMonth(ym) {
  const [y, mo] = String(ym || '').split('-').map(Number);
  if (!y || !mo) return [];
  const H = [];
  const add = (day, name, kind, solemn) => H.push({ date: `${ym}-${String(day).padStart(2, '0')}`, name, kind, ...(solemn ? { solemn: true } : {}) });
  if (mo === 1) { add(1, "New Year's Day", 'federal'); add(nthDow(y, 1, 1, 3), 'Martin Luther King Jr. Day', 'federal'); }
  if (mo === 2) { add(2, 'Groundhog Day', 'fun'); add(nthDow(y, 2, 0, 2), 'Super Bowl Sunday', 'fun'); add(14, "Valentine's Day", 'national'); add(nthDow(y, 2, 1, 3), "Presidents' Day", 'federal'); }
  if (mo === 3) { add(14, 'Pi Day', 'fun'); add(17, "St. Patrick's Day", 'national'); }
  if (mo === 4) { add(1, "April Fools' Day", 'fun'); add(22, 'Earth Day', 'national'); }
  if (mo === 5) { add(5, 'Cinco de Mayo', 'fun'); add(nthDow(y, 5, 0, 2), "Mother's Day", 'national'); add(lastDow(y, 5, 1), 'Memorial Day', 'federal', true); }
  if (mo === 6) { add(14, 'Flag Day', 'national'); add(19, 'Juneteenth', 'federal'); add(nthDow(y, 6, 0, 3), "Father's Day", 'national'); }
  if (mo === 7) { add(4, 'Independence Day', 'federal'); add(nthDow(y, 7, 0, 3), 'National Ice Cream Day', 'fun'); }
  if (mo === 8) { add(15, 'National Relaxation Day', 'fun'); add(26, 'National Dog Day', 'fun'); }
  if (mo === 9) { add(nthDow(y, 9, 1, 1), 'Labor Day', 'federal'); add(11, 'Patriot Day (9/11 Remembrance)', 'national', true); add(29, 'National Coffee Day', 'fun'); }
  if (mo === 10) { add(nthDow(y, 10, 1, 2), "Indigenous Peoples' Day", 'federal'); add(31, 'Halloween', 'national'); }
  if (mo === 11) { const tg = nthDow(y, 11, 4, 4); add(11, 'Veterans Day', 'federal', true); add(tg, 'Thanksgiving', 'federal'); add(tg + 1, 'Black Friday', 'fun'); add(tg + 2, 'Small Business Saturday', 'fun'); }
  if (mo === 12) { add(24, 'Christmas Eve', 'national'); add(25, 'Christmas Day', 'federal'); add(31, "New Year's Eve", 'national'); }
  const e = easterDay(y);
  if (e.mo === mo) add(e.day, 'Easter Sunday', 'national');
  return H.sort((a, b) => a.date.localeCompare(b.date));
}

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
      setF({ phone: pr.phone || '', website: pr.website || '', bookingUrl: pr.booking_url || '', brandColor1: pr.brand_color1 || '', brandColor2: pr.brand_color2 || '', voiceNotes: pr.voice_notes || '', icp: pr.icp || '', warranty: pr.warranty || '', postsPerDay: pr.plan?.postsPerDay || 1, reelsPerMonth: pr.plan?.reelsPerMonth ?? 3, platforms: new Set(pr.plan?.platforms || ['facebook', 'instagram']), aesthetics: new Set(Array.isArray(pr.aesthetics) ? pr.aesthetics : []), voices: new Set(Array.isArray(pr.voices) ? pr.voices : []), certs: (Array.isArray(pr.certifications) ? pr.certifications : []).map((c) => ({ ...c })), imageSources: new Set(pr.plan?.imageSources?.length ? pr.plan.imageSources : ['company', 'ai']), commentTrigger: pr.comment_trigger || '', commentOffer: pr.comment_offer || '', pillars: [], insights: pr.insights || '' });
      if (!r.profile) setOpen(true);
      // Service categories (pillars) come from the dedicated seo-pillars fn,
      // which seeds one uncategorized group from any existing manual_services.
      seoSocialPillarsGet(site).then((pr2) => setF((x) => ({ ...x, pillars: (Array.isArray(pr2.pillars) ? pr2.pillars : []).map((pl) => ({ name: pl?.name || '', services: (Array.isArray(pl?.services) ? pl.services : []).map((s) => ({ name: s?.name || '', url: s?.url || '' })) })) }))).catch(() => {});
    }).catch((e) => { setErr(e.message); setP({}); });
  }, [site]);
  // Flatten the pillar tree into the flat {name,url} list seo-social stores as
  // manual_services (the AI/blog service source), deduped by name.
  const flatSvcs = (pillars) => {
    const seen = new Set(); const out = [];
    for (const pl of (pillars || [])) for (const s of (pl.services || [])) {
      const nm = String(s.name || '').trim(); if (!nm) continue;
      const k = nm.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
      out.push({ name: nm, url: String(s.url || '').trim() });
    }
    return out;
  };

  const save = async () => {
    setBusy('save'); setErr('');
    try {
      await seoSocialProfileSave(site, { phone: f.phone, website: f.website, bookingUrl: f.bookingUrl, brandColor1: f.brandColor1, brandColor2: f.brandColor2, voiceNotes: f.voiceNotes, icp: f.icp, warranty: f.warranty, promotion: p?.promotion || '', aesthetics: [...(f.aesthetics || [])], voices: [...(f.voices || [])], certifications: (f.certs || []).filter((c) => String(c.name || '').trim()), commentTrigger: f.commentTrigger, commentOffer: f.commentOffer, manualServices: flatSvcs(f.pillars), insights: f.insights, plan: { postsPerDay: Number(f.postsPerDay), reelsPerMonth: Number(f.reelsPerMonth), reviewsPerMonth: Number(p?.plan?.reviewsPerMonth) || 0, platforms: [...f.platforms], imageSources: [...(f.imageSources || ['company', 'ai'])], serviceMix: Array.isArray(p?.plan?.serviceMix) ? p.plan.serviceMix : [] } });
      // The grouped category → service structure is stored separately (seo-pillars).
      await seoSocialPillarsSave(site, (f.pillars || []).filter((pl) => String(pl.name || '').trim() || (pl.services || []).some((s) => String(s.name || '').trim())).map((pl) => ({ name: pl.name, services: (pl.services || []).filter((s) => String(s.name || '').trim()).map((s) => ({ name: s.name, url: s.url })) })));
      // Re-read so persisted cert rows (and their badge slots) are current.
      const r2 = await seoSocialProfile(site);
      setP(r2.profile || {});
      setF((x) => ({ ...x, certs: (Array.isArray(r2.profile?.certifications) ? r2.profile.certifications : []).map((c) => ({ ...c })) }));
      onBanner('✅ Brand kit saved.'); setOpen(false);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  // Any file size is accepted: oversized or oddly-typed images are decoded and
  // downscaled in the browser (max 1500px, transparency kept) before upload,
  // so the transfer always fits the server's limit. send(b64, contentType)
  // does the actual API call; failures land in the shared err line.
  const optimize = (file, send) => {
    const toB64 = async (blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    const okType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
    if (okType && file.size <= 2.5 * 1024 * 1024) { toB64(file).then((b64) => send(b64, file.type)); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1500 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((png) => {
        if (!png) { setErr('Could not process that image — try a PNG or JPEG.'); setBusy(''); return; }
        if (png.size <= 2.8 * 1024 * 1024) { toB64(png).then((b64) => send(b64, 'image/png')); return; }
        c.toBlob((jpg) => {
          if (jpg && jpg.size <= 2.8 * 1024 * 1024) toB64(jpg).then((b64) => send(b64, 'image/jpeg'));
          else { setErr('Could not compress that image enough — try a simpler version.'); setBusy(''); }
        }, 'image/jpeg', 0.9);
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); setErr('Could not read that image — use a PNG, JPEG, or WebP file.'); setBusy(''); };
    img.src = url;
  };
  const upload = (file) => {
    if (!file) return;
    setBusy('logo'); setErr('');
    optimize(file, async (b64, ct) => {
      try {
        await seoSocialLogoUpload(site, b64, ct);
        // Trust only what the server persisted — re-read the profile so the
        // preview can never show a logo the database doesn't actually have.
        const r = await seoSocialProfile(site);
        if (r.logoUrl) { setLogoUrl(r.logoUrl); onBanner('🖼 Logo saved — it will be placed on every generated image.'); }
        else { setLogoUrl(null); setErr('The logo did not persist — please try the upload again.'); }
      } catch (e) { setErr(`Logo upload failed: ${e.message}`); } finally { setBusy(''); }
    });
  };
  const badgeUpload = (file) => {
    if (!file) return;
    setBusy('badge'); setErr('');
    optimize(file, async (b64, ct) => {
      try {
        const r = await seoSocialBadgeUpload(site, b64, ct, file.name);
        setP((x) => ({ ...x, badges: r.badges }));
        onBanner('🏆 Badge saved — it will appear on proof, local, and promo images beside the logo.');
      } catch (e) { setErr(`Badge upload failed: ${e.message}`); } finally { setBusy(''); }
    });
  };
  const badgeDel = async (path) => {
    try { const r = await seoSocialBadgeDelete(site, path); setP((x) => ({ ...x, badges: r.badges })); }
    catch (e) { setErr(e.message); }
  };
  const certUpload = (certId, file) => {
    if (!file) return;
    const row = (f.certs || []).find((x) => x.id === certId);
    if (row && !String(row.name || '').trim()) { setErr('Give the certification a name first, then add its badge.'); return; }
    setBusy('cert'); setErr('');
    optimize(file, async (b64, ct) => {
      try {
        // A brand-new cert row isn't on the server yet — persist the profile
        // first so the upload has a row to attach to.
        const saved = (p?.certifications || []).some((x) => x?.id === certId);
        if (!saved) {
          await seoSocialProfileSave(site, { phone: f.phone, website: f.website, bookingUrl: f.bookingUrl, brandColor1: f.brandColor1, brandColor2: f.brandColor2, voiceNotes: f.voiceNotes, icp: f.icp, warranty: f.warranty, promotion: p?.promotion || '', aesthetics: [...(f.aesthetics || [])], voices: [...(f.voices || [])], certifications: (f.certs || []).filter((c) => String(c.name || '').trim()), commentTrigger: f.commentTrigger, commentOffer: f.commentOffer, manualServices: flatSvcs(f.pillars), insights: f.insights, plan: { postsPerDay: Number(f.postsPerDay), reelsPerMonth: Number(f.reelsPerMonth), reviewsPerMonth: Number(p?.plan?.reviewsPerMonth) || 0, platforms: [...f.platforms], imageSources: [...(f.imageSources || ['company', 'ai'])], serviceMix: Array.isArray(p?.plan?.serviceMix) ? p.plan.serviceMix : [] } });
        }
        const r = await seoSocialCertUpload(site, certId, b64, ct);
        setP((x) => ({ ...x, certifications: r.certifications }));
        setF((x) => ({ ...x, certs: r.certifications.map((c) => ({ ...c })) }));
        onBanner('📜 Certification badge saved — it joins the awards on proof, local and promo images.');
      } catch (e) { setErr(`Badge upload failed: ${e.message}`); } finally { setBusy(''); }
    });
  };
  const setCert = (i, k, v) => setF((x) => { const certs = (x.certs || []).slice(); certs[i] = { ...certs[i], [k]: v }; return { ...x, certs }; });
  const addCert = () => setF((x) => ({ ...x, certs: [...(x.certs || []), { id: crypto.randomUUID(), name: '', number: '', required: false }] }));
  const rmCert = (i) => setF((x) => ({ ...x, certs: (x.certs || []).filter((_, j) => j !== i) }));
  // Service categories (pillars), each with services (spokes) underneath.
  const addPillar = () => setF((x) => ({ ...x, pillars: [...(x.pillars || []), { name: '', services: [{ name: '', url: '' }] }] }));
  const rmPillar = (pi) => setF((x) => ({ ...x, pillars: (x.pillars || []).filter((_, j) => j !== pi) }));
  const setPillarName = (pi, v) => setF((x) => { const pillars = (x.pillars || []).slice(); pillars[pi] = { ...pillars[pi], name: v }; return { ...x, pillars }; });
  const addSvc = (pi) => setF((x) => { const pillars = (x.pillars || []).slice(); pillars[pi] = { ...pillars[pi], services: [...(pillars[pi].services || []), { name: '', url: '' }] }; return { ...x, pillars }; });
  const rmSvc = (pi, si) => setF((x) => { const pillars = (x.pillars || []).slice(); pillars[pi] = { ...pillars[pi], services: (pillars[pi].services || []).filter((_, j) => j !== si) }; return { ...x, pillars }; });
  const setSvc = (pi, si, k, v) => setF((x) => { const pillars = (x.pillars || []).slice(); const services = (pillars[pi].services || []).slice(); services[si] = { ...services[si], [k]: v }; pillars[pi] = { ...pillars[pi], services }; return { ...x, pillars }; });
  const togglePlat = (id) => setF((x) => { const n = new Set(x.platforms); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, platforms: n }; });

  if (p === null) return html`<${Card}><div class="p-4 text-sm text-slate-400">Loading brand kit…</div></${Card}>`;
  return html`<${Card}><div class="p-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-3 min-w-0">
        ${logoUrl ? html`<img src=${logoUrl} alt="logo" class="h-9 w-9 rounded-lg object-contain bg-white border border-slate-100" />` : html`<div class="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">🏷</div>`}
        <div class="min-w-0">
          <div class="font-semibold text-slate-800">Brand kit & plan</div>
          <div class="text-xs text-slate-400 truncate">${[f.phone, f.website].filter(Boolean).join(' · ') || 'Phone, website, logo and colors — injected into every generated image.'} · posting plan lives on the Social tab</div>
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
      <${Field} label="Ideal client profile (optional — who every post and blog should speak to)"><${Textarea} value=${f.icp} onInput=${(v) => setF({ ...f, icp: v })} rows=${2} placeholder="Homeowners 35-65 in Marion County with 1+ acre properties; value reliability over lowest price; worried about curb appeal and protecting their biggest investment…" /></${Field}>
      <${Field} label="Warranty / guarantee (optional — used as real proof in posts and blogs, never embellished)"><${Textarea} value=${f.warranty} onInput=${(v) => setF({ ...f, warranty: v })} rows=${2} placeholder="5-year workmanship warranty on all installs; 30-day satisfaction guarantee on cleanings…" /></${Field}>
      <div>
        <label class="text-[11px] text-slate-400 block mb-1">🧰 Service categories & services <span class="text-slate-300">— group the services you offer under a category (e.g. "Roofing" → "Metal Roof Installation", "Roof Repair"). The AI writes posts and blogs about these, and the Site Builder plans a pillar page per category with a page for each service under it. A page link is optional.</span></label>
        <div class="space-y-2.5">
          ${(f.pillars || []).map((pl, pi) => html`<div class="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5" key=${pi}>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-slate-400 text-sm shrink-0" title="Service category (pillar)">📂</span>
              <${Input} value=${pl.name || ''} onInput=${(v) => setPillarName(pi, v)} placeholder="Category name (e.g. Roofing)" class="flex-1 min-w-[160px] font-medium" />
              <button onClick=${() => rmPillar(pi)} class="text-slate-300 hover:text-rose-600 shrink-0" title="Remove this category and its services">✕</button>
            </div>
            <div class="space-y-1.5 pl-6">
              ${(pl.services || []).map((s, si) => html`<div class="flex items-center gap-2 flex-wrap rounded-md border border-slate-100 bg-white px-2.5 py-1.5" key=${si}>
                <${Input} value=${s.name || ''} onInput=${(v) => setSvc(pi, si, 'name', v)} placeholder="Service name (e.g. Metal Roof Installation)" class="flex-1 min-w-[170px]" />
                <${Input} value=${s.url || ''} onInput=${(v) => setSvc(pi, si, 'url', v)} placeholder="Page link (optional)" class="w-48" />
                <button onClick=${() => rmSvc(pi, si)} class="text-slate-300 hover:text-rose-600" title="Remove this service">✕</button>
              </div>`)}
              ${(pl.services || []).length < 60 && html`<button onClick=${() => addSvc(pi)} class="text-xs text-slate-400 hover:text-brand-700 underline">+ Add service</button>`}
            </div>
          </div>`)}
          ${(f.pillars || []).length < 30 && html`<button onClick=${addPillar} class="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Add category</button>`}
        </div>
      </div>
      <${Field} label="💡 Insights for the AI (optional — first-party knowledge woven into posts and blogs: what makes you different, seasonal tips, questions customers always ask, myths to bust)"><${Textarea} value=${f.insights} onInput=${(v) => setF({ ...f, insights: v })} rows=${4} placeholder="We only use synthetic underlayment, never felt. Spring is the best time to reseal a driveway in Florida. Customers always ask if pressure washing damages siding — it doesn't when done right. Every crew is in-house; we never subcontract…" /></${Field}>
      <div>
        <label class="text-[11px] text-slate-400 block mb-1">Brand voices you approve for the writing <span class="text-slate-300">— pick any; the AI writes each month in ONE of them. Leave all off to let AI choose</span></label>
        <div class="flex flex-wrap gap-1.5">
          ${VOICES.map(([id, label, hint]) => html`<button onClick=${() => setF((x) => { const n = new Set(x.voices); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, voices: n }; })} title=${hint}
            class=${cx('text-xs px-2.5 py-1 rounded-full border', f.voices?.has(id) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:border-brand-300')}>${label}</button>`)}
        </div>
        ${f.voices?.size > 0 && html`<div class="text-[11px] text-slate-400 mt-1">Captions and blogs will only be written in ${f.voices.size === 1 ? 'this voice' : `one of these ${f.voices.size} voices`}.</div>`}
      </div>
      <div>
        <label class="text-[11px] text-slate-400 block mb-1">📜 Certifications & licenses <span class="text-slate-300">— cited as real proof in posts and blogs; check "must be listed" for legally required numbers (e.g. contractor license)</span></label>
        <div class="space-y-1.5">
          ${(f.certs || []).map((c, i) => {
            const saved = (p?.certifications || []).find((x) => x?.id === c.id);
            return html`<div class="flex items-center gap-2 flex-wrap rounded-lg border border-slate-100 px-2.5 py-2">
              ${saved?.url
                ? html`<img src=${saved.url} alt="badge" class="h-10 w-10 object-contain rounded bg-white border border-slate-100 shrink-0" />`
                : html`<label class="h-10 w-10 rounded border border-dashed border-slate-200 flex items-center justify-center text-slate-300 cursor-pointer shrink-0" title="Upload this certification's badge image (PNG or JPEG)">📜<input type="file" accept="image/png,image/jpeg" class="hidden" disabled=${busy === 'cert'} onChange=${(e) => { certUpload(c.id, e.target.files?.[0]); e.target.value = ''; }} /></label>`}
              <${Input} value=${c.name || ''} onInput=${(v) => setCert(i, 'name', v)} placeholder="Certification name (e.g. FL Certified General Contractor)" class="flex-1 min-w-[180px]" />
              <${Input} value=${c.number || ''} onInput=${(v) => setCert(i, 'number', v)} placeholder="Number (CGC123456)" class="w-40" />
              <label class="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap" title="Legally required on advertising — the AI ends every promo caption with it">
                <input type="checkbox" checked=${!!c.required} onChange=${(e) => setCert(i, 'required', e.target.checked)} class="accent-brand-600" />must be listed
              </label>
              ${saved?.url && html`<label class="text-[11px] text-slate-400 underline cursor-pointer" title="Replace the badge image (PNG or JPEG)">replace<input type="file" accept="image/png,image/jpeg" class="hidden" disabled=${busy === 'cert'} onChange=${(e) => { certUpload(c.id, e.target.files?.[0]); e.target.value = ''; }} /></label>`}
              <button onClick=${() => rmCert(i)} class="text-slate-300 hover:text-rose-600" title="Remove this certification">✕</button>
            </div>`;
          })}
          ${busy === 'cert' && html`<span class="text-xs text-sky-600 animate-pulse">Uploading badge…</span>`}
          ${(f.certs || []).length < 12 && html`<button onClick=${addCert} class="text-xs text-slate-400 hover:text-brand-700 underline">+ Add certification</button>`}
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="text-[11px] text-slate-400 block mb-1">Logo (PNG with transparency works best — any file size, big files are optimized automatically)</label>
          <div class="flex items-center gap-2">
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled=${busy === 'logo'} onChange=${(e) => upload(e.target.files?.[0])} class="text-xs" />
            ${busy === 'logo' && html`<span class="text-xs text-sky-600 animate-pulse whitespace-nowrap">Uploading…</span>`}
          </div>
        </div>
        <div>
          <label class="text-[11px] text-slate-400 block mb-1">🏆 Awards & badges <span class="text-slate-300">— "Best of" wins, certifications; added to proof, local and promo images beside the logo (up to 6)</span></label>
          <div class="flex flex-wrap items-center gap-2">
            ${(p?.badges || []).map((b) => html`<div class="relative group">
              <img src=${b.url} alt=${b.name || 'badge'} title=${b.name || ''} class="h-14 w-14 object-contain rounded-lg border border-slate-100 bg-white" />
              <button onClick=${() => badgeDel(b.path)} class="absolute -top-1.5 -right-1.5 hidden group-hover:block bg-rose-600 text-white rounded-full w-5 h-5 text-xs leading-none">✕</button>
            </div>`)}
            ${(p?.badges || []).length < 6 && html`<input type="file" accept="image/png,image/jpeg,image/webp" disabled=${busy === 'badge'} onChange=${(e) => { badgeUpload(e.target.files?.[0]); e.target.value = ''; }} class="text-xs" />`}
            ${busy === 'badge' && html`<span class="text-xs text-sky-600 animate-pulse whitespace-nowrap">Uploading…</span>`}
          </div>
        </div>
      </div>
      <div>
        <label class="text-[11px] text-slate-400 block mb-1">Visual styles you approve for generated images <span class="text-slate-300">— pick any; leave all off to let AI choose</span></label>
        <div class="flex flex-wrap gap-1.5">
          ${AESTHETICS.map(([id, label, hint]) => html`<button onClick=${() => setF((x) => { const n = new Set(x.aesthetics); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, aesthetics: n }; })} title=${hint}
            class=${cx('text-xs px-2.5 py-1 rounded-full border', f.aesthetics?.has(id) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:border-brand-300')}>${label}</button>`)}
        </div>
        ${f.aesthetics?.size > 0 && html`<div class="text-[11px] text-slate-400 mt-1">The AI will only design within ${f.aesthetics.size === 1 ? 'this style' : `these ${f.aesthetics.size} styles`}.</div>`}
      </div>
      <div>
        <label class="text-[11px] text-slate-400 block mb-1">Image sources <span class="text-slate-300">— company-only builds every image strictly over your real photos; AI-only never uses them</span></label>
        <div class="flex flex-wrap gap-1.5">
          ${[['company', '📷 Company photos'], ['ai', '🤖 AI imagery']].map(([id, label]) => html`<button
            onClick=${() => setF((x) => { const n = new Set(x.imageSources); if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id); return { ...x, imageSources: n }; })}
            class=${cx('text-xs px-2.5 py-1 rounded-full border', f.imageSources?.has(id) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-500 hover:border-brand-300')}>${label}</button>`)}
        </div>
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
// Which GHL account platforms a post-plan platform maps to (mirrors seo-social
// PLAT_MAP) — used to default the per-post "Post to" picker to the accounts a
// post would auto-publish to.
const PLAT_GROUP = { facebook: ['facebook'], instagram: ['instagram'], gbp: ['google', 'gmb', 'google_my_business', 'googlemybusiness'], tiktok: ['tiktok', 'tiktok-business'] };

// Posting plan — lives on the Social tab (moved out of the brand kit): how
// much to post, how many Reels, how many review highlights, and the comment
// automation trigger. Saves through profile_save with the FULL profile so
// nothing else gets clobbered.
export function PlanCard({ site, onBanner }) {
  const [f, setF] = useState(null); // full profile form (subset edited here)
  const [reviews, setReviews] = useState(null); // { count, pending, syncedAt }
  const [mix, setMix] = useState({}); // { serviceName: posts } — owner allocation
  const [mapSvcs, setMapSvcs] = useState(null); // service names from the website map
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [apMsg, setApMsg] = useState(''); // autopilot run/status message

  const loadReviews = () => seoSocialReviewsList(site).then((r) => setReviews({ count: (r.reviews || []).length, fresh: (r.reviews || []).filter((x) => !x.used_month).length, pending: r.pending, syncedAt: r.syncedAt })).catch(() => setReviews({ count: 0, fresh: 0, pending: false, syncedAt: null }));
  useEffect(() => {
    setF(null); setReviews(null); setErr(''); setMix({}); setMapSvcs(null);
    if (!site) return;
    seoSocialProfile(site).then((r) => {
      const pr = r.profile || {};
      const m = {};
      (Array.isArray(pr.plan?.serviceMix) ? pr.plan.serviceMix : []).forEach((x) => { if (x?.service) m[x.service] = Number(x.posts) || 0; });
      setMix(m);
      setF({ phone: pr.phone || '', website: pr.website || '', bookingUrl: pr.booking_url || '', brandColor1: pr.brand_color1 || '', brandColor2: pr.brand_color2 || '', voiceNotes: pr.voice_notes || '', icp: pr.icp || '', warranty: pr.warranty || '', promotion: pr.promotion || '', approvalEmail: pr.approval_email || '', approvalCc: pr.approval_cc || '', aesthetics: Array.isArray(pr.aesthetics) ? pr.aesthetics : [], voices: Array.isArray(pr.voices) ? pr.voices : [], certs: Array.isArray(pr.certifications) ? pr.certifications : [], commentTrigger: pr.comment_trigger || '', commentOffer: pr.comment_offer || '', postsPerDay: pr.plan?.postsPerDay || 1, reelsPerMonth: pr.plan?.reelsPerMonth ?? 3, reviewsPerMonth: pr.plan?.reviewsPerMonth ?? 0, platforms: pr.plan?.platforms || ['facebook', 'instagram'], imageSources: pr.plan?.imageSources?.length ? pr.plan.imageSources : ['company', 'ai'], manualServices: Array.isArray(pr.manual_services) ? pr.manual_services : [], autopilot: !!pr.autopilot });
    }).catch((e) => { setErr(e.message); });
    // Service rows carry over automatically from the website map (Strategy tab).
    seoStrategyPages(site).then((r) => setMapSvcs([...new Set((r.pages || []).filter((p2) => p2.is_service).map((p2) => p2.service_name || p2.path).filter(Boolean))])).catch(() => setMapSvcs([]));
    loadReviews();
  }, [site]);

  const allot = f ? Number(f.postsPerDay) * 30 : 0; // posts included in the plan (~30-day month)
  const allocated = Object.values(mix).reduce((a, n) => a + (Number(n) || 0), 0);
  const svcNames = [...new Set([...(mapSvcs || []), ...((f?.manualServices || []).map((s) => s.name).filter(Boolean)), ...Object.keys(mix)])];

  const save = async () => {
    if (allocated > allot) { setErr(`You've balanced ${allocated} posts but the plan only includes ${allot} per month (${f.postsPerDay}/day × 30). Lower some services.`); return; }
    const trig = (f.commentTrigger || '').trim(), offer = (f.commentOffer || '').trim();
    if ((trig && !offer) || (!trig && offer)) { setErr(trig ? 'Comment automation: you set a trigger word but not what commenting gets them — fill in the reward, or clear the word.' : 'Comment automation: you set what commenting gets them but no trigger word — add the word, or clear the reward.'); return; }
    setBusy('save'); setErr('');
    try {
      const serviceMix = Object.entries(mix).map(([service, posts]) => ({ service, posts: Number(posts) || 0 })).filter((m) => m.posts > 0);
      await seoSocialProfileSave(site, { phone: f.phone, website: f.website, bookingUrl: f.bookingUrl, brandColor1: f.brandColor1, brandColor2: f.brandColor2, voiceNotes: f.voiceNotes, icp: f.icp, warranty: f.warranty, promotion: f.promotion, approvalEmail: f.approvalEmail, approvalCc: f.approvalCc, aesthetics: f.aesthetics, voices: f.voices, certifications: f.certs, commentTrigger: f.commentTrigger, commentOffer: f.commentOffer, plan: { postsPerDay: Number(f.postsPerDay), reelsPerMonth: Number(f.reelsPerMonth), reviewsPerMonth: Number(f.reviewsPerMonth), platforms: f.platforms, imageSources: f.imageSources, serviceMix } });
      onBanner('✅ Posting plan saved — it applies from the next month you plan.');
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  // Autopilot toggles save immediately (conditional write — never touches the
  // rest of the profile). ON = on the 1st, next month is planned, written,
  // imaged, then the agency manager is emailed that it's ready for review.
  const toggleAutopilot = async (val) => {
    setErr(''); setApMsg(''); setF((x) => ({ ...x, autopilot: val }));
    try { await seoSocialProfileSave(site, { autopilot: val }); onBanner(val ? '🤖 Autopilot ON — next month generates automatically on the 1st.' : 'Autopilot turned off.'); }
    catch (e) { setErr(e.message); setF((x) => ({ ...x, autopilot: !val })); }
  };
  const runAutopilotNow = async () => {
    setBusy('autopilot'); setErr(''); setApMsg('');
    try {
      const r = await seoAutopilotRunNow(site);
      setApMsg(r.alreadyPlanned
        ? `${r.month} is already planned — autopilot will finish generating it and email the agency manager.`
        : `Started ${r.month}: ${r.posts} posts planned. Captions and images generate automatically over the next little while, then the agency manager is emailed when it's ready for review.`);
      onBanner(`🤖 Autopilot started for ${r.month || 'next month'}.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const syncReviews = async () => {
    setBusy('reviews'); setErr('');
    try {
      const r = await seoSocialReviewsSync(site);
      if (r.pending) onBanner(`⭐ ${r.note || 'Collecting Google reviews — press Sync again in a minute or two.'}`);
      else onBanner(`⭐ Imported ${r.imported} five-star review(s) — ${r.fiveStarOnFile} on file for review-highlight posts.`);
      await loadReviews();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (f === null) return html`<${Card}><div class="p-4 text-sm text-slate-400">Loading posting plan…</div></${Card}>`;
  return html`<${Card}><div class="p-4">
    <div class="font-semibold text-slate-800 mb-1">🗓 Posting plan</div>
    <p class="text-xs text-slate-400 mb-3">How much gets created each month. Review highlights quote your real 5-star Google reviews — sync them below.</p>
    ${err && html`<div class="text-xs text-rose-600 mb-2">${err}</div>`}
    <div class=${cx('mb-4 rounded-xl border p-3', f.autopilot ? 'border-brand-300 bg-brand-50/70' : 'border-slate-200 bg-slate-50/60')}>
      <label class="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked=${!!f.autopilot} onChange=${(e) => toggleAutopilot(e.target.checked)} class="mt-0.5 accent-brand-600 h-4 w-4" />
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-800">🤖 Autopilot</div>
          <p class="text-xs text-slate-500 mt-0.5">On the 1st of each month, automatically plan the <b>next</b> month's calendar for this business, write every caption, generate every image, and then email your agency social media manager (set in Agency settings) that the plan is ready for review. Nothing is scheduled until someone reviews it.</p>
        </div>
      </label>
      <div class="mt-2.5 flex flex-wrap items-center gap-2 pl-6">
        <${Btn} size="sm" variant="secondary" onClick=${runAutopilotNow} disabled=${busy === 'autopilot'}>${busy === 'autopilot' ? 'Starting…' : '⚡ Generate next month now'}</${Btn}>
        <span class="text-xs text-slate-400">Runs the full autopilot for next month right away (handy for testing).</span>
      </div>
      ${apMsg && html`<div class="text-xs text-brand-700 mt-2 pl-6">${apMsg}</div>`}
    </div>
    <div class="flex flex-wrap items-end gap-3">
      <${Select} value=${String(f.postsPerDay)} onChange=${(v) => setF({ ...f, postsPerDay: v })} options=${[{ value: '1', label: '1 post / day' }, { value: '2', label: '2 posts / day' }, { value: '3', label: '3 posts / day' }]} />
      <${Select} value=${String(f.reelsPerMonth)} onChange=${(v) => setF({ ...f, reelsPerMonth: v })} options=${[0, 2, 3, 4, 6, 8, 12].map((n) => ({ value: String(n), label: `${n} Reels / month` }))} />
      <${Select} value=${String(f.reviewsPerMonth)} onChange=${(v) => setF({ ...f, reviewsPerMonth: v })} options=${[0, 1, 2, 3, 4, 6, 8].map((n) => ({ value: String(n), label: `${n} review highlight${n === 1 ? '' : 's'} / month` }))} />
    </div>
    ${Number(f.reviewsPerMonth) > 0 && html`<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      ${reviews === null ? html`<span class="text-slate-400">Checking review library…</span>` : html`
        <span class=${(reviews.fresh ?? reviews.count) > 0 ? 'text-emerald-700' : 'text-amber-700'}>⭐ ${reviews.count} five-star review${reviews.count === 1 ? '' : 's'} on file${reviews.count > 0 ? ` · ${reviews.fresh} not yet used` : ''}${reviews.syncedAt ? ` (synced ${new Date(reviews.syncedAt).toLocaleDateString()})` : ''}</span>
        <${Btn} size="sm" variant="secondary" onClick=${syncReviews} disabled=${busy === 'reviews'}>${busy === 'reviews' ? 'Syncing…' : reviews.pending ? '⭐ Finish review sync' : '⭐ Sync Google reviews'}</${Btn}>
        ${reviews.count === 0 && !reviews.pending && html`<span class="text-slate-400">Sync pulls them from Google (takes a minute or two).</span>`}`}
    </div>`}
    <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div class="text-sm font-medium text-slate-700">📧 Client approval</div>
      <p class="text-xs text-slate-400 mt-0.5 mb-2">When every graphic for a planned month finishes generating, the business admin below automatically gets a brand-styled email with a private link to review the posts — approve all (auto-scheduled to GoHighLevel) or request replacements with feedback that drives the regeneration. Leave empty to skip client approval for this business.</p>
      <div class="grid sm:grid-cols-2 gap-3">
        <${Field} label="Approval email (the business admin)"><${Input} type="email" value=${f.approvalEmail} onInput=${(v) => setF({ ...f, approvalEmail: v })} placeholder="owner@business.com" /></${Field}>
        <${Field} label="CC on the approval email (optional, comma-separated)"><${Input} value=${f.approvalCc} onInput=${(v) => setF({ ...f, approvalCc: v })} placeholder="office@business.com" /></${Field}>
      </div>
    </div>
    <div class="mt-4">
      <${Field} label="🎁 Current promotion (this month's real offer — used word-for-word in promo posts; leave empty for none)">
        <${Textarea} rows="2" value=${f.promotion} onInput=${(v) => setF({ ...f, promotion: v })} placeholder="$150 off any full exterior wash booked by August 31 — new customers only" />
      </${Field}>
      <p class="text-xs text-slate-400 mt-1">Promo posts feature exactly this offer (terms and deadline included). With nothing here, promo posts push free estimates instead — the AI never invents a discount. Clear it when the promotion ends.</p>
    </div>
    <div class="mt-4">
      <div class="text-sm font-medium text-slate-700">⚖️ Post balance by service</div>
      <p class="text-xs text-slate-400 mb-2">Your services carry over from the website map (Strategy tab). Give each one a share of the month's posts — whatever you leave unallocated, the AI strategy balances for you.</p>
      ${mapSvcs === null && html`<div class="text-xs text-slate-400">Loading services…</div>`}
      ${mapSvcs !== null && svcNames.length === 0 && html`<div class="text-xs text-amber-700">No service pages designated yet — mark them on the Strategy tab and they'll appear here.</div>`}
      ${svcNames.length > 0 && html`<div class="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
        ${svcNames.map((name) => html`<div class="flex items-center justify-between gap-2 text-sm" key=${name}>
          <span class="text-slate-700 truncate" title=${name}>${name}</span>
          <input type="number" min="0" max=${allot} value=${mix[name] ?? ''} placeholder="0"
            onInput=${(e) => { const v = e.target.value; setMix((m) => ({ ...m, [name]: v === '' ? 0 : Math.max(0, Math.floor(Number(v) || 0)) })); }}
            class="w-16 shrink-0 border border-slate-200 rounded-lg px-2 py-1 text-sm text-right" />
        </div>`)}
      </div>
      <div class=${cx('text-xs mt-2', allocated > allot ? 'text-rose-600 font-medium' : 'text-slate-500')}>
        ${allocated} of ${allot} monthly post${allot === 1 ? '' : 's'} balanced${allocated > allot ? ` — that's ${allocated - allot} over the plan; lower some counts.` : allocated < allot ? ` · ${allot - allocated} left for the AI strategy to balance.` : ' · fully allocated.'}
      </div>`}
    </div>
    <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div class="text-sm font-medium text-slate-700">💬 Comment automation <span class="text-xs font-normal text-slate-400">— optional, but these two are a pair</span></div>
      <p class="text-xs text-slate-400 mt-0.5 mb-2">The trigger word fires your DM automation; the reward is what commenting gets them. Roughly 1 in 3 posts will use it as the call to action.</p>
      <div class="grid sm:grid-cols-2 gap-3">
        <${Field} label="1 · Trigger word they comment"><${Input} value=${f.commentTrigger} onInput=${(v) => setF({ ...f, commentTrigger: v })} placeholder="SHED" /></${Field}>
        <${Field} label="2 · What commenting gets them"><${Input} value=${f.commentOffer} onInput=${(v) => setF({ ...f, commentOffer: v })} placeholder="a free estimate via DM" /></${Field}>
      </div>
      ${(() => {
        const trig = (f.commentTrigger || '').trim(), offer = (f.commentOffer || '').trim();
        if (trig && offer) return html`<div class="text-xs text-emerald-700 mt-2">Posts will say: “Comment <span class="font-semibold">${trig.toUpperCase()}</span> and we'll send you ${offer}.”</div>`;
        if (trig || offer) return html`<div class="text-xs text-amber-700 mt-2">⚠ Both fields are needed together — ${trig ? 'add what commenting gets them' : 'add the trigger word'} (or clear the other one).</div>`;
        return null;
      })()}
    </div>
    <div class="mt-3"><${Btn} size="sm" onClick=${save} disabled=${busy === 'save'}>${busy === 'save' ? 'Saving…' : 'Save posting plan'}</${Btn}></div>
  </div></${Card}>`;
}

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
  // Click-through folder browser: path = breadcrumb trail, folders = the
  // current level's subfolders. Top level mixes My Drive, shared-with-me
  // (owner shown to tell same-named client folders apart) and shared drives.
  const [path, setPath] = useState([]);
  const browse = async (trail) => {
    setBusy('folders'); setErr(''); setFolderQ('');
    try {
      const parent = trail.length ? trail[trail.length - 1] : null;
      const r = await seoSocialDriveBrowse(site, parent?.id);
      setPath(trail); setFolders(r.folders || []);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const pickFolder = async (f) => {
    setBusy('pick'); setErr('');
    try {
      await seoSocialDrivePick(site, f.id, f.name);
      setDrive((d) => ({ ...d, folderId: f.id, folderName: f.name })); setFolders(null); setPath([]);
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
      // PHASE 1 — pull EVERY photo in first. The backend imports in capped
      // chunks and returns more:true while work remains; keep calling until
      // the whole Drive tree + Job Tracker set is imported.
      let imported = 0, rounds = 0, r = null;
      const seenErrors = new Set();
      do {
        r = await seoSocialPhotosSync(site);
        imported += r.imported || 0;
        rounds++;
        for (const e of (r.errors || [])) seenErrors.add(e);
        onBanner(`📷 Importing photos… ${imported} in so far${r.more ? ' — still pulling, hang tight.' : '.'}`);
        await load();
        // A round that imported nothing and still says more would loop forever
        // (e.g. every remaining file errors) — surface and stop instead.
        if (r.more && !r.imported && rounds > 1) { seenErrors.add('Import stopped early — some files could not be imported. Check the source folder and Sync again.'); break; }
      } while (r.more && rounds < 40);
      if (seenErrors.size) setErr([...seenErrors].slice(0, 10).join(' · '));
      onBanner(`📷 Import complete — ${imported} new photo(s); ${r.driveSeen} Drive image(s) across ${r.foldersScanned || 1} folder(s), ${r.jtSeen} social-tagged in Job Tracker${r.jtLinked ? '' : ' (no Job Tracker company linked)'}.`);
      // PHASE 2 — with the full library in, AI-label everything not yet
      // analyzed so the post matcher can use it.
      let labeled = 0;
      for (let i = 0; i < 40; i++) {
        const a = await seoPhotoAnalyze(site, 48);
        labeled += a.analyzed || 0;
        if (!a.remaining) break;
        onBanner(`🧠 Photos are in — AI is reading them now… ${a.remaining} left`);
      }
      await load();
      if (labeled > 0) onBanner(`✅ Done — ${imported} photo(s) imported and ${labeled} analyzed. AI can now match them to posts automatically.`);
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
          ${folders === null ? html`
            <${Btn} size="sm" variant="secondary" onClick=${() => browse([])} disabled=${busy === 'folders'}>${busy === 'folders' ? 'Loading…' : `📂 ${drive.folderId ? 'Change the photo folder' : 'Browse Drive for the photo folder'}`}</${Btn}>`
          : html`<div class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="flex items-center flex-wrap gap-1 px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs">
              <button onClick=${() => browse([])} class=${cx('hover:text-brand-700', path.length ? 'text-brand-600 underline' : 'text-slate-700 font-medium')}>Drive</button>
              ${path.map((seg, i) => html`<span class="text-slate-300">›</span>
                <button onClick=${() => browse(path.slice(0, i + 1))} class=${cx('hover:text-brand-700 max-w-[160px] truncate', i === path.length - 1 ? 'text-slate-700 font-medium' : 'text-brand-600 underline')} title=${seg.name}>${seg.name}</button>`)}
              <span class="flex-1"></span>
              ${busy === 'folders' && html`<span class="text-slate-400">Loading…</span>`}
              <button onClick=${() => { setFolders(null); setPath([]); }} class="text-slate-400 hover:text-slate-600">✕ Close</button>
            </div>
            ${path.length > 0 && html`<div class="flex items-center justify-between px-3 py-2 bg-brand-50/60 border-b border-slate-100">
              <div class="text-xs text-slate-600 truncate">Current folder: <span class="font-medium text-slate-800">${path[path.length - 1].name}</span></div>
              <${Btn} size="sm" onClick=${() => pickFolder(path[path.length - 1])} disabled=${busy === 'pick'}>${busy === 'pick' ? 'Saving…' : '✓ Use this folder'}</${Btn}>
            </div>`}
            <div class="max-h-64 overflow-y-auto divide-y divide-slate-50">
              ${folders.length > 8 && html`<div class="px-3 py-1.5"><${Input} value=${folderQ} onInput=${setFolderQ} placeholder="Filter this list…" /></div>`}
              ${(() => {
                const q = folderQ.trim().toLowerCase();
                const shown = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
                if (!shown.length) return html`<div class="px-3 py-3 text-xs text-slate-400">${folders.length ? 'No folders match the filter.' : 'No subfolders in here — use “✓ Use this folder” above if this is the one.'}</div>`;
                return shown.map((f) => html`<div class="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 group" key=${f.id}>
                  <button onClick=${() => browse([...path, f])} disabled=${busy === 'folders'} class="flex-1 min-w-0 text-left text-sm text-slate-700 flex items-center gap-2">
                    <span>${f.kind === 'drive' ? '🗄' : '📁'}</span>
                    <span class="truncate">${f.name}</span>
                    ${f.kind === 'shared' && html`<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 shrink-0">shared${f.owner ? ` · ${f.owner}` : ''}</span>`}
                    ${f.kind === 'drive' && html`<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">shared drive</span>`}
                    ${drive.folderId === f.id && html`<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">current</span>`}
                    <span class="text-slate-300 group-hover:text-slate-400 shrink-0">open ›</span>
                  </button>
                  <${Btn} size="sm" variant="secondary" onClick=${() => pickFolder(f)} disabled=${busy === 'pick'}>Select</${Btn}>
                </div>`);
              })()}
            </div>
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
  // OAuth sign-in: open GHL's consent in a small popup WINDOW (not a full tab),
  // then poll until the callback stores the connection. The popup redirects to
  // /ghl-connected.html which closes itself on success — this tab updates on its
  // own, so there's nothing to close manually.
  const signIn = async () => {
    setBusy('oauth'); setErr('');
    try {
      const r = await seoSocialGhlOauthStart(site);
      // Named window → re-clicking reuses the same popup instead of stacking tabs.
      const w = window.open(r.url, 'ghl_oauth', 'width=640,height=780,menubar=no,toolbar=no');
      if (!w) { setErr('Your browser blocked the sign-in window — allow pop-ups for this site, then click “Sign in with GoHighLevel” again.'); setBusy(''); return; }
      try { w.focus(); } catch (_) { /* ignore */ }
      let ticks = 0;
      const iv = setInterval(async () => {
        ticks++;
        if (ticks > 75) { // ~5 min
          clearInterval(iv); setBusy('');
          setErr('We didn’t detect a connection. If you finished on the GoHighLevel window, click “↻ Refresh accounts” or reopen ⚙ Manage — it may just need a moment.');
          return;
        }
        try {
          const s = await seoSocialGhlStatus(site);
          // Location sign-in → connected; agency sign-in → pending sub-account pick.
          if ((s.connected && s.ghl?.authMode) || s.pending) {
            clearInterval(iv); setBusy(''); setSt(s); setSel(new Set(s.ghl?.selected || []));
            try { w.close(); } catch (_) { /* the page self-closes anyway */ }
            if (s.connected) onBanner(`🔗 GoHighLevel connected via sign-in — ${(s.ghl?.accounts || []).length} social account(s)${s.ghl?.userName ? `, posting as ${s.ghl.userName}` : ''}.`);
          }
        } catch (_) { /* keep polling */ }
      }, 4000);
    } catch (e) { setErr(e.message); setBusy(''); }
  };
  // Agency sign-in returns a COMPANY token; the user picks which sub-account
  // this business posts to, and the server exchanges it for a location token.
  const pickLocation = async (locationId) => {
    setBusy('pick'); setErr('');
    try {
      const s = await seoSocialGhlPickLocation(site, locationId);
      setSt(s); setSel(new Set(s.ghl?.selected || []));
      onBanner(`🔗 GoHighLevel connected — ${(s.ghl?.accounts || []).length} social account(s)${s.ghl?.userName ? `, posting as ${s.ghl.userName}` : ''}.`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
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
    ${st.connected && (g.accounts || []).length > 0 && !open && html`<div class="mt-2 flex flex-wrap items-center gap-1.5">
      <span class="text-[11px] text-slate-400">Connected pages:</span>
      ${(g.accounts || []).map((a) => html`<span title=${(g.selected || []).includes(a.id) ? 'active — posts publish here' : 'off — enable under Manage'}
        class=${cx('text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1', (g.selected || []).includes(a.id) ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-300')}>
        <span>${PLAT_ICON[a.platform] || '🌐'}</span>${a.name}${(g.selected || []).includes(a.id) ? '' : ' (off)'}</span>`)}
      <button onClick=${() => setOpen(true)} class="text-[11px] text-brand-600 underline">change</button>
    </div>`}
    ${open && html`<div class="mt-3 pt-3 border-t border-slate-100 space-y-3">
      ${st.connected && (g.accounts || []).length > 0 && html`<div>
        <div class="text-xs font-medium text-slate-500 mb-1.5">Post to these accounts <span class="font-normal text-slate-400">— the default for every post; override per post in the review screen</span></div>
        <div class="flex flex-wrap gap-1.5">
          ${(g.accounts || []).map((a) => html`<button onClick=${() => toggleAcc(a.id)}
            class=${cx('text-xs px-2.5 py-1 rounded-full border flex items-center gap-1', sel.has(a.id) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-400')}>
            <span>${PLAT_ICON[a.platform] || '🌐'}</span>${a.name}</button>`)}
        </div>
        <div class="mt-2"><${Btn} size="sm" onClick=${saveSel} disabled=${busy === 'sel'}>${busy === 'sel' ? 'Saving…' : 'Save accounts'}</${Btn}></div>
      </div>`}
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <${Btn} variant="cta" onClick=${signIn} disabled=${busy === 'oauth'}>${busy === 'oauth' ? 'Waiting for GoHighLevel…' : st.connected ? '🔑 Sign in again' : '🔑 Sign in with GoHighLevel'}</${Btn}>
          ${st.connected && html`<${Btn} size="sm" variant="secondary" onClick=${async () => { setBusy('ref'); try { await seoSocialGhlRefreshAccounts(site); await load(); onBanner('↻ Social accounts refreshed from GoHighLevel.'); } catch (e) { setErr(e.message); } finally { setBusy(''); } }} disabled=${!!busy}>↻ Refresh accounts</${Btn}>`}
        </div>
        ${st.pending && html`<div class="rounded-lg border-2 border-brand-200 bg-brand-50 p-3">
          <div class="text-xs font-semibold text-brand-700 mb-1.5">Signed in as your agency ✓ — choose this business's GoHighLevel sub-account</div>
          ${(st.pendingLocations || []).length > 0
            ? html`<div class="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                ${(st.pendingLocations || []).map((l) => html`<button onClick=${() => pickLocation(l.id)} disabled=${!!busy}
                  class="text-xs px-2.5 py-1 rounded-full border border-brand-300 bg-white text-brand-700 hover:bg-brand-100 disabled:opacity-50">${busy === 'pick' ? 'Connecting…' : (l.name || l.id)}</button>`)}
              </div>`
            : html`<p class="text-xs text-brand-700">No sub-accounts came back from GoHighLevel. Click <span class="font-medium">Sign in again</span>, and on the GoHighLevel screen make sure the app is installed on the client's sub-account.</p>`}
        </div>`}
        <p class="text-xs text-slate-500">A GoHighLevel window opens — sign in and (if prompted) pick the client's sub-account. This tab finishes automatically.</p>
        <details>
          <summary class="text-xs text-slate-400 cursor-pointer">Trouble signing in? Connect with a Private Integration token instead</summary>
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
// used only to ORDER the picker (selection stays fully manual). The client's
// own Drive folder title is the strongest signal: a folder↔service word match
// outweighs any single description keyword.
function photoScore(p, post) {
  const hay = `${(Array.isArray(p.tags) ? p.tags.join(' ') : '')} ${p.description || ''} ${p.name || ''} ${p.folder_name || ''}`.toLowerCase();
  const needles = `${post.topic || ''} ${post.target_service || ''} ${post.target_city || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let s = 0;
  for (const w of new Set(needles)) if (hay.includes(w)) s++;
  if (p.folder_name && post.target_service) {
    const folder = String(p.folder_name).toLowerCase();
    const svcWords = String(post.target_service).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    if (svcWords.some((w) => folder.includes(w))) s += 3;
  }
  return s;
}

// Full-screen review mode: one post at a time, big media preview, one-tap
// decisions with auto-advance and a progress bar — built so a month of
// content can be reviewed in one fast pass instead of 30 modal round-trips.
function ReviewModal({ site, posts, revId, setRevId, library, ghl, onClose, onChanged }) {
  const idx = posts.findIndex((p) => p.id === revId);
  const post = idx >= 0 ? posts[idx] : null;
  const [f, setF] = useState(null);
  const [refSel, setRefSel] = useState(new Set());
  const [targetSel, setTargetSel] = useState(new Set()); // per-post GHL destination accounts
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(false); // full-screen media lightbox
  const [regenOpen, setRegenOpen] = useState(false); // in-dashboard regenerate-with-feedback composer
  const [regenFb, setRegenFb] = useState('');
  const [rejOpen, setRejOpen] = useState(false); // reject composer — rejecting auto-regenerates, steered by the reason
  const [rejFb, setRejFb] = useState('');
  const [rwOpen, setRwOpen] = useState(false); // rewrite-text composer — AI rewrites this one post's caption
  const [rwFb, setRwFb] = useState('');
  useEffect(() => {
    if (!post) return;
    setF({ caption: post.caption || '', overlay: post.overlay_text || '', tags: (post.hashtags || []).join(' '), cta: post.cta || '', prompt: post.format === 'video' ? (post.video_prompt || '') : (post.image_prompt || '') });
    setRefSel(new Set(Array.isArray(post.ref_photos) ? post.ref_photos : []));
    // Destinations: the post's saved override, else the connected pages whose
    // platform matches this post (the auto behavior), so the picker shows where
    // it would go by default.
    const accs = ghl?.accounts || [];
    const selectedSet = new Set(ghl?.selected || []);
    const auto = accs.filter((a) => selectedSet.has(a.id) && (post.platforms || []).some((pl) => (PLAT_GROUP[pl] || [pl]).includes(a.platform))).map((a) => a.id);
    setTargetSel(new Set(Array.isArray(post.target_accounts) && post.target_accounts.length ? post.target_accounts : auto));
    setErr(''); setZoom(false); setRegenOpen(false); setRegenFb(''); setRejOpen(false); setRejFb(''); setRwOpen(false); setRwFb('');
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
      if (e.key === 'Escape') { if (zoom) { setZoom(false); } else { onClose(); } return; }
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
  const toggleTarget = (id) => setTargetSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const saveFields = () => seoSocialUpdatePost(site, post.id, {
    caption: f.caption, overlayText: f.overlay, cta: f.cta,
    hashtags: f.tags.split(/[\s,]+/).filter(Boolean),
    refPhotos: [...refSel],
    ...((ghl?.accounts || []).length ? { targetAccounts: [...targetSel] } : {}),
    ...(post.format === 'video' ? { videoPrompt: f.prompt } : { imagePrompt: f.prompt }),
  });
  const run = async (name, fn, next) => { setBusy(name); setErr(''); try { await fn(); await onChanged(); if (next) advance(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const doSave = () => run('save', saveFields, false);
  const doApprove = () => run('ok', async () => { await saveFields(); await seoSocialApprove(site, post.id); }, true);
  // Rejecting a post doesn't kill it — it goes straight back into generation,
  // steered by the rejection reason (same prompt-revision path as client
  // feedback). The reason is recorded as reject_reason for the audit trail.
  const doReject = (fb) => run('no', async () => {
    const reason = String(fb || '').trim();
    await seoSocialReject(site, post.id, reason || 'rejected in review');
    await seoSocialRegenMedia(site, post.id, reason);
    setRejOpen(false); setRejFb('');
  }, true);
  const doRegen = (fb) => run('regen', async () => { await saveFields(); await seoSocialRegenMedia(site, post.id, (fb || '').trim()); setRegenOpen(false); setRegenFb(''); }, false);
  // AI-rewrite this one post's text; re-seed the editable fields from the
  // fresh copy so the new caption shows immediately.
  const doRewrite = (fb) => run('rw', async () => {
    const r = await seoSocialRewritePost(site, post.id, (fb || '').trim());
    const np = r.post;
    if (np) setF({ caption: np.caption || '', overlay: np.overlay_text || '', tags: (np.hashtags || []).join(' '), cta: np.cta || '', prompt: np.format === 'video' ? (np.video_prompt || '') : (np.image_prompt || '') });
    setRwOpen(false); setRwFb('');
  }, false);
  // Already scheduled in GHL: local edits can't reach the scheduled copy, so
  // it must be pulled back (deleted from the GHL planner) before editing.
  const pushed = !!post.ghl_post_id;
  const doUnschedule = () => run('unsch', async () => {
    if (!confirm('Remove this post from the GoHighLevel schedule? You can edit/regenerate it here and push it again.')) throw new Error('');
    const r = await seoSocialGhlUnschedule(site, post.id);
    if (r.note) setErr(r.note);
  }, false);
  const canRegen = !pushed && (post.status === 'written' || post.status === 'ready' || post.status === 'rejected' || post.status === 'approved');
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
          <div class="relative rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center min-h-[280px] overflow-hidden self-start">
            ${media && html`<button onClick=${() => setZoom(true)} title="View full size" class="absolute top-2 right-2 z-10 bg-slate-900/60 hover:bg-slate-900/80 text-white text-xs px-2.5 py-1.5 rounded-lg">⛶ Enlarge</button>`}
            ${media ? (post.format === 'video'
              ? html`<video src=${media} controls class="max-h-[62vh] w-full object-contain"></video>`
              : html`<img src=${media} alt="post media" onError=${imgFallback} onClick=${() => setZoom(true)} class="max-h-[62vh] w-full object-contain cursor-zoom-in" title="Click to enlarge" />`)
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
            ${(ghl?.accounts || []).length > 0 && html`<div>
              <div class="text-xs font-medium text-slate-500 mb-1">Post to <span class="font-normal text-slate-400">— which connected pages this post publishes to (saved when you Save/Approve)</span></div>
              <div class="flex flex-wrap gap-1.5">
                ${(ghl.accounts || []).map((a) => html`<button onClick=${() => toggleTarget(a.id)} title=${a.platform}
                  class=${cx('text-xs px-2.5 py-1 rounded-full border flex items-center gap-1', targetSel.has(a.id) ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-400 hover:border-brand-300')}>
                  <span>${PLAT_ICON[a.platform] || '🌐'}</span>${a.name}</button>`)}
              </div>
              ${targetSel.size === 0 && html`<div class="text-[11px] text-amber-700 mt-1">⚠ No pages selected — this post won't be pushed anywhere. Pick at least one.</div>`}
            </div>`}
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
      ${rwOpen && html`<div class="px-4 py-3 border-t border-sky-200 bg-sky-50/70">
        <div class="text-xs font-semibold text-slate-700 mb-1">✍️ Rewrite this post's text</div>
        <div class="text-xs text-slate-500 mb-2">The AI writes a fresh caption for the same topic in the month's brand voice (the image is untouched — a post that hasn't generated its image yet will use the updated design prompt). Tell it what to change, or leave blank for a fresh take.</div>
        <${Textarea} value=${rwFb} onInput=${(v) => setRwFb(v)} rows=${3} placeholder="e.g. Less salesy, lead with the safety angle, and mention that we're family-owned." />
        <div class="flex items-center justify-end gap-2 mt-2">
          <${Btn} size="sm" variant="secondary" onClick=${() => { setRwOpen(false); setRwFb(''); }} disabled=${!!busy}>Cancel</${Btn}>
          <${Btn} size="sm" onClick=${() => doRewrite(rwFb)} disabled=${!!busy}>${busy === 'rw' ? 'Rewriting…' : rwFb.trim().length >= 5 ? '✍️ Rewrite with feedback' : '✍️ Rewrite'}</${Btn}>
        </div>
      </div>`}
      ${rejOpen && html`<div class="px-4 py-3 border-t border-rose-200 bg-rose-50/70">
        <div class="text-xs font-semibold text-slate-700 mb-1">✕ Reject & regenerate</div>
        <div class="text-xs text-slate-500 mb-2">Rejected posts aren't discarded — a replacement is generated automatically. Tell the AI what was wrong so the new ${post.format === 'video' ? 'video' : 'image'} fixes it, or leave it blank to redo the same design.</div>
        <${Textarea} value=${rejFb} onInput=${(v) => setRejFb(v)} rows=${3} placeholder="e.g. The house style doesn't match our area, and the headline is too salesy for this topic." />
        <div class="flex items-center justify-end gap-2 mt-2">
          <${Btn} size="sm" variant="secondary" onClick=${() => { setRejOpen(false); setRejFb(''); }} disabled=${!!busy}>Cancel</${Btn}>
          <${Btn} size="sm" variant="danger" onClick=${() => doReject(rejFb)} disabled=${!!busy}>${busy === 'no' ? 'Starting…' : rejFb.trim().length >= 5 ? '✕ Reject & regenerate with feedback' : '✕ Reject & regenerate'}</${Btn}>
        </div>
      </div>`}
      ${regenOpen && html`<div class="px-4 py-3 border-t border-amber-200 bg-amber-50/70">
        <div class="text-xs font-semibold text-slate-700 mb-1">↻ Regenerate with feedback</div>
        <div class="text-xs text-slate-500 mb-2">Please provide feedback about this regeneration — tell the AI what to change about the image. It rewrites the ${post.format === 'video' ? 'video' : 'image'} prompt from your notes, then regenerates. Leave it blank to regenerate as-is.</div>
        <${Textarea} value=${regenFb} onInput=${(v) => setRegenFb(v)} rows=${3} placeholder="e.g. Make the driveway look wetter and boost the contrast between the clean and dirty halves. Change the headline to focus on curb appeal." />
        <div class="flex items-center justify-end gap-2 mt-2">
          <${Btn} size="sm" variant="secondary" onClick=${() => { setRegenOpen(false); setRegenFb(''); }} disabled=${!!busy}>Cancel</${Btn}>
          <${Btn} size="sm" variant="secondary" onClick=${() => doRegen('')} disabled=${!!busy}>${busy === 'regen' ? 'Starting…' : 'Regenerate as-is'}</${Btn}>
          <${Btn} size="sm" onClick=${() => doRegen(regenFb)} disabled=${!!busy || regenFb.trim().length < 5}>${busy === 'regen' ? 'Starting…' : '↻ Regenerate with feedback'}</${Btn}>
        </div>
      </div>`}
      <div class="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          ${pushed && html`<${Btn} size="sm" variant="secondary" onClick=${doUnschedule} disabled=${!!busy}>${busy === 'unsch' ? 'Removing…' : '↩ Unschedule to edit'}</${Btn}>`}
          ${!pushed && post.status !== 'rejected' && html`<${Btn} size="sm" variant="danger" onClick=${() => setRejOpen(true)} disabled=${!!busy || rejOpen}>${busy === 'no' ? '…' : '✕ Reject'}</${Btn}>`}
          ${canRegen && html`<${Btn} size="sm" variant="secondary" onClick=${() => (media ? setRegenOpen(true) : doRegen(''))} disabled=${!!busy || regenOpen}>${busy === 'regen' ? 'Starting…' : media ? '↻ Regenerate' : '🎨 Generate media'}</${Btn}>`}
          ${!pushed && post.status !== 'planned' && html`<${Btn} size="sm" variant="secondary" onClick=${() => setRwOpen(true)} disabled=${!!busy || rwOpen}>${busy === 'rw' ? 'Rewriting…' : '✍️ Rewrite text'}</${Btn}>`}
          ${pushed && !err && html`<span class="text-xs text-slate-400 truncate">Scheduled in GoHighLevel — unschedule it to edit or regenerate, then approve and push again.</span>`}
          ${err && html`<span class="text-xs text-rose-600">${err}</span>`}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-300 hidden md:block">← → to browse</span>
          ${!pushed && html`<${Btn} size="sm" onClick=${doSave} disabled=${!!busy}>${busy === 'save' ? 'Saving…' : '💾 Save'}</${Btn}>`}
          ${pushed
            ? html`<${Btn} size="sm" variant="success" disabled=${true}>🚀 Scheduled</${Btn}>`
            : post.status === 'approved'
              ? html`<${Btn} size="sm" variant="success" disabled=${true}>✓ Approved</${Btn}>`
              : html`<${Btn} variant="success" onClick=${doApprove} disabled=${!!busy || !media}>${busy === 'ok' ? '…' : '✓ Approve & next'}</${Btn}>`}
        </div>
      </div>
    </div>
    ${zoom && media && html`<div class="fixed inset-0 z-[70] bg-slate-950/90 flex items-center justify-center p-4 cursor-zoom-out" onClick=${() => setZoom(false)}>
      ${post.format === 'video'
        ? html`<video src=${media} controls autoplay class="max-h-[94vh] max-w-[96vw] object-contain" onClick=${(e) => e.stopPropagation()}></video>`
        : html`<img src=${media} alt="post media full size" class="max-h-[94vh] max-w-[96vw] object-contain" />`}
      <button onClick=${() => setZoom(false)} title="Close (Esc)" class="absolute top-3 right-4 text-white/80 hover:text-white text-4xl leading-none">×</button>
    </div>`}
  </div>`;
}

// ---- Approved-post downloads (media + caption as deliverable files) ----
const postSlug = (p) => String(p.hook || p.topic || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
const mediaExt = (u) => { const m = String(u).split('?')[0].match(/\.(\w{2,4})$/); return m ? m[1].toLowerCase() : 'jpg'; };
const postCaptionText = (p) => [`${p.post_date} ${p.post_time || ''} · ${p.pillar || ''}${p.target_city ? ` · ${p.target_city}` : ''}`.trim(), '', p.caption || '', '', (p.hashtags || []).join(' ')].join('\n').trim();
const saveBlob = (blob, filename) => { const o = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = o; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(o), 10000); };
async function downloadPost(p) {
  const urls = p.media_urls || [];
  for (let i = 0; i < urls.length; i++) {
    try { const r = await fetch(urls[i]); saveBlob(await r.blob(), `${p.post_date}-${postSlug(p)}${urls.length > 1 ? `-${i + 1}` : ''}.${mediaExt(urls[i])}`); }
    catch (_) { window.open(urls[i], '_blank'); }
  }
  saveBlob(new Blob([postCaptionText(p)], { type: 'text/plain' }), `${p.post_date}-${postSlug(p)}.txt`);
}

// Client approval tracker — where the month stands with the client: what was
// sent and when, how many posts they approved, which posts they asked to
// change (with their feedback verbatim and each revision's current state),
// and whether every approved post has been dispatched to GHL for scheduling.
// Data is all client-side already (posts + the seo-approval status row).
function ApprovalTracker({ posts, appr, month, siteName }) {
  const [showFb, setShowFb] = useState(true);
  const [zip, setZip] = useState('');
  const approved = posts.filter((p) => p.status === 'approved');
  const pushed = approved.filter((p) => p.ghl_post_id);
  const ready = posts.filter((p) => p.status === 'ready');
  const generating = posts.filter((p) => ['planned', 'written', 'media_pending'].includes(p.status));
  const rejected = posts.filter((p) => p.status === 'rejected');
  const fb = posts.filter((p) => (p.client_feedback || '').trim());
  const revising = fb.filter((p) => p.status === 'media_pending');
  const reReady = fb.filter((p) => p.status === 'ready');
  if (!posts.length) return '';
  const a = appr?.approval;
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
  const fbState = (p) => (p.ghl_post_id ? ['🚀 scheduled', 'bg-emerald-600 text-white'] : p.status === 'approved' ? ['re-approved', 'bg-emerald-100 text-emerald-700'] : p.status === 'ready' ? ['revised — awaiting approval', 'bg-sky-100 text-sky-700'] : p.status === 'media_pending' ? ['being revised', 'bg-amber-100 text-amber-700'] : [p.status.replace('_', ' '), 'bg-slate-100 text-slate-600']);

  const [tone, headline] = (() => {
    if (!appr) return ['bg-slate-50 text-slate-500', '⏳ Checking approval status…'];
    if (!appr.emailConfigured) return ['bg-slate-50 text-slate-600', '✋ Internal approval only — no client approval email is set. Add one on the Posting plan card (📧 Client approval) to route this month through the client.'];
    if (a?.status === 'approved') return ['bg-emerald-50 text-emerald-800', `✅ Client approved this month on ${fmtD(a.approvedAt)}${a.round > 1 ? ` after ${a.round} rounds` : ''}.`];
    if (a?.status === 'changes') return ['bg-amber-50 text-amber-800', `✏️ Round ${a.round || 1}: the client requested changes on ${fb.length} post${fb.length === 1 ? '' : 's'}${revising.length ? ` — ${revising.length} regenerating now` : ''}${reReady.length ? ` — ${reReady.length} revised and awaiting their re-approval` : ''}. They get a fresh approval link automatically once every revision is finished.`];
    if (a?.status === 'pending') return ['bg-sky-50 text-sky-800', `📤 Round ${a.round || 1} sent to ${appr.email} on ${fmtD(a.emailSentAt)} — awaiting the client's review.`];
    return ['bg-slate-50 text-slate-600', `✉️ Not sent to the client yet${appr.email ? ` (will go to ${appr.email})` : ''} — the approval email goes out once every post has finished generating.`];
  })();

  const dispatchLine = approved.length === 0
    ? null
    : pushed.length === approved.length
      ? `🚀 All ${approved.length} approved post${approved.length === 1 ? ' is' : 's are'} scheduled in GoHighLevel ✓`
      : `🚀 ${pushed.length} of ${approved.length} approved posts scheduled in GoHighLevel — ${approved.length - pushed.length} still to push.`;

  const downloadAll = async () => {
    if (!approved.length || zip) return;
    setZip('Preparing…');
    try {
      const { zipSync, strToU8 } = await import('https://esm.sh/fflate@0.8.2');
      const files = {};
      const captions = [];
      let done = 0;
      for (const p of approved) {
        const slug = `${p.post_date}-${postSlug(p)}`;
        const urls = p.media_urls || [];
        for (let i = 0; i < urls.length; i++) {
          try { const r = await fetch(urls[i]); files[`${slug}${i ? `-${i + 1}` : ''}.${mediaExt(urls[i])}`] = new Uint8Array(await r.arrayBuffer()); } catch (_) { /* unreachable media — still export its caption */ }
        }
        captions.push(`=== ${slug}${p.ghl_post_id ? ' (scheduled in GHL)' : ''}\n${postCaptionText(p)}\n`);
        done++; setZip(`Packing ${done}/${approved.length}…`);
      }
      files['captions.txt'] = strToU8(captions.join('\n'));
      // Media files are already compressed formats — store, don't recompress.
      const zipped = zipSync(files, { level: 0 });
      saveBlob(new Blob([zipped], { type: 'application/zip' }), `${String(siteName || 'social').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${month}-approved-posts.zip`);
    } catch (e) { alert(`Download failed: ${e.message}`); }
    finally { setZip(''); }
  };

  return html`<${Card}><div class="p-4">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="font-semibold text-slate-800">📋 Client approval & dispatch</div>
      ${approved.length > 0 && html`<${Btn} size="sm" variant="secondary" onClick=${downloadAll} disabled=${!!zip}>${zip || `⬇ Download approved (${approved.length})`}</${Btn}>`}
    </div>
    <div class=${cx('rounded-lg px-3 py-2 text-sm', tone)}>${headline}</div>
    <div class="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
      <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">${approved.length}/${posts.length} approved</span>
      ${ready.length > 0 && html`<span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">${ready.length} awaiting review</span>`}
      ${revising.length > 0 && html`<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">${revising.length} in revision</span>`}
      ${generating.length - revising.length > 0 && html`<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${generating.length - revising.length} generating</span>`}
      ${rejected.length > 0 && html`<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">${rejected.length} rejected</span>`}
      ${pushed.length > 0 && html`<span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white">🚀 ${pushed.length} scheduled</span>`}
    </div>
    ${dispatchLine && html`<div class=${cx('text-xs mt-2', pushed.length === approved.length ? 'text-emerald-600' : 'text-slate-500')}>${dispatchLine}</div>`}
    ${fb.length > 0 && html`<div class="mt-3 pt-3 border-t border-slate-100">
      <button onClick=${() => setShowFb(!showFb)} class="text-xs font-medium text-slate-600 hover:text-brand-700">💬 Client feedback (${fb.length}) ${showFb ? '▾' : '▸'}</button>
      ${showFb && html`<div class="mt-2 space-y-2">
        ${fb.map((p) => { const [lbl, cls] = fbState(p); return html`<div class="rounded-lg border border-slate-100 px-3 py-2" key=${p.id}>
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>${new Date(p.post_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span class="text-slate-600 truncate max-w-[45%]">${p.hook || p.topic || p.pillar}</span>
            <span class=${cx('px-1.5 py-0.5 rounded-full font-medium', cls)}>${lbl}</span>
          </div>
          <div class="text-xs text-slate-600 italic mt-1">“${p.client_feedback}”</div>
        </div>`; })}
      </div>`}
    </div>`}
  </div></${Card}>`;
}

export function Social() {
  useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [month, setMonth] = useState(nextMonth());
  const [skipHols, setSkipHols] = useState(new Set()); // deselected holiday names (per month)
  useEffect(() => { setSkipHols(new Set()); }, [month]);
  const monthHols = holidaysForMonth(month);
  const pickedHols = monthHols.filter((h) => !skipHols.has(h.name));
  const [cal, setCal] = useState(null);   // calendar row or null
  const [posts, setPosts] = useState([]);
  const [photos, setPhotos] = useState(null); // real-photo library (shared w/ ReviewModal)
  const [revId, setRevId] = useState(null);   // post open in review mode
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [appr, setAppr] = useState(null); // { emailConfigured, approval, ... } for the loaded calendar
  const [ghl, setGhl] = useState(null); // GHL connection { accounts, selected } for the per-post destination picker
  const [nbName, setNbName] = useState(''); // new-business name (no-GSC quick add)
  const [nbDomain, setNbDomain] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const addBusiness = async () => {
    setBusy('addbiz'); setErr('');
    try {
      const s = await seoAddManualSite(nbDomain, nbName);
      setNbName(''); setNbDomain('');
      const list = await seoLoadSites(); setSites(list);
      if (s?.id) setSite(s.id);
      setBanner('Business added. Set its services in the Brand kit below and its service area in the Strategy tab, then generate the month.');
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const load = async (s = site, m = month) => {
    if (!s) return;
    try {
      const r = await seoSocialCalendar(s, m); setCal(r.calendar); setPosts(r.posts || []);
      // Whether a client approval email is configured drives the review CTA
      // (send-to-client vs internal approve-all) and shows the sent state.
      if (r.calendar?.id) { try { setAppr(await seoApprovalStatus(s, r.calendar.id)); } catch { setAppr(null); } } else setAppr(null);
    }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { setCal(null); setPosts([]); setAppr(null); setErr(''); if (site) load(site, month); }, [site, month]);
  // Photo library feeds the per-post picker (managed in the Business tab).
  // Catalog includes AI descriptions/tags so the picker can sort by relevance.
  useEffect(() => { setPhotos(null); if (site) seoPhotoCatalog(site).then((r) => setPhotos(r.photos || [])).catch(() => setPhotos([])); }, [site]);
  // GHL connection feeds the review modal's per-post "Post to" destination picker.
  useEffect(() => { setGhl(null); if (site) seoSocialGhlStatus(site).then((r) => setGhl(r.connected ? r.ghl : null)).catch(() => setGhl(null)); }, [site]);

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
      const r = await seoSocialPlanMonth(site, month, pickedHols);
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

  // Bulk do-over for finished artwork: after a brand-kit fix (logo, colors,
  // badges) every image post regenerates with the CURRENT kit — no need to
  // re-plan the month or touch captions. Videos and GHL-scheduled posts are
  // deliberately left alone (cost and client-facing schedule respectively).
  const regenAllImages = async () => {
    const eligible = posts.filter((p) => p.format !== 'video' && ['ready', 'approved', 'rejected', 'written'].includes(p.status));
    if (!eligible.length) { setErr('No image posts are in a regenerable state.'); return; }
    const scheduled = posts.filter((p) => p.format !== 'video' && p.status === 'scheduled').length;
    if (!confirm(`Regenerate the artwork for ${eligible.length} image post(s) using the current brand kit? Captions and the plan stay as they are — only the images are redone (a few cents each).${scheduled ? ` ${scheduled} post(s) already scheduled in GoHighLevel are left untouched.` : ''}`)) return;
    setBusy('media'); setErr(''); setProg(`🔁 Regenerating ${eligible.length} images with the current brand kit…`);
    try {
      let started = 1;
      while (started > 0) {
        const r = await seoSocialMediaBatch(site, cal.id, 4, true);
        started = r.started;
        if (r.errors?.length) setErr(r.errors.join(' · '));
        if (started) setProg(`🔁 Started ${started} more regenerations — they finish in the background…`);
        if (started) await new Promise((res) => setTimeout(res, 12000));
      }
      setProg(''); setBanner('🔁 All image regenerations started — new artwork appears as it finishes (auto-refreshing).');
      await load();
    } catch (e) { setErr(e.message); setProg(''); } finally { setBusy(''); }
  };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading social manager…</div>`;
  if (sites.length === 0) return html`<div class="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
    <div>
      <h1 class="text-xl font-bold text-slate-800">Social Media</h1>
      <p class="text-sm text-slate-500">Add a business to get started. Search Console is optional — social posts are built from the business's services and service area.</p>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-800">${banner}</div>`}
    <${Card}><div class="p-5 space-y-2">
      <div class="font-semibold text-slate-800">Add a business</div>
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex-1 min-w-[160px]"><label class="text-[11px] text-slate-400 block mb-1">Business name</label><${Input} value=${nbName} onInput=${setNbName} placeholder="Acme Roofing" /></div>
        <div class="flex-1 min-w-[160px]"><label class="text-[11px] text-slate-400 block mb-1">Website</label><${Input} value=${nbDomain} onInput=${setNbDomain} placeholder="acmeroofing.com" /></div>
        <${Btn} variant="cta" onClick=${addBusiness} disabled=${busy === 'addbiz' || !nbDomain.trim()}>${busy === 'addbiz' ? 'Adding…' : '+ Add business'}</${Btn}>
      </div>
      <p class="text-[11px] text-slate-400">After adding, set services in the Brand kit and the service area in the Strategy tab. Connect Search Console later (SEO tab) for ranking data.</p>
    </div></${Card}>
  </div>`;

  const counts = posts.reduce((m, p) => { m[p.status] = (m[p.status] || 0) + 1; return m; }, {});
  const activeFilter = POST_FILTERS.find(([k]) => k === filter) || POST_FILTERS[0];
  const shown = filter === 'all' ? posts : posts.filter(activeFilter[2]);
  const readyCount = counts.ready || 0;
  const toPush = posts.filter((p) => p.status === 'approved' && !p.ghl_post_id).length;
  const pushedCount = posts.filter((p) => p.ghl_post_id).length;

  // Email the client the approval link on demand (seo-approval send_now),
  // instead of waiting for the cron tick. Reuses the pending token as a resend.
  const sendToClient = async () => {
    setBusy('send'); setErr('');
    try {
      const r = await seoApprovalSendNow(site, cal.id);
      if (r.alreadyApproved) setBanner('This month has already been approved by the client.');
      else if (r.emailed) setBanner(`📤 ${r.resent ? 'Resent' : 'Sent'} the approval link to ${r.to}${r.cc ? ` (cc ${r.cc})` : ''} — ${r.readyCount} post${r.readyCount === 1 ? '' : 's'} awaiting the client's approval.`);
      else setBanner('The approval email could not be sent right now (it may have been sent very recently). The client can also be reached on the next automatic send.');
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const approveAllInternal = async () => {
    setBusy('approveall'); setErr('');
    try { await seoSocialApproveAll(site, cal.id); setBanner(`✓ ${readyCount} posts approved.`); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

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

    <div class="text-xs text-slate-400">Brand kit, photo sources, and integrations live in the <span class="font-medium">🏢 Business</span> tab.</div>

    <${PlanCard} site=${site} onBanner=${setBanner} key=${site} />

    ${cal && html`<${ApprovalTracker} posts=${posts} appr=${appr} month=${month} siteName=${sites.find((x) => x.id === site)?.display_name || sites.find((x) => x.id === site)?.domain || ''} />`}

    <${Card}><div class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div class="font-semibold text-slate-800">📅 ${new Date(month + '-15T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          ${cal && html`<span class="text-xs font-normal text-slate-400"> — ${posts.length} posts · ${counts.approved || 0} approved · ${readyCount} ready · ${(counts.written || 0) + (counts.planned || 0)} drafted · ${counts.media_pending || 0} generating</span>`}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${cal && posts.some((p) => p.status === 'written') && html`<${Btn} size="sm" variant="cta" onClick=${genMedia} disabled=${!!busy}>${busy === 'media' ? 'Generating…' : '🎨 Generate all media'}</${Btn}>`}
          ${cal && !posts.some((p) => p.status === 'written') && posts.some((p) => p.format !== 'video' && ['ready', 'approved', 'rejected'].includes(p.status)) && html`<${Btn} size="sm" variant="secondary" onClick=${regenAllImages} disabled=${!!busy} title="Redo every image with the current brand kit — captions and plan stay">${busy === 'media' ? 'Regenerating…' : '🔁 Regenerate all images'}</${Btn}>`}
          ${cal && readyCount > 0 && html`<${Btn} size="sm" variant="cta" onClick=${() => setRevId((posts.find((p) => p.status === 'ready') || posts[0]).id)} disabled=${!!busy}>👀 Review ${readyCount}</${Btn}>`}
          ${cal && readyCount > 0 && (() => {
            // No client approval email set → the agency approves internally.
            if (!appr?.emailConfigured) return html`<${Btn} size="sm" variant="success" onClick=${approveAllInternal} disabled=${!!busy}>${busy === 'approveall' ? 'Approving…' : '✓ Approve all'}</${Btn}>`;
            const st = appr.approval?.status;
            if (st === 'pending') return html`<span class="inline-flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">📤 Sent to client — awaiting approval <button onClick=${sendToClient} disabled=${!!busy} class="underline decoration-dotted hover:text-emerald-900">${busy === 'send' ? 'Resending…' : 'Resend'}</button></span>`;
            if (st === 'changes') return html`<span class="inline-flex items-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">↻ Revisions generating — the client gets a fresh link automatically</span>`;
            return html`<${Btn} size="sm" variant="success" onClick=${sendToClient} disabled=${!!busy}>${busy === 'send' ? 'Sending…' : '📤 Send all to client for approval'}</${Btn}>`;
          })()}
          ${cal && toPush > 0 && html`<${Btn} size="sm" variant="cta" onClick=${pushGhl} disabled=${!!busy}>${busy === 'push' ? 'Pushing…' : `🚀 Push ${toPush} to GHL`}</${Btn}>`}
          ${cal && pushedCount > 0 && toPush === 0 && html`<span class="text-xs text-emerald-600">🚀 ${pushedCount} scheduled in GHL</span>`}
          <${Btn} size="sm" onClick=${planMonth} disabled=${!!busy}>${busy === 'plan' ? 'Planning…' : cal ? '↻ Re-plan month' : '🧠 Plan this month'}</${Btn}>
        </div>
      </div>
      ${monthHols.length > 0 && html`<div class="mb-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
        <div class="text-xs font-medium text-slate-600">🎉 Holidays this month <span class="font-normal text-slate-400">— posts will celebrate the selected ones (tap to skip any)</span></div>
        <div class="flex flex-wrap gap-1.5 mt-1.5">
          ${monthHols.map((h) => {
            const on = !skipHols.has(h.name);
            return html`<button key=${h.name} onClick=${() => setSkipHols((s) => { const n = new Set(s); if (n.has(h.name)) n.delete(h.name); else n.add(h.name); return n; })}
              title=${`${new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${h.solemn ? ' · observed respectfully, never promotional' : ''}`}
              class=${cx('text-xs px-2.5 py-1 rounded-full border transition-colors', on ? (h.solemn ? 'bg-slate-600 text-white border-slate-600' : h.kind === 'fun' ? 'bg-violet-500 text-white border-violet-500' : 'bg-brand-500 text-white border-brand-500') : 'bg-white text-slate-400 border-slate-200 line-through')}>
              ${on ? '✓ ' : ''}${h.name} <span class=${on ? 'opacity-70' : ''}>${Number(h.date.slice(8, 10))}${h.solemn ? ' 🕊' : ''}</span>
            </button>`;
          })}
        </div>
        ${pickedHols.length === 0 && html`<div class="text-[11px] text-slate-400 mt-1">All skipped — this month will be planned with no holiday posts.</div>`}
      </div>`}
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
            return html`<div class="relative" key=${p.id}>
              <button onClick=${() => setRevId(p.id)} title=${p.topic || ''}
              class=${cx('group w-full text-left rounded-xl overflow-hidden border bg-white hover:shadow-md transition-shadow', p.status === 'rejected' ? 'opacity-50 border-slate-100' : 'border-slate-200 hover:border-brand-400')}>
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
              </button>
              ${p.status === 'approved' && (p.media_urls || []).length > 0 && html`<button onClick=${() => downloadPost(p)} title="Download this post (media + caption)"
                class="absolute right-1.5 bottom-11 h-7 w-7 rounded-full bg-white/95 border border-slate-200 text-slate-600 hover:text-brand-700 hover:border-brand-300 text-sm shadow-sm flex items-center justify-center">⬇</button>`}
            </div>`;
          })}
          ${shown.length === 0 && html`<div class="col-span-full text-sm text-slate-400 py-8 text-center">Nothing in this filter.</div>`}
        </div>`}
    </div></${Card}>

    ${revId && html`<${ReviewModal} site=${site} posts=${posts} revId=${revId} setRevId=${setRevId} library=${photos || []} ghl=${ghl} onClose=${() => setRevId(null)} onChanged=${load} />`}
  </div>`;
}
