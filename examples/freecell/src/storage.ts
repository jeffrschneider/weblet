/**
 * Storage handling for Freecell
 * Saves game state, statistics, and preferences
 */

import type { GameState } from "./game.ts";

const STORAGE_PREFIX = "freecell_";

export interface Statistics {
  gamesPlayed: number;
  gamesWon: number;
  fastestWin: number | null; // milliseconds
  fewestMoves: number | null;
}

export interface Preferences {
  locale: string;
  highContrast: boolean;
  reducedMotion: boolean;
}

export function saveGame(state: GameState): void {
  const saveData = {
    freeCells: state.freeCells,
    foundations: state.foundations,
    tableau: state.tableau,
    moves: state.moves,
    startTime: state.startTime,
  };
  localStorage.setItem(
    `${STORAGE_PREFIX}current_game`,
    JSON.stringify(saveData)
  );
}

export function loadGame(): Partial<GameState> | null {
  const data = localStorage.getItem(`${STORAGE_PREFIX}current_game`);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  localStorage.removeItem(`${STORAGE_PREFIX}current_game`);
}

export function loadStatistics(): Statistics {
  const data = localStorage.getItem(`${STORAGE_PREFIX}statistics`);
  if (!data) {
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      fastestWin: null,
      fewestMoves: null,
    };
  }

  try {
    return JSON.parse(data);
  } catch {
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      fastestWin: null,
      fewestMoves: null,
    };
  }
}

export function saveStatistics(stats: Statistics): void {
  localStorage.setItem(`${STORAGE_PREFIX}statistics`, JSON.stringify(stats));
}

export function recordWin(moves: number, timeMs: number): void {
  const stats = loadStatistics();
  stats.gamesWon++;

  if (stats.fastestWin === null || timeMs < stats.fastestWin) {
    stats.fastestWin = timeMs;
  }

  if (stats.fewestMoves === null || moves < stats.fewestMoves) {
    stats.fewestMoves = moves;
  }

  saveStatistics(stats);
}

export function recordNewGame(): void {
  const stats = loadStatistics();
  stats.gamesPlayed++;
  saveStatistics(stats);
}

export function loadPreferences(): Preferences {
  const data = localStorage.getItem(`${STORAGE_PREFIX}preferences`);
  if (!data) {
    return {
      locale: "en",
      highContrast: false,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    };
  }

  try {
    return JSON.parse(data);
  } catch {
    return {
      locale: "en",
      highContrast: false,
      reducedMotion: false,
    };
  }
}

export function savePreferences(prefs: Preferences): void {
  localStorage.setItem(`${STORAGE_PREFIX}preferences`, JSON.stringify(prefs));
}
