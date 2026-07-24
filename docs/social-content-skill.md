# Social Media Content Skill — Ops Dash Social Manager

The knowledge base the Social Media Manager's AI engines are prompted from.
Compiled into the seo-social edge functions' system prompts. Sources: Google
Cloud's Nano Banana prompting guide, Veo 3 prompt field guides, Sprout
Social/Buffer/Hootsuite 2026 posting-time studies, HeyOrca/Later 2026 hook
research, 80/20 + content-pillar frameworks. Everything here is adapted to
LOCAL SERVICE BUSINESSES marketed through Ops Dash (services + service-area
cities come from the Strategy tab).

---

## 1. The 30-day calendar architecture

**Cadence:** 1–3 posts/day per business (plan setting). Distribute so no two
same-pillar posts run back-to-back and heavier days land Tue–Thu.

**Content pillars & monthly mix (80/20 value-to-promo, tuned for local
service):**

| Pillar | Share | What it is |
|---|---|---|
| Educational / how-to | 30% | Answer real customer questions about the SERVICES (from Strategy tab + keyword data). Tips, "signs you need X", cost factors, seasonal prep. |
| Proof / results | 20% | Before-after, job-site walkthroughs, completed-project spotlights, review highlights (real reviews only — never invented). |
| Local / community | 15% | City-specific content from the SERVICE AREA cities: "serving {city}", local seasonal angles, landmark references. Rotate cities across the month; never name a non-target city. |
| Behind the scenes / team | 10% | Crew intros, day-in-the-life, equipment, values. Humanizes; highest trust-building per post. |
| Engagement | 10% | Questions, polls, this-or-that, caption-this, myth-vs-fact. Drives comments → algorithmic reach. |
| Promotional / offer | 15% | Service promos, seasonal offers, financing, "book now" — ALWAYS with one clear CTA and the phone number. Cap at ~1 in 6 posts. |

**Weekly rhythm template (3/day plan → thin to 1/day by keeping the ★ post):**
- Mon: ★Educational · Behind-the-scenes · Engagement
- Tue: ★Proof · Local city spotlight · Educational
- Wed: ★Educational (Reel) · Engagement · Promo
- Thu: ★Proof (Reel) · Local · Behind-the-scenes
- Fri: ★Promo · Educational · Engagement
- Sat: ★Local · Proof
- Sun: ★Inspiration/values · Engagement

**Static vs video mix:** default 70% static image posts / 30% video (Reels).
Reels get evening slots; video posts should lead with motion in the first
second (no logo intro cards).

## 2. Posting times (audience-local timezone)

2026 cross-platform data (Sprout/Buffer/Hootsuite): strongest engagement
**Tue–Thu 9–11am**, secondary **12–1pm**, Reels/evening **6–8pm**.
Slot assignment:
- 1 post/day → 9:30am (Tue–Thu bias for the week's most important posts)
- 2 posts/day → 9:30am + 6:30pm (video/Reel takes the evening slot)
- 3 posts/day → 8:30am + 12:15pm + 6:30pm
- Weekends: single 10:00am slot (+ 7:00pm if 3/day)
Jitter each scheduled time ±20 min so feeds don't look botted. Local-service
audiences skew homeowners: early evening + Saturday morning outperform
late-night; never schedule 10pm–6am.

## 3. Hooks — the first line is the ad

Users decide in ~1.7s. The first sentence of every caption AND the on-image
headline must be a hook, never a greeting ("Hey everyone" = invisible).
Rotate these families (never the same family twice in a row):

1. **Question pain hook** — "Tired of a lawn that looks worse every summer?"
2. **Surprising stat/fact** — "90% of dryer fires start in a vent nobody's cleaned."
3. **Contrarian** — "Stop pressure-washing your roof. Here's why."
4. **Curiosity gap / open loop** — "The one thing inspectors check first in {city} homes…"
5. **Direct outcome promise (how-to)** — "How to spot a failing water heater in 30 seconds."
6. **Social proof / result-first** — "This {city} driveway hadn't been cleaned in 9 years. Watch."
7. **Mid-action story** — "Halfway through this job, we found something under the deck…"
8. **Local callout** — "{City} homeowners: this week's rain is about to test your gutters."
9. **Cost/mistake** — "This $12 part failing costs {city} homeowners $4,000."
10. **Seasonal urgency** — "Book before the first freeze — here's what waits until spring costs."

**Caption structure:** Hook line → 1–3 short value lines (line breaks, no
walls of text) → CTA line with phone number → 3–6 niche+local hashtags
(#{service}{city} #{city}{trade} + 1–2 broad). Emojis: 1–3 max, functional
(📍 ☎ ✅), matching a trades voice — plainspoken, confident, neighborly, no
corporate fluff, no hype words ("insane", "game-changer").

**CTA rules:** exactly ONE per post. Rotate: "Call {phone} for a free
estimate", "Tap the link to book", "Send us a message — we answer fast",
"Save this for later", (engagement posts: the question IS the CTA). Promo
posts always carry phone + website.

## 4. Audience targeting from the system

Every post is generated FROM system data — never generic:
- **Services** (seo_strategy_pages): each week covers 2+ distinct services;
  service names appear verbatim in captions/headlines; service page URL is
  the link when a link is used.
- **Cities** (seo_service_area, excluded=false): local pillar posts name ONE
  target city each; rotate through the list weighting county seats/larger
  cities; hooks and examples reference that city's context (weather, season,
  homeowner concerns). NEVER name an excluded or non-listed city.
- **Ideal client inference**: from services + GBP category, infer the ideal
  client (e.g. roofing → homeowners 30–65, storm-season anxiety, insurance
  questions; detailing → car owners, pride/convenience). State it in the
  monthly strategy and write every hook to that person's pain/pride points.
- **Seasonality**: the month's calendar must reflect the actual month +
  climate of the state (Strategy tab state code).

## 5. Image generation — Nano Banana prompt recipe

Model strings: `google/nano-banana` (fast/cheap), `nano-banana-2` via kie
(reference images up to 14, 2K/4K, best text rendering).

**Prompt formula:** `[Subject] + [Action/context] + [Setting] + [Composition]
+ [Style] + [Text rendering block] + [Brand block]`

**Rules that matter:**
- Positive framing only ("clean empty driveway", not "no cars").
- Photorealism vocab for trades: "shot on full-frame DSLR, 35mm lens,
  golden-hour side light, shallow depth of field f/2.8, photorealistic" —
  avoid illustration look unless the post is a designed graphic.
- **On-image text**: put EXACT text in double quotes + name a font style +
  color + position: `the headline "DRYER VENT DANGER" in bold white
  condensed sans-serif across the top third`. Keep on-image text ≤ 7 words
  (hook or offer only — the caption carries the rest). Phone number as a
  bottom strip: `"☎ (352) 555-0134" in a clean white bar along the bottom`.
- **Brand block**: `place the attached logo small in the bottom-right
  corner; use brand colors {hex1} and {hex2} as accent colors` — logo goes
  in as a REFERENCE IMAGE (nano-banana-2 image_input), never described from
  memory. With no logo on file, render the business name in a consistent
  font instead.
- **Consistency**: reuse the same style tail across a month ("same visual
  style as a cohesive brand feed") and the same 1–2 accent colors.
- **Formats**: feed 1:1 (1080²), portrait 4:5 (feed, more screen), story/reel
  cover 9:16, link/blog share 16:9. Default 4:5 for feed posts.
- Designed-graphic posts (tips lists, myth-vs-fact): "flat modern social
  media graphic, bold typographic layout" + text-in-quotes per line.
- NEVER: real people's faces presented as the actual crew, fake before/after
  claims, competitor logos, invented review text, phone numbers other than
  the business's.

## 6. Video generation — Veo prompt recipe

Veo 3/3.1 via kie (4–8s clips, 9:16 for Reels, audio supported;
image-to-video: 1 image = animate, 2 = first→last frame transition).

**Prompt as a director's treatment:** `[Scene: one sentence of action] +
[Subject detail] + [Setting] + [Camera: shot size, lens, movement] +
[Lighting/mood] + [Audio cue] + [Style]`

- Motion in second one — open mid-action (spray hitting a driveway, shingle
  being nailed), never a logo card.
- Camera vocab: "slow push-in", "tracking shot", "handheld POV", "aerial
  establishing shot", "macro detail shot". One camera move per clip.
- Audio: name it — "natural job-site ambience, pressure washer hum" or
  "upbeat light percussion". Dialogue only if scripted in quotes.
- Best pipeline: nano-banana still (with brand block) → Veo image-to-video
  animates it → text overlay/CTA lives in the caption or a final nano-banana
  end-card, not fighting the video.
- 8s max per clip; for a 15–24s Reel plan sequential clips ("Clip 1 / Clip
  2 / Clip 3", consistent subject + style line in each).

## 7. Platform notes (v1 targets)

- **Facebook**: all formats; links OK in post; audience skews 35+ homeowners
  — proof + local + promo pillars hit hardest. 1080×1350 or 1:1.
- **Instagram**: no caption links (say "call" or "link in bio"); Reels get
  9:16 + evening slots; hashtags matter more here (5–8).
- **Google Business Profile** (later phase): educational/promo reposts with
  CTA button; 1200×900 4:3 crops safest.
- Same asset can serve FB+IG with caption tweaks (links stripped for IG);
  generate once, adapt per platform.

## 8. Compliance guardrails (baked into every generation prompt)

- No invented testimonials, review quotes, statistics about THIS business,
  or before/after claims not provided by the owner.
- Generic industry stats must be real and attributable; otherwise phrase as
  guidance ("most manufacturers recommend…").
- No competitor names/trademarks; no copyrighted characters/music cues.
- Licensed-trade content (electrical, gas, roofing) never instructs DIY on
  dangerous work — always "call a licensed pro".
- Offers must carry any terms the owner sets; no invented discounts.
- AI-generated imagery is illustrative: never present a generated photo as
  an actual completed job by this business — proof posts use REAL uploaded
  photos when available, generated imagery is for concept/educational/promo
  visuals.

## 9. Marketing-first graphic design framework (added 2026-07-24)

A graphic can be beautiful and still fail. Every social graphic has exactly
three jobs: **stop the scroll, communicate ONE valuable idea, move the viewer
toward one action.** The working formula is **STOP → CONNECT → PROVE →
DIRECT**: interrupt the feed, show we understand the viewer's problem or
goal, show the result/expertise/offer, then give one clear next step.

### The one-message rule
Each graphic carries ONE audience, ONE problem or desire, ONE promise, ONE
CTA. Never stack every service, location, credential, and contact method into
one design — visually equal elements mean nothing feels important. Extra
detail lives in the caption or landing page.

### Three-layer message (what actually goes on the graphic)
1. **Hook headline — 3–8 words**, conversational, in the customer's own
   words. A hook, never a service label: "Is Your Driveway Making Your Home
   Look Older?" beats "Professional Pressure Washing Services". Categories:
   problem, question, desired result ("Come Home to a Lawn You're Proud
   Of"), transformation, warning, specific-audience callout ("{City}
   Homeowners: Need More Space?"), curiosity, relief, offer. The strongest
   hook is the clearest connection to the customer's current concern — not
   the cleverest line.
2. **Payoff — one short supporting line** answering "why should I care".
   Emotional benefit over technical service: save time, avoid stress,
   protect the home, prevent a larger expense, feel prepared, better first
   impression. "More Room Without Leaving the Home You Love" beats "Custom
   Home Additions" — the service is the mechanism, not the value.
3. **CTA — 2–5 words**, rendered as ONE high-contrast rounded button/chip
   with comfortable padding, visually separate from the headline. Specific
   and matched to the viewer's commitment level: someone who just learned
   about chimney leaks books an INSPECTION, not a rebuild. Never bare "Learn
   more"/"Contact us". Phone/website may appear as small secondary info
   (promo bottom bar) but never compete with the CTA.

### CTA by pillar (match the post's goal, not always a sale)
- **educational** (trust): "Save this for later", "Send us a photo",
  "Schedule an inspection", "Ask if this applies to your home"
- **proof** (consideration): "Request a quote", "See what yours could look
  like", "Get your free estimate"
- **local** (consideration): "Check availability in {city}", "Schedule your
  visit", "Request a quote"
- **bts** (awareness): "Follow for more", "Meet the crew", "Know someone who
  needs this?"
- **engagement**: the question IS the CTA — "Which would you choose?", "When
  was yours last inspected?", "Comment INFO and we'll send details"
- **promo** (conversion): "Call today", "Claim the offer", "Book your
  cleaning", "Reserve your date"

### Design for the thumbnail, not the canvas
The graphic must survive: a phone, at arm's length, mid-scroll, under two
seconds, among dozens of competitors. One dominant focal point; viewing
order **visual/headline → benefit → CTA → small brand mark**. The logo
establishes ownership and never competes with the message. Before approving:
can you identify the subject, read the headline, know the offer, and see the
CTA at thumbnail size? If anything feels crowded, simplify.

### Contrast that stops the scroll (pick 1–2, not all)
Color (light-on-dark blocks), size (one huge headline vs small support),
shape (rounded CTA chip on a photo), emotional (calm homeowner vs storm),
condition (dirty vs clean, outdated vs modern — before/after splits), and
directional (a person looking/pointing toward the headline or CTA). Too many
competing high-contrast elements = noise.

### Photography that converts
The image shows one of four things: the **problem** (algae-covered deck,
overflowing gutter), the **process** (tech inspecting, crew mid-job), the
**result** (clean driveway, bright bathroom), or the **feeling after**
(homeowner relaxed, family in the finished space). Scenes must look like the
business's real region and customers — believable local homes and
businesses, never generic luxury stock that feels disconnected. Real
customer photos beat generated imagery whenever one fits.

### Design families (rotate to prevent template blindness)
Keep fonts, colors, logo treatment, and CTA chip style constant; rotate the
layout across: hero-photo, question card, before/after split, educational
tip card, offer card, team/behind-the-scenes, minimal headline. Consistency
without repetition.

### The 10-point scorecard (a post should pass ≥8)
1 subject understood in one second · 2 one clear focal point · 3 headline
readable on a phone · 4 headline addresses a real customer concern ·
5 believable, relevant image · 6 enough contrast · 7 nothing unnecessary ·
8 business identifiable without the logo dominating · 9 next action clear ·
10 a reason to stop, care, and act.

### Reels structure
The opening frame must work as a headline on its own. Beat order: hook →
problem → demonstration → result → CTA. Never open on a logo card.
