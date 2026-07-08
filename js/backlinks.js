// ---------------------------------------------------------------------------
// backlinks.js — Backlink / authority profile for a site (DataForSEO Backlinks).
// Referring domains, total backlinks, domain rank, and top referring domains.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadBacklinks, seoDfsBacklinks } from './store.js';
import { Card, Btn, Select } from './ui.js';

const num = (n) => (n || 0).toLocaleString();

export function Backlinks() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [bl, setBl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  useEffect(() => { if (site) seoLoadBacklinks(site).then(setBl); else setBl(null); }, [site]);

  const analyze = async () => { setBusy(true); setErr(''); try { await seoDfsBacklinks(site); setBl(await seoLoadBacklinks(site)); } catch (e) { setErr(e.message); } finally { setBusy(false); } };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading backlinks…</div>`;

  return html`<div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Backlinks &amp; Authority</h1>
        <p class="text-sm text-slate-500">Your link profile — referring domains, total backlinks, and domain authority (DataForSEO).</p>
      </div>
      <div class="flex items-center gap-2">
        ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
        ${site && html`<${Btn} onClick=${analyze} disabled=${busy}>${busy ? 'Analyzing…' : (bl ? 'Refresh' : 'Analyze backlinks')}</${Btn}>`}
      </div>
    </div>
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : !bl
        ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No backlink data yet. Click <span class="font-medium">Analyze backlinks</span> to pull this site's link profile.</div></${Card}>`
        : html`
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            ${[['Domain rank', bl.rank != null ? bl.rank : '—', '0–1000'], ['Referring domains', num(bl.referring_domains)], ['Total backlinks', num(bl.backlinks)], ['Nofollow domains', num(bl.referring_domains_nofollow)], ['Broken backlinks', num(bl.broken_backlinks)]]
              .map(([k, v, sub]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div>${sub && html`<div class="text-[11px] text-slate-400">${sub}</div>`}</div></${Card}>`)}
          </div>

          <${Card}><div class="p-4">
            <div class="font-semibold text-slate-800 mb-2">Top referring domains</div>
            ${(bl.top_domains || []).length === 0
              ? html`<div class="text-sm text-slate-400">No referring domains found.</div>`
              : html`<table class="w-full text-sm">
                  <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100"><th class="py-1.5 pr-3">Domain</th><th class="py-1.5 pr-3 text-right">Rank</th><th class="py-1.5 pr-3 text-right">Backlinks</th></tr></thead>
                  <tbody>${(bl.top_domains || []).map((d) => html`<tr class="border-b border-slate-50">
                    <td class="py-1.5 pr-3"><a href=${'https://' + d.domain} target="_blank" rel="noopener" class="text-brand-700 hover:underline">${d.domain}</a></td>
                    <td class="py-1.5 pr-3 text-right tabular-nums">${d.rank != null ? d.rank : '—'}</td>
                    <td class="py-1.5 pr-3 text-right tabular-nums">${num(d.backlinks)}</td>
                  </tr>`)}</tbody>
                </table>`}
          </div></${Card}>
          <div class="text-xs text-slate-400">Updated ${bl.updated_at ? new Date(bl.updated_at).toLocaleDateString() : '—'}.</div>
        `}
  </div>`;
}
