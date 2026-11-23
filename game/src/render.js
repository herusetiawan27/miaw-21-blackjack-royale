// Rendering for Miaw 21: plain DOM, no canvas. Cards are divs so the pips stay
// crisp at any size; the juice comes from CSS — cards fly in from the shoe,
// the hole card flips in 3D, wins burst confetti and float their text, losses
// flash the table red. The renderer is stateless except for a small `ui`
// object that remembers which cards have already flown in, so a re-render
// never replays an animation.

import { cardColor, handLabel, handValue } from './cards.js';
import { PHASE } from './engine.js';

const $ = (id) => document.getElementById(id);

function cardFace(card) {
  const el = document.createElement('div');
  el.className = `card ${cardColor(card)}`;
  const top = document.createElement('div');
  top.className = 'corner top';
  top.textContent = `${card.rank}\n${card.suit}`;
  const mid = document.createElement('div');
  mid.className = 'pip';
  mid.textContent = card.suit;
  const bot = document.createElement('div');
  bot.className = 'corner bottom';
  bot.textContent = `${card.rank}\n${card.suit}`;
  el.append(top, mid, bot);
  return el;
}

function holeCard(card, justFlipped) {
  const wrap = document.createElement('div');
  wrap.className = `card flip${justFlipped ? ' flip-in' : ''}${card.faceUp ? ' flipped' : ''}`;
  const inner = document.createElement('div');
  inner.className = 'card-inner';
  const back = document.createElement('div');
  back.className = 'card-face card-back';
  back.innerHTML = '<span class="back-mark">🐾</span>';
  const front = document.createElement('div');
  front.className = 'card-face card-front';
  front.appendChild(cardFace(card));
  inner.append(back, front);
  wrap.appendChild(inner);
  return wrap;
}

/** Fresh per-session UI memory: what has already been animated. */
export function createUi() {
  return {
    playerShown: 0,
    dealerShown: 0,
    holeHidden: true,
    lastResult: null,
    lastRound: -1,
  };
}

function renderHand(container, cards, ui, who, justFlippedHole) {
  container.innerHTML = '';
  const shownKey = who === 'player' ? 'playerShown' : 'dealerShown';
  const shown = ui[shownKey];
  cards.forEach((card, index) => {
    let el;
    if (who === 'dealer' && index === 1) {
      el = holeCard(card, justFlippedHole && index === 1);
    } else {
      el = cardFace(card);
    }
    if (index >= shown) {
      el.classList.add('deal-in');
      el.style.animationDelay = `${index * 150}ms`;
    }
    container.appendChild(el);
  });
  ui[shownKey] = cards.length;
}

function valueText(cards, hideHole) {
  if (cards.length === 0) return '';
  if (hideHole) {
    const up = handValue([cards[0]]);
    return `${up.total} + ?`;
  }
  return handLabel(cards);
}

function setEnabled(id, on) {
  const el = $(id);
  if (el) el.disabled = !on;
}

/** Burst of falling confetti pieces over the table. */
export function spawnConfetti(count = 80) {
  const layer = $('confetti');
  if (!layer) return;
  const colors = ['#ffd34d', '#ff5d8f', '#4dd7ff', '#7dff8a', '#c77dff', '#ffffff'];
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
  }
  window.setTimeout(() => {
    layer.innerHTML = '';
  }, 3400);
}

/** Big centre text that rises and fades (win amounts, BLACKJACK, ...). */
export function showFloat(text) {
  const el = $('float-text');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}

/** A quick red wash over the table when the round is lost. */
export function flashRed() {
  const el = $('flash');
  if (!el) return;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}

/** Full re-render of the table from the engine state. */
export function render(game, ui) {
  if (game.round !== ui.lastRound) {
    ui.playerShown = 0;
    ui.dealerShown = 0;
    ui.holeHidden = true;
    ui.lastRound = game.round;
  }
  const holeHiddenNow = game.dealer.length > 1 && !game.dealer[1].faceUp;
  const justFlippedHole = ui.holeHidden && !holeHiddenNow;
  ui.holeHidden = holeHiddenNow;

  $('bankroll').textContent = game.bankroll;
  $('best').textContent = game.best;
  $('title-best').textContent = game.best;
  $('streak-count').textContent = game.streak;
  $('streak-pill').classList.toggle('hot', game.streak >= 3);
  $('shoe-count').textContent = game.shoe.length;
  $('round-label').textContent = game.round > 0 ? `Round ${game.round}` : 'Miaw 21';
  $('bet-amount').textContent = game.bet;
  $('bet-circle').classList.toggle('armed', game.bet > 0);
  $('pair-btn').classList.toggle('on', game.pairBet);
  $('pair-btn').textContent = game.pairBet ? 'Miaw Pair ✓ (10)' : 'Miaw Pair (10)';
  $('message').textContent = game.message;

  renderHand($('dealer-cards'), game.dealer, ui, 'dealer', justFlippedHole);
  renderHand($('player-cards'), game.player, ui, 'player', false);
  $('dealer-value').textContent = valueText(game.dealer, holeHiddenNow);
  $('player-value').textContent = valueText(game.player, false);
  $('dealer-value').style.visibility = game.dealer.length ? 'visible' : 'hidden';
  $('player-value').style.visibility = game.player.length ? 'visible' : 'hidden';

  const betting = game.phase === PHASE.BETTING;
  const playing = game.phase === PHASE.PLAYER;
  const settled = game.phase === PHASE.SETTLED;
  document.querySelectorAll('#chips .chip').forEach((chip) => {
    chip.disabled = !betting || game.bankroll <= game.bet;
  });
  setEnabled('deal-btn', betting && game.bet > 0);
  setEnabled('clear-btn', betting && game.bet > 0);
  setEnabled('repeat-btn', betting && game.lastBet > 0);
  setEnabled('pair-btn', betting);
  setEnabled('hit-btn', playing);
  setEnabled('stand-btn', playing);
  setEnabled('double-btn', playing && game.player.length === 2 && game.bankroll >= game.bet);
  setEnabled('peek-btn', playing && !game.peeked && game.bankroll >= 10);
  setEnabled('next-btn', settled);
  $('title').classList.toggle('hidden', game.phase !== PHASE.TITLE);
  $('broke').classList.toggle('hidden', game.phase !== PHASE.BROKE);
  $('table').classList.toggle('dim', game.phase === PHASE.TITLE || game.phase === PHASE.BROKE);

  if (game.result && game.result !== ui.lastResult) {
    if (game.result === 'win' || game.result === 'blackjack') {
      spawnConfetti(game.result === 'blackjack' ? 120 : 70);
      showFloat(game.result === 'blackjack' ? 'BLACKJACK! 🎉' : `YOU WIN +${game.bet}`);
    } else if (game.result === 'lose' || game.result === 'bust') {
      flashRed();
      showFloat(game.result === 'bust' ? 'BUST!' : 'DEALER WINS');
    } else if (game.result === 'push') {
      showFloat('PUSH');
    }
  }
  ui.lastResult = game.result;
}
