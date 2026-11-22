// Boot and the one loop: input is read every frame and the renderer paints the state.
// Blackjack is turn-based, so there is no simulation to step — the loop only moves actions
// into the game and repaints after each one.
//
// ?seed=N fixes the shoe. ?shot=start|play|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
// ?selftest=1 runs the engine assertions in the page and writes the verdict into #selftest.

import { createRandom } from './random.js';
import { createGame, PHASE_BETTING, PHASE_GAMEOVER, PHASE_PLAYER, PHASE_SETTLE, PHASE_TITLE } from './game.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const selftest = params.get('selftest') === '1';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const game = createGame(createRandom(seed));
const renderer = createRenderer(stage);

/** Scale the fixed 1280x720 table to fit the window, centred. */
function fitStage() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', fitStage);
fitStage();

// Tiny WebAudio blips, generated in the browser: no files, no network.
let audio = null;
function beep(freq, ms, type = 'sine', gain = 0.08) {
  if (game.state.muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') void audio.resume();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + ms / 1000);
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + ms / 1000);
  } catch {
    // Sound is decoration: a browser without audio still plays.
  }
}
function soundFor(action) {
  if (action === 'deal' || action === 'hit' || action === 'double') beep(520, 70, 'triangle');
  else if (action === 'chip10' || action === 'chip20' || action === 'chip50' || action === 'chip100' || action === 'chipmax') beep(880, 40, 'square', 0.04);
  else if (action === 'blackjack') {
    beep(660, 120, 'sine');
    setTimeout(() => beep(880, 140, 'sine'), 110);
    setTimeout(() => beep(1320, 220, 'sine'), 230);
  } else if (action === 'win' || action === 'dealer-bust') {
    beep(660, 120, 'sine');
    setTimeout(() => beep(880, 160, 'sine'), 110);
  } else if (action === 'lose' || action === 'bust') beep(220, 180, 'sawtooth', 0.05);
}

function announce(message) {
  status.textContent = message;
}

function screenFor() {
  if (game.state.phase === PHASE_TITLE) return SCREEN_TITLE;
  if (game.state.phase === PHASE_GAMEOVER) return SCREEN_OVER;
  if (game.state.paused) return SCREEN_PAUSED;
  return SCREEN_PLAY;
}

function apply(action) {
  const s = game.state;
  switch (action) {
    case 'start':
      game.start();
      announce('Place your bet, then press Deal.');
      break;
    case 'chip10': game.addChip(10); break;
    case 'chip20': game.addChip(20); break;
    case 'chip50': game.addChip(50); break;
    case 'chip100': game.addChip(100); break;
    case 'chipmax': game.addChip('max'); break;
    case 'clear': game.clearBet(); break;
    case 'repeat':
      if (game.repeatBet()) beep(880, 40, 'square', 0.04);
      break;
    case 'sidebet': game.toggleSideBet(); break;
    case 'deal':
      if (game.deal()) {
        soundFor('deal');
        announce(s.phase === PHASE_PLAYER ? 'Your move.' : s.message);
      }
      break;
    case 'hit':
      if (game.hit()) {
        soundFor('hit');
        if (s.phase === PHASE_SETTLE) soundFor(s.result.kind);
      }
      break;
    case 'stand':
      if (game.stand()) soundFor('deal');
      break;
    case 'double':
      if (game.double()) soundFor('double');
      break;
    case 'peek':
      if (game.peek()) beep(440, 90, 'triangle');
      break;
    case 'next':
      if (game.nextRound()) announce('Place your bet, then press Deal.');
      break;
    case 'restart':
      game.newGame();
      announce('New game. Place your bet, then press Deal.');
      break;
    case 'quit':
      game.toTitle();
      announce('Miaw 21. Press Space or click to start.');
      break;
    case 'pause':
      if (game.togglePause()) announce(s.paused ? 'Paused.' : 'Playing.');
      break;
    case 'mute':
      game.toggleMute();
      break;
    case 'confirm':
      if (s.phase === PHASE_TITLE) game.start();
      else if (s.phase === PHASE_BETTING) {
        if (game.deal()) soundFor('deal');
      } else if (s.phase === PHASE_SETTLE) game.nextRound();
      else if (s.phase === PHASE_GAMEOVER) game.newGame();
      else if (s.paused) game.togglePause();
      break;
    default:
      break;
  }
  if (s.phase === PHASE_SETTLE && s.result) {
    const kind = s.result.kind;
    if (kind === 'blackjack' || kind === 'win' || kind === 'dealer-bust') soundFor(kind);
    else if (kind === 'lose' || kind === 'bust' || kind === 'dealer-blackjack') soundFor('lose');
    announce(s.result.text);
  }
  renderer.draw(s, screenFor());
}

function runShot(name) {
  // Screenshot mode: freeze entrance animations so stills show the final frame.
  document.body.classList.add('shot');
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(stage, apply);
  game.toTitle();
  game.demoDeal();
  renderer.draw(game.state, SCREEN_TITLE);
  announce('Miaw 21. Press Space or click to start.');

  function frame() {
    requestAnimationFrame(frame);
    for (const action of input.takeActions()) apply(action);
  }
  requestAnimationFrame(frame);
}

if (selftest) {
  const verdict = runSelfTest();
  const el = document.getElementById('selftest');
  el.textContent = verdict.text;
  el.dataset.pass = String(verdict.pass);
  document.title = verdict.pass ? 'SELFTEST PASS' : 'SELFTEST FAIL';
  window.__shotReady = true;
} else if (shot) {
  runShot(shot);
} else {
  runGame();
}
