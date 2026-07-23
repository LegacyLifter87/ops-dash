// ---------------------------------------------------------------------------
// social.js — Social Media Manager: curate a month of posts per business.
// Brand kit (phone/website/logo/colors) → AI 30-day calendar (pillars, times,
// cities, services from the Strategy tab) → written captions + hooks → brand-
// injected images (nano-banana) and Reels (Kling) → review/approve.
// Scheduling/publishing happens in GoHighLevel — this tab curates.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoSocialProfile, seoSocialProfileSave, seoSocialLogoUpload, seoSocialPlanMonth, seoSocialWriteBatch, seoSocialMediaBatch, seoSocialRegenMedia, seoSocialRefresh, seoSocialCalendar, seoSocialUpdatePost, seoSocialApprove, seoSocialReject, seoSocialApproveAll } from './store.js';
import { Card, Btn, Input, Textarea, Select, Modal, Field } from './ui.js';

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
const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

function BrandKit({ site, onBanner }) {
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
        const r = await seoSocialLogoUpload(site, b64, file.type);
        setLogoUrl(r.logoUrl); onBanner('🖼 Logo uploaded — it will be placed on every generated image.');
      } catch (e) { setErr(e.message); } finally { setBusy(''); }
    };
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
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange=${(e) => upload(e.target.files?.[0])} class="text-xs" />
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

function PostModal({ site, post, onClose, onChanged }) {
  const [f, setF] = useState({ caption: post.caption || '', overlay: post.overlay_text || '', tags: (post.hashtags || []).join(' '), prompt: post.format === 'video' ? (post.video_prompt || '') : (post.image_prompt || '') });
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const media = (post.media_urls || [])[0];
  const doSave = async () => {
    setBusy('save'); setErr('');
    try {
      await seoSocialUpdatePost(site, post.id, {
        caption: f.caption, overlayText: f.overlay,
        hashtags: f.tags.split(/[\s,]+/).filter(Boolean),
        ...(post.format === 'video' ? { videoPrompt: f.prompt } : { imagePrompt: f.prompt }),
      });
      await onChanged(); onClose();
    } catch (e) { setErr(e.message); setBusy(''); }
  };
  const doAct = async (fn, name) => { setBusy(name); setErr(''); try { await fn(); await onChanged(); onClose(); } catch (e) { setErr(e.message); setBusy(''); } };
  return html`<${Modal} wide title=${`${post.post_date} · ${post.post_time} · ${post.pillar}${post.format === 'video' ? ' · 🎬 Reel' : ''}`} onClose=${onClose}>
    <div class="space-y-3">
      ${post.topic && html`<div class="text-xs text-slate-500">Brief: ${post.topic}${post.target_city ? ` · 📍 ${post.target_city}` : ''}${post.target_service ? ` · 🛠 ${post.target_service}` : ''}</div>`}
      ${post.reject_reason && html`<div class="text-xs text-rose-600 bg-rose-50 rounded px-2 py-1">${post.reject_reason}</div>`}
      ${media && (post.format === 'video'
        ? html`<video src=${media} controls class="max-h-72 rounded-lg mx-auto"></video>`
        : html`<img src=${media} alt="post media" class="max-h-72 rounded-lg mx-auto" />`)}
      <${Field} label="Caption"><${Textarea} value=${f.caption} onInput=${(v) => setF({ ...f, caption: v })} rows=${6} /></${Field}>
      <div class="grid sm:grid-cols-2 gap-3">
        ${post.format === 'image' && html`<${Field} label="On-image text (≤7 words)"><${Input} value=${f.overlay} onInput=${(v) => setF({ ...f, overlay: v })} /></${Field}>`}
        <${Field} label="Hashtags"><${Input} value=${f.tags} onInput=${(v) => setF({ ...f, tags: v })} placeholder="#roofrepairocala #ocalaroofer" /></${Field}>
      </div>
      <details><summary class="text-xs text-slate-400 cursor-pointer">${post.format === 'video' ? 'Video' : 'Image'} generation prompt</summary>
        <div class="mt-2"><${Textarea} value=${f.prompt} onInput=${(v) => setF({ ...f, prompt: v })} rows=${4} /></div>
      </details>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <div class="flex flex-wrap gap-2">
        <${Btn} size="sm" onClick=${doSave} disabled=${!!busy}>${busy === 'save' ? 'Saving…' : 'Save edits'}</${Btn}>
        ${(post.status === 'written' || post.status === 'ready' || post.status === 'rejected') && html`<${Btn} size="sm" variant="secondary" onClick=${() => doAct(() => seoSocialRegenMedia(site, post.id), 'regen')} disabled=${!!busy}>${busy === 'regen' ? 'Starting…' : media ? '↻ Regenerate media' : '🎨 Generate media'}</${Btn}>`}
        ${post.status === 'ready' && html`<${Btn} size="sm" variant="success" onClick=${() => doAct(() => seoSocialApprove(site, post.id), 'ok')} disabled=${!!busy}>✓ Approve</${Btn}>`}
        ${post.status !== 'rejected' && html`<${Btn} size="sm" variant="danger" onClick=${() => doAct(() => seoSocialReject(site, post.id, 'rejected in review'), 'no')} disabled=${!!busy}>✕ Reject</${Btn}>`}
      </div>
    </div>
  </${Modal}>`;
}

export function Social() {
  useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [month, setMonth] = useState(nextMonth());
  const [cal, setCal] = useState(null);   // calendar row or null
  const [posts, setPosts] = useState([]);
  const [sel, setSel] = useState(null);
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

  const byDate = {};
  posts.forEach((p) => { (byDate[p.post_date] = byDate[p.post_date] || []).push(p); });
  const counts = posts.reduce((m, p) => { m[p.status] = (m[p.status] || 0) + 1; return m; }, {});
  const readyCount = counts.ready || 0;

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

    <${BrandKit} site=${site} onBanner=${setBanner} />

    <${Card}><div class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div class="font-semibold text-slate-800">📅 ${new Date(month + '-15T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          ${cal && html`<span class="text-xs font-normal text-slate-400"> — ${posts.length} posts · ${counts.approved || 0} approved · ${readyCount} ready · ${(counts.written || 0) + (counts.planned || 0)} drafted · ${counts.media_pending || 0} generating</span>`}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${cal && posts.some((p) => p.status === 'written') && html`<${Btn} size="sm" variant="cta" onClick=${genMedia} disabled=${!!busy}>${busy === 'media' ? 'Generating…' : '🎨 Generate all media'}</${Btn}>`}
          ${cal && readyCount > 0 && html`<${Btn} size="sm" variant="success" onClick=${async () => { await seoSocialApproveAll(site, cal.id); setBanner(`✓ ${readyCount} posts approved.`); await load(); }} disabled=${!!busy}>✓ Approve all ready</${Btn}>`}
          <${Btn} size="sm" onClick=${planMonth} disabled=${!!busy}>${busy === 'plan' ? 'Planning…' : cal ? '↻ Re-plan month' : '🧠 Plan this month'}</${Btn}>
        </div>
      </div>
      ${!cal ? html`<div class="text-sm text-slate-400 py-8 text-center">No calendar for this month yet — set up the brand kit above, then click <span class="font-medium">Plan this month</span>.</div>` : html`
        ${cal.strategy?.idealClient && html`<div class="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3"><span class="font-medium">Ideal client:</span> ${cal.strategy.idealClient}${cal.strategy.themes?.length ? html`<span class="font-medium"> · Themes:</span> ${cal.strategy.themes.join(' · ')}` : ''}</div>`}
        <div class="space-y-1.5">
          ${Object.keys(byDate).sort().map((d) => html`<div class="flex items-start gap-2 flex-wrap">
            <div class="w-20 shrink-0 text-xs text-slate-400 pt-1.5">${new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</div>
            <div class="flex-1 flex flex-wrap gap-1.5">
              ${byDate[d].map((p) => { const [ic, tone] = PILLAR[p.pillar] || ['📄', 'bg-slate-100 text-slate-600']; return html`
                <button onClick=${() => setSel(p)} title=${p.topic || ''}
                  class=${cx('text-left text-xs px-2 py-1.5 rounded-lg border border-slate-100 hover:border-brand-300 flex items-center gap-1.5 max-w-full', p.status === 'rejected' && 'opacity-50')}>
                  <span>${ic}</span>
                  <span class="text-slate-400">${p.post_time}</span>
                  ${p.format === 'video' && html`<span>🎬</span>`}
                  <span class="truncate max-w-[180px] text-slate-700">${p.hook || p.topic || p.pillar}</span>
                  <span class=${cx('px-1.5 py-0.5 rounded-full text-[10px]', STATUS[p.status] || '')}>${p.status.replace('_', ' ')}</span>
                </button>`; })}
            </div>
          </div>`)}
        </div>`}
    </div></${Card}>

    ${sel && html`<${PostModal} site=${site} post=${sel} onClose=${() => setSel(null)} onChanged=${load} />`}
  </div>`;
}
