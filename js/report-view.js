// ---------------------------------------------------------------------------
// report-view.js — the Reporting tab's visual system, shared VERBATIM between
// the in-app tab (js/report.js) and the public share page (js/report-public.js)
// so a client link renders pixel-identical to what the agency sees.
//
// Every visual is hand-built inline SVG + CSS/Web Animations. The app has no
// build step and no CDN chart library, and it doesn't need one.
//
// COLOR (per the dataviz method — palette validated, not eyeballed):
//   Series colors come from a fixed validated palette, NOT from the client's
//   brand. Brand hues vary per business and cannot be checked for colorblind
//   separation at build time, so brand color takes the ACCENT role — the
//   header band, the flow in the money loop, and the single emphasised figure
//   that the whole report is about (gross profit). Data identity stays on the
//   validated slots. Validated on a #ffffff surface with
//   scripts/validate_palette.js:
//     categorical  #2a78d6,#eb6834,#1baf7a,#eda100  → ALL CHECKS PASS
//                  (contrast WARN on aqua/yellow → relief is satisfied: every
//                   value carries a visible label and the ledger has a table)
//     diverging    #2a78d6 ↔ #e34948               → ALL CHECKS PASS
//
// The app is light-only by design (body is bg-slate-50 and there is no theme
// toggle anywhere in Ops Dash), so this commits to a single look and stamps
// color-scheme: light rather than auto-flipping on the viewer's OS setting.
// ---------------------------------------------------------------------------
import { html, useState, useEffect, useRef, useMemo, cx } from './lib.js';

// ── formatting ─────────────────────────────────────────────────────────────
export const money = (v, { compact = false } = {}) => {
  const x = Number(v) || 0;
  if (compact) {
    const a = Math.abs(x);
    if (a >= 1e6) return `${x < 0 ? '−' : ''}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
    if (a >= 1e4) return `${x < 0 ? '−' : ''}$${Math.round(a / 1e3)}K`;
    if (a >= 1e3) return `${x < 0 ? '−' : ''}$${(a / 1e3).toFixed(1)}K`;
  }
  return `${x < 0 ? '−' : ''}$${Math.round(Math.abs(x)).toLocaleString()}`;
};
export const count = (v, { compact = false } = {}) => {
  const x = Math.round(Number(v) || 0);
  if (compact) {
    const a = Math.abs(x);
    if (a >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
    if (a >= 1e4) return `${Math.round(x / 1e3)}K`;
  }
  return x.toLocaleString();
};
export const pct = (v, d = 1) => (v == null || !isFinite(v) ? '—' : `${(Number(v) * 100).toFixed(d)}%`);
const fmtBy = (unit, compact) => (v) => (unit === 'money' ? money(v, { compact }) : count(v, { compact }));

// ── brand color → a usable accent ──────────────────────────────────────────
// A brand hex can be anything, including something illegible as text on white.
// These derive an ink-safe variant without ever changing what the mark means.
const hex2rgb = (h) => {
  const s = String(h || '').replace('#', '').trim();
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(f)) return null;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastOnWhite = (rgb) => 1.05 / (lum(rgb) + 0.05);
const rgb2hex = (rgb) => '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
export function brandTokens(hex) {
  const rgb = hex2rgb(hex) || hex2rgb('#50b0bd');            // Ops Dash brand-500 fallback
  let ink = rgb;
  // Darken toward black until the color clears 4.5:1 as text on white.
  for (let i = 0; i < 24 && contrastOnWhite(ink) < 4.5; i++) ink = ink.map((c) => c * 0.9);
  const wash = rgb.map((c) => c + (255 - c) * 0.9);          // 10% tint for fills
  const onBrand = lum(rgb) > 0.45 ? '#0b0b0b' : '#ffffff';   // ink that sits ON the brand
  return { brand: rgb2hex(rgb), brandInk: rgb2hex(ink), brandWash: rgb2hex(wash), onBrand };
}

// ── one-time stylesheet (identical in the app and on the share page) ────────
const VIZ_CSS = `
.viz{color-scheme:light;
  --s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--neg:#e34948;
  --good:#0ca30c;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;
  --grid:#e1e0d9;--axis:#c3c2b7;--surface:#ffffff;
  --s1-lo:#86b6ef;--s1-hi:#1c5cab;
  --brand:#50b0bd;--brand-ink:#2c5c64;--brand-wash:#eef7f9;--on-brand:#ffffff;}
/* The resting state of every animated mark is VISIBLE. The hidden start only
   exists inside an .armed wrapper, which JS adds when it has both armed an
   observer AND started the fallback timer that is guaranteed to reveal. So no
   failure of the observer (offscreen tab, unsupported, silent) can ever leave
   the report blank - the worst case is that it appears without animating. */
.viz .armed .rise{opacity:0;transform:translateY(10px);}
.viz .armed.in .rise{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.3,1);}
.viz .armed .grow{transform:scaleX(0);transform-origin:left center;}
.viz .armed.in .grow{transform:scaleX(1);transition:transform .8s cubic-bezier(.2,.7,.3,1);}
.viz .armed .growy{transform:scaleY(0);transform-origin:bottom center;}
.viz .armed.in .growy{transform:scaleY(1);transition:transform .7s cubic-bezier(.2,.7,.3,1);}
.viz .armed .draw{stroke-dasharray:var(--len,600);stroke-dashoffset:var(--len,600);}
.viz .armed.in .draw{stroke-dashoffset:0;transition:stroke-dashoffset 1.1s ease-out;}
.viz .armed .sweep{stroke-dasharray:var(--len,300);stroke-dashoffset:var(--len,300);}
.viz .armed.in .sweep{stroke-dashoffset:var(--off,0);transition:stroke-dashoffset 1s cubic-bezier(.2,.7,.3,1);}
.viz .flow{stroke-dasharray:3 7;animation:vizflow 1.1s linear infinite;}
@keyframes vizflow{to{stroke-dashoffset:-20;}}
.viz .tnum{font-variant-numeric:tabular-nums;}
.viz .dot{stroke:var(--surface);stroke-width:2;}
@media (prefers-reduced-motion:reduce){
  .viz .armed .rise,.viz .armed.in .rise{opacity:1;transform:none;transition:none;}
  .viz .armed .grow,.viz .armed.in .grow,.viz .armed .growy,.viz .armed.in .growy{transform:none;transition:none;}
  .viz .armed .draw,.viz .armed.in .draw,.viz .armed .sweep,.viz .armed.in .sweep{stroke-dashoffset:0;transition:none;}
  .viz .flow{animation:none;stroke-dasharray:none;}
}
@media print{
  .viz .armed .rise{opacity:1;transform:none;}
  .viz .armed .grow,.viz .armed .growy{transform:none;}
  .viz .armed .draw,.viz .armed .sweep{stroke-dashoffset:0;}
  .viz .flow{animation:none;}
}
`;
let cssDone = false;
export function ensureVizCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const el = document.createElement('style');
  el.id = 'viz-css';
  el.textContent = VIZ_CSS;
  document.head.appendChild(el);
}

// ── scroll-triggered reveal ────────────────────────────────────────────────
// Returns [ref, className, shown]. The className is '' (never animate),
// 'armed' (hidden, waiting) or 'armed in' (revealed).
//
// The whole report is client-rendered, so JS running is a given — but an
// IntersectionObserver FIRING is not. An offscreen or non-compositing tab
// never delivers entries, and a tall section can sit below a threshold
// forever. A hard timer therefore reveals unconditionally, so the observer is
// only ever an optimisation that makes the reveal happen EARLIER. This was a
// real bug caught in verification: with the reveal gated on the observer
// alone, 31 of 44 marks stayed at opacity 0 permanently.
const REVEAL_FALLBACK_MS = 1200;
export function useInView() {
  const ref = useRef(null);
  const [cls, setCls] = useState(() => (reduced() ? 'armed in' : 'armed'));
  useEffect(() => {
    if (cls.includes('in')) return;
    const el = ref.current;
    let done = false;
    const finish = () => { if (!done) { done = true; setCls('armed in'); } };
    let io = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { finish(); io.disconnect(); } },
        { threshold: 0, rootMargin: '0px 0px -40px 0px' });
      io.observe(el);
    }
    const t = setTimeout(finish, REVEAL_FALLBACK_MS);
    return () => { clearTimeout(t); io?.disconnect(); };
  }, []);
  return [ref, cls, cls.includes('in')];
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts up to `value` once `run` flips true. Proportional figures (never
// tabular) — a big standalone number looks loose with equal-width digits.
export function CountUp({ value, fmt = count, run = true, ms = 900, class: cls = '' }) {
  const [v, setV] = useState(run && !reduced() ? 0 : value);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) return;
    if (reduced()) { setV(value); return; }
    const target = Number(value) || 0;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - (1 - p) ** 3));                     // easeOutCubic
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [run, value, ms]);
  return html`<span class=${cls}>${fmt(v)}</span>`;
}

// ── honesty markers ────────────────────────────────────────────────────────
// Decision #2 (2026-08-12): model the money for unlinked businesses, but mark
// every modelled figure. Never fake precision.
const BASIS = {
  measured: { label: 'measured', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', title: 'Counted from real Job Tracker records.' },
  derived: { label: 'derived', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20', title: 'Calculated from measured numbers plus one stated rate.' },
  estimated: { label: 'estimated', cls: 'bg-amber-50 text-amber-800 ring-amber-600/30', title: 'Modelled from the assumptions listed under this report — not measured.' },
};
export const Est = ({ basis = 'estimated', class: cls = '' }) => {
  const b = BASIS[basis] || BASIS.estimated;
  if (basis === 'measured') return null;                     // measured is the norm; don't decorate it
  return html`<span title=${b.title}
    class=${cx('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset align-middle', b.cls, cls)}>${b.label}</span>`;
};

export const SectionHead = ({ eyebrow, title, sub, right }) => html`
  <div class="flex items-end justify-between gap-4 flex-wrap mb-3">
    <div class="min-w-0">
      ${eyebrow && html`<div class="text-[11px] font-semibold uppercase tracking-widest" style="color:var(--brand-ink)">${eyebrow}</div>`}
      <h2 class="text-lg sm:text-xl font-bold tracking-tight" style="color:var(--ink)">${title}</h2>
      ${sub && html`<p class="text-sm mt-0.5" style="color:var(--ink2)">${sub}</p>`}
    </div>
    ${right}
  </div>`;

// ===========================================================================
// 1. THE MONEY LOOP (hero)
// ===========================================================================
// Spend → Visibility → Demand → Leads → Booked jobs → Revenue → Gross profit.
//
// FORM NOTE: the stages carry INCOMPATIBLE UNITS (dollars, impressions, jobs),
// so the nodes are deliberately all the same size. Scaling them into a funnel
// would encode a magnitude comparison that does not exist. What flows between
// them is the conversion, and each connector states it in its own unit.
//
// COLOR: emphasis, not categorical — money out (spend) in slot 2, the payoff
// (gross profit) in the client's brand, everything between in slot 1. Eight
// hues here would bury the one number the report is about.
const LOOP_TONE = {
  spend: { rule: 'var(--s2)', wash: '#fef4ee' },
  profit: { rule: 'var(--brand)', wash: 'var(--brand-wash)' },
  _: { rule: 'var(--s1)', wash: '#f4f8fd' },
};

function LoopNode({ stage, i, seen }) {
  const tone = LOOP_TONE[stage.key] || LOOP_TONE._;
  const isProfit = stage.key === 'profit';
  const fmt = fmtBy(stage.unit, true);
  return html`
    <!-- Seven stages in one row is tight: the value steps DOWN between sm and
         lg so a number can never outgrow its node. Verified by measuring
         scrollWidth vs clientWidth at 375 / 768 / 1280 — a value that spills
         its box is the same failure as a clipped one. -->
    <div class="rise flex-1 min-w-0 rounded-xl border p-3 lg:p-2.5 xl:p-3.5"
         style=${`transition-delay:${i * 90}ms;background:${tone.wash};border-color:rgba(11,11,11,.08)`}>
      <div class="h-1 w-8 rounded-full mb-2" style=${`background:${tone.rule}`}></div>
      <div class="text-[11px] lg:text-[10px] xl:text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1 flex-wrap" style="color:var(--ink2)">
        <span>${stage.label}</span><${Est} basis=${stage.basis} />
      </div>
      <div class=${cx('mt-0.5 font-extrabold tracking-tight leading-none', isProfit ? 'text-2xl lg:text-lg xl:text-2xl' : 'text-xl lg:text-base xl:text-xl')}
           style=${isProfit ? 'color:var(--brand-ink)' : 'color:var(--ink)'}>
        <${CountUp} value=${stage.value} fmt=${fmt} run=${seen} ms=${700 + i * 60} />
      </div>
      <div class="text-[11px] lg:text-[10px] xl:text-[11px] mt-0.5 truncate" style="color:var(--muted)" title=${stage.detail || stage.suffix || ''}>
        ${stage.detail || stage.suffix || ' '}
      </div>
    </div>`;
}

function LoopLink({ link, i }) {
  const val = link.value == null ? '—'
    : link.kind === 'pct' ? pct(link.value, link.value < 0.01 ? 2 : 1)
    : link.kind === 'money' ? money(link.value, { compact: true })
    : money(link.value);
  return html`
    <div class="rise flex lg:flex-col items-center gap-1.5 lg:gap-1 shrink-0 lg:w-[3.25rem] xl:w-[4.25rem] py-1 lg:py-0"
         style=${`transition-delay:${i * 90 + 45}ms`}>
      <!-- horizontal arrow (sm and up) -->
      <svg viewBox="0 0 60 12" class="hidden lg:block w-full h-3 overflow-visible" aria-hidden="true">
        <line x1="2" y1="6" x2="52" y2="6" stroke="var(--grid)" stroke-width="2" stroke-linecap="round" />
        <line class="flow" x1="2" y1="6" x2="52" y2="6" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" />
        <path d="M52 2.5 L58 6 L52 9.5 Z" fill="var(--brand)" />
      </svg>
      <!-- vertical arrow (mobile) -->
      <svg viewBox="0 0 12 34" class="lg:hidden h-8 w-3 shrink-0 overflow-visible" aria-hidden="true">
        <line x1="6" y1="2" x2="6" y2="26" stroke="var(--grid)" stroke-width="2" stroke-linecap="round" />
        <line class="flow" x1="6" y1="2" x2="6" y2="26" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" />
        <path d="M2.5 26 L6 32 L9.5 26 Z" fill="var(--brand)" />
      </svg>
      <div class="text-center leading-tight min-w-0">
        <div class="text-[13px] lg:text-[10px] xl:text-xs font-bold tnum" style="color:var(--ink)">${val}</div>
        <div class="text-[10px] lg:text-[9px] xl:text-[10px]" style="color:var(--muted)">${link.label}</div>
      </div>
    </div>`;
}

export function MoneyLoop({ loop, hero }) {
  const [ref, anim, seen] = useInView();
  const stages = loop?.stages || [];
  const links = loop?.links || [];
  const linkFor = (key) => links.find((l) => l.from === key);
  return html`
    <div ref=${ref} class=${cx('viz-loop', anim)}>
      <div class="flex flex-col lg:flex-row lg:items-stretch gap-0 lg:gap-1">
        ${stages.map((s, i) => {
          const link = i < stages.length - 1 ? linkFor(s.key) : null;
          return html`
            <${LoopNode} stage=${s} i=${i} seen=${seen} />
            ${link && html`<${LoopLink} link=${link} i=${i} />`}`;
        })}
      </div>
      ${hero}
    </div>`;
}

// ===========================================================================
// 2. RANK-TO-REVENUE LEDGER
// ===========================================================================
// Per keyword: what the ranking is worth today vs. what #1 would be worth.
// FORM: a dumbbell — one hue, two shades — because the job is "before → after
// per item". The gap between the dots IS the money left on the table.
function Dumbbell({ now, top, max, label }) {
  const w = (v) => `${Math.max(0.5, Math.min(100, (v / max) * 100))}%`;
  return html`
    <div class="relative h-4 flex items-center" title=${label}>
      <div class="absolute inset-x-0 h-px" style="background:var(--grid)"></div>
      <div class="absolute h-1 rounded-full grow" style=${`left:${w(now)};width:calc(${w(top)} - ${w(now)});background:var(--s1-lo)`}></div>
      <div class="absolute h-2.5 w-2.5 rounded-full dot" style=${`left:calc(${w(now)} - 5px);background:var(--s1-lo)`}></div>
      <div class="absolute h-2.5 w-2.5 rounded-full dot" style=${`left:calc(${w(top)} - 5px);background:var(--s1-hi)`}></div>
    </div>`;
}

const posTone = (p) => (p <= 3 ? 'bg-emerald-50 text-emerald-700' : p <= 10 ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600');

export function RankLedger({ ledger, limit = 12 }) {
  const [ref, anim, seen] = useInView();
  const [showAll, setShowAll] = useState(false);
  const rows = ledger?.rows || [];
  const shown = showAll ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...rows.slice(0, 60).map((r) => r.valueTop));
  const est = ledger?.estimated;

  if (!rows.length) {
    return html`<div class="rounded-xl border border-dashed p-8 text-center text-sm" style="border-color:var(--grid);color:var(--muted)">
      No ranked keywords with search volume yet — the ledger fills in as Search Console data and keyword research land.
    </div>`;
  }

  return html`<div ref=${ref} class=${cx(anim)}>
    <!-- legend: two shades of one hue, always present (2 series) -->
    <div class="flex items-center gap-4 text-xs mb-2.5 flex-wrap" style="color:var(--ink2)">
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:var(--s1-lo)"></span>Worth today</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:var(--s1-hi)"></span>Worth at #1</span>
      <span class="ml-auto" style="color:var(--muted)">Sorted by money left on the table</span>
    </div>

    <!-- ≥sm: the table view (also the WCAG-clean twin of the dumbbells) -->
    <div class="hidden sm:block overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-[11px] uppercase tracking-wide" style="color:var(--muted)">
          <th class="pb-2 pr-3 font-semibold">Keyword</th>
          <th class="pb-2 pr-3 font-semibold text-right">Pos.</th>
          <th class="pb-2 pr-3 font-semibold text-right">Searches/mo</th>
          <th class="pb-2 pr-3 font-semibold w-32">Today → #1</th>
          <th class="pb-2 pr-3 font-semibold text-right">Worth today</th>
          <th class="pb-2 pr-3 font-semibold text-right">At #1</th>
          <th class="pb-2 font-semibold text-right">On the table</th>
        </tr></thead>
        <tbody>
          ${shown.map((r, i) => html`
            <tr class="rise border-t" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 12) * 35}ms`}>
              <td class="py-2 pr-3 font-medium max-w-[15rem] truncate" style="color:var(--ink)" title=${r.keyword}>${r.keyword}</td>
              <td class="py-2 pr-3 text-right">
                <span class=${cx('inline-block rounded-full px-1.5 py-0.5 text-xs font-semibold tnum', posTone(r.position))}>${r.position.toFixed(1)}</span>
              </td>
              <td class="py-2 pr-3 text-right tnum" style="color:var(--ink2)">
                ${count(r.volume)}${r.volSource === 'impressions' && html`<span title="No third-party volume for this term — this is the site's own impressions, which under-states the market." style="color:var(--muted)">*</span>`}
              </td>
              <td class="py-2 pr-3"><${Dumbbell} now=${r.valueNow} top=${r.valueTop} max=${max} label=${`${money(r.valueNow)} today → ${money(r.valueTop)} at #1`} /></td>
              <td class="py-2 pr-3 text-right tnum" style="color:var(--ink2)">${money(r.valueNow, { compact: true })}</td>
              <td class="py-2 pr-3 text-right tnum" style="color:var(--ink2)">${money(r.valueTop, { compact: true })}</td>
              <td class="py-2 text-right tnum font-bold" style="color:var(--brand-ink)">${money(r.gap, { compact: true })}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>

    <!-- <sm: one card per keyword; a 7-column table is unusable on a phone -->
    <div class="sm:hidden space-y-2">
      ${shown.map((r, i) => html`
        <div class="rise rounded-xl border p-3" style=${`border-color:var(--grid);transition-delay:${Math.min(i, 12) * 35}ms`}>
          <div class="flex items-start justify-between gap-2">
            <div class="font-medium text-sm min-w-0 flex-1" style="color:var(--ink)">${r.keyword}</div>
            <span class=${cx('shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tnum', posTone(r.position))}>#${r.position.toFixed(1)}</span>
          </div>
          <div class="mt-2"><${Dumbbell} now=${r.valueNow} top=${r.valueTop} max=${max} label=${`${money(r.valueNow)} → ${money(r.valueTop)}`} /></div>
          <div class="mt-1.5 flex items-baseline justify-between gap-2 text-xs" style="color:var(--ink2)">
            <span class="tnum">${money(r.valueNow, { compact: true })} → ${money(r.valueTop, { compact: true })}</span>
            <span class="tnum font-bold" style="color:var(--brand-ink)">+${money(r.gap, { compact: true })}</span>
          </div>
          <div class="mt-0.5 text-[11px] tnum" style="color:var(--muted)">${count(r.volume)} searches/mo${r.volSource === 'impressions' ? '*' : ''}</div>
        </div>`)}
    </div>

    <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
      ${rows.length > limit && html`
        <button onClick=${() => setShowAll(!showAll)} class="text-sm font-semibold underline underline-offset-2 py-2 -my-1 min-h-[2.75rem] lg:min-h-0 flex items-center" style="color:var(--brand-ink)">
          ${showAll ? 'Show top ' + limit : `Show all ${rows.length} keywords`}
        </button>`}
      <div class="text-xs ml-auto text-right" style="color:var(--muted)">
        ${est && html`<${Est} basis="estimated" class="mr-1" />`}
        Every figure here = position × searches × the ${ledger?.ctrCitation?.label || 'CTR curve'} × close rate × average ticket.
      </div>
    </div>
  </div>`;
}

// The cited CTR curve, drawn. Its job is to make the 1→2 cliff visible — that
// cliff is the entire argument of the ledger above it.
export function CtrCurve({ curve, citation, markPosition }) {
  const [ref, anim, seen] = useInView();
  const pts = useMemo(() => Object.entries(curve || {}).map(([p, v]) => ({ p: +p, v: +v })).sort((a, b) => a.p - b.p).slice(0, 10), [curve]);
  if (!pts.length) return null;
  const W = 320, H = 120, PL = 30, PR = 8, PT = 10, PB = 22;
  const maxV = Math.max(...pts.map((d) => d.v));
  const x = (p) => PL + ((p - 1) / 9) * (W - PL - PR);
  const y = (v) => PT + (1 - v / maxV) * (H - PT - PB);
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(d.p).toFixed(1)} ${y(d.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(10).toFixed(1)} ${H - PB} L${x(1).toFixed(1)} ${H - PB} Z`;
  const mark = markPosition && markPosition >= 1 && markPosition <= 10 ? Math.round(markPosition) : null;
  return html`
    <div ref=${ref} class=${cx(anim)}>
      <svg viewBox=${`0 0 ${W} ${H}`} class="w-full h-auto" role="img"
           aria-label=${`Organic click-through rate by position: #1 ${pct(pts[0].v)}, #2 ${pct(pts[1]?.v)}, falling to ${pct(pts[9]?.v)} at #10.`}>
        ${[0, 0.5, 1].map((f) => html`<line x1=${PL} x2=${W - PR} y1=${y(maxV * f)} y2=${y(maxV * f)} stroke="var(--grid)" stroke-width="1" />`)}
        ${[0, 0.5, 1].map((f) => html`<text x=${PL - 5} y=${y(maxV * f) + 3.5} text-anchor="end" font-size="8" fill="var(--muted)" class="tnum">${Math.round(maxV * f * 100)}%</text>`)}
        <path d=${area} fill="var(--s1)" opacity="0.10" />
        <path d=${line} fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="draw" style="--len:420" />
        ${mark && html`
          <line x1=${x(mark)} x2=${x(mark)} y1=${PT} y2=${H - PB} stroke="var(--brand)" stroke-width="1" />
          <circle cx=${x(mark)} cy=${y(pts[mark - 1].v)} r="4.5" fill="var(--brand)" class="dot" />`}
        <circle cx=${x(1)} cy=${y(pts[0].v)} r="4.5" fill="var(--s1)" class="dot" />
        <text x=${x(1) + 8} y=${y(pts[0].v) + 3} font-size="9" font-weight="700" fill="var(--ink)" class="tnum">${pct(pts[0].v, 1)} at #1</text>
        ${[1, 3, 5, 10].map((p) => html`<text x=${x(p)} y=${H - 7} text-anchor="middle" font-size="8" fill="var(--muted)">#${p}</text>`)}
      </svg>
      ${citation && html`<p class="text-[11px] leading-snug mt-1" style="color:var(--muted)">
        <span class="font-semibold" style="color:var(--ink2)">${citation.label}.</span> ${citation.note}
      </p>`}
    </div>`;
}

// ===========================================================================
// 3. MARKETING P&L — a waterfall
// ===========================================================================
// FORM: revenue in, costs out, contribution left. That is polarity, so the
// color job is diverging — the validated blue↔red pair. Horizontal bars keep
// long money labels readable and reflow to any width without measurement.
export function Waterfall({ items }) {
  const [ref, anim, seen] = useInView();
  let run = 0;
  const steps = items.map((it) => {
    const start = it.total ? 0 : run;
    const end = it.total ? it.value : run + it.value;
    if (!it.total) run += it.value;
    else run = it.value;
    return { ...it, start, end, lo: Math.min(start, end), hi: Math.max(start, end) };
  });
  const max = Math.max(1, ...steps.map((s) => Math.max(Math.abs(s.hi), Math.abs(s.lo))));
  const p = (v) => (Math.abs(v) / max) * 100;
  return html`
    <div ref=${ref} class=${cx('space-y-2', anim)}>
      ${steps.map((s, i) => {
        const neg = s.value < 0;
        const fill = s.total ? (s.value < 0 ? 'var(--neg)' : 'var(--s1-hi)') : neg ? 'var(--neg)' : 'var(--s1)';
        return html`
          <div class="rise" style=${`transition-delay:${i * 70}ms`}>
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class=${cx('truncate', s.total ? 'font-bold' : 'font-medium')} style=${s.total ? 'color:var(--ink)' : 'color:var(--ink2)'}>
                ${s.label}${s.est && html` <${Est} basis="estimated" />`}
              </span>
              <span class=${cx('tnum shrink-0', s.total ? 'font-bold' : '')} style=${s.total ? 'color:var(--ink)' : 'color:var(--ink2)'}>
                ${s.note ? s.note : (s.value < 0 ? '−' : s.total ? '' : '+') + money(Math.abs(s.value))}
              </span>
            </div>
            <div class="relative h-2.5 mt-1 rounded-full" style="background:#f4f4f2">
              <div class="absolute inset-y-0 rounded-[4px] grow"
                   style=${`left:${p(s.lo)}%;width:${Math.max(0.8, p(s.hi) - p(s.lo))}%;background:${fill};transform-origin:${neg ? 'right' : 'left'} center;transition-delay:${i * 70}ms`}></div>
            </div>
          </div>`;
      })}
    </div>`;
}

// A stat tile. `delta`/`bench` are optional; `basis` drives the honesty pill.
export function Tile({ label, value, sub, basis, tone, big }) {
  const color = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--neg)' : tone === 'brand' ? 'var(--brand-ink)' : 'var(--ink)';
  return html`
    <div class="rounded-xl border p-3 sm:p-3.5 bg-white" style="border-color:var(--grid)">
      <div class="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1 flex-wrap" style="color:var(--muted)">
        <span>${label}</span>${basis && html`<${Est} basis=${basis} />`}
      </div>
      <div class=${cx('font-extrabold tracking-tight mt-0.5 leading-none', big ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl')} style=${`color:${color}`}>${value}</div>
      ${sub && html`<div class="text-[11px] mt-1 leading-snug" style="color:var(--muted)">${sub}</div>`}
    </div>`;
}

// A ratio against a benchmark. The unfilled track is a lighter step of the
// fill's own ramp, so the state reads across the whole bar.
export function Meter({ value, target, label, format = (v) => v.toFixed(1) + ':1' }) {
  const [ref, anim, seen] = useInView();
  if (value == null) return null;
  const ratio = Math.max(0, Math.min(1, value / (target * 1.6)));
  const good = value >= target;
  return html`
    <div ref=${ref} class=${cx(anim)}>
      <div class="flex items-baseline justify-between text-xs mb-1">
        <span style="color:var(--ink2)">${label}</span>
        <span class="font-bold tnum" style=${`color:${good ? 'var(--good)' : 'var(--s4)'}`}>${format(value)}</span>
      </div>
      <div class="relative h-2 rounded-full" style="background:var(--s1-lo);opacity:.35"></div>
      <div class="relative -mt-2 h-2">
        <div class="h-2 rounded-[4px] grow" style=${`width:${ratio * 100}%;background:${good ? 'var(--good)' : 'var(--s4)'}`}></div>
        <div class="absolute top-[-3px] h-3.5 w-px" style=${`left:${(target / (target * 1.6)) * 100}%;background:var(--axis)`}></div>
      </div>
      <div class="text-[10px] mt-1" style="color:var(--muted)">Healthy is ${format(target)} or better</div>
    </div>`;
}

// ===========================================================================
// 4. TREND — small multiples
// ===========================================================================
// Clicks, ad spend and revenue live on wildly different scales. A dual axis
// would invent a correlation, so each measure gets its own panel and its own
// y-scale — one series per panel, hence no legend (the title names it).
function Spark({ series, label, unit, tone }) {
  const [ref, anim, seen] = useInView();
  const vals = series.map((d) => Number(d.v) || 0);
  const has = vals.some((v) => v > 0);
  const W = 260, H = 74, PT = 8, PB = 16, PL = 2, PR = 2;
  const max = Math.max(1, ...vals);
  const x = (i) => PL + (series.length === 1 ? 0.5 : i / (series.length - 1)) * (W - PL - PR);
  const y = (v) => PT + (1 - v / max) * (H - PT - PB);
  const line = series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(' ');
  const last = series[series.length - 1];
  const fmt = unit === 'money' ? (v) => money(v, { compact: true }) : (v) => count(v, { compact: true });
  return html`
    <div ref=${ref} class=${cx('rounded-xl border p-3 bg-white', anim)} style="border-color:var(--grid)">
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">${label}</div>
        <div class="text-sm font-bold tnum" style="color:var(--ink)">${has ? fmt(last?.v) : '—'}</div>
      </div>
      ${has ? html`
        <svg viewBox=${`0 0 ${W} ${H}`} class="w-full h-auto mt-1" role="img"
             aria-label=${`${label} by month, ending at ${fmt(last?.v)}.`}>
          <line x1=${PL} x2=${W - PR} y1=${H - PB} y2=${H - PB} stroke="var(--grid)" stroke-width="1" />
          <path d=${`${line} L${x(series.length - 1).toFixed(1)} ${H - PB} L${x(0).toFixed(1)} ${H - PB} Z`} fill=${tone} opacity="0.10" />
          <path d=${line} fill="none" stroke=${tone} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="draw" style="--len:400" />
          ${series.map((d, i) => html`
            <g><circle cx=${x(i)} cy=${y(d.v)} r="9" fill="transparent" />
              <title>${d.label}: ${fmt(d.v)}</title></g>`)}
          <circle cx=${x(series.length - 1)} cy=${y(last?.v || 0)} r="4" fill=${tone} class="dot" />
          ${series.length > 1 && html`
            <text x=${PL} y=${H - 4} font-size="8" fill="var(--muted)">${series[0].label}</text>
            <text x=${W - PR} y=${H - 4} text-anchor="end" font-size="8" fill="var(--muted)">${last?.label}</text>`}
        </svg>`
        : html`<div class="h-[74px] flex items-center text-xs" style="color:var(--muted)">Not connected yet</div>`}
    </div>`;
}

export function TrendPanels({ trend, showSpend, showRevenue }) {
  const mlabel = (m) => { const [y, mo] = String(m).split('-'); return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }); };
  const mk = (key) => (trend || []).map((t) => ({ v: Number(t[key]) || 0, label: mlabel(t.month) }));
  const panels = [
    { key: 'impressions', label: 'Times you appeared', unit: 'count', tone: 'var(--s1)' },
    { key: 'clicks', label: 'Visits from search', unit: 'count', tone: 'var(--s3)' },
    showSpend && { key: 'adSpend', label: 'Ad spend', unit: 'money', tone: 'var(--s2)' },
    showRevenue && { key: 'revenue', label: 'Revenue booked', unit: 'money', tone: 'var(--s1-hi)' },
  ].filter(Boolean);
  if (!(trend || []).length) return null;
  // Grid classes are written out literally: Tailwind purges against the source
  // text, so a template-built class name ("sm:grid-cols-" + n) silently does
  // not exist in the built CSS. See the tailwind rules in project memory.
  const grid = { 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' }[panels.length] || 'grid-cols-1 sm:grid-cols-2';
  return html`
    <div class=${cx('grid gap-3', grid)}>
      ${panels.map((p) => html`<${Spark} series=${mk(p.key)} label=${p.label} unit=${p.unit} tone=${p.tone} />`)}
    </div>`;
}

// ===========================================================================
// Report chrome — the client's brand leads, the agency signs discreetly.
// ===========================================================================
export function ReportHeader({ business, agency, period, generatedAt, right }) {
  return html`
    <div class="rounded-2xl overflow-hidden border" style="border-color:var(--grid)">
      <div class="px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-4" style="background:var(--brand)">
        ${business?.logoUrl
          ? html`<img src=${business.logoUrl} alt=${business.name} class="h-10 sm:h-12 w-auto max-w-[9rem] object-contain shrink-0 rounded bg-white/90 p-1" />`
          : html`<div class="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/20 flex items-center justify-center text-lg font-bold shrink-0" style="color:var(--on-brand)">${(business?.name || '?').slice(0, 1)}</div>`}
        <div class="min-w-0 flex-1">
          <div class="text-base sm:text-xl font-bold tracking-tight truncate" style="color:var(--on-brand)">${business?.name}</div>
          <div class="text-xs sm:text-sm opacity-80 truncate" style="color:var(--on-brand)">
            Marketing performance · ${period?.label}
          </div>
        </div>
        ${right}
      </div>
      <div class="px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-[11px] bg-white" style="color:var(--muted)">
        <span>${business?.domain || ''}</span>
        <span>As of ${new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>`;
}

export const ReportFooter = ({ agency }) => html`
  <div class="pt-4 mt-2 border-t text-center text-[11px]" style="border-color:var(--grid);color:var(--muted)">
    ${agency?.name ? html`Prepared by ${agency.name}` : 'Prepared by your marketing team'}
    ${agency?.website && html` · <a href=${agency.website.startsWith('http') ? agency.website : `https://${agency.website}`} target="_blank" rel="noopener"
        class="underline inline-flex items-center min-h-[2.75rem] lg:min-h-0 px-1">${String(agency.website).replace(/^https?:\/\//, '')}</a>`}
  </div>`;

// Assumptions + caveats. This block is why the modelled numbers above are
// allowed to exist at all — it is never collapsed away entirely.
export function Assumptions({ economics, notes, measured }) {
  const [open, setOpen] = useState(false);
  const list = [...(economics?.assumptions || []), ...(notes || [])];
  if (!list.length) return null;
  return html`
    <div class="rounded-xl border p-3 sm:p-4" style=${`border-color:var(--grid);background:${measured ? '#f8fafc' : '#fffbeb'}`}>
      <button onClick=${() => setOpen(!open)} class="w-full flex items-center justify-between gap-3 text-left min-h-[2.75rem] lg:min-h-0 py-1">
        <span class="text-sm font-semibold" style="color:var(--ink)">
          ${measured ? 'How these numbers were measured' : 'How these numbers were estimated'}
        </span>
        <span class="text-xs shrink-0" style="color:var(--muted)">${open ? 'Hide' : 'Show'} ${list.length}</span>
      </button>
      <p class="text-xs mt-1" style="color:var(--ink2)">
        ${measured
          ? 'Revenue and booked jobs come from real Job Tracker records for this business.'
          : 'This business is not linked to Job Tracker, so the money figures are modelled from stated rates — treat them as a direction, not a bank statement.'}
      </p>
      ${open && html`<ul class="mt-2 space-y-1.5 text-xs list-disc pl-4" style="color:var(--ink2)">
        ${list.map((t) => html`<li>${t}</li>`)}
      </ul>`}
    </div>`;
}
