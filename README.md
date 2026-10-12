# World Cup Match Probability Model

A browser-based tool that predicts football scorelines with a Poisson model and the Dixon-Coles correction. I built it during the 2026 FIFA World Cup and backtested it on the knockout rounds.

It runs entirely in the browser. No build step and no dependencies.

**Live demo:** _add your GitHub Pages link here_

## What it does

- Takes each team's goals for, goals against, xG and xGA.
- Blends actual goals with xG using a tunable weight `w`.
- Builds a full 8×8 scoreline probability matrix.
- Outputs 1X2, over/under 2.5, both teams to score, and the most likely scores.
- Compares model probabilities to bookmaker odds. Removes the bookmaker margin, computes expected value, and sizes positions with fractional Kelly.
- Logs predictions against 90-minute results and tracks Brier score and hit rate.

## Method

### 1. Attack and defence strength

Each input is blended between actual goals and xG:

```
attack  = w · xG  + (1 − w) · goals scored
defence = w · xGA + (1 − w) · goals conceded
```

With `m` as the tournament's average goals per team, expected goals are:

```
λ_home = (attack_home / m) · (defence_away / m) · m · home_advantage
λ_away = (attack_away / m) · (defence_home / m) · m
```

### 2. Scoreline probabilities

Goals are modelled as independent Poisson variables. Independence underestimates low-scoring draws. The Dixon-Coles (1997) factor τ fixes this for 0-0, 1-0, 0-1 and 1-1:

```
P(i, j) ∝ Pois(i; λ_home) · Pois(j; λ_away) · τ(i, j)
```

An optional draw-boost δ multiplies every diagonal cell. The matrix is then normalised.

### 3. Betting math

- Implied probability = 1 / decimal odds. Fair probability divides by the overround.
- Expected value = p · odds − 1.
- Kelly fraction = (p · odds − 1) / (odds − 1), scaled down to ¼ or ½ Kelly.

## Backtest

20 matches from the 2026 World Cup: 16 Round of 32 games and 4 later knockout games. Results are 90-minute outcomes.

| Version | Avg. Brier | Hit rate |
|---|---|---|
| Goals only (w = 0) | 0.548 | 55% |
| xG blend (w = 0.6) | 0.565 | 65% |
| Uniform guess (⅓ each) | 0.667 | n/a |

Lower Brier is better. Both versions beat a uniform guess. The xG blend picked the right outcome more often but was slightly less calibrated.

### Findings

- **Labeling fix.** The betting market I compared against settles on 90 minutes. Three games decided in extra time had been logged as home wins. Relabeling them as draws changed the results noticeably.
- **Rejected parameter.** Knockout games looked draw-heavy, so I tested δ = 1.3. It fit the 20-game sample but made the next out-of-sample game worse. I treated that as overfitting and left δ at 1.0 by default.
- **Sample size.** 20 games is small. These numbers show direction, not proof.

## Project structure

```
index.html       page layout
model.js         model math, pure functions, no DOM
app.js           reads inputs and renders results
style.css        styles, light and dark theme
model.test.js    unit tests for the model
```

## Running it

Open `index.html` in a browser.

Run the tests with Node 18 or later:

```
node --test
```

## Limitations

- Team ratings come from a small number of tournament games.
- No adjustment for opponent strength, injuries or lineups.
- Poisson assumes constant scoring rates, which knockout games often break.

## Reference

Dixon, M. J., & Coles, S. G. (1997). Modelling association football scores and inefficiencies in the football betting market. *Journal of the Royal Statistical Society: Series C*, 46(2), 265–280.
