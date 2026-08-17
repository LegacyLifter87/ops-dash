// ---------------------------------------------------------------------------
// report-opps.js — the OPPORTUNITY FINDER section. Reporting v2, section 4.
//
// The other three sections say what happened. This one says what to do next,
// and — the part every competing tool skips — how much is actually behind it.
//
// Fed by seo-opps (its own function, fetched in parallel), so a slow or empty
// opportunity pass costs this section alone.
//
// ── THE HONESTY PROBLEM THIS SECTION HAS TO SOLVE ─────────────────────────
// Every number here rests on Search Console IMPRESSIONS, because that is the
// only demand signal that exists for all of these sites (the keyword vendor's
// volume is null on all 6,342 tracked keywords). Impressions are not search
// volume, and the difference matters enormously to a reader:
//   • volume      = how often the market searches something
//   • impressions = how often Google actually showed THIS site for it
// Impressions are capped by the site's own ranking, so the worse you rank the
// smaller the number looks — the opposite of the truth. This section therefore
// never calls impressions "searches", never presents them as market size, and
// states the direction of the bias in plain words. Where real vendor volume
// exists it appears in its own block, labelled as an estimate of the market.
//
// The uplift figure is a FLOOR, and says so: it holds exposure fixed while
// improving rank, which understates, because ranking better also earns more
// exposure. A number we can defend beats a bigger one we cannot.
//
// COLOR: zero new hues. Magnitude bars are single-hue --s1. The "already
// winning" strip uses --good. Position movement is stated as labelled text
// with a direction, never plotted on an inverted axis. The client's brand is
// the accent on exactly one mark: the headline figure.
// ---------------------------------------------------------------------------
import { html, useState, cx } from './lib.js';
import { count, pct, Est, SectionHead, CountUp, useInView } from './report-view.js';

const INTENT_LABEL = {
  local: 'near-me searches',
  commercial: 'comparison shopping',
  transactional: 'ready to buy',
  informational: 'research',
  navigational: 'looking for a name',
};

// Position stated as words + number. A "lower is better" scale drawn as a
// chart is a coin flip for the reader, so it is never drawn.
function PosBadge({ pos }) {
  if (pos == null) return null;
  const tone = pos <= 3 ? 'var(--good)' : pos <= 10 ? 'var(--s4)' : 'var(--muted)';
  const where = pos <= 3 ? 'top 3' : pos <= 10 ? 'page 1' : pos <= 20 ? 'page 2' : 'past page 2';
  return html`<span class="text-[11px] whitespace-nowrap" style=${`color:${tone}`}>
    avg. position <span class="font-semibold tnum">${pos}</span> · ${where}
  </span>`;
}

function Segment({ seg, max }) {
  const [open, setOpen] = useState(false);
  const w = max > 0 ? Math.max(4, (seg.upliftClicks / max) * 100) : 0;
  return html`
    <div class="py-3 border-t" style="border-color:var(--grid)">
      <div class="flex items-baseline justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <button type="button" onClick=${() => setOpen((v) => !v)}
            class="text-left font-semibold text-[15px] inline-flex items-center gap-1.5"
            style="color:var(--ink)" aria-expanded=${open ? 'true' : 'false'}>
            <span class="text-[11px]" style="color:var(--muted)" aria-hidden="true">${open ? '▾' : '▸'}</span>
            ${seg.cluster}
          </button>
          <div class="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap" style="color:var(--muted)">
            <span>${count(seg.keywords)} search${seg.keywords === 1 ? '' : 'es'}</span>
            <span aria-hidden="true">·</span>
            <span>shown ${count(seg.impressions)}×</span>
            ${seg.intent && html`<span aria-hidden="true">·</span><span>${INTENT_LABEL[seg.intent] || seg.intent}</span>`}
            ${!seg.hasServicePage && html`
              <span class="px-1.5 py-0.5 rounded"
                    style="background:var(--brand-wash);color:var(--brand-ink)">no page for this yet</span>`}
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-bold tnum text-[15px]" style="color:var(--ink)">+${count(Math.round(seg.upliftClicks))}</div>
          <div class="text-[11px]" style="color:var(--muted)">visits / mo at top 3</div>
        </div>
      </div>
      <div class="h-2 rounded-full mt-2" style="background:var(--grid)">
        <div class="h-2 rounded-full grow" style=${`width:${w.toFixed(1)}%;background:var(--s1)`}></div>
      </div>
      <div class="mt-1.5"><${PosBadge} pos=${seg.weightedPos} /></div>
      ${open && html`
        <div class="mt-2 pl-4 space-y-1">
          <div class="text-[11px] font-semibold uppercase tracking-wide" style="color:var(--muted)">What people are typing</div>
          ${(seg.sample || []).map((k) => html`
            <div class="text-[13px] truncate" style="color:var(--ink2)" title=${k}>${k}</div>`)}
          ${seg.bestPos != null && seg.bestPos < seg.weightedPos && html`
            <div class="text-[11px] pt-1" style="color:var(--muted)">
              Best single result here already ranks ${seg.bestPos} — the group average is dragged down by the rest.
            </div>`}
        </div>`}
    </div>`;
}

export function Opportunities({ opps, business }) {
  const [ref, anim, seen] = useInView();
  const [showMethod, setShowMethod] = useState(false);
  if (!opps?.configured) return null;

  const t = opps.totals || {};
  const segs = opps.segments || [];
  const maxUplift = Math.max(...segs.map((s) => s.upliftClicks), 1);
  const gaps = opps.serviceGaps;
  const market = opps.market || [];
  const pages = opps.pages || [];

  if (!segs.length && !gaps && !market.length) return null;

  return html`
    <section class="space-y-4">
      <${SectionHead} eyebrow="Where the next growth is" title="What to go after next"
        sub="Groups of searches this business already shows up for, ranked by how much is left on the table." />

      ${segs.length > 0 && html`
        <div ref=${ref} class=${cx('rounded-xl border p-4 sm:p-5', anim)}
             style="border-color:var(--grid);background:var(--brand-wash)">
          <div class="text-[11px] font-semibold uppercase tracking-widest" style="color:var(--muted)">
            Visits within reach
          </div>
          <div class="rise text-4xl sm:text-5xl font-extrabold tracking-tight leading-none mt-1" style="color:var(--brand-ink)">
            <${CountUp} value=${t.upliftClicks || 0} fmt=${(v) => '+' + count(v)} run=${seen} ms=${1100} />
          </div>
          <div class="rise text-sm mt-2 max-w-lg" style="color:var(--ink2)">
            per month, if the ${count(t.segments)} group${t.segments === 1 ? '' : 's'} below reached the top 3.
            ${' '}<${Est} basis="derived" />
          </div>
          <div class="text-[11px] mt-2" style="color:var(--muted)">
            A floor, not a forecast — it assumes the business gets shown exactly as often as it is today.
            Ranking better also means being shown more, which this does not count.
          </div>
        </div>`}

      ${segs.length > 0 && html`
        <div class="rounded-xl border px-3 sm:px-4 pb-1" style="border-color:var(--grid)">
          <div class="text-[11px] font-semibold uppercase tracking-wide pt-3 pb-1" style="color:var(--muted)">
            Biggest groups first · tap one to see the actual searches
          </div>
          ${segs.map((s) => html`<${Segment} seg=${s} max=${maxUplift} />`)}
        </div>`}

      ${(opps.winning || []).length > 0 && html`
        <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid)">
          <div class="text-[11px] font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">
            Already owned — hold these
          </div>
          <div class="flex flex-wrap gap-2">
            ${opps.winning.map((w) => html`
              <span class="text-[12px] px-2 py-1 rounded-lg"
                    style="background:var(--grid);color:var(--ink)">
                ${w.cluster} <span class="tnum" style="color:var(--good)">#${w.weightedPos}</span>
              </span>`)}
          </div>
        </div>`}

      ${(opps.branded || []).length > 0 && html`
        <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid)">
          <div class="text-sm font-semibold" style="color:var(--ink)">People searching for you by name</div>
          <div class="text-[11px] mt-0.5 mb-2" style="color:var(--muted)">
            Kept out of the growth list above on purpose — these people already know
            ${' ' + (business?.name || 'the business') + '.'} Worth watching, because anything other than the top spot
            for your own name means somebody else is catching that person first.
          </div>
          <div class="space-y-1.5">
            ${opps.branded.slice(0, 5).map((b) => html`
              <div class="flex items-baseline justify-between gap-3 text-[13px]">
                <span class="truncate" style="color:var(--ink)" title=${b.cluster}>${b.cluster}</span>
                <span class="shrink-0 text-[12px] tnum" style="color:var(--muted)">
                  shown ${count(b.impressions)}× · <${PosBadge} pos=${b.weightedPos} />
                </span>
              </div>`)}
          </div>
        </div>`}

      ${pages.length > 0 && html`
        <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid)">
          <div class="text-sm font-semibold" style="color:var(--ink)">Searches with nowhere to land</div>
          <div class="text-[11px] mt-0.5 mb-2" style="color:var(--muted)">
            Google is already showing this business for these, but there is no page built to answer them.
          </div>
          <div class="space-y-1.5">
            ${pages.slice(0, 8).map((p) => html`
              <div class="flex items-baseline justify-between gap-3 text-[13px]">
                <span class="truncate" style="color:var(--ink)" title=${p.keyword}>${p.keyword}</span>
                <span class="shrink-0 tnum text-[12px]" style="color:var(--muted)">
                  shown ${count(p.impressions)}× · position ${p.pos}
                </span>
              </div>`)}
          </div>
        </div>`}

      ${gaps && html`
        <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid)">
          <div class="text-sm font-semibold" style="color:var(--ink)">Services the competition lists and this business does not</div>
          <div class="text-[11px] mt-0.5 mb-2" style="color:var(--muted)">
            From the ${count(gaps.competitorsSeen)} competing Google profiles being tracked. What a competitor
            advertises is not proof it earns them anything — treat these as questions worth asking, not instructions.
          </div>
          <div class="space-y-1.5">
            ${gaps.gaps.slice(0, 8).map((g) => html`
              <div class="flex items-baseline justify-between gap-3 text-[13px]">
                <span class="truncate capitalize" style="color:var(--ink)" title=${g.service}>${g.service}</span>
                <span class="shrink-0 text-[12px] tnum" style="color:var(--muted)">
                  ${g.competitors} of ${g.of}
                </span>
              </div>`)}
          </div>
        </div>`}

      ${market.length > 0 && html`
        <div class="rounded-xl border p-3 sm:p-4" style="border-color:var(--grid)">
          <div class="flex items-baseline justify-between gap-3 flex-wrap">
            <div class="text-sm font-semibold" style="color:var(--ink)">Demand not being touched yet</div>
            <${Est} basis="estimated" />
          </div>
          <div class="text-[11px] mt-0.5 mb-2" style="color:var(--muted)">
            Searches happening in this market that this business does not appear for at all.
            Volumes are the keyword tool's estimate of the market — a different measurement from everything above.
          </div>
          <div class="space-y-1.5">
            ${market.slice(0, 10).map((m) => html`
              <div class="flex items-baseline justify-between gap-3 text-[13px]">
                <span class="truncate" style="color:var(--ink)" title=${m.keyword}>${m.keyword}</span>
                <span class="shrink-0 tnum text-[12px]" style="color:var(--muted)">
                  ~${count(m.volume)}/mo${m.source === 'competitor' ? ' · a competitor ranks' : ''}
                </span>
              </div>`)}
          </div>
        </div>`}

      <!-- Method, in the client's words, folded away by default. -->
      <div class="text-[11px]" style="color:var(--muted)">
        <button type="button" onClick=${() => setShowMethod((v) => !v)}
          class="font-semibold inline-flex items-center gap-1.5" style="color:var(--brand-ink)"
          aria-expanded=${showMethod ? 'true' : 'false'}>
          <span aria-hidden="true">${showMethod ? '▾' : '▸'}</span> How these numbers were worked out
        </button>
        ${showMethod && html`
          <div class="mt-2 space-y-2 leading-relaxed">
            <p>${opps.notes?.impressions}</p>
            <p>${opps.notes?.uplift}</p>
            ${market.length > 0 && html`<p>${opps.notes?.market}</p>`}
            ${(opps.branded || []).length > 0 && html`
              <p>
                Branded searches are reported separately and are not ranked as growth opportunities —
                they are searches for ${business?.name || 'this business'} by name, which is a different thing
                from winning new customers.
              </p>`}
          </div>`}
      </div>
    </section>`;
}
