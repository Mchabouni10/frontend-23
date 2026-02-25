// src/components/Calculator/utils/additionalRevenueCalculator.js
/**
 * SHARED ADDITIONAL REVENUE CALCULATOR
 * =====================================
 * Re-exports from the canonical financialCalculator so there is one formula
 * everywhere.  This file is kept so existing imports don't break.
 *
 * ADDITIONAL REVENUE = Markup + Transportation Fee ONLY (fully-paid projects)
 * ❌ Waste, Tax, Misc Fees are NOT part of additional revenue.
 *
 * ⚠️  MARKUP BASE FIX:
 * The CalculatorEngine formula is:
 *   subtotal = (materialCost + waste) + adjustedLaborCost
 *   markup   = subtotal × markupRate    ← waste IS included in the base
 *
 * The old version of this file used:
 *   baseSubtotal = materialCost + laborCost   ← waste EXCLUDED → wrong markup
 *
 * This file now delegates everything to financialCalculator.js which is
 * the single source of truth and matches the engine exactly.
 */

import {
  calculateProjectCosts as _calcCosts,
  calculateProjectPayments as _calcPayments,
} from "./financialCalculator";

// ─── Internal helpers (not exported — for use within this file only) ──────────

const _getProjectAdditionalRevenue = (project) => {
  const payments = _calcPayments(project);
  if (!payments.isFullyPaid) return { markup: 0, transportation: 0, total: 0 };
  const costs = _calcCosts(project);
  return {
    markup: costs.markup,
    transportation: costs.transportation,
    total: costs.markup + costs.transportation,
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Total project value (what the customer owes in full).
 * Used for payment balance checks.
 */
export const calculateTotalProjectValue = (project) => {
  return _calcCosts(project).totalProjectValue;
};

/**
 * Check if a project is fully paid.
 */
export const isProjectFullyPaid = (project) => {
  return _calcPayments(project).isFullyPaid;
};

/**
 * Additional revenue for a single project (markup + transportation).
 * Returns zeroes if not fully paid.
 */
export const getProjectAdditionalRevenue = (project) => {
  return _getProjectAdditionalRevenue(project);
};

/**
 * Aggregate additional revenue from an array of projects with optional filters.
 */
export const calculateAdditionalRevenue = (projects, filters = {}) => {
  if (!Array.isArray(projects)) {
    return { totalMarkup: 0, totalTransportation: 0, total: 0, projectCount: 0 };
  }

  let totalMarkup = 0;
  let totalTransportation = 0;
  let projectCount = 0;

  projects.forEach((project) => {
    // Date filter
    if (filters.year || filters.startDate || filters.endDate) {
      const dateStr = project.customerInfo?.startDate;
      if (!dateStr) return;
      const d = new Date(dateStr);

      if (filters.year && d.getFullYear() !== filters.year) return;

      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (d < start || d > end) return;
      }
    }

    if (!isProjectFullyPaid(project)) return;

    const rev = _getProjectAdditionalRevenue(project);
    totalMarkup += rev.markup;
    totalTransportation += rev.transportation;
    projectCount++;
  });

  return {
    totalMarkup,
    totalTransportation,
    total: totalMarkup + totalTransportation,
    projectCount,
  };
};

/**
 * Additional revenue for the current calendar year only.
 */
export const calculateYearlyAdditionalRevenue = (projects) => {
  const currentYear = new Date().getFullYear();
  return calculateAdditionalRevenue(projects, { year: currentYear });
};

/**
 * Breakdown by payment status and year.
 */
export const calculateAdditionalRevenueBreakdown = (projects) => {
  const result = {
    byStatus: {
      fullyPaid: { count: 0, markup: 0, transportation: 0, total: 0 },
      outstanding: { count: 0, markup: 0, transportation: 0, total: 0 },
    },
    byYear: {},
  };

  if (!Array.isArray(projects)) return result;

  projects.forEach((project) => {
    const fullyPaid = isProjectFullyPaid(project);
    const status = fullyPaid ? "fullyPaid" : "outstanding";
    result.byStatus[status].count++;

    if (fullyPaid) {
      const rev = _getProjectAdditionalRevenue(project);
      result.byStatus[status].markup += rev.markup;
      result.byStatus[status].transportation += rev.transportation;
      result.byStatus[status].total += rev.total;
    }

    const dateStr = project.customerInfo?.startDate;
    if (dateStr) {
      const year = new Date(dateStr).getFullYear();
      if (!result.byYear[year]) {
        result.byYear[year] = { count: 0, markup: 0, transportation: 0, total: 0 };
      }
      result.byYear[year].count++;

      if (fullyPaid) {
        const rev = _getProjectAdditionalRevenue(project);
        result.byYear[year].markup += rev.markup;
        result.byYear[year].transportation += rev.transportation;
        result.byYear[year].total += rev.total;
      }
    }
  });

  return result;
};

/** Format a number as a US currency string (no $ sign). */
export const formatCurrency = (amount) =>
  (parseFloat(amount) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Summary string for customer list footer, e.g. "+ $2,191.53 Add. Revenue" */
export const getAdditionalRevenueSummary = (projects, filters = {}) => {
  const { total } = calculateAdditionalRevenue(projects, filters);
  return `+ $${formatCurrency(total)} Add. Revenue`;
};