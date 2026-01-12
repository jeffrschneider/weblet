/**
 * Drag and drop handling for Freecell
 */

import type { GameState, Location } from "./game.ts";
import { moveCards, getMovableCards } from "./game.ts";
import { renderGame, clearHighlights } from "./ui.ts";

let draggedCards: HTMLElement[] = [];
let dragSource: Location | null = null;

export function initDragDrop(
  state: GameState,
  onMove: () => void
): void {
  const board = document.querySelector(".game-board")!;

  // Drag start
  board.addEventListener("dragstart", (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("card")) return;

    const location = getLocationFromElement(target);
    if (!location) return;

    const cards = getMovableCards(state, location);
    if (!cards) {
      e.preventDefault();
      return;
    }

    dragSource = location;

    // Collect all cards being dragged
    if (location.type === "tableau" && location.cardIndex !== undefined) {
      const column = document.getElementById(`column-${location.column}`)!;
      const cardElements = column.querySelectorAll(".card");
      draggedCards = Array.from(cardElements).slice(location.cardIndex) as HTMLElement[];
    } else {
      draggedCards = [target];
    }

    draggedCards.forEach((card) => card.classList.add("dragging"));

    // Set drag image
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", target.dataset.cardId || "");
    }
  });

  // Drag over
  board.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  });

  // Drag enter
  board.addEventListener("dragenter", (e) => {
    const target = e.target as HTMLElement;
    const cell = target.closest(".cell, .column");
    if (cell) {
      cell.classList.add("drag-over");
    }
  });

  // Drag leave
  board.addEventListener("dragleave", (e) => {
    const target = e.target as HTMLElement;
    const cell = target.closest(".cell, .column");
    if (cell) {
      cell.classList.remove("drag-over");
    }
  });

  // Drop
  board.addEventListener("drop", (e) => {
    e.preventDefault();

    const target = e.target as HTMLElement;
    const cell = target.closest(".cell, .column") as HTMLElement;
    if (!cell || !dragSource) return;

    cell.classList.remove("drag-over");

    const destination = getLocationFromCell(cell);
    if (!destination) return;

    const result = moveCards(state, dragSource, destination);
    if (result.success) {
      renderGame(state);
      onMove();
    }

    cleanup();
  });

  // Drag end
  board.addEventListener("dragend", () => {
    cleanup();
    document.querySelectorAll(".drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
  });
}

function cleanup(): void {
  draggedCards.forEach((card) => card.classList.remove("dragging"));
  draggedCards = [];
  dragSource = null;
  clearHighlights();
}

export function getLocationFromElement(element: HTMLElement): Location | null {
  const card = element.closest(".card") as HTMLElement;
  if (!card) return null;

  const parent = card.parentElement;
  if (!parent) return null;

  if (parent.classList.contains("free-cell")) {
    const index = parseInt(parent.id.replace("free-", ""), 10);
    return { type: "freecell", index };
  }

  if (parent.classList.contains("foundation")) {
    const index = parseInt(parent.id.replace("foundation-", ""), 10);
    return { type: "foundation", index };
  }

  if (parent.classList.contains("column")) {
    const column = parseInt(parent.id.replace("column-", ""), 10);
    const cardIndex = card.dataset.columnIndex
      ? parseInt(card.dataset.columnIndex, 10)
      : undefined;
    return { type: "tableau", column, cardIndex };
  }

  return null;
}

export function getLocationFromCell(cell: HTMLElement): Location | null {
  if (cell.classList.contains("free-cell")) {
    const index = parseInt(cell.id.replace("free-", ""), 10);
    return { type: "freecell", index };
  }

  if (cell.classList.contains("foundation")) {
    const index = parseInt(cell.id.replace("foundation-", ""), 10);
    return { type: "foundation", index };
  }

  if (cell.classList.contains("column")) {
    const column = parseInt(cell.id.replace("column-", ""), 10);
    return { type: "tableau", column };
  }

  return null;
}
