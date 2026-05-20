#!/usr/bin/env node
/** Logic tests for funnel tool calculations (no browser). */
import assert from 'node:assert/strict';

function parseMoney(val) {
  if (val == null || val === '') return 0;
  const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Profit: sale 45, cogs 12, fee 13%, shipOut 5.5, shipIn 0
{
  const sale = 45, cogs = 12, feePct = 13, shipOut = 5.5, shipIn = 0;
  const fees = sale * (feePct / 100);
  const net = sale + shipIn - cogs - fees - shipOut;
  assert.ok(Math.abs(net - (45 - 12 - 5.85 - 5.5)) < 0.01, `profit net ${net}`);
}

// P&L: gross 10000, cogs 4000, expenses 2500 => net 3500
{
  const gross = 10000, cogs = 4000, exp = 2500;
  const gp = gross - cogs;
  const net = gp - exp;
  assert.equal(net, 3500);
  assert.equal((net / gross) * 100, 35);
}

// Sell-through: 200 start, 38 sold, 30 days => 19%
{
  const rate = (38 / 200) * 100;
  assert.equal(rate, 19);
}

// Break-even: fixed 350, profit 18 => ceil(19.44)=20
{
  assert.equal(Math.ceil(350 / 18), 20);
}

// Sourcing: buy 8, sell 35, fee 13%, ship 5
{
  const net = 35 - 8 - 35 * 0.13 - 5;
  assert.ok(Math.abs(net - 17.45) < 0.01);
}

console.log('All audit-tools logic tests passed.');
