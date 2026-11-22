// The shoe and the hand math: no rules, no browser, no drawing. Every function here is pure,
// so the game engine can be unit-tested in Node without a DOM.

export const SUITS = [
  { id: 'S', glyph: '♠', red: false, name: 'Spades' },
  { id: 'H', glyph: '♥', red: true, name: 'Hearts' },
  { id: 'D', glyph: '♦', red: true, name: 'Diamonds' },
  { id: 'C', glyph: '♣', red: false, name: 'Clubs' },
];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function rankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number.parseInt(rank, 10);
}

/** A fresh shoe of `decks` standard 52-card decks, shuffled with `random`. */
export function buildShoe(random, decks) {
  const shoe = [];
  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) shoe.push({ rank, suit: suit.id, glyph: suit.glyph, red: suit.red });
    }
  }
  for (let i = shoe.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = shoe[i];
    shoe[i] = shoe[j];
    shoe[j] = tmp;
  }
  return shoe;
}

/**
 * The value of a hand: the best total that does not bust (an ace counts 11 when it can),
 * or the smallest bust total when every count busts. `soft` is true when an ace counts 11.
 */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') aces += 1;
    else total += rankValue(card.rank);
  }
  total += aces; // every ace as 1 first
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  return { total, soft };
}

export function handLabel(cards) {
  const { total, soft } = handValue(cards);
  return soft ? `Soft ${total}` : `${total}`;
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isPair(cards) {
  return cards.length >= 2 && cards[0].rank === cards[1].rank;
}

export function isSuitedPair(cards) {
  return isPair(cards) && cards[0].suit === cards[1].suit;
}

/** The dealer hits on 16 or less and stands on all 17s, soft 17 included. */
export function dealerShouldHit(cards) {
  return handValue(cards).total < 17;
}
