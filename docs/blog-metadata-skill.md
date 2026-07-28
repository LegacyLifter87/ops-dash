# Blog Metadata — the complete standard (Ops Dash skill)

Added 2026-07-25. This is the metadata contract for every blog post and
service page the platform writes and publishes. It is enforced in TWO places:
the WRITER (seo-brief `SYSTEM` prompt + its validator produce every field)
and the DELIVERY (seo-wp `publish` sends every field; the Connector plugin
≥1.8.0 writes it into WordPress and the site's SEO plugin). If either side
changes, keep this doc, the seo-brief SYSTEM, the seo-wp payload, and the
plugin's `opsdash_set_seo_meta`/`opsdash_publish` in sync.

## The fields every post must ship with

| Field | Rule | Written by | Lands in WordPress as |
|---|---|---|---|
| **SEO title** | 50–60 chars exactly; STARTS with the focus keyword; includes a power word; may end `\| Brand` | seo-brief `title` (validated 48–62) | Rank Math `rank_math_title` / Yoast `_yoast_wpseo_title` / AIOSEO `_aioseo_title` + own fallback |
| **H1 (on-page headline)** | Same intent as the SEO title, DIFFERENT phrasing — never identical; focus keyword once | seo-brief `h1` (validator rejects title≡h1) | `post_title` |
| **Meta description** | 150–155 chars exactly; focus keyword within the first 10 words; ends with a call to action | seo-brief `meta` (validated 145–162) | `rank_math_description` / `_yoast_wpseo_metadesc` / `_aioseo_description` + own fallback; also the post `excerpt` |
| **Focus keyword** | The brief's primary keyword (`keywords[0]`) — required placements: first sentence, H1, ≥1 H2, ≥1 H3, conclusion, one image alt; density on the strongest 2-word phrase 0.8–1.0% (hard cap 1.5%) | seo-brief keyword engine + validator | `rank_math_focus_keyword` / `_yoast_wpseo_focuskw` / AIOSEO keyphrases (v1.8.0 — without this the SEO plugin shows "no metadata" and no score) |
| **Slug** | Lowercase, hyphenated, 3–5 words, keyword-bearing | seo-brief `slug` | `post_name` |
| **Canonical** | Self-referencing, absolute URL, exactly one per page | SEO plugin emits automatically; on plugin-less sites the Connector sets `_opsdash_canonical` = permalink at publish (v1.8.0) | `<link rel="canonical">` |
| **Image alt text** | Every image; descriptive 5–14 words of what is actually visible; focus keyword in EXACTLY one alt (usually the featured image) | seo-brief `[IMAGE: alt \| why]` placeholders | `_wp_attachment_image_alt` on each attachment + `alt=""` in the figure markup |
| **Featured image** | First article image auto-promotes when none set; it becomes the og:image used by social shares | seo-wp image pipeline | post thumbnail |
| **Open Graph / Twitter** | og:type article, og:title, og:description, og:url, og:image, twitter:card summary_large_image | SEO plugin emits automatically; plugin-less sites get them from the Connector head fallback (v1.8.0) | `wp_head` |
| **Schema (JSON-LD)** | BlogPosting (editorial) or Article (neutral info) — never both; `+FAQPage` only with 5+ genuine Q&As; `+HowTo` only for "How to" titles with 3+ ordered steps; Service/LocalBusiness for service pages; never Review/AggregateRating, never invented facts | seo-brief `schema_type` → seo-wp `buildSchema` | `_opsdash_schema` → `<script type="application/ld+json">`; when an SEO plugin already emits page schema, only FAQ schema is pushed (no duplicates) |
| **Excerpt** | The meta description doubles as the excerpt | seo-wp payload | `post_excerpt` |

## Interpretation rules

- The SEO title and the H1 are DIFFERENT fields with different jobs: the
  title wins the SERP click; the H1 confirms the promise on the page.
- The meta description is ad copy, not a summary — keyword early, benefit in
  the middle, action verb at the end.
- Alt text describes the image for a person who can't see it; the keyword
  belongs in one alt only. Keyword-stuffed alts are a penalty risk, not SEO.
- One canonical, always self-referencing for original content. Never point a
  new article's canonical anywhere else.
- Schema must describe only what is true and on the page. FAQPage without
  visible Q&As, or invented ratings, are spam signals.
- OG tags feed every social share (including the auto-announcement after
  publish) — the featured image IS the share image, which is why image slot 1
  is designed to read at thumbnail size.

## Delivery guarantee (what "pushed with the blog" means)

seo-wp `publish` sends: title(H1), slug, excerpt, seo_title,
meta_description, focus_keyword, schema_jsonld, images[{alt}],
featured_image_alt. Connector ≥1.8.0 writes all of it in one call — per
detected SEO plugin (Yoast / Rank Math / AIOSEO) with an own-head fallback
(title tag, meta description, OG/Twitter, canonical, JSON-LD) when no SEO
plugin exists. `update-seo` (audit fixes) accepts the same fields including
focus_keyword. Nothing requires a human to open the WP editor afterward.
