// ---------------------------------------------------------------------------
// blog-approve.js — public client blog-approval page (no login; token-gated).
// Opened from the branded approval email: /blog-approve.html?t=TOKEN.
// The client reads the article, can make light edits directly in the text
// (title + body are editable in place), then either:
//   ✓ Approve & publish  — edits are saved and the article goes LIVE on their
//     website immediately; they get the live link.
//   ✕ Request a different article — feedback is required; the autoblogger
//     writes a replacement on the next available topic and emails a fresh
//     review link (3 rejections in a row pause the autoblogger).
// Vanilla JS on purpose: must work standalone for non-users.
// ---------------------------------------------------------------------------
const FN = 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-autoblog';
const token = new URLSearchParams(location.search).get('t') || '';
const app = document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

let data = null;
let busy = false;

async function call(body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, token }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'Something went wrong — try again.');
  return j;
}

const header = (b, subtitle) => `
  <div class="rounded-2xl overflow-hidden border border-slate-200 bg-white mb-4">
    <div class="px-6 py-5 text-center" style="background:${esc(b.color || '#0f766e')}">
      ${b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="${esc(b.name)}" class="mx-auto max-h-14 object-contain" />` : `<div class="text-white text-xl font-bold">${esc(b.name)}</div>`}
    </div>
    ${subtitle ? `<div class="px-6 py-3 text-center text-sm text-slate-500">${subtitle}</div>` : ''}
  </div>`;

const centerCard = (b, emoji, title, text, extraHtml = '') => {
  app.innerHTML = `${b ? header(b, '') : ''}
    <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
      <div class="text-5xl mb-3">${emoji}</div>
      <div class="text-xl font-bold text-slate-800 mb-2">${title}</div>
      <div class="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">${text}</div>
      ${extraHtml}
    </div>`;
};

function renderPending() {
  const b = data.branding || {};
  const blog = data.blog || {};
  app.innerHTML = `
    ${header(b, 'Your new article — read it over, click into the text to fix anything, then approve or request a different one.')}
    <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div class="px-6 pt-6">
        <div class="text-[11px] uppercase tracking-wide text-slate-400 mb-1">✏️ You can edit the title and article text directly</div>
        <h1 data-title contenteditable="true" spellcheck="true" class="text-2xl font-bold text-slate-800 leading-snug focus:outline-none rounded-md px-1" style="box-shadow:inset 0 0 0 1px transparent" onfocus="this.style.boxShadow='inset 0 0 0 2px #f59e0b33'" onblur="this.style.boxShadow='inset 0 0 0 1px transparent'">${esc(blog.title)}</h1>
      </div>
      <div data-content contenteditable="true" spellcheck="true" class="px-6 py-4 text-[15px] leading-relaxed text-slate-700 focus:outline-none blog-body" style="max-width:none">${blog.content || '<p>(no content)</p>'}</div>
    </div>
    <div data-rej style="display:none" class="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div class="text-sm font-semibold text-amber-800 mb-1">What didn't work about this article?</div>
      <div class="text-xs text-amber-700 mb-2">Your feedback goes straight to the writer — the replacement is chosen and written around it. (required)</div>
      <textarea data-fb rows="3" class="w-full text-sm border border-amber-300 rounded-lg px-2.5 py-2 focus:outline-none" placeholder="e.g. Too technical for our customers — keep it simple, and don't mention pricing."></textarea>
      <div class="flex items-center justify-end gap-2 mt-2">
        <button data-rej-cancel class="text-sm text-slate-500 px-3 py-2">Cancel</button>
        <button data-rej-send class="text-sm font-semibold text-white bg-amber-500 rounded-lg px-4 py-2">Send & request a replacement</button>
      </div>
    </div>
    <div data-bar class="fixed bottom-0 inset-x-0 z-20 bg-white/95 border-t border-slate-200 px-4 py-3" style="backdrop-filter:blur(6px)">
      <div class="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
        <button data-approve class="w-full sm:w-auto text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-lg" style="background:${esc(b.color || '#0f766e')}">✓ Approve & publish to the website</button>
        <button data-reject class="w-full sm:w-auto font-medium rounded-xl px-6 py-3.5 text-base border border-slate-300 text-slate-600 bg-white">✕ Request a different article</button>
        <div class="text-xs text-slate-400 sm:ml-2">Approving publishes it live right away.</div>
      </div>
    </div>`;
  const bar = app.querySelector('[data-bar]');
  if (bar) app.style.paddingBottom = `${bar.offsetHeight + 24}px`;
}

function currentEdits() {
  const t = app.querySelector('[data-title]');
  const c = app.querySelector('[data-content]');
  return { title: t ? t.textContent.trim() : '', content: c ? c.innerHTML.trim() : '' };
}

async function load() {
  if (!token) { centerCard(null, '🔗', 'Invalid link', 'This page needs the private link from your email.'); return; }
  try {
    data = await call({ action: 'blog_view' });
    if (data.state === 'approved') { centerCard(data.branding, '🎉', 'Article published', `This article is live on your website.${data.link ? ` <a class="underline" href="${esc(data.link)}">Read it here.</a>` : ''} This link is no longer active.`); return; }
    if (data.state !== 'pending') { centerCard(data.branding, '📄', 'Already handled', 'This article has already been reviewed — this link is no longer active. A newer email may have replaced it.'); return; }
    renderPending();
  } catch (e) {
    centerCard(null, '🔗', 'Link not active', esc(e.message));
  }
}

app.addEventListener('click', async (e) => {
  if (busy) return;
  if (e.target.closest('[data-reject]')) {
    const box = app.querySelector('[data-rej]');
    if (box) { box.style.display = ''; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); const fb = box.querySelector('[data-fb]'); if (fb) fb.focus(); }
    return;
  }
  if (e.target.closest('[data-rej-cancel]')) {
    const box = app.querySelector('[data-rej]');
    if (box) box.style.display = 'none';
    return;
  }
  const send = e.target.closest('[data-rej-send]');
  if (send) {
    const fb = (app.querySelector('[data-fb]')?.value || '').trim();
    if (fb.length < 5) { alert('Please tell us what should be different — it shapes the replacement.'); return; }
    busy = true; send.textContent = 'Sending…';
    try {
      const r = await call({ action: 'blog_reject', feedback: fb });
      if (r.stopped) centerCard(data.branding, '🤝', 'Thanks — we\'re taking a step back', 'Your feedback has been sent to the team. Automatic articles are paused while they review your notes and adjust the direction — they\'ll be in touch.');
      else if (r.replacement) centerCard(data.branding, '✍️', 'A replacement is being written', 'Your feedback went straight to the writer. A new article on a different topic is being prepared now — you\'ll get a fresh review email shortly (usually within the hour).');
      else centerCard(data.branding, '✅', 'Feedback received', r.note || 'Your feedback has been passed to the team.');
    } catch (err) { busy = false; alert(err.message); }
    return;
  }
  const ap = e.target.closest('[data-approve]');
  if (ap) {
    if (!confirm('Publish this article live on your website now?')) return;
    busy = true; ap.textContent = 'Publishing…';
    try {
      const edits = currentEdits();
      if (edits.title || edits.content) { try { await call({ action: 'blog_save_edits', ...edits }); } catch (_) { /* edits are best-effort — approval proceeds */ } }
      const r = await call({ action: 'blog_approve' });
      centerCard(data.branding, '🎉', 'Published!', 'Your article is live on your website.', r.link ? `<a href="${esc(r.link)}" class="inline-block mt-4 text-white font-semibold rounded-xl px-6 py-3 text-sm" style="background:${esc((data.branding || {}).color || '#0f766e')}">🔗 View it on your site</a>` : '');
    } catch (err) { busy = false; ap.textContent = '✓ Approve & publish to the website'; alert(err.message); }
  }
});

load();
