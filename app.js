// UI layer. Reads inputs, calls WCModel, renders results.
(function () {
  const M = window.WCModel;
  const $ = id => document.getElementById(id);
  const num = id => parseFloat($(id).value) || 0;
  const pct = v => (v * 100).toFixed(1) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let P = null;

  function calculate() {
    const eg = M.expectedGoals({
      home: { gf: num('hGF'), ga: num('hGA'), xg: num('hXG'), xga: num('hXGA') },
      away: { gf: num('aGF'), ga: num('aGA'), xg: num('aXG'), xga: num('aXGA') },
      xgWeight: num('w'), leagueAvg: num('avg'), homeAdv: num('hAdv')
    });
    const grid = M.scoreMatrix(eg.lambdaHome, eg.lambdaAway, num('rho'), num('delta'));
    const mk = M.markets(grid);
    const hn = $('hName').value || '主隊', an = $('aName').value || '客隊';
    P = { H: mk.home, D: mk.draw, A: mk.away, O: mk.over25, U: mk.under25, hn, an };

    $('lam').textContent = `λ ${hn} ${eg.lambdaHome.toFixed(2)} · ${an} ${eg.lambdaAway.toFixed(2)}　（混合後攻/守：${eg.hAtk.toFixed(2)}/${eg.hDef.toFixed(2)} vs ${eg.aAtk.toFixed(2)}/${eg.aDef.toFixed(2)}）`;
    const bars = rows => rows.map(([n, v]) => `<div class="bar"><span class="name">${esc(n)}</span><div class="track"><div class="fill" style="width:${(v * 100).toFixed(1)}%"></div></div><span class="pct">${pct(v)}</span></div>`).join('');
    $('t1x2').innerHTML = bars([[hn + '勝', mk.home], ['和局', mk.draw], [an + '勝', mk.away]]);
    $('tou').innerHTML = bars([['大 2.5', mk.over25], ['小 2.5', mk.under25]]);
    $('tbtts').innerHTML = bars([['是', mk.btts], ['否', mk.noBtts]]);
    $('topScores').innerHTML = mk.scores.slice(0, 6).map(s => `<span class="chip"><b>${s.home}-${s.away}</b>${pct(s.p)}</span>`).join('');

    const mx = mk.scores[0].p;
    let h = '<tr><th>' + esc(hn.slice(0, 3)) + '＼' + esc(an.slice(0, 3)) + '</th>' + [0, 1, 2, 3, 4, 5].map(j => `<th>${j}</th>`).join('') + '</tr>';
    for (let i = 0; i < 6; i++) {
      h += `<tr><th>${i}</th>`;
      for (let j = 0; j < 6; j++) {
        const p = grid[i][j], a = (p / mx * 0.85).toFixed(2);
        h += `<td class="${i === j ? 'diag' : ''}" style="background:rgba(var(--heat),${a});color:${p / mx > 0.55 ? 'var(--paper)' : 'var(--fg)'}">${(p * 100).toFixed(1)}</td>`;
      }
      h += '</tr>';
    }
    $('matrix').innerHTML = h;
    renderEV();
  }

  const EVROWS = [['H', '主勝', 2.00], ['D', '和局', 3.05], ['A', '客勝', 2.25], ['O', '大 2.5', null], ['U', '小 2.5', null]];
  function buildEV() {
    $('evBody').innerHTML = EVROWS.map(([k, n, o]) => `<tr><td id="evn_${k}">${n}</td><td><input type="number" step="0.01" id="odd_${k}" value="${o ?? ''}" placeholder="—"></td><td id="imp_${k}">—</td><td id="fair_${k}">—</td><td id="mod_${k}">—</td><td id="ev_${k}">—</td><td id="k_${k}">—</td></tr>`).join('');
    EVROWS.forEach(([k]) => $('odd_' + k).addEventListener('input', renderEV));
  }
  function renderEV() {
    if (!P) return;
    $('evn_H').textContent = P.hn + '勝'; $('evn_A').textContent = P.an + '勝';
    const kf = parseFloat($('kf').value), bank = num('bank'), notes = [];
    [['H', 'D', 'A'], ['O', 'U']].forEach(group => {
      const odds = group.map(k => parseFloat($('odd_' + k).value));
      const ok = odds.every(o => o > 1);
      const sm = ok ? M.stripMargin(odds) : null;
      if (ok) notes.push((group.length === 3 ? '1X2' : '大小球') + ` 總隱含 ${(sm.overround * 100).toFixed(1)}%，抽水約 ${((sm.overround - 1) * 100).toFixed(1)}%`);
      group.forEach((k, i) => {
        const o = odds[i], p = P[k];
        $('mod_' + k).textContent = pct(p);
        if (!(o > 1)) { ['imp', 'fair', 'ev', 'k'].forEach(c => $(c + '_' + k).textContent = '—'); return; }
        $('imp_' + k).textContent = pct(1 / o);
        $('fair_' + k).textContent = ok ? pct(sm.fair[i]) : '—';
        const ev = M.expectedValue(p, o);
        $('ev_' + k).innerHTML = `<span class="${ev > 0 ? 'posv' : 'negv'}">${ev > 0 ? '+' : ''}${(ev * 100).toFixed(1)}%</span>`;
        const f = M.kelly(p, o, kf);
        $('k_' + k).textContent = f > 0 ? `${(f * 100).toFixed(1)}% · ${Math.round(f * bank)}` : '不下';
      });
    });
    $('vig').textContent = notes.join('　') || '輸入賠率後會顯示抽水。';
  }

  // Backtest log, stored in this browser only.
  const KEY = 'wc-model-log-v1';
  let log = [];
  try { log = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { log = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) {} };

  function renderLog() {
    $('logEmpty').hidden = log.length > 0;
    $('logBody').innerHTML = log.map((r, i) => {
      const lab = { H: '主勝', D: '和', A: '客勝' }[r.res];
      return `<tr><td>${esc(r.hn)} vs ${esc(r.an)}</td><td>${(r.H * 100).toFixed(0)}/${(r.D * 100).toFixed(0)}/${(r.A * 100).toFixed(0)}</td><td>${lab}</td><td>${r.brier.toFixed(3)}</td><td class="${r.hit ? 'posv' : 'negv'}">${r.hit ? '✓' : '✗'}</td><td><button class="ghost" data-i="${i}">刪除</button></td></tr>`;
    }).join('');
    if (log.length) {
      const b = log.reduce((s, r) => s + r.brier, 0) / log.length;
      const h = log.filter(r => r.hit).length / log.length;
      $('logStats').innerHTML = `<div class="stat"><span class="v">${log.length}</span><span class="k">場數</span></div><div class="stat"><span class="v">${b.toFixed(3)}</span><span class="k">平均 Brier（越低越好，盲猜約 0.667）</span></div><div class="stat"><span class="v">${(h * 100).toFixed(0)}%</span><span class="k">最高機率選項命中率</span></div>`;
    } else $('logStats').innerHTML = '';
  }

  $('logBody').addEventListener('click', e => {
    const i = e.target.dataset.i;
    if (i !== undefined) { log.splice(+i, 1); save(); renderLog(); }
  });
  $('addLog').addEventListener('click', () => {
    if (!P) calculate();
    const res = $('res').value;
    const probs = { home: P.H, draw: P.D, away: P.A };
    const pick = [['H', P.H], ['D', P.D], ['A', P.A]].sort((a, b) => b[1] - a[1])[0][0];
    log.push({ hn: P.hn, an: P.an, H: P.H, D: P.D, A: P.A, res, brier: M.brier(probs, res), hit: pick === res });
    save(); renderLog();
  });
  let armed = false;
  $('clearLog').addEventListener('click', () => {
    if (!armed) {
      armed = true; $('clearLog').textContent = '再按一次確認清空';
      setTimeout(() => { armed = false; $('clearLog').textContent = '清空紀錄'; }, 3000);
      return;
    }
    log = []; save(); renderLog(); armed = false; $('clearLog').textContent = '清空紀錄';
  });

  $('calc').addEventListener('click', calculate);
  $('kf').addEventListener('change', renderEV);
  $('bank').addEventListener('input', renderEV);
  buildEV(); calculate(); renderLog();
})();
