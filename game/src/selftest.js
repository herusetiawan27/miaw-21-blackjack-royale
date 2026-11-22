// Engine assertions, runnable in the browser (?selftest=1) and in Node. No DOM in here:
// the game logic is pure, so the same checks run in both places.

import { createRandom } from './random.js';
import { buildShoe, dealerShouldHit, handValue, isBlackjack, isPair, isSuitedPair } from './deck.js';
import { createGame } from './game.js';

const C = (rank, suit = 'S') => ({ rank, suit, glyph: '♠', red: false });

export function runSelfTest() {
  const failures = [];
  const check = (name, cond) => {
    if (!cond) failures.push(name);
  };

  // Hand values.
  check('ace+king is 21 soft', JSON.stringify(handValue([C('A'), C('K')])) === JSON.stringify({ total: 21, soft: true }));
  check('ace+9+ace is soft 21', handValue([C('A'), C('9'), C('A')]).total === 21);
  check('ace+9+5 is hard 15', JSON.stringify(handValue([C('A'), C('9'), C('5')])) === JSON.stringify({ total: 15, soft: false }));
  check('king+queen+2 busts at 22', handValue([C('K'), C('Q'), C('2')]).total === 22);
  check('ace+ace is soft 12', JSON.stringify(handValue([C('A'), C('A')])) === JSON.stringify({ total: 12, soft: true }));
  check('blackjack detected', isBlackjack([C('A'), C('J')]) === true);
  check('21 with 3 cards is not blackjack', isBlackjack([C('7'), C('7'), C('7')]) === false);
  check('pair detected', isPair([C('8'), C('8', 'H')]) === true);
  check('suited pair detected', isSuitedPair([C('8'), C('8')]) === true);
  check('mixed pair is not suited', isSuitedPair([C('8'), C('8', 'H')]) === false);
  check('dealer hits 16', dealerShouldHit([C('K'), C('6')]) === true);
  check('dealer stands soft 17', dealerShouldHit([C('A'), C('6')]) === false);
  check('dealer stands hard 17', dealerShouldHit([C('K'), C('7')]) === false);

  // Shoe: 2 decks, 104 cards, 8 aces, 32 ten-values, shuffled deterministically.
  const shoe = buildShoe(createRandom(1), 2);
  check('shoe has 104 cards', shoe.length === 104);
  check('shoe has 8 aces', shoe.filter((c) => c.rank === 'A').length === 8);
  check('shoe has 32 ten-values', shoe.filter((c) => ['10', 'J', 'Q', 'K'].includes(c.rank)).length === 32);
  const shoe2 = buildShoe(createRandom(1), 2);
  check('same seed shuffles the same', JSON.stringify(shoe) === JSON.stringify(shoe2));
  const shoe3 = buildShoe(createRandom(2), 2);
  check('different seed shuffles differently', JSON.stringify(shoe) !== JSON.stringify(shoe3));

  // Full rounds with a fixed seed: bankroll math must balance. No persistence here,
  // so the self-test never pollutes the saved stats a real player sees.
  const game = createGame(createRandom(7), { persist: false });
  game.start();
  let settled = 0;
  for (let round = 0; round < 200 && game.state.phase !== 'gameover'; round += 1) {
    if (game.state.phase !== 'betting') break;
    const before = game.state.bankroll;
    const bet = Math.min(50, before);
    game.addChip(bet);
    if (!game.deal()) break;
    let guard = 0;
    while (game.state.phase === 'player' && guard < 12) {
      guard += 1;
      if (handValue(game.state.playerHand).total < 17) game.hit();
      else game.stand();
    }
    if (game.state.phase === 'settle') {
      settled += 1;
      const amount = game.state.result.amount;
      // Net win/loss: the bet was reserved at chip time, so bankroll must equal
      // before + amount (win returns stake + winnings, push returns the stake).
      check('settle amount matches bankroll change', game.state.bankroll === before + amount);
      game.nextRound();
    } else {
      break;
    }
  }
  check('many rounds settled', settled > 50);
  check('stats hands match settled rounds', game.state.stats.hands >= settled);
  check('bankroll never negative', game.state.bankroll >= 0);

  // Double: bet doubles, exactly one card, then the dealer plays.
  const g2 = createGame(createRandom(11), { persist: false });
  g2.start();
  g2.addChip(50);
  g2.deal();
  if (g2.state.phase === 'player') {
    const before = g2.state.bankroll;
    const doubled = g2.double();
    check('double succeeds on first two cards', doubled === true);
    check('double costs the bet again', g2.state.bankroll === before - 50);
    check('bet doubled', g2.state.bet === 100);
    check('double ends the player turn', g2.state.phase !== 'player');
  }

  // Peek: costs 10, reveals the hole card, once per round.
  const g3 = createGame(createRandom(13), { persist: false });
  g3.start();
  g3.addChip(50);
  g3.deal();
  if (g3.state.phase === 'player') {
    const before = g3.state.bankroll;
    check('peek succeeds', g3.peek() === true);
    check('peek costs 10', g3.state.bankroll === before - 10);
    check('hole card revealed', g3.state.dealerHoleHidden === false);
    check('second peek refused', g3.peek() === false);
  }

  // Repeat: re-places the previous round's bet, refused when there is none.
  const g4 = createGame(createRandom(17), { persist: false });
  g4.start();
  check('repeat refused with no last bet', g4.repeatBet() === false);
  g4.addChip(50);
  g4.deal();
  let guard = 0;
  while (g4.state.phase === 'player' && guard < 12) {
    guard += 1;
    if (handValue(g4.state.playerHand).total < 17) g4.hit();
    else g4.stand();
  }
  if (g4.state.phase === 'settle') {
    g4.nextRound();
    if (g4.state.phase === 'betting') {
      const before = g4.state.bankroll;
      check('repeat places last bet', g4.repeatBet() === true);
      check('repeat bet is 50', g4.state.bet === 50);
      check('repeat costs the bet', g4.state.bankroll === before - 50);
      check('second repeat adds again', g4.repeatBet() === true && g4.state.bet === 100);
    }
  }

  return {
    pass: failures.length === 0,
    text: failures.length === 0 ? 'SELFTEST PASS' : `SELFTEST FAIL: ${failures.join(' | ')}`,
  };
}
