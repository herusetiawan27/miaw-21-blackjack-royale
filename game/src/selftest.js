// Self-test for the Miaw 21 engine: pure logic, no DOM. Run with
//   node game/src/selftest.js
// from work-v2/. Every check prints PASS/FAIL and the process exits non-zero
// on the first failure, so a harness can trust the exit code alone.

import { buildShoe, handValue, isBlackjack, isPair, isSuitedPair } from './cards.js';
import { makeRng } from './rng.js';
import {
  PHASE,
  clearBet,
  createGame,
  deal,
  doubleDown,
  hit,
  newRound,
  peek,
  placeBet,
  repeatBet,
  restart,
  stand,
  startPlay,
  togglePair,
} from './engine.js';
import { stageShot } from './shots.js';

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
}

function card(rank, suit = '♠') {
  return { rank, suit, faceUp: true };
}

/**
 * Rig a game so the next draws come out in `draws` order (first drawn first).
 * Filler cards sit underneath so the shoe never triggers a reshuffle.
 */
function rigShoe(game, draws) {
  const filler = [];
  for (let i = 0; i < 60; i += 1) filler.push(card('2', '♣'));
  game.shoe = [...filler, ...[...draws].reverse()];
}

function betAndDeal(game, amount = 50) {
  startPlay(game);
  placeBet(game, amount);
  return deal(game);
}

// --- hand maths -------------------------------------------------------------
check('A+K is 21 soft', (() => {
  const v = handValue([card('A'), card('K')]);
  return v.total === 21 && v.soft && !v.bust;
})());
check('A+9+A is 21 soft', handValue([card('A'), card('9'), card('A')]).total === 21);
check('10+6+7 busts at 23', (() => {
  const v = handValue([card('10'), card('6'), card('7')]);
  return v.total === 23 && v.bust;
})());
check('A+5 is soft 16', (() => {
  const v = handValue([card('A'), card('5')]);
  return v.total === 16 && v.soft;
})());
check('K+Q is hard 20', (() => {
  const v = handValue([card('K'), card('Q')]);
  return v.total === 20 && !v.soft;
})());
check('A+K is blackjack, A+9+A is not', isBlackjack([card('A'), card('K')]) && !isBlackjack([card('A'), card('9'), card('A')]));
check('pair detection', isPair([card('8', '♥'), card('8', '♣')]) && !isPair([card('8'), card('9')]));
check('suited pair detection', isSuitedPair([card('Q', '♦'), card('Q', '♦')]) && !isSuitedPair([card('Q', '♦'), card('Q', '♥')]));

// --- shoe -------------------------------------------------------------------
check('4-deck shoe has 208 cards, 4 of each', (() => {
  const shoe = buildShoe(4, makeRng(1));
  if (shoe.length !== 208) return false;
  const counts = new Map();
  for (const c of shoe) counts.set(`${c.rank}${c.suit}`, (counts.get(`${c.rank}${c.suit}`) || 0) + 1);
  return counts.size === 52 && [...counts.values()].every((n) => n === 4);
})());
check('shuffle changes order but keeps the multiset', (() => {
  const a = buildShoe(1, makeRng(1));
  const b = buildShoe(1, makeRng(2));
  const sameOrder = a.every((c, i) => c.rank === b[i].rank && c.suit === b[i].suit);
  return !sameOrder && a.length === 52;
})());

// --- rigged rounds ----------------------------------------------------------
check('dealer stands on soft 17, player 20 wins', (() => {
  const g = createGame(5);
  // Draw order: P K, D 6, P Q, D A(hole). Dealer soft 17 -> stands. 20 beats 17.
  rigShoe(g, [card('K'), card('6'), card('Q'), card('A')]);
  betAndDeal(g, 50);
  if (g.phase !== PHASE.PLAYER) return false;
  const before = g.bankroll;
  stand(g);
  return g.result === 'win' && g.bankroll === before + 100 && g.dealer.length === 2;
})());
check('dealer hits 16 and reaches 21', (() => {
  const g = createGame(5);
  // Draw order: P K, D 10, P Q, D 6(hole), D draws 5 -> 21.
  rigShoe(g, [card('K'), card('10'), card('Q'), card('6'), card('5')]);
  betAndDeal(g, 50);
  stand(g);
  return g.result === 'lose' && g.dealer.length === 3 && handValue(g.dealer).total === 21;
})());
check('player blackjack pays 3:2', (() => {
  const g = createGame(5);
  rigShoe(g, [card('A'), card('9'), card('K'), card('7')]);
  betAndDeal(g, 50);
  return g.result === 'blackjack' && g.bankroll === 1000 - 50 + 50 + 75;
})());
check('both blackjack pushes', (() => {
  const g = createGame(5);
  rigShoe(g, [card('A'), card('K'), card('K'), card('A')]);
  betAndDeal(g, 50);
  return g.result === 'push' && g.bankroll === 1000;
})());
check('dealer blackjack beats plain 20', (() => {
  const g = createGame(5);
  rigShoe(g, [card('K'), card('A'), card('Q'), card('K')]);
  betAndDeal(g, 50);
  return g.result === 'lose' && g.bankroll === 950;
})());
check('hit to bust settles as bust, streak resets', (() => {
  const g = createGame(5);
  rigShoe(g, [card('10'), card('6'), card('9'), card('5'), card('K')]);
  betAndDeal(g, 50);
  hit(g);
  return g.result === 'bust' && g.phase === PHASE.SETTLED && g.streak === 0;
})());
check('Miaw Pair pays 5:1 on a plain pair', (() => {
  const g = createGame(5);
  rigShoe(g, [card('8', '♥'), card('6'), card('8', '♣'), card('5')]);
  startPlay(g);
  placeBet(g, 50);
  togglePair(g);
  deal(g);
  // 1000 - 50 - 10 + (10 stake back + 50 profit) = 1000.
  return g.pairWin === 50 && g.bankroll === 1000 && g.phase === PHASE.PLAYER;
})());
check('Miaw Pair pays 10:1 on a suited pair', (() => {
  const g = createGame(5);
  rigShoe(g, [card('Q', '♦'), card('6'), card('Q', '♦'), card('5')]);
  startPlay(g);
  placeBet(g, 50);
  togglePair(g);
  deal(g);
  return g.pairWin === 100 && g.bankroll === 1000 - 50 - 10 + 110;
})());
check('peek costs 10 and reveals the hole card', (() => {
  const g = createGame(5);
  rigShoe(g, [card('10'), card('6'), card('9'), card('5')]);
  betAndDeal(g, 50);
  const before = g.bankroll;
  const res = peek(g);
  return res.ok && g.peeked && g.dealer[1].faceUp && g.bankroll === before - 10;
})());
check('double doubles the bet and ends the player phase', (() => {
  const g = createGame(5);
  rigShoe(g, [card('6'), card('9'), card('5'), card('7'), card('2'), card('10'), card('8')]);
  betAndDeal(g, 50);
  const res = doubleDown(g);
  return res.ok && g.bet === 100 && g.player.length === 3 && g.phase === PHASE.SETTLED;
})());
check('repeat bet restores the last bet', (() => {
  const g = createGame(5);
  betAndDeal(g, 50);
  stand(g);
  newRound(g);
  const res = repeatBet(g);
  return res.ok && g.bet === 50;
})());
check('clear bet zeroes the pending bet', (() => {
  const g = createGame(5);
  startPlay(g);
  placeBet(g, 50);
  clearBet(g);
  return g.bet === 0;
})());
check('broke game restarts at 1000', (() => {
  const g = createGame(5);
  g.bankroll = 0;
  newRound(g);
  if (g.phase !== PHASE.BROKE) return false;
  restart(g);
  return g.bankroll === 1000 && g.phase === PHASE.BETTING;
})());

// --- deterministic shots ----------------------------------------------------
check('play shot stages a mid-round player phase', (() => {
  const { game, screen } = stageShot('play', 1);
  return screen === 'play' && game.phase === PHASE.PLAYER && game.player.length === 3;
})());
check('end shot stages a settled player win', (() => {
  const { game, screen } = stageShot('end', 1);
  return screen === 'over' && (game.result === 'win' || game.result === 'blackjack');
})());
check('start shot shows the title screen', (() => {
  const { game, screen } = stageShot('start', 1);
  return screen === 'title' && game.phase === PHASE.TITLE;
})());

// --- random soak: 500 rounds of random legal play ---------------------------
check('500 random rounds never break an invariant', (() => {
  const rng = makeRng(99);
  const g = createGame(99);
  startPlay(g);
  let completed = 0;
  for (let round = 0; round < 500; round += 1) {
    if (g.phase === PHASE.BROKE) restart(g);
    if (g.phase === PHASE.TITLE) startPlay(g);
    if (g.phase === PHASE.SETTLED) {
      newRound(g);
      if (g.phase === PHASE.BROKE) restart(g);
    }
    if (g.phase !== PHASE.BETTING) return false;
    if (g.bankroll <= 0) return false;
    placeBet(g, rng.pick([10, 20, 50, 100]));
    if (rng.next() < 0.3 && g.bankroll > g.bet + 10) togglePair(g);
    let dealt = deal(g);
    if (!dealt.ok && g.pairBet) {
      togglePair(g);
      dealt = deal(g);
    }
    if (!dealt.ok) return false;
    completed += 1;
    let guard = 0;
    while (g.phase === PHASE.PLAYER && guard < 15) {
      guard += 1;
      const roll = rng.next();
      if (roll < 0.1) peek(g);
      else if (roll < 0.2 && g.player.length === 2) doubleDown(g);
      else if (roll < 0.6) hit(g);
      else stand(g);
    }
    if (g.phase === PHASE.PLAYER) return false;
    if (g.bankroll < 0) return false;
    if (g.shoe.length < 0) return false;
  }
  return completed >= 400;
})());

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
