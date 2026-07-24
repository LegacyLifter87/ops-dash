# Local Competitive Research — How to Win (Ops Dash skill)

Source: Shawn's `Local_Competitive_Research_SKILL.md` (v1.0), integrated into
the Competitors tab 2026-07-24. The runtime version of these rules is embedded
in the `RESEARCH_SYSTEM` prompt inside the **seo-competitors** edge function
(`research_run` action) — keep the two in sync when editing either.

How it maps to the app:
- **Trigger/Inputs** → the Deep Research form on the Competitors tab (decision,
  geography, segment, deadline, outcome). Geography defaults to the site's
  saved service area; segment/outcome are inferred if left blank.
- **Evidence** → gathered automatically from data the app already holds:
  brand profile (seo_social_profiles), service area (seo_service_area),
  service pages (seo_strategy_pages), GBP audit (seo_gbp), competitors
  (seo_competitors) and gap keywords (seo_gap_keywords, DataForSEO estimates).
  The model has NO live web access and must label anything beyond this
  evidence as inference/hypothesis.
- **Outputs** → one `seo_competitive_research.report` jsonb per run: frame,
  executive brief, competitor universe, evidence ledger, weighted scorecard,
  So-What insights, opportunity matrix, experiments, 30/60/90 plan,
  limitations, refresh cadence — rendered on the Competitors tab.

---

## Core Standard
Competitive research is complete only when it changes a decision. The required chain is:

**Evidence → Insight → Decision → Action → Measurement → Learning**

Label every claim as **fact, estimate, inference, or hypothesis**. Give each action an owner, deadline, metric, baseline, target, and guardrail.

## Trigger
Use this skill when asked to:
- identify local competitors;
- compare local businesses;
- audit a competitive market;
- find gaps in local search, offers, reviews, ads, content, or customer experience;
- build a competitive scorecard;
- recommend how a local business can win.

## Required Inputs
Resolve or infer:
1. Business and service line
2. Geography and service radius
3. Customer segment
4. Decision to improve
5. Deadline
6. Business outcome and metrics

## Workflow

### 1. Frame the Decision
Write: "We need to decide [decision] for [service] in [geography] for [segment] by [date]. Success means [outcome/metric]."

### 2. Map the Competitor Universe
Include:
- direct competitors;
- indirect competitors;
- substitutes such as DIY, delay, or in-house solutions;
- attention competitors such as directories, aggregators, franchises, and marketplaces;
- aspirational benchmarks;
- emerging entrants or technologies.

Choose approximately 5–8 direct, 2–4 indirect/substitute, and 1–3 aspirational competitors.

### 3. Build an Evidence Ledger
For each observation record:
- capture date;
- competitor;
- source/channel;
- query and search location where relevant;
- exact observation;
- fact/estimate/inference/hypothesis;
- confidence: high/medium/low;
- interpretation;
- linked opportunity/action.

### 4. Research 12 Dimensions
1. Market footprint
2. Visibility
3. Positioning
4. Offer
5. Pricing
6. Proof
7. Conversion
8. Customer experience
9. Reputation
10. Content and demand capture
11. Operations/capacity signals
12. Momentum

### 5. Research Channels
- Google Maps and Business Profiles
- Organic search and websites
- Reviews and voice of customer
- Paid-search and social ads using public transparency tools
- Social media and content
- Customer journey and ethical mystery shopping
- Census, planning, permit, licensing, and market context sources
- AI-generated answers and cited sources

### 6. Normalize and Score
Use a weighted scorecard based on the decision. Suggested dimensions:
- visibility 12;
- positioning 9;
- offer 12;
- proof 12;
- reviews 10;
- conversion 12;
- content 8;
- paid demand 6;
- customer experience 12;
- momentum 7.

Score 1–5. Multiply by confidence: high 1.00, medium 0.75, low 0.50.

### 7. Create Insights With the "So What?" Ladder
For each important finding write:
1. Observation
2. Pattern
3. Meaning
4. Business impact
5. Action
6. Measure

### 8. Identify Opportunity Type
Classify each as:
- parity gap;
- differentiation gap;
- execution gap;
- white-space opportunity.

Prioritize using customer importance, whitespace, strategic fit, revenue/margin potential, speed, confidence, ease, defensibility, and risk.

### 9. Convert to Experiments
Use:
"Because [evidence], we believe [change] for [segment] will improve [metric]. We will test [single change] against [baseline] for [duration/sample]. Primary metric: [metric]. Guardrails: [quality/margin/complaints]. Decision rule: [threshold]."

### 10. Deliver Outputs
Required deliverables:
- one-page executive brief;
- competitor cards;
- evidence ledger;
- weighted scorecard;
- review/customer-language themes;
- opportunity matrix;
- 30/60/90-day action plan;
- research limitations and refresh cadence.

## Interpretation Rules
- Search rank is not market share.
- Review count is not customer satisfaction by itself.
- Social engagement is not demand by itself.
- Ad longevity is not proof of profitability.
- Third-party traffic, keyword, and spend figures are estimates.
- Visible correlation is not causation.
- Do not copy tactics without identifying the customer need behind them.

## Ethical Rules
Use public, permissioned, or licensed information. Do not misrepresent identity to obtain confidential data, bypass controls, steal trade secrets, coordinate prices, solicit non-public competitive information, or fabricate reviews. Follow platform terms, privacy obligations, and applicable recording/data laws.

## Cadence
- Weekly: 30–60 minute signal scan
- Monthly: scorecard and trend refresh
- Quarterly: strategic reset and journey testing
- Event-triggered: respond to a new entrant, expansion, pricing model, rebrand, acquisition, regulation, or major reputation shift

## Definition of Done
The research is done only when:
- the decision is explicit;
- the competitor set is complete enough;
- evidence is dated and attributable;
- confidence is visible;
- insights explain mechanisms;
- actions are prioritized;
- owners and dates are assigned;
- metrics and guardrails are defined;
- a refresh trigger exists.
