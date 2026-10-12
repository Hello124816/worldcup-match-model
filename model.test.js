// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/model.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('poisson pmf sums to ~1', () => {
  let s = 0;
  for (let k = 0; k < 30; k++) s += M.poisson(k, 1.4);
  close(s, 1);
});

test('score matrix is normalised', () => {
  const g = M.scoreMatrix(1.6, 1.1, -0.1, 1);
  close(g.flat().reduce((a, b) => a + b, 0), 1);
});

test('1X2 probabilities sum to 1', () => {
  const mk = M.markets(M.scoreMatrix(1.6, 1.1, -0.1, 1));
  close(mk.home + mk.draw + mk.away, 1);
});

test('negative rho raises draw probability', () => {
  const plain = M.markets(M.scoreMatrix(1.3, 1.3, 0, 1)).draw;
  const dc = M.markets(M.scoreMatrix(1.3, 1.3, -0.1, 1)).draw;
  assert.ok(dc > plain);
});

test('equal teams on neutral ground are symmetric', () => {
  const mk = M.markets(M.scoreMatrix(1.2, 1.2, -0.1, 1));
  close(mk.home, mk.away);
});

test('xG weight 0 and 1 pick the right inputs', () => {
  assert.strictEqual(M.blend(2, 1, 0), 2);
  assert.strictEqual(M.blend(2, 1, 1), 1);
});

test('margin removal gives fair probabilities summing to 1', () => {
  const r = M.stripMargin([2.0, 3.05, 2.25]);
  close(r.fair.reduce((a, b) => a + b, 0), 1);
  assert.ok(r.overround > 1);
});

test('kelly is zero with no edge', () => {
  assert.strictEqual(M.kelly(0.4, 2.0, 1), 0);
  close(M.kelly(0.6, 2.0, 1), 0.2);
});

test('brier score bounds', () => {
  close(M.brier({ home: 1, draw: 0, away: 0 }, 'H'), 0);
  close(M.brier({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 }, 'D'), 2 / 3);
});
