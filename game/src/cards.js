// Cards for Miaw 21: the shoe, hand maths, and the little facts the engine and
// the renderer both need (labels, colours, pairs). A card is a plain object
// { rank, suit, faceUp } so tests and the renderer can build hands by hand.

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RED_SUITS = new Set(['♥', '♦']);

/** Blackjack value of one rank (ace counted as 11 here; handValue adjusts). */
export function rankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number(rank);
}

/** 'red' for hearts and diamonds, 'black' for spades and clubs. */
export function cardColor(card) {
  return RED_SUITS.has(card.suit) ? 'red' : 'black';
}

/** Short label such as 'A♠' or '10♥'. */
export function cardLabel(card) {
  return `${card.rank}${card.suit}`;
}

/**
 * Best blackjack total for a hand. Aces count as 11 while that does not bust
 * the hand, otherwise they drop to 1 one at a time. Returns
 * { total, soft, bust } where soft means an ace is still counted as 11.
 */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += rankValue(card.rank);
    if (card.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0, bust: total > 21 };
}

/** Exactly two cards totalling 21. */
export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Short label for a hand's value: 'soft 19', '20', or 'bust 23'. */
export function handLabel(cards) {
  const v = handValue(cards);
  if (v.bust) return `bust ${v.total}`;
  return v.soft ? `soft ${v.total}` : `${v.total}`;
}

/** The first two cards share a rank (the Miaw Pair trigger). */
export function isPair(cards) {
  return cards.length >= 2 && cards[0].rank === cards[1].rank;
}

/** The first two cards share a rank and a suit (a suited pair). */
export function isSuitedPair(cards) {
  return isPair(cards) && cards[0].suit === cards[1].suit;
}

/**
 * A fresh shoe of `decks` standard 52-card decks, shuffled with `rng`.
 * Cards are drawn from the end of the array, so the top of the shoe is last.
 */
export function buildShoe(decks, rng) {
  const shoe = [];
  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit, faceUp: true });
      }
    }
  }
  return rng.shuffle(shoe);
}
