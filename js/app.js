// ---------------------------------------------------------------------------
// app.js — Ops Dash shell: auth gate, sidebar nav, account switcher, router.
// ---------------------------------------------------------------------------
import { html, render, useState, useEffect, cx } from './lib.js';
import { useStore, initAuth, signOut, getUserEmail, activeAccount, setActiveAccount, createAccount } from './store.js';
import { LoadingScreen, AuthScreen, Onboarding } from './auth.js';
import { Dashboard } from './dashboard.js';
import { SEO } from './seo.js';
import { Keywords } from './keywords.js';
import { Competitors } from './competitors.js';
import { Ranks } from './ranks.js';
import { Local } from './local.js';
import { Audit } from './audit.js';
import { Backlinks } from './backlinks.js';
import { JobTracker } from './jt.js';
import { Select, Btn, Modal, Field, Input } from './ui.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '▣' },
  { id: 'seo', label: 'SEO', icon: '🔍' },
  { id: 'keywords', label: 'Keywords', icon: '🔑' },
  { id: 'competitors', label: 'Competitors', icon: '⚔️' },
  { id: 'ranks', label: 'Ranks', icon: '📈' },
  { id: 'local', label: 'Local', icon: '📍' },
  { id: 'audit', label: 'Audit', icon: '🩺' },
  { id: 'backlinks', label: 'Backlinks', icon: '🔗' },
  { id: 'jt', label: 'Business', icon: '📊' },
];

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [view, id] = raw.split('/');
  return { view: view || 'dashboard', id };
}

function NewAccountModal({ onClose }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try { await createAccount(name); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Modal} title="New account" onClose=${onClose}>
    <div class="space-y-3">
      <${Field} label="Account name"><${Input} value=${name} onInput=${setName} placeholder="Acme Home Services" /></${Field}>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${create} disabled=${busy}>${busy ? 'Creating…' : 'Create account'}</${Btn}>
    </div>
  </${Modal}>`;
}

function App() {
  const s = useStore();
  const [route, setRoute] = useState(parseHash());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { initAuth(); }, []);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); setMobileOpen(false); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (s.phase === 'loading') return html`<${LoadingScreen} />`;
  if (s.phase === 'login') return html`<${AuthScreen} />`;
  if (s.phase === 'app' && s.accounts.length === 0) return html`<${Onboarding} />`;

  const navigate = (view) => { location.hash = `/${view}`; setMobileOpen(false); };
  const view = NAV.some((n) => n.id === route.view) ? route.view : 'dashboard';
  const acct = activeAccount();

  return html`
    <div class="min-h-screen flex">
      <aside class=${cx('fixed lg:static z-40 inset-y-0 left-0 w-60 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300 flex flex-col transition-transform',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <div class="px-5 py-5 border-b border-slate-800 flex items-center gap-2 text-white">
          <div class="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold">◑</div>
          <span class="font-bold tracking-tight">Ops Dash</span>
        </div>

        <div class="px-3 pt-3">
          <label class="text-[11px] uppercase tracking-wide text-slate-500 px-1">Account</label>
          <${Select} value=${s.activeAccountId || ''} onChange=${(v) => setActiveAccount(v)}
            options=${(s.accounts || []).map((a) => ({ value: a.id, label: a.name }))} class="mt-1 text-slate-800" />
          <button onClick=${() => setShowNew(true)} class="mt-1.5 text-xs text-slate-400 hover:text-white">＋ New account</button>
        </div>

        <nav class="flex-1 p-3 space-y-1">
          ${NAV.map((n) => html`
            <button onClick=${() => navigate(n.id)}
              class=${cx('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition', view === n.id ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 text-slate-300')}>
              <span class="w-5 text-center">${n.icon}</span>${n.label}</button>`)}
        </nav>

        <div class="p-3 border-t border-slate-800 text-xs">
          <div class="px-1 text-slate-400 truncate">${getUserEmail()}</div>
          <button onClick=${signOut} class="mt-1 px-1 text-slate-400 hover:text-white underline">Sign out</button>
        </div>
      </aside>

      ${mobileOpen && html`<div onClick=${() => setMobileOpen(false)} class="fixed inset-0 z-30 bg-black/40 lg:hidden"></div>`}

      <div class="flex-1 min-w-0 flex flex-col">
        <header class="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
          <button onClick=${() => setMobileOpen(true)} class="text-slate-600 text-xl">☰</button>
          <span class="font-semibold text-slate-800">${acct?.name || 'Ops Dash'}</span>
        </header>
        <main class="flex-1">
          ${view === 'dashboard' && html`<${Dashboard} navigate=${navigate} />`}
          ${view === 'seo' && html`<${SEO} />`}
          ${view === 'keywords' && html`<${Keywords} />`}
          ${view === 'competitors' && html`<${Competitors} />`}
          ${view === 'ranks' && html`<${Ranks} />`}
          ${view === 'local' && html`<${Local} />`}
          ${view === 'audit' && html`<${Audit} />`}
          ${view === 'backlinks' && html`<${Backlinks} />`}
          ${view === 'jt' && html`<${JobTracker} />`}
        </main>
      </div>

      ${showNew && html`<${NewAccountModal} onClose=${() => setShowNew(false)} />`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
