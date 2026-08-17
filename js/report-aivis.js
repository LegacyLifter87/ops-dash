// ---------------------------------------------------------------------------
// report-aivis.js — the AI SEARCH VISIBILITY section of the client report.
//
// Answers one question a client is newly, genuinely anxious about: "when
// someone asks ChatGPT who does this near me, do I come up?" Rendered by both
// the in-app Reporting tab and the public share page, from the same payload,
// so a client link is exactly what the agency saw.
//
// THE HONESTY CONTRACT (same one the rest of the report signs)
// This is a SAMPLE, not a census. Every figure means "this is what these
// assistants answered to these questions on this date". Nothing here is
// called a ranking, ever. Three rules fall out of that and are load-bearing:
//   1. A rate is never shown without its denominator ("4 of 6 asks").
//   2. "Not measured" (we had no key for that engine) and "measured, absent"
//      are different facts and are drawn differently. Rendering an unmeasured
//      engine as 0% would blame the client for our own gap.
//   3. The method block is NOT collapsible. It ships open, above the fold of
//      the section, because the charts are not honest without it.
//
// COLOR (per the dataviz method — palette validated, not eyeballed):
// This section introduces NO new hues. Five engines would need a 5th
// categorical slot and the house palette validates four, so identity is never
// carried by color here: the per-engine and share-of-voice charts are
// single-hue magnitude charts whose identity lives in the axis labels, the
// trend is small multiples (one series per panel, so no legend is needed), and
// the matrix is an ordinal ramp of ONE hue — absent (neutral) → named
// (--s1-lo) → named and cited (--s1-hi). The client's brand is the accent on
// exactly one mark: "you" in share of voice.
// ---------------------------------------------------------------------------
import { html, useState, cx } from './lib.js';
import { pct, count, Tile, Est, SectionHead, CountUp, useInView } from './report-view.js';

const ORDER = ['claude', 'openai', 'gemini', 'perplexity', 'google_aio'];
const rank = (k) => { const i = ORDER.indexOf(k); return i < 0 ? 99 : i; };

// "skipped:no-key" is our missing credential, not the client's absence. It is
// worded for the agency in the app and neutrally on a share link.
const WHY = {
  'skipped:no-key': 'not connected yet',
  'skipped:no-credentials': 'not connected yet',
  'not-run': 'not included in this run',
};
const whyLabel = (why) => WHY[why] || 'not measured';

// A rate plus the sample it came from. Used everywhere a percentage appears —
// there is no code path in this file that renders a bare percentage.
const OfAsks = ({ hit, asks, className = '' }) => html`
  <span class=${cx('tnum', className)}>${count(hit)} of ${count(asks)}</span>`;

// ===========================================================================
// 1. HEADLINE — the one number the section leads with
// ===========================================================================
function Headline({ data }) {
  const [ref, anim, seen] = useInView();
  const h = data.headline || {};
  const total = h.promptsTotal || 0;
  const delta = h.priorHit == null ? null : h.promptsHit - h.priorHit;
  return html`
    <div ref=${ref} class=${cx('text-center py-5 sm:py-7', anim)}>
      <div class="text-[11px] font-semibold uppercase tracking-widest" style="color:var(--muted)">
        Named by AI assistants · ${data.period?.label}
      </div>
      <!-- One step below the report's own hero (the gross-profit figure in the
           money loop) on purpose: this leads the report but must not compete
           with it for the single dominant number on the page. -->
      <div class="rise text-4xl sm:text-5xl font-extrabold tracking-tight leading-none mt-1" style="color:var(--brand-ink)">
        <${CountUp} value=${h.promptsHit || 0} fmt=${(v) => String(Math.round(v))} run=${seen} ms=${1100} />
        <span class="text-2xl sm:text-3xl font-bold" style="color:var(--ink2)"> of ${total}</span>
      </div>
      <div class="rise text-sm mt-2 max-w-lg mx-auto" style=${'color:var(--ink2);transition-delay:150ms'}>
        ${total === 0
          ? 'No questions asked yet this period.'
          : html`customer questions where an assistant named ${data.business?.name || 'you'}${' '}
              <span style="color:var(--muted)">— across ${count(h.asks)} answers</span>`}
        ${delta != null && html`
          <span class="block mt-1 font-semibold" style=${`color:${delta > 0 ? 'var(--good)' : delta < 0 ? 'var(--neg)' : 'var(--muted)'}`}>
            ${delta > 0 ? '▲ up' : delta < 0 ? '▼ down' : '— level'} from ${h.priorHit} of ${h.priorTotal} in ${h.priorLabel}
          </span>`}
      </div>
    </div>`;
}

// ===========================================================================
// 2. PER-ENGINE — magnitude across five named things
// ===========================================================================
// FORM: sorted horizontal bars, one hue. Identity is the row label, not the
// color, which is what keeps this to zero new palette slots. An unmeasured
// engine gets a dashed empty track and the reason, never a zero-length bar.
function EngineRow({ m, i }) {
  const r = m.rate == null ? 0 : m.rate;
  const d = m.priorRate == null || m.rate == null ? null : m.rate - m.priorRate;
  return html`
    <div class="rise" style=${`transition-delay:${i * 70}ms`}>
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="font-medium truncate" style="color:var(--ink)">${m.label}</span>
        ${m.measured
          ? html`<span class="shrink-0 flex items-baseline gap-2">
              ${d != null && Math.abs(d) > 0.001 && html`
                <span class="text-[11px] font-semibold tnum" style=${`color:${d > 0 ? 'var(--good)' : 'var(--neg)'}`}>
                  ${d > 0 ? '+' : '−'}${pct(Math.abs(d), 0)}
                </span>`}
              <span class="tnum font-bold" style="color:var(--ink)">${pct(m.rate, 0)}</span>
            </span>`
          : html`<span class="shrink-0 text-xs" style="color:var(--muted)">${whyLabel(m.why)}</span>`}
      </div>
      ${m.measured
        ? html`
          <div class="h-2.5 mt-1 rounded-full" style="background:#f4f4f2">
            <div class="h-2.5 rounded-[4px] grow" style=${`width:${Math.max(1.5, r * 100)}%;background:var(--s1);transition-delay:${i * 70}ms`}></div>
          </div>
          <div class="text-[11px] mt-1 flex items-center gap-2 flex-wrap" style="color:var(--muted)">
            <span>named in <${OfAsks} hit=${m.mentions} asks=${m.asks} /> answers</span>
            ${m.cited > 0 && html`<span>· linked to your site ${count(m.cited)}×</span>`}
            ${m.avgPosition != null && html`<span>· usually listed ${m.avgPosition <= 1.4 ? 'first' : `#${m.avgPosition.toFixed(1)}`}</span>`}
          </div>`
        : html`
          <div class="h-2.5 mt-1 rounded-full border border-dashed" style="border-color:var(--grid)"></div>
          <div class="text-[11px] mt-1" style="color:var(--muted)">Not measured this period — so this is not a result, it's a gap.</div>`}
    </div>`;
}

function ByEngine({ data }) {
  const [ref, anim] = useInView();
  const rows = [...(data.byModel || [])].sort((a, b) => {
    if (a.measured !== b.measured) return a.measured ? -1 : 1;
    if (a.measured) return (b.rate || 0) - (a.rate || 0);
    return rank(a.key) - rank(b.key);
  });
  if (!rows.length) return null;
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 sm:p-4 bg-white space-y-3.5', anim)} style="border-color:var(--grid)">
      <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">
        How often each assistant named you
      </div>
      ${rows.map((m, i) => html`<${EngineRow} m=${m} i=${i} />`)}
    </div>`;
}

// ===========================================================================
// 3. SHARE OF AI VOICE
// ===========================================================================
// FORM: sorted horizontal bars again — same job, same encoding. The client's
// own row is the ONE mark carrying the brand accent; everyone else is slot 1.
// This is a share of mentions across this prompt set, and the caption says so
// rather than letting anyone read it as market share.
function ShareOfVoice({ data }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const rows = data.shareOfVoice || [];
  if (rows.length < 2) return null;
  const max = Math.max(1, ...rows.map((r) => r.mentions));
  const shown = showAll ? rows : rows.slice(0, 6);
  const self = rows.find((r) => r.self);
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 sm:p-4 bg-white', anim)} style="border-color:var(--grid)">
      <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">
        Who the assistants named
      </div>
      ${self && html`<p class="text-sm mt-0.5 mb-3" style="color:var(--ink2)">
        You took <span class="font-bold" style="color:var(--brand-ink)">${pct(self.share, 0)}</span> of every business mention across these questions.
      </p>`}
      <div class="space-y-2">
        ${shown.map((r, i) => html`
          <div class="rise" style=${`transition-delay:${Math.min(i, 8) * 45}ms`}>
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class=${cx('truncate min-w-0', r.self ? 'font-bold' : '')} style=${r.self ? 'color:var(--brand-ink)' : 'color:var(--ink2)'}>
                ${r.name}${r.self ? ' (you)' : ''}
              </span>
              <span class="tnum shrink-0 text-xs" style="color:var(--muted)">${count(r.mentions)} ${r.mentions === 1 ? 'mention' : 'mentions'}</span>
            </div>
            <div class="h-2 mt-1 rounded-full" style="background:#f4f4f2">
              <div class="h-2 rounded-[4px] grow"
                   style=${`width:${Math.max(1.5, (r.mentions / max) * 100)}%;background:${r.self ? 'var(--brand)' : 'var(--s1)'};transition-delay:${Math.min(i, 8) * 45}ms`}></div>
            </div>
          </div>`)}
      </div>
      ${rows.length > 6 && html`
        <button onClick=${() => setShowAll(!showAll)}
          class="mt-2 text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
          ${showAll ? 'Show top 6' : `Show all ${rows.length}`}
        </button>`}
      <p class="text-[11px] mt-2 leading-snug" style="color:var(--muted)">
        Share of the business names these answers mentioned — not a share of your market.
        Competitor names are read out of the answers themselves. <${Est} basis="derived" />
      </p>
    </div>`;
}

// ===========================================================================
// 4. TREND — small multiples, one series each
// ===========================================================================
// Rates share a 0–100% axis, but the engines are not comparable line-for-line
// (different sample sizes, different months connected). One panel per engine
// keeps each honest and means no legend and no categorical hues.
function RateSpark({ series, label, sub }) {
  const [ref, anim] = useInView();
  const pts = (series || []).filter((d) => d.rate != null);
  const W = 240, H = 66, PT = 8, PB = 15, PL = 2, PR = 2;
  const x = (i) => PL + (pts.length === 1 ? 0.5 : i / (pts.length - 1)) * (W - PL - PR);
  const y = (v) => PT + (1 - Math.max(0, Math.min(1, v))) * (H - PT - PB);
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.rate).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 bg-white', anim)} style="border-color:var(--grid)">
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-[11px] font-semibold uppercase tracking-wide truncate" style="color:var(--muted)">${label}</div>
        <div class="text-sm font-bold tnum shrink-0" style="color:var(--ink)">${last ? pct(last.rate, 0) : '—'}</div>
      </div>
      ${pts.length > 1 ? html`
        <svg viewBox=${`0 0 ${W} ${H}`} class="w-full h-auto mt-1" role="img"
             aria-label=${`${label}: ${pts.map((d) => `${d.label} ${pct(d.rate, 0)}`).join(', ')}.`}>
          <line x1=${PL} x2=${W - PR} y1=${H - PB} y2=${H - PB} stroke="var(--grid)" stroke-width="1" />
          <path d=${`${line} L${x(pts.length - 1).toFixed(1)} ${H - PB} L${x(0).toFixed(1)} ${H - PB} Z`} fill="var(--s1)" opacity="0.10" />
          <path d=${line} fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="draw" style="--len:360" />
          ${pts.map((d, i) => html`
            <g><circle cx=${x(i)} cy=${y(d.rate)} r="9" fill="transparent" />
              <title>${d.label}: named in ${d.mentions} of ${d.asks} answers (${pct(d.rate, 0)})</title></g>`)}
          <circle cx=${x(pts.length - 1)} cy=${y(last.rate)} r="4" fill="var(--s1)" class="dot" />
          <text x=${PL} y=${H - 3} font-size="8" fill="var(--muted)">${pts[0].label}</text>
          <text x=${W - PR} y=${H - 3} text-anchor="end" font-size="8" fill="var(--muted)">${last.label}</text>
        </svg>`
        : html`<div class="h-[66px] flex items-center text-xs" style="color:var(--muted)">
            One month measured so far — the trend starts next month.
          </div>`}
      ${sub && html`<div class="text-[11px] mt-0.5" style="color:var(--muted)">${sub}</div>`}
    </div>`;
}

function Trend({ data }) {
  const trend = data.trend || [];
  if (trend.length < 1) return null;
  const overall = trend.map((t) => ({ label: t.label, rate: t.rate, mentions: t.mentions, asks: t.asks }));
  const engines = (data.byModel || []).filter((m) => m.measured).slice(0, 3).map((m) => ({
    key: m.key, label: m.label,
    series: trend.map((t) => {
      const b = (t.byProvider || {})[m.key];
      return { label: t.label, rate: b ? b.rate : null, mentions: b?.mentions || 0, asks: b?.asks || 0 };
    }),
  }));
  // Written out literally — Tailwind purges against source text, so a
  // template-built class name silently does not exist in the built CSS.
  return html`
    <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <${RateSpark} series=${overall} label="All assistants" sub="share of answers naming you" />
      ${engines.map((e) => html`<${RateSpark} series=${e.series} label=${e.label} sub="share of its answers" />`)}
    </div>`;
}

// ===========================================================================
// 5. THE MATRIX — every question, every engine
// ===========================================================================
// FORM: an ordinal heatmap of ONE hue. Three states only, light → dark:
// not named · named · named and linked. A legend is always present and every
// cell carries a title tooltip; below sm the grid becomes one card per
// question, because a 6-column matrix is unusable on a phone.
const cellTone = (c) => {
  if (!c || !c.asks) return { bg: '#f4f4f2', fg: 'var(--muted)', txt: '·', title: 'not asked' };
  if (c.cited > 0) return { bg: 'var(--s1-hi)', fg: '#ffffff', txt: `${c.hits}/${c.asks}`, title: `named in ${c.hits} of ${c.asks} answers, and linked to your site` };
  if (c.hits > 0) return { bg: 'var(--s1-lo)', fg: '#0b0b0b', txt: `${c.hits}/${c.asks}`, title: `named in ${c.hits} of ${c.asks} answers` };
  return { bg: '#eceae3', fg: 'var(--muted)', txt: '0', title: `not named in any of ${c.asks} answers` };
};

function Matrix({ data }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const rows = data.byPrompt || [];
  const engines = (data.byModel || []).filter((m) => m.measured);
  if (!rows.length || !engines.length) return null;
  const shown = showAll ? rows : rows.slice(0, 10);

  return html`
    <div ref=${ref} class=${cx(anim)}>
      <!-- legend: always present; the ramp is ordinal, so it reads left to right -->
      <div class="flex items-center gap-4 text-xs mb-2.5 flex-wrap" style="color:var(--ink2)">
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background:#eceae3"></span>Not named</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background:var(--s1-lo)"></span>Named</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background:var(--s1-hi)"></span>Named and linked</span>
        <span class="ml-auto" style="color:var(--muted)">Each cell: times named ÷ times asked</span>
      </div>

      <!-- ≥sm: the matrix, which is also the accessible table twin -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[11px] uppercase tracking-wide" style="color:var(--muted)">
            <th class="pb-2 pr-3 font-semibold">What the customer asked</th>
            ${engines.map((e) => html`<th class="pb-2 px-1 font-semibold text-center whitespace-nowrap">${e.label}</th>`)}
          </tr></thead>
          <tbody>
            ${shown.map((r, i) => html`
              <tr class="rise border-t" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 10) * 35}ms`}>
                <td class="py-2 pr-3 max-w-[22rem]" style="color:var(--ink)">
                  <span class="block truncate" title=${r.prompt}>${r.prompt}</span>
                </td>
                ${engines.map((e) => {
                  const t = cellTone(r.cells[e.key]);
                  return html`<td class="py-1.5 px-1 text-center">
                    <span class="inline-flex items-center justify-center rounded-md text-[11px] font-semibold tnum w-11 h-7"
                          style=${`background:${t.bg};color:${t.fg}`} title=${`${e.label}: ${t.title}`}>${t.txt}</span>
                  </td>`;
                })}
              </tr>`)}
          </tbody>
        </table>
      </div>

      <!-- <sm: one card per question -->
      <div class="sm:hidden space-y-2">
        ${shown.map((r, i) => html`
          <div class="rise rounded-xl border p-3" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 10) * 35}ms`}>
            <div class="text-sm font-medium" style="color:var(--ink)">${r.prompt}</div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              ${engines.map((e) => {
                const t = cellTone(r.cells[e.key]);
                return html`<span class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                                  style=${`background:${t.bg};color:${t.fg}`} title=${t.title}>
                  <span class="font-normal">${e.label}</span><span class="tnum">${t.txt}</span>
                </span>`;
              })}
            </div>
          </div>`)}
      </div>

      ${rows.length > 10 && html`
        <button onClick=${() => setShowAll(!showAll)}
          class="mt-3 text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
          ${showAll ? 'Show top 10' : `Show all ${rows.length} questions`}
        </button>`}
    </div>`;
}

// ===========================================================================
// 6. THE QUOTES — the part clients actually read twice
// ===========================================================================
const SENT = {
  positive: { label: 'positive', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  neutral: { label: 'neutral', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  negative: { label: 'negative', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
};

function Quotes({ data }) {
  const [ref, anim] = useInView();
  const [showAll, setShowAll] = useState(false);
  const qs = data.quotes || [];
  if (!qs.length) return null;
  const shown = showAll ? qs : qs.slice(0, 4);
  return html`
    <div ref=${ref} class=${cx('grid grid-cols-1 lg:grid-cols-2 gap-3', anim)}>
      ${shown.map((q, i) => {
        const s = SENT[q.sentiment] || SENT.neutral;
        return html`
          <figure class="rise rounded-xl border p-3 sm:p-4 bg-white" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 6) * 60}ms`}>
            <div class="flex items-center gap-2 flex-wrap text-[11px]">
              <span class="font-semibold uppercase tracking-wide" style="color:var(--brand-ink)">${q.label}</span>
              <span class=${cx('inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide ring-1 ring-inset text-[10px]', s.cls)}>${s.label}</span>
              ${q.position && html`<span class="tnum" style="color:var(--muted)">listed #${q.position}</span>`}
              ${q.cited && html`<span style="color:var(--good)">· linked to your site</span>`}
            </div>
            <p class="text-[11px] mt-1.5 italic" style="color:var(--muted)">asked: “${q.prompt}”</p>
            <blockquote class="mt-2 pl-3 border-l-2 text-sm leading-relaxed" style="border-color:var(--brand);color:var(--ink)">
              ${q.snippet}
            </blockquote>
            <figcaption class="text-[11px] mt-2 flex items-center gap-1.5 flex-wrap" style="color:var(--muted)">
              <span>${q.label}, ${new Date(q.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <${Est} basis=${q.basis === 'measured' ? 'measured' : 'derived'} />
            </figcaption>
          </figure>`;
      })}
      ${qs.length > 4 && html`
        <div class="lg:col-span-2">
          <button onClick=${() => setShowAll(!showAll)}
            class="text-sm font-semibold underline underline-offset-2 py-2 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
            ${showAll ? 'Show fewer quotes' : `Show all ${qs.length} quotes`}
          </button>
        </div>`}
    </div>`;
}

// ===========================================================================
// 7. THE METHOD BLOCK — never collapsed, never shortened
// ===========================================================================
// The charts above are only defensible because this is sitting under them. It
// comes from the FUNCTION, not from this file, so a share link and a future
// PDF cannot render the section without it.
const Method = ({ method }) => !method ? null : html`
  <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid);background:#f8fafc">
    <div class="text-sm font-semibold" style="color:var(--ink)">${method.title}</div>
    <ul class="mt-1.5 space-y-1.5 text-xs list-disc pl-4" style="color:var(--ink2)">
      ${(method.lines || []).map((t) => html`<li>${t}</li>`)}
    </ul>
  </div>`;

// ===========================================================================
export function AiVisibility({ data, onAction }) {
  if (!data) return null;

  // Day one: nothing measured yet. Say so plainly and, in the app only, offer
  // the way forward — a client link should never show an agency to-do.
  if (!data.configured) {
    return html`
      <section>
        <${SectionHead} eyebrow="AI search visibility" title="When customers ask an AI assistant, do you come up?"
          sub="Claude, ChatGPT, Gemini, Perplexity and Google's AI Overviews, asked the questions your customers actually type." />
        <div class="rounded-xl border border-dashed p-8 text-center" style="border-color:var(--grid)">
          <div class="text-sm" style="color:var(--muted)">
            ${data.promptCount > 0
              ? 'The questions are set up — the first monthly measurement has not run yet.'
              : 'Not measured yet.'}
          </div>
          ${onAction && html`
            <button onClick=${() => onAction('aivis')}
              class="mt-3 text-sm font-semibold underline underline-offset-2 min-h-[2.75rem] lg:min-h-0 px-2" style="color:var(--brand-ink)">
              ${data.promptCount > 0 ? 'Run the first measurement' : 'Set up the questions'}
            </button>`}
        </div>
      </section>`;
  }

  const h = data.headline || {};
  const measured = (data.byModel || []).filter((m) => m.measured);
  const missing = (data.byModel || []).filter((m) => !m.measured);

  return html`
    <section class="space-y-4">
      <${SectionHead} eyebrow="AI search visibility"
        title="When customers ask an AI assistant, do you come up?"
        sub=${`${measured.length} assistant${measured.length === 1 ? '' : 's'}, asked the questions your customers actually type${data.repeats > 1 ? `, ${data.repeats} times each` : ''}.`} />

      <${Headline} data=${data} />

      <!-- The three figures that carry the section, each with its denominator. -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <${Tile} label="Answers naming you" value=${pct(h.mentionRate, 0)}
          sub=${`${count(Math.round((h.mentionRate || 0) * (h.asks || 0)))} of ${count(h.asks)} answers`} basis="measured" />
        <${Tile} label="Answers linking to you" value=${pct(h.citeRate, 0)}
          sub="assistants that cited your site as a source" basis="measured" />
        <${Tile} label="Questions covered" value=${`${h.promptsHit} / ${h.promptsTotal}`}
          sub="customer questions you appeared in" tone="brand" basis="measured" />
        <${Tile} label="Assistants measured" value=${String(measured.length)}
          sub=${missing.length ? `${missing.length} not connected yet` : 'all connected'} basis="measured" />
      </div>

      ${missing.length > 0 && data.view !== 'client' && html`
        <div class="rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2.5" style="border-color:#fde68a;background:#fffbeb;color:#78350f">
          <span class="shrink-0 leading-none pt-0.5">↗</span>
          <span class="flex-1">
            ${missing.map((m) => m.label).join(', ')} ${missing.length === 1 ? 'is' : 'are'} not connected yet, so ${missing.length === 1 ? 'it was' : 'they were'} not measured this period —
            these are gaps in our coverage, not absences of the client. Add the API key${missing.length === 1 ? '' : 's'} and the next run picks ${missing.length === 1 ? 'it' : 'them'} up.
          </span>
          ${onAction && html`
            <button onClick=${() => onAction('aivis')} class="shrink-0 font-semibold underline underline-offset-2 min-h-[2.75rem] lg:min-h-0 px-1 -my-1 flex items-center">Set up</button>`}
        </div>`}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <${ByEngine} data=${data} />
        <${ShareOfVoice} data=${data} />
      </div>

      ${(data.trend || []).length > 0 && html`
        <div>
          <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">Month by month</div>
          <${Trend} data=${data} />
        </div>`}

      <div>
        <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">Every question we asked</div>
        <${Matrix} data=${data} />
      </div>

      ${(data.quotes || []).length > 0 && html`
        <div>
          <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">What they actually said about you</div>
          <${Quotes} data=${data} />
        </div>`}

      <${Method} method=${data.method} />
    </section>`;
}
