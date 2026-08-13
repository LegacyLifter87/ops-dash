// ---------------------------------------------------------------------------
// report-body.js — the composed cross-channel report.
//
// Rendered IDENTICALLY by the in-app Reporting tab and by the public share
// page, so what a client opens from a link is exactly what the agency saw when
// they sent it. The only difference is the lens: `data.view === 'client'`
// arrives already stripped of our costs and margin server-side (seo-report's
// clientLens), so this file never has to be trusted to hide anything — it
// simply renders whatever survived.
// ---------------------------------------------------------------------------
import { html, useEffect, cx } from './lib.js';
import {
  ensureVizCss, brandTokens, money, count, pct,
  MoneyLoop, RankLedger, CtrCurve, Waterfall, Tile, Meter, TrendPanels,
  ReportHeader, ReportFooter, Assumptions, SectionHead, Est, CountUp, useInView,
} from './report-view.js';

// The single number the report leads with. Exactly one per view, ≥48px, in
// the same sans as everything else.
function Hero({ data }) {
  const [ref, anim, seen] = useInView();
  const profit = data.loop?.stages?.find((s) => s.key === 'profit');
  const spend = data.loop?.stages?.find((s) => s.key === 'spend');
  const rev = data.loop?.stages?.find((s) => s.key === 'revenue');
  const lead = profit?.value ? profit : rev;
  if (!lead) return null;
  const isClient = data.view === 'client';
  return html`
    <div ref=${ref} class=${cx('text-center py-5 sm:py-7', anim)}>
      <div class="text-[11px] font-semibold uppercase tracking-widest" style="color:var(--muted)">
        ${lead.key === 'profit' ? 'Gross profit generated' : 'Revenue generated'} · ${data.period?.label}
      </div>
      <div class="rise text-[2.75rem] sm:text-6xl font-extrabold tracking-tight leading-none mt-1" style="color:var(--brand-ink)">
        <${CountUp} value=${lead.value} fmt=${(v) => money(v, { compact: false })} run=${seen} ms=${1200} />
      </div>
      <div class="rise text-sm mt-2 max-w-md mx-auto" style=${'color:var(--ink2);transition-delay:150ms'}>
        ${isClient || !spend?.value
          ? html`from ${count(data.loop?.stages?.find((s) => s.key === 'demand')?.value)} visits and ${count(data.loop?.stages?.find((s) => s.key === 'jobs')?.value)} booked jobs`
          : html`on ${money(spend.value)} of marketing — <span class="font-semibold" style="color:var(--ink)">${data.pnl?.mer ? data.pnl.mer.toFixed(2) + '×' : '—'}</span> back for every $1 in`}
        ${' '}<${Est} basis=${lead.basis} />
      </div>
    </div>`;
}

function ChannelCosts({ pnl }) {
  const rows = (pnl?.channels || []).filter((c) => c.cpj != null);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.cpj));
  // Two channels max here, so categorical slots 1 and 2 — identity, and both
  // are direct-labeled, which is the relief for the light-hue contrast warn.
  const tone = { organic: 'var(--s1)', paid: 'var(--s2)' };
  return html`
    <div>
      <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">Cost per booked job, by channel</div>
      <div class="space-y-2.5">
        ${rows.map((r) => html`
          <div>
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="inline-flex items-center gap-1.5 min-w-0" style="color:var(--ink2)">
                <span class="h-2.5 w-2.5 rounded-full shrink-0" style=${`background:${tone[r.key] || 'var(--s1)'}`}></span>
                <span class="truncate">${r.label}</span>
              </span>
              <span class="tnum font-semibold shrink-0" style="color:var(--ink)">${money(r.cpj)}<span class="font-normal text-xs" style="color:var(--muted)">/job</span></span>
            </div>
            <div class="h-2 mt-1 rounded-full" style="background:#f4f4f2">
              <div class="h-2 rounded-[4px] grow" style=${`width:${Math.max(2, (r.cpj / max) * 100)}%;background:${tone[r.key] || 'var(--s1)'}`}></div>
            </div>
            <div class="text-[11px] mt-0.5" style="color:var(--muted)">${r.jobs < 1 ? '<1' : Math.round(r.jobs)} jobs · ${pct(r.share, 0)} of demand</div>
          </div>`)}
      </div>
    </div>`;
}

function Nudges({ nudges, onAction }) {
  if (!nudges?.length) return null;
  return html`
    <div class="space-y-2">
      ${nudges.map((x) => html`
        <div class="flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs" style="border-color:#fde68a;background:#fffbeb;color:#78350f">
          <span class="shrink-0 leading-none pt-0.5">↗</span>
          <span class="flex-1">${x.text}</span>
          ${x.kind === 'link_jt' && onAction && html`
            <button onClick=${() => onAction('jt')} class="shrink-0 font-semibold underline underline-offset-2 min-h-[2.75rem] lg:min-h-0 px-1 -my-1 flex items-center">Link now</button>`}
          ${x.kind === 'fee' && onAction && html`
            <button onClick=${() => onAction('terms')} class="shrink-0 font-semibold underline underline-offset-2 min-h-[2.75rem] lg:min-h-0 px-1 -my-1 flex items-center">Set it</button>`}
        </div>`)}
    </div>`;
}

export function ReportBody({ data, onAction }) {
  useEffect(() => { ensureVizCss(); }, []);
  const t = brandTokens(data?.business?.brandColor);
  const isClient = data.view === 'client';
  const pnl = data.pnl || {};
  const avgPos = (() => {
    const rows = data.ledger?.rows || [];
    if (!rows.length) return null;
    const w = rows.reduce((a, r) => a + r.volume, 0);
    return w > 0 ? rows.reduce((a, r) => a + r.position * r.volume, 0) / w : null;
  })();

  // Waterfall rows. In the client lens the cost lines never arrived, so the
  // panel becomes an ad-spend return view instead of a contribution margin.
  const waterfall = isClient
    ? [
        { label: 'Revenue booked', value: pnl.revenue || 0, total: true, est: pnl.estimated },
        { label: 'Your ad spend', value: -(pnl.adSpend || 0) },
        { label: 'Revenue after ad spend', value: (pnl.revenue || 0) - (pnl.adSpend || 0), total: true, est: pnl.estimated },
      ]
    : [
        { label: 'Revenue attributed', value: pnl.revenue || 0, total: true, est: pnl.estimated },
        { label: 'Ad spend', value: -(pnl.adSpend || 0) },
        { label: 'Content & production', value: -(pnl.contentCost || 0) },
        { label: 'Agency fee', value: -(pnl.fee || 0), note: pnl.feeSet ? null : 'not set' },
        { label: 'Contribution margin', value: pnl.contribution || 0, total: true, est: pnl.estimated },
      ];

  return html`
    <div class="viz space-y-6 sm:space-y-8"
         style=${`--brand:${t.brand};--brand-ink:${t.brandInk};--brand-wash:${t.brandWash};--on-brand:${t.onBrand}`}>

      <${ReportHeader} business=${data.business} agency=${data.agency}
        period=${data.period} generatedAt=${data.generatedAt} />

      ${!isClient && html`<${Nudges} nudges=${data.nudges} onAction=${onAction} />`}

      <!-- ─────────────────────────── 1. MONEY LOOP ─────────────────────── -->
      <section>
        <${Hero} data=${data} />
        <${SectionHead} eyebrow="The money loop"
          title=${isClient ? 'From search to booked work' : 'Where the money goes, and what comes back'}
          sub=${`Every stage of the journey${isClient ? '' : ' from the first dollar spent'} to profit, with the conversion between each one.`} />
        <${MoneyLoop} loop=${data.loop} />
      </section>

      <!-- ───────────────────── 2. RANK-TO-REVENUE LEDGER ────────────────── -->
      <section>
        <${SectionHead} eyebrow="Rank to revenue"
          title="What each ranking is actually worth"
          sub="Position × searches × click-through × close rate × average ticket. Sorted by the biggest gap between today and #1." />
        ${data.ledger?.totals?.gap > 0 && html`
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <div class="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-3">
              <${Tile} label="Your rankings earn" value=${money(data.ledger.totals.valueNow, { compact: true })}
                sub=${`per month across ${data.ledger.counted} tracked keywords`} basis=${data.ledger.estimated ? 'estimated' : 'derived'} />
              <${Tile} label="Money on the table" value=${money(data.ledger.totals.gap, { compact: true })}
                sub="per month if every one of them reached #1" tone="brand" big
                basis=${data.ledger.estimated ? 'estimated' : 'derived'} />
            </div>
            <div class="lg:col-span-2 rounded-xl border p-3 sm:p-4 bg-white" style="border-color:var(--grid)">
              <div class="text-[11px] font-semibold uppercase tracking-wide mb-1" style="color:var(--muted)">
                Why position matters this much
              </div>
              <${CtrCurve} curve=${data.ledger.ctrCurve} citation=${data.ledger.ctrCitation} markPosition=${avgPos} />
              ${avgPos != null && html`<p class="text-[11px] mt-1.5" style="color:var(--ink2)">
                ${avgPos <= 10
                  // The chart only plots #1–#10; only claim a marker when one is actually drawn.
                  ? html`The marker sits at your volume-weighted average position, <span class="font-semibold tnum">#${avgPos.toFixed(1)}</span>.`
                  : html`Your volume-weighted average position is <span class="font-semibold tnum">#${avgPos.toFixed(1)}</span> — past the end of this chart, where clicks have already flattened to almost nothing.`}
              </p>`}
            </div>
          </div>`}
        <${RankLedger} ledger=${data.ledger} />
      </section>

      <!-- ───────────────────────── 3. MARKETING P&L ─────────────────────── -->
      <section>
        <${SectionHead} eyebrow=${isClient ? 'Return' : 'Marketing P&L'}
          title=${isClient ? 'What the marketing returned' : 'Marketing P&L'}
          sub=${isClient
            ? 'Revenue booked against what you spent on ads.'
            : 'Revenue attributed, less every real cost of producing it — the contribution this business makes.'} />
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
          <div class="lg:col-span-3 rounded-xl border p-3 sm:p-4 bg-white" style="border-color:var(--grid)">
            <${Waterfall} items=${waterfall} />
            ${!isClient && pnl.contentTrackedSince && html`
              <p class="text-[11px] mt-3 pt-2 border-t" style="border-color:var(--grid);color:var(--muted)">
                Content & production is real API spend for this business (AI writing, images and video, map scans),
                tracked since ${new Date(pnl.contentTrackedSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}.
              </p>`}
          </div>
          <div class="lg:col-span-2 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <${Tile} label="MER" value=${pnl.mer ? pnl.mer.toFixed(2) + '×' : '—'}
                sub="revenue per $1 of marketing" basis=${pnl.estimated ? 'estimated' : null} />
              <${Tile} label=${isClient ? 'Cost per job' : 'Blended CAC'} value=${pnl.cac != null ? money(pnl.cac) : '—'}
                sub="all-in, per booked job" basis=${pnl.estimated ? 'estimated' : null} />
              ${!isClient && html`<${Tile} label="Cost per lead" value=${pnl.costPerLead != null ? money(pnl.costPerLead) : '—'}
                sub="all-in, per enquiry" basis="derived" />`}
              ${!isClient && html`<${Tile} label="Payback" value=${pnl.paybackDays != null ? pnl.paybackDays + ' days' : '—'}
                sub="to earn back the period's spend" basis=${pnl.estimated ? 'estimated' : 'derived'} />`}
            </div>
            ${pnl.ltvCac != null && html`
              <div class="rounded-xl border p-3 bg-white" style="border-color:var(--grid)">
                <${Meter} value=${pnl.ltvCac} target=${3} label="LTV : CAC" />
                <p class="text-[11px] mt-2" style="color:var(--muted)">
                  Customer value ${money(pnl.ltv)}${pnl.ltvMultiple > 1 ? ` (${pnl.ltvMultiple}× first job)` : ' (first job only)'} against ${money(pnl.cac)} to win them.
                </p>
              </div>`}
            ${!isClient && html`<div class="rounded-xl border p-3 bg-white" style="border-color:var(--grid)"><${ChannelCosts} pnl=${pnl} /></div>`}
          </div>
        </div>
      </section>

      <!-- ──────────────────────────── 4. TREND ──────────────────────────── -->
      ${(data.trend || []).length > 1 && html`
        <section>
          <${SectionHead} eyebrow="Month by month" title="The direction of travel"
            sub="Each panel keeps its own scale — visits, dollars and revenue don't share an axis." />
          <${TrendPanels} trend=${data.trend} showSpend=${data.sources?.ads && !isClient ? true : data.sources?.ads} showRevenue=${data.measured} />
        </section>`}

      <${Assumptions} economics=${data.economics} notes=${data.notes} measured=${data.measured} />
      <${ReportFooter} agency=${data.agency} />
    </div>`;
}
