// Core scoreline model. Pure functions, no DOM access.
// Works in the browser (window.WCModel) and in Node (module.exports).
(function (root) {
  const MAX_GOALS = 8;

  function factorial(n) {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // P(X = k) for X ~ Poisson(lambda)
  function poisson(k, lambda) {
    return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
  }

  // Dixon-Coles (1997) correction for low scores.
  // Independent Poisson underestimates 0-0 and 1-1 and misprices 1-0 / 0-1.
  // rho < 0 moves probability toward draws at low scores.
  function dixonColesTau(x, y, lh, la, rho) {
    if (x === 0 && y === 0) return 1 - lh * la * rho;
    if (x === 0 && y === 1) return 1 + lh * rho;
    if (x === 1 && y === 0) return 1 + la * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1;
  }

  // Mix actual goals with xG. w = 0 uses goals only, w = 1 uses xG only.
  function blend(actual, xg, w) {
    return w * xg + (1 - w) * actual;
  }

  // Expected goals for each side.
  // Attack and defence are expressed relative to the per-team tournament average.
  function expectedGoals(p) {
    const w = Math.min(1, Math.max(0, p.xgWeight));
    const hAtk = blend(p.home.gf, p.home.xg, w);
    const hDef = blend(p.home.ga, p.home.xga, w);
    const aAtk = blend(p.away.gf, p.away.xg, w);
    const aDef = blend(p.away.ga, p.away.xga, w);
    const m = Math.max(0.1, p.leagueAvg / 2);
    const lambdaHome = Math.max(0.05, (hAtk / m) * (aDef / m) * m * (p.homeAdv || 1));
    const lambdaAway = Math.max(0.05, (aAtk / m) * (hDef / m) * m);
    return { lambdaHome, lambdaAway, hAtk, hDef, aAtk, aDef };
  }

  // Full normalised score matrix. grid[i][j] = P(home i, away j).
  // drawBoost multiplies every diagonal cell before normalising.
  function scoreMatrix(lambdaHome, lambdaAway, rho, drawBoost) {
    const delta = drawBoost || 1;
    const grid = [];
    let total = 0;
    for (let i = 0; i < MAX_GOALS; i++) {
      grid[i] = [];
      for (let j = 0; j < MAX_GOALS; j++) {
        let p = poisson(i, lambdaHome) * poisson(j, lambdaAway) *
                dixonColesTau(i, j, lambdaHome, lambdaAway, rho);
        if (i === j) p *= delta;
        p = Math.max(0, p);
        grid[i][j] = p;
        total += p;
      }
    }
    for (let i = 0; i < MAX_GOALS; i++)
      for (let j = 0; j < MAX_GOALS; j++) grid[i][j] /= total;
    return grid;
  }

  // Market probabilities from the matrix.
  function markets(grid) {
    let home = 0, draw = 0, away = 0, over25 = 0, btts = 0;
    const scores = [];
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const p = grid[i][j];
        if (i > j) home += p; else if (i === j) draw += p; else away += p;
        if (i + j > 2) over25 += p;
        if (i > 0 && j > 0) btts += p;
        scores.push({ home: i, away: j, p });
      }
    }
    scores.sort((a, b) => b.p - a.p);
    return { home, draw, away, over25, under25: 1 - over25, btts, noBtts: 1 - btts, scores };
  }

  // Bookmaker odds to probabilities. Proportional margin removal.
  function stripMargin(odds) {
    const implied = odds.map(o => 1 / o);
    const overround = implied.reduce((s, x) => s + x, 0);
    return { implied, fair: implied.map(x => x / overround), overround };
  }

  // Expected value of a 1-unit bet at decimal odds.
  function expectedValue(p, odds) {
    return p * odds - 1;
  }

  // Kelly fraction of bankroll. 0 when the edge is negative.
  function kelly(p, odds, fraction) {
    const f = (p * odds - 1) / (odds - 1);
    return Math.max(0, f) * (fraction == null ? 1 : fraction);
  }

  // Multiclass Brier score for a 1X2 forecast. outcome is 'H', 'D' or 'A'.
  // Range 0 (perfect) to 2. Uniform 1/3 guessing scores about 0.667.
  function brier(probs, outcome) {
    const o = { H: 0, D: 0, A: 0 };
    o[outcome] = 1;
    return (probs.home - o.H) ** 2 + (probs.draw - o.D) ** 2 + (probs.away - o.A) ** 2;
  }

  const api = {
    MAX_GOALS, poisson, dixonColesTau, blend, expectedGoals,
    scoreMatrix, markets, stripMargin, expectedValue, kelly, brier
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WCModel = api;
})(this);
