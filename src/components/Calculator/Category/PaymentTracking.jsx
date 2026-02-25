// src/components/Calculator/Category/PaymentTracking.jsx

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Decimal from "decimal.js";
import { useSettings } from "../../../context/SettingsContext";
import { useCalculation } from "../../../context/CalculationContext";
import SectionHeader from "./SectionHeader";
import styles from "./PaymentTracking.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_TYPES = {
  DEPOSIT: "Deposit",
  INSTALLMENT: "Installment",
  ONE_TIME: "One-Time",
};

const PAYMENT_METHODS = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "Check",
  "Bank Transfer",
  "Zelle",
  "PayPal",
  "Venmo",
  "CashApp",
  "Other",
];

const INSTALLMENT_DURATIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseSafeDate(dateString) {
  if (!dateString) return new Date();
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

function formatDateForInput(date) {
  try {
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function todayString() {
  return formatDateForInput(new Date());
}

function validatePayment(payment) {
  const errors = [];

  if (!payment.amount || parseFloat(payment.amount) <= 0) {
    errors.push("Amount must be greater than 0");
  }

  if (!payment.date) {
    errors.push("Date is required");
  } else {
    const date = parseSafeDate(payment.date);
    if (isNaN(date.getTime())) {
      errors.push("Invalid date");
    }
  }

  if (payment.type === PAYMENT_TYPES.DEPOSIT && payment.amount) {
    const amount = parseFloat(payment.amount);
    if (amount > 1000000) {
      errors.push("Deposit amount seems unusually high");
    }
  }

  return errors;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PaymentTracking({ disabled = false }) {
  const { settings, setSettings } = useSettings();
  const { derived } = useCalculation();

  // ── Refs for preventing circular updates ────────────────────────────────────
  const isUpdatingRef = useRef(false);
  const lastBalanceRef = useRef(null);

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});

  // Installment plan form
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [installmentDuration, setInstallmentDuration] = useState("6");
  const [installmentStartDate, setInstallmentStartDate] = useState(
    todayString(),
  );
  const [generatedInstallments, setGeneratedInstallments] = useState([]);

  // One-time payment form
  const [showOneTimeForm, setShowOneTimeForm] = useState(false);
  const [oneTimePayment, setOneTimePayment] = useState({
    id: generateId(),
    date: todayString(),
    amount: "",
    method: "Cash",
    note: "",
    isPaid: true,
    type: PAYMENT_TYPES.ONE_TIME,
  });

  // Auto-recalculate toggle
  const [autoRecalculate, setAutoRecalculate] = useState(true);

  // ── Deposit local state (prevents single-digit bug) ─────────────────────────
  // We keep a raw string while the user types, only commit on blur/Enter.
  // Once committed the row is locked until the user clicks Edit.
  const [depositRaw, setDepositRaw] = useState("");
  const [depositDateRaw, setDepositDateRaw] = useState(todayString());
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositEditMode, setDepositEditMode] = useState(false); // true = editing existing deposit
  const [depositInputError, setDepositInputError] = useState("");

  // ── Derived data from payments ──────────────────────────────────────────────
  const payments = useMemo(() => settings.payments || [], [settings.payments]);

  // Group payments by type with stable IDs
  const { depositPayment, installmentPayments, oneTimePayments } =
    useMemo(() => {
      const result = {
        depositPayment: null,
        installmentPayments: [],
        oneTimePayments: [],
      };

      payments.forEach((payment) => {
        // Always use type for identification (standardized)
        if (payment.type === PAYMENT_TYPES.DEPOSIT) {
          result.depositPayment = payment;
        } else if (payment.type === PAYMENT_TYPES.INSTALLMENT) {
          result.installmentPayments.push(payment);
        } else {
          result.oneTimePayments.push(payment);
        }
      });

      // Sort installments by date and number
      result.installmentPayments.sort((a, b) => {
        if (a.installmentNumber && b.installmentNumber) {
          return a.installmentNumber - b.installmentNumber;
        }
        return new Date(a.date) - new Date(b.date);
      });

      return result;
    }, [payments]);

  const hasInstallmentPlan = installmentPayments.length > 0;

  const installmentStats = useMemo(() => {
    const paid = installmentPayments.filter((p) => p.isPaid);
    return {
      total: installmentPayments.length,
      paid: paid.length,
      totalAmount: installmentPayments.reduce(
        (s, p) => s + (parseFloat(p.amount) || 0),
        0,
      ),
      paidAmount: paid.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
    };
  }, [installmentPayments]);

  // ── Safe payment update function (prevents circular updates) ────────────────

  const updatePayments = useCallback(
    (updater) => {
      if (isUpdatingRef.current) return;

      isUpdatingRef.current = true;

      setSettings((prev) => {
        const currentPayments = prev.payments || [];
        const newPayments =
          typeof updater === "function" ? updater(currentPayments) : updater;

        // Validate all payments
        const errors = {};
        newPayments.forEach((p, idx) => {
          const paymentErrors = validatePayment(p);
          if (paymentErrors.length > 0) {
            errors[p.id || `payment_${idx}`] = paymentErrors;
          }
        });

        setValidationErrors(errors);

        return {
          ...prev,
          payments: newPayments,
        };
      });

      // Release the lock after React has a chance to update
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    },
    [setSettings],
  );

  // ── Auto-recalculate installments ───────────────────────────────────────────
  // FIXED: Circular update eliminated with isUpdatingRef guard

  useEffect(() => {
    // Skip if:
    // - Already updating
    // - Auto-recalc disabled
    // - No installment plan
    // - Balance hasn't changed
    if (
      isUpdatingRef.current ||
      !autoRecalculate ||
      !hasInstallmentPlan ||
      derived.remainingBalance === lastBalanceRef.current
    ) {
      return;
    }

    const balance = derived.remainingBalance;
    lastBalanceRef.current = balance;

    if (balance <= 0) return;

    // Find unpaid, non-manually-adjusted installments
    const unpaidInstallments = installmentPayments.filter(
      (p) => !p.isPaid && !p.manuallyAdjusted,
    );

    if (unpaidInstallments.length === 0) return;

    // Calculate new amounts using Decimal for precision
    const balanceDec = new Decimal(balance);
    const count = unpaidInstallments.length;
    const perInstallment = balanceDec.dividedBy(count);

    // Use bankers rounding for currency
    const perInstallmentRounded = Decimal.round(
      perInstallment.times(100),
    ).dividedBy(100);

    // Calculate total of rounded amounts
    const totalRounded = perInstallmentRounded.times(count);

    // Adjust last payment if there's a rounding discrepancy
    const discrepancy = balanceDec.minus(totalRounded);

    updatePayments((prev) => {
      const updated = [...prev];

      unpaidInstallments.forEach((payment, index) => {
        const idx = updated.findIndex((p) => p.id === payment.id);
        if (idx !== -1) {
          let amount = perInstallmentRounded;
          // Add discrepancy to last payment
          if (
            index === unpaidInstallments.length - 1 &&
            !discrepancy.isZero()
          ) {
            amount = amount.plus(discrepancy);
          }

          updated[idx] = {
            ...updated[idx],
            amount: amount.toFixed(2),
          };
        }
      });

      return updated;
    });
  }, [
    derived.remainingBalance,
    autoRecalculate,
    hasInstallmentPlan,
    installmentPayments,
    updatePayments,
  ]);

  // ── Deposit mutators ────────────────────────────────────────────────────────

  // Keep raw fields in sync when an existing deposit is loaded (e.g. from context)
  // but only when we're not actively editing.
  const prevDepositRef = useRef(null);
  useEffect(() => {
    if (!depositEditMode && depositPayment) {
      const changed =
        prevDepositRef.current?.amount !== depositPayment.amount ||
        prevDepositRef.current?.date !== depositPayment.date;
      if (changed) {
        setDepositRaw(depositPayment.amount);
        setDepositDateRaw(depositPayment.date);
        setDepositMethod(depositPayment.method || "Cash");
        prevDepositRef.current = depositPayment;
      }
    }
  }, [depositPayment, depositEditMode]);

  const commitDeposit = useCallback(() => {
    const num = parseFloat(depositRaw);
    if (!depositRaw || isNaN(num) || num <= 0) {
      setDepositInputError("Enter a valid amount greater than 0");
      return false;
    }

    // Prevent multiple deposits for a single project.
    // Guard not only on explicit Deposit-type rows, but also on legacy
    // "deposit-like" payments where the note or method indicates a deposit.
    const hasExistingDepositLikePayment = payments.some((p) => {
      if (!p) return false;
      if (p.type === PAYMENT_TYPES.DEPOSIT) return true;
      const note = (p.note || "").toLowerCase();
      const method = (p.method || "").toLowerCase();
      return note.includes("deposit") || method === "deposit";
    });

    if (!depositEditMode && hasExistingDepositLikePayment) {
      setDepositInputError(
        "A deposit is already recorded for this project. Edit or delete the existing deposit instead of adding a new one.",
      );
      return false;
    }

    setDepositInputError("");
    updatePayments((prev) => {
      const existingDeposit = prev.find(
        (p) => p.type === PAYMENT_TYPES.DEPOSIT,
      );
      const updated = prev.filter((p) => p.type !== PAYMENT_TYPES.DEPOSIT);
      const deposit = {
        id: existingDeposit?.id || generateId(),
        date: depositDateRaw,
        amount: num.toFixed(2),
        method: depositMethod,
        note: "Initial Deposit",
        isPaid: true,
        type: PAYMENT_TYPES.DEPOSIT,
      };
      return [deposit, ...updated];
    });
    setDepositEditMode(false);
    return true;
  }, [
    depositRaw,
    depositDateRaw,
    depositMethod,
    payments,
    depositEditMode,
    updatePayments,
  ]);

  const removeDeposit = useCallback(() => {
    if (!window.confirm("Remove the deposit?")) return;
    updatePayments((prev) =>
      prev.filter((p) => p.type !== PAYMENT_TYPES.DEPOSIT),
    );
    setDepositRaw("");
    setDepositDateRaw(todayString());
    setDepositMethod("Cash");
    setDepositEditMode(false);
    prevDepositRef.current = null;
  }, [updatePayments]);

  const startDepositEdit = useCallback(() => {
    if (depositPayment) {
      setDepositRaw(depositPayment.amount);
      setDepositDateRaw(depositPayment.date);
      setDepositMethod(depositPayment.method || "Cash");
    }
    setDepositEditMode(true);
  }, [depositPayment]);

  // ── One-time payment mutators ───────────────────────────────────────────────

  const addOneTimePayment = useCallback(() => {
    const amount = parseFloat(oneTimePayment.amount);
    if (isNaN(amount) || amount <= 0 || !oneTimePayment.date) return;

    const paymentErrors = validatePayment(oneTimePayment);
    if (paymentErrors.length > 0) {
      alert(paymentErrors.join("\n"));
      return;
    }

    updatePayments((prev) => [
      ...prev,
      {
        ...oneTimePayment,
        id: generateId(),
        amount: amount.toFixed(2),
        type: PAYMENT_TYPES.ONE_TIME,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Reset form
    setOneTimePayment({
      id: generateId(),
      date: todayString(),
      amount: "",
      method: "Cash",
      note: "",
      isPaid: true,
      type: PAYMENT_TYPES.ONE_TIME,
    });
    setShowOneTimeForm(false);
  }, [oneTimePayment, updatePayments]);

  const toggleOneTimePaid = useCallback(
    (paymentId) => {
      updatePayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, isPaid: !p.isPaid } : p)),
      );
    },
    [updatePayments],
  );

  const removeOneTimePayment = useCallback(
    (paymentId) => {
      if (!window.confirm("Remove this payment?")) return;
      updatePayments((prev) => prev.filter((p) => p.id !== paymentId));
    },
    [updatePayments],
  );

  // ── Installment mutators ────────────────────────────────────────────────────

  const generateInstallments = useCallback(() => {
    const duration = parseInt(installmentDuration, 10);
    if (isNaN(duration) || duration < 1 || duration > 60) return;

    const balance = derived.remainingBalance;
    if (balance <= 0) {
      alert("No remaining balance to create installments for");
      return;
    }

    // Use Decimal for precise calculations
    const balanceDec = new Decimal(balance);
    const amountPer = balanceDec.dividedBy(duration);

    // Round to cents
    const amounts = [];
    let remaining = balanceDec;

    for (let i = 0; i < duration; i++) {
      if (i === duration - 1) {
        // Last payment gets whatever's left (handles rounding)
        amounts.push(remaining);
      } else {
        const amount = Decimal.round(amountPer.times(100)).dividedBy(100);
        amounts.push(amount);
        remaining = remaining.minus(amount);
      }
    }

    const start = parseSafeDate(installmentStartDate);
    const list = [];

    for (let i = 0; i < duration; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);

      list.push({
        id: generateId(),
        date: formatDateForInput(d),
        amount: amounts[i].toFixed(2),
        method: "Installment",
        note:
          duration === 1
            ? "Single payment"
            : `Installment ${i + 1} of ${duration}`,
        isPaid: false,
        type: PAYMENT_TYPES.INSTALLMENT,
        installmentNumber: i + 1,
        totalInstallments: duration,
      });
    }

    setGeneratedInstallments(list);
  }, [installmentDuration, installmentStartDate, derived.remainingBalance]);

  const applyInstallmentPlan = useCallback(() => {
    if (generatedInstallments.length === 0) return;

    // Remove any existing installments first
    updatePayments((prev) => [
      ...prev.filter((p) => p.type !== PAYMENT_TYPES.INSTALLMENT),
      ...generatedInstallments,
    ]);

    setGeneratedInstallments([]);
    setShowInstallmentForm(false);
    lastBalanceRef.current = null; // Reset balance tracking
  }, [generatedInstallments, updatePayments]);

  const removeAllInstallments = useCallback(() => {
    if (!window.confirm("Remove all installment payments?")) return;
    updatePayments((prev) =>
      prev.filter((p) => p.type !== PAYMENT_TYPES.INSTALLMENT),
    );
    lastBalanceRef.current = null;
  }, [updatePayments]);

  const toggleInstallmentPaid = useCallback(
    (paymentId) => {
      updatePayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, isPaid: !p.isPaid } : p)),
      );
    },
    [updatePayments],
  );

  const removeInstallment = useCallback(
    (paymentId) => {
      if (!window.confirm("Remove this installment?")) return;
      updatePayments((prev) => prev.filter((p) => p.id !== paymentId));
      lastBalanceRef.current = null;
    },
    [updatePayments],
  );

  const updateInstallmentAmount = useCallback(
    (paymentId, rawAmount) => {
      const num = parseFloat(rawAmount);
      if (isNaN(num) || num < 0) return;

      updatePayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? {
                ...p,
                amount: num.toFixed(2),
                manuallyAdjusted: true,
              }
            : p,
        ),
      );
    },
    [updatePayments],
  );

  const resetManualAdjustments = useCallback(() => {
    if (
      !window.confirm(
        "Reset all manually adjusted installments to auto-calculated amounts?",
      )
    )
      return;

    updatePayments((prev) =>
      prev.map((p) => {
        if (p.type === PAYMENT_TYPES.INSTALLMENT) {
          const { manuallyAdjusted, ...rest } = p;
          return rest;
        }
        return p;
      }),
    );

    lastBalanceRef.current = null; // Trigger recalculation
  }, [updatePayments]);

  // ── Preview amount for installment form ─────────────────────────────────────

  const previewAmount = useMemo(() => {
    const dur = parseInt(installmentDuration, 10);
    if (isNaN(dur) || dur < 1 || derived.remainingBalance <= 0) return "0.00";

    const perAmount = new Decimal(derived.remainingBalance).dividedBy(dur);
    return Decimal.round(perAmount.times(100)).dividedBy(100).toFixed(2);
  }, [installmentDuration, derived.remainingBalance]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.section}>
      <SectionHeader
        title="💳 Payment Tracking"
        subtitle={`Total: $${fmt(derived.grandTotal)} | Paid: $${fmt(
          derived.totalPaid,
        )} | Remaining: $${fmt(derived.remainingBalance)}`}
        expanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      {isExpanded && (
        <div className={styles.content}>
          {/* Validation Errors Summary */}
          {Object.keys(validationErrors).length > 0 && (
            <div className={styles.errorSummary}>
              <i className="fas fa-exclamation-triangle" />
              <span>Some payments have validation issues</span>
            </div>
          )}

          {/* ── Summary cards ────────────────────────────────────────────── */}
          <div className={styles.summaryCompact}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <i className="fas fa-wallet" />
              </div>
              <div className={styles.summaryInfo}>
                <span className={styles.summaryLabel}>Grand Total</span>
                <span className={styles.summaryAmount}>
                  ${fmt(derived.grandTotal)}
                </span>
              </div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardPaid}`}>
              <div
                className={`${styles.summaryIcon} ${styles.summaryIconSuccess}`}
              >
                <i className="fas fa-check-circle" />
              </div>
              <div className={styles.summaryInfo}>
                <span className={styles.summaryLabel}>Total Paid</span>
                <span
                  className={`${styles.summaryAmount} ${styles.summaryAmountSuccess}`}
                >
                  ${fmt(derived.totalPaid)}
                </span>
              </div>
            </div>
            <div
              className={`${styles.summaryCard} ${styles.summaryCardRemaining}`}
            >
              <div
                className={`${styles.summaryIcon} ${styles.summaryIconError}`}
              >
                <i className="fas fa-exclamation-circle" />
              </div>
              <div className={styles.summaryInfo}>
                <span className={styles.summaryLabel}>Remaining</span>
                <span
                  className={`${styles.summaryAmount} ${styles.summaryAmountError}`}
                >
                  ${fmt(derived.remainingBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Deposit ──────────────────────────────────────────────────── */}
          <div className={styles.depositInline}>
            <span className={styles.inlineLabel}>
              <i className="fas fa-hand-holding-usd" /> Initial Deposit
            </span>

            {/* ── LOCKED state: deposit exists and not being edited ── */}
            {depositPayment && !depositEditMode ? (
              <div className={styles.depositLocked}>
                <span className={styles.depositLockedAmount}>
                  <i
                    className="fas fa-lock"
                    style={{ fontSize: "0.7em", opacity: 0.6, marginRight: 4 }}
                  />
                  ${fmt(depositPayment.amount)}
                </span>
                <span className={styles.depositLockedDate}>
                  {new Date(depositPayment.date).toLocaleDateString()}
                </span>
                <span className={styles.depositLockedMethod}>
                  {depositPayment.method}
                </span>
                {!disabled && (
                  <div className={styles.depositLockedActions}>
                    <button
                      onClick={startDepositEdit}
                      className={`${styles.btnAction} ${styles.btnActionEdit}`}
                      title="Edit deposit"
                    >
                      <i className="fas fa-pencil-alt" />
                    </button>
                    <button
                      onClick={removeDeposit}
                      className={`${styles.btnAction} ${styles.btnActionDanger}`}
                      title="Delete deposit"
                    >
                      <i className="fas fa-trash-alt" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── INPUT state: no deposit yet, or editing existing one ── */
              !disabled && (
                <div className={styles.depositInputGroup}>
                  <div className={styles.inlineFields}>
                    <input
                      type="number"
                      value={depositRaw}
                      onChange={(e) => {
                        setDepositRaw(e.target.value);
                        setDepositInputError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitDeposit();
                        if (e.key === "Escape" && depositEditMode) {
                          setDepositEditMode(false);
                          setDepositInputError("");
                        }
                      }}
                      placeholder="Amount (e.g. 500)"
                      className={`${styles.inlineInput} ${
                        depositInputError ? styles.inputError : ""
                      }`}
                      min="0"
                      step="0.01"
                      autoFocus={depositEditMode}
                    />
                    <input
                      type="date"
                      value={depositDateRaw}
                      onChange={(e) => setDepositDateRaw(e.target.value)}
                      className={styles.inlineInput}
                    />
                    <select
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value)}
                      className={styles.inlineInput}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  {depositInputError && (
                    <span className={styles.editError}>
                      {depositInputError}
                    </span>
                  )}
                  <div className={styles.depositFormActions}>
                    <button
                      onClick={commitDeposit}
                      className={styles.btnSubmit}
                      disabled={!depositRaw}
                    >
                      <i className="fas fa-check" />{" "}
                      {depositEditMode ? "Update" : "Save"} Deposit
                    </button>
                    {depositEditMode && (
                      <button
                        onClick={() => {
                          setDepositEditMode(false);
                          setDepositInputError("");
                        }}
                        className={styles.btnClear}
                      >
                        <i className="fas fa-times" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* ── One-time payment ──────────────────────────────────────────── */}
          <div className={styles.oneTimeSection}>
            <div className={styles.compactHeader}>
              <div className={styles.headerLeft}>
                <i className="fas fa-money-bill-wave" />
                <span>One-Time Payments</span>
              </div>
              {!disabled && (
                <button
                  onClick={() => setShowOneTimeForm(!showOneTimeForm)}
                  className={`${styles.toggleBtn} ${
                    showOneTimeForm ? styles.toggleBtnActive : ""
                  }`}
                >
                  <i
                    className={`fas fa-${showOneTimeForm ? "minus" : "plus"}`}
                  />
                  {showOneTimeForm ? "Hide" : "Add Payment"}
                </button>
              )}
            </div>

            {showOneTimeForm && !disabled && (
              <div className={styles.oneTimeForm}>
                <div className={styles.formGrid}>
                  <input
                    type="date"
                    value={oneTimePayment.date}
                    onChange={(e) =>
                      setOneTimePayment((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    className={styles.formInput}
                  />
                  <input
                    type="number"
                    value={oneTimePayment.amount}
                    onChange={(e) =>
                      setOneTimePayment((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="Amount"
                    className={styles.formInput}
                    step="0.01"
                    min="0"
                  />
                  <select
                    value={oneTimePayment.method}
                    onChange={(e) =>
                      setOneTimePayment((prev) => ({
                        ...prev,
                        method: e.target.value,
                      }))
                    }
                    className={styles.formSelect}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={oneTimePayment.note}
                    onChange={(e) =>
                      setOneTimePayment((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    placeholder="Note (optional)"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formFooter}>
                  <label className={styles.paidToggle}>
                    <input
                      type="checkbox"
                      checked={oneTimePayment.isPaid}
                      onChange={(e) =>
                        setOneTimePayment((prev) => ({
                          ...prev,
                          isPaid: e.target.checked,
                        }))
                      }
                    />
                    <span>Mark as paid</span>
                  </label>
                  <button
                    onClick={addOneTimePayment}
                    className={styles.btnSubmit}
                    disabled={!oneTimePayment.amount || !oneTimePayment.date}
                  >
                    <i className="fas fa-check" /> Save Payment
                  </button>
                </div>
              </div>
            )}

            {oneTimePayments.length > 0 && (
              <div className={styles.oneTimeList}>
                {oneTimePayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`${styles.paymentRow} ${styles.manualRow} ${
                      payment.isPaid ? styles.rowPaid : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(payment.isPaid)}
                      onChange={() => toggleOneTimePaid(payment.id)}
                      disabled={disabled}
                      className={styles.paymentCheckbox}
                    />
                    <div className={styles.paymentInfo}>
                      <span className={styles.paymentDate}>
                        {new Date(payment.date).toLocaleDateString()}
                      </span>
                      <span className={styles.paymentAmount}>
                        ${fmt(payment.amount)}
                      </span>
                      <span className={styles.paymentMethod}>
                        {payment.method}
                      </span>
                      {payment.note && (
                        <span
                          className={styles.paymentNote}
                          title={payment.note}
                        >
                          {payment.note}
                        </span>
                      )}
                    </div>
                    {!disabled && (
                      <button
                        onClick={() => removeOneTimePayment(payment.id)}
                        className={`${styles.btnAction} ${styles.btnActionDanger}`}
                        title="Remove payment"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Installment Plan ─────────────────────────────────────────── */}
          <div className={styles.installmentCompact}>
            <div className={styles.compactHeader}>
              <div className={styles.headerLeft}>
                <i className="fas fa-calendar-alt" />
                <span>Installment Plan</span>
              </div>
              <div className={styles.headerRight}>
                <label className={styles.autoRecalcLabel}>
                  <input
                    type="checkbox"
                    checked={autoRecalculate}
                    onChange={(e) => setAutoRecalculate(e.target.checked)}
                    disabled={disabled}
                  />
                  <span>Auto-recalculate</span>
                </label>
                {!disabled && hasInstallmentPlan && (
                  <button
                    onClick={resetManualAdjustments}
                    className={styles.btnReset}
                    title="Reset manually adjusted amounts"
                  >
                    <i className="fas fa-undo" />
                  </button>
                )}
                {!disabled && (
                  <button
                    onClick={() => setShowInstallmentForm(!showInstallmentForm)}
                    className={`${styles.toggleBtn} ${
                      hasInstallmentPlan ? styles.toggleBtnDisabled : ""
                    }`}
                    disabled={hasInstallmentPlan}
                  >
                    <i
                      className={`fas fa-${
                        showInstallmentForm ? "minus" : "plus"
                      }`}
                    />
                    {showInstallmentForm ? "Hide" : "Create Plan"}
                  </button>
                )}
              </div>
            </div>

            {hasInstallmentPlan && (
              <div className={styles.planWarning}>
                <i className="fas fa-info-circle" /> Active plan exists. Remove
                it to create a new one.
              </div>
            )}

            {showInstallmentForm && !hasInstallmentPlan && (
              <div className={styles.installmentContent}>
                <div className={styles.planInputs}>
                  <select
                    value={installmentDuration}
                    onChange={(e) => setInstallmentDuration(e.target.value)}
                    className={styles.planSelect}
                  >
                    {INSTALLMENT_DURATIONS.map((m) => (
                      <option key={m} value={m}>
                        {m === 1 ? "1 month (single)" : `${m} months`}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={installmentStartDate}
                    onChange={(e) => setInstallmentStartDate(e.target.value)}
                    className={styles.planInput}
                  />
                  <span className={styles.planAmount}>
                    ${previewAmount}
                    {parseInt(installmentDuration) > 1 ? "/month" : " total"}
                  </span>
                </div>

                <div className={styles.planActions}>
                  <button
                    onClick={generateInstallments}
                    className={styles.btnGenerate}
                    disabled={derived.remainingBalance <= 0}
                  >
                    <i className="fas fa-calculator" /> Generate
                  </button>
                  {generatedInstallments.length > 0 && (
                    <>
                      <button
                        onClick={applyInstallmentPlan}
                        className={styles.btnApply}
                      >
                        <i className="fas fa-check-double" /> Apply Plan
                      </button>
                      <button
                        onClick={() => setGeneratedInstallments([])}
                        className={styles.btnClear}
                      >
                        <i className="fas fa-times" /> Clear
                      </button>
                    </>
                  )}
                </div>

                {generatedInstallments.length > 0 && (
                  <div className={styles.previewSection}>
                    <div className={styles.previewHeader}>
                      <span>
                        <i className="fas fa-eye" /> Preview (
                        {generatedInstallments.length}{" "}
                        {generatedInstallments.length === 1
                          ? "payment"
                          : "payments"}
                        )
                      </span>
                      <span className={styles.statPaid}>
                        Total: $
                        {fmt(
                          generatedInstallments.reduce(
                            (s, p) => s + parseFloat(p.amount),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                    <div className={styles.previewList}>
                      {generatedInstallments.map((inst) => (
                        <div key={inst.id} className={styles.previewItem}>
                          <span className={styles.previewNumber}>
                            #{inst.installmentNumber}
                          </span>
                          <span className={styles.previewDate}>
                            {new Date(inst.date).toLocaleDateString()}
                          </span>
                          <span className={styles.previewAmount}>
                            ${fmt(inst.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Active installment list ───────────────────────────────────── */}
          {hasInstallmentPlan && (
            <div className={styles.installmentGroup}>
              <div className={styles.installmentGroupHeader}>
                <div className={styles.groupHeaderLeft}>
                  <i className="fas fa-calendar-alt" />
                  <span className={styles.groupTitle}>Installment Plan</span>
                  <span className={styles.groupProgress}>
                    {installmentStats.paid}/{installmentStats.total} paid
                  </span>
                </div>
                <div className={styles.groupHeaderRight}>
                  <span className={styles.groupAmount}>
                    ${fmt(installmentStats.paidAmount)} / $
                    {fmt(installmentStats.totalAmount)}
                  </span>
                  {!disabled && (
                    <button
                      onClick={removeAllInstallments}
                      className={styles.btnRemovePlan}
                      title="Remove entire installment plan"
                    >
                      <i className="fas fa-trash-alt" />
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.installmentPayments}>
                {installmentPayments.map((payment) => (
                  <InstallmentRow
                    key={payment.id}
                    payment={payment}
                    disabled={disabled}
                    onTogglePaid={() => toggleInstallmentPaid(payment.id)}
                    onRemove={() => removeInstallment(payment.id)}
                    onAmountChange={(val) =>
                      updateInstallmentAmount(payment.id, val)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasInstallmentPlan &&
            !depositPayment &&
            oneTimePayments.length === 0 && (
              <div className={styles.emptyState}>
                <i className="fas fa-inbox" />
                <p>
                  No payments recorded yet. Add a deposit, a one-time payment,
                  or create an installment plan.
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ─── InstallmentRow ───────────────────────────────────────────────────────────
// Uses payment.id for stable identification

function InstallmentRow({
  payment,
  disabled,
  onTogglePaid,
  onRemove,
  onAmountChange,
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(payment.amount);
  const [validationError, setValidationError] = useState("");

  // Keep local edit value in sync when parent updates amount
  useEffect(() => {
    if (!editing) {
      setEditValue(payment.amount);
      setValidationError("");
    }
  }, [payment.amount, editing]);

  const validateAndCommit = () => {
    const num = parseFloat(editValue);
    if (isNaN(num) || num <= 0) {
      setValidationError("Amount must be greater than 0");
      return;
    }
    if (num > 1000000) {
      setValidationError("Amount seems unusually high");
      return;
    }

    onAmountChange(editValue);
    setEditing(false);
    setValidationError("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      validateAndCommit();
    }
    if (e.key === "Escape") {
      setEditValue(payment.amount);
      setEditing(false);
      setValidationError("");
    }
  };

  return (
    <div
      className={`${styles.paymentRow} ${styles.installmentRow} ${
        payment.isPaid ? styles.rowPaid : ""
      } ${payment.manuallyAdjusted ? styles.rowAdjusted : ""} ${
        validationError ? styles.rowError : ""
      }`}
    >
      <input
        type="checkbox"
        checked={Boolean(payment.isPaid)}
        onChange={onTogglePaid}
        disabled={disabled}
        className={styles.paymentCheckbox}
      />

      <div className={styles.paymentInfo}>
        <span className={styles.paymentNumber}>
          #{payment.installmentNumber}
        </span>
        <span className={styles.paymentDate}>
          {new Date(payment.date).toLocaleDateString()}
        </span>

        {editing && !disabled ? (
          <div className={styles.editContainer}>
            <span className={styles.inlineEdit}>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={validateAndCommit}
                onKeyDown={handleKeyDown}
                className={`${styles.inlineEditInput} ${
                  validationError ? styles.inputError : ""
                }`}
                step="0.01"
                min="0"
                autoFocus
              />
            </span>
            {validationError && (
              <span className={styles.editError}>{validationError}</span>
            )}
          </div>
        ) : (
          <span
            className={styles.paymentAmount}
            onClick={() => !disabled && setEditing(true)}
            title={disabled ? "" : "Click to edit amount"}
          >
            ${fmt(payment.amount)}
            {payment.manuallyAdjusted && (
              <span className={styles.badge} title="Manually adjusted">
                <i className="fas fa-edit" />
              </span>
            )}
          </span>
        )}

        {payment.note && (
          <span className={styles.paymentNote} title={payment.note}>
            {payment.note}
          </span>
        )}
      </div>

      {!disabled && (
        <button
          onClick={onRemove}
          className={`${styles.btnAction} ${styles.btnActionDanger}`}
          title="Remove installment"
        >
          <i className="fas fa-trash-alt" />
        </button>
      )}
    </div>
  );
}

// ─── Helper function (duplicated from CostSummary for consistency) ────────────

function fmt(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
