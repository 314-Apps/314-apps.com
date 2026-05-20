# Inventr Blog — 500-Post Content Plan

Master roadmap for expanding the Inventr blog from 110 posts to 610 posts. This document is the single source of truth for which titles to write next, which clusters they belong to, and where each post should funnel readers in the Inventr ecosystem.

> **For contributors:** Do not generate posts that are not on this list without first adding them here. Every post must (a) target a clearly differentiated keyword, (b) link to ≥2 existing posts, and (c) end with a tool-specific CTA banner pointing at the funnel surface listed for its cluster.

---

## 1. Strategy

### 1.1 Why a plan, not a dump

110 hand-crafted long-form posts already rank and convert well. Bulk-publishing 500 more without a strategy invites three failure modes:

1. **Google Helpful Content / Spam policies** explicitly target sites that scale unedited AI publishing. Drip-publishing with hand-quality posts avoids this trap.
2. **Cannibalization** — multiple posts targeting the same keyword cluster compete with each other and dilute rank.
3. **Funnel dilution** — every post is a chance to send a reader to the right Inventr surface (the app or a specific calculator). Generic "Try Inventr" CTAs everywhere is a wasted opportunity.

The remedy is a rigid taxonomy plus an editorial discipline: each post owns a unique angle, links into the cluster's pillar, and points at the most relevant funnel surface.

### 1.2 Quality bar (every post must pass)

- ~2,000 words (200–280 lines of HTML), structured as: hero, intro narrative, 3–5 H2 sections, ≥1 unique table or list, ≥1 `.tip` or `.warning` callout, closing CTA banner.
- A unique opening narrative — name a hypothetical reseller, show specific dollars/hours/inventory, do not start with "In the world of reselling..." or similar bland intros.
- ≥2 internal links to existing posts (1 same-cluster pillar + 1 cross-cluster supporting post).
- A cluster-appropriate CTA banner with the matching `cta-banner` styling and the relevant funnel-tool URL or `https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683`.
- Listed in [blog/index.html](blog/index.html) under the correct cluster section, with the cluster also added to the `category-nav` chips.

### 1.3 Publishing cadence

500 posts at 5/week = ~24 months. Recommended:

| Phase | Months | Posts/week | Cumulative |
| --- | --- | --- | --- |
| Validation | 1–3 | 3 | 36 |
| Steady state | 4–18 | 5 | 36 + 325 = 361 |
| Long-tail fill | 19–28 | 3–4 | ~500 |

Avoid publishing >10 posts in a single day, and avoid bursts of >20 in a week — both look like content-farm signals to Google.

### 1.4 Funnel mapping

Each cluster has a primary CTA target. Posts may swap to a secondary CTA when the topic is closer to a different tool.

| Cluster family | Primary CTA |
| --- | --- |
| `profit-calculator/` | `/funnel-tools/profit-calculator/` |
| `break-even-calculator/` | `/funnel-tools/break-even-calculator/` |
| `sell-through-calculator/` | `/funnel-tools/sell-through-calculator/` |
| `pnl-template/` | `/funnel-tools/pnl-template/` |
| `spreadsheet-template/` | `/funnel-tools/spreadsheet-template/` |
| `photo-checklist/` | `/funnel-tools/photo-checklist/` |
| `tax-checklist/` | `/funnel-tools/tax-checklist/` |
| `sourcing-guide/` | `/funnel-tools/sourcing-guide/` |
| `migration-guide/` | `/funnel-tools/migration-guide/` |
| `booth-scorecard/` | `/funnel-tools/booth-scorecard/` |
| `inventr-app/` | `https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683` |
| **Online platforms** (`ebay/`, `etsy/`, etc.) | `https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683` (cross-channel inventory pain naturally surfaces app value) |
| **Niches** (`niches-*/`) | `https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683` |
| **Ops/business** (`consignment-shop-ops/`, etc.) | `https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683` |

### 1.5 Internal linking strategy

Every new post must link to:

1. **One same-cluster pillar.** Each cluster has 1–3 designated pillar posts (the highest-search-intent topics). Pillars link out; satellites link back.
2. **One cross-cluster supporting post.** Example: an eBay post on platform fees should link to [blog/profit-calculator/platform-fee-comparison-ebay-poshmark-mercari.html](blog/profit-calculator/platform-fee-comparison-ebay-poshmark-mercari.html).
3. **The cluster's primary CTA** in the closing `cta-banner`.

Optional but encouraged:
- Link to one more post in an adjacent niche (e.g. furniture flipping post links to a Facebook Marketplace post).
- Link to the inventr-app cluster when the post discusses workflow pain.

### 1.6 SEO/quality guardrails

- **Uniqueness:** No two posts share the same H1. No two posts share the same opening paragraph (search "Meet Sarah" — only one post can use that exact intro).
- **Original artifacts:** Each post needs ≥1 original table, ordered list, callout, or worked example with concrete numbers.
- **Human-edit pass:** Before publishing, re-read every post end-to-end. Look for hallucinated numbers, generic AI phrasing ("In today's fast-paced world..."), missing internal links, broken CTAs.
- **Schema:** Future task — add Article structured data to every post. Tracked in §6 below.

---

## 2. Cluster taxonomy

### 2.1 Existing clusters (110 posts → +130 = 240)

| Cluster | Existing | Add | Total | Pillar(s) |
| --- | --- | --- | --- | --- |
| `profit-calculator/` | 10 | 15 | 25 | `why-revenue-isnt-profit.html`, `how-to-calculate-true-reselling-profit.html` |
| `sourcing-guide/` | 10 | 15 | 25 | `best-things-flip-thrift-stores.html`, `research-item-value-60-seconds.html` |
| `tax-checklist/` | 10 | 10 | 20 | `reseller-tax-basics.html`, `what-is-schedule-c-resellers.html` |
| `photo-checklist/` | 10 | 10 | 20 | `how-to-photograph-resale-items.html`, `photos-every-listing-needs.html` |
| `sell-through-calculator/` | 10 | 10 | 20 | `what-is-sell-through-rate.html`, `how-to-improve-sell-through-rate.html` |
| `break-even-calculator/` | 10 | 10 | 20 | `how-to-calculate-booth-break-even.html`, `true-cost-running-consignment-booth.html` |
| `pnl-template/` | 10 | 10 | 20 | `what-is-pnl-statement-resellers.html`, `how-to-read-pnl-better-decisions.html` |
| `booth-scorecard/` | 10 | 10 | 20 | `improve-booth-score-30-days.html`, `display-layout-affects-sales.html` |
| `migration-guide/` | 10 | 5 | 15 | `resellers-guide-data-migration.html`, `why-ditch-inventory-spreadsheet.html` |
| `spreadsheet-template/` | 10 | 5 | 15 | `ultimate-guide-inventory-spreadsheets.html`, `when-spreadsheet-isnt-enough.html` |
| `inventr-app/` | 10 | 30 | 40 | `getting-started-inventr-walkthrough.html`, `how-inventr-tracks-profit-automatically.html` |

### 2.2 New clusters (370 new posts)

| Cluster | Posts | Pillar (first post to write) | Why this cluster |
| --- | --- | --- | --- |
| `ebay/` | 45 | `ebay-store-vs-no-store-roi.html` | Largest reseller platform; massive long-tail keyword surface |
| `etsy/` | 30 | `etsy-vintage-20-year-rule-explained.html` | Vintage gatekeeper for resellers; high-intent searches |
| `poshmark/` | 25 | `poshmark-sharing-strategy-hours-vs-sales.html` | Closet-clothing dominance; Inventr cross-listing fit |
| `mercari/` | 20 | `mercari-vs-poshmark-where-to-list-first.html` | Strong informational + comparison intent |
| `whatnot/` | 15 | `whatnot-live-selling-real-economics.html` | Live commerce growth; underserved long-form |
| `facebook-marketplace/` | 15 | `fb-marketplace-furniture-flip-margins.html` | Furniture/local resale mainstay |
| `depop/` | 10 | `depop-seo-tags-titles-photos.html` | Gen Z streetwear/Y2K niche |
| `amazon-resellers/` | 20 | `amazon-fba-vs-fbm-resellers.html` | Used/MFN resale channel |
| `offerup-craigslist/` | 15 | `offerup-vs-craigslist-furniture-flippers.html` | Local resale workflow |
| `niches-vintage-clothing/` | 20 | `identifying-valuable-vintage-band-tees.html` | Highest-margin clothing niche |
| `niches-books/` | 15 | `book-scanning-apps-which-actually-pay.html` | Long-tail dense + steady volume |
| `niches-electronics/` | 15 | `vintage-electronics-pre-2000-sleepers.html` | Mid-margin, high-search niche |
| `niches-toys-collectibles/` | 20 | `funko-pop-flipping-still-worth-it.html` | High-search variety; Funko, LEGO, sports cards |
| `niches-furniture/` | 15 | `mid-century-modern-identification.html` | Local resale flagship niche |
| `niches-glassware-pottery/` | 10 | `vintage-pyrex-pricing-decoder.html` | Booth bread-and-butter |
| `niches-vinyl/` | 10 | `vinyl-resale-genres-eras-that-sell.html` | Niche but loyal search audience |
| `niches-tools/` | 10 | `vintage-hand-tools-brands-that-hold-value.html` | Underserved local-market niche |
| `niches-handbags/` | 5 | `authenticating-designer-handbags.html` | Higher AOV, smaller volume |
| `niches-sports-memorabilia/` | 10 | `reselling-sports-cards-2026.html` | Renewed search momentum |
| `consignment-shop-ops/` | 20 | `setting-consignor-splits-fairly.html` | Differentiates Inventr from booth-only competitors |
| `operations-fulfillment/` | 10 | `reseller-fulfillment-pick-pack-ship.html` | Workflow-heavy; natural Inventr funnel |
| `scaling-growth/` | 10 | `side-hustle-to-full-time-roadmap.html` | Aspirational; long buyer journey |
| `mindset-burnout/` | 5 | `reseller-burnout-diagnosing-signs.html` | Shareable, brand-building |

---

## 3. The 500 titles

Numbering is for tracking only. Filenames follow `kebab-case.html`. All titles below are queued unless noted in §5 (Batch tracker).

### 3.1 Existing-cluster expansions (130 titles)

#### profit-calculator (15)

1. `the-30-30-30-10-profit-rule.html` — The 30-30-30-10 Profit Rule for Resellers
2. `how-returns-erode-profit-margin.html` — How Returns Erode Your Profit Margin (And the Math)
3. `profit-per-hour-the-metric-that-changes-everything.html` — Profit Per Hour: The Metric That Changes Everything
4. `profit-margin-by-category.html` — Profit Margin by Category: What You Should Expect
5. `lower-margins-faster-sales-tradeoff.html` — Should You Accept Lower Margins for Faster Sales?
6. `variable-vs-fixed-costs-resellers.html` — Variable vs Fixed Costs: How They Affect Your Profit
7. `hidden-tax-of-promoted-listings.html` — The Hidden Tax of Promoted Listings on Your Margin
8. `reverse-engineer-sourcing-budget-from-profit-goals.html` — How to Reverse-Engineer a Sourcing Budget from Profit Goals
9. `profit-per-square-foot-booth.html` — Profit per Square Foot: A Booth-Owner Metric
10. `compounding-reseller-profits.html` — Compounding Reseller Profits: How to Reinvest Wisely
11. `best-sellers-not-most-profitable.html` — Why Your Best-Sellers Aren't Always Most Profitable
12. `the-50-percent-rule-pricing-used-items.html` — The 50% Rule for Pricing Used Items (and When to Break It)
13. `markup-vs-margin-the-math-mistake.html` — Markup vs Margin: The Reseller's Math Mistake
14. `tracking-profit-across-channels.html` — Tracking Profit Across Multiple Sales Channels
15. `from-1k-to-10k-profit-roadmap.html` — From $1k to $10k Months: A Profit Roadmap

#### sourcing-guide (15)

1. `estate-sale-day-before-vs-day-of.html` — Sourcing Estate Sales the Day Before vs Day Of
2. `auction-sourcing-101.html` — Auction Sourcing 101: From Live Bid to Resale
3. `shopgoodwill-online-for-resellers.html` — Goodwill Online (ShopGoodwill) for Resellers
4. `storage-unit-auction-sourcing.html` — Sourcing from Storage Unit Auctions
5. `building-a-pickers-network.html` — Building a Pickers Network in Your Town
6. `liquidation-pallets-risk-vs-reward.html` — Sourcing Liquidation Pallets: Risk vs Reward
7. `antique-trail-sourcing-routes.html` — The Antique Trail: Mapping Your Best Sourcing Routes
8. `reproductions-vs-real-thing.html` — How to Spot a Reproduction vs the Real Thing
9. `vintage-pyrex-sourcing-guide.html` — The Reseller's Guide to Vintage Pyrex
10. `goodwill-high-end-brands-sourcing.html` — Sourcing High-End Brands at Goodwill (Without Wasting Time)
11. `bulk-buying-when-it-helps.html` — Bulk Buying: When It Helps and When It Hurts
12. `holiday-sourcing-90-day-calendar.html` — Sourcing for the Holidays: A 90-Day Calendar
13. `cross-border-sourcing.html` — Cross-Border Sourcing: Risks and Reality
14. `buying-inventory-from-other-resellers.html` — Buying Inventory from Other Resellers (Without Getting Burned)
15. `walk-away-test-sunk-cost.html` — The "Walk Away" Test: Avoiding Sunk-Cost Sourcing

#### tax-checklist (10)

1. `hobby-vs-business-irs-litmus-test.html` — Hobby vs Business: The IRS Litmus Test for Resellers
2. `lesser-known-reseller-tax-hacks.html` — Lesser-Known Reseller Tax Hacks (Beyond the Mileage Deduction)
3. `state-sales-tax-nexus-resellers.html` — State Sales Tax Nexus for Online Resellers
4. `inventory-and-taxes-unsold-stock.html` — Inventory and Taxes: When You Get Taxed on Unsold Stock
5. `choosing-a-reseller-tax-pro.html` — Choosing a Tax Pro Who Actually Understands Reselling
6. `sole-prop-vs-llc-vs-scorp-resellers.html` — Sole Prop vs LLC vs S-Corp for Resellers
7. `multi-platform-tax-implications.html` — Tax Implications of Selling on Multiple Platforms
8. `1040-schedule-1-vs-c.html` — Form 1040 Schedule 1 vs Schedule C: Which Applies?
9. `cash-vs-accrual-method-resellers.html` — Cash Method vs Accrual: Which Should Resellers Use?
10. `surviving-irs-audit-reseller.html` — Surviving an IRS Audit as a Reseller

#### photo-checklist (10)

1. `phone-camera-settings-for-listings.html` — Phone Camera Settings That Make Listings Pop
2. `color-accurate-listing-photos.html` — Color-Accurate Listing Photos: A White Balance Primer
3. `photographing-glassware-without-reflections.html` — Photographing Glassware Without Reflections
4. `mannequin-vs-flat-lay-vs-model.html` — Mannequin vs Flat-Lay vs Model: Clothing Photo Showdown
5. `stop-motion-and-360-listings.html` — Stop-Motion and 360-Degree Listings: Worth It?
6. `ai-photo-tools-for-resellers.html` — AI Photo Tools for Resellers: What Actually Helps
7. `photographing-damage-honestly-templates.html` — Photographing Damage Honestly (Sample Templates)
8. `photographing-books-postcards-paper.html` — Photographing Books, Postcards, and Paper Goods
9. `the-hero-shot-formula.html` — The "Hero Shot" Formula That Lifts Click-Throughs
10. `building-a-light-tent-under-20.html` — Building a Light Tent for Under $20

#### sell-through-calculator (10)

1. `the-60-day-rule-pull-listing.html` — The 60-Day Rule: When to Pull a Listing
2. `sell-through-by-platform-reality.html` — Sell-Through Rate by Platform: A Reality Check
3. `why-sell-through-drops-q1.html` — Why Sell-Through Drops in Q1 (and What to Do About It)
4. `sell-through-vs-sell-in.html` — Sell-Through Rate vs Sell-In Rate: Don't Confuse Them
5. `predicting-sell-through-before-you-buy.html` — Predicting Sell-Through Before You Buy
6. `inventory-aging-buckets.html` — Aging Buckets: Sorting Your Inventory by Days On Hand
7. `selling-aged-inventory-at-cost.html` — Selling Aged Inventory at Cost: A Math Argument
8. `compounding-cost-of-slow-movers.html` — The Compounding Cost of Slow Movers
9. `sell-through-and-cash-flow.html` — Sell-Through and Cash Flow: How They Connect
10. `tracking-sell-through-without-killing-day.html` — Tracking Sell-Through Without Killing Your Day

#### break-even-calculator (10)

1. `break-even-calendar.html` — The Break-Even Calendar: Knowing the Day You Pay Rent
2. `break-even-multi-booth.html` — Break-Even for Multi-Booth Operators
3. `hidden-break-even-of-online-time.html` — The Hidden Break-Even of Online Selling: Time
4. `break-even-with-variable-commissions.html` — Break-Even with Variable Booth Commissions
5. `mid-year-booth-audits-break-even-drift.html` — Mid-Year Booth Audits: Catching Break-Even Drift
6. `break-even-off-season-survival.html` — Break-Even and the Off-Season Survival Plan
7. `booth-doesnt-break-even-decision-tree.html` — When Your Booth Doesn't Break Even: A Decision Tree
8. `booth-sub-leasing.html` — Booth Sub-Leasing: A Break-Even Lever
9. `break-even-on-booth-move.html` — Break-Even on a Booth Move (Worth It or Not?)
10. `two-booths-one-owner-crossover.html` — Two Booths One Owner: Crossover Break-Even

#### pnl-template (10)

1. `reading-pnl-like-a-lender.html` — Reading a P&L Like a Lender Would
2. `quarterly-pnl-review-routine.html` — The Quarterly P&L Review Routine
3. `12-month-rolling-pnl.html` — Building a 12-Month Rolling P&L
4. `categorizing-expenses-reseller-pnl.html` — Categorizing Expenses for a Reseller P&L
5. `pnl-for-booth-and-online-hybrid.html` — P&L for a Booth + Online Hybrid Business
6. `pnl-forecasting-holiday-quarter.html` — P&L Forecasting for the Holiday Quarter
7. `pnl-variance-analysis.html` — P&L Variance Analysis: Why You Beat (or Missed) Plan
8. `separating-personal-business-pnl.html` — Separating Personal and Business in Your P&L
9. `pnl-reseller-partnership.html` — P&L for a Multi-Owner Reseller Partnership
10. `pnl-to-balance-sheet-next-step.html` — From P&L to Balance Sheet: The Next Step

#### booth-scorecard (10)

1. `lighting-your-booth-cheap-wins.html` — Lighting Your Booth: Cheap Wins That Lift Sales
2. `booth-sound-smell-sight.html` — Booth Sound, Smell, and Sight: Sensory Sales Levers
3. `booth-theme-rotations-6-week.html` — Booth Theme Rotations on a 6-Week Cadence
4. `booth-hot-zone-where-eyes-go.html` — The "Hot Zone" of a Booth: Where Eyes Go First
5. `the-80-20-booth-audit.html` — The 80/20 Booth Audit
6. `booth-photography-cross-promotion.html` — Booth Photography for Listing Cross-Promotion
7. `tagging-booth-items-online-sync.html` — Tagging Booth Items for Online Sync
8. `co-booth-strategies-shared-space.html` — Co-Booth Strategies: Sharing Space, Splitting Costs
9. `holiday-booth-setups-that-convert.html` — Holiday Booth Setups That Actually Convert
10. `booth-mix-mid-low-high-end.html` — Mid-Range vs Low-End vs High-End Booth Mix

#### migration-guide (5)

1. `migrating-mid-year.html` — Migrating Mid-Year: Picking the Right Moment
2. `migrating-two-spreadsheets-into-one.html` — Migrating Two Spreadsheets into One System
3. `mapping-custom-columns-to-app-fields.html` — Mapping Custom Spreadsheet Columns to App Fields
4. `cleaning-sku-conflicts-during-migration.html` — Cleaning SKU Conflicts During Migration
5. `24-hour-migration-sprint-plan.html` — The 24-Hour Migration Sprint Plan

#### spreadsheet-template (5)

1. `reseller-spreadsheet-templates-roundup.html` — Reseller Spreadsheet Templates: A Compared Roundup
2. `pivot-tables-reseller-sales-reports.html` — Pivot Tables for Reseller Sales Reports
3. `conditional-formatting-recipes-inventory.html` — Conditional Formatting Recipes for Inventory
4. `spreadsheet-macros-automate-boring.html` — Reseller Spreadsheet Macros: Automate the Boring
5. `versioning-your-spreadsheet.html` — Versioning Your Spreadsheet Without Losing Data

#### inventr-app (30)

1. `setting-up-multiple-locations-inventr.html` — How to Set Up Multiple Locations in Inventr
2. `bulk-editing-inventory-inventr.html` — Bulk Editing Inventory in Inventr
3. `inventr-listing-workflow.html` — The Inventr Listing Workflow Explained
4. `tracking-booth-sales-60-seconds-inventr.html` — Tracking Booth Sales in Inventr in 60 Seconds
5. `importing-ebay-sales-history-inventr.html` — Importing eBay Sales History into Inventr
6. `importing-mercari-orders-inventr.html` — Importing Mercari Orders into Inventr
7. `inventr-profit-auto-calculation.html` — Inventr's Profit Auto-Calculation: How It Works
8. `inventr-reports-tax-season.html` — Inventr Reports for Tax Season
9. `sharing-inventr-access-va-spouse.html` — Sharing Inventr Access with a VA or Spouse
10. `inventr-tags-power-user.html` — Inventr Tags: Power-User Strategies
11. `inventr-custom-fields-when-needed.html` — Inventr Custom Fields: When You Need Them
12. `inventr-photos-reusing-listings.html` — Inventr Photos: Reusing Across Listings
13. `inventr-sell-through-reports-walkthrough.html` — Inventr Sell-Through Reports Walkthrough
14. `inventr-mobile-vs-desktop.html` — Inventr Mobile vs Desktop: Which When
15. `inventr-sourcing-budget-tracker.html` — Inventr Sourcing Budget Tracker
16. `inventr-mileage-tracker-schedule-c.html` — Inventr Mileage Tracker for Schedule C
17. `inventr-end-of-day-booth-reconciliation.html` — Inventr's End-of-Day Booth Reconciliation
18. `inventr-holiday-mode-surge-tracking.html` — Inventr Holiday Mode: Surge Inventory Tracking
19. `2-minute-listing-routine-inventr.html` — Building a 2-Minute Listing Routine in Inventr
20. `inventr-data-exports-csv-excel-pdf.html` — Inventr Data Exports: CSV, Excel, PDF
21. `inventr-backup-and-restore.html` — Inventr Backup and Restore
22. `inventr-inventory-aging-report.html` — Inventr Inventory Aging Report
23. `inventr-markdown-workflow.html` — Inventr Markdown Workflow
24. `inventr-for-antique-mall-booth-owners.html` — Inventr for Antique Mall Booth Owners
25. `inventr-for-estate-sale-operators.html` — Inventr for Estate Sale Operators
26. `inventr-for-online-only-resellers.html` — Inventr for Online-Only Resellers
27. `inventr-for-whatnot-live-sellers.html` — Inventr for Whatnot Live Sellers
28. `inventr-for-hybrid-sellers.html` — Inventr for Hybrid Sellers (Booth + Online)
29. `inventr-year-end-closing-checklist.html` — Inventr Year-End Closing Checklist
30. `inventr-roadmap-power-user-tips.html` — Inventr Roadmap and Power-User Tips

### 3.2 New: Online platforms (195 titles)

#### ebay/ (45)

1. `ebay-store-vs-no-store-roi.html` — eBay Store vs No Store: When the Subscription Actually Pays *(BATCH 1)*
2. `ebay-promoted-listings-profitability.html` — eBay Promoted Listings: A Profitability Threshold
3. `ebay-best-offer-counter-templates.html` — eBay Best Offer Strategy: Counter-Offer Templates
4. `ebay-gtc-vs-30-day.html` — eBay GTC vs 30-Day: Which Listing Format Sells Faster?
5. `ebay-international-gsp-vs-native.html` — eBay International Shipping: GSP vs Native, Compared
6. `ebay-first-30-days-roadmap.html` — eBay Reseller's First-30-Days Roadmap
7. `ebay-returns-cost-mitigation.html` — eBay Returns: Cost Mitigation Strategies
8. `ebay-defect-rate-explained.html` — eBay's Defect Rate Explained (and How to Stay Safe)
9. `ebay-top-rated-plus-worth-it.html` — eBay Top Rated Plus: Worth Chasing?
10. `ebay-item-specifics-2026-rules.html` — eBay Item Specifics: The 2026 Rules
11. `ebay-multi-buy-discounts.html` — eBay Multi-Buy Discounts: Smart or Margin Killer?
12. `ebay-listing-title-optimization.html` — eBay Listing Title Optimization for Search
13. `ebay-description-templates-that-convert.html` — eBay Description Templates That Convert
14. `ebay-cross-promotion-strategy.html` — eBay Cross-Promotion Strategy
15. `ebay-coupons-and-sales-events.html` — eBay Coupons and Sales Events: Worth Running?
16. `ebay-off-site-ads-returns.html` — eBay Off-Site Ads: Real Returns Analysis
17. `ebay-vacation-mode-the-right-way.html` — eBay Vacation Mode the Right Way
18. `ebay-markdown-manager-strategy.html` — eBay Markdown Manager: Strategy Guide
19. `ebay-buyer-block-lists.html` — eBay Buyer Block Lists: When to Use Them
20. `ebay-vintage-clothing-2026-best-practices.html` — Selling Vintage Clothing on eBay: 2026 Best Practices
21. `ebay-collectibles-authenticity-programs.html` — Selling Collectibles on eBay: Authenticity Programs
22. `ebay-seller-hub-weekly-reports.html` — eBay Seller Hub Reports You Should Run Weekly
23. `ebay-authentication-sneakers-watches.html` — eBay Authentication for Sneakers and Watches
24. `sourcing-for-ebay-vs-booth.html` — Sourcing for eBay vs Sourcing for Booth: Different Calculus
25. `ebay-sell-through-research-tools.html` — eBay Sell-Through Rate Research Tools
26. `ebay-negative-feedback-recovery.html` — eBay Negative Feedback: Recovery Playbook
27. `ebay-buyer-disputes-vs-returns.html` — eBay Buyer Disputes vs Returns: Know the Difference
28. `ebay-calculated-vs-free-shipping.html` — eBay Calculated vs Free Shipping: ROI Comparison
29. `ebay-bulk-listing-workflows.html` — eBay Bulk Listing Workflows
30. `ebay-listing-schedule-best-times.html` — eBay Listing Schedule: Best Days/Times to Go Live
31. `ebay-first-class-vs-ground-advantage.html` — eBay First-Class vs Ground Advantage in 2026
32. `ebay-auction-vs-fixed-price.html` — eBay Auction vs Fixed Price for Used Goods
33. `ebay-item-reserves.html` — eBay Item Reserves: Use Them or Skip?
34. `ebay-listing-insurance.html` — eBay Listing Insurance: When It Actually Pays
35. `ebay-promoted-listings-standard-vs-advanced.html` — eBay's Promoted Listings Standard vs Advanced
36. `ebay-cross-border-sales-tax-customs.html` — eBay Cross-Border Sales: Tax and Customs Notes
37. `ebay-listing-postmortems.html` — eBay Listings That Failed (and Why): A Postmortem Series
38. `ebay-top-sellers-niche-snapshot-2026.html` — eBay Top Sellers Across Niches: 2026 Snapshot
39. `ebay-photo-standards-ai-filters.html` — eBay Photo Standards (And the New AI Filters)
40. `ebay-listing-drafts-power-user.html` — eBay Listing Drafts: A Power-User Workflow
41. `ebay-combining-shipping-repeat-buyers.html` — eBay Combining Shipping: How to Earn Repeat Buyers
42. `ebay-inventory-hygiene-dead-stock.html` — eBay Inventory Hygiene: Dead-Stock Sweep Routine
43. `ebay-below-cost-liquidation.html` — eBay Below-Cost Liquidation Tactics (When You Should)
44. `ebay-authenticity-vintage-toys.html` — eBay Authenticity for Vintage Toys
45. `ebay-vs-local-furniture-flippers.html` — eBay vs Local Selling for Furniture: A Reseller's Choice

#### etsy/ (30)

1. `etsy-vintage-20-year-rule-explained.html` — Etsy's 20-Year Vintage Rule: What You Can (and Can't) List *(BATCH 1)*
2. `etsy-reseller-eligibility-vintage-craft.html` — Etsy Reseller Eligibility: Vintage and Craft Supplies
3. `etsy-seo-title-tag-playbook-2026.html` — Etsy SEO 2026: Title and Tag Playbook
4. `etsy-stats-page-what-to-watch.html` — Etsy Stats Page: What to Watch and What to Ignore
5. `etsy-ads-roi.html` — Etsy Ads ROI: When to Run Them, When to Pause
6. `etsy-star-seller-real-cost.html` — Etsy Star Seller: The Real Cost of Chasing It
7. `etsy-gift-mode-resellers.html` — Etsy Gift Mode: How Resellers Can Use It
8. `etsy-listing-photos-style-trends.html` — Etsy Listing Photos: Style Trends That Sell
9. `etsy-vs-ebay-for-vintage.html` — Etsy vs eBay for Vintage: A Side-by-Side
10. `etsy-storefront-branding.html` — Etsy Reseller Storefront Branding 101
11. `etsy-variations-personalization-vintage.html` — Etsy Variations and Personalization for Vintage
12. `etsy-categories-resellers-avoid.html` — Etsy Categories Resellers Should Avoid
13. `etsy-renewals-auto-vs-manual.html` — Etsy Renewals: Auto-Renew vs Manual Strategy
14. `etsy-international-shipping.html` — Etsy International Shipping for Resellers
15. `etsy-sales-events-resellers.html` — Etsy Sales Events: Should You Run Them?
16. `etsy-pattern-sites.html` — Etsy Pattern Sites: Worth It for Resellers?
17. `etsy-repeat-buyers.html` — Etsy Repeat Buyers: How to Build Them
18. `etsy-bad-review-recovery.html` — Etsy Reviews: Recovery from a Bad One
19. `etsy-sections-featured-items.html` — Etsy Sections and Featured Items Strategy
20. `etsy-vintage-authenticity-trust.html` — Etsy Vintage Authenticity: Building Buyer Trust
21. `etsy-seller-mistakes-tank-rank.html` — Etsy Seller Mistakes That Tank Your Rank
22. `etsy-price-anchoring-vintage.html` — Etsy Price Anchoring for Vintage Goods
23. `etsy-listings-that-sit.html` — Etsy Listings That Sit (And How to Refresh)
24. `etsy-coupons-without-eroding-margin.html` — Etsy Coupons That Don't Erode Margin
25. `etsy-tax-documents-1099k.html` — Etsy Tax Documents and 1099-K
26. `etsy-marketplace-facilitator-rules.html` — Etsy and the Sales Tax Marketplace Facilitator Rules
27. `etsy-returns-and-cases.html` — Etsy Returns and Cases: A Reseller's Guide
28. `etsy-bulk-editor-vintage-resellers.html` — Etsy Bulk Editor for Vintage Resellers
29. `etsy-newsletter-marketing.html` — Etsy Newsletter and Marketing Tools
30. `etsy-rebrand-when-and-how.html` — Etsy Rebrand: When and How to Do It

#### poshmark/ (25)

1. `poshmark-sharing-strategy-hours-vs-sales.html` — Poshmark Sharing: How Many Hours Actually Move the Needle? *(BATCH 1)*
2. `poshmark-closet-audit-dead-items.html` — Poshmark Closet Audit: Cleaning the Dead Items
3. `poshmark-bundles-math.html` — Poshmark Bundles: The Math Behind the Discount
4. `poshmark-parties-still-worth-it.html` — Poshmark Parties: Are They Still Worth Showing Up For?
5. `poshmark-first-week-plan.html` — Poshmark Reseller's First-Week Plan
6. `poshmark-offer-to-likers.html` — Poshmark Offer to Likers: Conversion Rates Studied
7. `poshmark-vs-mercari-clothes.html` — Poshmark vs Mercari: Which to List First (For Clothes)
8. `poshmark-closet-themes-that-sell.html` — Poshmark Closet Themes That Sell
9. `poshmark-authentication-required.html` — Poshmark Authentication: What's Required
10. `poshmark-vintage-rules.html` — Poshmark Reseller and Vintage: The Rules
11. `poshmark-tags-seo-inside-app.html` — Poshmark Tags: SEO Inside the App
12. `poshmark-posh-stories-worth-it.html` — Poshmark Posh Stories: Worth the Time?
13. `poshmark-returns-caps-cases.html` — Poshmark Returns: Caps, Cases, and Reality
14. `poshmark-posh-show-live-selling.html` — Poshmark Posh Show / Live Selling: Beginner Playbook
15. `poshmark-kids-sub-closet.html` — Poshmark Kids: A Sub-Closet Strategy
16. `poshmark-mens-underserved-niche.html` — Poshmark Men's: Underserved Niche Wins
17. `poshmark-reseller-earnings-tracking.html` — Poshmark Reseller Earnings Tracking
18. `poshmark-sales-tax-primer.html` — Poshmark and Sales Tax: A Quick Primer
19. `poshmark-closet-seo-title-description-photo.html` — Poshmark Closet SEO: Title, Description, Photo
20. `poshmark-promoted-closet-roi.html` — Poshmark Promoted Closet: ROI Test
21. `poshmark-cross-listing-tools.html` — Poshmark Cross-Listing Tools Compared
22. `poshmark-cleanout-campaigns.html` — Poshmark Closet Cleanout Campaigns
23. `poshmark-drops-re-engaging-followers.html` — Poshmark Drops: Re-Engaging Followers
24. `poshmark-holiday-strategy.html` — Poshmark Holiday Strategy: Black Friday to NYE
25. `poshmark-closet-move-out-migrating.html` — Poshmark Closet Move-Out: Migrating to eBay/Mercari

#### mercari/ (20)

1. `mercari-vs-poshmark-where-to-list-first.html` — Mercari vs Poshmark: Where Should You List First? *(BATCH 1)*
2. `mercari-local-pickup-vs-ship.html` — Mercari Local Pickup vs Ship: The New Math
3. `mercari-smart-pricing.html` — Mercari Smart Pricing: Should You Trust It?
4. `mercari-promote-feature.html` — Mercari Promote Feature: When It Pays
5. `mercari-bundle-discounts.html` — Mercari Bundle Discounts: Setup and Strategy
6. `mercari-listing-photos-first-picture.html` — Mercari Listing Photos: First-Picture Hacks
7. `mercari-returns-disputes.html` — Mercari Returns and Disputes: A Survival Guide
8. `mercari-electronics-reseller.html` — Mercari for Electronics: A Reseller's Take
9. `mercari-vintage-worth-listing.html` — Mercari for Vintage: Is It Worth Listing There?
10. `mercari-toys-collectibles.html` — Mercari for Toys and Collectibles
11. `mercari-listing-title-templates.html` — Mercari Listing Title Templates
12. `mercari-categories-where-found.html` — Mercari Categories: Where Items Actually Get Found
13. `mercari-local-shipping-labels.html` — Mercari Local Shipping Labels: Pro Tips
14. `mercari-tax-1099-notes.html` — Mercari Reseller Tax and 1099 Notes
15. `mercari-sale-events.html` — Mercari Sale Events: Worth Joining?
16. `mercari-crosslisting-tools-2026.html` — Mercari Crosslisting Tools: A 2026 Overview
17. `mercari-smart-offers.html` — Mercari Smart Offers: Decline or Accept?
18. `mercari-selling-velocity-benchmarks.html` — Mercari Selling Velocity: Benchmarks
19. `mercari-reseller-hours-time-audit.html` — Mercari Reseller Hours: A Time-Audit Study
20. `mercari-migration-when-to-move.html` — Mercari Migration: When to Move Inventory Off

#### whatnot/ (15)

1. `whatnot-live-selling-real-economics.html` — Whatnot Live Selling: The Real Economics Behind a Show *(BATCH 1)*
2. `whatnot-show-format-auction-vs-fixed.html` — Whatnot Show Format: Auction vs Fixed Price
3. `whatnot-production-budget-setups.html` — Whatnot Production: Budget Setups That Convert
4. `whatnot-categories-that-sell-2026.html` — Whatnot Categories That Sell Best in 2026
5. `whatnot-hosting-cadence.html` — Whatnot Hosting Cadence: How Often to Go Live
6. `whatnot-pre-show-prep.html` — Whatnot Inventory Pre-Show Prep
7. `whatnot-vs-ebay-live.html` — Whatnot vs eBay Live: A Reseller's Choice
8. `whatnot-hot-seat-strategies.html` — Whatnot Hot-Seat Strategies: Building Buyer Loyalty
9. `whatnot-shipping-workflow-after-show.html` — Whatnot Shipping Workflow After a Show
10. `whatnot-returns-disputes.html` — Whatnot Returns and Disputes
11. `whatnot-tags-categories-listing-hygiene.html` — Whatnot Tags, Categories, and Listing Hygiene
12. `whatnot-sponsorships-co-hosting.html` — Whatnot Sponsorships and Co-Hosting
13. `whatnot-show-recaps-marketing-reuse.html` — Whatnot Show Recaps for Marketing Reuse
14. `whatnot-margins-fees-boost-real-take.html` — Whatnot Margins: Fees, Boost, and the Real Take
15. `whatnot-50-shows-lessons.html` — Whatnot Lessons from a Reseller's First 50 Shows

#### facebook-marketplace/ (15)

1. `fb-marketplace-furniture-flip-margins.html` — Facebook Marketplace Furniture Flips: The Margin Reality *(BATCH 1)*
2. `fb-marketplace-listing-optimization.html` — FB Marketplace Listing Optimization for the Algorithm
3. `fb-marketplace-shipping-when-it-works.html` — FB Marketplace Shipping: When It Works, When It Doesn't
4. `fb-marketplace-local-pickup-safety.html` — FB Marketplace and Local Pickup: Safety Playbook
5. `fb-marketplace-account-hygiene.html` — FB Marketplace Reseller Account Hygiene
6. `fb-marketplace-insights-stats.html` — FB Marketplace Insights: What the Stats Mean
7. `fb-marketplace-listing-refresh.html` — FB Marketplace Dance: Listing Refresh Strategies
8. `fb-marketplace-boosted-posts.html` — FB Marketplace Boosted Posts: ROI Worth It?
9. `fb-marketplace-estate-sale-operators.html` — FB Marketplace for Estate Sale Operators
10. `fb-marketplace-vintage-pros-cons.html` — FB Marketplace for Vintage Goods: Pros and Cons
11. `fb-marketplace-vs-other-local-apps.html` — FB Marketplace and Other Local Apps Compared
12. `fb-marketplace-group-strategy.html` — FB Marketplace Group Strategy: Local Reseller Networks
13. `fb-marketplace-cross-posting.html` — FB Marketplace Cross-Posting: Safe vs Risky
14. `fb-marketplace-returns-refunds.html` — FB Marketplace Returns and Refunds (Yes, They Happen)
15. `fb-marketplace-tax-1099k.html` — FB Marketplace and Tax: 1099-K and Beyond

#### depop/ (10)

1. `depop-seo-tags-titles-photos.html` — Depop SEO: Tags, Titles, and Photos for the Gen Z Algo
2. `depop-vs-poshmark-y2k-streetwear.html` — Depop vs Poshmark for Y2K and Streetwear
3. `depop-reseller-branding.html` — Depop Reseller Branding: Why It Matters More
4. `depop-shipping-workflow.html` — Depop Shipping Workflow for the Casual Reseller
5. `depop-pricing-too-high.html` — Depop Pricing: How High Is Too High?
6. `depop-refresh-bumping-old-listings.html` — Depop Refresh: Bumping Old Listings
7. `depop-bundles-discounting.html` — Depop Bundles: Are They Worth Discounting?
8. `depop-streams-live-selling.html` — Depop Streams Live Selling Notes
9. `depop-reseller-sales-tax.html` — Depop Reseller and Sales Tax
10. `depop-cleanouts-and-migrations.html` — Depop Closet Cleanouts and Migrations

#### amazon-resellers/ (20)

1. `amazon-fba-vs-fbm-resellers.html` — Amazon FBA vs FBM for Resellers
2. `amazon-used-like-new-standards.html` — Amazon Used-Like-New Standards: A Practical Guide
3. `amazon-seller-central-daily-routines.html` — Amazon Seller Central: Daily Routines for Resellers
4. `amazon-variation-listings-used.html` — Amazon Variation Listings for Used Items
5. `amazon-reseller-tax-marketplace-rules.html` — Amazon Reseller Tax and Sales Tax Marketplace Rules
6. `amazon-buy-box-used-items.html` — Amazon Buy Box for Used Items: Is It Even Possible?
7. `amazon-storage-fees-when-to-pull.html` — Amazon Storage Fees: When to Pull Inventory
8. `amazon-returns-reseller-risk.html` — Amazon Returns: The Reseller's Risk
9. `amazon-liquidation-sourcing.html` — Amazon Liquidation: A Sourcing Channel
10. `amazon-account-health-metrics.html` — Amazon Reseller Account Health Metrics
11. `amazon-reserves-cash-flow.html` — Amazon Reserves: Cash Flow Implications
12. `amazon-replenishment-routines.html` — Amazon Replenishment Routines for Resellers
13. `amazon-customer-service-when-to-reply.html` — Amazon Customer Service: When to Reply, When to Escalate
14. `amazon-repricing-tools-roundup.html` — Amazon Repricing Tools: A Compared Roundup
15. `amazon-listing-suppressions.html` — Amazon Listing Suppressions: Diagnosis and Fixes
16. `amazon-brand-restrictions-2026.html` — Amazon Brand Restrictions for Resellers in 2026
17. `amazon-multichannel-fulfillment.html` — Amazon Multichannel Fulfillment for Cross-Listers
18. `amazon-ipi-score-tactical-levers.html` — Amazon Reseller IPI Score: Tactical Levers
19. `amazon-bookselling-walkthrough.html` — Amazon Bookselling Sub-Niche Walkthrough
20. `amazon-antique-vintage-resellers.html` — Amazon for Antique and Vintage Resellers

#### offerup-craigslist/ (15)

1. `offerup-vs-craigslist-furniture-flippers.html` — OfferUp vs Craigslist for Furniture Flippers
2. `offerup-listing-photos-clicks.html` — OfferUp Listing Photos That Actually Get Clicks
3. `offerup-shipping-vs-local-pickup.html` — OfferUp Shipping vs Local Pickup
4. `offerup-account-hygiene.html` — OfferUp Reseller Account Hygiene
5. `offerup-title-description-templates.html` — OfferUp Title and Description Templates
6. `craigslist-furniture-templates.html` — Craigslist Furniture Listings: Templates That Convert
7. `craigslist-meet-up-safety.html` — Craigslist Safety: Meet-Up Best Practices
8. `local-drop-off-pickup-logistics.html` — OfferUp/CL Drop-Off and Pickup Logistics
9. `offerup-boosts-worth-spend.html` — OfferUp Boosts: Worth the Spend?
10. `local-cross-list-workflow.html` — Combining OfferUp + FB Marketplace + CL: Cross-List Workflow
11. `craigslist-free-section-sourcing.html` — Craigslist Free Section: Sourcing Gold
12. `offerup-tools-equipment.html` — OfferUp for Tools and Equipment
13. `offerup-electronics-risks-rewards.html` — OfferUp for Electronics: Risks and Rewards
14. `offerup-negotiation-scripts.html` — OfferUp Negotiation Scripts
15. `offerup-migration-to-inventr.html` — OfferUp Migration to Inventr-Tracked Inventory

### 3.3 New: Niches & categories (130 titles)

#### niches-vintage-clothing/ (20)

1. `identifying-valuable-vintage-band-tees.html` — How to Identify a Valuable Vintage Band Tee in 30 Seconds *(BATCH 1)*
2. `single-stitch-tees-pricing.html` — Single-Stitch Tees: Why They're Pricey
3. `vintage-levis-tag-decoder.html` — Vintage Levi's Tag Decoder
4. `vintage-patagonia-outdoor-brands.html` — Vintage Patagonia and Outdoor Brands
5. `y2k-clothing-trends-2026.html` — Y2K Clothing Trends Worth Buying in 2026
6. `vintage-dresses-pre-1980-id.html` — Vintage Dresses: Pre-1980 Identification
7. `tagging-eras-of-vintage-clothing.html` — Tagging Eras of Vintage Clothing for Listings
8. `vintage-brands-that-hold-value.html` — Vintage Brands That Hold Their Value
9. `vintage-workwear-carhartt-dickies-filson.html` — Vintage Workwear: Carhartt, Dickies, Filson
10. `vintage-athleisure-80s-90s.html` — Vintage Athleisure: 80s-90s Sportswear Trends
11. `vintage-wool-coats-sweaters.html` — Vintage Wool: Coats and Sweaters Worth Sourcing
12. `vintage-leather-jackets-bombers.html` — Vintage Leather Jackets and Bombers
13. `vintage-denim-wash-hem-selvedge.html` — Vintage Denim: Wash, Hem, Selvedge
14. `vintage-accessories-belts-hats-scarves.html` — Vintage Accessories: Belts, Hats, Scarves
15. `vintage-sizing-across-eras.html` — Vintage Sizing Across Eras
16. `vintage-clothing-photography-tips.html` — Vintage Clothing Photography Tips
17. `vintage-clothing-pricing-by-decade.html` — Vintage Clothing Pricing by Decade
18. `building-a-vintage-clothing-booth.html` — Building a Vintage Clothing Booth Section
19. `pop-culture-tee-pricing.html` — Pop Culture Tee Pricing: Bands, Movies, Sports
20. `vintage-clothing-returns-reduction.html` — Vintage Clothing Returns: How to Reduce Them

#### niches-books/ (15)

1. `book-scanning-apps-which-actually-pay.html` — Scanning Books for Resale: Which Apps Actually Pay Off? *(BATCH 1)*
2. `bookselling-ebay-vs-amazon-vs-etsy.html` — Bookselling on eBay vs Amazon vs Etsy
3. `vintage-childrens-books-what-sells.html` — Vintage Children's Books: What Sells
4. `cookbook-resale-sleeper-niche.html` — Cookbook Resale: A Sleeper Niche
5. `religious-self-help-books-margin.html` — Religious and Self-Help Books: Margin Reality
6. `textbook-reselling-cycles.html` — Textbook Reselling Cycles: Timing Buys
7. `first-editions-id-pricing.html` — First Editions: Identifying and Pricing
8. `signed-copies-authentication.html` — Signed Copies: Authentication and Pricing
9. `comic-book-reselling-101.html` — Comic Book Reselling 101 for Beginners
10. `bookplate-inscription-provenance.html` — Bookplate, Inscription, and Provenance Value
11. `bookbinding-conditions-lingo.html` — Bookbinding Conditions: Learn the Lingo
12. `pulp-magazines-vintage-periodicals.html` — Pulp Magazines and Vintage Periodicals
13. `bookselling-workflow-with-inventr.html` — Bookselling Workflow with Inventr
14. `library-sale-sourcing-tactics.html` — Library Sale Sourcing Tactics
15. `bookselling-sales-tax-1099k.html` — Bookselling Sales Tax and 1099-K

#### niches-electronics/ (15)

1. `vintage-electronics-pre-2000-sleepers.html` — Vintage Electronics: Pre-2000 Sleepers
2. `cameras-film-and-digital.html` — Reseller's Guide to Cameras (Film and Digital)
3. `vintage-audio-receivers-speakers-turntables.html` — Vintage Audio: Receivers, Speakers, Turntables
4. `reselling-used-phones-risk-reward.html` — Reselling Used Phones: Risk and Reward
5. `used-laptop-reselling-pricing-tiers.html` — Used Laptop Reselling: Pricing Tiers
6. `gaming-consoles-by-era.html` — Gaming Consoles by Era: Resale Hot List
7. `cables-adapters-spares-niche.html` — Cables, Adapters, and Spares: A Steady Niche
8. `working-vs-untested-vs-parts.html` — Working vs Untested vs Parts Listings
9. `electronics-photography-listings.html` — Electronics Photography for Listings
10. `diagnosing-disclosing-defects.html` — Diagnosing and Disclosing Defects
11. `electronics-shipping-insurance-packaging.html` — Electronics Shipping Insurance and Packaging
12. `electronics-returns-reduction.html` — Electronics Returns Reduction Tactics
13. `calculator-niche-office-equipment.html` — Calculator and Niche Office Equipment Reselling
14. `synthesizers-music-gear-niche.html` — Synthesizers and Music Gear: A Niche Within a Niche
15. `electronics-sourcing-routes.html` — Electronics Sourcing Routes (Estate, Auction, Online)

#### niches-toys-collectibles/ (20)

1. `funko-pop-flipping-still-worth-it.html` — Funko Pop Flipping: Is It Still Worth It in 2026? *(BATCH 1)*
2. `lego-reselling-sets-minifigs-bulk.html` — LEGO Reselling: Sets, Minifigs, and Bulk
3. `vintage-action-figures.html` — Vintage Action Figures: Brands That Move
4. `sports-cards-2026-margin-reality.html` — Sports Cards in 2026: A Margin Reality
5. `pokemon-cards-sourcing-authentication.html` — Pokémon Cards: Sourcing and Authentication
6. `vintage-barbie-and-dolls.html` — Vintage Barbie and Dolls
7. `star-wars-collectibles-eras-lines.html` — Star Wars Collectibles: Eras and Lines
8. `vintage-hot-wheels-matchbox.html` — Vintage Hot Wheels and Matchbox
9. `tcg-resale-mtg-yugioh.html` — Trading Card Game Resale: MTG, Yu-Gi-Oh!
10. `plush-and-beanie-babies.html` — Plush and Beanie Babies: Still a Thing?
11. `comic-era-memorabilia.html` — Comic-Era Memorabilia
12. `mcdonalds-toys-fast-food.html` — McDonald's Toys and Fast Food Premiums
13. `vintage-board-games.html` — Vintage Board Games: Sourcing and Pricing
14. `building-toys-collectibles-booth.html` — Building a Toys & Collectibles Booth Section
15. `authentication-tools-subscriptions.html` — Authentication Tools and Subscriptions
16. `pricing-sealed-vs-loose-vintage-toys.html` — Pricing Sealed vs Loose Vintage Toys
17. `toys-collectibles-photography-standards.html` — Toys & Collectibles Photography Standards
18. `reselling-at-toy-shows-card-shows.html` — Reselling at Toy Shows and Card Shows
19. `online-toy-forums-discord-sourcing.html` — Online Toy Forums and Discord Communities for Sourcing
20. `toy-reseller-tax-1099.html` — Toy Reseller Sales Tax and 1099 Considerations

#### niches-furniture/ (15)

1. `mid-century-modern-identification.html` — Mid-Century Modern: Identification and Pricing
2. `vintage-furniture-brands-hold-value.html` — Vintage Furniture Brands That Hold Value
3. `furniture-refinishing-roi.html` — Furniture Refinishing: ROI Reality
4. `furniture-photography-online.html` — Furniture Photography for Online Listings
5. `furniture-shipping-logistics.html` — Furniture Shipping Logistics for Resellers
6. `furniture-returns-special-case.html` — Furniture Returns: A Special Case
7. `vintage-lighting-lamps-fixtures.html` — Vintage Lighting: Lamps and Fixtures
8. `vintage-office-furniture.html` — Vintage Office Furniture
9. `outdoor-patio-furniture.html` — Outdoor and Patio Furniture Reselling
10. `local-only-furniture-workflow.html` — Local-Only Furniture Reselling Workflow
11. `furniture-pricing-by-style-era.html` — Furniture Pricing by Style Era
12. `furniture-booth-sections.html` — Furniture Booth Sections That Convert
13. `sourcing-furniture-estate-sales.html` — Sourcing Furniture from Estate Sales
14. `furniture-restoration-diy-vs-outsource.html` — Furniture Restoration: When to DIY vs Outsource
15. `furniture-insurance-liability.html` — Furniture Reselling Insurance and Liability

#### niches-glassware-pottery/ (10)

1. `vintage-pyrex-pricing-decoder.html` — Vintage Pyrex: A Pricing Decoder
2. `mccoy-hull-american-pottery.html` — McCoy, Hull, and American Pottery Brands
3. `vintage-cookie-jars.html` — Vintage Cookie Jars
4. `vintage-glassware-depression-elegant-carnival.html` — Vintage Glassware: Depression vs Elegant vs Carnival
5. `pottery-marks-identification.html` — Identifying Pottery Marks
6. `vintage-crocks-stoneware.html` — Reselling Vintage Crocks and Stoneware
7. `vintage-pyrex-patterns-sourcing.html` — Vintage Pyrex Patterns Worth Sourcing
8. `glass-reseller-packaging-shipping.html` — Glass Reseller Packaging and Shipping
9. `pottery-reseller-booth-display.html` — Pottery Reseller's Booth Display
10. `glassware-pricing-local-vs-online.html` — Glassware Pricing in Local vs Online Markets

#### niches-vinyl/ (10)

1. `vinyl-resale-genres-eras-that-sell.html` — Vinyl Resale: Genres and Eras That Sell
2. `identifying-first-pressings.html` — Identifying First Pressings
3. `vinyl-grading-101-letter-codes.html` — Vinyl Grading 101: Letter Codes Explained
4. `vinyl-cleaning-resellers.html` — Vinyl Cleaning for Resellers
5. `sourcing-vinyl-thrift-estate.html` — Sourcing Vinyl at Thrift and Estate Sales
6. `vinyl-discogs-vs-ebay-vs-local.html` — Selling Vinyl on Discogs vs eBay vs Local
7. `vinyl-shipping-mailers-packaging.html` — Vinyl Shipping: Mailers and Packaging
8. `building-a-record-booth-section.html` — Building a Record Booth Section
9. `vinyl-pricing-tools-discogs-popsike.html` — Vinyl Pricing Tools (Discogs, Popsike)
10. `vinyl-reseller-pricing-mistakes.html` — Vinyl Reseller Pricing Mistakes

#### niches-tools/ (10)

1. `vintage-hand-tools-brands-that-hold-value.html` — Vintage Hand Tools: Brands That Hold Value
2. `power-tool-reselling-diagnosing.html` — Power Tool Reselling: Diagnosing Function
3. `snapon-mac-matco-pro-brands.html` — Snap-On, Mac, Matco: Pro Brands and Resale
4. `tools-at-estate-sales.html` — Tools at Estate Sales: A Sourcing Route
5. `tool-reselling-fb-offerup.html` — Tool Reselling on FB Marketplace and OfferUp
6. `vintage-wrenches-sockets.html` — Vintage Wrenches and Sockets
7. `vintage-wood-planes-hand-saws.html` — Vintage Wood Planes and Hand Saws
8. `reselling-construction-tools.html` — Reselling Construction Tools and Equipment
9. `tool-reseller-pricing-margin.html` — Tool Reseller Pricing and Margin
10. `tool-reseller-booth-section.html` — Tool Reseller Booth Section

#### niches-handbags/ (5)

1. `authenticating-designer-handbags.html` — Authenticating Designer Handbags
2. `reselling-designer-shoes.html` — Reselling Designer Shoes: Risk and Margin
3. `reseller-vintage-coach.html` — The Reseller's Guide to Vintage Coach
4. `authenticating-vintage-designer-denim.html` — Authenticating Vintage Levi's and Designer Denim
5. `designer-resale-authentication-services.html` — Designer Resale and Authentication Services

#### niches-sports-memorabilia/ (10)

1. `reselling-sports-cards-2026.html` — Reselling Sports Cards in 2026
2. `vintage-game-worn-vs-replica.html` — Vintage Game-Worn vs Replica Identification
3. `autograph-authentication-services.html` — Autograph Authentication Services
4. `sports-memorabilia-coa-reality.html` — Sports Memorabilia Authentication: COA Reality
5. `sourcing-card-shows-conventions.html` — Sourcing at Card Shows and Conventions
6. `pricing-vintage-sports-equipment.html` — Pricing Vintage Sports Equipment
7. `vintage-bobbleheads-figurines.html` — Reselling Vintage Bobbleheads and Figurines
8. `boxed-sealed-sports-memorabilia.html` — Boxed and Sealed Sports Memorabilia
9. `reselling-tickets-stubs.html` — Reselling Tickets and Stubs (Legality + Margin)
10. `sports-memorabilia-booth-strategy.html` — Sports Memorabilia Booth Section Strategy

### 3.4 New: Operations & business (45 titles)

#### consignment-shop-ops/ (20)

1. `setting-consignor-splits-fairly.html` — Setting Consignor Splits Fairly: A Shop Owner's Guide *(BATCH 1)*
2. `onboarding-consignors-contracts.html` — Onboarding Consignors: Contracts and Communication
3. `consignor-payment-cycles.html` — Consignor Payment Cycles: Weekly, Monthly, On-Sale
4. `pricing-consigned-items-authority.html` — Pricing Consigned Items: Owner vs Consignor Authority
5. `tagging-labeling-consigned-items.html` — Tagging and Labeling Consigned Items
6. `returns-damage-policies-consignors.html` — Returns and Damage Policies for Consignors
7. `consignor-app-access-when.html` — Consignor App Access: When to Give It
8. `consignor-reports-statements.html` — Consignor Reports and Statements
9. `marketing-consignment-shop-locally.html` — Marketing Your Consignment Shop Locally
10. `consignment-shop-insurance.html` — Consignment Shop Insurance Essentials
11. `consignment-sales-tax-1099.html` — Consignment Sales Tax and 1099 Rules
12. `consignment-aging-policies.html` — Consignment Inventory Aging Policies
13. `high-volume-consignor-tiers.html` — Inviting High-Volume Consignors: Tier Structures
14. `banning-pausing-consignor.html` — Banning or Pausing a Consignor
15. `consignment-shop-layout-conversion.html` — Consignment Shop Layout for Conversion
16. `consignment-booth-hybrid.html` — Consignment Shop and Booth Hybrid Models
17. `selling-online-for-consignors.html` — Selling Online for Consignors: Yes or No?
18. `consignment-pos-systems.html` — Consignment POS Systems for Owners
19. `consignment-shrinkage-theft-controls.html` — Consignment Shop Shrinkage and Theft Controls
20. `consignment-year-end-closing.html` — Consignment Shop Year-End Closing Checklist

#### operations-fulfillment/ (10)

1. `reseller-fulfillment-pick-pack-ship.html` — Reseller Fulfillment Workflow: Pick, Pack, Ship
2. `shipping-software-compared.html` — Shipping Software Compared for Resellers
3. `packaging-materials-cost-per-order.html` — Packaging Materials: Cost-Per-Order Targets
4. `daily-reseller-shipping-routine.html` — Daily Reseller Shipping Routine
5. `returns-operations-sops.html` — Returns Operations: SOPs for Resellers
6. `cold-storage-inventory-strategy.html` — Cold-Storage Inventory Strategy
7. `reseller-office-setup.html` — Reseller Office Setup: Space, Tools, Tape
8. `hiring-a-packing-helper.html` — Hiring a Packing Helper: Worth It?
9. `insured-shipping-high-value.html` — Insured Shipping for High-Value Items
10. `holiday-fulfillment-surge-plan.html` — Reseller's Holiday Fulfillment Surge Plan

#### scaling-growth/ (10)

1. `side-hustle-to-full-time-roadmap.html` — From Side Hustle to Full Time: A Reseller's Roadmap
2. `when-to-hire-a-va.html` — When to Hire a VA for Reselling Tasks
3. `hiring-photographer-or-lister.html` — Hiring a Photographer or Lister
4. `scaling-one-booth-to-three.html` — Scaling from One Booth to Three
5. `adding-online-to-booth-only.html` — Adding Online to a Booth-Only Business
6. `adding-booth-to-online-only.html` — Adding Booth to an Online-Only Business
7. `building-a-reselling-brand.html` — Building a Reselling Brand: Local + Online
8. `growing-a-reseller-email-list.html` — Growing a Reseller Email List
9. `selling-your-reseller-business-valuation.html` — Selling Your Reseller Business: Valuation
10. `buying-out-another-reseller.html` — Buying Out Another Reseller's Inventory

#### mindset-burnout/ (5)

1. `reseller-burnout-diagnosing-signs.html` — Reseller Burnout: Diagnosing the Signs
2. `sustainable-reseller-workweek.html` — Designing a Sustainable Reseller Workweek
3. `realistic-reseller-income-goals.html` — Setting Realistic Reseller Income Goals
4. `avoiding-sourcing-compulsion.html` — Avoiding Sourcing Compulsion
5. `annual-reseller-reset.html` — The Annual Reseller Reset

---

## 4. Cluster grand total

| Family | Posts |
| --- | --- |
| Existing-cluster expansions | 130 |
| Online platforms | 195 |
| Niches & categories | 130 |
| Operations & business | 45 |
| **Total** | **500** |

Combined with the 110 existing posts, the blog grows to **610 posts across 34 clusters**.

---

## 5. Batch tracker

### Batch 1 — completed in this session (10 posts)

| # | File | Cluster | CTA |
| --- | --- | --- | --- |
| 1 | `blog/ebay/ebay-store-vs-no-store-roi.html` | ebay | Profit Calculator |
| 2 | `blog/etsy/etsy-vintage-20-year-rule-explained.html` | etsy | Inventr app |
| 3 | `blog/poshmark/poshmark-sharing-strategy-hours-vs-sales.html` | poshmark | Sell-Through Calculator |
| 4 | `blog/mercari/mercari-vs-poshmark-where-to-list-first.html` | mercari | Profit Calculator |
| 5 | `blog/whatnot/whatnot-live-selling-real-economics.html` | whatnot | Profit Calculator |
| 6 | `blog/facebook-marketplace/fb-marketplace-furniture-flip-margins.html` | facebook-marketplace | Inventr app |
| 7 | `blog/niches-vintage-clothing/identifying-valuable-vintage-band-tees.html` | niches-vintage-clothing | Inventr app |
| 8 | `blog/niches-books/book-scanning-apps-which-actually-pay.html` | niches-books | Sell-Through Calculator |
| 9 | `blog/niches-toys-collectibles/funko-pop-flipping-still-worth-it.html` | niches-toys-collectibles | Inventr app |
| 10 | `blog/consignment-shop-ops/setting-consignor-splits-fairly.html` | consignment-shop-ops | P&L Template |

### Batches 2+ — queued

All 490 remaining titles in §3 are queued. Recommended next batch (Batch 2) is the second post in each Batch 1 cluster, to start building cluster depth. After ~5 posts per new cluster, rotate to new clusters not yet started (`depop/`, `amazon-resellers/`, `offerup-craigslist/`, the remaining niche clusters, `operations-fulfillment/`, `scaling-growth/`, `mindset-burnout/`).

When marking a post as written, move it from §3 into a "completed" subsection of §5 with the file path and CTA used.

---

## 6. Follow-up tasks (not in scope of any batch)

- **Sitemap & robots.txt** — once total exceeds ~200 posts, generate `blog/sitemap.xml` and ensure it's in `robots.txt`.
- **Per-cluster index pages** — at >20 posts per cluster, [blog/index.html](blog/index.html) becomes too long. Spin out per-cluster `index.html` files.
- **Article schema** — add JSON-LD `Article` schema to every post (date, author, headline, image).
- **Internal-link audit script** — at >300 posts, run a link-audit script to catch broken links.
- **Author pages / About** — add a credible author bio if Inventr is publishing under a person.
- **Newsletter capture** — add a soft email-capture below the CTA banner on long posts.
- **Open Graph & Twitter cards** — every post should have OG tags for social sharing.

---

## 7. Editorial style notes

- Use named, hypothetical resellers in intros (Sarah, Marcus, Dana, Priya, Tom, Liz, etc.) rotating through the batch — never reuse the same name in two adjacent posts.
- Use real-feeling specific numbers: $4,275 not $4k; 14.3% not "around 15%"; 73 hours not "lots of hours".
- Always quantify the funnel claim: "Inventr's auto-aging report would have flagged this booth in 11 days" instead of "Inventr would help".
- Avoid em-dashes and en-dashes outside of code; use a regular hyphen with spaces around it for breath, e.g. " - ", or restructure the sentence.
- Avoid stock AI phrases: "In today's fast-paced world", "Let's dive in", "Game-changer", "Unlock", "Leverage" (as a verb).
- Always end the article body with a one-sentence pivot to the CTA banner that names the next concrete step.
