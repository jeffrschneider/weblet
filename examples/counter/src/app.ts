/**
 * Counter App - initialization and DOM binding
 */
import { Counter } from "./counter.ts";

// Initialize counter
const counter = new Counter(0);

// Get DOM elements
const displayEl = document.getElementById("counter-value") as HTMLElement;
const incrementBtn = document.getElementById("increment") as HTMLButtonElement;
const decrementBtn = document.getElementById("decrement") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;

// Update display when counter changes
counter.setOnChange((value: number) => {
  displayEl.textContent = value.toString();

  // Add visual feedback for positive/negative
  displayEl.classList.remove("positive", "negative");
  if (value > 0) {
    displayEl.classList.add("positive");
  } else if (value < 0) {
    displayEl.classList.add("negative");
  }
});

// Bind button events
incrementBtn.addEventListener("click", () => counter.increment());
decrementBtn.addEventListener("click", () => counter.decrement());
resetBtn.addEventListener("click", () => counter.reset());

// Initial render
displayEl.textContent = counter.getValue().toString();
