// Deterministic screenshot scenes for ?shot=start|play|end. Each scene plays the
// real engine forward from a fresh game with a fixed seed, so the same URL
// always shows the same frame. The play scene is one hit into a round; the end
// scene searches a few seeds for a round the autopilot actually wins, so the
// frame shows a settled win instead of a loss.

import {
  createGame,
  deal,
  hit,
  placeBet,
  stand,
  startPlay,
} from './engine.js';
import { handValue } from './cards.js';

const PLAY_BET = 50;

/** Simple autopilot: hit while under 17, then stand. */
function autopilot(game) {
  let guard = 0;
  while (game.phase === 'player' && guard < 12) {
    guard += 1;
    if (handValue(game.player).total < 17) hit(game);
    else stand(game);
  }
}

function playOneHit(game) {
  startPlay(game);
  placeBet(game, PLAY_BET);
  const dealt = deal(game);
  if (game.phase !== 'player') return false;
  hit(game);
  return game.phase === 'player';
}

/**
 * Stage the named scene ('start', 'play' or 'end'; anything else is start)
 * from `seed` and return { game, screen, best }.
 */
export function stageShot(name, seed) {
  if (name === 'play') {
    for (let s = seed; s < seed + 60; s += 1) {
      const game = createGame(s);
      if (playOneHit(game)) return { game, screen: 'play', best: game.best };
    }
    const game = createGame(seed);
    startPlay(game);
    placeBet(game, PLAY_BET);
    deal(game);
    return { game, screen: 'play', best: game.best };
  }
  if (name === 'end') {
    for (let s = seed; s < seed + 200; s += 1) {
      const game = createGame(s);
      startPlay(game);
      placeBet(game, PLAY_BET);
      deal(game);
      if (game.phase !== 'player') continue;
      autopilot(game);
      if (game.result === 'blackjack' || game.result === 'win') {
        return { game, screen: 'over', best: game.best };
      }
    }
    const game = createGame(seed);
    startPlay(game);
    placeBet(game, PLAY_BET);
    deal(game);
    if (game.phase === 'player') autopilot(game);
    return { game, screen: 'over', best: game.best };
  }
  const game = createGame(seed);
  return { game, screen: 'title', best: 0 };
}
