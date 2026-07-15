# Job Tracker — Complete Feature & Function Breakdown

**Purpose:** A comprehensive, source-accurate reference of everything Job Tracker does, written for building marketing and sales materials. Share this into other conversations as raw material for landing pages, one-pagers, sales decks, demo scripts, and feature comparison charts.

**What it is in one sentence:** Job Tracker is an all-in-one field-service operations platform for home-services and trades companies — it runs the entire job lifecycle from lead to paid commission: pipeline, scheduling, job costing, production/QC, permitting, time tracking, payroll, commissions, asset/GPS tracking, vendor management, analytics, and deep CRM/accounting integrations.

**Who it's for:** Home improvement, remodeling, and specialty-trade contractors — owners, office/admin staff, project managers, field technicians, and payroll specialists — plus agencies that manage multiple contractor companies from one login.

---

## Product at a glance

Job Tracker is organized into a role-aware sidebar with five groups:

| Group | Modules |
|---|---|
| **Work** | Dashboard · My Day · Pipeline · Job Tracker · Scheduling · Tasks · Time Clock |
| **Money** | Spending · Commissions · Payroll |
| **Operations** | Asset Manager · Vendors · Permitting |
| **Insights** | Sales Campaigns · Leaderboard · Analytics · Reports |
| **Workspace** | Settings · Support (+ Knowledge Base) |

**Platform:** Installable web app (PWA) that works on phones, tablets, and desktops. Real cloud login, bank-grade data isolation, multi-company/agency support, and one-way and two-way syncs with GoHighLevel, QuickBooks Online, Gusto, Wave, Google Drive, and CompanyCam.

---

## WORK

### Dashboard
One-screen executive snapshot of the entire business.

- **Four live KPI tiles:** Open Pipeline ($ + active lead count), Open Jobs Value ($ + active job count), YTD Revenue, and YTD Gross Profit (with YTD commissions paid).
- **Active Jobs** shortlist with running PM, revenue, and margin % (color-coded green at ≥35%).
- **Hot Leads** shortlist with selling PM, estimate value, and status badge.
- **Tasks Needing Attention** — overdue/due-today tasks (company-wide for admins, personal otherwise); auto-hides when clear.
- **Global search (Ctrl/Cmd + K):** searches jobs, leads, tasks, and notes across name, customer, address, phone, email, business, job #, and gate code — keyboard-navigable and permission-filtered.
- **Notifications:** bell with unread badge, inbox, in-app assignment and due-date alerts.

### My Day
A mobile-first daily command screen for field crews — everything for today in one place.

- **Today's appointments** (only jobs you're assigned to), sorted by time, with one-tap map directions and click-to-call.
- **Site access panel:** occupied/vacant, gate/lockbox code, parking, pets, notes.
- **Per-visit checklist** with done/total counts and per-task start/stop timers.
- **Add photos** via mobile camera straight to the job.
- **Daily log** (weather, work done, problems) with a "Logged ✓" guard against double-reporting.
- **Clock in** button and a **Tasks due today** list with blocked-task indicators.

### Pipeline
Pre-close lead tracking from first call through close; won leads convert into jobs.

- **Tracked per lead:** name, contact, phone, email, full address, job type, estimate amount, site-visit date, selling PM, running PM, lead source, referral source, contact source, proposal/invoice links, and signed date.
- **Milestone checkboxes:** initial call made, site visit scheduled, estimate offered.
- **Statuses:** Active · Follow Up · Closed (Won) · Not Interested.
- **GoHighLevel pipelines** render as live views with their real stages; contact source syncs from GHL.
- **Close → Create Job** carries all data forward; **Mark Not Interested** feeds lost-job analytics.
- **Bulk CSV import** with automatic column mapping.
- **Commission tiering** is set at close by lead source (selling PM earns sales commission, running PM earns GP commission, optional referral commission).

### Job Tracker (core)
The post-close system of record: job list/board, full job detail, cost & profitability tracking, production/QC, documents, and integrations.

**List & board**
- **List view** with health dot, job #, type, scheduled date, age chip, run PM, stage pill, permit status, Value, Cost, Actual GP (green when on target), Margin (green ≥35% / amber ≥20% / red below), and status.
- **Kanban board:** drag jobs between configurable stages; drops fire the GoHighLevel stage trigger. Cards color by aging thresholds.
- **Filters:** Active / Completed / Canceled / All, PM filter, search. Add manually or by CSV import.

**Job detail — lifecycle**
- Health badge (On track / Watch / At risk / Needs attention), stage pill, lead-source badge, age badge.
- Actions: Mark Completed, Cancel (with disposition reason for analytics), Reopen, Delete, and **"🚗 On My Way"** (texts the customer the tech is en route).
- **Commission clawback:** canceling/deleting a job with paid commissions stages a reversal that can be pushed to Gusto and Wave (never auto-run).

**Overview & financials**
- Full job details, customer/business info, value, type, stage, referral & contact source, scheduled date, **estimated production days** (used vs. remaining), selling/running PM, and custom fields.
- **Financial header:** margin gauge vs. target, budget-used gauge, tiles for Job Value / Total Cost / Actual GP / Expected GP, and a cost-composition bar (GP, labor, subs, materials, consumables, equipment).
- **Budget vs. Actual** for labor $, labor hours, materials, and overall project — each with progress bars and over/under amounts.
- **Payment schedule (draws):** % or fixed-$ customer milestones, optionally tied to a stage or phase, tracked Scheduled → Due → Invoiced → Paid.
- **Production readiness checklist** with an auto % score that gates scheduling from Tentative → Confirmed.
- **Site access, delays** (with reason, note, expected-resolution date), and a permits/engineering mirror.

**Costing**
- **Labor:** log tech, hours, category, date — costed at the blended rate (± per-tech adjustment).
- **Subs & Materials:** vendor, description, amount, category, with receipt/document upload (image/PDF/Office up to 10 MB) or a link.
- **Consumables:** draw stocked items by quantity from inventory; auto-costs and decrements stock.
- **Financial logic:** Cost = labor + subs + materials + consumables + equipment. Expected GP = value × standard margin. Actual GP = value − total cost. Margin = Actual GP ÷ value.

**Production, photos & documents**
- **Production Log:** daily logs, **QC checkpoints** (pass/fail gates, photo-required options, auto fix-it tasks on fail), milestones, and a unified timeline.
- **Photos:** auto-synced from GoHighLevel and CompanyCam, plus uploads, with category tagging and Google Drive folder sync.
- **Documents:** central repository with Drive two-way sync; key-document slots (Site plan, Permit, Engineering, Proposal, Invoice); required-document workflow (Needed → Requested → Received → Approved/Rejected).
- **Messages & Notes:** two-way SMS thread and contact notes synced with GoHighLevel; a manual communication log; in-app GHL appointment booking.

### Scheduling
Native appointment booking and dispatch — Job Tracker is the system of record.

- **Appointments** with title, type, color, status, phase, location, and internal vs. client-safe notes; company-configurable types with default durations and colors.
- **Status lifecycle:** Tentative → Scheduled → Confirmed → In Progress → Completed (+ Rescheduled / Canceled / No-show); tentative appointments carry a **confidence** rating.
- **Multi-day & recurring bookings:** add days before or after, with weekly/biweekly/monthly/annual recurrence (capped at 60 visits) and a live "creates N visits" count.
- **Crew, team, asset & vendor assignment** per appointment and per day, each with a designated **foreman**.
- **Live free/busy availability** per person from connected calendars (🟢 free · 🔴 busy · ⚪ no calendar).
- **Conflict detection:** asset double-bookings are hard blocks; people/vendor overlaps are warnings.
- **Phases** (Demo → Install → Inspection…) with status tracking and foreman-collect-draw prompts.
- **Visit & foreman checklists**, a **readiness gate** on confirmation, and **asset custody** (Reserved → Checked out → Returned).
- **Business Scheduling Board** (owners/admins): Calendar / Crew / Vendor modes, a "clocked in now" cost banner, and a "needs attention" at-risk-jobs panel.
- **Teams management** (crews with members, lead, working days, daily capacity, skills) and **per-user Google/Outlook calendar sync**.

### Calendar
Google-Calendar-style Day / Week / Month view of all appointments.

- Three views with Today/prev/next; live "now" line; click-empty-slot to book (admins).
- **Color-by-job** across all views, overlap column packing, and hover highlighting of a job's sibling visits.
- **Month project bars** spanning multi-day jobs, lane-packed, each day segment click-through.
- **Event detail popover:** status/confidence, customer, address, click-to-call, foreman, techs, phase, assets, vendors, reference docs, live checklist with start/stop timers, and admin actions (confirm/edit/cancel/delete/open job).

### Tasks
A tasks board combining personal assignments and shared appointment checklists, synced to GoHighLevel.

- **Scopes:** "My tasks" for everyone; "All tasks" company-wide for admins; filters by status and assignee.
- **Fields:** title, description, assignee, due date/time, linked job, and **dependencies** ("wait for" other tasks).
- **Assignment rules** by role; **per-task start/stop timers**; blocked tasks require explicit override to complete.
- **Automations:** tasks sync to GoHighLevel as contact tasks and fire in-app notifications on assignment and due.

### Time Clock
Project-based clock in/out; clocked time becomes labor cost on the job.

- **Clock into a project** with a labor category; **switch project or category without clocking out** (debounced to prevent phantom entries).
- Live displays of current project/category, elapsed time, and today's total hours.
- **Role gating:** an "edit time-clock entries" permission unlocks the team view; PMs see only their own timesheet.
- **"Clocked in now"** panel with per-person clock-out; stats and a Team-Hours-by-Person chart; editable timesheet with overnight-shift handling and configurable rounding.

---

## MONEY

### Spending
One-tap mobile cost capture for field staff.

- **Two cost types:** Materials (with category) or Vendor Payment (subcontractor) — posts to job costing immediately.
- **Receipt attachment** (image/PDF/Office, ≤10 MB) with thumbnail preview.
- **Auto-routing:** records the cost, files the receipt in job docs, and **emails it to the company's Payables address**.
- **Recent Spending** feed and an **admin CSV export** with date-range presets and receipt links.

### Commissions
A complete commission engine with splits, approvals, payouts, draws, clawbacks, and forecasting.

- **Rate tiers by lead source:** separate Sales % and GP % for Company-Generated vs. Self-Generated jobs.
- **Sales pool** = job value × tier sales rate. **GP pool** = (Actual GP − sales) × tier GP rate, floored at zero.
- **Split editor:** independent Sales split (who sold) and GP split (who ran), any number of PMs, even or custom %, validated to 100%, with live dollar preview.
- **Payout schedules:** at install / at sale / 50-50 split (GP always at install); referral payouts; **per-job bonuses** for the running PM and every tech who logged labor (flat / % of GP / % of sale).
- **Approval workflow:** Pending → Approved / Adjustment requested → Ready to pay → Paid, with email notifications; recipients approve their own or request adjustments.
- **Clawbacks:** reversal batches for canceled/deleted paid jobs, reviewed then pushed to payroll/bookkeeping or voided.
- **Draw tracker:** commission earned vs. draws paid, net "ahead" / "in the hole" balance.
- **Forecast by stage** (estimates for open jobs, actuals for completed) and a **payroll-ready CSV export** with an optional push to Gusto.

### Payroll
Payroll reporting with a personal "My Pay" view for everyone and a company view for admins/payroll.

- **Cadence:** weekly / biweekly / monthly, anchored to a set date, with prev/next navigation.
- **My Pay:** hours, commissions & bonuses due, draws taken, net commission, a pending callout, a personal forecast, and a **pace projection** for the period.
- **Company Payroll:** period totals and a per-member table (hours, due, pending, draws, net).
- **Gusto submit surface:** preview and confirm-push of approved commission lines onto the open Gusto payroll — **staged only; the company always runs payroll itself.**

---

## OPERATIONS

### Asset Manager
Live map-based tracking of equipment, vehicles, and people, with maintenance and job-site billing.

- **Asset profiles** (name, color, value, assigned-to) on a free OpenStreetMap map.
- **Three tracking methods:** phone app (Traccar), hardware GPS tracker (Teltonika/Concox/Queclink by IMEI), or manual pin — each with a guided setup walkthrough.
- **Live map** (polls every 20s) with asset pins, person avatars, and geofenced job-site circles; per-asset battery %, speed, odometer, and "service due" badges.
- **Live team tracking:** employees appear on the map only while clocked in and opted in; per-user sharing controls.
- **Job sites & auto clock-in:** geofence active jobs with adjustable radius; arriving tracked employees auto-clock into that job.
- **Maintenance schedules** by miles/days with due alerts and "done today" re-arming.
- **Job-site equipment billing:** bill assets per visit or per hour on site, auto-posting to job costing within a configurable window.

### Vendors
A micro-CRM for subcontractors and suppliers — profiles, compliance, approval, chat, scheduling, and portal access.

- **Vendor profiles** with multiple contact blocks (billing / scheduling / primary), company-defined categories, and search/filter.
- **Approval workflow:** Waiting on docs → Waiting on approval → Approved (also Inactive).
- **Compliance documents:** state license, insurance (COI), commercial auto, W-9, and custom requirements, with expiration tracking and an "X/Y required on file" gate.
- **Vendor portal access management:** auto-email logins, resend/revoke, invite-all.
- **Two-way messaging**, a read-only vendor **schedule** calendar, booking-availability display, and internal team-only notes.

### Vendor Portal *(external app)*
A standalone vendor-facing web app where subcontractors self-serve their relationship with the client.

- **Secure sign-in** with forced first-password change; **one password across every client company** they serve, with a company switcher.
- **Approval status** view and **document management** — upload exactly the required docs into the right slots, with expiration dates.
- **Schedule** of client-booked jobs with map addresses; **per-booking job-site photo upload** (camera, auto-downscaled) straight into the client's job.
- **Booking availability self-service** (weekdays/hours, warn-or-block on out-of-window bookings), **two-way messaging**, and optional **Google Calendar** sync.

### Permitting
A staged permitting board with authority tracking, auto-posting fees, and an engineering sub-workflow.

- **Permit board** tabbed by stage with live counts; stage movement with aging (yellow/red past thresholds).
- **Per-permit fields:** authority (from a managed list), applied date, secondary contact, **permit fee (auto-added to job costs)**, and doc/site-plan links.
- **Engineering sub-workflow:** any number of engineering items with firm, type, status, **cost (auto-posted)**, and document links.
- **Custom permit fields** and a module-wide on/off toggle.

---

## INSIGHTS

### Sales Campaigns
Admin-built KPI competitions with reward tiers and live standings.

- **KPIs:** total projects sold · total sales $ volume · sold→installed % · best gross margin.
- **Attribution** by selling or running PM; **period presets** from 1 day to 1 year or custom.
- **Ranked reward tiers** (1st/2nd/3rd…), each a $ bonus, % of GP or sales volume, or a non-cash award.
- **Live standings** (auto-refresh every 45s), lifecycle management, and a **payout approval + Gusto push** flow.

### Leaderboard
Gamified rankings and per-member stat sheets with role-based visibility.

- **Rank by** total project value · deals closed · profit generated · gross margin, across week/month/quarter/year/custom.
- **Podium** with medals, movement indicators (vs. prior period), and **achievement badges** (Top Seller, Most Deals, Top Profit, Best Margin).
- **PM stat sheets** (value, deals, profit, margin, jobs — each with the member's rank) and **technician stat sheets** (hours, days, jobs, est. labor value, hours-by-category).

### Analytics
A multi-tab analytics workspace covering sales, profitability, production, and compensation, with a global time-period bar, printable PDF, and multi-sheet Excel export.

- **Gross Profit & Performance:** open value, revenue, GP, avg margin, GP per labor hour, avg lead value, projected GP/mo, GP by PM, margin by job type, cost-composition donut, revenue-vs-GP trend, sold→installed follow-through.
- **Production:** jobs needing attention, open delays, QC pass rate, schedule accuracy, backlog, daily-log coverage, crew utilization (14-day), required-documents status, health donut.
- **Sales:** lead volume, closing ratio, GP, per-PM close-rate table, win-rate trend, lead-type and contact-source analysis, referral-source close rates.
- **Budget, Pipeline (funnel + forecast), Lost Jobs, Sources, Conversion Funnel** (joins GHL appointments with jobs — show rate, close rate, won revenue by source).
- **Spending, Consumables, Permits, Engineering, Labor, and Commissions** tabs, each with KPIs, charts, and tables.
- **PDF report** bundling every section and a **multi-sheet Excel export** (Summary, Sales by Rep, Jobs, Labor, Materials, Subs, Consumables, Leads, Commissions, Delays, QC, Documents, Daily Logs, Schedule Accuracy, Crew Utilization).

### Reports
A detailed Excel workbook export — a summary tab plus one tab per project.

- **Timeframe presets** and a **date basis** (signed vs. completed).
- **Summary tab:** one row per project with full financials, budgets, commissions, health, and schedule variance, plus a totals row.
- **Per-project tabs:** header, financials, line-item cost breakdowns, production block (health, delays, QC, documents, milestones, logs), and commission payout lines.

---

## WORKSPACE

### Settings
Central configuration hub grouped into Company, Financials, Team & Access, Job Tracker, Workflows, Categories, Consumables, Permitting, Notifications, Integrations, and Data.

- **Company branding** (name + logo).
- **Financial rates:** blended labor rate, standard margin, commission rate tiers by lead source, referral rate, per-job bonus rules (with per-person overrides), and payout schedule.
- **Time-clock rounding**, **pay-week** and **pay-period** settings, **end-of-day auto clock-out**, and **payables/payroll/consumables notification emails** (each with a "send test").
- **Job stages** (with calendar colors), **cancellation reasons**, and **job-age alerts**.
- **Workflow templates** scoped to job types that auto-generate tasks, required documents, and QC checkpoints; **production-readiness**, **phase**, and **payment-draw** templates.
- **Custom categories** (job types, labor categories, spending categories, contact sources, appointment types).
- **Consumables inventory** with reorder alerts; **permitting** authorities, engineering firms/types/statuses, and aging alerts.
- **Notifications:** team (in-app + email) and customer (SMS via GHL), reminder schedule, on-my-way GPS trigger distance, and an **AI-insight end-of-day analytics report**.
- **Data:** Excel export, JSON backup/restore, reset-to-demo, and erase.

### Roles & Access
Role-based access with a per-user override engine.

- **Roles:** Overall Admin, Sub-Admin (agency); Company Owner, Company Admin, Project Manager, Technician, Payroll.
- **19 toggleable menus** plus an "edit time-clock entries" permission; access set per role and fine-tuned per user, with row-level data scoping.
- **"View as" impersonation** (agency admins) applies a member's exact menu access and data scope.
- Administrator-managed sign-in (no self-signup), password reset, "no access yet" and "account suspended" screens.

### Team & Company Administration
- **Team management:** add members (creates login + emails credentials), assign roles, edit profiles (work type, foreman flag, location-tracking, adjusted labor rate, recurring draw), reset passwords, and remove.
- **GoHighLevel user import** as technicians, with a silent "sync now."
- **Multi-tenant admin console** (agency): create/open/rename/**suspend**/delete companies; manage overall and sub-admins, their home company, and company membership.

### Support & Knowledge Base
- **Support portal:** submit bug/support tickets, track them with per-ticket two-way chat, and see agency contact details; agency-side triage queue with resolve and chat.
- **Knowledge Base:** searchable SOP/help articles by category, a Markdown editor (global vs. company-scoped, published/draft), a safe XSS-proof renderer, and an **"Ask AI" assistant** grounded only in the knowledge base.

---

## INTEGRATIONS

- **GoHighLevel (GHL) CRM** — one-way sync pulling pipeline deals and appointments in: opportunities become leads, stage moves sync, "Won" converts to a job, contacts propagate; live webhooks, backfill, calendar booking, and two-way SMS/notes on the job.
- **QuickBooks Online** — pushes material/subcontractor costs as expenses (mapped account) and optionally revenue as invoices or sales receipts, with a daily/weekly/monthly auto-sync.
- **Gusto Payroll** — maps reps to W-2/1099 people and stages approved commissions as payroll lines or contractor payments (never runs payroll).
- **Wave Accounting** — posts costs and revenue as balanced double-entry transactions (idempotent, batched).
- **Google Drive** — auto-creates a Photos/Documents folder per active job with ~10-minute two-way sync.
- **CompanyCam** — auto-imports job-site photos from linked projects (webhook instant sync + safety sweep).
- **CSV import** — generic bulk import with smart header mapping, reused across leads, vendors, and jobs.

---

## PLATFORM & SECURITY

- **Installable PWA** — works on phones, tablets, and desktops with an "add to home screen" experience and offline-capable service worker.
- **Real cloud auth** — server-enforced email/password sign-in (Supabase Auth); runs local single-device mode until a cloud project is connected.
- **Row Level Security** — all data isolated so only authenticated users read/write it; nothing sits unprotected in the browser.
- **Multi-tenant + agency model** — company isolation with agency admins who manage many companies from one login.
- **Private receipt storage** — receipts/invoices in a private bucket served via short-lived signed URLs, scoped to job visibility.
- **Transactional email** — server-side email for reminders and sign-in links from a verified domain.
- **Public technician profile pages** — opt-in, no-login "who's coming" pages linked from appointment reminder texts.
- **Backup/restore** — JSON export/import and data reset/erase.

---

## Positioning one-liners (for reuse)

- **Whole-business:** *"From the first phone call to the last commission check — Job Tracker runs the entire job in one place, so nothing falls through the cracks between the office and the field."*
- **Profit visibility:** *"Know the real margin on every job in real time — labor, subs, materials, and consumables costed automatically as the work happens."*
- **Field-ready:** *"Built for the truck, not just the desk — clock in, log the day, snap photos, and collect the draw from your phone."*
- **Pay people right:** *"Commissions, splits, bonuses, draws, and clawbacks calculated automatically and staged straight into Gusto — you just review and run payroll."*
- **Connected:** *"Plugs into the tools you already use — GoHighLevel, QuickBooks, Gusto, Wave, Google Drive, and CompanyCam."*
- **For agencies:** *"Run every client company from one login, with data walled off between them and 'view as' to see exactly what any user sees."*
