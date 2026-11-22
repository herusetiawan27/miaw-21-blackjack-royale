// The game's rules and state, with no drawing and no browser in it: the shoe, the bankroll,
// the bets, the phases and the payouts. Every action is a plain method call; the caller
// re-renders after each one. Nothing here allocates after createGame returns.

import {
  BEST_KEY,
  BLACKJACK_PAYS_DEN,
  BLACKJACK_PAYS_NUM,
  DECKS,
  MIN_BET,
  PAIR_PAYS,
  PEEK_COST,
  RESHUFFLE_AT,
  SIDE_BET,
  START_BANKROLL,
  STATS_KEY,
  SUITED_PAIR_PAYS,
} from './config.js';
import { buildShoe, dealerShouldHit, handValue, isBlackjack, isPair, isSuitedPair } from './deck.js';

export const PHASE_TITLE = 'title';
export const PHASE_BETTING = 'betting';
export const PHASE_PLAYER = 'player';
export const PHASE_DEALER = 'dealer';
export const PHASE_SETTLE = 'settle';
export const PHASE_GAMEOVER = 'gameover';

export function createGame(random, options = {}) {
  const persist = options.persist !== false;
  const state = {
    phase: PHASE_TITLE,
    paused: false,
    muted: false,
    bankroll: START_BANKROLL,
    bet: 0,
    lastBet: 0,
    sideBet: 0,
    sideBetOn: false,
    peeked: false,
    playerHand: [],
    dealerHand: [],
    dealerHoleHidden: true,
    shoe: [],
    round: 0,
    result: null,
    message: '',
    streak: 0,
    stats: { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, pairs: 0, peeks: 0, best: START_BANKROLL },
  };

  function loadSaved() {
    if (!persist) return;
    try {
      const best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '', 10);
      if (Number.isInteger(best) && best > 0) state.stats.best = best;
      const saved = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? 'null');
      if (saved && typeof saved === 'object') {
        for (const key of ['hands', 'wins', 'losses', 'pushes', 'blackjacks', 'pairs', 'peeks']) {
          if (Number.isInteger(saved[key])) state.stats[key] = saved[key];
        }
      }
    } catch {
      // Storage can be off (private windows): stats then last this visit only.
    }
  }

  function save() {
    if (!persist) return;
    try {
      window.localStorage.setItem(BEST_KEY, String(state.stats.best));
      window.localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
    } catch {
      // Ignore storage failures.
    }
  }

  function freshShoe() {
    state.shoe = buildShoe(random, DECKS);
  }

  function draw() {
    if (state.shoe.length === 0) freshShoe();
    return state.shoe.pop();
  }

  function note(text) {
    state.message = text;
  }

  function settle(kind, text, amount) {
    // amount: net chips won (+) or lost (-) this round, excluding the returned stake.
    // The bet was reserved when the chips were placed, so a win returns stake + winnings.
    state.result = { kind, text, amount };
    state.phase = PHASE_SETTLE;
    note(text);
    if (amount > 0) {
      state.streak += 1;
      state.stats.wins += 1;
      if (kind === 'blackjack') state.stats.blackjacks += 1;
    } else if (amount < 0) {
      state.streak = 0;
      state.stats.losses += 1;
    } else {
      state.stats.pushes += 1;
    }
    state.stats.best = Math.max(state.stats.best, state.bankroll);
    save();
  }

  function finishRound() {
    if (state.bankroll < MIN_BET) {
      state.phase = PHASE_GAMEOVER;
      note('Out of chips! Your best bankroll was ' + state.stats.best + '.');
    } else {
      state.phase = PHASE_BETTING;
      state.bet = 0;
      state.sideBet = 0;
      state.peeked = false;
      state.dealerHoleHidden = true;
      state.playerHand = [];
      state.dealerHand = [];
      note('Place your bet for the next round.');
    }
  }

  function evaluateSideBet() {
    if (state.sideBet <= 0) return;
    if (isPair(state.playerHand)) {
      const suited = isSuitedPair(state.playerHand);
      const winnings = state.sideBet * (suited ? SUITED_PAIR_PAYS : PAIR_PAYS);
      state.bankroll += state.sideBet + winnings;
      state.stats.pairs += 1;
      note(
        suited
          ? `Suited pair! Miaw Pair pays ${SUITED_PAIR_PAYS} to 1 (+${winnings}).`
          : `A pair! Miaw Pair pays ${PAIR_PAYS} to 1 (+${winnings}).`,
      );
    }
  }

  function dealerPlay() {
    state.dealerHoleHidden = false;
    state.phase = PHASE_DEALER;
    while (dealerShouldHit(state.dealerHand)) state.dealerHand.push(draw());
    const player = handValue(state.playerHand).total;
    const dealer = handValue(state.dealerHand).total;
    if (dealer > 21) {
      state.bankroll += state.bet * 2;
      settle('dealer-bust', `Dealer busts with ${dealer}! You win ${state.bet}.`, state.bet);
    } else if (dealer > player) {
      settle('lose', `Dealer ${dealer} beats your ${player}.`, -state.bet);
    } else if (dealer < player) {
      state.bankroll += state.bet * 2;
      settle('win', `You ${player} beat dealer ${dealer}! You win ${state.bet}.`, state.bet);
    } else {
      state.bankroll += state.bet;
      settle('push', `Push — both have ${player}. Your bet is returned.`, 0);
    }
  }

  const game = {
    state,

    start() {
      freshShoe();
      state.bankroll = START_BANKROLL;
      state.bet = 0;
      state.lastBet = 0;
      state.sideBet = 0;
      state.sideBetOn = false;
      state.peeked = false;
      state.playerHand = [];
      state.dealerHand = [];
      state.dealerHoleHidden = true;
      state.round = 0;
      state.result = null;
      state.streak = 0;
      state.phase = PHASE_BETTING;
      note('Place your bet, then press Deal.');
    },

    toTitle() {
      state.phase = PHASE_TITLE;
      state.paused = false;
      state.result = null;
      note('');
    },

    /** Title-screen backdrop: a fixed demo deal, no betting involved. */
    demoDeal() {
      freshShoe();
      state.playerHand = [
        { rank: 'K', suit: 'H', glyph: '♥', red: true },
        { rank: 'Q', suit: 'D', glyph: '♦', red: true },
      ];
      state.dealerHand = [
        { rank: 'A', suit: 'S', glyph: '♠', red: false },
        { rank: '7', suit: 'C', glyph: '♣', red: false },
      ];
      state.dealerHoleHidden = true;
      state.bet = 0;
    },

    addChip(amount) {
      if (state.phase !== PHASE_BETTING) return false;
      const value = amount === 'max' ? state.bankroll : amount;
      if (value <= 0 || state.bankroll < value) return false;
      state.bankroll -= value;
      state.bet += value;
      note(`Bet ${state.bet}. Press Deal when ready.`);
      return true;
    },

    clearBet() {
      if (state.phase !== PHASE_BETTING) return false;
      state.bankroll += state.bet;
      state.bet = 0;
      note('Bet cleared.');
      return true;
    },

    /** Place the previous round's bet again (the casino "repeat bet" button). */
    repeatBet() {
      if (state.phase !== PHASE_BETTING) return false;
      if (state.lastBet <= 0) {
        note('No previous bet to repeat.');
        return false;
      }
      if (state.bankroll < state.lastBet) {
        note('Not enough chips to repeat the last bet.');
        return false;
      }
      state.bankroll -= state.lastBet;
      state.bet += state.lastBet;
      note(`Bet ${state.bet} (repeated ${state.lastBet}). Press Deal when ready.`);
      return true;
    },

    toggleSideBet() {
      if (state.phase !== PHASE_BETTING) return false;
      state.sideBetOn = !state.sideBetOn;
      note(
        state.sideBetOn
          ? `Miaw Pair on: ${SIDE_BET} chips ride on your first two cards being a pair.`
          : 'Miaw Pair off.',
      );
      return true;
    },

    deal() {
      if (state.phase !== PHASE_BETTING || state.bet < MIN_BET) return false;
      if (state.shoe.length < RESHUFFLE_AT) {
        freshShoe();
        note('Shuffling a fresh shoe…');
      }
      state.round += 1;
      state.stats.hands += 1;
      state.result = null;
      state.peeked = false;
      state.lastBet = state.bet;
      if (state.sideBetOn && state.bankroll >= SIDE_BET) {
        state.bankroll -= SIDE_BET;
        state.sideBet = SIDE_BET;
      } else {
        state.sideBet = 0;
      }
      state.playerHand = [draw(), draw()];
      state.dealerHand = [draw(), draw()];
      state.dealerHoleHidden = true;
      state.phase = PHASE_PLAYER;
      evaluateSideBet();
      const dealerBJ = isBlackjack(state.dealerHand);
      const playerBJ = isBlackjack(state.playerHand);
      if (dealerBJ) {
        state.dealerHoleHidden = false;
        if (playerBJ) {
          state.bankroll += state.bet;
          settle('push', 'Both have Blackjack — push.', 0);
        } else {
          settle('dealer-blackjack', 'Dealer has Blackjack.', -state.bet);
        }
        return true;
      }
      if (playerBJ) {
        const winnings = Math.floor((state.bet * BLACKJACK_PAYS_NUM) / BLACKJACK_PAYS_DEN);
        state.bankroll += state.bet + winnings;
        settle('blackjack', `BLACKJACK! You win ${winnings}.`, winnings);
        return true;
      }
      if (!state.message.startsWith('A pair') && !state.message.startsWith('Suited pair')) {
        note('Your move: Hit, Stand, Double, or Peek at the hole card.');
      }
      return true;
    },

    hit() {
      if (state.phase !== PHASE_PLAYER) return false;
      state.playerHand.push(draw());
      const { total } = handValue(state.playerHand);
      if (total > 21) {
        state.dealerHoleHidden = false;
        settle('bust', `Bust! You went over 21 with ${total}.`, -state.bet);
      } else if (total === 21) {
        note('21! Dealer plays.');
        dealerPlay();
      }
      return true;
    },

    stand() {
      if (state.phase !== PHASE_PLAYER) return false;
      dealerPlay();
      return true;
    },

    double() {
      if (state.phase !== PHASE_PLAYER || state.playerHand.length !== 2) return false;
      if (state.bankroll < state.bet) {
        note('Not enough chips to double.');
        return false;
      }
      state.bankroll -= state.bet;
      state.bet *= 2;
      state.playerHand.push(draw());
      const { total } = handValue(state.playerHand);
      if (total > 21) {
        state.dealerHoleHidden = false;
        settle('bust', `Bust after doubling with ${total}.`, -state.bet);
      } else {
        dealerPlay();
      }
      return true;
    },

    peek() {
      if (state.phase !== PHASE_PLAYER || state.peeked) return false;
      if (state.bankroll < PEEK_COST) {
        note(`Peek costs ${PEEK_COST} chips — not enough.`);
        return false;
      }
      state.bankroll -= PEEK_COST;
      state.peeked = true;
      state.stats.peeks += 1;
      state.dealerHoleHidden = false;
      save();
      note(`You peek: dealer is showing ${handValue(state.dealerHand).total}.`);
      return true;
    },

    nextRound() {
      if (state.phase !== PHASE_SETTLE) return false;
      state.result = null;
      finishRound();
      return true;
    },

    newGame() {
      game.start();
      return true;
    },

    togglePause() {
      if (state.phase === PHASE_TITLE || state.phase === PHASE_GAMEOVER) return false;
      state.paused = !state.paused;
      return true;
    },

    toggleMute() {
      state.muted = !state.muted;
      return state.muted;
    },
  };

  loadSaved();
  return game;
}
