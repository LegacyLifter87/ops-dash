// ---------------------------------------------------------------------------
// approve.js — public client-approval page (no login; token-gated).
// Opened from the brand-styled approval email: /approve.html?t=TOKEN.
// Shows a simplified view of the month's generated posts. The client either
// approves everything (posts are scheduled automatically) or taps posts to
// request replacements — feedback is REQUIRED per flagged post and one submit
// sends all of it; the images regenerate and a fresh email follows.
// Vanilla JS on purpose: this page must work standalone for non-users.
// ---------------------------------------------------------------------------
const FN = 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-approval';
const token = new URLSearchParams(location.search).get('t') || '';
const app = document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

let data = null;                // last 'view' payload
let sel = new Map();            // postId -> feedback text
let refs = new Map();           // postId -> uploaded replacement-photo URL
let uploading = new Set();      // postIds with an upload in flight
let busy = false;

// Full-screen image viewer — tap any post image to inspect it at full size.
// Inline styles on purpose: the prebuilt (purged) Tailwind css may not contain
// utilities that aren't used elsewhere in the app.
function openZoom(src) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(2,6,23,.93);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';
  ov.innerHTML = `<img src="${esc(src)}" alt="post graphic" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.5)" />
    <div style="position:absolute;top:14px;right:18px;color:#fff;font:600 15px system-ui;opacity:.8">✕ close</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
}

// Downscale a picked photo in the browser (max 1600px, JPEG) so uploads stay
// fast on phone connections, then hand it to the fn as base64.
async function fileToJpegBase64(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('That image could not be read — please try a JPG or PNG photo.')); img.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.87);
    return dataUrl.split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

async function call(body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, token }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'Something went wrong — try again.');
  return j;
}

const header = (b, subtitle) => `
  <div class="rounded-2xl overflow-hidden border border-slate-200 bg-white mb-4">
    <div class="px-6 py-5 text-center" style="background:${esc(b.color1 || '#0f766e')}">
      ${b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="${esc(b.name)}" class="mx-auto max-h-14 object-contain" />` : `<div class="text-white text-xl font-bold">${esc(b.name)}</div>`}
    </div>
    <div class="px-6 py-4 text-center">
      <div class="font-bold text-slate-800 text-lg">${esc(b.name)} — ${esc(b.month || 'your posts')}</div>
      <div class="text-sm text-slate-500 mt-1">${subtitle}</div>
    </div>
  </div>`;

const centerCard = (b, emoji, title, text) => {
  app.innerHTML = `${b ? header(b, '') : ''}
    <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
      <div class="text-5xl mb-3">${emoji}</div>
      <div class="text-xl font-bold text-slate-800 mb-2">${title}</div>
      <div class="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">${text}</div>
    </div>`;
};

function dateLabel(d, t) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + (t ? ` · ${t}` : ''); } catch { return d; }
}

function renderPending() {
  const b = data.branding || {};
  const posts = data.posts || [];
  const cards = posts.map((p) => {
    const on = sel.has(p.id);
    const fb = sel.get(p.id) || '';
    return `
    <div class="rounded-2xl border ${on ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'} bg-white overflow-hidden flex flex-col" data-card="${p.id}">
      <div class="bg-slate-50 flex items-center justify-center" style="min-height:220px">
        ${p.media
          ? (p.format === 'video'
            ? `<video src="${esc(p.media)}" controls playsinline preload="metadata" class="w-full max-h-96 object-contain"></video>`
            : `<img src="${esc(p.media)}" alt="post graphic — tap to enlarge" loading="lazy" data-zoom="${esc(p.media)}" style="cursor:zoom-in" class="w-full max-h-96 object-contain" />`)
          : '<div class="text-slate-300 text-sm py-16">No preview</div>'}
      </div>
      ${p.format !== 'video' && p.media ? '<div class="text-center text-xs text-slate-400 -mt-1 pb-1">🔍 tap the image to enlarge</div>' : ''}
      <div class="p-3 flex-1 flex flex-col gap-2">
        <div class="text-xs font-medium text-slate-500">${esc(dateLabel(p.date, p.time))}${p.format === 'video' ? ' · 🎬 video' : ''}</div>
        <div class="text-sm text-slate-700 whitespace-pre-line max-h-28 overflow-y-auto">${esc(p.caption)}</div>
        <div class="mt-auto pt-1">
          <button data-toggle="${p.id}" class="w-full text-sm font-medium rounded-lg px-3 py-2 border ${on ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-700'}">
            ${on ? '✓ Marked for replacement — tap to undo' : '🔁 Request a replacement'}
          </button>
          ${on ? `
          <div class="mt-2">
            <label class="text-xs font-medium text-amber-700">What should be different? ${refs.has(p.id) ? '<span class="text-amber-500">(optional — your photo drives the redo)</span>' : '<span class="text-amber-500">(required — or upload a photo below)</span>'}</label>
            <textarea data-fb="${p.id}" rows="3" placeholder="e.g. Use a lighter background, show a house not an office, change the headline wording…"
              class="mt-1 w-full text-sm border border-amber-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">${esc(fb)}</textarea>
            ${refs.has(p.id)
              ? `<div class="mt-2 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-2">
                   <img src="${esc(refs.get(p.id))}" alt="your photo" style="width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:zoom-in" data-zoom="${esc(refs.get(p.id))}" />
                   <div class="text-xs text-emerald-800 flex-1">✓ Your photo is attached — the new post will be designed from it.</div>
                   <button data-refdel="${p.id}" class="text-xs text-slate-400 underline">remove</button>
                 </div>`
              : `<div class="mt-2">
                   <button data-upbtn="${p.id}" ${uploading.has(p.id) ? 'disabled' : ''} class="w-full text-sm rounded-lg px-3 py-2 border border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-700">
                     ${uploading.has(p.id) ? '⏳ Uploading your photo…' : '📷 Upload your own photo to use instead'}
                   </button>
                   <input type="file" accept="image/jpeg,image/png,image/webp,image/*" data-upinput="${p.id}" style="display:none" />
                 </div>`}
          </div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  const n = sel.size;
  const missing = [...sel.entries()].filter(([id, v]) => v.trim().length < 5 && !refs.has(id)).length;
  const footer = n === 0
    ? `<button data-approve class="w-full sm:w-auto text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-lg" style="background:${esc(b.color1 || '#0f766e')}">✓ Approve all ${posts.length} post${posts.length === 1 ? '' : 's'}</button>
       <div class="text-xs text-slate-400">Approving schedules everything automatically. Or tap any post above to request a replacement.</div>`
    : `<button data-submit ${missing ? 'disabled' : ''} class="w-full sm:w-auto font-semibold rounded-xl px-8 py-3.5 text-base shadow-lg ${missing ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-amber-500 text-white'}">📨 Send feedback & request ${n} replacement${n === 1 ? '' : 's'}</button>
       <div class="text-xs ${missing ? 'text-amber-700 font-medium' : 'text-slate-400'}">${missing ? `Add feedback to ${missing} flagged post${missing === 1 ? '' : 's'} — it tells us what to change.` : `The other ${posts.length - n} post${posts.length - n === 1 ? '' : 's'} will be approved and scheduled right away — your next email covers only the ${n} replacement${n === 1 ? '' : 's'}.`}</div>
       <button data-clear class="text-xs text-slate-400 underline">clear selections</button>`;

  app.innerHTML = `
    ${header(b, `${posts.length} post${posts.length === 1 ? '' : 's'} ready for your review${data.round > 1 ? ` · updated round ${data.round}` : ''}`)}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">${cards}</div>
    <div data-bar class="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3">
      <div class="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">${footer}</div>
    </div>`;
  // Keep the page's bottom clearance in sync with the bar's real height — it
  // grows when replacements are selected (extra hint text, stacked on mobile),
  // and a fixed padding class was being overridden by sm:p-6 on desktop,
  // leaving the last row of cards buried under the bar and unclickable.
  const bar = app.querySelector('[data-bar]');
  if (bar) app.style.paddingBottom = `${bar.offsetHeight + 24}px`;
}

async function load() {
  if (!token) { centerCard(null, '🔗', 'Invalid link', 'This page needs the private link from your approval email.'); return; }
  try {
    data = await call({ action: 'view' });
    if (data.state === 'approved') { centerCard(data.branding, '🎉', 'Posts approved', 'These posts were approved and scheduled. This link is no longer active — you\'ll get a fresh email next month.'); return; }
    if (data.state === 'changes') { centerCard(data.branding, '🎨', 'Replacements in progress', `We're regenerating ${data.regenerating || 'the'} post${data.regenerating === 1 ? '' : 's'} based on your feedback. You'll get a new email as soon as they're ready for final approval.`); return; }
    if (!(data.posts || []).length) { centerCard(data.branding, '⏳', 'Nothing to review yet', 'The posts for this month aren\'t ready — you\'ll receive an email when they are.'); return; }
    renderPending();
  } catch (e) {
    centerCard(null, '🔗', 'Link not active', esc(e.message));
  }
}

app.addEventListener('click', async (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) { openZoom(z.dataset.zoom); return; }
  const up = e.target.closest('[data-upbtn]');
  if (up && !busy && !uploading.has(up.dataset.upbtn)) {
    const inp = app.querySelector(`[data-upinput="${up.dataset.upbtn}"]`);
    if (inp) inp.click();
    return;
  }
  const rd = e.target.closest('[data-refdel]');
  if (rd && !busy) { refs.delete(rd.dataset.refdel); renderPending(); return; }
  const t = e.target.closest('[data-toggle],[data-approve],[data-submit],[data-clear]');
  if (!t || busy) return;
  if (t.dataset.toggle) {
    const id = t.dataset.toggle;
    if (sel.has(id)) { sel.delete(id); refs.delete(id); } else sel.set(id, sel.get(id) || '');
    renderPending();
    return;
  }
  if (t.dataset.clear !== undefined && t.hasAttribute('data-clear')) { sel = new Map(); refs = new Map(); renderPending(); return; }
  if (t.hasAttribute('data-approve')) {
    if (!confirm(`Approve all ${data.posts.length} posts? They will be scheduled automatically.`)) return;
    busy = true; t.textContent = 'Approving…';
    try {
      const r = await call({ action: 'submit', decision: 'approve' });
      centerCard(data.branding, '🎉', 'All posts approved!', `${r.approved} post${r.approved === 1 ? '' : 's'} approved${r.pushed ? ` and ${r.pushed} scheduled automatically` : ''}. Thank you — you can close this page.`);
    } catch (err) { busy = false; alert(err.message); renderPending(); }
    return;
  }
  if (t.hasAttribute('data-submit')) {
    const requests = [...sel.entries()].map(([postId, feedback]) => ({ postId, feedback: feedback.trim(), ...(refs.has(postId) ? { refUrl: refs.get(postId) } : {}) }));
    if (requests.some((r) => r.feedback.length < 5 && !r.refUrl)) return;
    busy = true; t.textContent = 'Sending…';
    try {
      const r = await call({ action: 'submit', decision: 'changes', requests });
      centerCard(data.branding, '🎨', 'Feedback received!', `${r.approvedNow ? `${r.approvedNow} post${r.approvedNow === 1 ? ' was' : 's were'} approved and scheduled. ` : ''}We're regenerating ${r.regenerating} post${r.regenerating === 1 ? '' : 's'} based on your notes — you'll get one more email to approve just those replacements. No need to keep this page open.`);
    } catch (err) { busy = false; alert(err.message); renderPending(); }
  }
});
app.addEventListener('change', async (e) => {
  const inp = e.target.closest('[data-upinput]');
  if (!inp || !inp.files?.[0]) return;
  const id = inp.dataset.upinput;
  const file = inp.files[0];
  uploading.add(id); renderPending();
  try {
    const image = await fileToJpegBase64(file);
    const r = await call({ action: 'upload_ref', postId: id, image, mime: 'image/jpeg' });
    refs.set(id, r.url);
  } catch (err) {
    alert(err.message || 'Upload failed — please try a different photo.');
  } finally {
    uploading.delete(id); renderPending();
  }
});

app.addEventListener('input', (e) => {
  const ta = e.target.closest('[data-fb]');
  if (!ta) return;
  sel.set(ta.dataset.fb, ta.value);
  // Refresh only the footer state without re-rendering (keeps focus).
  const missing = [...sel.entries()].filter(([id, v]) => v.trim().length < 5 && !refs.has(id)).length;
  const btn = app.querySelector('[data-submit]');
  if (btn) {
    btn.disabled = !!missing;
    btn.className = `w-full sm:w-auto font-semibold rounded-xl px-8 py-3.5 text-base shadow-lg ${missing ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-amber-500 text-white'}`;
  }
});

load();
