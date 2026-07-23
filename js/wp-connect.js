// ---------------------------------------------------------------------------
// wp-connect.js — self-contained WordPress connection panel (Ops Dash
// Connector pairing). Lives on the Business Profile; the Keywords tab only
// consumes the connection for publishing.
// Hard-won UX rules (lotpatrols saga — keep them):
//  • the pairing code renders from pair_start's OWN response, never gated on
//    a status round-trip (status calls the WP site, which hangs while unpaired)
//  • the poll has an inflight guard and NEVER clears the code on a slow tick
//  • ↻ Check gives visible green/red feedback; Copy shows the copied tail
// ---------------------------------------------------------------------------
import { html, useState, useEffect } from './lib.js';
import { seoWpStatus, seoWpPairStart, seoWpConnect, seoWpDisconnect } from './store.js';
import { Card, Btn, Input } from './ui.js';

const Pill = ({ cls, children }) => html`<span class=${'text-[11px] px-2 py-0.5 rounded-full ' + cls}>${children}</span>`;

export function WordPressConnect({ site, domain }) {
  const [wp, setWp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const prefill = () => wp?.wp_url || (domain ? 'https://' + domain : '');
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState('');

  const loadWp = async (sid) => { try { setWp(await seoWpStatus(sid)); } catch (_) { setWp(null); } };
  useEffect(() => { setWp(null); setNotice(''); setError(''); if (site) loadWp(site); }, [site]);
  useEffect(() => { setUrl(prefill()); }, [wp?.wp_url, domain]);

  // Explicit check with visible feedback — a silent recheck reads as "nothing happened".
  const recheck = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const s = await seoWpStatus(site);
      setWp(s);
      if (s?.live) setNotice(`Connected ✓ — plugin v${s.info?.plugin_version || '?'} on ${s.info?.site_name || s.wp_url}`);
      else if (s?.connected) setError(s.error || 'The site did not answer with this connection key yet — re-copy the key below and re-paste it in WP Admin → Settings → Ops Dash.');
      else setError('Not connected yet — enter the site URL and click Connect.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  // Start pairing: mint a short code, show it, wait for the plugin to claim it.
  const pair = async (u) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await seoWpPairStart(site, u);
      // Show the code IMMEDIATELY from the pair_start response — never gate on status.
      setWp((prev) => ({ ...(prev || {}), connected: true, live: false, pair_code: r.code, pair_expires: r.expires }));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  // While a code is outstanding, poll every 5s so the card goes green by itself.
  useEffect(() => {
    const code = wp?.pair_code;
    if (!code || wp?.live) return;
    const until = wp?.pair_expires ? new Date(wp.pair_expires).getTime() : 0;
    let inflight = false;
    const iv = setInterval(async () => {
      if (inflight) return;
      if (until && Date.now() > until) { clearInterval(iv); return; }
      inflight = true;
      try {
        const s = await seoWpStatus(site);
        setWp((prev) => ({ ...s, pair_code: s?.pair_code ?? prev?.pair_code, pair_expires: s?.pair_expires ?? prev?.pair_expires }));
        if (s?.live) { clearInterval(iv); setError(''); setNotice(`Connected ✓ — ${s.info?.site_name || s.wp_url} (plugin v${s.info?.plugin_version || '?'})`); }
      } catch (_) { /* keep polling */ } finally { inflight = false; }
    }, 5000);
    return () => clearInterval(iv);
  }, [wp?.pair_code, wp?.live, site]);
  const disconnect = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await seoWpDisconnect(site); setWp({ connected: false }); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  // Rotate a leaked/stale key: reconnecting mints a fresh token instantly.
  const rotate = async () => {
    const u = wp?.wp_url;
    if (!u) return;
    if (!confirm('Regenerate the connection key?\n\nThe current key stops working immediately. Publishing stays broken until you paste the new key into WP Admin → Settings → Ops Dash.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await seoWpDisconnect(site);
      await seoWpConnect(site, u);
      await loadWp(site);
      setNotice('New key generated — the old one is dead. Copy it below into WP Admin → Settings → Ops Dash → Save, then hit ↻.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const copy = async () => { try { const t = wp.token; await navigator.clipboard.writeText(t); setCopied('…' + t.slice(-4)); setTimeout(() => setCopied(''), 2500); } catch (_) { /* ignore */ } };

  return html`<${Card}><div class="p-4 space-y-3">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div class="font-semibold text-slate-800">🔌 WordPress <span class="text-xs font-normal text-slate-400">— publishing & site fixes</span></div>
        <div class="text-xs text-slate-500">Connect the client's WordPress site once — blog publishing, robots/sitemap/llms.txt fixes, and SEO metadata pushes all use this connection.</div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${wp?.connected && html`<${Pill} cls=${wp.live ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>${wp.live ? '● Connected' : '● Plugin not reachable'}</${Pill}>`}
        ${wp?.info?.seo_plugin && html`<${Pill} cls="bg-slate-100 text-slate-600">SEO plugin: ${wp.info.seo_plugin}</${Pill}>`}
        ${wp?.info?.plugin_version && html`<${Pill} cls="bg-slate-100 text-slate-600">v${wp.info.plugin_version}</${Pill}>`}
        <${Btn} size="sm" onClick=${recheck} disabled=${busy}>${busy ? 'Checking…' : '↻ Check connection'}</${Btn}>
        ${wp?.connected && html`<${Btn} size="sm" onClick=${disconnect} disabled=${busy}>Disconnect</${Btn}>`}
      </div>
    </div>
    <div class="flex gap-2 items-center flex-wrap">
      <div class="w-72"><${Input} value=${url} onInput=${setUrl} placeholder="https://clientsite.com" /></div>
      <${Btn} size="sm" onClick=${() => pair(url)} disabled=${busy || !url.trim()}>${busy ? '…' : wp?.live ? '🔗 Re-pair' : wp?.pair_code ? '🔗 New code' : '🔗 Connect'}</${Btn}>
      <a href="/opsdash-connector-1.7.3.zip" download class="text-xs text-brand-700 underline">Download the Ops Dash Connector plugin v1.7.3 (.zip)</a>
    </div>
    ${!wp?.connected && url && html`<div class="text-[11px] text-slate-400 -mt-1">URL pre-filled from this site's Search Console connection — change it only if WordPress lives at a different address.</div>`}

    ${wp?.pair_code && !wp?.live && html`<div class="rounded-lg border-2 border-brand-200 bg-brand-50 p-4 space-y-2">
      <div class="text-xs font-semibold text-brand-700 uppercase">Pairing code — enter it on the WordPress site</div>
      <div class="text-3xl font-bold tracking-widest text-slate-800 tabular-nums select-all">${String(wp.pair_code).slice(0, 4)}-${String(wp.pair_code).slice(4)}</div>
      <ol class="list-decimal ml-5 text-xs text-slate-600 space-y-0.5">
        <li>On the site: install &amp; activate the Connector plugin (v1.7.0+, download link above) if it isn't already.</li>
        <li>WP Admin → Settings → <span class="font-medium">Ops Dash</span> → type this code → <span class="font-medium">Connect to Ops Dash</span>.</li>
      </ol>
      <div class="text-xs text-slate-500 animate-pulse">Waiting for the site… this card connects automatically the moment the code is entered. Code expires in 15 minutes.</div>
    </div>`}

    ${wp?.token && html`<details class="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
      <summary class="cursor-pointer font-semibold text-slate-400 uppercase">Advanced: connection key (manual)</summary>
      <div class="space-y-1.5 mt-2">
        <div class="flex items-center gap-2 flex-wrap">
          <code class="px-2 py-1 bg-white border border-slate-200 rounded break-all">${wp.token}</code>
          <${Btn} size="sm" onClick=${copy} disabled=${busy}>${copied ? `Copied ✓ ${copied}` : 'Copy'}</${Btn}>
          <${Btn} size="sm" onClick=${rotate} disabled=${busy}>🔄 Regenerate</${Btn}>
        </div>
        <div>Only needed on plugin versions older than 1.7.0, or when a pairing code can't be used: paste this key in WP Admin → Settings → Ops Dash → <span class="font-medium">Advanced</span>, Save, then click <span class="font-medium">↻ Check connection</span>.</div>
        ${wp.error && html`<div class="text-amber-700">${wp.error}</div>`}
      </div>
    </details>`}
    ${notice && html`<div class="text-sm text-emerald-700">${notice}</div>`}
    ${error && html`<div class="text-sm text-rose-600">${error}</div>`}
  </div></${Card}>`;
}
