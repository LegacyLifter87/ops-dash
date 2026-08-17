// ---------------------------------------------------------------------------
// report-gbp.js — the GOOGLE BUSINESS PROFILE ENGAGEMENT section.
//
// Section 2 of the Reporting v2 redirect. For a local service business the
// profile is usually the highest-intent surface they own: somebody who taps
// "call" from a map result is not browsing. So this section leads with ACTIONS
// TAKEN, not impressions — impressions are the denominator, not the win.
//
// Fed by seo-gbpperf (its own function, fetched in parallel like AI
// visibility), so a Google quota stall or an unconnected profile costs the
// report this section and nothing else.
//
// THE HONESTY CONTRACT
//   1. Whole months only, on both sides of every comparison. The running month
//      and any ragged first month of collection are on the trend line, marked,
//      but are never the "this month" or "last month" figure. The function
//      decides that; this file renders the decision and states it in the sub.
//   2. Every number here is a count Google published for this profile — the
//      section is 'measured' end to end. Nothing is modelled, so nothing may
//      wear an "estimated" chip and nothing may be presented as more precise
//      than a count.
//   3. NULL is not zero. A metric Google never reported for a profile (many
//      have no bookings or messaging) is absent from the mix entirely rather
//      than drawn as a flat zero line, which would read as "we tried and got
//      nothing" instead of "this does not exist here".
//   4. A suppressed search term is a CEILING. Google says "fewer than 15" and
//      declines to give a number; those terms are listed separately as upper
//      bounds and never counted, ranked, or summed with the measured ones.
//   5. Impressions are split by DEVICE and SURFACE because that is what the
//      Performance API reports. The old direct / discovery / branded split
//      died with the v4 Insights API — every tool still showing it is showing
//      an estimate, and we say what we were actually given.
//
// COLOR (validated palette, zero new hues)
// Impressions and actions are two measures of one funnel, so they are one hue
// in two shades (--s1-lo -> --s1-hi), the same before/after form the ledger
// and the wins section already use. Surface and device splits reuse the same
// two shades and are ALWAYS direct-labelled, never legend-only. Direction of
// travel uses the reserved --good/--neg tokens and always ships with an arrow
// glyph and a number, so the meaning survives without color.
// ---------------------------------------------------------------------------
import { html, useState, cx } from './lib.js';
import { count, pct, Est, SectionHead, CountUp, useInView } from './report-view.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (iso, { year = false } = {}) => {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return `${MON[Number(m) - 1]}${year ? ` ${y}` : ''}`;
};
const monthLong = (iso) => (iso ? `${MON[Number(iso.split('-')[1]) - 1]} ${iso.split('-')[0]}` : '');

// Direction chip. Arrow + number always, so color is reinforcement and never
// the only carrier of meaning.
function Move({ pct: p, delta: d, invert = false, suffix = '' }) {
  if (p == null && d == null) return null;
  const v = p != null ? p : d;
  const flat = v === 0;
  const up = v > 0;
  const good = invert ? !up : up;
  const tone = flat ? 'var(--muted)' : good ? 'var(--good)' : 'var(--neg)';
  const glyph = flat ? '→' : up ? '▲' : '▼';
  const text = p != null ? `${Math.abs(p * 100).toFixed(0)}%` : `${Math.abs(d)}`;
  return html`<span class="inline-flex items-center gap-1 text-[12px] font-semibold tnum" style=${`color:${tone}`}>
    <span aria-hidden="true">${glyph}</span>${flat ? 'no change' : text + suffix}
  </span>`;
}

// ── the funnel trend ───────────────────────────────────────────────────────
// Impressions as a filled area (the reach), actions as a line on its own
// scale (the result). Two shades of one hue, both direct-labelled. Partial
// months are drawn hollow so an incomplete bar can never be mistaken for a
// drop — the single most common way a monthly chart lies.
function FunnelTrend({ months }) {
  const [ref, anim, seen] = useInView();
  const rows = (months || []).slice(-13);
  if (rows.length < 2) return null;

  // Month labels live in HTML BELOW the svg, not inside it. Text inside a
  // scaled viewBox scales with it, so the same 10px label that reads fine on a
  // desktop card collapses to about 5px on a phone — the chart was legible and
  // its axis was not. HTML text ignores the viewBox entirely and stays at one
  // size everywhere, which also keeps the whole trend visible on a phone
  // instead of forcing a horizontal scroll to read the axis.
  const W = 720; const H = 150; const PADX = 8; const PADT = 14; const PADB = 10;
  const maxImp = Math.max(...rows.map((r) => r.impressions.total), 1);
  const maxAct = Math.max(...rows.map((r) => r.actionsTotal), 1);
  const x = (i) => PADX + (i * (W - PADX * 2)) / Math.max(rows.length - 1, 1);
  const yImp = (v) => PADT + (1 - v / maxImp) * (H - PADT - PADB);
  const yAct = (v) => PADT + (1 - v / maxAct) * (H - PADT - PADB);

  const impLine = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yImp(r.impressions.total).toFixed(1)}`).join(' ');
  const impArea = `${impLine} L${x(rows.length - 1).toFixed(1)},${H - PADB} L${x(0).toFixed(1)},${H - PADB} Z`;
  const actLine = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yAct(r.actionsTotal).toFixed(1)}`).join(' ');

  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 sm:p-4', anim)} style="border-color:var(--grid)">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
        <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">
          Reach and result, month by month
        </div>
        <div class="flex items-center gap-3 text-[11px]" style="color:var(--ink2)">
          <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:var(--s1-lo)"></span>Times shown</span>
          <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:var(--s1-hi)"></span>Actions taken</span>
        </div>
      </div>
      <svg viewBox=${`0 0 ${W} ${H}`} class="w-full block" style="height:150px" preserveAspectRatio="none" role="img"
           aria-label=${`Profile impressions and actions across ${rows.length} months`}>
        <path d=${impArea} fill="var(--s1-lo)" opacity="0.16" />
        <path d=${impLine} fill="none" stroke="var(--s1-lo)" stroke-width="2" vector-effect="non-scaling-stroke"
              stroke-linejoin="round" stroke-linecap="round" class=${seen ? 'draw' : ''} style="--len:900" />
        <path d=${actLine} fill="none" stroke="var(--s1-hi)" stroke-width="2.5" vector-effect="non-scaling-stroke"
              stroke-linejoin="round" stroke-linecap="round" class=${seen ? 'draw' : ''} style="--len:900" />
      </svg>
      <!-- Points and labels in HTML, positioned on the same even spacing the
           svg uses, so neither the dot nor its month distorts with the box. -->
      <div class="relative flex items-start justify-between mt-1">
        ${rows.map((r) => html`
          <div class="flex flex-col items-center gap-1 min-w-0 flex-1">
            <span class="h-2.5 w-2.5 rounded-full"
                  style=${r.complete
                    ? 'background:var(--s1-hi)'
                    : 'background:transparent;box-shadow:inset 0 0 0 1.5px var(--s1-hi)'}></span>
            <span class="text-[10.5px] leading-none"
                  style=${`color:${r.complete ? 'var(--muted)' : 'var(--s4)'}`}>${monthLabel(r.month)}</span>
          </div>`)}
      </div>
      ${rows.some((r) => !r.complete) && html`
        <div class="text-[11px] mt-1" style="color:var(--muted)">
          Hollow points are part-months — still filling, or the month collection began. They are shown for shape only and are never used in a comparison.
        </div>`}
    </div>`;
}

// ── where people saw the profile ───────────────────────────────────────────
// A single stacked bar per split, direct-labelled on both ends. Two segments
// is exactly the case where a pie is worst and a bar is unambiguous.
function Split({ label, a, b, aLabel, bLabel, note }) {
  const total = (a || 0) + (b || 0);
  if (!total) return null;
  const aPct = a / total;
  return html`
    <div>
      <div class="flex items-baseline justify-between gap-3 mb-1.5">
        <span class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">${label}</span>
        ${note && html`<span class="text-[11px]" style="color:var(--muted)">${note}</span>`}
      </div>
      <div class="flex h-7 rounded-lg overflow-hidden" style="background:var(--grid)">
        <div class="grow" style=${`width:${(aPct * 100).toFixed(1)}%;background:var(--s1-hi)`}></div>
        <div class="grow" style=${`width:${((1 - aPct) * 100).toFixed(1)}%;background:var(--s1-lo)`}></div>
      </div>
      <div class="flex items-baseline justify-between gap-3 mt-1.5 text-[12px]">
        <span style="color:var(--ink)"><span class="font-semibold tnum">${pct(aPct, 0)}</span> ${aLabel}</span>
        <span style="color:var(--ink2)">${bLabel} <span class="font-semibold tnum">${pct(1 - aPct, 0)}</span></span>
      </div>
    </div>`;
}

// ── what people actually did ───────────────────────────────────────────────
function ActionMix({ mix, current, prev }) {
  if (!mix?.length) return null;
  const max = Math.max(...mix.map((m) => m.value || 0), 1);
  return html`
    <div>
      <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">
        What people did, ${monthLong(current?.month)}${prev ? ` vs ${monthLabel(prev.month)}` : ''}
      </div>
      <div class="space-y-2.5">
        ${mix.map((m) => html`
          <div>
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span style="color:var(--ink)" title=${m.hint}>${m.label}</span>
              <span class="flex items-baseline gap-2">
                <span class="font-semibold tnum" style="color:var(--ink)">${count(m.value)}</span>
                <${Move} pct=${m.deltaPct} delta=${m.deltaPct == null ? m.delta : null} />
              </span>
            </div>
            <div class="h-2 rounded-full mt-1" style="background:var(--grid)">
              <div class="h-2 rounded-full grow" style=${`width:${((m.value / max) * 100).toFixed(1)}%;background:var(--s1)`}></div>
            </div>
          </div>`)}
      </div>
    </div>`;
}

// ── the words customers typed ──────────────────────────────────────────────
function TermList({ title, rows, tone = 'var(--s1)', showDelta }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => r.now_imp || 0), 1);
  return html`
    <div>
      <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">${title}</div>
      <div class="space-y-2">
        ${rows.map((r) => html`
          <div>
            <div class="flex items-baseline justify-between gap-3 text-[13px]">
              <span class="truncate" style="color:var(--ink)" title=${r.keyword}>${r.keyword}</span>
              <span class="flex items-baseline gap-2 shrink-0">
                <span class="font-semibold tnum" style="color:var(--ink)">${count(r.now_imp)}</span>
                ${showDelta && r.prev_imp != null && html`<${Move} delta=${r.delta} />`}
              </span>
            </div>
            <div class="h-1.5 rounded-full mt-1" style="background:var(--grid)">
              <div class="h-1.5 rounded-full grow" style=${`width:${(((r.now_imp || 0) / max) * 100).toFixed(1)}%;background:${tone}`}></div>
            </div>
          </div>`)}
      </div>
    </div>`;
}

function SearchTerms({ terms }) {
  const [showUnder, setShowUnder] = useState(false);
  if (!terms) return null;
  const hasCounted = terms.counted > 0;
  const under = terms.under || [];

  return html`
    <div class="rounded-xl border p-3 sm:p-4 space-y-4" style="border-color:var(--grid)">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div class="text-sm font-semibold" style="color:var(--ink)">
          What people searched before they found the profile
        </div>
        <div class="text-[11px]" style="color:var(--muted)">
          ${monthLong(terms.month)}${terms.prevMonth ? ` vs ${monthLabel(terms.prevMonth)}` : ''}
        </div>
      </div>

      ${hasCounted
        ? html`
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <${TermList} title="Most-searched terms" rows=${terms.top} />
            ${(terms.rising?.length || terms.fresh?.length) ? html`
              <div class="space-y-4">
                <${TermList} title="Searched more than last month" rows=${terms.rising} tone="var(--s1-hi)" showDelta />
                <${TermList} title="New this month" rows=${terms.fresh} tone="var(--s1-hi)" />
              </div>` : null}
          </div>`
        : html`
          <div class="text-[13px]" style="color:var(--ink2)">
            Google published no counted search terms for this profile in ${monthLong(terms.month)} — at this search
            volume it reports every term as a range instead of a number.
          </div>`}

      ${under.length > 0 && html`
        <div class="pt-1">
          <button type="button" onClick=${() => setShowUnder((v) => !v)}
            class="text-[12px] font-semibold inline-flex items-center gap-1.5"
            style="color:var(--brand-ink)" aria-expanded=${showUnder ? 'true' : 'false'}>
            <span aria-hidden="true">${showUnder ? '▾' : '▸'}</span>
            ${under.length} term${under.length === 1 ? '' : 's'} Google would only give a range for
          </button>
          ${showUnder && html`
            <div class="mt-2 space-y-1.5">
              ${under.map((u) => html`
                <div class="flex items-baseline justify-between gap-3 text-[13px]">
                  <span class="truncate" style="color:var(--ink2)" title=${u.keyword}>${u.keyword}</span>
                  <span class="shrink-0 tnum" style="color:var(--muted)">under ${count(u.ceiling)}</span>
                </div>`)}
              <div class="text-[11px] pt-1" style="color:var(--muted)">
                Google withholds exact counts for low-volume terms. These are upper limits, not measurements,
                so they are listed on their own and left out of every total and ranking above.
              </div>
            </div>`}
        </div>`}
    </div>`;
}

// ── the section ────────────────────────────────────────────────────────────
export function GbpEngagement({ gbp, business }) {
  const [ref, anim, seen] = useInView();
  if (!gbp) return null;

  // Never scaffold an empty section. A business with no profile connected, or
  // none collected yet, simply does not have this part of the report.
  if (!gbp.configured) return null;

  const h = gbp.headline;
  const cov = gbp.coverage || {};
  const cur = gbp.current;
  const prev = gbp.prev;

  // Collected, but not yet a single complete month. Show the shape and say so
  // rather than inventing a "this month" out of a fortnight.
  if (!h || !cur) {
    return html`
      <section class="space-y-4">
        <${SectionHead} eyebrow="Google Business Profile" title="What the profile is doing"
          sub="Collecting — the first complete month has not finished yet." />
        <${FunnelTrend} months=${gbp.months} />
      </section>`;
  }

  const sub = prev
    ? `${monthLong(cur.month)} against ${monthLong(prev.month)}. Complete months only — the month in progress is never compared.`
    : `${monthLong(cur.month)} — the first complete month of profile history.`;

  return html`
    <section class="space-y-4">
      <${SectionHead} eyebrow="Google Business Profile" title="What the profile is doing" sub=${sub}
        right=${gbp.location?.title ? html`<span class="text-[11px]" style="color:var(--muted)">${gbp.location.title}</span>` : null} />

      <!-- Lead: actions taken. Impressions are the denominator, not the win. -->
      <div ref=${ref} class=${cx('rounded-xl border p-4 sm:p-5', anim)}
           style="border-color:var(--grid);background:var(--brand-wash)">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 items-center">
          <div class="sm:col-span-1">
            <div class="text-[11px] font-semibold uppercase tracking-widest" style="color:var(--muted)">
              Actions from the profile
            </div>
            <div class="rise text-4xl sm:text-5xl font-extrabold tracking-tight leading-none mt-1" style="color:var(--brand-ink)">
              <${CountUp} value=${h.actions} fmt=${(v) => count(v)} run=${seen} ms=${1100} />
            </div>
            <div class="flex items-center gap-2 mt-1.5">
              <${Move} pct=${h.deltaPct} delta=${h.deltaPct == null ? h.delta : null} />
              ${prev && html`<span class="text-[11px]" style="color:var(--muted)">vs ${monthLabel(prev.month)}</span>`}
              <${Est} basis="measured" />
            </div>
          </div>
          <div class="sm:col-span-2 grid grid-cols-2 gap-4">
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">Times the profile was shown</div>
              <div class="text-2xl font-bold tnum mt-0.5" style="color:var(--ink)">${count(h.impressions)}</div>
              <div class="mt-0.5"><${Move} pct=${h.impressionsDeltaPct} /></div>
            </div>
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">Turned into an action</div>
              <div class="text-2xl font-bold tnum mt-0.5" style="color:var(--ink)">${pct(h.actionRate, 1)}</div>
              <div class="text-[11px] mt-0.5" style="color:var(--muted)">
                ${h.actionRatePrev != null ? `was ${pct(h.actionRatePrev, 1)} in ${monthLabel(prev?.month)}` : 'no prior month yet'}
              </div>
            </div>
          </div>
        </div>
        ${h.yoyPct != null && html`
          <div class="text-[12px] mt-3 pt-3 border-t" style="border-color:var(--grid);color:var(--ink2)">
            A year ago this month the profile drove ${count(gbp.yearAgo?.actionsTotal)} actions —
            <span class="font-semibold" style="color:var(--ink)">${h.yoyPct > 0 ? 'up' : 'down'} ${pct(Math.abs(h.yoyPct), 0)}</span> year over year.
          </div>`}
      </div>

      <${FunnelTrend} months=${gbp.months} />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-xl border p-3 sm:p-4 space-y-5" style="border-color:var(--grid)">
          <${Split} label="Where it was shown" a=${cur.impressions.maps} b=${cur.impressions.search}
            aLabel="on Google Maps" bLabel="in Search results" />
          <${Split} label="On what device" a=${cur.impressions.mobile} b=${cur.impressions.desktop}
            aLabel="on a phone" bLabel="on desktop" />
          <div class="text-[11px]" style="color:var(--muted)">
            Google reports profile views by device and surface. It no longer publishes the older
            direct / discovery / branded split to anyone, so no tool can show it as measured.
          </div>
        </div>
        <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid)">
          <${ActionMix} mix=${gbp.mix} current=${cur} prev=${prev} />
        </div>
      </div>

      <${SearchTerms} terms=${gbp.terms} />

      <!-- Method, in the client's words. -->
      <div class="text-[11px] leading-relaxed" style="color:var(--muted)">
        Measured by Google for ${business?.name || 'this business'}${gbp.location?.title && gbp.location.title !== business?.name ? ` (${gbp.location.title})` : ''}.
        ${cov.firstDay && cov.lastDay ? ` Daily figures held from ${cov.firstDay} to ${cov.lastDay}.` : ''}
        ${' '}Google publishes profile data a few days in arrears and revises recent days, so the last few days of any
        month settle after the fact. Comparisons use complete months on both sides.
      </div>
    </section>`;
}
