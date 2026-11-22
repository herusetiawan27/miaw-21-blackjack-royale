// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh game with a fixed seed, so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { PHASE_GAMEOVER, PHASE_SETTLE } from './game.js';
import { handValue } from './deck.js';

/** Basic strategy: hit under 17, stand on 17 or more. Never doubles, never peeks. */
function basicPlay(game) {
  let guard = 0;
  while (game.state.phase === 'player' && guard < 12) {
    guard += 1;
    if (handValue(game.state.playerHand).total < 17) game.hit();
    else game.stand();
  }
}

/**
 * Set `game` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it.
 */
export function stageShot(name, game) {
  if (name !== 'play' && name !== 'end') {
    game.toTitle();
    game.demoDeal();
    return { screen: 'title' };
  }

  game.start();
  if (name === 'play') {
    game.addChip(50);
    game.deal();
    // One hit at most, then stop mid-decision: the frame shows both hands, the bet and
    // the action buttons while the player is still thinking.
    if (game.state.phase === 'player' && handValue(game.state.playerHand).total < 17) {
      game.hit();
    }
    return { screen: 'play' };
  }

  // End: keep playing full rounds until one is WON, or the bankroll runs out.
  // The dossier's last frame should be a win, not a bust.
  for (let round = 0; round < 40; round += 1) {
    if (game.state.phase === 'gameover') return { screen: 'over' };
    game.addChip(50);
    if (game.state.bet < 10) game.addChip('max');
    game.deal();
    basicPlay(game);
    if (game.state.phase === PHASE_SETTLE && game.state.result && game.state.result.amount > 0) {
      return { screen: 'play' };
    }
    if (game.state.phase === PHASE_SETTLE) game.nextRound();
    if (game.state.phase === PHASE_GAMEOVER) return { screen: 'over' };
  }
  return { screen: game.state.phase === PHASE_GAMEOVER ? 'over' : 'play' };
}
