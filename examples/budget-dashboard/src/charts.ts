/**
 * Chart rendering for budget dashboard
 */

import { Chart, registerables } from "chart.js";
import type { Summary } from "./data.ts";

// Register Chart.js components
Chart.register(...registerables);

let currentChart: Chart | null = null;

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#ef4444",
  Transport: "#3b82f6",
  Entertainment: "#8b5cf6",
  Shopping: "#f59e0b",
  Utilities: "#10b981",
  Healthcare: "#ec4899",
  Other: "#6b7280",
};

function getColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}

/**
 * Create or update the main chart
 */
export function renderChart(
  canvas: HTMLCanvasElement,
  summary: Summary,
  chartType: "bar" | "line" | "pie"
): void {
  // Destroy existing chart
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (chartType === "pie") {
    renderPieChart(ctx, summary);
  } else if (chartType === "line") {
    renderLineChart(ctx, summary);
  } else {
    renderBarChart(ctx, summary);
  }
}

function renderBarChart(ctx: CanvasRenderingContext2D, summary: Summary): void {
  const categories = Object.keys(summary.byCategory);
  const values = Object.values(summary.byCategory);
  const colors = categories.map(getColor);

  currentChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: categories,
      datasets: [
        {
          label: "Spending by Category",
          data: values,
          backgroundColor: colors,
          borderColor: colors.map((c) => c),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: "Spending by Category",
          font: { size: 16 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `$${value}`,
          },
        },
      },
    },
  });
}

function renderLineChart(ctx: CanvasRenderingContext2D, summary: Summary): void {
  // Sort dates chronologically
  const dates = Object.keys(summary.byDate).sort();
  const values = dates.map((d) => summary.byDate[d]);

  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Daily Spending",
          data: values,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: "Spending Over Time",
          font: { size: 16 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `$${value}`,
          },
        },
      },
    },
  });
}

function renderPieChart(ctx: CanvasRenderingContext2D, summary: Summary): void {
  const categories = Object.keys(summary.byCategory);
  const values = Object.values(summary.byCategory);
  const colors = categories.map(getColor);

  currentChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: categories,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
        },
        title: {
          display: true,
          text: "Spending Distribution",
          font: { size: 16 },
        },
      },
    },
  });
}

/**
 * Destroy the current chart
 */
export function destroyChart(): void {
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
}
