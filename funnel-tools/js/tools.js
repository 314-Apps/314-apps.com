(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function money(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function pct(n) {
    return `${n.toFixed(1)}%`;
  }

  function bindInputs(ids, fn) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', fn);
        el.addEventListener('change', fn);
      }
    });
    fn();
  }

  function initProfitCalculator() {
    bindInputs(['sale', 'cogs', 'feePct', 'shipOut', 'shipIn'], () => {
      const sale = parseFloat($('#sale').value) || 0;
      const cogs = parseFloat($('#cogs').value) || 0;
      const feePct = parseFloat($('#feePct').value) || 0;
      const shipOut = parseFloat($('#shipOut').value) || 0;
      const shipIn = parseFloat($('#shipIn').value) || 0;
      const fees = sale * (feePct / 100);
      const net = sale - cogs - fees - shipOut - shipIn;
      const margin = sale > 0 ? (net / sale) * 100 : 0;
      $('#netProfit').textContent = money(net);
      $('#netProfit').classList.toggle('negative', net < 0);
      $('#margin').textContent = pct(margin);
      $('#fees').textContent = money(fees);
    });
  }

  function initBreakEvenCalculator() {
    bindInputs(['fixed', 'profitPerSale', 'avgSale'], () => {
      const fixed = parseFloat($('#fixed').value) || 0;
      const profit = parseFloat($('#profitPerSale').value) || 0;
      const avgSale = parseFloat($('#avgSale').value) || 0;
      const units = profit > 0 ? Math.ceil(fixed / profit) : 0;
      const revenue = units * avgSale;
      $('#unitsNeeded').textContent = units > 0 ? String(units) : '—';
      $('#revenueNeeded').textContent = units > 0 ? money(revenue) : '—';
    });
  }

  function initSellThroughCalculator() {
    bindInputs(['startUnits', 'soldUnits', 'days'], () => {
      const start = parseFloat($('#startUnits').value) || 0;
      const sold = parseFloat($('#soldUnits').value) || 0;
      const days = parseFloat($('#days').value) || 0;
      const rate = start > 0 ? (sold / start) * 100 : 0;
      const annualized = days > 0 ? rate * (365 / days) : 0;
      $('#stRate').textContent = pct(rate);
      $('#annualized').textContent = days > 0 ? pct(annualized) : '—';
      $('#remaining').textContent = String(Math.max(0, start - sold));
    });
  }

  function initChecklist(storageKey, listId) {
    const list = $(listId);
    if (!list) return;
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    $$('input[type=checkbox]', list).forEach((cb) => {
      const id = cb.dataset.id;
      if (saved[id]) cb.checked = true;
      cb.closest('li')?.classList.toggle('done', cb.checked);
      cb.addEventListener('change', () => {
        saved[id] = cb.checked;
        localStorage.setItem(storageKey, JSON.stringify(saved));
        cb.closest('li')?.classList.toggle('done', cb.checked);
      });
    });
    const reset = $('#checklist-reset');
    if (reset) {
      reset.addEventListener('click', () => {
        localStorage.removeItem(storageKey);
        $$('input[type=checkbox]', list).forEach((cb) => {
          cb.checked = false;
          cb.closest('li')?.classList.remove('done');
        });
      });
    }
  }

  function downloadText(filename, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function initPnlTemplate() {
    $('#pnl-download')?.addEventListener('click', () => {
      const csv = [
        'Category,Amount',
        'Gross sales,',
        'Cost of goods sold,',
        'Platform fees,',
        'Shipping paid,',
        'Supplies & packaging,',
        'Booth rent,',
        'Mileage (deductible),',
        'Other expenses,',
        'Net profit,',
      ].join('\n');
      downloadText('inventr-pnl-template.csv', csv);
    });
    $('#pnl-copy')?.addEventListener('click', async () => {
      const table = $('#pnl-table');
      const text = [...table.querySelectorAll('tr')]
        .map((tr) => [...tr.children].map((td) => td.textContent.trim()).join('\t'))
        .join('\n');
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard');
    });
  }

  function initSpreadsheetTemplate() {
    $('#sheet-download')?.addEventListener('click', () => {
      const csv = [
        'SKU,Title,Cost,List Price,Channel,Status,Date Listed,Date Sold,Sale Price,Fees,Shipping',
        ',,,,,Available,,,,,',
      ].join('\n');
      downloadText('inventr-inventory-template.csv', csv);
    });
  }

  function initBoothScorecard() {
    const rows = $$('.score-row select');
    const update = () => {
      let total = 0;
      let count = 0;
      rows.forEach((sel) => {
        const v = parseInt(sel.value, 10);
        if (!Number.isNaN(v)) {
          total += v;
          count += 1;
        }
      });
      const avg = count ? total / count : 0;
      $('#boothScore').textContent = count ? avg.toFixed(1) : '—';
      let label = 'Needs work';
      if (avg >= 4) label = 'Strong booth';
      else if (avg >= 3) label = 'Solid';
      else if (avg >= 2) label = 'Room to improve';
      $('#boothLabel').textContent = label;
    };
    rows.forEach((sel) => sel.addEventListener('change', update));
    update();
  }

  function showToast(msg) {
    let t = $('.tool-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'tool-toast';
      t.style.cssText =
        'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#1a1a22;border:1px solid #667eea;padding:0.75rem 1.25rem;border-radius:8px;z-index:999;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    setTimeout(() => t.remove(), 2500);
  }

  const tool = document.body.dataset.tool;
  const map = {
    'profit-calculator': initProfitCalculator,
    'break-even-calculator': initBreakEvenCalculator,
    'sell-through-calculator': initSellThroughCalculator,
    'photo-checklist': () => initChecklist('inventr-photo-checklist', '#photo-checklist'),
    'tax-checklist': () => initChecklist('inventr-tax-checklist', '#tax-checklist'),
    'sourcing-guide': () => initChecklist('inventr-sourcing-guide', '#sourcing-checklist'),
    'migration-guide': () => initChecklist('inventr-migration-guide', '#migration-checklist'),
    'pnl-template': initPnlTemplate,
    'spreadsheet-template': initSpreadsheetTemplate,
    'booth-scorecard': initBoothScorecard,
  };
  if (tool && map[tool]) map[tool]();
})();
