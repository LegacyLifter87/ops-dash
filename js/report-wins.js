// ---------------------------------------------------------------------------
// report-wins.js — the WEBSITE WINS section of the client report.
//
// Section 3 of the Reporting v2 redirect. The brief was "trends moving UP", so
// this section leads with what got better, by how much, and what to do next.
// It never opens with a table of everything.
//
// Rendered by both the in-app Reporting tab and the public share page from the
// same `data.wins` payload, so a client link is exactly what the agency saw.
// The payload arrives from seo-report already lens-filtered server-side —
// nothing in this file is trusted to hide anything.
//
// THE HONESTY CONTRACT (the same one the rest of the report signs)
//   1. Every comparison names both periods, and the still-accruing current
//      month is excluded from both sides — the function does that, and the
//      method block at the bottom says so in the client's words.
//   2. Search Console counts are measured. Money attached to a POSITION is
//      estimated (or derived, where the economics are measured), because it
//      runs through the CTR curve and the close rate. Crediting traffic to a
//      specific published page is derived — it is a URL match, not a tag.
//   3. A first period of history is not a set of rises. When there is nothing
//      to compare against, the section says so instead of drawing every number
//      as a gain from zero.
//
// COLOR (per the dataviz method — palette already validated, not eyeballed)
// ZERO new hues. Every "before → after" mark is the ledger's own form: one hue,
// two shades (--s1-lo → --s1-hi), which is the validated answer for
// before/after-per-item and keeps this section visually continuous with the
// rank-to-revenue ledger it sits above. Magnitude bars are single-hue. Status
// (up/down) uses the reserved --good/--neg tokens and never a series slot, and
// always ships with an arrow glyph and a number, never color alone. The
// client's brand is the accent on exactly two marks: the headline figure and
// the "new ground" pill. Position is NEVER plotted on an inverted axis — a
// lower-is-better scale drawn as a chart is a coin-flip for the reader, so
// position movement is stated as labelled text with a direction.
// ---------------------------------------------------------------------------
import { html, useState, cx } from './lib.js';
import { money, count, pct, Tile, Est, SectionHead, CountUp, useInView } from './report-view.js';

// ── small shared pieces ────────────────────────────────────────────────────
// An up/down figure. Arrow + number + color: three encodings, so it survives
// colorblindness, print and a black-and-white PDF.
const Delta = ({ value, fmt = (v) => count(v), zero = 'level', title }) => {
  const v = Number(value) || 0;
  const tone = v > 0 ? 'var(--good)' : v < 0 ? 'var(--neg)' : 'var(--muted)';
  return html`<span class="tnum font-semibold" style=${`color:${tone}`} title=${title}>
    ${v > 0 ? '▲ +' : v < 0 ? '▼ −' : '— '}${v === 0 ? zero : fmt(Math.abs(v))}
  </span>`;
};

// Position movement, as text. Lower is better, so the wording carries the
// direction and the arrow agrees with it.
const PosMove = ({ from, to, gain }) => {
  if (to == null) return null;
  if (from == null || gain == null || Math.abs(gain) < 0.5) {
    return html`<span class="tnum" style="color:var(--muted)">at #${to.toFixed(1)}</span>`;
  }
  const better = gain > 0;
  return html`<span class="tnum" style="color:var(--muted)">
    #${from.toFixed(1)} → <span class="font-semibold" style=${`color:${better ? 'var(--good)' : 'var(--neg)'}`}>#${to.toFixed(1)}</span>
    <span style=${`color:${better ? 'var(--good)' : 'var(--neg)'}`}>${better ? '▲' : '▼'} ${Math.abs(gain).toFixed(1)}</span>
  </span>`;
};

// Before → after, per item. The ledger's dumbbell, reused deliberately: same
// question shape, same form, same two shades of one hue. `max` is shared across
// the list so the rows are comparable with each other.
function Move({ from, to, max, label, brand }) {
  const w = (v) => `${Math.max(0.5, Math.min(100, (Math.max(0, v) / max) * 100))}%`;
  const up = to >= from;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  return html`
    <div class="relative h-4 flex items-center" title=${label} role="img" aria-label=${label}>
      <div class="absolute inset-x-0 h-px" style="background:var(--grid)"></div>
      <div class="absolute h-1 rounded-full grow"
           style=${`left:${w(lo)};width:calc(${w(hi)} - ${w(lo)});background:${up ? 'var(--s1-lo)' : 'var(--neg)'};opacity:${up ? 1 : 0.45}`}></div>
      ${from > 0 && html`<div class="absolute h-2.5 w-2.5 rounded-full dot" style=${`left:calc(${w(from)} - 5px);background:var(--s1-lo)`}></div>`}
      <div class="absolute h-2.5 w-2.5 rounded-full dot"
           style=${`left:calc(${w(to)} - 5px);background:${brand ? 'var(--brand)' : up ? 'var(--s1-hi)' : 'var(--neg)'}`}></div>
    </div>`;
}

// A plain magnitude bar. Used wherever there is no "before" to compare with —
// a first period of history, and the new-ground list.
const Bar = ({ value, max, delay = 0, tone = 'var(--s1)', thick }) => html`
  <div class=${cx('mt-1 rounded-full', thick ? 'h-2.5' : 'h-2')} style="background:#f4f4f2">
    <div class=${cx('rounded-[4px] grow', thick ? 'h-2.5' : 'h-2')}
         style=${`width:${Math.max(1.5, (Math.max(0, value) / max) * 100)}%;background:${tone};transition-delay:${delay}ms`}></div>
  </div>`;

const NewPill = () => html`<span class="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
  style="background:var(--brand-wash);color:var(--brand-ink)" title="This site had no impressions at all for this search in the earlier period.">new ground</span>`;

const Legend = ({ items }) => html`
  <div class="flex items-center gap-4 text-xs mb-2.5 flex-wrap" style="color:var(--ink2)">
    ${items.map((i) => html`<span class="inline-flex items-center gap-1.5">
      <span class="h-2.5 w-2.5 rounded-full shrink-0" style=${`background:${i.tone}`}></span>${i.label}</span>`)}
  </div>`;

// A one-series month line. Single hue, its own scale, endpoint labelled — never
// two measures on one axis. The hairline marks where the earlier period ends,
// so "up against what" is visible in the mark and not only in the caption.
function MonthLine({ series, label, value, tone, splitAt }) {
  const [ref, anim] = useInView();
  const pts = (series || []).map((d, i) => ({ ...d, i }));
  const W = 240, H = 66, PT = 8, PB = 15, PL = 2, PR = 2;
  const max = Math.max(1, ...pts.map((d) => Number(d.v) || 0));
  const x = (i) => PL + (pts.length === 1 ? 0.5 : i / (pts.length - 1)) * (W - PL - PR);
  const y = (v) => PT + (1 - (Number(v) || 0) / max) * (H - PT - PB);
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const splitIdx = splitAt == null ? -1 : pts.findIndex((d) => d.month === splitAt);
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 bg-white', anim)} style="border-color:var(--grid)">
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-[11px] font-semibold uppercase tracking-wide truncate" style="color:var(--muted)">${label}</div>
        <div class="text-sm font-bold tnum shrink-0" style="color:var(--ink)">${value}</div>
      </div>
      ${pts.length > 1 ? html`
        <svg viewBox=${`0 0 ${W} ${H}`} class="w-full h-auto mt-1" role="img"
             aria-label=${`${label} by month: ${pts.map((d) => `${d.label} ${count(d.v)}`).join(', ')}.`}>
          <line x1=${PL} x2=${W - PR} y1=${H - PB} y2=${H - PB} stroke="var(--grid)" stroke-width="1" />
          ${splitIdx > 0 && html`<line x1=${x(splitIdx) - 3} x2=${x(splitIdx) - 3} y1=${PT} y2=${H - PB} stroke="var(--axis)" stroke-width="1" />`}
          <path d=${`${line} L${x(pts.length - 1).toFixed(1)} ${H - PB} L${x(0).toFixed(1)} ${H - PB} Z`} fill=${tone} opacity="0.10" />
          <path d=${line} fill="none" stroke=${tone} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="draw" style="--len:360" />
          ${pts.map((d, i) => html`<g><circle cx=${x(i)} cy=${y(d.v)} r="9" fill="transparent" /><title>${d.label}: ${count(d.v)}</title></g>`)}
          <circle cx=${x(pts.length - 1)} cy=${y(last.v)} r="4" fill=${tone} class="dot" />
          <text x=${PL} y=${H - 3} font-size="8" fill="var(--muted)">${pts[0].label}</text>
          <text x=${W - PR} y=${H - 3} text-anchor="end" font-size="8" fill="var(--muted)">${last.label}</text>
        </svg>`
        : html`<div class="h-[66px] flex items-center text-xs" style="color:var(--muted)">One month of history so far — the line starts next month.</div>`}
    </div>`;
}

// ===========================================================================
// 1. THE LEAD — what got better, in one sentence
// ===========================================================================
function Lead({ wins, business }) {
  const [ref, anim, seen] = useInView();
  const h = wins.headline || {};
  const c = wins.compare || {};
  const up = h.clicksDelta > 0;
  return html`
    <div ref=${ref} class=${cx('rounded-2xl border p-4 sm:p-5', anim)}
         style="border-color:var(--grid);background:var(--brand-wash)">
      <div class="text-[11px] font-semibold uppercase tracking-widest" style="color:var(--muted)">
        Visits from search · ${c.current?.label || ''}${c.monthToDate ? ' · month to date' : ''}
      </div>
      <div class="flex items-baseline gap-2.5 flex-wrap mt-1">
        <!-- Sized below the report's own hero (gross profit) on purpose: this
             section leads the page but must not compete for the single
             dominant number on it. -->
        <div class="rise text-3xl sm:text-4xl font-extrabold tracking-tight leading-none" style="color:var(--brand-ink)">
          <${CountUp} value=${h.clicksNow || 0} fmt=${(v) => count(v)} run=${seen} ms=${1000} />
        </div>
        ${!c.firstPeriod && h.clicksPrev > 0 && html`
          <div class="text-sm sm:text-base">
            <${Delta} value=${h.clicksPctDelta == null ? 0 : h.clicksPctDelta * 100} fmt=${(v) => v.toFixed(0) + '%'} />
            <span class="tnum" style="color:var(--ink2)"> vs ${count(h.clicksPrev)} in ${c.prior?.label}</span>
          </div>`}
      </div>
      <p class="text-sm mt-2" style="color:var(--ink2)">
        ${c.monthToDate
          ? html`${c.current?.label} is still running, so these are month-to-date totals and nothing is compared against ${'the'} month before — that comparison would read as a fall that never happened. Pick a longer window for the trend.`
          : c.firstPeriod
          ? html`This is the first period of Search Console history for ${business?.name || 'this website'}, so everything below is a starting point rather than a rise. Next period it becomes a trend.`
          : up
            ? html`<span class="font-semibold" style="color:var(--ink)">${h.risingCount} ${h.risingCount === 1 ? 'search is' : 'searches are'} gaining ground</span>${h.newGroundCount > 0 ? html`, ${h.newGroundCount} of them brand new` : ''}${h.gainingPageCount > 0 ? html`, across ${h.gainingPageCount} ${h.gainingPageCount === 1 ? 'page' : 'pages'} moving up` : ''}.
                ${h.best && html`The biggest single gain: <span class="font-semibold" style="color:var(--ink)">${h.best.query}</span>, +${count(h.best.gain)} ${h.best.gain === 1 ? 'visit' : 'visits'}.`}`
            : html`Visits are ${h.clicksDelta === 0 ? 'level with' : 'below'} ${c.prior?.label}, but
                <span class="font-semibold" style="color:var(--ink)">${h.risingCount} ${h.risingCount === 1 ? 'search' : 'searches'}</span> still gained ground${h.newGroundCount > 0 ? html` and ${h.newGroundCount} ${h.newGroundCount === 1 ? 'is' : 'are'} brand new` : ''} — the detail below is where the work shows.`}
      </p>
      ${c.partialMonthLabel && html`
        <p class="text-[11px] mt-1.5" style="color:var(--muted)">
          ${c.partialMonthLabel} is still in progress and is excluded from both periods.
        </p>`}
    </div>`;
}

// ===========================================================================
// 2. RISING QUERIES
// ===========================================================================
function Rising({ wins }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const rows = wins.queries?.rising || [];
  if (!rows.length) return null;
  // In a first period there is no "before", so the same rows are the TOP
  // searches and every delta is dropped. The function decides this (mode), not
  // this file — but rendering "▲ +12 visits" against a period that does not
  // exist is exactly the failure the mode exists to prevent.
  const top = wins.queries?.mode === 'top';
  const shown = showAll ? rows : rows.slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.clicksNow, r.clicksPrev)));
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 sm:p-4 bg-white', anim)} style="border-color:var(--grid)">
      <div class="text-[11px] font-semibold uppercase tracking-wide mb-1" style="color:var(--muted)">
        ${top ? 'Searches bringing the most visits' : 'Searches gaining ground'}
      </div>
      ${top
        ? html`<div class="text-xs mb-2.5" style="color:var(--ink2)">Bar length is visits from that search this period.</div>`
        : html`<${Legend} items=${[{ tone: 'var(--s1-lo)', label: wins.compare?.prior?.label || 'Before' }, { tone: 'var(--s1-hi)', label: 'Now' }]} />`}
      <div class="space-y-2.5">
        ${shown.map((r, i) => html`
          <div class="rise" style=${`transition-delay:${Math.min(i, 10) * 45}ms`}>
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <span class="font-medium min-w-0 flex-1 truncate" style="color:var(--ink)" title=${r.query}>${r.query}</span>
              ${!top && r.isNew && html`<${NewPill} />`}
              <span class="shrink-0 text-xs">
                ${top
                  ? html`<span class="tnum font-semibold" style="color:var(--ink)">${count(r.clicksNow)} ${r.clicksNow === 1 ? 'visit' : 'visits'}</span>`
                  : html`<${Delta} value=${r.gain} fmt=${(v) => count(v) + (v === 1 ? ' visit' : ' visits')} />`}
              </span>
            </div>
            ${top
              ? html`<${Bar} value=${r.clicksNow} max=${max} delay=${Math.min(i, 10) * 45} thick=${true} />`
              : html`<div class="mt-1"><${Move} from=${r.clicksPrev} to=${r.clicksNow} max=${max}
                  label=${`${count(r.clicksPrev)} visits in ${wins.compare?.prior?.label || 'the earlier period'} → ${count(r.clicksNow)} now`} /></div>`}
            <div class="mt-0.5 flex items-baseline justify-between gap-2 text-[11px]" style="color:var(--muted)">
              <span class="tnum truncate">
                ${top ? `${count(r.imprNow)} times seen` : `${count(r.clicksPrev)} → ${count(r.clicksNow)} visits · ${count(r.imprNow)} times seen`}
              </span>
              <span class="shrink-0"><${PosMove} from=${top ? null : r.posPrev} to=${r.posNow} gain=${top ? null : r.posGain} /></span>
            </div>
          </div>`)}
      </div>
      ${rows.length > 8 && html`
        <button onClick=${() => setShowAll(!showAll)}
          class="mt-2.5 text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
          ${showAll ? 'Show top 8' : `Show all ${rows.length} ${top ? 'searches' : 'rising searches'}`}
        </button>`}
    </div>`;
}

// ===========================================================================
// 3. NEW GROUND — searches the site did not appear for at all before
// ===========================================================================
function NewGround({ wins }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const rows = wins.queries?.newGround || [];
  if (!rows.length) return null;
  const shown = showAll ? rows : rows.slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.impressions));
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 sm:p-4 bg-white', anim)} style="border-color:var(--grid)">
      <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">Searches you now appear for</div>
      <p class="text-sm mt-0.5 mb-3" style="color:var(--ink2)">
        <span class="font-bold" style="color:var(--brand-ink)">${rows.length}</span> ${rows.length === 1 ? 'search' : 'searches'}
        the site had <span class="font-semibold">zero</span> visibility for in ${wins.compare?.prior?.label || 'the earlier period'}.
      </p>
      <div class="space-y-2">
        ${shown.map((r, i) => html`
          <div class="rise" style=${`transition-delay:${Math.min(i, 8) * 45}ms`}>
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <span class="min-w-0 flex-1 truncate" style="color:var(--ink)" title=${r.query}>${r.query}</span>
              <span class="shrink-0 tnum text-xs" style="color:var(--muted)">
                ${count(r.impressions)} ${r.impressions === 1 ? 'time' : 'times'} seen${r.clicks > 0 ? ` · ${count(r.clicks)} ${r.clicks === 1 ? 'visit' : 'visits'}` : ''}
              </span>
            </div>
            <div class="h-2 mt-1 rounded-full" style="background:#f4f4f2">
              <div class="h-2 rounded-[4px] grow" style=${`width:${Math.max(1.5, (r.impressions / max) * 100)}%;background:var(--s1);transition-delay:${Math.min(i, 8) * 45}ms`}></div>
            </div>
          </div>`)}
      </div>
      ${rows.length > 8 && html`
        <button onClick=${() => setShowAll(!showAll)}
          class="mt-2.5 text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
          ${showAll ? 'Show top 8' : `Show all ${rows.length}`}
        </button>`}
      <p class="text-[11px] mt-2 leading-snug" style="color:var(--muted)">
        Bar length is how often each search showed the site. Appearing is the first step; the visits follow as the position climbs.
      </p>
    </div>`;
}

// ===========================================================================
// 4. PAGES GAINING GROUND
// ===========================================================================
function Pages({ wins }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const rows = wins.pages?.gaining || [];
  if (!rows.length) return null;
  const top = wins.pages?.mode === 'top';       // first period — see Rising
  const shown = showAll ? rows : rows.slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.clicksNow, r.clicksPrev)));
  return html`
    <div ref=${ref} class=${cx(anim)}>
      ${top
        ? html`<div class="text-xs mb-2.5" style="color:var(--ink2)">Bar length is visits from search this period.</div>`
        : html`<${Legend} items=${[{ tone: 'var(--s1-lo)', label: wins.compare?.prior?.label || 'Before' }, { tone: 'var(--s1-hi)', label: 'Now' }]} />`}
      <!-- ≥sm: the table view, which is also the WCAG-clean twin of the marks -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[11px] uppercase tracking-wide" style="color:var(--muted)">
            <th class="pb-2 pr-3 font-semibold">Page</th>
            <th class="pb-2 pr-3 font-semibold w-32">${top ? 'Visits' : 'Before → now'}</th>
            <th class="pb-2 pr-3 font-semibold text-right">Visits</th>
            ${!top && html`<th class="pb-2 pr-3 font-semibold text-right">Change</th>`}
            <th class="pb-2 font-semibold text-right">Position</th>
          </tr></thead>
          <tbody>
            ${shown.map((r, i) => html`
              <tr class="rise border-t" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 8) * 35}ms`}>
                <td class="py-2 pr-3 font-medium max-w-[18rem] truncate" style="color:var(--ink)" title=${r.page}>${r.path}</td>
                <td class="py-2 pr-3">
                  ${top
                    ? html`<${Bar} value=${r.clicksNow} max=${max} delay=${Math.min(i, 8) * 35} />`
                    : html`<${Move} from=${r.clicksPrev} to=${r.clicksNow} max=${max} label=${`${count(r.clicksPrev)} → ${count(r.clicksNow)} visits`} />`}
                </td>
                <td class="py-2 pr-3 text-right tnum" style="color:var(--ink2)">${count(r.clicksNow)}</td>
                ${!top && html`<td class="py-2 pr-3 text-right text-xs"><${Delta} value=${r.gain} /></td>`}
                <td class="py-2 text-right text-xs"><${PosMove} from=${top ? null : r.posPrev} to=${r.posNow} gain=${top ? null : r.posGain} /></td>
              </tr>`)}
          </tbody>
        </table>
      </div>
      <!-- <sm: one card per page; a 5-column table is unusable on a phone -->
      <div class="sm:hidden space-y-2">
        ${shown.map((r, i) => html`
          <div class="rise rounded-xl border p-3" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 8) * 35}ms`}>
            <div class="flex items-start justify-between gap-2">
              <div class="text-sm font-medium min-w-0 flex-1 break-words" style="color:var(--ink)">${r.path}</div>
              <span class="shrink-0 text-xs">
                ${top ? html`<span class="tnum font-semibold" style="color:var(--ink)">${count(r.clicksNow)}</span>` : html`<${Delta} value=${r.gain} />`}
              </span>
            </div>
            ${top
              ? html`<${Bar} value=${r.clicksNow} max=${max} delay=${Math.min(i, 8) * 35} />`
              : html`<div class="mt-2"><${Move} from=${r.clicksPrev} to=${r.clicksNow} max=${max} label=${`${count(r.clicksPrev)} → ${count(r.clicksNow)} visits`} /></div>`}
            <div class="mt-1 flex items-baseline justify-between gap-2 text-[11px]" style="color:var(--muted)">
              <span class="tnum">${top ? `${count(r.clicksNow)} visits · ${count(r.imprNow)} times seen` : `${count(r.clicksPrev)} → ${count(r.clicksNow)} visits`}</span>
              <${PosMove} from=${top ? null : r.posPrev} to=${r.posNow} gain=${top ? null : r.posGain} />
            </div>
          </div>`)}
      </div>
      ${rows.length > 6 && html`
        <button onClick=${() => setShowAll(!showAll)}
          class="mt-3 text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
          ${showAll ? 'Show top 6' : `Show all ${rows.length} pages`}
        </button>`}
    </div>`;
}

// ===========================================================================
// 5. NEAR MISSES — striking distance, priced on the ledger's own CTR curve
// ===========================================================================
function NearMiss({ wins }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const nm = wins.nearMiss || {};
  const rows = nm.rows || [];
  if (!rows.length) return null;
  const shown = showAll ? rows : rows.slice(0, 6);
  const priceable = !!nm.priceable;
  const max = Math.max(1, ...rows.map((r) => (priceable ? r.valueTarget : r.clicksTarget)));
  return html`
    <div ref=${ref} class=${cx(anim)}>
      <${Legend} items=${[{ tone: 'var(--s1-lo)', label: 'Worth today' }, { tone: 'var(--s1-hi)', label: `At #${nm.target}` }]} />
      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[11px] uppercase tracking-wide" style="color:var(--muted)">
            <th class="pb-2 pr-3 font-semibold">Search</th>
            <th class="pb-2 pr-3 font-semibold text-right">Now</th>
            <th class="pb-2 pr-3 font-semibold text-right">Searches/mo</th>
            <th class="pb-2 pr-3 font-semibold w-32">Today → #${nm.target}</th>
            <th class="pb-2 pr-3 font-semibold text-right">Extra visits</th>
            <th class="pb-2 font-semibold text-right">${priceable ? 'Worth' : ''}</th>
          </tr></thead>
          <tbody>
            ${shown.map((r, i) => html`
              <tr class="rise border-t" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 8) * 35}ms`}>
                <td class="py-2 pr-3 font-medium max-w-[15rem] truncate" style="color:var(--ink)" title=${r.keyword}>${r.keyword}</td>
                <td class="py-2 pr-3 text-right">
                  <span class="inline-block rounded-full px-1.5 py-0.5 text-xs font-semibold tnum bg-sky-50 text-sky-700">#${r.position.toFixed(1)}</span>
                </td>
                <td class="py-2 pr-3 text-right tnum" style="color:var(--ink2)">
                  ${count(r.volume)}${r.volSource === 'impressions' && html`<span title="No third-party volume for this term — this is the site's own impressions, which under-states the market." style="color:var(--muted)">*</span>`}
                </td>
                <td class="py-2 pr-3"><${Move} from=${priceable ? r.valueNow : r.clicksNow} to=${priceable ? r.valueTarget : r.clicksTarget} max=${max}
                  label=${priceable ? `${money(r.valueNow)} today → ${money(r.valueTarget)} at #${nm.target}` : `${count(r.clicksNow)} → ${count(r.clicksTarget)} visits`} /></td>
                <td class="py-2 pr-3 text-right tnum" style="color:var(--ink2)">+${count(r.addClicks)}/mo</td>
                <td class="py-2 text-right tnum font-bold" style="color:var(--brand-ink)">${priceable ? '+' + money(r.gain, { compact: true }) : ''}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
      <div class="sm:hidden space-y-2">
        ${shown.map((r, i) => html`
          <div class="rise rounded-xl border p-3" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 8) * 35}ms`}>
            <div class="flex items-start justify-between gap-2">
              <div class="font-medium text-sm min-w-0 flex-1" style="color:var(--ink)">${r.keyword}</div>
              <span class="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tnum bg-sky-50 text-sky-700">#${r.position.toFixed(1)}</span>
            </div>
            <div class="mt-2"><${Move} from=${priceable ? r.valueNow : r.clicksNow} to=${priceable ? r.valueTarget : r.clicksTarget} max=${max}
              label=${priceable ? `${money(r.valueNow)} → ${money(r.valueTarget)}` : `${count(r.clicksNow)} → ${count(r.clicksTarget)} visits`} /></div>
            <div class="mt-1.5 flex items-baseline justify-between gap-2 text-xs" style="color:var(--ink2)">
              <span class="tnum">+${count(r.addClicks)} visits/mo at #${nm.target}</span>
              ${priceable && html`<span class="tnum font-bold" style="color:var(--brand-ink)">+${money(r.gain, { compact: true })}</span>`}
            </div>
            <div class="mt-0.5 text-[11px] tnum" style="color:var(--muted)">${count(r.volume)} searches/mo${r.volSource === 'impressions' ? '*' : ''}</div>
          </div>`)}
      </div>
      <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
        ${rows.length > 6 && html`
          <button onClick=${() => setShowAll(!showAll)}
            class="text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
            ${showAll ? 'Show top 6' : `Show all ${rows.length}`}
          </button>`}
        <div class="text-xs ml-auto text-right" style="color:var(--muted)">
          <${Est} basis=${nm.basis} class="mr-1" />
          ${priceable
            ? html`Same curve, close rate and average job value as the ledger below — one set of numbers, not two.`
            : html`Visits only: add an average job value for this business to price these.`}
          <!-- The totals above count every near-miss found, so say when the list
               below is only the head of it. -->
          ${nm.counted > rows.length && html`<span class="block">Totals cover all ${nm.counted}; the ${rows.length} biggest are listed.</span>`}
        </div>
      </div>
    </div>`;
}

// ===========================================================================
// 6. WHAT OUR CONTENT EARNED
// ===========================================================================
// FORM: magnitude bars, one hue, direct-labelled — the job is "compare these
// pages by the traffic they earn", which is sequential, not categorical.
function Content({ wins }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const c = wins.content || {};
  const posts = c.posts || [];
  if (!c.available || !posts.length) return null;
  const earning = posts.filter((p) => p.clicks > 0 || p.impressions > 0);
  const shown = showAll ? posts : earning.slice(0, 6);
  const max = Math.max(1, ...posts.map((p) => p.clicks));
  const t = c.totals || {};
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 sm:p-4 bg-white', anim)} style="border-color:var(--grid)">
      <div class="flex items-baseline justify-between gap-3 flex-wrap">
        <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">What we published, and what it earns</div>
        <div class="text-xs" style="color:var(--muted)">
          <span class="tnum font-semibold" style="color:var(--ink)">${count(t.clicks)}</span> visits from
          <span class="tnum font-semibold" style="color:var(--ink)">${t.earning}</span> of ${t.published} published ${t.published === 1 ? 'page' : 'pages'}
          ${t.value != null && html` · worth <span class="tnum font-semibold" style="color:var(--brand-ink)">${money(t.value)}</span>`}
        </div>
      </div>
      <div class="mt-3 space-y-2.5">
        ${shown.map((p, i) => html`
          <div class="rise" style=${`transition-delay:${Math.min(i, 8) * 45}ms`}>
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <span class="font-medium min-w-0 flex-1 truncate" style="color:var(--ink)" title=${p.title}>${p.title}</span>
              <span class="shrink-0 tnum text-xs" style="color:var(--ink2)">
                ${p.clicks > 0 || p.impressions > 0
                  ? html`${count(p.clicks)} ${p.clicks === 1 ? 'visit' : 'visits'}${p.value != null && p.value > 0 ? html` · <span class="font-semibold" style="color:var(--brand-ink)">${money(p.value)}</span>` : ''}`
                  : html`<span style="color:var(--muted)">no search traffic yet</span>`}
              </span>
            </div>
            <div class="h-2 mt-1 rounded-full" style="background:#f4f4f2">
              <div class="h-2 rounded-[4px] grow" style=${`width:${Math.max(1.5, (p.clicks / max) * 100)}%;background:var(--s1);transition-delay:${Math.min(i, 8) * 45}ms`}></div>
            </div>
            <div class="mt-0.5 text-[11px] flex items-center gap-2 flex-wrap" style="color:var(--muted)">
              ${p.monthsLive != null && html`<span>${p.monthsLive < 1 ? 'live under a month' : `live ${p.monthsLive} ${p.monthsLive === 1 ? 'month' : 'months'}`}</span>`}
              ${p.impressions > 0 && html`<span>· seen ${count(p.impressions)} times</span>`}
              ${p.position != null && html`<span class="tnum">· at #${p.position.toFixed(1)}</span>`}
              ${p.gain > 0 && html`<span>· <${Delta} value=${p.gain} /> this period</span>`}
            </div>
          </div>`)}
      </div>
      ${posts.length > shown.length && html`
        <button onClick=${() => setShowAll(!showAll)}
          class="mt-2.5 text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
          ${showAll ? 'Show the top earners' : `Show all ${posts.length} published pages`}
        </button>`}
      <p class="text-[11px] mt-2 leading-snug" style="color:var(--muted)">
        <${Est} basis="derived" class="mr-1" />
        The traffic is measured. Crediting it to a specific page is a URL match, so a page that was rewritten rather than newly created reads as earning everything it now gets.
        ${c.note && html` ${c.note}`}
      </p>
    </div>`;
}

// ===========================================================================
// 7. ENGAGEMENT + CONVERSIONS (GA4)
// ===========================================================================
// Not connected is a stated fact with a reason, never a row of zeros — the same
// rule the AI-visibility section follows for an engine we have no key for.
const mlabel = (m) => { const [y, mo] = String(m).split('-'); return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }); };

function Engagement({ wins }) {
  const [ref, anim] = useInView();
  const e = wins.engagement || {};
  if (!e.connected) {
    return html`
      <div ref=${ref} class=${cx('rounded-xl border border-dashed p-4 sm:p-5', anim)} style="border-color:var(--grid)">
        <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">On-site engagement and conversions</div>
        <p class="text-sm mt-1" style="color:var(--ink2)">${e.reason || 'Not measured for this business.'}</p>
        <p class="text-[11px] mt-1" style="color:var(--muted)">Not measured is not the same as zero — nothing above depends on it.</p>
      </div>`;
  }
  const now = e.now || {}, prior = e.prior || null;
  const d = (k) => (prior && prior[k] != null && now[k] != null ? now[k] - prior[k] : null);
  const sessions = e.byMonth.map((m) => ({ v: m.sessions, label: mlabel(m.month), month: m.month }));
  const convs = e.byMonth.map((m) => ({ v: m.conversions, label: mlabel(m.month), month: m.month }));
  const splitAt = wins.compare?.current?.from || null;
  const hasConv = e.byMonth.some((m) => m.conversions > 0);
  return html`
    <div ref=${ref} class=${cx('space-y-3', anim)}>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <${Tile} label="Sessions" value=${count(now.sessions)} basis="measured"
          sub=${prior ? html`<${Delta} value=${d('sessions')} /> vs ${wins.compare?.prior?.label}` : 'no earlier period to compare'} />
        <${Tile} label="Engaged visits" value=${now.engagementRate == null ? '—' : pct(now.engagementRate, 0)} basis="measured"
          sub=${now.engagementRate == null
            ? 'engagement not reported by this property'
            : prior && prior.engagementRate != null
              ? html`<${Delta} value=${Math.round((now.engagementRate - prior.engagementRate) * 1000) / 10} fmt=${(v) => v.toFixed(1) + ' pts'} /> vs ${wins.compare?.prior?.label}`
              : 'share of sessions that engaged'} />
        <${Tile} label="Conversions" value=${count(now.conversions)} tone="brand" basis="measured"
          sub=${prior ? html`<${Delta} value=${d('conversions')} /> vs ${wins.compare?.prior?.label}` : 'whatever this GA4 property counts'} />
        <${Tile} label="Conversion rate" value=${now.convRate == null ? '—' : pct(now.convRate, 1)} basis="derived"
          sub="conversions ÷ sessions" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <${MonthLine} series=${sessions} label="Sessions by month" value=${count(now.sessions)} tone="var(--s3)" splitAt=${splitAt} />
        ${hasConv
          ? html`<${MonthLine} series=${convs} label="Conversions by month" value=${count(now.conversions)} tone="var(--s1-hi)" splitAt=${splitAt} />`
          : html`<div class="rounded-xl border border-dashed p-3 flex items-center text-xs" style="border-color:var(--grid);color:var(--muted)">
              This GA4 property has no conversion events recorded in this window — mark a key event in GA4 (a form submit or a call click) and it appears here.
            </div>`}
      </div>
      <p class="text-[11px]" style="color:var(--muted)">
        The hairline in each chart marks where ${wins.compare?.prior?.label || 'the earlier period'} ends and ${wins.compare?.current?.label} begins.
      </p>
    </div>`;
}

// ===========================================================================
// 8. WORTH ATTENTION — smaller than the wins, on purpose
// ===========================================================================
function Attention({ wins }) {
  const [ref, anim] = useInView();
  const rows = wins.attention || [];
  if (!rows.length) return null;
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 sm:p-4', anim)} style="border-color:var(--grid);background:#fafaf8">
      <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">Worth attention</div>
      <p class="text-xs mt-0.5 mb-2.5" style="color:var(--ink2)">
        Every report has some of these. They are listed with what we intend to do about them.
      </p>
      <div class="space-y-2">
        ${rows.map((r, i) => html`
          <div class="rise flex items-start gap-2.5" style=${`transition-delay:${Math.min(i, 5) * 45}ms`}>
            <span class="shrink-0 mt-0.5 h-2.5 w-2.5 rounded-full" style="background:var(--neg)"></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2 text-sm">
                <span class="min-w-0 flex-1 truncate" style="color:var(--ink)" title=${r.label}>${r.label}</span>
                <!-- arrow + number + color: a decline never reads on color alone -->
                <span class="shrink-0 text-xs tnum" style="color:var(--muted)">
                  ${count(r.clicksPrev)} → ${count(r.clicksNow)} visits
                  <span class="font-semibold" style="color:var(--neg)">▼ ${count(r.lost)}</span>
                </span>
              </div>
              <div class="text-[11px] mt-0.5" style="color:var(--ink2)">${r.action}</div>
            </div>
          </div>`)}
      </div>
    </div>`;
}

// ===========================================================================
// 9. THE METHOD BLOCK — from the function, never collapsible
// ===========================================================================
const Method = ({ method }) => !method ? null : html`
  <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid);background:#f8fafc">
    <div class="text-sm font-semibold" style="color:var(--ink)">${method.title}</div>
    <ul class="mt-1.5 space-y-1.5 text-xs list-disc pl-4" style="color:var(--ink2)">
      ${(method.lines || []).map((t) => html`<li>${t}</li>`)}
    </ul>
  </div>`;

// ===========================================================================
export function WebsiteWins({ wins, business }) {
  if (!wins) return null;

  // Nothing to report yet. Say why, in one line, and take up no more room.
  if (!wins.available) {
    return html`
      <section>
        <${SectionHead} eyebrow="Website wins" title="What the website is winning"
          sub="Rising searches, pages gaining ground, and the wins within reach." />
        <div class="rounded-xl border border-dashed p-8 text-center text-sm" style="border-color:var(--grid);color:var(--muted)">
          ${wins.reason || 'Not measured yet.'}
        </div>
      </section>`;
  }

  const h = wins.headline || {};
  const c = wins.compare || {};
  const nm = wins.nearMiss || {};
  const hasRising = (wins.queries?.rising || []).length > 0;
  const hasNew = (wins.queries?.newGround || []).length > 0;

  return html`
    <section class="space-y-4">
      <${SectionHead} eyebrow="Website wins" title="What the website is winning"
        sub=${c.monthToDate
          ? `${c.current?.label}, month to date. Nothing is compared while the month is still running.`
          : c.firstPeriod
            ? `${c.current?.label} — the first period of Search Console history for this site.`
            : `${c.current?.label} against ${c.prior?.label}. Complete months only.`} />

      <${Lead} wins=${wins} business=${business} />

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <${Tile} label="Visits from search" value=${count(h.clicksNow)} basis="measured"
          sub=${c.firstPeriod || !h.clicksPrev
            ? `across ${c.current?.label}`
            : html`<${Delta} value=${h.clicksDelta} /> vs ${c.prior?.label}`} />
        <${Tile} label="Times you appeared" value=${count(h.imprNow, { compact: true })} basis="measured"
          sub=${c.firstPeriod || !h.imprPrev
            ? 'impressions in search results'
            : html`<${Delta} value=${h.imprPctDelta == null ? 0 : Math.round(h.imprPctDelta * 100)} fmt=${(v) => v + '%'} /> vs ${c.prior?.label}`} />
        <${Tile} label=${c.firstPeriod ? 'Searches you appear for' : 'Searches gaining'} value=${count(c.firstPeriod ? wins.queries?.counted : h.risingCount)} basis="measured"
          sub=${hasNew ? `${h.newGroundCount} of them brand new` : 'ranked by visits gained'} />
        ${nm.priceable && nm.totalGain > 0
          ? html`<${Tile} label="Within reach" value=${money(nm.totalGain, { compact: true })} tone="brand"
              sub=${`per month if ${nm.counted} near-misses reached #${nm.target}`} basis=${nm.basis} />`
          : html`<${Tile} label="Within reach" value=${nm.addClicks ? '+' + count(nm.addClicks) : '—'} tone="brand"
              sub=${nm.addClicks ? `visits per month at #${nm.target}` : 'no near-misses in striking distance yet'} basis=${nm.basis} />`}
      </div>

      ${(hasRising || hasNew) && html`
        <div class=${cx('grid gap-3', hasRising && hasNew ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
          <${Rising} wins=${wins} />
          <${NewGround} wins=${wins} />
        </div>`}

      ${(wins.pages?.gaining || []).length > 0 && html`
        <div>
          <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">
            ${wins.pages?.mode === 'top' ? 'The pages doing the work' : 'Pages gaining ground'}
          </div>
          <${Pages} wins=${wins} />
        </div>`}

      ${(nm.rows || []).length > 0 && html`
        <div>
          <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">Within reach</div>
          <p class="text-sm mt-0.5 mb-2" style="color:var(--ink2)">
            Already on page one or two${nm.priceable && nm.totalGain > 0 ? html`, and worth <span class="font-semibold" style="color:var(--brand-ink)">${money(nm.totalGain)}</span> a month between them` : ''} at #${nm.target}. These are the shortest routes to more work.
          </p>
          <${NearMiss} wins=${wins} />
        </div>`}

      ${wins.content?.available && html`
        <div>
          <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">What the content is earning</div>
          <${Content} wins=${wins} />
        </div>`}

      <div>
        <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">On the site itself</div>
        <${Engagement} wins=${wins} />
      </div>

      <${Attention} wins=${wins} />
      <${Method} method=${wins.method} />
    </section>`;
}
