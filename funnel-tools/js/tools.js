(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function money(n) {
    const v = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
  }

  function pct(n) {
    return `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;
  }

  function parseMoney(val) {
    if (val == null || val === '') return 0;
    const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
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

  function bindMoneyInputs(root, fn) {
    $$('.money-in', root).forEach((el) => {
      el.addEventListener('input', fn);
      el.addEventListener('change', fn);
    });
    fn();
  }

  function setCalcCell(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = money(value);
    el.classList.toggle('negative', value < 0);
    const row = el.closest('tr');
    if (row) row.classList.toggle('negative', value < 0);
  }

  function downloadText(filename, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function showToast(msg) {
    let t = $('.tool-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'tool-toast';
      t.style.cssText =
        'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#1a1a22;border:1px solid #667eea;padding:0.75rem 1.25rem;border-radius:8px;z-index:999;color:#fff;font-size:0.9rem;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    setTimeout(() => t.remove(), 2500);
  }

  /* ——— Profit calculator ——— */
  function initProfitCalculator() {
    bindInputs(['sale', 'cogs', 'feePct', 'shipOut', 'shipIn'], () => {
      const sale = parseMoney($('#sale').value);
      const cogs = parseMoney($('#cogs').value);
      const feePct = parseMoney($('#feePct').value);
      const shipOut = parseMoney($('#shipOut').value);
      const shipIn = parseMoney($('#shipIn').value);
      const fees = sale * (feePct / 100);
      const net = sale + shipIn - cogs - fees - shipOut;
      const margin = sale > 0 ? (net / sale) * 100 : 0;
      const el = $('#netProfit');
      el.textContent = money(net);
      el.classList.toggle('negative', net < 0);
      $('#margin').textContent = pct(margin);
      $('#fees').textContent = money(fees);
    });

    $$('.preset-row button').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('#feePct').value = btn.dataset.fee || '';
        $('#sale').dispatchEvent(new Event('input'));
      });
    });
  }

  /* ——— Break-even ——— */
  function initBreakEvenCalculator() {
    bindInputs(['fixed', 'profitPerSale', 'avgSale'], () => {
      const fixed = parseMoney($('#fixed').value);
      const profit = parseMoney($('#profitPerSale').value);
      const avgSale = parseMoney($('#avgSale').value);
      const units = profit > 0 ? Math.ceil(fixed / profit) : 0;
      $('#unitsNeeded').textContent = units > 0 ? String(units) : '—';
      $('#revenueNeeded').textContent = units > 0 ? money(units * avgSale) : '—';
    });
  }

  /* ——— Sell-through ——— */
  function initSellThroughCalculator() {
    bindInputs(['startUnits', 'soldUnits', 'days'], () => {
      const start = parseMoney($('#startUnits').value);
      const sold = parseMoney($('#soldUnits').value);
      const days = parseMoney($('#days').value) || 1;
      const rate = start > 0 ? (sold / start) * 100 : 0;
      const annualized = rate * (365 / days);
      const daysPerSale = sold > 0 ? days / sold : 0;
      $('#stRate').textContent = pct(rate);
      $('#annualized').textContent = pct(annualized);
      $('#remaining').textContent = String(Math.max(0, start - sold));
      $('#daysPerSale').textContent = sold > 0 ? daysPerSale.toFixed(1) : '—';
    });
  }

  /* ——— Interactive P&L ——— */
  function initPnlTemplate() {
    const root = $('#pnl-root');
    if (!root) return;

    function recalc() {
      const gross = parseMoney($('[data-pnl="gross-sales"]', root)?.value);
      const cogs = parseMoney($('[data-pnl="cogs"]', root)?.value);
      const expenses = ['platform-fees', 'shipping', 'supplies', 'booth-rent', 'mileage', 'other'].reduce(
        (sum, key) => sum + parseMoney($(`[data-pnl="${key}"]`, root)?.value),
        0
      );
      const grossProfit = gross - cogs;
      const net = grossProfit - expenses;
      const margin = gross > 0 ? (net / gross) * 100 : 0;

      setCalcCell('pnl-gross-profit', grossProfit);
      setCalcCell('pnl-total-expenses', expenses);
      setCalcCell('pnl-net-profit', net);
      $('#pnl-margin').textContent = gross > 0 ? pct(margin) : '—';
      $('#pnl-margin').classList.toggle('negative', margin < 0);
    }

    bindMoneyInputs(root, recalc);

    $('#pnl-clear')?.addEventListener('click', () => {
      $$('.money-in', root).forEach((i) => {
        i.value = '';
      });
      $('#pnl-period').value = '';
      recalc();
    });

    $('#pnl-download')?.addEventListener('click', () => {
      const period = $('#pnl-period')?.value || 'Period';
      const lines = [`Inventr P&L — ${period}`, 'Category,Amount'];
      $$('#pnl-table tbody tr[data-pnl]', root).forEach((tr) => {
        const label = tr.querySelector('td')?.textContent?.trim();
        const val = parseMoney(tr.querySelector('.money-in')?.value);
        lines.push(`"${label}",${val.toFixed(2)}`);
      });
      lines.push(`"Gross profit",${(parseMoney($('[data-pnl=gross-sales]')?.value) - parseMoney($('[data-pnl=cogs]')?.value)).toFixed(2)}`);
      lines.push(`"Net profit",${$('#pnl-net-profit')?.textContent?.replace(/[$,]/g, '') || 0}`);
      downloadText('inventr-pnl.csv', lines.join('\n'));
    });

    $('#pnl-copy')?.addEventListener('click', async () => {
      const rows = [];
      $$('#pnl-table tbody tr', root).forEach((tr) => {
        const cells = [...tr.querySelectorAll('td')];
        if (!cells.length) return;
        const label = cells[0].textContent.trim();
        const amt =
          tr.querySelector('.money-in')?.value ||
          cells[1]?.textContent?.trim() ||
          '';
        rows.push(`${label}\t${amt}`);
      });
      await navigator.clipboard.writeText(rows.join('\n'));
      showToast('Copied to clipboard');
    });

    recalc();
  }

  /* ——— Interactive inventory sheet ——— */
  function initSpreadsheetTemplate() {
    const tbody = $('#sheet-body');
    if (!tbody) return;

    function rowProfit(tr) {
      const cost = parseMoney($('.in-cost', tr)?.value);
      const sold = parseMoney($('.in-sold', tr)?.value);
      const list = parseMoney($('.in-list', tr)?.value);
      const fees = parseMoney($('.in-fees', tr)?.value);
      const ship = parseMoney($('.in-ship', tr)?.value);
      const revenue = sold > 0 ? sold : 0;
      return revenue - cost - fees - ship;
    }

    function recalc() {
      let totalCost = 0;
      let totalRevenue = 0;
      let totalProfit = 0;
      let active = 0;

      $$('#sheet-body tr').forEach((tr) => {
        const profit = rowProfit(tr);
        const cost = parseMoney($('.in-cost', tr)?.value);
        const sold = parseMoney($('.in-sold', tr)?.value);
        const list = parseMoney($('.in-list', tr)?.value);
        const cell = $('.in-profit', tr);
        if (cell) {
          cell.textContent = sold > 0 || cost > 0 || list > 0 ? money(profit) : '—';
          cell.classList.toggle('negative', profit < 0);
        }
        if (cost || sold || list) active += 1;
        totalCost += cost;
        totalRevenue += sold;
        totalProfit += sold > 0 ? profit : 0;
      });

      $('#sheet-total-cost').textContent = money(totalCost);
      $('#sheet-total-revenue').textContent = money(totalRevenue);
      $('#sheet-total-profit').textContent = money(totalProfit);
      $('#sheet-total-profit').classList.toggle('negative', totalProfit < 0);
      $('#sheet-active').textContent = String(active);
    }

    function wireRow(tr) {
      $$('input', tr).forEach((inp) => {
        inp.addEventListener('input', recalc);
        inp.addEventListener('change', recalc);
      });
      $('.btn-row-remove', tr)?.addEventListener('click', () => {
        if ($$('#sheet-body tr').length <= 1) {
          $$('input', tr).forEach((i) => {
            i.value = '';
          });
          recalc();
          return;
        }
        tr.remove();
        recalc();
      });
    }

    function addRow() {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="text-in in-sku" placeholder="SKU"></td>
        <td><input class="text-in in-title" placeholder="Item title"></td>
        <td><input class="money-in in-cost" inputmode="decimal" placeholder="0"></td>
        <td><input class="money-in in-list" inputmode="decimal" placeholder="0"></td>
        <td><input class="money-in in-sold" inputmode="decimal" placeholder="0"></td>
        <td><input class="money-in in-fees" inputmode="decimal" placeholder="0"></td>
        <td><input class="money-in in-ship" inputmode="decimal" placeholder="0"></td>
        <td class="num calc-cell in-profit">—</td>
        <td><button type="button" class="btn-row-remove" title="Remove row">×</button></td>`;
      tbody.appendChild(tr);
      wireRow(tr);
      recalc();
    }

    $$('#sheet-body tr').forEach(wireRow);
    $('#sheet-add-row')?.addEventListener('click', addRow);

    $('#sheet-clear')?.addEventListener('click', () => {
      tbody.innerHTML = '';
      for (let i = 0; i < 5; i++) addRow();
    });

    $('#sheet-download')?.addEventListener('click', () => {
      const header =
        'SKU,Title,Cost,List Price,Sale Price,Fees,Shipping,Profit,Status';
      const rows = $$('#sheet-body tr').map((tr) => {
        const sold = parseMoney($('.in-sold', tr)?.value);
        const profit = rowProfit(tr);
        return [
          $('.in-sku', tr)?.value || '',
          `"${($('.in-title', tr)?.value || '').replace(/"/g, '""')}"`,
          parseMoney($('.in-cost', tr)?.value),
          parseMoney($('.in-list', tr)?.value),
          sold,
          parseMoney($('.in-fees', tr)?.value),
          parseMoney($('.in-ship', tr)?.value),
          sold > 0 ? profit.toFixed(2) : '',
          sold > 0 ? 'Sold' : 'Available',
        ].join(',');
      });
      downloadText('inventr-inventory.csv', [header, ...rows].join('\n'));
    });

    if ($$('#sheet-body tr').length === 0) {
      for (let i = 0; i < 5; i++) addRow();
    }
    recalc();
  }

  /* ——— Checklist with optional $ column ——— */
  function initChecklist(storageKey, listId, opts = {}) {
    const list = $(listId);
    if (!list) return;
    const withMoney = opts.withMoney;

    function updateTotal() {
      if (!withMoney) return;
      let sum = 0;
      $$('.money-in', list).forEach((inp) => {
        sum += parseMoney(inp.value);
      });
      const el = $('#checklist-total');
      if (el) el.textContent = money(sum);
    }

    $$('li', list).forEach((li) => {
      const cb = $('input[type=checkbox]', li);
      const id = cb?.dataset.id;
      if (!cb) return;

      cb.addEventListener('change', () => {
        li.classList.toggle('done', cb.checked);
        updateTotal();
      });

      if (withMoney) {
        const inp = $('.money-in', li);
        inp?.addEventListener('input', updateTotal);
      }
    });

    $('#checklist-reset')?.addEventListener('click', () => {
      $$('input[type=checkbox]', list).forEach((cb) => {
        cb.checked = false;
        cb.closest('li')?.classList.remove('done');
      });
      if (withMoney) {
        $$('.money-in', list).forEach((i) => {
          i.value = '';
        });
        updateTotal();
      }
    });

    updateTotal();
  }

  /* ——— Sourcing flip calculator ——— */
  function initSourcingGuide() {
    bindInputs(['src-buy', 'src-sell', 'src-fees', 'src-ship', 'src-hours'], () => {
      const buy = parseMoney($('#src-buy').value);
      const sell = parseMoney($('#src-sell').value);
      const feePct = parseMoney($('#src-fees').value);
      const fees = sell * (feePct / 100);
      const ship = parseMoney($('#src-ship').value);
      const hours = parseMoney($('#src-hours').value) || 0;
      const net = sell - buy - fees - ship;
      const margin = sell > 0 ? (net / sell) * 100 : 0;
      const perHour = hours > 0 ? net / hours : 0;
      $('#src-net').textContent = money(net);
      $('#src-net').classList.toggle('negative', net < 0);
      $('#src-margin').textContent = sell > 0 ? pct(margin) : '—';
      $('#src-hourly').textContent = hours > 0 ? money(perHour) : '—';
    });
    initChecklist(null, '#sourcing-checklist');
  }

  /* ——— Booth scorecard ——— */
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

  const tool = document.body.dataset.tool;
  const map = {
    'profit-calculator': initProfitCalculator,
    'break-even-calculator': initBreakEvenCalculator,
    'sell-through-calculator': initSellThroughCalculator,
    'pnl-template': initPnlTemplate,
    'spreadsheet-template': initSpreadsheetTemplate,
    'photo-checklist': () => initChecklist(null, '#photo-checklist'),
    'tax-checklist': () => initChecklist(null, '#tax-checklist', { withMoney: true }),
    'sourcing-guide': initSourcingGuide,
    'migration-guide': () => initChecklist(null, '#migration-checklist'),
    'booth-scorecard': initBoothScorecard,
  };

  if (tool && map[tool]) map[tool]();
})();
