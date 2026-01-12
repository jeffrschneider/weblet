/**
 * Freecell App - Main entry point
 */

import type { GameState, Location } from "./game.ts";
import {
  createGame,
  moveCards,
  undo,
  isWon,
  findHint,
  findAutoMove,
  findEmptyFreeCell,
} from "./game.ts";
import {
  renderGame,
  updateStats,
  formatTime,
  showWinDialog,
  hideWinDialog,
  highlightCard,
  highlightLocation,
  clearHighlights,
} from "./ui.ts";
import { initDragDrop, getLocationFromElement, getLocationFromCell } from "./drag-drop.ts";
import {
  saveGame,
  clearSavedGame,
  recordWin,
  recordNewGame,
  loadPreferences,
  savePreferences,
} from "./storage.ts";
import type { Locale } from "./i18n.ts";
import { initI18n, setLocale, saveLocalePreference } from "./i18n.ts";

// Game state
let state: GameState;
let timerInterval: number | null = null;
let selectedLocation: Location | null = null;
let isAnimating = false;

// Animation duration in ms
const ANIMATION_DURATION = 250;

/**
 * Get the DOM element for a location
 */
function getElementForLocation(location: Location): HTMLElement | null {
  if (location.type === "freecell") {
    return document.getElementById(`free-${location.index}`);
  }
  if (location.type === "foundation") {
    return document.getElementById(`foundation-${location.index}`);
  }
  return document.getElementById(`column-${location.column}`);
}

/**
 * Animate a card moving from source to destination
 */
function animateCardMove(
  cardElement: HTMLElement,
  toLocation: Location
): Promise<void> {
  return new Promise((resolve) => {
    const destElement = getElementForLocation(toLocation);
    if (!destElement) {
      resolve();
      return;
    }

    const cardRect = cardElement.getBoundingClientRect();
    const destRect = destElement.getBoundingClientRect();

    // Calculate destination position
    let destTop = destRect.top;
    let destLeft = destRect.left;

    // For tableau columns, stack cards
    if (toLocation.type === "tableau") {
      const existingCards = destElement.querySelectorAll(".card");
      destTop += existingCards.length * 35;
    }

    // Calculate the translation needed
    const deltaX = destLeft - cardRect.left;
    const deltaY = destTop - cardRect.top;

    // Apply animation
    cardElement.style.transition = `transform ${ANIMATION_DURATION}ms ease-out`;
    cardElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    cardElement.style.zIndex = "1000";

    setTimeout(() => {
      cardElement.style.transition = "";
      cardElement.style.transform = "";
      cardElement.style.zIndex = "";
      resolve();
    }, ANIMATION_DURATION);
  });
}

/**
 * Perform an animated move and update game state
 */
async function animatedMove(from: Location, to: Location): Promise<boolean> {
  // Find the card element to animate
  let cardElement: HTMLElement | null = null;

  if (from.type === "freecell") {
    const cell = document.getElementById(`free-${from.index}`);
    cardElement = cell?.querySelector(".card") as HTMLElement;
  } else if (from.type === "tableau") {
    const column = document.getElementById(`column-${from.column}`);
    cardElement = column?.querySelector(".card:last-child") as HTMLElement;
  }

  if (cardElement) {
    await animateCardMove(cardElement, to);
  }

  // Perform the actual move
  const result = moveCards(state, from, to);
  if (result.success) {
    renderGame(state);
    return true;
  }
  return false;
}

/**
 * Try to cascade cards to foundation from a tableau column
 * Returns true if any moves were made
 */
async function cascadeToFoundation(column: number): Promise<boolean> {
  let moved = false;

  while (true) {
    const from: Location = { type: "tableau", column };
    const foundationDest = findAutoMove(state, from);

    if (foundationDest) {
      const success = await animatedMove(from, foundationDest);
      if (success) {
        moved = true;
        // Small delay between cascade moves
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
    }
    break;
  }

  return moved;
}

/**
 * Handle smart card click with cascade logic
 */
async function handleSmartCardClick(element: HTMLElement): Promise<void> {
  if (isAnimating) return;

  const location = getLocationFromElement(element);
  if (!location) return;

  // If we have a selected card, try to move to this location
  if (selectedLocation) {
    isAnimating = true;
    const result = moveCards(state, selectedLocation, location);
    if (result.success) {
      renderGame(state);
      onMove();
    }
    clearHighlights();
    selectedLocation = null;
    isAnimating = false;
    return;
  }

  // Only handle tableau cards for smart auto-move
  if (location.type !== "tableau") {
    // For free cell cards, just select them
    selectedLocation = location;
    const cardId = element.dataset.cardId;
    if (cardId) {
      highlightCard(cardId);
    }
    return;
  }

  // Check if this is the top card of the column
  const column = state.tableau[location.column];
  const cardIndex = location.cardIndex ?? column.length - 1;
  if (cardIndex !== column.length - 1) {
    // Not the top card, just select it
    selectedLocation = location;
    const cardId = element.dataset.cardId;
    if (cardId) {
      highlightCard(cardId);
    }
    return;
  }

  isAnimating = true;

  // Try to move to foundation first
  const foundationDest = findAutoMove(state, location);
  if (foundationDest) {
    const success = await animatedMove(location, foundationDest);
    if (success) {
      // Cascade: check if the new top card can also go to foundation
      await cascadeToFoundation(location.column);
      onMove();
      isAnimating = false;
      return;
    }
  }

  // Can't go to foundation, try free cell
  const freeCellDest = findEmptyFreeCell(state);
  if (freeCellDest) {
    const success = await animatedMove(location, freeCellDest);
    if (success) {
      // After moving to free cell, check if the new top card can go to foundation
      await cascadeToFoundation(location.column);
      onMove();
      isAnimating = false;
      return;
    }
  }

  // Can't auto-move, just select the card
  isAnimating = false;
  selectedLocation = location;
  const cardId = element.dataset.cardId;
  if (cardId) {
    highlightCard(cardId);
  }
}

// Initialize game
function init(): void {
  initI18n();

  const prefs = loadPreferences();
  applyPreferences(prefs);

  startNewGame();
  setupEventListeners();
  initDragDrop(state, onMove);
}

function startNewGame(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  state = createGame();
  recordNewGame();
  renderGame(state);
  hideWinDialog();
  clearHighlights();
  selectedLocation = null;

  // Start timer
  timerInterval = window.setInterval(() => {
    const elapsed = Date.now() - state.startTime;
    updateStats(state.moves, formatTime(elapsed));
  }, 1000);

  updateStats(0, "0:00");
}

function restartGame(): void {
  // Reset to initial deal (would need to store initial state)
  // For now, just start a new game
  startNewGame();
}

function onMove(): void {
  saveGame(state);
  clearHighlights();
  selectedLocation = null;

  if (isWon(state)) {
    handleWin();
  }
}

function handleWin(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const elapsed = Date.now() - state.startTime;
  recordWin(state.moves, elapsed);
  clearSavedGame();
  showWinDialog(state.moves, formatTime(elapsed));
}

function handleUndo(): void {
  if (undo(state)) {
    renderGame(state);
    saveGame(state);
  }
}

function handleHint(): void {
  clearHighlights();
  const hint = findHint(state);
  if (hint) {
    highlightLocation(hint.from);
    highlightLocation(hint.to);
  }
}

function handleCardClick(element: HTMLElement): void {
  // Use the smart click handler with cascade logic
  handleSmartCardClick(element);
}

async function handleCellClick(cell: HTMLElement): Promise<void> {
  if (isAnimating) return;

  const location = getLocationFromCell(cell);
  if (!location) return;

  if (selectedLocation) {
    isAnimating = true;
    const success = await animatedMove(selectedLocation, location);
    if (success) {
      // If we moved to a tableau column from another tableau, cascade from source
      if (selectedLocation.type === "tableau") {
        await cascadeToFoundation(selectedLocation.column);
      }
      onMove();
    }
    clearHighlights();
    selectedLocation = null;
    isAnimating = false;
  }
}

async function handleDoubleClick(element: HTMLElement): Promise<void> {
  if (isAnimating) return;

  const location = getLocationFromElement(element);
  if (!location) return;

  isAnimating = true;

  const autoMove = findAutoMove(state, location);
  if (autoMove) {
    const success = await animatedMove(location, autoMove);
    if (success) {
      // If it was a tableau card, cascade
      if (location.type === "tableau") {
        await cascadeToFoundation(location.column);
      }
      onMove();
    }
  }

  isAnimating = false;
}

function setupEventListeners(): void {
  // Buttons
  document.getElementById("btn-new")!.addEventListener("click", startNewGame);
  document.getElementById("btn-restart")!.addEventListener("click", restartGame);
  document.getElementById("btn-undo")!.addEventListener("click", handleUndo);
  document.getElementById("btn-hint")!.addEventListener("click", handleHint);
  document.getElementById("btn-play-again")!.addEventListener("click", () => {
    hideWinDialog();
    startNewGame();
  });

  // Language select
  const langSelect = document.getElementById("lang-select") as HTMLSelectElement;
  langSelect.addEventListener("change", () => {
    const locale = langSelect.value as Locale;
    setLocale(locale);
    saveLocalePreference(locale);
    const prefs = loadPreferences();
    prefs.locale = locale;
    savePreferences(prefs);
  });

  // Card clicks
  const board = document.querySelector(".game-board")!;
  board.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest(".card") as HTMLElement;
    const cell = target.closest(".cell, .column") as HTMLElement;

    if (card) {
      handleCardClick(card);
    } else if (cell) {
      handleCellClick(cell);
    }
  });

  // Double click for auto-move
  board.addEventListener("dblclick", (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest(".card") as HTMLElement;
    if (card) {
      handleDoubleClick(card);
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ignore if typing in input
    if ((e.target as HTMLElement).tagName === "INPUT") return;

    switch (e.key.toLowerCase()) {
      case "n":
        startNewGame();
        break;
      case "r":
        restartGame();
        break;
      case "z":
        handleUndo();
        break;
      case "h":
        handleHint();
        break;
      case "escape":
        clearHighlights();
        selectedLocation = null;
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8": {
        const col = parseInt(e.key, 10) - 1;
        const column = document.getElementById(`column-${col}`);
        if (column) {
          const lastCard = column.querySelector(".card:last-child") as HTMLElement;
          if (lastCard) {
            handleCardClick(lastCard);
          } else if (selectedLocation) {
            handleCellClick(column);
          }
        }
        break;
      }
      case "a":
      case "b":
      case "c":
      case "d": {
        const idx = e.key.toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
        const cell = document.getElementById(`free-${idx}`);
        if (cell) {
          const card = cell.querySelector(".card") as HTMLElement;
          if (card) {
            handleCardClick(card);
          } else if (selectedLocation) {
            handleCellClick(cell);
          }
        }
        break;
      }
    }
  });
}

function applyPreferences(prefs: { highContrast: boolean; reducedMotion: boolean }): void {
  document.body.classList.toggle("high-contrast", prefs.highContrast);
  document.body.classList.toggle("reduced-motion", prefs.reducedMotion);
}

// Start the app
init();
