// ---------------------------------------------------------------------------
// report-public.js — the public client report: /report.html?t=TOKEN.
//
// No login, read-only, revocable. Same token pattern as approve.html and
// blog-approve.html, but unlike those two this page renders the SAME Preact
// components as the in-app tab (report-body.js) rather than a hand-rolled
// vanilla copy — a report is far too much visual surface to maintain twice,
// and "what the client sees is exactly what we sent" is the whole point.
//
// The lens is decided SERVER-SIDE: seo-report's `public` action always returns
// the client lens, so agency costs, margin and API spend never reach this page
// even if something here asked for them.
// ---------------------------------------------------------------------------
import { html, render, useState, useEffect } from './lib.js';
import { ReportBody } from './report-body.js';
import { ensureVizCss } from './report-view.js';

const FN = 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-report';
// AI search visibility lives in its own function and validates the SAME share
// token server-side, forcing the client lens exactly as seo-report does. It is
// fetched alongside, never awaited before the report renders: if it is slow,
// down, or has never been set up for this business, the client still gets the
// report and simply does not see that section.
const FN_AIVIS = 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-aivis';
// Google Business Profile engagement, same deal: its own function, validating
// the SAME share token server-side and always returning the client lens.
const FN_GBP = 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-gbpperf';
const FN_OPPS = 'https://dkecnwmzlvwbhnnfompn.supabase.co/functions/v1/seo-opps';
const token = new URLSearchParams(location.search).get('t') || '';

function Shell({ children }) {
  return html`<div class="min-h-[60vh] flex items-center justify-center p-4">
    <div class="w-full max-w-md text-center bg-white rounded-2xl border border-slate-200 shadow-sm p-8">${children}</div>
  </div>`;
}

function Page() {
  const [state, setState] = useState({ phase: 'loading' });
  useEffect(() => { ensureVizCss(); }, []);
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!token || token.length < 20) { setState({ phase: 'error', msg: 'This link is not valid. Ask your account manager for a new one.' }); return; }
      try {
        const r = await fetch(FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'public', token }),
        });
        const j = await r.json().catch(() => ({}));
        if (dead) return;
        if (!r.ok || j.error) { setState({ phase: 'error', msg: j.error || 'This report could not be loaded.' }); return; }
        setState({ phase: 'ok', data: j });
        if (j.business?.name) document.title = `${j.business.name} — marketing report`;

        // Then the two side sections, in parallel and never awaited before the
        // report is on screen. Each fills in if and when it lands; neither can
        // delay, blank, or break the report if it is slow or throttled.
        const side = async (url, key) => {
          try {
            const r2 = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'public', token }),
            });
            const j2 = await r2.json().catch(() => ({}));
            if (!dead && r2.ok && j2?.section?.configured) setState((s) => ({ ...s, [key]: j2.section }));
          } catch (_) { /* the report stands on its own without it */ }
        };
        side(FN_AIVIS, 'aivis');
        side(FN_GBP, 'gbp');
        side(FN_OPPS, 'opps');
      } catch (_) {
        if (!dead) setState({ phase: 'error', msg: 'Could not reach the report. Check your connection and try again.' });
      }
    })();
    return () => { dead = true; };
  }, []);

  if (state.phase === 'loading') return html`<${Shell}><div class="text-slate-400 text-sm py-6">Loading your report…</div></${Shell}>`;
  if (state.phase === 'error') {
    return html`<${Shell}>
      <div class="text-4xl mb-3">🔒</div>
      <div class="font-semibold text-slate-800">Report unavailable</div>
      <p class="text-sm text-slate-500 mt-1">${state.msg}</p>
    </${Shell}>`;
  }
  return html`<${ReportBody} data=${state.data} aivis=${state.aivis} gbp=${state.gbp} opps=${state.opps} />`;
}

render(html`<${Page} />`, document.getElementById('app'));
