// ---------------------------------------------------------------------------
// jt.js — Business Analytics: Job Tracker data pulled into Ops Dash for the
// active account's linked company. Agency links accounts to JT companies;
// everyone on a linked account sees the analytics. All data comes through the
// service-role jt-bridge function (JT RLS is never exposed to the browser).
// ---------------------------------------------------------------------------
import { html, useState, useEffect, cx } from './lib.js';
import { useStore, getActiveAccountId, jtStatus, jtAnalytics, jtListCompanies, jtLink, jtUnlink } from './store.js';
import { Card, Btn, Select, Stat } from './ui.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => `${((n || 0) * 100).toFixed(1)}%`;
const k = (n) => (Math.abs(n) >= 1000 ? '$' + (n / 1000).toFixed(0) + 'k' : money(n));

export function JobTracker() {
  const store = useStore();
  const accountId = getActiveAccountId();
  const [status, setStatus] = useState(null);
  const [data, setData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setStatus(null); setData(null); setErr('');
    try {
      const st = await jtStatus(); setStatus(st);
      if (st.linkedCompanyId) { setData(await jtAnalytics()); }
      else if (st.agency) { const c = await jtListCompanies(); setCompanies(c.companies || []); }
    } catch (e) { setErr(e.message); setStatus({ agency: false }); }
  };
  useEffect(() => { if (accountId) load(); }, [accountId]);

  const link = async () => { if (!pick) return; setBusy('link'); setErr(''); try { await jtLink(pick); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const unlink = async () => { if (!confirm('Unlink this account from its Job Tracker company?')) return; setBusy('unlink'); try { await jtUnlink(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  if (!accountId) return html`<div class="p-8 text-sm text-slate-400">Select or create an account first.</div>`;
  if (!status) return html`<div class="p-8 text-sm text-slate-400">Loading business analytics…</div>`;

  const Head = () => html`<div class="flex items-start justify-between gap-3">
    <div>
      <h1 class="text-xl font-bold text-slate-800">Business Analytics</h1>
      <p class="text-sm text-slate-500">Live from Job Tracker${status.linkedCompanyName ? ` — ${status.linkedCompanyName}` : ''}.</p>
    </div>
    ${status.canManage && status.linkedCompanyId && html`<button onClick=${unlink} class="text-sm text-slate-400 hover:text-rose-600 underline">${busy === 'unlink' ? 'Unlinking…' : 'Unlink'}</button>`}
  </div>`;

  // ---- not linked ----
  if (!status.linkedCompanyId) {
    return html`<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <${Head} />
      ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}
      <${Card}><div class="p-6 text-center space-y-3">
        <div class="text-4xl">🔗</div>
        <div class="font-semibold text-slate-800">Not linked to Job Tracker</div>
        ${status.agency
          ? html`<div class="space-y-3">
              <p class="text-sm text-slate-500 max-w-md mx-auto">Link this Ops Dash account to a Job Tracker company to pull in its revenue, jobs, pipeline, and margins.</p>
              <div class="flex items-center justify-center gap-2">
                <${Select} value=${pick} onChange=${setPick} options=${[{ value: '', label: 'Choose a company…' }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} />
                <${Btn} onClick=${link} disabled=${!pick || busy === 'link'}>${busy === 'link' ? 'Linking…' : 'Link'}</${Btn}>
              </div>
            </div>`
          : html`<p class="text-sm text-slate-500">Ask your agency to link this account to its Job Tracker company.</p>`}
      </div></${Card}>
    </div>`;
  }

  if (!data) return html`<div class="p-8 text-sm text-slate-400">Loading analytics…</div>`;
  if (data.linked === false) return html`<div class="p-8 text-sm text-slate-400">No linked company data.</div>`;

  const h = data.headline, c = data.costs, p = data.pipeline;
  const maxMonth = Math.max(1, ...data.byMonth.map((m) => m.value));
  const costRows = [['Labor', c.labor], ['Subs', c.subs], ['Materials', c.materials], ['Consumables', c.consumables]];
  const maxCost = Math.max(1, ...costRows.map((r) => r[1]));

  return html`<div class="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
    <${Head} />
    ${err && html`<div class="rounded-lg px-4 py-2.5 text-sm bg-rose-50 text-rose-700">${err}</div>`}

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <${Stat} label="Revenue (completed)" value=${money(h.revenue)} />
      <${Stat} label="Gross profit" value=${money(h.gp)} sub=${`${pct(h.margin)} margin`} tone=${h.gp >= 0 ? 'good' : 'bad'} />
      <${Stat} label="Avg job value" value=${money(h.avgJob)} />
      <${Stat} label="Completed jobs" value=${h.completed} sub=${`${h.active} active`} />
      <${Stat} label="Active job value" value=${money(h.activeValue)} />
      <${Stat} label="Pipeline value" value=${money(p.pipelineValue)} sub=${`${p.openLeads} open leads`} />
      <${Stat} label="Win rate" value=${pct(p.winRate)} sub=${`${p.won} won / ${p.lost} lost`} />
      <${Stat} label="Labor hours" value=${Math.round(h.hours).toLocaleString()} sub=${`@ ${money(h.laborRate)}/hr`} />
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      <${Card}><div class="p-4">
        <div class="font-semibold text-slate-800 mb-3">Cost breakdown</div>
        <div class="space-y-2">
          ${costRows.map(([label, val]) => html`<div>
            <div class="flex justify-between text-sm"><span class="text-slate-600">${label}</span><span class="tabular-nums text-slate-800">${money(val)}</span></div>
            <div class="h-1.5 bg-slate-100 rounded"><div class="h-1.5 bg-brand-500 rounded" style=${`width:${(val / maxCost) * 100}%`}></div></div>
          </div>`)}
          <div class="flex justify-between text-sm font-semibold pt-1 border-t border-slate-100"><span>Total cost</span><span class="tabular-nums">${money(c.total)}</span></div>
        </div>
      </div></${Card}>

      <${Card}><div class="p-4">
        <div class="font-semibold text-slate-800 mb-3">Revenue by month</div>
        ${data.byMonth.length === 0 ? html`<div class="text-sm text-slate-400">No completed-job dates.</div>`
          : html`<div class="flex items-end gap-1 h-32">
              ${data.byMonth.map((m) => html`<div class="flex-1 flex flex-col items-center justify-end gap-1" title=${`${m.month}: ${money(m.value)} (${m.count})`}>
                <div class="w-full bg-brand-500 rounded-t" style=${`height:${(m.value / maxMonth) * 100}%`}></div>
                <div class="text-[9px] text-slate-400 rotate-0">${m.month.slice(5)}</div>
              </div>`)}
            </div>`}
      </div></${Card}>
    </div>

    <div class="grid md:grid-cols-3 gap-4">
      ${[['Revenue by lead source', data.bySource, 'Marketing origin of won work'], ['Revenue by job type', data.byType, ''], ['Revenue by salesperson', data.bySellingPm, '']]
        .map(([title, rows, sub]) => html`<${Card}><div class="p-4">
          <div class="font-semibold text-slate-800">${title}</div>
          ${sub && html`<div class="text-xs text-slate-400 mb-2">${sub}</div>`}
          <table class="w-full text-sm mt-2">
            <tbody>${(rows || []).slice(0, 8).map((r) => html`<tr class="border-b border-slate-50">
              <td class="py-1.5 pr-2 text-slate-700 truncate max-w-[9rem]">${r.key}</td>
              <td class="py-1.5 text-right tabular-nums text-slate-500">${r.count}</td>
              <td class="py-1.5 pl-2 text-right tabular-nums font-medium text-slate-800">${k(r.value)}</td>
            </tr>`)}
            ${(rows || []).length === 0 && html`<tr><td class="py-2 text-slate-400 text-center" colspan="3">No data.</td></tr>`}
            </tbody>
          </table>
        </div></${Card}>`)}
    </div>
  </div>`;
}
