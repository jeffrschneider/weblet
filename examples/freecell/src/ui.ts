/**
 * UI rendering for Freecell
 */

import type { Card } from "./cards.ts";
import { SUIT_SYMBOLS, RANK_NAMES, isRed } from "./cards.ts";
import type { GameState, Location } from "./game.ts";

export function createCardElement(card: Card): HTMLElement {
  const el = document.createElement("div");
  el.className = `card ${isRed(card.suit) ? "red" : "black"}`;
  el.dataset.cardId = card.id;
  el.dataset.suit = card.suit;
  el.dataset.rank = String(card.rank);
  el.setAttribute("draggable", "true");
  el.setAttribute("tabindex", "0");
  el.setAttribute(
    "aria-label",
    `${RANK_NAMES[card.rank]} of ${card.suit}`
  );

  el.innerHTML = `
    <span class="card-corner top-left">
      <span class="rank">${RANK_NAMES[card.rank]}</span>
      <span class="suit">${SUIT_SYMBOLS[card.suit]}</span>
    </span>
    <span class="card-center">${SUIT_SYMBOLS[card.suit]}</span>
    <span class="card-corner bottom-right">
      <span class="rank">${RANK_NAMES[card.rank]}</span>
      <span class="suit">${SUIT_SYMBOLS[card.suit]}</span>
    </span>
  `;

  return el;
}

export function renderGame(state: GameState): void {
  // Render free cells
  for (let i = 0; i < 4; i++) {
    const cell = document.getElementById(`free-${i}`)!;
    cell.innerHTML = "";
    const card = state.freeCells[i];
    if (card) {
      cell.appendChild(createCardElement(card));
    }
  }

  // Render foundations
  for (let i = 0; i < 4; i++) {
    const cell = document.getElementById(`foundation-${i}`)!;
    cell.innerHTML = "";
    const card = state.foundations[i];
    if (card) {
      cell.appendChild(createCardElement(card));
    }
  }

  // Render tableau
  for (let col = 0; col < 8; col++) {
    const column = document.getElementById(`column-${col}`)!;
    column.innerHTML = "";
    const cards = state.tableau[col];
    cards.forEach((card, idx) => {
      const cardEl = createCardElement(card);
      cardEl.style.top = `${idx * 35}px`;
      cardEl.dataset.columnIndex = String(idx);
      column.appendChild(cardEl);
    });
  }
}

export function highlightCard(cardId: string): void {
  clearHighlights();
  const card = document.querySelector(`[data-card-id="${cardId}"]`);
  if (card) {
    card.classList.add("selected");
  }
}

export function highlightLocation(location: Location): void {
  let element: HTMLElement | null = null;

  if (location.type === "freecell") {
    element = document.getElementById(`free-${location.index}`);
  } else if (location.type === "foundation") {
    element = document.getElementById(`foundation-${location.index}`);
  } else {
    element = document.getElementById(`column-${location.column}`);
  }

  if (element) {
    element.classList.add("hint");
  }
}

export function clearHighlights(): void {
  document.querySelectorAll(".selected").forEach((el) => {
    el.classList.remove("selected");
  });
  document.querySelectorAll(".hint").forEach((el) => {
    el.classList.remove("hint");
  });
}

export function showWinDialog(moves: number, time: string): void {
  const dialog = document.getElementById("win-dialog")!;
  document.getElementById("final-moves")!.textContent = String(moves);
  document.getElementById("final-time")!.textContent = time;
  dialog.hidden = false;
}

export function hideWinDialog(): void {
  const dialog = document.getElementById("win-dialog")!;
  dialog.hidden = true;
}

export function updateStats(moves: number, time: string): void {
  document.getElementById("move-count")!.textContent = String(moves);
  document.getElementById("timer")!.textContent = time;
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
