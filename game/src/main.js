// Bootstrap for Miaw 21: wires the engine to the DOM, binds mouse and keyboard,
// and handles the deterministic screenshot mode (?shot=start|play|end&seed=N).
// In shot mode the game renders one staged frame and waits; in live mode it
// starts on the title screen and every button and key drives the engine.

import {
  PHASE,
  clearBet,
  createGame,
  deal,
  doubleDown,
  hit,
  peek,
  placeBet,
  repeatBet,
  restart,
  stand,
  startPlay,
  togglePair,
  newRound,
} from './engine.js';
import { createUi, render } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || '1') || 1;

const game = shotName ? stageShot(shotName, shotSeed).game : createGame();
const ui = createUi();

function draw() {
  render(game, ui);
}

function bind(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => {
    fn();
    draw();
  });
}

if (shotName) {
  document.body.classList.add('shot');
  draw();
} else {
  bind('play-btn', () => startPlay(game));
  bind('restart-btn', () => restart(game));
  document.querySelectorAll('#chips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const amount = chip.dataset.amount === 'max' ? game.bankroll : Number(chip.dataset.amount);
      placeBet(game, amount);
      draw();
    });
  });
  bind('deal-btn', () => deal(game));
  bind('clear-btn', () => clearBet(game));
  bind('repeat-btn', () => repeatBet(game));
  bind('pair-btn', () => togglePair(game));
  bind('hit-btn', () => hit(game));
  bind('stand-btn', () => stand(game));
  bind('double-btn', () => doubleDown(game));
  bind('peek-btn', () => peek(game));
  bind('next-btn', () => newRound(game));

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    let acted = true;
    if (game.phase === PHASE.TITLE && (key === 'enter' || key === ' ')) startPlay(game);
    else if (game.phase === PHASE.BROKE && (key === 'enter' || key === ' ')) restart(game);
    else if (key === 'h') hit(game);
    else if (key === 's') stand(game);
    else if (key === 'd') doubleDown(game);
    else if (key === 'p') peek(game);
    else if (key === 'b') repeatBet(game);
    else if (key === 'enter' || key === ' ') {
      if (game.phase === PHASE.BETTING) deal(game);
      else if (game.phase === PHASE.SETTLED) newRound(game);
      else acted = false;
    } else acted = false;
    if (acted) {
      event.preventDefault();
      draw();
    }
  });

  draw();
}

// Exposed for the self-test harness in a headless browser.
window.__miaw21 = { game, ui };
