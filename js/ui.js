// ---------------------------------------------------------------------------
// ui.js — reusable presentational components.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx, fmtMoney } from './lib.js';

const TONES = {
  blue:  'bg-brand-100 text-brand-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red:   'bg-rose-100 text-rose-800',
  gray:  'bg-slate-200 text-slate-700',
};

export const Badge = ({ tone = 'gray', children }) => html`
  <span class=${cx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', TONES[tone] || TONES.gray)}>
    ${children}
  </span>`;

export const Card = ({ class: cls = '', children }) => html`
  <div class=${cx('bg-white rounded-2xl border border-slate-200 shadow-sm', cls)}>${children}</div>`;

export function Stat({ label, value, sub, tone }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-rose-600' : 'text-slate-900';
  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition hover:shadow-md hover:border-slate-300">
      <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${label}</div>
      <div class=${cx('text-3xl font-extrabold tracking-tight mt-1 tabular-nums', color)}>${value}</div>
      ${sub && html`<div class="text-xs text-slate-500 mt-1">${sub}</div>`}
    </div>`;
}

// Generic button
export function Btn({ variant = 'primary', size = 'md', type = 'button', onClick, disabled, class: cls = '', children }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
  const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2.5', lg: 'text-base px-5 py-3' };
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow-md',
    cta: 'bg-accent-500 text-white hover:bg-accent-600 shadow-sm hover:shadow-md',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md',
  };
  return html`<button type=${type} disabled=${disabled} onClick=${onClick}
    class=${cx(base, sizes[size], variants[variant], cls)}>${children}</button>`;
}

// Modal dialog
export function Modal({ title, onClose, wide, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);
  return html`
    <div class="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-slate-900/50"
         onClick=${(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div class=${cx('bg-white rounded-2xl shadow-2xl w-full my-8 fade-in', wide ? 'max-w-4xl' : 'max-w-lg')}>
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 class="text-lg font-bold text-slate-900 tracking-tight">${title}</h3>
          <button onClick=${onClose} class="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div class="px-5 py-4 overflow-y-auto max-h-[70vh]">${children}</div>
        ${footer && html`<div class="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">${footer}</div>`}
      </div>
    </div>`;
}

// --- Receipt / document viewer ----------------------------------------------
// Browsers BLOCK top-level navigation to data: URLs (the old `<a href="data:…"
// target="_blank">` silently failed), so we render the receipt inline in a modal.
// A Blob URL — which IS allowed for navigation/download — backs the Download and
// Open-in-tab actions. Handles data: URLs (local mode) and http URLs (cloud).
export function ReceiptViewer({ doc, onClose }) {
  const [blobUrl, setBlobUrl] = useState('');
  const name = doc?.name || 'Receipt';
  const isImage = (doc?.type || '').startsWith('image') || /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name);
  const isPdf = (doc?.type || '').includes('pdf') || /\.pdf$/i.test(name);
  useEffect(() => {
    let dead = false, made = '';
    if (typeof doc?.url === 'string' && doc.url.startsWith('data:')) {
      fetch(doc.url).then((r) => r.blob()).then((b) => {
        if (dead) return; made = URL.createObjectURL(b); setBlobUrl(made);
      }).catch(() => { if (!dead) setBlobUrl(''); });
    } else {
      setBlobUrl(doc?.url || '');
    }
    return () => { dead = true; if (made) URL.revokeObjectURL(made); };
  }, [doc?.url]);

  const linkCls = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium text-sm px-3.5 py-2 transition';
  const footer = html`
    <button onClick=${onClose} class=${cx(linkCls, 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50')}>Close</button>
    ${blobUrl && html`<a href=${blobUrl} download=${name} class=${cx(linkCls, 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50')}>Download</a>`}
    ${blobUrl && html`<a href=${blobUrl} target="_blank" rel="noopener" class=${cx(linkCls, 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm')}>Open in new tab</a>`}`;

  return html`
    <${Modal} title=${name} wide onClose=${onClose} footer=${footer}>
      ${!blobUrl
        ? html`<div class="text-sm text-slate-400 py-12 text-center">Loading…</div>`
        : isImage
          ? html`<img src=${blobUrl} alt=${name} class="max-h-[70vh] max-w-full mx-auto rounded-lg" />`
          : isPdf
            ? html`<iframe src=${blobUrl} title=${name} class="w-full h-[70vh] rounded-lg border border-slate-200"></iframe>`
            : html`<div class="text-sm text-slate-500 py-12 text-center">This file type can't be previewed here.<br/>Use <span class="font-medium">Download</span> or <span class="font-medium">Open in new tab</span> to view it.</div>`}
    <//>`;
}

// --- Form fields ------------------------------------------------------------
export const Field = ({ label, hint, children, class: cls = '' }) => html`
  <label class=${cx('block', cls)}>
    ${label && html`<span class="block text-sm font-medium text-slate-700 mb-1">${label}</span>`}
    ${children}
    ${hint && html`<span class="block text-xs text-slate-400 mt-1">${hint}</span>`}
  </label>`;

const inputCls = 'w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition';

export const Input = ({ value, onInput, onBlur, type = 'text', placeholder, step, class: cls = '' }) => html`
  <input type=${type} value=${value} placeholder=${placeholder} step=${step}
    onInput=${(e) => onInput?.(e.target.value)} onBlur=${(e) => onBlur?.(e.target.value)} class=${cx(inputCls, cls)} />`;

export const Textarea = ({ value, onInput, rows = 3, placeholder }) => html`
  <textarea rows=${rows} placeholder=${placeholder} onInput=${(e) => onInput?.(e.target.value)}
    class=${inputCls}>${value}</textarea>`;

export const Select = ({ value, onChange, options, class: cls = '' }) => html`
  <select value=${value} onChange=${(e) => onChange?.(e.target.value)} class=${cx(inputCls, 'bg-white', cls)}>
    ${options.map((o) => html`<option value=${o.value} selected=${o.value === value}>${o.label}</option>`)}
  </select>`;

export const Checkbox = ({ checked, onChange, label }) => html`
  <label class="inline-flex items-center gap-2 cursor-pointer select-none">
    <input type="checkbox" checked=${checked} onChange=${(e) => onChange?.(e.target.checked)}
      class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
    <span class="text-sm text-slate-700">${label}</span>
  </label>`;

// External link or em-dash
export const LinkOut = ({ href, children }) => href
  ? html`<a href=${href} target="_blank" rel="noopener" class="text-brand-600 hover:underline inline-flex items-center gap-1">
      ${children || 'Open'} <span class="text-xs">↗</span></a>`
  : html`<span class="text-slate-400">—</span>`;

// --- Tabs -------------------------------------------------------------------
export function Tabs({ tabs, active, onChange }) {
  return html`
    <div class="flex gap-1 border-b border-slate-200 overflow-x-auto">
      ${tabs.map((t) => html`
        <button onClick=${() => onChange(t.value)}
          class=${cx('px-4 py-2.5 text-sm border-b-2 -mb-px transition whitespace-nowrap shrink-0',
            active === t.value ? 'border-brand-600 text-brand-700 font-bold' : 'border-transparent text-slate-500 font-medium hover:text-slate-800 hover:border-slate-300')}>
          ${t.label}${t.count != null && html`<span class="ml-1.5 text-xs text-slate-400">${t.count}</span>`}
        </button>`)}
    </div>`;
}

// --- Simple horizontal bar chart -------------------------------------------
export function BarChart({ data, money = true, max }) {
  const peak = max ?? Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return html`
    <div class="space-y-2">
      ${data.map((d) => html`
        <div>
          <div class="flex justify-between text-xs mb-0.5">
            <span class="text-slate-600 font-medium">${d.label}</span>
            <span class="text-slate-500">${money ? fmtMoney(d.value, { cents: false }) : d.value}</span>
          </div>
          <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div class=${cx('h-full rounded-full', d.tone || 'bg-brand-500')}
                 style=${`width:${Math.max(2, (Math.abs(d.value) / peak) * 100)}%`}></div>
          </div>
        </div>`)}
      ${data.length === 0 && html`<div class="text-sm text-slate-400">No data.</div>`}
    </div>`;
}

export const EmptyState = ({ title, sub, action }) => html`
  <div class="text-center py-16">
    <div class="text-slate-400 text-5xl mb-3">∅</div>
    <div class="text-slate-700 font-medium">${title}</div>
    ${sub && html`<div class="text-sm text-slate-500 mt-1">${sub}</div>`}
    ${action && html`<div class="mt-4">${action}</div>`}
  </div>`;
