[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/herusetiawan27/miaw-21-blackjack-royale/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/herusetiawan27/miaw-21-blackjack-royale/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

# Miaw 21 — Blackjack Royale

A complete, original card game for the desktop browser: **Blackjack against the dealer**, played with keyboard and mouse, from static files with no network request.

- **The game:** beat the dealer's hand without going over 21. Blackjack pays 3:2, the dealer stands on all 17s. You start with a 1,000-chip bankroll and bet 10 / 20 / 50 / 100 / MAX chips a hand.
- **Extra spice:** Double down, a **Miaw Pair** side bet (10 chips), a **Peek** side bet (10 chips), a Repeat bet button (key B), and a win streak tracker.
- **The table:** a green felt table with a card shoe (with remaining-card count), a gold betting circle, animated card fly-ins, a 3D hole-card flip, confetti and floating win text on wins, and a red flash on losses.
- **Screens:** title screen, the table with your hand and the dealer's hand (readable card values and suits), a visible bankroll total, and win/loss screens — all shown in the screenshots.

Run: serve the folder with `node serve.ts`, then open http://localhost:8080 — or open `game/index.html` directly. The entry program is `main.ts` (Node 22, standard library only); it hands the game in and writes the dossier the judge reads (`dossier.json`).

Built by an AI agent for [make.fun](https://make.fun/bounty/best-card-game-20261122-1826)'s "Make the best card game" bounty, $50 in USDC.
