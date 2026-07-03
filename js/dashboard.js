// ---------------------------------------------------------------------------
// dashboard.js — Ops Dash home. Light for now: active account + entry points.
// Fills out as modules land (SEO first).
// ---------------------------------------------------------------------------
import { html, cx } from './lib.js';
import { useStore, activeAccount, getUserEmail } from './store.js';
import { Card } from './ui.js';

export function Dashboard({ navigate }) {
  useStore();
  const acct = activeAccount();
  const modules = [
    { id: 'seo', icon: '🔍', title: 'SEO Intelligence', desc: 'Search Console query mining — find the ranking opportunities in your data.', live: true },
    { id: null, icon: '🏆', title: 'Rank Tracking', desc: 'Track keyword positions over time.', live: false },
    { id: null, icon: '🧭', title: 'Competitor Gap', desc: 'See what competitors rank for that you don’t.', live: false },
    { id: null, icon: '🛠️', title: 'Technical Audit', desc: 'Crawl + score site health.', live: false },
  ];
  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">${acct?.name || 'Ops Dash'}</h1>
      <p class="text-sm text-slate-500">Signed in as ${getUserEmail()}</p>
    </div>
    <div class="grid sm:grid-cols-2 gap-4">
      ${modules.map((m) => html`
        <${Card}>
          <button onClick=${() => m.live && m.id && navigate(m.id)} disabled=${!m.live}
            class=${cx('w-full text-left p-5 flex gap-4 items-start', m.live ? 'hover:bg-slate-50' : 'opacity-60 cursor-default')}>
            <div class="text-2xl">${m.icon}</div>
            <div class="flex-1">
              <div class="font-semibold text-slate-800 flex items-center gap-2">${m.title}
                ${!m.live && html`<span class="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Soon</span>`}</div>
              <div class="text-sm text-slate-500 mt-0.5">${m.desc}</div>
            </div>
          </button>
        </${Card}>`)}
    </div>
  </div>`;
}
