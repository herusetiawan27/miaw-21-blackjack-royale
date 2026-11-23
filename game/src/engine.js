// The Blackjack engine for Miaw 21: pure rules, no DOM. A game is a plain state
// object; every function below takes it, mutates it, and returns a short result
// the renderer can animate from. Money is always whole chips; every payout is
// an integer because the bankroll only ever moves in even amounts.
//
// House rules: dealer stands on all 17 (soft 17 included), blackjack pays 3:2,
// a win pays 1:1, a push returns the bet. Side bets: Miaw Pair costs 10 and
// pays 5:1 on any pair (10:1 on a suited pair); Peek costs 10 and turns the
// dealer's hole card face up for the rest of the round.

import { buildShoe, handValue, isBlackjack, isPair, isSuitedPair } from './cards.js';
import { makeRng, liveSeed } from './rng.js';

export const START_BANKROLL = 1000;
export const DECKS = 4;
export const RESHUFFLE_AT = 52;
export const PAIR_COST = 10;
export const PEEK_COST = 10;
export const PAIR_PAY = 5;
export const SUITED_PAIR_PAY = 10;
export const CHIPS = [10, 20, 50, 100];

export const PHASE = {
  TITLE: 'title',
  BETTING: 'betting',
  PLAYER: 'player',
  DEALER: 'dealer',
  SETTLED: 'settled',
  BROKE: 'broke',
};

/** A brand-new game, sitting on the title screen. */
export function createGame(seed = liveSeed()) {
  return {
    rng: makeRng(seed),
    seed,
    phase: PHASE.TITLE,
    bankroll: START_BANKROLL,
    best: START_BANKROLL,
    bet: 0,
    pairBet: false,
    peeked: false,
    pairWin: 0,
    streak: 0,
    round: 0,
    lastBet: 0,
    shoe: [],
    player: [],
    dealer: [],
    message: '',
    result: null,
    dealt: [],
  };
}

function draw(game) {
  return game.shoe.pop();
}

function ensureShoe(game) {
  if (game.shoe.length < RESHUFFLE_AT) {
    game.shoe = buildShoe(DECKS, game.rng);
    return true;
  }
  return false;
}

/** Leave the title screen and open the betting table. */
export function startPlay(game) {
  if (game.phase !== PHASE.TITLE) return { ok: false };
  game.phase = PHASE.BETTING;
  game.message = 'Place your bet';
  return { ok: true };
}

/** Add chips to the pending bet (betting phase only). Amount is clamped to the bankroll. */
export function placeBet(game, amount) {
  if (game.phase !== PHASE.BETTING) return { ok: false };
  const room = game.bankroll - game.bet;
  const added = Math.max(0, Math.min(amount, room));
  if (added <= 0) return { ok: false, reason: 'no-chips' };
  game.bet += added;
  game.message = `Bet ${game.bet}`;
  return { ok: true, added };
}

/** Put everything back: pending bet returns to zero (betting phase only). */
export function clearBet(game) {
  if (game.phase !== PHASE.BETTING) return { ok: false };
  game.bet = 0;
  game.message = 'Place your bet';
  return { ok: true };
}

/** Arm or disarm the Miaw Pair side bet for the coming deal. */
export function togglePair(game) {
  if (game.phase !== PHASE.BETTING) return { ok: false };
  game.pairBet = !game.pairBet;
  return { ok: true, pairBet: game.pairBet };
}

/** Repeat the previous round's bet amount (betting phase only). */
export function repeatBet(game) {
  if (game.phase !== PHASE.BETTING) return { ok: false };
  if (game.lastBet <= 0) return { ok: false, reason: 'no-last-bet' };
  game.bet = Math.min(game.lastBet, game.bankroll);
  game.message = `Bet ${game.bet}`;
  return { ok: true, bet: game.bet };
}

/** Settle the Miaw Pair side bet right after the deal. Returns the profit. */
function settlePair(game) {
  if (!game.pairBet) return 0;
  let profit = 0;
  if (isSuitedPair(game.player)) profit = PAIR_COST * SUITED_PAIR_PAY;
  else if (isPair(game.player)) profit = PAIR_COST * PAIR_PAY;
  if (profit > 0) {
    game.pairWin = profit;
    game.bankroll += PAIR_COST + profit;
  }
  return profit;
}

function revealHole(game) {
  if (game.dealer[1]) game.dealer[1].faceUp = true;
}

function settleBlackjacks(game) {
  const playerBj = isBlackjack(game.player);
  const dealerBj = isBlackjack(game.dealer);
  if (!playerBj && !dealerBj) return null;
  revealHole(game);
  if (playerBj && dealerBj) {
    game.bankroll += game.bet;
    return finish(game, 'push', 'Both blackjack — push');
  }
  if (playerBj) {
    const profit = Math.floor((game.bet * 3) / 2);
    game.bankroll += game.bet + profit;
    game.streak += 1;
    game.best = Math.max(game.best, game.bankroll);
    return finish(game, 'blackjack', `BLACKJACK! +${profit}`);
  }
  return finish(game, 'lose', 'Dealer blackjack');
}

function finish(game, result, message) {
  game.phase = PHASE.SETTLED;
  game.result = result;
  game.message = message;
  return { ok: true, result, message };
}

/** Deal a round: take the bet, deal two cards each, settle pairs and blackjacks. */
export function deal(game) {
  if (game.phase !== PHASE.BETTING) return { ok: false };
  if (game.bet <= 0) return { ok: false, reason: 'no-bet' };
  const sideCost = game.pairBet ? PAIR_COST : 0;
  if (game.bankroll < game.bet + sideCost) return { ok: false, reason: 'short' };
  game.bankroll -= game.bet + sideCost;
  game.lastBet = game.bet;
  game.round += 1;
  game.pairWin = 0;
  game.peeked = false;
  game.player = [];
  game.dealer = [];
  game.result = null;
  game.dealt = [];
  const reshuffled = ensureShoe(game);
  const order = ['player', 'dealer', 'player', 'dealer'];
  for (const who of order) {
    const card = draw(game);
    if (who === 'dealer' && game.dealer.length === 1) card.faceUp = false;
    if (who === 'player') game.player.push(card);
    else game.dealer.push(card);
    game.dealt.push({ who, card });
  }
  game.phase = PHASE.PLAYER;
  game.message = 'Your move — Hit or Stand';
  const pairProfit = settlePair(game);
  if (pairProfit > 0) game.message = `Miaw Pair pays +${pairProfit}!`;
  const bj = settleBlackjacks(game);
  if (bj) return { ...bj, reshuffled, pairProfit };
  return { ok: true, reshuffled, pairProfit };
}

/** Take one more card. A bust settles the round as a loss at once. */
export function hit(game) {
  if (game.phase !== PHASE.PLAYER) return { ok: false };
  const card = draw(game);
  game.player.push(card);
  game.dealt.push({ who: 'player', card });
  const value = handValue(game.player);
  if (value.bust) {
    game.streak = 0;
    return finish(game, 'bust', `Bust at ${value.total}`);
  }
  return { ok: true, card, value };
}

/** Pay 10 to turn the dealer's hole card face up for the rest of the round. */
export function peek(game) {
  if (game.phase !== PHASE.PLAYER) return { ok: false };
  if (game.peeked) return { ok: false, reason: 'already' };
  if (game.bankroll < PEEK_COST) return { ok: false, reason: 'short' };
  game.bankroll -= PEEK_COST;
  game.peeked = true;
  revealHole(game);
  game.message = 'Peeked! Hole card revealed';
  return { ok: true };
}

/** Double the bet, take exactly one card, then the dealer plays. */
export function doubleDown(game) {
  if (game.phase !== PHASE.PLAYER) return { ok: false };
  if (game.player.length !== 2) return { ok: false, reason: 'too-late' };
  if (game.bankroll < game.bet) return { ok: false, reason: 'short' };
  game.bankroll -= game.bet;
  game.bet *= 2;
  const card = draw(game);
  game.player.push(card);
  game.dealt.push({ who: 'player', card });
  if (handValue(game.player).bust) {
    game.streak = 0;
    return finish(game, 'bust', `Bust at ${handValue(game.player).total}`);
  }
  return dealerPlay(game);
}

/** Stand: the dealer reveals and draws to 17, then the round settles. */
export function stand(game) {
  if (game.phase !== PHASE.PLAYER) return { ok: false };
  return dealerPlay(game);
}

function dealerPlay(game) {
  game.phase = PHASE.DEALER;
  revealHole(game);
  while (handValue(game.dealer).total < 17) {
    const card = draw(game);
    game.dealer.push(card);
    game.dealt.push({ who: 'dealer', card });
  }
  const pv = handValue(game.player);
  const dv = handValue(game.dealer);
  if (dv.bust) {
    game.bankroll += game.bet * 2;
    game.streak += 1;
    game.best = Math.max(game.best, game.bankroll);
    return finish(game, 'win', `Dealer busts at ${dv.total} — you win +${game.bet}`);
  }
  if (pv.total > dv.total) {
    game.bankroll += game.bet * 2;
    game.streak += 1;
    game.best = Math.max(game.best, game.bankroll);
    return finish(game, 'win', `${pv.total} beats ${dv.total} — you win +${game.bet}`);
  }
  if (pv.total === dv.total) {
    game.bankroll += game.bet;
    return finish(game, 'push', `Push at ${pv.total}`);
  }
  game.streak = 0;
  return finish(game, 'lose', `${dv.total} beats ${pv.total} — dealer wins`);
}

/** Open a fresh betting round, or the broke screen when the bankroll is empty. */
export function newRound(game) {
  if (game.bankroll <= 0) {
    game.phase = PHASE.BROKE;
    game.message = 'Out of chips';
    return { ok: true, broke: true };
  }
  game.bet = 0;
  game.pairBet = false;
  game.peeked = false;
  game.pairWin = 0;
  game.player = [];
  game.dealer = [];
  game.result = null;
  game.message = 'Place your bet';
  game.phase = PHASE.BETTING;
  return { ok: true };
}

/** A small read-only summary for debugging and tests. */
export function summary(game) {
  return {
    phase: game.phase,
    bankroll: game.bankroll,
    bet: game.bet,
    round: game.round,
    streak: game.streak,
    player: game.player.length ? handValue(game.player) : null,
    dealer: game.dealer.length ? handValue(game.dealer) : null,
    shoe: game.shoe.length,
  };
}

/** Reset everything to a fresh 1000-chip bankroll. */
export function restart(game) {
  game.bankroll = START_BANKROLL;
  game.best = START_BANKROLL;
  game.streak = 0;
  game.round = 0;
  game.lastBet = 0;
  game.shoe = [];
  return newRound(game);
}
