/**
 * Freecell game state and logic
 */

import type { Card } from "./cards.ts";
import {
  createDeck,
  shuffleDeck,
  canStackOnTableau,
  canStackOnFoundation,
} from "./cards.ts";

export interface GameState {
  freeCells: (Card | null)[];
  foundations: (Card | null)[];
  tableau: Card[][];
  moves: number;
  startTime: number;
  history: GameState[];
}

export function createGame(): GameState {
  const deck = shuffleDeck(createDeck());

  // Deal cards to 8 columns
  // First 4 columns get 7 cards, last 4 get 6 cards
  const tableau: Card[][] = [[], [], [], [], [], [], [], []];
  for (let i = 0; i < 52; i++) {
    tableau[i % 8].push(deck[i]);
  }

  return {
    freeCells: [null, null, null, null],
    foundations: [null, null, null, null],
    tableau,
    moves: 0,
    startTime: Date.now(),
    history: [],
  };
}

export function cloneState(state: GameState): GameState {
  return {
    freeCells: [...state.freeCells],
    foundations: [...state.foundations],
    tableau: state.tableau.map((col) => [...col]),
    moves: state.moves,
    startTime: state.startTime,
    history: [], // Don't clone history for saved states
  };
}

export function saveHistory(state: GameState): void {
  const snapshot = cloneState(state);
  state.history.push(snapshot);
  // Limit history size
  if (state.history.length > 100) {
    state.history.shift();
  }
}

export function undo(state: GameState): boolean {
  const previous = state.history.pop();
  if (previous) {
    state.freeCells = previous.freeCells;
    state.foundations = previous.foundations;
    state.tableau = previous.tableau;
    state.moves = previous.moves;
    return true;
  }
  return false;
}

export type Location =
  | { type: "freecell"; index: number }
  | { type: "foundation"; index: number }
  | { type: "tableau"; column: number; cardIndex?: number };

export function getCard(state: GameState, location: Location): Card | null {
  switch (location.type) {
    case "freecell":
      return state.freeCells[location.index];
    case "foundation":
      return state.foundations[location.index];
    case "tableau": {
      const column = state.tableau[location.column];
      if (column.length === 0) return null;
      const idx = location.cardIndex ?? column.length - 1;
      return column[idx] ?? null;
    }
  }
}

export function getMovableCards(
  state: GameState,
  location: Location
): Card[] | null {
  if (location.type === "freecell") {
    const card = state.freeCells[location.index];
    return card ? [card] : null;
  }

  if (location.type === "foundation") {
    return null; // Can't move from foundation
  }

  const column = state.tableau[location.column];
  if (column.length === 0) return null;

  const startIdx = location.cardIndex ?? column.length - 1;
  const cards = column.slice(startIdx);

  // Check if sequence is valid (descending, alternating colors)
  for (let i = 0; i < cards.length - 1; i++) {
    if (!canStackOnTableau(cards[i], cards[i + 1])) {
      return null;
    }
  }

  // Check if we can move this many cards
  const maxMovable = getMaxMovable(state, location.column);
  if (cards.length > maxMovable) {
    return null;
  }

  return cards;
}

export function getMaxMovable(state: GameState, excludeColumn?: number): number {
  const emptyFreeCells = state.freeCells.filter((c) => c === null).length;
  let emptyColumns = state.tableau.filter(
    (col, i) => col.length === 0 && i !== excludeColumn
  ).length;

  // Formula: (1 + emptyFreeCells) * 2^emptyColumns
  return (1 + emptyFreeCells) * Math.pow(2, emptyColumns);
}

export interface MoveResult {
  success: boolean;
  message?: string;
}

export function moveCards(
  state: GameState,
  from: Location,
  to: Location
): MoveResult {
  const cards = getMovableCards(state, from);
  if (!cards || cards.length === 0) {
    return { success: false, message: "No movable cards" };
  }

  // Validate move to destination
  if (to.type === "freecell") {
    if (cards.length > 1) {
      return { success: false, message: "Can only move one card to free cell" };
    }
    if (state.freeCells[to.index] !== null) {
      return { success: false, message: "Free cell occupied" };
    }
  } else if (to.type === "foundation") {
    if (cards.length > 1) {
      return { success: false, message: "Can only move one card to foundation" };
    }
    const topFoundation = state.foundations[to.index];
    if (!canStackOnFoundation(topFoundation, cards[0])) {
      return { success: false, message: "Invalid foundation move" };
    }
  } else {
    // Tableau
    const destColumn = state.tableau[to.column];
    if (destColumn.length > 0) {
      const topCard = destColumn[destColumn.length - 1];
      if (!canStackOnTableau(topCard, cards[0])) {
        return { success: false, message: "Invalid tableau move" };
      }
    }
  }

  // Save state for undo
  saveHistory(state);

  // Remove cards from source
  if (from.type === "freecell") {
    state.freeCells[from.index] = null;
  } else if (from.type === "tableau") {
    const startIdx = from.cardIndex ?? state.tableau[from.column].length - 1;
    state.tableau[from.column].splice(startIdx);
  }

  // Add cards to destination
  if (to.type === "freecell") {
    state.freeCells[to.index] = cards[0];
  } else if (to.type === "foundation") {
    state.foundations[to.index] = cards[0];
  } else {
    state.tableau[to.column].push(...cards);
  }

  state.moves++;
  return { success: true };
}

export function autoMoveToFoundation(state: GameState, card: Card): boolean {
  // Find which foundation this card can go to
  for (let i = 0; i < 4; i++) {
    if (canStackOnFoundation(state.foundations[i], card)) {
      return true;
    }
  }
  return false;
}

export function findAutoMove(
  state: GameState,
  from: Location
): Location | null {
  const cards = getMovableCards(state, from);
  if (!cards || cards.length !== 1) return null;

  const card = cards[0];

  // Check foundations
  for (let i = 0; i < 4; i++) {
    if (canStackOnFoundation(state.foundations[i], card)) {
      return { type: "foundation", index: i };
    }
  }

  return null;
}

export function findEmptyFreeCell(state: GameState): Location | null {
  for (let i = 0; i < 4; i++) {
    if (state.freeCells[i] === null) {
      return { type: "freecell", index: i };
    }
  }
  return null;
}

export function getTopCard(state: GameState, location: Location): Card | null {
  if (location.type === "freecell") {
    return state.freeCells[location.index];
  }
  if (location.type === "foundation") {
    return state.foundations[location.index];
  }
  const column = state.tableau[location.column];
  return column.length > 0 ? column[column.length - 1] : null;
}

export function isWon(state: GameState): boolean {
  // All 4 foundations have King (rank 13)
  return state.foundations.every((card) => card !== null && card.rank === 13);
}

export function findHint(state: GameState): { from: Location; to: Location } | null {
  // Check for auto-moves to foundation first
  for (let i = 0; i < 4; i++) {
    const card = state.freeCells[i];
    if (card) {
      const dest = findAutoMove(state, { type: "freecell", index: i });
      if (dest) return { from: { type: "freecell", index: i }, to: dest };
    }
  }

  for (let col = 0; col < 8; col++) {
    if (state.tableau[col].length > 0) {
      const dest = findAutoMove(state, { type: "tableau", column: col });
      if (dest) return { from: { type: "tableau", column: col }, to: dest };
    }
  }

  // Check tableau to tableau moves
  for (let fromCol = 0; fromCol < 8; fromCol++) {
    const fromColumn = state.tableau[fromCol];
    if (fromColumn.length === 0) continue;

    for (let cardIdx = fromColumn.length - 1; cardIdx >= 0; cardIdx--) {
      const cards = getMovableCards(state, {
        type: "tableau",
        column: fromCol,
        cardIndex: cardIdx,
      });
      if (!cards) continue;

      for (let toCol = 0; toCol < 8; toCol++) {
        if (toCol === fromCol) continue;

        const toColumn = state.tableau[toCol];
        if (toColumn.length === 0) {
          // Moving to empty column - only suggest if it's beneficial
          if (cardIdx > 0) {
            return {
              from: { type: "tableau", column: fromCol, cardIndex: cardIdx },
              to: { type: "tableau", column: toCol },
            };
          }
        } else {
          const topCard = toColumn[toColumn.length - 1];
          if (canStackOnTableau(topCard, cards[0])) {
            return {
              from: { type: "tableau", column: fromCol, cardIndex: cardIdx },
              to: { type: "tableau", column: toCol },
            };
          }
        }
      }
    }
  }

  // Suggest moving to free cell
  const emptyFreeCell = state.freeCells.findIndex((c) => c === null);
  if (emptyFreeCell !== -1) {
    for (let col = 0; col < 8; col++) {
      if (state.tableau[col].length > 0) {
        return {
          from: { type: "tableau", column: col },
          to: { type: "freecell", index: emptyFreeCell },
        };
      }
    }
  }

  return null;
}
