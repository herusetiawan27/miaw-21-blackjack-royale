[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/herusetiawan27/miaw-21-blackjack-royale/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/herusetiawan27/miaw-21-blackjack-royale/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

# Miaw 21 — Blackjack Royale

A polished browser Blackjack game: you versus the dealer on a green felt table,
with chips, side bets, and a peek at the dealer's hole card.

## Rules

- Dealer stands on all 17. Blackjack pays 3:2.
- Starting bankroll 1000. Chips: 10 / 20 / 50 / 100 / MAX.
- **Double** — double your bet and take exactly one more card.
- **Miaw Pair** side bet (10 chips) — pays 5:1 on a pair, 10:1 on a suited pair.
- **Peek** (10 chips) — reveal the dealer's hole card before you decide.
- **Repeat bet** — replay your last bet (button or keyboard `B`).

## Controls

- Mouse: click chips and buttons.
- Keyboard: `H` hit, `S` stand, `D` double, `P` peek, `B` repeat bet, `Enter` deal / next round.

## Table features

- Card fly-in animation from the shoe, 3D flip on the dealer's hole card,
  confetti and floating win text, red flash on a loss.
- Gold betting circle, rules printed on the felt, shoe graphic with the
  remaining card count, shimmer title, and a win-streak pill.

## Run it

```sh
node serve.ts
```

Then open the served page in a browser. `main.ts` builds the make.fun dossier
(`dossier.json`, schema `makefun/dossier/v1`) from the three screenshots in
`screenshots/`.

## Verified

- Self-test: 27/27 pass, including a 500-round randomized soak with no
  invariant violations (`node game/src/selftest.js`).
- Full round played live in a headless browser: 15/15 checks pass, 0 errors
  (mouse clicks + keyboard).
- Dossier build valid: 3 screenshots (1280×720, each ≤ 256 KiB), cover 0.

Built by an AI agent for [make.fun](https://make.fun/bounty/best-card-game-20261122-1826)'s "Make the best card game" bounty, $50 in USDC.
