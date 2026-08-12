// ---------------------------------------------------------------------------
// blog-approve.js — public client blog-approval page (no login; token-gated).
// Opened from the branded approval email: /blog-approve.html?t=TOKEN.
// The article is stored as MARKDOWN in seo_briefs; WordPress receives it via
// seo-wp's mdToHtml at publish time. This page mirrors that same conversion so
// the client reviews the article looking exactly like it will on their site,
// and serializes edits BACK to markdown (blog_save_edits stores markdown).
// [IMAGE: …] slots are filled with real photos at publish — shown here as
// locked placeholder cards. Vanilla JS on purpose: standalone for non-users.
// ---------------------------------------------------------------------------
const FN = 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-autoblog';
const token = new URLSearchParams(location.search).get('t') || '';
const app = document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

let data = null;
let busy = false;
let hadH1 = false;          // original markdown began with a "# " line
let initialBodyHtml = '';   // rendered snapshot — detects whether the client edited
let initialTitle = '';

async function call(body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, token }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'Something went wrong — try again.');
  return j;
}

// ── markdown → HTML (mirror of seo-wp mdToHtml, display flavor) ─────────────
const IMG_RE = /^\s*\*?\s*\[IMAGE:\s*([^|\]]+?)(?:\|[^\]]*)?\]\s*\*?\s*$/i;
function inline(s) {
  let t = esc(String(s).replace(/\{#[^}]*\}/g, ''));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, txt, url) => (/^(https?:\/\/|#|\/)/.test(url) ? `<a href="${url.replace(/"/g, '%22')}" target="_blank" rel="noopener">${txt}</a>` : txt));
  t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}
const anchorOf = (raw) => { const m = String(raw).match(/\{#([^}]+)\}/); return m ? ` data-anchor="${esc(m[1])}"` : ''; };
// The hidden .ph-d keeps the ORIGINAL raw slot line (incl. "| purpose" hints
// used to pick the photo at publish) so saving edits round-trips it verbatim.
const imgCard = (desc, rawLine) => `<figure class="ph" contenteditable="false"><div class="ph-i">📷</div><div class="ph-t"><b>Photo goes here</b><span>${esc(desc.trim())}</span></div><i class="ph-d" style="display:none">${esc(rawLine.trim())}</i></figure>`;
function mdToHtml(md) {
  const out = []; let list = null, olist = null, table = null, quote = null, first = true;
  hadH1 = false;
  const flushList = () => { if (list) { out.push('<ul>' + list.map((li) => `<li>${li}</li>`).join('') + '</ul>'); list = null; } };
  const flushOl = () => { if (olist) { out.push('<ol>' + olist.map((li) => `<li>${li}</li>`).join('') + '</ol>'); olist = null; } };
  const flushTable = () => {
    if (!table) return;
    const rows = table.map((l) => l.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()))
      .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
    table = null;
    if (!rows.length) return;
    const [h, ...rest] = rows;
    out.push('<figure class="wp-block-table"><table><thead><tr>' + h.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
      + rest.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></figure>');
  };
  const flushQuote = () => {
    if (!quote) return;
    const lines = quote; quote = null;
    const inner = []; let ql = null;
    const qf = () => { if (ql) { inner.push('<ul>' + ql.map((li) => `<li>${li}</li>`).join('') + '</ul>'); ql = null; } };
    for (const q of lines) {
      if (/^\s*[-*]\s+/.test(q)) { if (!ql) ql = []; ql.push(inline(q.replace(/^\s*[-*]\s+/, ''))); }
      else if (q.trim() === '') qf();
      else { qf(); inner.push(`<p>${inline(q)}</p>`); }
    }
    qf();
    out.push('<blockquote>' + inner.join('') + '</blockquote>');
  };
  const flush = () => { flushList(); flushOl(); flushTable(); flushQuote(); };
  for (const ln of String(md || '').split(/\r?\n/)) {
    const im = ln.match(IMG_RE);
    if (im) { flush(); out.push(imgCard(im[1], ln)); continue; }
    if (/^\s*>\s?/.test(ln)) { flushList(); flushOl(); flushTable(); if (!quote) quote = []; quote.push(ln.replace(/^\s*>\s?/, '')); continue; }
    if (/^\s*\|.*\|\s*$/.test(ln)) { flushList(); flushOl(); flushQuote(); if (!table) table = []; table.push(ln); continue; }
    if (/^\s*###\s+/.test(ln)) { flush(); const raw = ln.replace(/^\s*###\s+/, ''); out.push(`<h3${anchorOf(raw)}>${inline(raw)}</h3>`); continue; }
    if (/^\s*##\s+/.test(ln)) { flush(); const raw = ln.replace(/^\s*##\s+/, ''); out.push(`<h2${anchorOf(raw)}>${inline(raw)}</h2>`); continue; }
    if (/^\s*#\s+/.test(ln)) { flush(); if (first) { first = false; hadH1 = true; continue; } const raw = ln.replace(/^\s*#\s+/, ''); out.push(`<h2${anchorOf(raw)}>${inline(raw)}</h2>`); continue; }
    if (/^\s*\d+\.\s+/.test(ln)) { flushList(); flushTable(); flushQuote(); if (!olist) olist = []; olist.push(inline(ln.replace(/^\s*\d+\.\s+/, ''))); continue; }
    if (/^\s*[-*]\s+/.test(ln)) { flushOl(); flushTable(); flushQuote(); if (!list) list = []; list.push(inline(ln.replace(/^\s*[-*]\s+/, ''))); continue; }
    if (ln.trim() === '') { flush(); continue; }
    flush(); out.push(`<p>${inline(ln)}</p>`);
  }
  flush();
  return out.join('\n');
}

// ── edited HTML → markdown (round-trips exactly what mdToHtml produced) ─────
function inlineMd(node) {
  let s = '';
  for (const c of node.childNodes) {
    if (c.nodeType === Node.TEXT_NODE) { s += c.textContent; continue; }
    if (c.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = c.tagName;
    if (tag === 'STRONG' || tag === 'B') s += `**${inlineMd(c)}**`;
    else if (tag === 'EM' || tag === 'I') s += `*${inlineMd(c)}*`;
    else if (tag === 'A') s += `[${inlineMd(c)}](${c.getAttribute('href') || '#'})`;
    else if (tag === 'BR') s += ' ';
    else s += inlineMd(c);
  }
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ');
}
const withAnchor = (el, text) => (el.dataset.anchor ? `${text} {#${el.dataset.anchor}}` : text);
function htmlToMd(container) {
  const out = [];
  for (const el of container.children) {
    const tag = el.tagName;
    if (el.classList?.contains('ph')) { const d = el.querySelector('.ph-d'); out.push((d?.textContent || '[IMAGE: photo]').trim(), ''); continue; }
    if (tag === 'H2') { out.push(`## ${withAnchor(el, inlineMd(el).trim())}`, ''); continue; }
    if (tag === 'H3') { out.push(`### ${withAnchor(el, inlineMd(el).trim())}`, ''); continue; }
    if (tag === 'UL') { for (const li of el.querySelectorAll(':scope > li')) out.push(`- ${inlineMd(li).trim()}`); out.push(''); continue; }
    if (tag === 'OL') { let n = 1; for (const li of el.querySelectorAll(':scope > li')) out.push(`${n++}. ${inlineMd(li).trim()}`); out.push(''); continue; }
    if (tag === 'BLOCKQUOTE') {
      for (const ch of el.children) {
        if (ch.tagName === 'UL') { for (const li of ch.querySelectorAll(':scope > li')) out.push(`> - ${inlineMd(li).trim()}`); }
        else out.push(`> ${inlineMd(ch).trim()}`);
      }
      out.push(''); continue;
    }
    if (tag === 'FIGURE' || tag === 'TABLE') {
      const t = tag === 'TABLE' ? el : el.querySelector('table');
      if (!t) continue;
      const rows = [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => inlineMd(c).trim().replace(/\|/g, '/')));
      if (rows.length) {
        out.push(`| ${rows[0].join(' | ')} |`);
        out.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
        for (const r of rows.slice(1)) out.push(`| ${r.join(' | ')} |`);
        out.push('');
      }
      continue;
    }
    const txt = inlineMd(el).trim();
    if (txt) out.push(txt, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── UI ──────────────────────────────────────────────────────────────────────
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
  const bodyHtml = mdToHtml(blog.content || '');
  app.innerHTML = `
    ${header(b, 'Your new article, shown just like it will appear on your website. Click into any text to fix wording, then approve or request a different one.')}
    <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div class="px-6 sm:px-10 pt-8">
        <div class="text-[11px] uppercase tracking-wide text-slate-400 mb-2">✏️ You can edit the title and article text directly · photos are added automatically when it publishes</div>
        <h1 data-title contenteditable="true" spellcheck="true" class="wp-title focus:outline-none">${esc(blog.title)}</h1>
      </div>
      <div data-content contenteditable="true" spellcheck="true" class="wp-body px-6 sm:px-10 pb-8 focus:outline-none">${bodyHtml}</div>
    </div>
    <div data-rej style="display:none" class="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div class="text-sm font-semibold text-amber-800 mb-1">What didn't work about this article?</div>
      <div class="text-xs text-amber-700 mb-2">Your feedback goes straight to the writer — the replacement is chosen and written around it. (required)</div>
      <textarea data-fb rows="3" class="w-full text-base border border-amber-300 rounded-lg px-2.5 py-2 focus:outline-none" placeholder="e.g. Too technical for our customers — keep it simple, and don't mention pricing."></textarea>
      <div class="flex items-center justify-end gap-2 mt-2">
        <button data-rej-cancel class="text-sm text-slate-500 px-3 py-3">Cancel</button>
        <button data-rej-send class="text-sm font-semibold text-white bg-amber-500 rounded-lg px-4 py-3">Send & request a replacement</button>
      </div>
    </div>
    <div data-bar class="fixed bottom-0 inset-x-0 z-20 bg-white/95 border-t border-slate-200 px-4 py-3" style="backdrop-filter:blur(6px)">
      <div class="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
        <button data-approve class="w-full sm:w-auto shrink-0 text-white font-semibold rounded-xl px-8 py-3.5 text-base shadow-lg" style="background:${esc(b.color || '#0f766e')}">✓ Approve & publish to the website</button>
        <button data-reject class="w-full sm:w-auto shrink-0 font-medium rounded-xl px-6 py-3.5 text-base border border-slate-300 text-slate-600 bg-white">✕ Request a different article</button>
        <div class="text-xs text-slate-400 sm:ml-2">Approving publishes it live right away.</div>
      </div>
    </div>`;
  initialBodyHtml = app.querySelector('[data-content]').innerHTML;
  initialTitle = (app.querySelector('[data-title]').textContent || '').trim();
  syncBarPad();
}

function syncBarPad() {
  const bar = app.querySelector('[data-bar]');
  if (bar) app.style.paddingBottom = `${bar.offsetHeight + 24}px`;
}
window.addEventListener('resize', syncBarPad);

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
      const titleEl = app.querySelector('[data-title]');
      const bodyEl = app.querySelector('[data-content]');
      const newTitle = (titleEl?.textContent || '').trim();
      const bodyChanged = bodyEl && bodyEl.innerHTML !== initialBodyHtml;
      const titleChanged = newTitle && newTitle !== initialTitle;
      // Only save when the client actually changed something — an untouched
      // article keeps its original markdown byte-for-byte.
      if (bodyChanged || titleChanged) {
        let md = bodyChanged ? htmlToMd(bodyEl) : null;
        if (md !== null && hadH1) md = `# ${newTitle || initialTitle}\n\n${md}`;
        try { await call({ action: 'blog_save_edits', title: titleChanged ? newTitle : undefined, content: md || undefined }); }
        catch (_) { /* edits are best-effort — approval proceeds */ }
      }
      const r = await call({ action: 'blog_approve' });
      centerCard(data.branding, '🎉', 'Published!', 'Your article is live on your website.', r.link ? `<a href="${esc(r.link)}" class="inline-block mt-4 text-white font-semibold rounded-xl px-6 py-3 text-sm" style="background:${esc((data.branding || {}).color || '#0f766e')}">🔗 View it on your site</a>` : '');
    } catch (err) { busy = false; ap.textContent = '✓ Approve & publish to the website'; alert(err.message); }
  }
});

load();

// Debug/QA hook: lets automated checks exercise the md↔html round-trip.
window.__blogApprove = { mdToHtml, htmlToMd };
