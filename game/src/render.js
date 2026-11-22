// Drawing only: the game's state in, pixels out. Cards are DOM nodes (crisp rank and suit),
// the table is CSS, and buttons are real buttons so mouse and keyboard both work.
// A card animates in only the first time its key is seen, so a Hit does not replay the deal.

import { CHIPS, MIN_BET, PEEK_COST, SIDE_BET } from './config.js';
import { handLabel, handValue, isPair } from './deck.js';
import { PHASE_BETTING, PHASE_GAMEOVER, PHASE_PLAYER, PHASE_SETTLE, PHASE_TITLE } from './game.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function chipClass(value) {
  if (value >= 100) return 'chip black';
  if (value >= 50) return 'chip green';
  if (value >= 20) return 'chip blue';
  return 'chip white';
}

function chipBreakdown(amount) {
  const out = [];
  let rest = amount;
  for (const denom of [100, 50, 20, 10]) {
    while (rest >= denom) {
      out.push(denom);
      rest -= denom;
    }
  }
  return out;
}

export function createRenderer(root) {
  const $ = (id) => root.querySelector('#' + id);
  const els = {
    felt: $('felt'),
    shoeCount: $('shoe-count'),
    streakItem: $('streak-item'),
    fx: $('fx'),
    bankroll: $('bankroll'),
    betDisplay: $('bet-display'),
    best: $('best'),
    streak: $('streak'),
    record: $('record'),
    dealerCards: $('dealer-cards'),
    dealerTotal: $('dealer-total'),
    playerCards: $('player-cards'),
    playerTotal: $('player-total'),
    message: $('message'),
    banner: $('result-banner'),
    betSpot: $('bet-spot'),
    betChips: $('bet-chips'),
    betAmount: $('bet-amount'),
    controls: $('controls'),
    titleScreen: $('title-screen'),
    pauseScreen: $('pause-screen'),
    overScreen: $('over-screen'),
    overStats: $('over-stats'),
    titleBest: $('title-best'),
    muteBtn: $('mute-btn'),
  };

  let prevKeys = new Set();
  let prevRound = -1;
  let prevHoleHidden = true;
  let prevBet = 0;
  let lastResultSig = '';

  const CONFETTI_COLORS = ['#f2c94c', '#2ecc71', '#e74c3c', '#ffffff', '#4f8ff7', '#ff8fd1'];

  function spawnConfetti(count) {
    if (document.body.classList.contains('shot')) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('div');
      piece.className = 'confetti';
      const size = 6 + Math.floor(Math.random() * 7);
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * 0.6}px`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = `${1.1 + Math.random() * 0.7}s`;
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      frag.appendChild(piece);
    }
    els.fx.appendChild(frag);
    window.setTimeout(() => { els.fx.replaceChildren(); }, 2200);
  }

  function floatWin(text) {
    if (document.body.classList.contains('shot')) return;
    const div = document.createElement('div');
    div.className = 'float-win';
    div.textContent = text;
    div.addEventListener('animationend', () => div.remove());
    els.fx.appendChild(div);
  }

  function flashLose() {
    if (document.body.classList.contains('shot')) return;
    els.felt.classList.remove('flash-lose');
    void els.felt.offsetWidth; // restart the flash animation
    els.felt.classList.add('flash-lose');
    window.setTimeout(() => els.felt.classList.remove('flash-lose'), 550);
  }

  function cardEl(card, key, index, hidden, opts = {}) {
    const div = document.createElement('div');
    if (hidden) {
      div.className = 'card back';
      div.innerHTML = '<div class="back-mark">MIAW<br>21</div>';
    } else {
      div.className = 'card' + (card.red ? ' red' : '');
      div.innerHTML =
        `<div class="corner top"><span class="rank">${card.rank}</span><span class="suit">${card.glyph}</span></div>` +
        `<div class="pip">${card.glyph}</div>` +
        `<div class="corner bottom"><span class="rank">${card.rank}</span><span class="suit">${card.glyph}</span></div>`;
    }
    if (opts.peekReveal) div.classList.add('peek-reveal');
    if (opts.flip) {
      div.classList.add('flip-in');
    } else if (!prevKeys.has(key)) {
      div.classList.add('deal-in');
      div.style.animationDelay = `${index * 90}ms`;
    }
    return div;
  }

  function drawHand(container, hand, hideHole, roundKey, opts = {}) {
    const keys = [];
    const frag = document.createDocumentFragment();
    hand.forEach((card, index) => {
      const hidden = hideHole && index === 1;
      const key = `${roundKey}-${index}-${hidden ? 'back' : card.rank + card.suit}`;
      keys.push(key);
      frag.appendChild(
        cardEl(card, key, index, hidden, {
          flip: opts.flipIndex === index,
          peekReveal: opts.peekIndex === index,
        }),
      );
    });
    container.replaceChildren(frag);
    return keys;
  }

  function button(action, label, opts = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.action = action;
    btn.textContent = label;
    btn.className = 'btn' + (opts.primary ? ' primary' : '') + (opts.gold ? ' gold' : '');
    if (opts.disabled) btn.disabled = true;
    if (opts.title) btn.title = opts.title;
    return btn;
  }

  function drawControls(state) {
    const c = els.controls;
    c.replaceChildren();
    if (state.phase === PHASE_BETTING) {
      const row = document.createElement('div');
      row.className = 'controls-row';
      for (const value of CHIPS) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.dataset.action = 'chip';
        chip.dataset.value = String(value);
        chip.className = chipClass(value);
        chip.textContent = String(value);
        chip.disabled = state.bankroll < value;
        chip.title = `Add ${value} to your bet`;
        row.appendChild(chip);
      }
      const max = document.createElement('button');
      max.type = 'button';
      max.dataset.action = 'chip';
      max.dataset.value = 'max';
      max.className = 'chip redchip';
      max.textContent = 'MAX';
      max.disabled = state.bankroll <= 0;
      max.title = 'Bet everything';
      row.appendChild(max);
      const clear = button('clear', 'Clear', { title: 'Take your bet back (C)' });
      clear.disabled = state.bet === 0;
      row.appendChild(clear);
      const repeat = button('repeat', state.lastBet > 0 ? `Repeat ${state.lastBet}` : 'Repeat', {
        title: 'Place your last bet again (B)',
      });
      repeat.disabled = state.lastBet <= 0 || state.bankroll < state.lastBet;
      row.appendChild(repeat);
      const pair = button('sidebet', state.sideBetOn ? 'Miaw Pair: ON' : 'Miaw Pair: OFF', {
        title: `Side bet ${SIDE_BET} chips: a pair on your first two cards pays 5 to 1, a suited pair 10 to 1`,
      });
      pair.classList.add(state.sideBetOn ? 'toggle-on' : 'toggle-off');
      row.appendChild(pair);
      const deal = button('deal', 'DEAL', { primary: true, title: 'Deal the cards (Enter)' });
      deal.disabled = state.bet < MIN_BET;
      row.appendChild(deal);
      c.appendChild(row);
      const hint = document.createElement('div');
      hint.className = 'controls-hint';
      hint.textContent = 'Keys 1-5 place chips · B repeats last bet · Enter deals · M mutes sound';
      c.appendChild(hint);
    } else if (state.phase === PHASE_PLAYER) {
      const row = document.createElement('div');
      row.className = 'controls-row';
      row.appendChild(button('hit', 'HIT', { primary: true, title: 'Take another card (H)' }));
      row.appendChild(button('stand', 'STAND', { title: 'Keep your hand (S)' }));
      row.appendChild(
        button('double', 'DOUBLE', {
          disabled: state.playerHand.length !== 2 || state.bankroll < state.bet,
          title: 'Double your bet, take exactly one card (D)',
        }),
      );
      row.appendChild(
        button('peek', `PEEK (${PEEK_COST})`, {
          disabled: state.peeked || state.bankroll < PEEK_COST,
          title: 'Pay 10 chips to reveal the dealer hole card (K)',
        }),
      );
      c.appendChild(row);
      const hint = document.createElement('div');
      hint.className = 'controls-hint';
      hint.textContent = 'H hit · S stand · D double · K peek · P pause';
      c.appendChild(hint);
    } else if (state.phase === PHASE_SETTLE) {
      const row = document.createElement('div');
      row.className = 'controls-row';
      row.appendChild(button('next', 'NEXT ROUND', { primary: true, title: 'Deal the next round (Enter)' }));
      c.appendChild(row);
    }
  }

  function draw(state, screen) {
    const roundKey = `${state.round}-${state.phase === PHASE_BETTING ? 'bet' : 'play'}`;
    if (state.round !== prevRound) {
      // A new round: every card is new again and animates in.
      prevKeys = new Set();
      prevRound = state.round;
    }
    // The hole card flips over the first draw after it is revealed (peek or settle).
    const holeRevealed =
      prevHoleHidden === true && state.dealerHoleHidden === false && state.dealerHand.length > 1;
    // On the title screen the demo deal stays hidden: the panel is the focus, and
    // stray cards peeking out above it look like a glitch.
    const showHands = screen !== SCREEN_TITLE;
    const keys = [];
    keys.push(
      ...drawHand(els.dealerCards, showHands ? state.dealerHand : [], state.dealerHoleHidden, 'd' + roundKey, {
        flipIndex: holeRevealed ? 1 : -1,
        peekIndex: state.peeked ? 1 : -1,
      }),
    );
    keys.push(
      ...drawHand(els.playerCards, showHands ? state.playerHand : [], false, 'p' + roundKey),
    );
    prevKeys = new Set(keys);
    prevHoleHidden = state.dealerHoleHidden;

    // A winning Miaw Pair lights the player's cards gold.
    els.playerCards.classList.toggle(
      'pair-glow',
      state.sideBet > 0 && state.playerHand.length >= 2 && isPair(state.playerHand),
    );

    // Totals: the dealer's total hides while the hole card is down.
    if (!showHands || state.dealerHand.length === 0) {
      els.dealerTotal.textContent = '';
    } else if (state.dealerHoleHidden) {
      els.dealerTotal.textContent = String(handValue([state.dealerHand[0]]).total);
    } else {
      els.dealerTotal.textContent = handLabel(state.dealerHand);
    }
    els.playerTotal.textContent =
      !showHands || state.playerHand.length === 0 ? '' : handLabel(state.playerHand);

    els.bankroll.textContent = String(state.bankroll);
    els.betDisplay.textContent = String(state.bet);
    els.best.textContent = String(state.stats.best);
    els.streak.textContent = state.streak > 0 ? `Streak ×${state.streak}` : '—';
    els.streakItem.classList.toggle('hot', state.streak >= 3);
    const s = state.stats;
    els.record.textContent = `${s.wins}W – ${s.losses}L – ${s.pushes}P`;
    els.muteBtn.textContent = state.muted ? 'Sound: Off' : 'Sound: On';
    els.shoeCount.textContent = state.shoe.length > 0 ? String(state.shoe.length) : '–';

    // The message line stays empty while the result banner is showing (it says the
    // same thing); otherwise it carries the current hint.
    els.message.textContent = state.phase === PHASE_SETTLE ? '' : state.message;

    // Bet spot: a little stack of chips for the current bet. The newest chip pops
    // in when the bet grows.
    const betGrew = state.bet > prevBet;
    prevBet = state.bet;
    els.betChips.replaceChildren();
    if (state.bet > 0) {
      const denoms = chipBreakdown(state.bet).slice(0, 6);
      for (const [i, denom] of denoms.entries()) {
        const chip = document.createElement('div');
        chip.className = chipClass(denom) + ' mini' + (betGrew && i === denoms.length - 1 ? ' chip-pop' : '');
        chip.textContent = String(denom);
        els.betChips.appendChild(chip);
      }
    }
    els.betAmount.textContent = state.bet > 0 ? `Bet ${state.bet}` : '';
    if (state.sideBet > 0) {
      const side = document.createElement('div');
      side.className = 'side-note';
      side.textContent = `Miaw Pair ${state.sideBet} riding`;
      els.betChips.appendChild(side);
    }

    // Result banner + celebration, once per settled round.
    if (state.phase === PHASE_SETTLE && state.result) {
      els.banner.className = 'result-banner show ' + state.result.kind;
      els.banner.textContent = state.result.text;
      const sig = `${state.round}-${state.result.kind}-${state.result.amount}`;
      if (sig !== lastResultSig) {
        lastResultSig = sig;
        const kind = state.result.kind;
        if (kind === 'win' || kind === 'blackjack' || kind === 'dealer-bust') {
          // A 3+ win streak gets a bigger burst.
          spawnConfetti(state.streak >= 3 ? 64 : 36);
          floatWin(
            state.streak >= 3 ? `STREAK ×${state.streak} · +${state.result.amount}` : `+${state.result.amount}`,
          );
        } else if (kind === 'lose' || kind === 'bust' || kind === 'dealer-blackjack') {
          flashLose();
        }
      }
    } else {
      els.banner.className = 'result-banner';
      els.banner.textContent = '';
    }

    drawControls(state);

    // Overlays.
    els.felt.classList.toggle('on-title', screen === SCREEN_TITLE);
    els.titleScreen.classList.toggle('hidden', screen !== SCREEN_TITLE);
    els.pauseScreen.classList.toggle('hidden', screen !== SCREEN_PAUSED);
    els.overScreen.classList.toggle('hidden', screen !== SCREEN_OVER);
    if (screen === SCREEN_TITLE) els.titleBest.textContent = String(state.stats.best);
    if (screen === SCREEN_OVER) {
      els.overStats.textContent =
        `Hands ${s.hands} · Wins ${s.wins} · Losses ${s.losses} · Pushes ${s.pushes} · ` +
        `Blackjacks ${s.blackjacks} · Pairs ${s.pairs} · Best bankroll ${s.best}`;
    }
  }

  return { draw };
}
