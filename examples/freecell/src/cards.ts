/**
 * Card definitions and utilities
 */

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

export const RANK_NAMES: Record<Rank, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function isBlack(suit: Suit): boolean {
  return suit === "clubs" || suit === "spades";
}

export function oppositeColor(card1: Card, card2: Card): boolean {
  return isRed(card1.suit) !== isRed(card2.suit);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`,
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function canStackOnTableau(bottom: Card, top: Card): boolean {
  return oppositeColor(bottom, top) && bottom.rank === top.rank + 1;
}

export function canStackOnFoundation(
  foundation: Card | null,
  card: Card
): boolean {
  if (!foundation) {
    return card.rank === 1; // Ace
  }
  return foundation.suit === card.suit && foundation.rank === card.rank - 1;
}
