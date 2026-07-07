// ---------------------------------------------------------------------------
// competitors.js — Competitor Intelligence: discover organic competitors, then
// the keyword gap (what they rank for that you don't) and content-gap themes.
// Powered by DataForSEO Labs via the seo-competitors function.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useMemo, cx } from './lib.js';
import { useStore, getActiveAccountId, seoLoadSites, seoLoadCompetitors, seoLoadGap, seoCompetitorsDiscover, seoCompetitorGap, seoAddCompetitor } from './store.js';
import { Card, Btn, Select, Input } from './ui.js';
import { useSort, SortTh } from './sortable.js';

const num = (n) => (n || 0).toLocaleString();
const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const short = (u) => { try { const x = new URL(u.startsWith('http') ? u : 'https://' + u); return x.pathname === '/' ? '' : x.pathname; } catch { return u; } };
const STOP = new Set('a,an,the,for,to,of,in,on,at,my,your,you,is,are,how,do,near,me,best,top,cost,price,vs,and,or,with,what,why,service,services,company,near,and'.split(','));

export function Competitors() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [sites, setSites] = useState(null);
  const [site, setSite] = useState('');
  const [comps, setComps] = useState([]);
  const [active, setActive] = useState('');
  const [gap, setGap] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [manual, setManual] = useState('');
  const sort = useSort('volume', 'desc');

  useEffect(() => { if (accountId) seoLoadSites().then((s) => { setSites(s); setSite(s[0]?.id || ''); }); }, [accountId]);
  const loadComps = async (sid) => setComps(await seoLoadCompetitors(sid));
  useEffect(() => { if (site) { loadComps(site); setActive(''); setGap([]); } else setComps([]); }, [site]);
  useEffect(() => { if (site && active) seoLoadGap(site, active).then(setGap); else setGap([]); }, [active, site]);

  const discover = async () => { setBusy('discover'); setErr(''); setBanner(''); try { const r = await seoCompetitorsDiscover(site); setBanner(`Found ${num(r.found)} competitor(s).`); await loadComps(site); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const addManual = async () => { if (!manual.trim()) return; setBusy('add'); setErr(''); try { const r = await seoAddCompetitor(site, manual); setManual(''); await loadComps(site); if (r.competitor) setActive(r.competitor.competitor_domain); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const runGap = async (domain) => { setActive(domain); setBusy('gap:' + domain); setErr(''); try { const r = await seoCompetitorGap(site, domain); setBanner(`${num(r.missing)} keywords they rank for that you don't, ${num(r.gap - r.missing)} where you're weaker.`); setGap(await seoLoadGap(site, domain)); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  const themes = useMemo(() => {
    const bf = new Map();
    for (const g of gap) {
      const core = g.keyword.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
      for (let i = 0; i < core.length - 1; i++) { const bg = core[i] + ' ' + core[i + 1]; let e = bf.get(bg); if (!e) { e = { theme: bg, count: 0, volume: 0 }; bf.set(bg, e); } e.count++; e.volume += g.volume; }
    }
    return [...bf.values()].filter((t) => t.count >= 2).sort((a, b) => b.volume - a.volume).slice(0, 10);
  }, [gap]);

  const stats = useMemo(() => ({ total: gap.length, missing: gap.filter((g) => g.gap_type === 'missing').length, volume: gap.reduce((s, g) => s + g.volume, 0) }), [gap]);

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (sites === null) return html`<div class="p-8 text-sm text-slate-400">Loading competitors…</div>`;

  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Competitor Intelligence</h1>
        <p class="text-sm text-slate-500">Who outranks you, and exactly which keywords &amp; topics they win that you don't.</p>
      </div>
      <div class="flex items-center gap-2">
        ${sites.length > 1 && html`<${Select} value=${site} onChange=${setSite} options=${sites.map((s) => ({ value: s.id, label: s.display_name || s.domain }))} />`}
        ${site && html`<${Btn} onClick=${discover} disabled=${busy === 'discover'}>${busy === 'discover' ? 'Finding…' : 'Find competitors'}</${Btn}>`}
      </div>
    </div>
    ${banner && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-emerald-50 text-emerald-700 flex justify-between"><span>${banner}</span><button onClick=${() => setBanner('')} class="opacity-60">✕</button></div>`}
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

    ${sites.length === 0
      ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Connect Search Console and add a site in the <span class="font-medium">SEO</span> tab first.</div></${Card}>`
      : html`
        <div class="grid lg:grid-cols-3 gap-4">
          <div class="lg:col-span-1 space-y-3">
            <${Card}><div class="p-3">
              <div class="font-semibold text-slate-800 mb-2">Competitors</div>
              <div class="flex gap-2 mb-3">
                <${Input} value=${manual} onInput=${setManual} placeholder="add a domain…" class="flex-1" />
                <${Btn} size="sm" onClick=${addManual} disabled=${busy === 'add'}>Add</${Btn}>
              </div>
              ${comps.length === 0
                ? html`<div class="text-sm text-slate-400 py-4 text-center">No competitors yet. Click <span class="font-medium">Find competitors</span> or add one above.</div>`
                : html`<div class="space-y-1">${comps.map((c) => html`<button onClick=${() => runGap(c.competitor_domain)}
                    class=${cx('w-full text-left px-2.5 py-2 rounded-lg border transition', active === c.competitor_domain ? 'border-brand-300 bg-brand-50' : 'border-slate-100 hover:border-slate-200')}>
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-medium text-slate-800 truncate">${c.competitor_domain}</span>
                      ${busy === 'gap:' + c.competitor_domain ? html`<span class="text-xs text-slate-400">analyzing…</span>` : c.source === 'manual' ? html`<span class="text-[10px] text-slate-400">manual</span>` : ''}
                    </div>
                    <div class="text-xs text-slate-500">${num(c.common_keywords)} shared kw · ${c.etv ? money(c.etv) + ' est. traffic' : ''}</div>
                  </button>`)}</div>`}
            </div></${Card}>
          </div>

          <div class="lg:col-span-2 space-y-4">
            ${!active
              ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">Select a competitor to see the keyword &amp; content gap — what they rank for that you don't.</div></${Card}>`
              : gap.length === 0 && busy !== 'gap:' + active
                ? html`<${Card}><div class="p-8 text-center text-sm text-slate-500">No gap analyzed yet for <span class="font-medium">${active}</span>. ${busy ? 'Analyzing…' : 'Click the competitor again to analyze.'}</div></${Card}>`
                : html`
                  <div class="grid grid-cols-3 gap-3">
                    ${[['Gap keywords', num(stats.total)], ['Not ranking', num(stats.missing)], ['Total volume/mo', num(stats.volume)]].map(([k, v]) => html`<${Card}><div class="p-3"><div class="text-xs text-slate-400">${k}</div><div class="text-lg font-semibold text-slate-800">${v}</div></div></${Card}>`)}
                  </div>
                  ${themes.length > 0 && html`<${Card}><div class="p-3">
                    <div class="font-semibold text-slate-800 mb-1">Content gap — topics ${active} covers that you're missing</div>
                    <div class="flex flex-wrap gap-2 mt-2">${themes.map((t) => html`<span class="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">${t.theme} <span class="text-slate-400">· ${num(t.volume)}/mo</span></span>`)}</div>
                  </div></${Card}>`}
                  <${Card}><div class="p-3 overflow-x-auto"><table class="w-full text-sm">
                    <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                      <${SortTh} k="keyword" label="Keyword" sort=${sort} /><${SortTh} k="volume" label="Volume" sort=${sort} right=${true} /><${SortTh} k="competitor_position" label="Their pos" sort=${sort} right=${true} /><${SortTh} k="client_position" label="Your pos" sort=${sort} right=${true} /><th class="py-1.5 pr-3">Gap</th></tr></thead>
                    <tbody>${sort.sort(gap).slice(0, 250).map((g) => html`<tr class="border-b border-slate-50">
                      <td class="py-1.5 pr-3 font-medium text-slate-800 max-w-xs truncate">${g.competitor_url ? html`<a href=${g.competitor_url.startsWith('http') ? g.competitor_url : 'https://' + g.competitor_url} target="_blank" rel="noopener" class="hover:text-brand-700" title=${g.competitor_url}>${g.keyword}</a>` : g.keyword}</td>
                      <td class="py-1.5 pr-3 text-right tabular-nums">${num(g.volume)}</td>
                      <td class="py-1.5 pr-3 text-right tabular-nums">${g.competitor_position || '—'}</td>
                      <td class=${cx('py-1.5 pr-3 text-right tabular-nums', g.client_position == null && 'text-slate-300')}>${g.client_position == null ? '—' : g.client_position}</td>
                      <td class="py-1.5 pr-3"><span class=${cx('text-xs font-medium px-2 py-0.5 rounded-full', g.gap_type === 'missing' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>${g.gap_type === 'missing' ? 'not ranking' : 'weaker'}</span></td>
                    </tr>`)}</tbody>
                  </table></div></${Card}>
                `}
          </div>
        </div>
      `}
  </div>`;
}
