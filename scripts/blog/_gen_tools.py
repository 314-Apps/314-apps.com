#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / "funnel-tools/manifest.json").read_text())
O, C = "@@O@@", "@@C@@"
APP_STORE_URL = "https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683"


def shell(title, desc, slug, body, wide=False):
    w = " tool-panel--wide" if wide else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Inventr</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="https://consignment.314-apps.com/funnel-tools/{slug}/">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="stylesheet" href="../css/tools.css">
</head>
<body data-tool="{slug}">
  <header class="site-header">
    {O} class="container">
      <a href="/blog/" class="logo">Inventr <span>Blog</span></a>
      <nav class="nav-links">
        <a href="/blog/">All Posts</a>
        <a href="/funnel-tools/">Free Tools</a>
        <a class="btn btn--primary btn--sm" href="{APP_STORE_URL}?utm_source=funnel_tools&amp;utm_medium={slug}" target="_blank" rel="noopener">Try Inventr Free</a>
      </nav>
    {C}
  </header>
  <section class="hero hero--small">
    {O} class="container">
      <h1>{title}</h1>
      <p>{desc}</p>
    {C}
  </section>
  <main>
    {O} class="container">
      {O} class="tool-panel{w}">
{body}
      {C}
      <p style="text-align:center;margin-top:1rem;">
        <a class="btn btn--outline" href="/funnel-tools/">← All free tools</a>
      </p>
    {C}
  </main>
  <footer class="site-footer">{O} class="container"><p>&copy; 2026 Inventr</p>{C}</footer>
  <script src="../js/tools.js"></script>
</body>
</html>""".replace(O, "<div").replace(C, "</div>")


def checklist(list_id, items):
    lis = "\n".join(
        f'          <li><input type="checkbox" data-id="{list_id}-{i}" id="{list_id}-{i}">'
        f'<label for="{list_id}-{i}">{t}</label></li>'
        for i, t in enumerate(items)
    )
    return f"""        <ul class="checklist" id="{list_id}">
{lis}
        </ul>
        <div class="tool-actions"><button type="button" class="btn secondary" id="checklist-reset">Reset checklist</button></div>"""


bodies = {
    "profit-calculator": f"""        {O} class="tool-grid-2">
          {O} class="tool-field"><label for="sale">Sale price ($)</label><input type="number" id="sale" min="0" step="0.01" value="45">{C}
          {O} class="tool-field"><label for="cogs">Cost of goods ($)</label><input type="number" id="cogs" min="0" step="0.01" value="12">{C}
          {O} class="tool-field"><label for="feePct">Platform + payment fees (%)</label><input type="number" id="feePct" min="0" step="0.1" value="13">{C}
          {O} class="tool-field"><label for="shipOut">Shipping you pay ($)</label><input type="number" id="shipOut" min="0" step="0.01" value="5.50">{C}
          {O} class="tool-field"><label for="shipIn">Shipping charged to buyer ($)</label><input type="number" id="shipIn" min="0" step="0.01" value="0">{C}
        {C}
        {O} class="tool-results"><h3>Results</h3><dl>
            <dt>Platform fees</dt><dd id="fees">$0.00</dd>
            <dt>Net profit</dt><dd id="netProfit">$0.00</dd>
            <dt>Profit margin</dt><dd id="margin">0%</dd>
        </dl>{C}""",
    "break-even-calculator": f"""        {O} class="tool-field"><label for="fixed">Monthly fixed costs ($)</label><input type="number" id="fixed" min="0" step="1" value="350">{C}
        {O} class="tool-grid-2">
          {O} class="tool-field"><label for="profitPerSale">Average net profit per sale ($)</label><input type="number" id="profitPerSale" min="0" step="0.01" value="18">{C}
          {O} class="tool-field"><label for="avgSale">Average sale price ($)</label><input type="number" id="avgSale" min="0" step="0.01" value="42">{C}
        {C}
        {O} class="tool-results"><h3>Break-even</h3><dl>
            <dt>Sales needed per month</dt><dd id="unitsNeeded">—</dd>
            <dt>Gross revenue at break-even</dt><dd id="revenueNeeded">—</dd>
        </dl>{C}""",
    "sell-through-calculator": f"""        {O} class="tool-grid-2">
          {O} class="tool-field"><label for="startUnits">Starting active listings</label><input type="number" id="startUnits" min="0" step="1" value="200">{C}
          {O} class="tool-field"><label for="soldUnits">Units sold in period</label><input type="number" id="soldUnits" min="0" step="1" value="38">{C}
          {O} class="tool-field"><label for="days">Days in period</label><input type="number" id="days" min="1" step="1" value="30">{C}
        {C}
        {O} class="tool-results"><h3>Sell-through</h3><dl>
            <dt>Period sell-through rate</dt><dd id="stRate">0%</dd>
            <dt>Annualized (estimate)</dt><dd id="annualized">—</dd>
            <dt>Units still listed</dt><dd id="remaining">0</dd>
        </dl>{C}""",
    "pnl-template": """        <p>Monthly P&amp;L worksheet. Download CSV or copy the table.</p>
        <table class="pnl-table" id="pnl-table">
          <thead><tr><th>Category</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>Gross sales</td><td></td></tr>
            <tr><td>Cost of goods sold</td><td></td></tr>
            <tr><td>Platform fees</td><td></td></tr>
            <tr><td>Shipping paid</td><td></td></tr>
            <tr><td>Supplies &amp; packaging</td><td></td></tr>
            <tr><td>Booth rent</td><td></td></tr>
            <tr><td>Mileage (deductible)</td><td></td></tr>
            <tr><td>Other expenses</td><td></td></tr>
            <tr><td><strong>Net profit</strong></td><td></td></tr>
          </tbody>
        </table>
        <div class="tool-actions">
          <button type="button" class="btn btn--primary" id="pnl-download">Download CSV</button>
          <button type="button" class="btn btn--outline" id="pnl-copy">Copy table</button>
        </div>""",
    "spreadsheet-template": """        <p>Starter inventory columns for Sheets or Excel.</p>
        <table class="sheet-table">
          <thead><tr><th>SKU</th><th>Title</th><th>Cost</th><th>List Price</th><th>Channel</th><th>Status</th></tr></thead>
          <tbody><tr><td></td><td></td><td></td><td></td><td></td><td>Available</td></tr></tbody>
        </table>
        <motion class="tool-actions">
          <button type="button" class="btn btn--primary" id="sheet-download">Download CSV template</button>
        </div>""",
    "photo-checklist": checklist("photo-checklist", [
        "Hero shot on neutral background", "Full front view", "Brand / size / care tag close-up",
        "Any flaws or wear (with scale)", "Measurements for clothing", "Weight for shipping estimate",
    ]),
    "tax-checklist": checklist("tax-checklist", [
        "Export all platform sales reports", "Separate personal vs business purchases",
        "Mileage log for sourcing trips", "Home office deduction worksheet",
        "Inventory snapshot (year-end)", "1099-K / 1099-NEC forms received",
        "Schedule C expense categories mapped", "Quarterly estimated payments reviewed",
    ]),
    "sourcing-guide": checklist("sourcing-checklist", [
        "Research comps before leaving home", "Bring measuring tape & flashlight",
        "Set max spend per category", "Check sold comps on one item per rack",
        "Skip categories below target $/hour", "Photograph tags on high-value finds", "Track mileage from first stop",
    ]),
    "migration-guide": checklist("migration-checklist", [
        "Export spreadsheet to CSV", "Map columns: SKU, title, cost, price", "Clean duplicate SKUs",
        "Archive sold items older than 12 months", "Import into Inventr", "Verify 10 random items",
        "Run first sell-through report", "Retire old spreadsheet (read-only backup)",
    ]),
    "booth-scorecard": """        <p>Rate each area 1 (weak) to 5 (excellent).</p>
        <motion class="score-row"><label>Display & lighting</label><select data-cat="0"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></motion>
        <div class="score-row"><label>Signage & booth identity</label><select data-cat="1"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div class="score-row"><label>Pricing clarity</label><select data-cat="2"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div class="score-row"><label>Traffic / location</label><select data-cat="3"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></motion>
        <div class="score-row"><label>Checkout speed</label><select data-cat="4"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div class="score-row"><label>Inventory freshness</label><select data-cat="5"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div class="tool-results"><h3>Score</h3><dl>
            <dt>Average</dt><dd id="boothScore">—</dd>
            <dt>Summary</dt><dd id="boothLabel" style="color:var(--color-text)">—</dd>
        </dl></div>""",
}

for k in list(bodies.keys()):
    bodies[k] = bodies[k].replace(O, "<div").replace(C, "</div>").replace("motion", "div")

for t in manifest:
    body = bodies.get(t["slug"])
    if not body:
        print("missing", t["slug"])
        continue
    page = shell(t["title"], t["description"], t["slug"], body, t["slug"] in ("pnl-template", "spreadsheet-template"))
    out = ROOT / "funnel-tools" / t["slug"] / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)

cards = "\n".join(
    f"""        <div class="tool-card">
          <h3>{t['title']}</h3>
          <p>{t['description']}</p>
          <a class="btn btn--primary" href="/funnel-tools/{t['slug']}/">Open tool</a>
        </div>"""
    for t in manifest
)
index_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Free Reseller Tools — Inventr</title>
  <meta name="description" content="Free calculators, checklists, and templates for resellers.">
  <link rel="canonical" href="https://consignment.314-apps.com/funnel-tools/">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="site-header">
    {O} class="container">
      <a href="/blog/" class="logo">Inventr <span>Blog</span></a>
      <nav class="nav-links">
        <a href="/blog/">All Posts</a>
        <a href="/funnel-tools/">Free Tools</a>
        <a class="btn btn--primary btn--sm" href="{APP_STORE_URL}?utm_source=funnel_tools&amp;utm_medium=nav" target="_blank" rel="noopener">Try Inventr Free</a>
      </nav>
    {C}
  </header>
  <section class="hero hero--small">
    {O} class="container">
      <h1>Free tools for resellers</h1>
      <p>Calculators, checklists, and templates. Always free — no account required.</p>
    {C}
  </section>
  <main>
    {O} class="container">
      {O} class="tools-grid">
{cards}
      {C}
    {C}
  </main>
  <footer class="site-footer">{O} class="container"><p>&copy; 2026 Inventr · <a href="https://314-apps.com">314 Apps</a></p>{C}</footer>
</body>
</html>""".replace(O, "<div").replace(C, "</div>")
(ROOT / "funnel-tools/index.html").write_text(index_html)
print("done", len(manifest))
