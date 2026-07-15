# Ops Dash — Feature & Function Breakdown

**Modules covered:** Business Analytics (Job Tracker) · WordPress Publishing & SEO Execution (WP Connector)

> Plain-language reference for building marketing and sales materials. Every capability listed below is a real, shipped function of the software. Two audiences are called out where relevant: **agencies** (who manage many clients) and **client businesses** (the home-services / trades company whose data is being tracked).

---

## 1. Business Analytics — "Job Tracker" Dashboard

**What it is:** A live financial and operations dashboard inside Ops Dash that mirrors a client's field-service business. It connects an Ops Dash account to that company's **Job Tracker** (the job/CRM system where quotes, jobs, and costs live) and surfaces the money story — revenue, profit, pipeline, and where the work comes from — without anyone having to open spreadsheets.

**Who sees it:** Everyone on a linked Ops Dash account. The agency links the account to the right company once; from then on the whole team sees the same numbers. Client data stays protected — the browser never touches the Job Tracker database directly; all data is pulled through a secured server bridge.

### Headline metrics (top-line KPIs)

| Metric | What it tells the story of |
|---|---|
| **Revenue (completed)** | Total booked revenue from finished jobs |
| **Gross profit + margin %** | Profit after job costs, with a live margin percentage; color-flips green/red on profit vs. loss |
| **Average job value** | Typical ticket size — useful for pricing and upsell conversations |
| **Completed jobs / active jobs** | Volume of finished work plus how many jobs are currently in progress |
| **Active job value** | Dollar value of work currently on the books |
| **Pipeline value + open leads** | Total value of unclosed opportunities and how many leads are still open |
| **Win rate (won / lost)** | Close rate on quotes — a direct sales-performance number |
| **Labor hours + labor rate/hr** | Total hours worked and the effective hourly labor rate |

### Cost breakdown
A visual cost structure for the business, broken into **Labor, Subcontractors, Materials, and Consumables**, each shown as a proportional bar against a running **Total cost** — so a business owner can see at a glance where the money goes.

### Revenue trends & attribution
- **Revenue by month** — a bar chart of completed-job revenue over time (trend/seasonality view).
- **Revenue by lead source** — attributes won revenue back to its marketing origin (which channels actually produce paying work). *This is the money slide for justifying marketing spend.*
- **Revenue by job type** — which services drive the most revenue.
- **Revenue by salesperson** — revenue attributed to the person who sold the job, ranked.

Each attribution table is sortable by name, job count, or dollar value, and shows the top performers.

### Connection & management functions
- **Link an account to a Job Tracker company** (agency function) — choose from a list of the agency's companies and connect in one click.
- **Auto-provision** — create a linked company record straight from an existing Job Tracker company.
- **Status awareness** — the dashboard knows whether an account is linked, who the linked company is, and whether the current user is allowed to manage the link.
- **Unlink** — authorized managers can disconnect an account from its company (with a confirmation guard).
- **Graceful empty states** — clean prompts when an account isn't linked yet, guiding agencies to link and guiding client users to ask their agency.

**Sales angle:** Turns a client's raw job data into an owner-friendly profit dashboard, and — critically — ties revenue back to lead source, so the agency can *prove* which marketing is producing real jobs and dollars.

---

## 2. WordPress Publishing & SEO Execution — "WP Connector"

**What it is:** The engine that lets Ops Dash *act on* a client's WordPress website — publishing finished content and pushing SEO fixes live — through a lightweight, tightly-scoped plugin called the **Ops Dash Connector**. It's what turns Ops Dash from a reporting tool into a tool that actually *does the work* on the site.

### How it connects (one-time setup)
- **Download-and-activate plugin** — a small WordPress plugin (the "Ops Dash Connector," current version 1.4.0) installed from the portal.
- **Connection key handshake** — the portal generates a secret key (`opsd_…`); the client (or agency) pastes it into the plugin's settings page. That's the entire setup.
- **Live status indicator** — the portal shows **Connected**, **Plugin not reachable**, the detected SEO plugin, and the installed plugin version at a glance.
- **Key rotation** — regenerate the key anytime; the old key stops working immediately (built-in security hygiene).
- **Update or disconnect** — change the site URL or fully disconnect from the portal.

### Security & trust (important for the sales conversation)
- **Posts and pages only.** The connector is *architecturally incapable* of touching anything else — it cannot add users, change settings, install plugins, or modify products, templates, menus, or media beyond the images it attaches. This is enforced in code, not just policy.
- **Key-authenticated** — every request must carry the secret key, compared securely.
- **Safe by default** — content arrives as **drafts** for review unless explicitly told to publish live.
- **Hardened output** — SEO/schema data is encoded to be safe from injection on every page view.

### SEO plugin compatibility
Automatically detects and writes correctly to the site's existing SEO stack:
- **Yoast SEO**
- **Rank Math**
- **All in One SEO (AIOSEO)**
- **None / standalone** — if the site has no SEO plugin, the connector outputs the SEO **title, meta description, and JSON-LD schema itself**, plus canonical tags.

### Content publishing functions
- **Push AI-drafted articles straight to WordPress** — a finished article moves from Ops Dash to the client's site as a ready-to-review draft (or published live).
- **Full SEO package included** — SEO title, meta description, URL slug, excerpt, and JSON-LD schema all travel with the post.
- **Featured images** — automatically downloads and sets a featured image from a URL.
- **Inline article images** — places images inside the article body (from a URL or generated image data), with the first image auto-promoted to featured if none was set.
- **Safe re-publishing / updates** — update an existing post or page in place, with guardrails that prevent accidentally overwriting the wrong content type.
- **On-site inventory** — reads back the site's published posts and pages so the dashboard knows what's live.

### One-click SEO fixes (deployed live to the site)
From the **Audit** module, fixes flagged on real pages can be written by AI and pushed live, page by page:
- **🏷 Titles & meta descriptions** — AI writes keyword-matched title tags and meta descriptions into the SEO plugin.
- **🧩 Structured data (schema)** — AI builds page-appropriate JSON-LD (LocalBusiness, Service, Article, etc.) from the business's facts.
- **🖼 Image alt text** — AI describes each image and writes accessible, descriptive alt text (updates both the media library and inline image tags).
- **\# Multiple H1 headings** — demotes extra H1s to H2 for clean heading structure (safely skips page-builder pages like Elementor).
- **🔗 Canonical tags** — adds self-referencing canonical tags to pages missing them.

Fixes run in bulk across all affected pages with live progress, per-category success/skip/fail counts, and re-run capability.

### SEO metadata editor
- **Draft or AI-suggest** a title tag and meta description for any live page and **push it directly to WordPress** — edit once, deploy instantly.

**Sales angle:** Most SEO tools *tell you* what's wrong. Ops Dash *fixes it on the live site* — new content, metadata, schema, alt text, and heading fixes — through a plugin so tightly scoped that a security-conscious client can install it without worry.

---

## One-line positioning statements (for reuse)

- **Job Tracker / Business Analytics:** *"See every client's revenue, profit, pipeline, and marketing ROI in one live dashboard — and prove which lead sources actually turn into paid jobs."*
- **WordPress Connector:** *"Don't just report SEO problems — fix them on the live site. Publish AI-drafted content and deploy titles, meta, schema, alt text, and technical fixes to WordPress in one click, through a plugin locked down to posts and pages only."*
