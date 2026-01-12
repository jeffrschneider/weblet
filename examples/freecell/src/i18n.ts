/**
 * Internationalization support for Freecell
 */

export type Locale = "en" | "es" | "fr";

export interface Translations {
  [key: string]: string;
}

const translations: Record<Locale, Translations> = {
  en: {
    title: "Freecell",
    new_game: "New Game",
    restart: "Restart",
    undo: "Undo",
    hint: "Hint",
    moves: "Moves",
    time: "Time",
    you_win: "You Win!",
    congratulations: "Congratulations! You completed the game.",
    final_moves: "Moves",
    final_time: "Time",
    play_again: "Play Again",
  },
  es: {
    title: "Freecell",
    new_game: "Nuevo Juego",
    restart: "Reiniciar",
    undo: "Deshacer",
    hint: "Pista",
    moves: "Movimientos",
    time: "Tiempo",
    you_win: "Ganaste!",
    congratulations: "Felicitaciones! Completaste el juego.",
    final_moves: "Movimientos",
    final_time: "Tiempo",
    play_again: "Jugar de Nuevo",
  },
  fr: {
    title: "Freecell",
    new_game: "Nouvelle Partie",
    restart: "Recommencer",
    undo: "Annuler",
    hint: "Indice",
    moves: "Coups",
    time: "Temps",
    you_win: "Vous Avez Gagne!",
    congratulations: "Felicitations! Vous avez termine le jeu.",
    final_moves: "Coups",
    final_time: "Temps",
    play_again: "Rejouer",
  },
};

let currentLocale: Locale = "en";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  document.documentElement.lang = locale;
  updateAllTranslations();
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string): string {
  return translations[currentLocale][key] || translations.en[key] || key;
}

export function updateAllTranslations(): void {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key) {
      element.textContent = t(key);
    }
  });
}

export function initI18n(defaultLocale: Locale = "en"): void {
  // Check for saved preference or browser locale
  const savedLocale = localStorage.getItem("freecell_locale") as Locale | null;
  if (savedLocale && translations[savedLocale]) {
    setLocale(savedLocale);
  } else {
    const browserLocale = navigator.language.split("-")[0] as Locale;
    if (translations[browserLocale]) {
      setLocale(browserLocale);
    } else {
      setLocale(defaultLocale);
    }
  }
}

export function saveLocalePreference(locale: Locale): void {
  localStorage.setItem("freecell_locale", locale);
}
