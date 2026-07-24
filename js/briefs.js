// ---------------------------------------------------------------------------
// briefs.js — the content-brief library + editor modal (moved out of the
// Keywords tab; the library now lives on the Autoblogger tab). Keywords keeps
// its ✨ Write buttons — both tabs share ContentModal and generateBrief.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { seoLoadBriefs, seoBriefResearch, seoBriefGenerate, seoBriefRefine, seoBriefSave, seoWpStatus, seoWpPublish } from './store.js';
import { Card, Btn, Input, Select, Modal } from './ui.js';
import { mdRender } from './keywords.js';

const Pill = ({ children, cls }) => html`<span class=${cx('inline-block px-2 py-0.5 rounded-full text-xs font-medium', cls)}>${children}</span>`;

// Mirrors the generator's server-side counter: strips markdown syntax so link
// URLs, table pipes and image placeholders don't inflate the number.
export function proseWordCount(md) {
  let t = String(md || '');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/^[^\S\n]*\*?[^\S\n]*\[IMAGE:[^\]]*\][^\S\n]*\*?[^\S\n]*$/gim, ' ');
  t = t.replace(/\{#[^}]*\}/g, ' ');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/^[^\S\n]*\|[\s:|-]+\|[^\S\n]*$/gm, ' ');
  t = t.replace(/\|/g, ' ');
  t = t.replace(/^[^\S\n]{0,3}#{1,6}[^\S\n]+/gm, ' ');
  t = t.replace(/^[^\S\n]*>[^\S\n]?/gm, ' ');
  t = t.replace(/^[^\S\n]*(?:[-*+]|\d+\.)[^\S\n]+/gm, ' ');
  t = t.replace(/[*_`~]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t ? t.split(' ').length : 0;
}
const Counter = ({ n, lo, hi, unit }) => html`<span class=${cx('tabular-nums text-[11px]', !n ? 'text-slate-300' : n >= lo && n <= hi ? 'text-emerald-600' : 'text-amber-600')}>${n}${unit || ''}</span>`;

// Three-pass generation: research (best-effort) → write → quality refine.
export async function generateBrief(site, key, kind, format) {
  const target = kind === 'keyword' ? { keyword: key } : { cluster: key };
  let sources = [];
  try { const res = await seoBriefResearch(site, target); sources = res?.sources || []; }
  catch (_) { /* research is best-effort — generate falls back to official-homepage citations */ }
  const r = await seoBriefGenerate(site, target, format, sources);
  if (r?.issues?.length) {
    try { await seoBriefRefine(site, key, sources); }
    catch (_) { /* draft is already saved — quality pass is best-effort */ }
  }
  return r;
}
// Was this brief written for a single keyword or a cluster?
export const briefKind = (b) => (Array.isArray(b?.keywords) && b.keywords[0] === b.cluster) ? 'keyword' : 'cluster';

export function ContentModal({ cluster, brief, busy, error, onClose, onGen, wpConnected, wpBusy, onWp, onSave }) {
  const [copied, setCopied] = useState(false);
  const [wpRes, setWpRes] = useState(null);
  const [wpSendErr, setWpSendErr] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [imgSource, setImgSource] = useState('stock');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const has = brief && brief.content;
  const fields = (b) => ({ title: b.title || '', h1: b.h1 || '', meta: b.meta || '', slug: b.slug || '', content: b.content || '' });
  const dirty = editing && draft && brief && JSON.stringify(draft) !== JSON.stringify(fields(brief));
  const startEdit = () => { setDraft(fields(brief)); setSaveErr(''); setSavedNote(''); setEditing(true); };
  const cancelEdit = () => { if (dirty && !confirm('Discard your unsaved edits?')) return; setEditing(false); setDraft(null); setSaveErr(''); };
  const save = async () => {
    setSaving(true); setSaveErr(''); setSavedNote('');
    try { await onSave(draft); setEditing(false); setDraft(null); setSavedNote('Saved. Send it to WordPress when you\'re ready.'); }
    catch (e) { setSaveErr(e.message); } finally { setSaving(false); }
  };
  const close = () => { if (dirty && !confirm('You have unsaved edits. Close anyway?')) return; onClose(); };
  const copy = async () => { try { await navigator.clipboard.writeText(brief.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) { /* ignore */ } };
  const sendWp = async (mode) => { setWpSendErr(''); setWpRes(null); try { setWpRes(await onWp(mode, imgUrl.trim(), imgSource)); } catch (e) { setWpSendErr(e.message); } };
  const footer = !has ? null : editing ? html`<div class="flex justify-between items-center w-full gap-2 flex-wrap">
    <span class="text-xs text-slate-400">${dirty ? 'Unsaved changes' : 'No changes yet'}</span>
    <div class="flex gap-2">
      <${Btn} size="sm" onClick=${cancelEdit} disabled=${saving}>Cancel</${Btn}>
      <${Btn} size="sm" onClick=${save} disabled=${saving || !dirty}>${saving ? 'Saving…' : '💾 Save changes'}</${Btn}>
    </div>
  </div>` : html`<div class="flex justify-between items-center w-full gap-2 flex-wrap">
    <div class="flex gap-2 flex-wrap items-center">
      <${Btn} size="sm" onClick=${startEdit}>✏️ Edit</${Btn}>
      <${Btn} size="sm" onClick=${() => onGen('blog')} disabled=${busy}>${busy ? '…' : 'Rewrite as blog'}</${Btn}>
      <${Btn} size="sm" onClick=${() => onGen('service')} disabled=${busy}>${busy ? '…' : 'Rewrite as page'}</${Btn}>
      ${wpConnected && html`
        <${Btn} size="sm" onClick=${() => sendWp('draft')} disabled=${wpBusy}>${wpBusy ? 'Sending…' : brief.wp_post_id ? '↻ Update WP draft' : '→ WP draft'}</${Btn}>
        <${Btn} size="sm" onClick=${() => sendWp('publish')} disabled=${wpBusy}>${wpBusy ? '…' : '🚀 Publish live'}</${Btn}>`}
    </div>
    <${Btn} size="sm" onClick=${copy}>${copied ? 'Copied ✓' : 'Copy markdown'}</${Btn}>
  </div>`;
  if (has && editing && draft) {
    const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
    const words = proseWordCount(draft.content);
    const ta = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200';
    return html`<${Modal} title=${`Edit — ${cluster}`} wide onClose=${close} footer=${footer}>
      <div class="space-y-3 text-sm">
        ${saveErr && html`<div class="rounded-lg bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">${saveErr}</div>`}
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] text-slate-400"><span>SEO title (50–60 chars)</span><${Counter} n=${draft.title.length} lo=${50} hi=${60} /></div>
          <${Input} value=${draft.title} onInput=${(v) => setDraft({ ...draft, title: v })} placeholder="Shown in Google results" />
        </div>
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] text-slate-400"><span>H1 — on-page headline (must differ from the SEO title)</span><span class=${cx('text-[11px]', draft.h1.trim() && draft.h1.trim().toLowerCase() === draft.title.trim().toLowerCase() ? 'text-amber-600' : 'text-slate-300')}>${draft.h1.trim() && draft.h1.trim().toLowerCase() === draft.title.trim().toLowerCase() ? 'identical to title' : ''}</span></div>
          <${Input} value=${draft.h1} onInput=${(v) => setDraft({ ...draft, h1: v })} placeholder="Becomes the post title in WordPress" />
        </div>
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] text-slate-400"><span>Meta description (150–155 chars)</span><${Counter} n=${draft.meta.length} lo=${150} hi=${155} /></div>
          <textarea value=${draft.meta} onInput=${set('meta')} rows="2" class=${ta}></textarea>
        </div>
        <div class="space-y-1">
          <div class="text-[11px] text-slate-400">URL slug</div>
          <${Input} value=${draft.slug} onInput=${(v) => setDraft({ ...draft, slug: v })} placeholder="lawn-mowing-ocala-fl" />
        </div>
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] text-slate-400">
            <span>Article (Markdown) — <span class="text-slate-500">## Heading {#anchor}</span> sets a heading's link target; <span class="text-slate-500">*[IMAGE: …]*</span> lines become photos on publish</span>
            <span>body prose <${Counter} n=${words} lo=${1500} hi=${2000} /> words</span>
          </div>
          <textarea value=${draft.content} onInput=${set('content')} rows="22" spellcheck="true" class=${cx(ta, 'font-mono text-xs leading-relaxed')}></textarea>
        </div>
        <div class="text-[11px] text-slate-400">Word count ignores headings, table cells and link URLs — it counts what a reader actually reads, same as the quality checker.</div>
      </div>
    </${Modal}>`;
  }
  return html`<${Modal} title=${`Content — ${cluster}`} wide onClose=${close} footer=${footer}>
    ${!has ? html`<div class="text-center space-y-4 py-4">
        <div class="text-sm text-slate-600">Generate publish-ready copy for <span class="font-medium">${cluster}</span>. Pick the format:</div>
        <div class="flex justify-center gap-3">
          <${Btn} onClick=${() => onGen('blog')} disabled=${busy}>${busy ? 'Writing…' : '📝 Blog post'}</${Btn}>
          <${Btn} onClick=${() => onGen('service')} disabled=${busy}>${busy ? 'Writing…' : '🧰 Service page'}</${Btn}>
        </div>
        ${busy && html`<div class="text-xs text-slate-500 animate-pulse">Researching authorities, writing, and quality-checking — usually 1–3 minutes. You can close this and check the Briefs list later.</div>`}
        ${error && html`<div class="text-sm text-rose-600">${error}</div>`}
        <div class="text-xs text-slate-400">Rank Math-style structure: SEO title + distinct H1, answer-first intro, Key Takeaways, quick-answer sections, tables + FAQ, internal links to your pages, and researched authority citations.</div>
      </div>`
      : html`<div class="space-y-4 text-sm">
        ${wpRes && html`<div class="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800">
          ${wpRes.status === 'publish' ? '🚀 Published live on WordPress.' : wpRes.updated ? 'WordPress draft updated.' : 'Sent to WordPress as a draft.'}
          ${wpRes.edit_link && html` <a href=${wpRes.edit_link} target="_blank" rel="noopener" class="underline font-medium">Open in WP editor</a>`}
          ${wpRes.link && html` · <a href=${wpRes.link} target="_blank" rel="noopener" class="underline">${wpRes.status === 'publish' ? 'View live' : 'Preview'}</a>`}
          ${wpRes.images_added > 0 && html`<span class="block text-xs text-emerald-700 mt-1">${wpRes.images_added} image${wpRes.images_added === 1 ? '' : 's'} added to the article + featured image set.</span>`}
          ${wpRes.image_note && html`<span class="block text-xs text-amber-700 mt-1">${wpRes.image_note}</span>`}
          ${wpRes.featured_image?.error && html`<span class="block text-xs text-amber-700 mt-1">Featured image failed: ${wpRes.featured_image.error}</span>`}
          ${wpRes.status !== 'publish' && !wpRes.images_added && html`<span class="block text-xs text-emerald-700 mt-1">Replace the [IMAGE: …] placeholders with real photos before publishing.</span>`}
        </div>`}
        ${wpSendErr && html`<div class="rounded-lg bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">${wpSendErr}</div>`}
        ${savedNote && html`<div class="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800">${savedNote}</div>`}
        ${wpConnected && html`<div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400 shrink-0">Article images</span>
            <${Select} value=${imgSource} onChange=${setImgSource} options=${[
              { value: 'stock', label: '📷 Stock photos (Pexels)' },
              { value: 'ai', label: '🎨 AI-generated' },
              { value: 'client', label: '🏗 Client job photos' },
              { value: 'none', label: 'None — keep placeholders' },
            ]} />
          </div>
          <div class="flex items-center gap-2 flex-1 min-w-48">
            <span class="text-xs text-slate-400 shrink-0">Featured image URL (optional override)</span>
            <div class="flex-1"><${Input} value=${imgUrl} onInput=${setImgUrl} placeholder="https://…" /></div>
          </div>
        </div>`}
        <div class="flex flex-wrap gap-2 items-center">
          <${Pill} cls="bg-brand-100 text-brand-700">${(brief.format || brief.page_type || '').replace('_', ' ')}</${Pill}>
          <${Pill} cls="bg-slate-100 text-slate-600">Schema: ${brief.schema_type}</${Pill}>
          ${brief.slug && html`<span class="text-xs text-slate-400">/${brief.slug}</span>`}
          ${!wpRes && brief.wp_link && html`<a href=${brief.wp_link} target="_blank" rel="noopener" class="text-xs text-sky-700 underline">On WordPress ↗</a>`}
        </div>
        <div class="rounded-lg bg-slate-50 p-3 space-y-1">
          <div><span class="text-xs font-semibold text-slate-400 uppercase">SEO Title</span> <span class="text-slate-800">${brief.title}</span></div>
          ${brief.h1 && html`<div><span class="text-xs font-semibold text-slate-400 uppercase">H1</span> <span class="text-slate-800">${brief.h1}</span></div>`}
          <div><span class="text-xs font-semibold text-slate-400 uppercase">Meta</span> <span class="text-slate-600">${brief.meta}</span></div>
        </div>
        <article class="space-y-2">${mdRender(brief.content)}</article>
        ${(brief.internal_links || []).length > 0 && html`<div class="pt-2 border-t border-slate-100">
          <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Internal links used</div>
          <ul class="list-disc ml-5 text-slate-600">${brief.internal_links.map((l) => html`<li><a href=${l.url} target="_blank" rel="noopener" class="text-brand-700 underline">${l.anchor}</a></li>`)}</ul>
        </div>`}
        ${(brief.external_links || []).length > 0 && html`<div class="pt-2 border-t border-slate-100">
          <div class="text-xs font-semibold text-slate-400 uppercase mb-1">Authority citations <span class="font-normal normal-case text-slate-400">— researched &amp; verified external sources</span></div>
          <ul class="list-disc ml-5 text-slate-600">${brief.external_links.map((l) => html`<li>
            <a href=${l.url} target="_blank" rel="noopener" class="text-brand-700 underline">${l.anchor}</a>
            ${l.source_type && html`<span class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">${String(l.source_type).replace('_', ' ')}</span>`}
          </li>`)}</ul>
        </div>`}
      </div>`}
  </${Modal}>`;
}

// Self-contained briefs library — the drafts written from the Keywords tab
// (✨ Write) plus rewrites, with full edit/regenerate/publish. Lives on the
// Autoblogger tab.
export function BriefsLibrary({ site }) {
  const [briefs, setBriefs] = useState(null);
  const [wp, setWp] = useState(null);
  const [open, setOpen] = useState(null);      // brief cluster key
  const [busyKey, setBusyKey] = useState('');
  const [wpBusy, setWpBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => seoLoadBriefs(site).then(setBriefs).catch(() => setBriefs([]));
  useEffect(() => {
    setBriefs(null); setWp(null); setOpen(null); setErr('');
    if (site) { load(); seoWpStatus(site).then(setWp).catch(() => setWp(null)); }
  }, [site]);

  const regen = async (key, fmt) => {
    const b = (briefs || []).find((x) => x.cluster === key);
    setBusyKey(key); setErr('');
    try { await generateBrief(site, key, b ? briefKind(b) : 'cluster', fmt); await load(); }
    catch (e) { setErr(e.message); } finally { setBusyKey(''); }
  };
  const publish = async (key, mode, imgUrl, imageSource) => {
    setWpBusy(true);
    try { const r = await seoWpPublish(site, key, mode, imgUrl, imageSource); await load(); return r; }
    finally { setWpBusy(false); }
  };
  const saveBrief = async (key, patch) => { await seoBriefSave(site, key, patch); await load(); };

  const cur = open ? (briefs || []).find((b) => b.cluster === open) : null;
  return html`<${Card}><div class="p-3">
    <div class="px-1 pb-2 flex items-center justify-between flex-wrap gap-2">
      <div>
        <div class="font-semibold text-slate-800">📄 Content briefs <span class="text-xs font-normal text-slate-400">— ${briefs === null ? '…' : briefs.length} drafts</span></div>
        <div class="text-xs text-slate-400">Written from the Keywords tab (✨ Write on a keyword or cluster). Edit, rewrite, and publish to WordPress here.</div>
      </div>
    </div>
    ${err && html`<div class="text-xs text-rose-600 px-1 pb-2">${err}</div>`}
    ${briefs === null ? html`<div class="p-4 text-sm text-slate-400">Loading…</div>`
      : briefs.length === 0 ? html`<div class="p-6 text-center text-sm text-slate-500">No briefs yet. Open the <span class="font-medium">Keywords</span> tab and hit ✨ on a keyword or cluster to write one.</div>`
      : html`<div class="divide-y divide-slate-100">${briefs.map((b) => html`<button onClick=${() => setOpen(b.cluster)} class="w-full text-left py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded">
          <div class="min-w-0"><div class="font-medium text-slate-800">${b.cluster}</div><div class="text-xs text-slate-500 truncate">${b.title}</div></div>
          <div class="flex items-center gap-2 shrink-0">
            ${b.wp_post_id && html`<${Pill} cls="bg-sky-100 text-sky-700">WP ✓</${Pill}>`}
            <${Pill} cls="bg-slate-100 text-slate-600">${(b.format || b.page_type || '').replace('_', ' ')}</${Pill}>
          </div>
        </button>`)}</div>`}
    ${open && html`<${ContentModal} cluster=${open} brief=${cur} busy=${busyKey === open} error=${err}
      onClose=${() => setOpen(null)} onGen=${(fmt) => regen(open, fmt)}
      wpConnected=${!!wp?.connected} wpBusy=${wpBusy}
      onWp=${(mode, imgUrl, imageSource) => publish(open, mode, imgUrl, imageSource)}
      onSave=${(patch) => saveBrief(open, patch)} />`}
  </div></${Card}>`;
}
