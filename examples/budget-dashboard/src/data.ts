/**
 * Data handling for budget dashboard
 */

import type { Expense } from "./agent.ts";

const STORAGE_KEY = "budget_expenses";

/**
 * Sample expense data for demo
 */
export function getSampleData(): Expense[] {
  const categories = ["Food", "Transport", "Entertainment", "Shopping", "Utilities", "Healthcare"];
  const descriptions: Record<string, string[]> = {
    Food: ["Grocery store", "Restaurant", "Coffee shop", "Food delivery", "Lunch"],
    Transport: ["Gas station", "Uber ride", "Bus pass", "Parking", "Car wash"],
    Entertainment: ["Movie tickets", "Streaming service", "Concert", "Video game", "Books"],
    Shopping: ["Clothing", "Electronics", "Home goods", "Amazon", "Target"],
    Utilities: ["Electric bill", "Water bill", "Internet", "Phone bill", "Gas bill"],
    Healthcare: ["Pharmacy", "Doctor visit", "Gym membership", "Vitamins", "Dentist"],
  };

  const expenses: Expense[] = [];
  const today = new Date();

  // Generate 30 days of sample data
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // 1-3 expenses per day
    const count = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < count; j++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const desc = descriptions[category];

      expenses.push({
        id: `exp-${i}-${j}`,
        date: date.toISOString().split("T")[0],
        amount: Math.round((Math.random() * 100 + 5) * 100) / 100,
        category,
        description: desc[Math.floor(Math.random() * desc.length)],
      });
    }
  }

  return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Parse CSV data into expenses
 */
export function parseCSV(csv: string): Expense[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  // Skip header row
  const expenses: Expense[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((s) => s.trim());
    if (parts.length >= 4) {
      expenses.push({
        id: `csv-${i}`,
        date: parts[0],
        amount: parseFloat(parts[1]) || 0,
        category: parts[2],
        description: parts[3],
      });
    }
  }

  return expenses;
}

/**
 * Parse JSON data into expenses
 */
export function parseJSON(json: string): Expense[] {
  try {
    const data = JSON.parse(json);
    if (Array.isArray(data)) {
      return data.map((item, i) => ({
        id: item.id || `json-${i}`,
        date: item.date || "",
        amount: parseFloat(item.amount) || 0,
        category: item.category || "Other",
        description: item.description || "",
      }));
    }
  } catch {
    // Invalid JSON
  }
  return [];
}

/**
 * Save expenses to local storage
 */
export function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

/**
 * Load expenses from local storage
 */
export function loadExpenses(): Expense[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // Invalid data
    }
  }
  return [];
}

/**
 * Clear saved expenses
 */
export function clearExpenses(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Calculate summary statistics
 */
export interface Summary {
  total: number;
  avgDaily: number;
  topCategory: string;
  transactionCount: number;
  byCategory: Record<string, number>;
  byDate: Record<string, number>;
}

export function calculateSummary(expenses: Expense[]): Summary {
  if (expenses.length === 0) {
    return {
      total: 0,
      avgDaily: 0,
      topCategory: "-",
      transactionCount: 0,
      byCategory: {},
      byDate: {},
    };
  }

  const byCategory: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  let total = 0;

  for (const exp of expenses) {
    total += exp.amount;
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
    byDate[exp.date] = (byDate[exp.date] || 0) + exp.amount;
  }

  // Find top category
  let topCategory = "-";
  let topAmount = 0;
  for (const [cat, amount] of Object.entries(byCategory)) {
    if (amount > topAmount) {
      topAmount = amount;
      topCategory = cat;
    }
  }

  // Calculate daily average
  const uniqueDays = Object.keys(byDate).length;
  const avgDaily = uniqueDays > 0 ? total / uniqueDays : 0;

  return {
    total,
    avgDaily,
    topCategory,
    transactionCount: expenses.length,
    byCategory,
    byDate,
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Export expenses to CSV
 */
export function exportToCSV(expenses: Expense[]): string {
  const header = "date,amount,category,description";
  const rows = expenses.map(
    (e) => `${e.date},${e.amount},${e.category},"${e.description}"`
  );
  return [header, ...rows].join("\n");
}

/**
 * Export expenses to JSON
 */
export function exportToJSON(expenses: Expense[]): string {
  return JSON.stringify(expenses, null, 2);
}

/**
 * Download data as file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
