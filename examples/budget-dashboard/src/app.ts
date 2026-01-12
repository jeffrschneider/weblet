/**
 * Budget Dashboard App - Main entry point
 */

import {
  isAgentLaunched,
  getChartType,
  getTheme,
  initializeData,
  flagExpense,
  setBudget,
  exportReport,
  type Expense,
} from "./agent.ts";
import {
  getSampleData,
  parseCSV,
  parseJSON,
  saveExpenses,
  clearExpenses,
  calculateSummary,
  formatCurrency,
  exportToCSV,
  exportToJSON,
  downloadFile,
} from "./data.ts";
import { renderChart } from "./charts.ts";

// State
let expenses: Expense[] = [];
let currentChartType: "bar" | "line" | "pie" = "bar";

// DOM Elements
const uploadSection = document.getElementById("upload-section")!;
const dashboardSection = document.getElementById("dashboard-section")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const chartTypeSelect = document.getElementById("chart-type") as HTMLSelectElement;
const canvas = document.getElementById("main-chart") as HTMLCanvasElement;
const expenseTbody = document.getElementById("expense-tbody")!;

// Summary elements
const totalExpensesEl = document.getElementById("total-expenses")!;
const avgDailyEl = document.getElementById("avg-daily")!;
const topCategoryEl = document.getElementById("top-category")!;
const transactionCountEl = document.getElementById("transaction-count")!;

// Modals
const budgetModal = document.getElementById("budget-modal")!;
const flagModal = document.getElementById("flag-modal")!;
let currentFlagExpense: Expense | null = null;
let currentBudgetCategory: string | null = null;

/**
 * Initialize the app
 */
async function init(): Promise<void> {
  // Apply theme
  applyTheme(getTheme());

  // Set initial chart type from agent or default
  currentChartType = getChartType();
  chartTypeSelect.value = currentChartType;

  // Load data
  expenses = await initializeData();

  if (expenses.length > 0) {
    showDashboard();
  } else {
    showUpload();
  }

  setupEventListeners();

  // Log agent status
  if (isAgentLaunched()) {
    console.log("Budget Dashboard: Launched by agent with context");
  } else {
    console.log("Budget Dashboard: Running in standalone mode");
  }
}

function showUpload(): void {
  uploadSection.hidden = false;
  dashboardSection.hidden = true;
}

function showDashboard(): void {
  uploadSection.hidden = true;
  dashboardSection.hidden = false;
  updateDashboard();
}

function updateDashboard(): void {
  const summary = calculateSummary(expenses);

  // Update summary cards
  totalExpensesEl.textContent = formatCurrency(summary.total);
  avgDailyEl.textContent = formatCurrency(summary.avgDaily);
  topCategoryEl.textContent = summary.topCategory;
  transactionCountEl.textContent = String(summary.transactionCount);

  // Update chart
  renderChart(canvas, summary, currentChartType);

  // Update expense list (show latest 10)
  renderExpenseList(expenses.slice(0, 10));
}

function renderExpenseList(items: Expense[]): void {
  expenseTbody.innerHTML = items
    .map(
      (exp) => `
    <tr data-expense-id="${exp.id}">
      <td>${exp.date}</td>
      <td><span class="category-badge">${exp.category}</span></td>
      <td>${exp.description}</td>
      <td class="amount">${formatCurrency(exp.amount)}</td>
      <td>
        <button class="btn btn-small btn-flag" data-action="flag">Flag</button>
        <button class="btn btn-small" data-action="budget">Set Budget</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function applyTheme(theme: "light" | "dark" | "auto"): void {
  if (theme === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("dark-theme", prefersDark);
  } else {
    document.body.classList.toggle("dark-theme", theme === "dark");
  }
}

function setupEventListeners(): void {
  // File upload
  fileInput.addEventListener("change", handleFileUpload);

  // Sample data button
  document.getElementById("btn-sample")!.addEventListener("click", () => {
    expenses = getSampleData();
    saveExpenses(expenses);
    showDashboard();
  });

  // Chart type change
  chartTypeSelect.addEventListener("change", () => {
    currentChartType = chartTypeSelect.value as "bar" | "line" | "pie";
    updateDashboard();
  });

  // Export button
  document.getElementById("btn-export")!.addEventListener("click", handleExport);

  // Clear data button
  document.getElementById("btn-clear")!.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all expense data?")) {
      expenses = [];
      clearExpenses();
      showUpload();
    }
  });

  // Expense list actions
  expenseTbody.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    const row = target.closest("tr");
    if (!row || !action) return;

    const expenseId = row.dataset.expenseId;
    const expense = expenses.find((ex) => ex.id === expenseId);
    if (!expense) return;

    if (action === "flag") {
      openFlagModal(expense);
    } else if (action === "budget") {
      openBudgetModal(expense.category);
    }
  });

  // Flag modal
  document.getElementById("btn-cancel-flag")!.addEventListener("click", closeFlagModal);
  document.getElementById("btn-submit-flag")!.addEventListener("click", submitFlag);

  // Budget modal
  document.getElementById("btn-cancel-budget")!.addEventListener("click", closeBudgetModal);
  document.getElementById("btn-save-budget")!.addEventListener("click", submitBudget);
}

async function handleFileUpload(): Promise<void> {
  const file = fileInput.files?.[0];
  if (!file) return;

  const text = await file.text();
  let parsed: Expense[] = [];

  if (file.name.endsWith(".csv")) {
    parsed = parseCSV(text);
  } else if (file.name.endsWith(".json")) {
    parsed = parseJSON(text);
  }

  if (parsed.length > 0) {
    expenses = parsed;
    saveExpenses(expenses);
    showDashboard();
  } else {
    alert("Could not parse the file. Please check the format.");
  }

  fileInput.value = "";
}

async function handleExport(): Promise<void> {
  const format = "csv"; // Could add format selector

  await exportReport(format, expenses, () => {
    // Fallback: browser download
    const content = format === "csv" ? exportToCSV(expenses) : exportToJSON(expenses);
    const mimeType = format === "csv" ? "text/csv" : "application/json";
    const filename = `budget-report-${new Date().toISOString().split("T")[0]}.${format}`;
    downloadFile(content, filename, mimeType);
  });
}

function openFlagModal(expense: Expense): void {
  currentFlagExpense = expense;
  document.getElementById("flag-expense-info")!.textContent =
    `${expense.date} - ${expense.category}: ${formatCurrency(expense.amount)}`;
  (document.getElementById("flag-reason") as HTMLTextAreaElement).value = "";
  flagModal.hidden = false;
}

function closeFlagModal(): void {
  flagModal.hidden = true;
  currentFlagExpense = null;
}

async function submitFlag(): Promise<void> {
  if (!currentFlagExpense) return;

  const reason = (document.getElementById("flag-reason") as HTMLTextAreaElement).value;
  await flagExpense(currentFlagExpense, reason);

  closeFlagModal();
  alert("Expense flagged successfully!");
}

function openBudgetModal(category: string): void {
  currentBudgetCategory = category;
  document.getElementById("budget-category")!.textContent = category;
  (document.getElementById("budget-amount") as HTMLInputElement).value = "";
  budgetModal.hidden = false;
}

function closeBudgetModal(): void {
  budgetModal.hidden = true;
  currentBudgetCategory = null;
}

async function submitBudget(): Promise<void> {
  if (!currentBudgetCategory) return;

  const amount = parseFloat(
    (document.getElementById("budget-amount") as HTMLInputElement).value
  );
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid budget amount");
    return;
  }

  await setBudget(currentBudgetCategory, amount);

  closeBudgetModal();
  alert(`Budget set for ${currentBudgetCategory}: ${formatCurrency(amount)}`);
}

// Initialize on load
init();
