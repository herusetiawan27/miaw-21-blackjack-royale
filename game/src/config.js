// Every tuning number and colour in one place. The table is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step is not needed here: blackjack is turn-based. */

export const START_BANKROLL = 1000;
export const MIN_BET = 10;
export const CHIPS = [10, 20, 50, 100];
export const DECKS = 2;
export const RESHUFFLE_AT = 26;

/** Blackjack pays 3 to 2 (rounded down to whole chips). */
export const BLACKJACK_PAYS_NUM = 3;
export const BLACKJACK_PAYS_DEN = 2;

/** Miaw Pair side bet: 10 chips; a pair on the first two cards pays 5 to 1, a suited pair 10 to 1. */
export const SIDE_BET = 10;
export const PAIR_PAYS = 5;
export const SUITED_PAIR_PAYS = 10;

/** Peeking at the dealer's hole card costs 10 chips, once per round. */
export const PEEK_COST = 10;

export const PALETTE = {
  backdrop: '#0b0f14',
  felt: '#0e6b3a',
  feltDark: '#084d28',
  feltLight: '#128a4b',
  gold: '#f2c94c',
  goldDark: '#c9a227',
  panel: '#101820',
  panelEdge: '#2a3644',
  text: '#eef1f5',
  muted: '#9aa5b1',
  red: '#c0392b',
  black: '#1c2430',
  win: '#2ecc71',
  lose: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best bankroll is kept between visits (this browser only). */
export const BEST_KEY = 'miaw-21.best';
export const STATS_KEY = 'miaw-21.stats';
