// src/context/CalculationContext.jsx
//
// SINGLE SOURCE OF TRUTH for all calculator-derived values.
//
// Architecture:
//   - One CalculatorEngine instance, recreated only when categories or settings change
//   - calculateTotals() called once → result shared to ALL consumers (CostSummary,
//     AdditionalCosts, PaymentTracking)
//   - calculatePaymentDetails() reuses the already-computed grandTotal (no double traverse)
//   - calculateCategoryBreakdowns() cached on same engine instance
//
// Components must NOT instantiate CalculatorEngine themselves when inside this provider.
// They read from useCalculation() and write to useSettings() / useCategories().
//
// EXPORT NOTE: The raw `CalculationContext` object is exported so that components
// rendered both inside and outside this provider (e.g. CostBreakdown) can call
// useContext(CalculationContext) and receive null when no provider is present,
// rather than throwing.  The useCalculation() hook remains the preferred API for
// components that are always rendered inside the provider.

import React, { createContext, useContext, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { CalculatorEngine } from "../components/Calculator/engine/CalculatorEngine";
import { useCategories } from "./CategoriesContext";
import { useSettings } from "./SettingsContext";
import { useWorkType } from "./WorkTypeContext";

// ─── Context ──────────────────────────────────────────────────────────────────
// Initialised to null so that useContext(CalculationContext) returns null when
// called outside the provider (instead of the stale default object).
export const CalculationContext = createContext(null);

// ─── Empty / fallback shapes ──────────────────────────────────────────────────

const EMPTY_TOTALS = {
  materialCost: "0.00",
  laborCost: "0.00",
  laborCostBeforeDiscount: "0.00",
  laborDiscount: "0.00",
  wasteCost: "0.00",
  taxAmount: "0.00",
  markupAmount: "0.00",
  miscFeesTotal: "0.00",
  transportationFee: "0.00",
  subtotal: "0.00",
  total: "0.00",
  totalUnits: 0,
  errors: [],
  warnings: [],
  summary: {
    totalItems: 0,
    validItems: 0,
    invalidItems: 0,
    totalCategories: 0,
  },
};

const EMPTY_PAYMENTS = {
  totalPaid: "0.00",
  totalDue: "0.00",
  overduePayments: "0.00",
  grandTotal: "0.00",
  deposit: "0.00",
  errors: [],
  warnings: [],
  summary: { totalPayments: 0, paidPayments: 0, overduePayments: 0 },
};

const EMPTY_BREAKDOWNS = {
  breakdowns: [],
  errors: [],
  warnings: [],
  summary: {
    totalCategories: 0,
    validCategories: 0,
    totalItems: 0,
    validItems: 0,
  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CalculationProvider({ children }) {
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } =
    useWorkType();

  // Single engine instance — recreated only when inputs change.
  // All three calculation methods share the same cache.
  const engine = useMemo(() => {
    if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails)
      return null;

    return new CalculatorEngine(
      categories || [],
      settings || {},
      { getMeasurementType, isValidSubtype, getWorkTypeDetails },
      { enableCaching: true, strictValidation: false, timeoutMs: 30000 },
    );
  }, [
    categories,
    settings,
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
  ]);

  // ── Core calculations ──────────────────────────────────────────────────────

  // calculateTotals() is the most expensive call — run it once and share.
  const totals = useMemo(() => {
    if (!engine) return EMPTY_TOTALS;
    try {
      return engine.calculateTotals();
    } catch (err) {
      console.error("[CalculationContext] calculateTotals error:", err);
      return { ...EMPTY_TOTALS, errors: [err.message || "Calculation failed"] };
    }
  }, [engine]);

  // Pass the already-computed grandTotal so calculatePaymentDetails reuses it
  // without traversing all work items a second time.
  const paymentDetails = useMemo(() => {
    if (!engine) return EMPTY_PAYMENTS;
    try {
      return engine.calculatePaymentDetails(totals.total);
    } catch (err) {
      console.error("[CalculationContext] calculatePaymentDetails error:", err);
      return {
        ...EMPTY_PAYMENTS,
        errors: [err.message || "Payment calculation failed"],
      };
    }
  }, [engine, totals.total]);

  // Category breakdowns — used by any component needing per-category detail.
  const categoryBreakdowns = useMemo(() => {
    if (!engine) return EMPTY_BREAKDOWNS;
    try {
      return engine.calculateCategoryBreakdowns();
    } catch (err) {
      console.error(
        "[CalculationContext] calculateCategoryBreakdowns error:",
        err,
      );
      return {
        ...EMPTY_BREAKDOWNS,
        errors: [err.message || "Breakdown calculation failed"],
      };
    }
  }, [engine]);

  // ── Derived convenience values ─────────────────────────────────────────────
  // Parse once here so consumers get plain numbers, not strings.

  const derived = useMemo(() => {
    const grandTotal = parseFloat(totals.total) || 0;
    const totalPaid = parseFloat(paymentDetails.totalPaid) || 0;
    const totalDue = parseFloat(paymentDetails.totalDue) || 0;
    const deposit = parseFloat(paymentDetails.deposit) || 0;
    const overdue = parseFloat(paymentDetails.overduePayments) || 0;
    const material = parseFloat(totals.materialCost) || 0;
    const labor = parseFloat(totals.laborCost) || 0;
    const laborBeforeDiscount = parseFloat(totals.laborCostBeforeDiscount) || 0;
    const discountAmount = laborBeforeDiscount - labor;
    const discountPct =
      laborBeforeDiscount > 0 ? discountAmount / laborBeforeDiscount : 0;
    const waste = parseFloat(totals.wasteCost) || 0;
    const tax = parseFloat(totals.taxAmount) || 0;
    const markup = parseFloat(totals.markupAmount) || 0;
    const misc = parseFloat(totals.miscFeesTotal) || 0;
    const transportation = parseFloat(totals.transportationFee) || 0;
    const subtotal = parseFloat(totals.subtotal) || 0;
    const remainingBalance = Math.max(0, grandTotal - totalPaid);
    const hasOverpayment = totalPaid > grandTotal;
    const overpayment = hasOverpayment ? totalPaid - grandTotal : 0;

    return {
      grandTotal,
      totalPaid,
      totalDue,
      deposit,
      overdue,
      remainingBalance,
      hasOverpayment,
      overpayment,
      material,
      labor,
      laborBeforeDiscount,
      discountAmount,
      discountPct,
      waste,
      tax,
      markup,
      misc,
      transportation,
      subtotal,
      totalAdjustments: waste + tax + markup + misc + transportation,
    };
  }, [totals, paymentDetails]);

  // ── Engine status ──────────────────────────────────────────────────────────

  const hasErrors = useMemo(
    () => totals.errors?.length > 0 || paymentDetails.errors?.length > 0,
    [totals.errors, paymentDetails.errors],
  );

  const isReady = engine !== null;

  // ── Cache stats for debugging ──────────────────────────────────────────────

  const getCacheStats = useCallback(() => {
    return (
      engine?.getCacheStats() ?? {
        hits: 0,
        misses: 0,
        hitRate: "0%",
        cacheSize: 0,
      }
    );
  }, [engine]);

  // ─────────────────────────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      // Raw engine outputs (string amounts, error arrays)
      totals,
      paymentDetails,
      categoryBreakdowns,
      // Parsed number values for convenient consumption
      derived,
      // Meta
      isReady,
      hasErrors,
      getCacheStats,
    }),
    [
      totals,
      paymentDetails,
      categoryBreakdowns,
      derived,
      isReady,
      hasErrors,
      getCacheStats,
    ],
  );

  return (
    <CalculationContext.Provider value={value}>
      {children}
    </CalculationContext.Provider>
  );
}

CalculationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Use this hook in components that are ALWAYS rendered inside CalculationProvider.
// Components that may be rendered outside the provider should use
// useContext(CalculationContext) directly and handle the null case themselves.

export function useCalculation() {
  const ctx = useContext(CalculationContext);
  if (!ctx) {
    throw new Error("useCalculation must be used within a CalculationProvider");
  }
  return ctx;
}
