/**
 * Freecell App - Main entry point
 */

import {
  GameState,
  createGame,
  moveCards,
  undo,
  isWon,
  findHint,
  findAutoMove,
  Location,
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
import { initI18n, setLocale, saveLocalePreference, Locale } from "./i18n.ts";

// Game state
let state: GameState;
let timerInterval: number | null = null;
let selectedLocation: Location | null = null;

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
  const location = getLocationFromElement(element);
  if (!location) return;

  if (selectedLocation) {
    // Try to move to this location
    const result = moveCards(state, selectedLocation, location);
    if (result.success) {
      renderGame(state);
      onMove();
    }
    clearHighlights();
    selectedLocation = null;
  } else {
    // Select this card
    selectedLocation = location;
    const cardId = element.dataset.cardId;
    if (cardId) {
      highlightCard(cardId);
    }
  }
}

function handleCellClick(cell: HTMLElement): void {
  const location = getLocationFromCell(cell);
  if (!location) return;

  if (selectedLocation) {
    const result = moveCards(state, selectedLocation, location);
    if (result.success) {
      renderGame(state);
      onMove();
    }
    clearHighlights();
    selectedLocation = null;
  }
}

function handleDoubleClick(element: HTMLElement): void {
  const location = getLocationFromElement(element);
  if (!location) return;

  const autoMove = findAutoMove(state, location);
  if (autoMove) {
    const result = moveCards(state, location, autoMove);
    if (result.success) {
      renderGame(state);
      onMove();
    }
  }
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
