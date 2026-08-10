// src/components/Calculator/Category/PaymentTracking.jsx
//
// Payment tracking panel: deposit, installment plan, one-time payments, refunds.
//
import { useState, useMemo, useCallback } from "react";
import Decimal from "decimal.js";
import { useSettings } from "../../../context/SettingsContext";
import { useCalculation } from "../../../context/CalculationContext";
import SectionHeader from "./SectionHeader";
import styles from "./PaymentTracking.module.css";

// ─── Constants ──────────────────────────────────────────────────────────────
const PAYMENT_TYPES = {
  DEPOSIT: "Deposit",
  INSTALLMENT: "Installment",
  REFUND: "Refund",
};

const PAYMENT_METHODS = [
  "Cash", "Credit", "Debit", "Check",
  "Zelle", "Bank Transfer", "PayPal", "Venmo", "CashApp", "Wire", "Other",
];

const INSTALLMENT_DURATIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60];
const MAX_INSTALLMENT_MONTHS = 60;
const EPSILON = 0.005;

const EMPTY_REFUND = () => ({
  id: generateId(),
  date: todayString(),
  amount: "",
  method: "Cash",
  note: "",
  type: PAYMENT_TYPES.REFUND,
});

// Credits are NOT payments — they live in settings.credits, not
// settings.payments, and they reduce the project's grand total itself
// (via CalculatorEngine) rather than the amount collected. Use this for
// price changes, damaged product, customer dissatisfaction, etc. If money
// also needs to go back to the customer because they'd already paid past
// the new lower total, that's handled separately by the (locked) refund
// flow below — it unlocks automatically once the credit pushes netPaid
// past the new grand total.
const EMPTY_CREDIT = () => ({
  id: generateId(),
  date: todayString(),
  amount: "",
  reason: "",
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function paymentKind(payment) {
  return (payment?.type || payment?.paymentType || "").toString().trim();
}

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
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function todayString() {
  return formatDateForInput(new Date());
}

function fmt(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isPastDate(dateString) {
  return parseSafeDate(dateString) < new Date();
}

function addMonthsClamped(date, monthsToAdd) {
  const d = new Date(date.getTime());
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsToAdd);
  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, daysInTargetMonth));
  return d;
}

function splitAmountEvenly(total, count) {
  const balDec = total instanceof Decimal ? total : new Decimal(total);
  const n = Math.max(1, count);
  const base = Decimal.round(balDec.dividedBy(n).times(100)).dividedBy(100);
  const amounts = Array(n).fill(base);
  const sum = base.times(n);
  const diff = balDec.minus(sum);
  if (!diff.isZero()) {
    amounts[n - 1] = amounts[n - 1].plus(diff);
  }
  return amounts;
}

function renumberInstallments(list) {
  const sorted = [...list].sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (a.installmentNumber || 0) - (b.installmentNumber || 0);
  });
  const total = sorted.length;
  return sorted.map((p, i) => ({ ...p, installmentNumber: i + 1, totalInstallments: total }));
}

// ─── The single source of truth for installment math ───────────────────────
// Every payment mutation (deposit added/edited/removed, an installment
// edited/deleted/paid) funnels through this one function before it's saved.
// That's the whole fix for "numbers don't match": there is now exactly one
// place that decides what unpaid installments should add up to, instead of
// several copies of similar math scattered around that could drift apart.
//
// The rule is simple: deposit + paid installments + unpaid installments
// must always equal the grand total. Unpaid installments split that
// remaining balance evenly.
//
// A single installment can be "locked" to a custom amount the user typed in
// (manuallyAdjusted) — the other unpaid ones absorb whatever's left over.
// Locks are intentionally soft: pass `resetLocks: true` (done whenever the
// deposit changes or an installment is deleted) to clear them and go back
// to a clean, guaranteed-to-match even split.
function recalcInstallments(paymentsArray, grandTotal, { resetLocks = false } = {}) {
  const working = resetLocks
    ? paymentsArray.map((p) =>
        paymentKind(p) === PAYMENT_TYPES.INSTALLMENT && !p.isPaid && p.manuallyAdjusted
          ? { ...p, manuallyAdjusted: false }
          : p,
      )
    : paymentsArray;

  const deposit = working.find((p) => paymentKind(p) === PAYMENT_TYPES.DEPOSIT);
  const depositAmt = deposit ? parseFloat(deposit.amount) || 0 : 0;

  const paidInstallmentsTotal = working
    .filter((p) => paymentKind(p) === PAYMENT_TYPES.INSTALLMENT && p.isPaid)
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const refundedTotal = working
    .filter((p) => paymentKind(p) === PAYMENT_TYPES.REFUND)
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const target = Math.max(0, grandTotal - depositAmt - paidInstallmentsTotal + refundedTotal);

  const lockedUnpaid = working.filter(
    (p) => paymentKind(p) === PAYMENT_TYPES.INSTALLMENT && !p.isPaid && p.manuallyAdjusted,
  );
  const autoUnpaid = working.filter(
    (p) => paymentKind(p) === PAYMENT_TYPES.INSTALLMENT && !p.isPaid && !p.manuallyAdjusted,
  );

  const allUnpaid = [...lockedUnpaid, ...autoUnpaid];
  if (allUnpaid.length > 0 && target <= EPSILON) {
    const unpaidIds = new Set(allUnpaid.map((p) => p.id));
    return renumberPreservingOthers(working.filter((p) => !unpaidIds.has(p.id)));
  }

  const lockedTotal = lockedUnpaid.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  if (allUnpaid.length > 0 && lockedTotal > target + EPSILON) {
    const amounts = splitAmountEvenly(new Decimal(target), allUnpaid.length);
    const amountById = new Map(allUnpaid.map((p, i) => [p.id, amounts[i]]));
    return renumberPreservingOthers(
      working.map((p) =>
        amountById.has(p.id)
          ? { ...p, amount: amountById.get(p.id).toFixed(2), manuallyAdjusted: false }
          : p,
      ),
    );
  }

  if (autoUnpaid.length === 0) {
    return renumberPreservingOthers(working);
  }

  const remainingForAuto = Math.max(0, target - lockedTotal);

  if (remainingForAuto <= 0) {
    // Nothing left for the auto-calculated installments — they're no
    // longer needed (e.g. the deposit now covers the rest of the plan).
    const autoIds = new Set(autoUnpaid.map((p) => p.id));
    return renumberPreservingOthers(working.filter((p) => !autoIds.has(p.id)));
  }

  const amounts = splitAmountEvenly(new Decimal(remainingForAuto), autoUnpaid.length);
  const amountById = new Map(autoUnpaid.map((p, i) => [p.id, amounts[i]]));

  const result = working.map((p) => {
    if (amountById.has(p.id)) {
      return { ...p, amount: amountById.get(p.id).toFixed(2), manuallyAdjusted: false };
    }
    return p;
  });

  return renumberPreservingOthers(result);
}

// Renumbers just the installment rows (#1, #2, ...) by date; deposit and
// refund entries pass through untouched.
function renumberPreservingOthers(paymentsArray) {
  const installments = paymentsArray.filter((p) => paymentKind(p) === PAYMENT_TYPES.INSTALLMENT);
  const others = paymentsArray.filter((p) => paymentKind(p) !== PAYMENT_TYPES.INSTALLMENT);
  return [...others, ...renumberInstallments(installments)];
}

function validatePayment(payment, grandTotal = Infinity, runningNetPaidAfter = 0) {
  const errors = [];
  const amount = parseFloat(payment.amount);
  const type = paymentKind(payment);
  const isEmpty = payment.amount === "" || payment.amount === null || payment.amount === undefined;
  if (isEmpty || isNaN(amount) || amount < 0 || (amount === 0 && type !== PAYMENT_TYPES.DEPOSIT)) {
    errors.push("Amount must be valid and greater than 0 (except deposits which can be 0)");
  }
  if (!payment.date) {
    errors.push("Date is required");
  } else {
    const d = parseSafeDate(payment.date);
    if (isNaN(d.getTime())) errors.push("Invalid date");
  }
  if (type === PAYMENT_TYPES.DEPOSIT && amount > 0 && grandTotal > 0 && amount > grandTotal) {
    errors.push(`Deposit ($${fmt(amount)}) cannot exceed the project total ($${fmt(grandTotal)})`);
  }
  if (
    type !== PAYMENT_TYPES.REFUND &&
    payment.isPaid &&
    grandTotal > 0 &&
    runningNetPaidAfter > grandTotal + EPSILON
  ) {
    errors.push(
      `This payment brings total payments to $${fmt(runningNetPaidAfter)}, which exceeds the project total ($${fmt(grandTotal)})`,
    );
  }
  return errors;
}

// CSV export helpers removed — export buttons/functions were deleted per request

// ─── Shared input behaviors ─────────────────────────────────────────────────
function blurOnWheel(e) {
  e.currentTarget.blur();
}

function blockInvalidAmountKeys(e) {
  if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
    e.preventDefault();
  }
}

// ─── Small reusable pieces ──────────────────────────────────────────────────
function AmountInput({ value, onChange, onEnter, onEscape, onBlur, placeholder, error, autoFocus, disabled, className, ariaLabel }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onWheel={blurOnWheel}
      onBlur={onBlur}
      onKeyDown={(e) => {
        blockInvalidAmountKeys(e);
        if (e.key === "Enter" && onEnter) onEnter();
        if (e.key === "Escape" && onEscape) onEscape();
      }}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className={`${className || styles.inlineInput} ${error ? styles.inputError : ""}`}
      min="0"
      step="0.01"
      autoFocus={autoFocus}
      disabled={disabled}
    />
  );
}

function PaidMethodPrompt({ label, value, onChange, onConfirm, onCancel }) {
  return (
    <div className={styles.paymentRowEdit} role="group" aria-label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
        <i className="fas fa-credit-card" style={{ color: "var(--secondary)" }} />
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-light)" }}>{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={styles.editSelect}
          autoFocus
          aria-label="Payment method received"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <button className={styles.btnSave} onClick={onConfirm}>
        <i className="fas fa-check" /> Confirm
      </button>
      <button className={styles.btnCancel} onClick={onCancel} aria-label="Cancel marking as paid">
        <i className="fas fa-times" />
      </button>
    </div>
  );
}

function ConfirmModal({ title = "Please confirm", message, confirmLabel = "Confirm", danger = false, informational = false, onConfirm, onCancel }) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel} role="presentation">
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="payment-confirm-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      >
        <div className={styles.modalHeader}>
          <h3 id="payment-confirm-title">
            <i className={`fas ${informational ? "fa-info-circle" : "fa-exclamation-triangle"}`} /> {title}
          </h3>
          <button className={styles.modalClose} onClick={onCancel} aria-label="Close dialog">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p>{message}</p>
        </div>
        <div className={styles.modalFooter}>
          {!informational && (
            <button className={styles.btnModalCancel} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            className={styles.btnModalSave}
            style={
              danger
                ? {
                    background: "linear-gradient(135deg, var(--error), var(--error-dark))",
                    boxShadow: "0 2px 8px var(--error-border)",
                  }
                : undefined
            }
            onClick={onConfirm}
            autoFocus
          >
            <i className="fas fa-check" /> {informational ? "OK" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ percent, label }) {
  const clamped = Math.min(100, Math.max(0, percent || 0));
  return (
    <div
      className={styles.progressBarTrack}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={styles.progressBarFill} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function SummaryCard({ icon, label, amount, iconClass = "", amountClass = "", cardClass = "" }) {
  return (
    <div className={`${styles.summaryCard} ${cardClass}`}>
      <div className={`${styles.summaryIcon} ${iconClass}`}>
        <i className={icon} />
      </div>
      <div className={styles.summaryInfo}>
        <span className={styles.summaryLabel}>{label}</span>
        <span className={`${styles.summaryAmount} ${amountClass}`}>${fmt(amount)}</span>
      </div>
    </div>
  );
}

// ─── InstallmentRow ─────────────────────────────────────────────────────────
function InstallmentRow({ payment, disabled, onTogglePaid, onAmountChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(payment.amount);
  const [validationError, setValidationError] = useState("");
  const [awaitingMethod, setAwaitingMethod] = useState(false);
  const [pickedMethod, setPickedMethod] = useState(payment.method || "Cash");

  const syncFromProp = () => {
    setEditValue(payment.amount);
    setValidationError("");
  };

  const commitAmount = () => {
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

  const handleCheckboxChange = () => {
        if (!payment.isPaid) {
      setPickedMethod(payment.method || "Cash");
      setAwaitingMethod(true);
    } else {
      onTogglePaid(null);
    }
  };

  const isOverdue = !payment.isPaid && isPastDate(payment.date);

  return (
    <>
      <div
        className={`${styles.paymentRow} ${styles.installmentRow} ${payment.isPaid ? styles.rowPaid : ""} ${payment.manuallyAdjusted ? styles.rowAdjusted : ""} ${validationError ? styles.rowError : ""} ${isOverdue ? styles.rowOverdue : ""}`}
      >
        <input
          type="checkbox"
          checked={Boolean(payment.isPaid)}
          onChange={handleCheckboxChange}
          disabled={disabled}
          className={styles.paymentCheckbox}
          aria-label={`Mark installment #${payment.installmentNumber} as ${payment.isPaid ? "unpaid" : "paid"}`}
        />
        <div className={styles.paymentInfo}>
          <span className={styles.paymentNumber}>#{payment.installmentNumber}</span>
          <span className={styles.paymentDate}>
            {new Date(payment.date).toLocaleDateString()}
            {isOverdue && (
              <span className={styles.overdueBadge}>
                <i className="fas fa-clock" /> Overdue
              </span>
            )}
          </span>
          {editing && !disabled ? (
            <div className={styles.editContainer}>
              <span className={styles.inlineEdit}>
                <AmountInput
                  value={editValue}
                  onChange={setEditValue}
                  onEnter={commitAmount}
                  onEscape={() => { syncFromProp(); setEditing(false); }}
                  onBlur={commitAmount}
                  className={`${styles.inlineEditInput} ${validationError ? styles.inputError : ""}`}
                  ariaLabel={`Amount for installment #${payment.installmentNumber}`}
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
              onClick={() => { if (!disabled) { syncFromProp(); setEditing(true); } }}
              title={disabled ? "" : "Click to edit amount"}
              style={{ cursor: disabled ? "default" : "pointer" }}
            >
              ${fmt(payment.amount)}
              {payment.manuallyAdjusted && (
                <span className={styles.badge} title="Manually adjusted — clears automatically if the deposit changes or another installment is deleted">
                  <i className="fas fa-edit" />
                </span>
              )}
            </span>
          )}

          {payment.isPaid && payment.paidMethod && (
            <span className={styles.paymentMethod}>{payment.paidMethod}</span>
          )}

          {payment.note && (
            <span className={styles.paymentNote} title={payment.note}>
              {payment.note}
            </span>
          )}
        </div>

        {!disabled && (
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button
              onClick={() => { syncFromProp(); setEditing(true); }}
              className={`${styles.btnAction} ${styles.btnActionEdit}`}
              title="Edit installment amount"
              aria-label={`Edit installment #${payment.installmentNumber}`}
            >
              <i className="fas fa-pencil-alt" />
            </button>
            <button
              onClick={onDelete}
              className={`${styles.btnAction} ${styles.btnActionDanger}`}
              title="Delete this installment"
              aria-label={`Delete installment #${payment.installmentNumber}`}
            >
              <i className="fas fa-trash-alt" />
            </button>
          </div>
        )}
      </div>

      {awaitingMethod && !disabled && (
        <PaidMethodPrompt
          label={`How was installment #${payment.installmentNumber} received?`}
          value={pickedMethod}
          onChange={setPickedMethod}
          onConfirm={() => { onTogglePaid(pickedMethod); setAwaitingMethod(false); }}
          onCancel={() => setAwaitingMethod(false)}
        />
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
export default function PaymentTracking({ disabled = false }) {
  const { settings, setSettings } = useSettings();
  const { derived } = useCalculation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [confirmDialog, setConfirmDialog] = useState(null);

  // ── Deposit state ──────────────────────────────────────────────────────
  const [depositRaw, setDepositRaw] = useState("");
  const [depositDateRaw, setDepositDateRaw] = useState(todayString());
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositEditMode, setDepositEditMode] = useState(false);
  const [depositError, setDepositError] = useState("");

  // ── Installment plan state ─────────────────────────────────────────────
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [installmentDuration, setInstallmentDuration] = useState("6");
  const [installmentStartDate, setInstallmentStartDate] = useState(todayString());
  const [generatedInstallments, setGeneratedInstallments] = useState([]);
  // ── Refund form state ──────────────────────────────────────────────────
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundPayment, setRefundPayment] = useState(EMPTY_REFUND());
  const [refundError, setRefundError] = useState("");

  // ── Credit / price-adjustment form state ────────────────────────────────
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditEntry, setCreditEntry] = useState(EMPTY_CREDIT());
  const [creditError, setCreditError] = useState("");

  // ── Source data ─────────────────────────────────────────────────────────
  const payments = useMemo(() => {
    return (settings.payments || []).map(p => {
      if (!p.id) {
        return { ...p, id: p._id || `temp-${Date.now()}-${Math.random()}` };
      }
      return p;
    });
  }, [settings.payments]);
  const grandTotal = parseFloat(derived.grandTotal) || 0;

  const { depositPayment, installmentPayments, refundPayments } = useMemo(() => {
    const result = {
      depositPayment: null,
      installmentPayments: [],
      refundPayments: [],
    };
    payments.forEach((p) => {
      if (!p) return;
      const paymentType = paymentKind(p);

      if (paymentType === PAYMENT_TYPES.DEPOSIT || p.method === 'Deposit') {
        result.depositPayment = p;
        return;
      }

      if (paymentType === PAYMENT_TYPES.REFUND) {
        result.refundPayments.push(p);
        return;
      }

      result.installmentPayments.push(p);
    });

    result.refundPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    result.installmentPayments.sort((a, b) => {
      if (a.installmentNumber && b.installmentNumber) {
        return a.installmentNumber - b.installmentNumber;
      }
      return new Date(a.date) - new Date(b.date);
    });

    return result;
  }, [payments]);

  const hasInstallmentPlan = installmentPayments.length > 0;

  // ── Credits (price adjustments) ─────────────────────────────────────────
  const credits = useMemo(() => settings.credits || [], [settings.credits]);
  const totalCredits = useMemo(
    () => credits.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0),
    [credits],
  );

  // ── Payment totals ──────────────────────────────────────────────────────
  const {
    totalRefunded, netPaid, overdueCount, depositAmount, paidInstallmentsTotal,
  } = useMemo(() => {
    const now = new Date();
    let paid = new Decimal(0);
    let refunded = new Decimal(0);
    let deposit = new Decimal(0);
    let paidInstallments = new Decimal(0);
    let overdue = 0;
    payments.forEach((p) => {
      if (!p) return;
      const amount = parseFloat(p.amount) || 0;
      const type = paymentKind(p);

      if (type === PAYMENT_TYPES.REFUND) {
        refunded = refunded.plus(amount);
        return;
      }

      if (type === PAYMENT_TYPES.DEPOSIT && p.isPaid) {
        deposit = deposit.plus(amount);
      }
      if (type === PAYMENT_TYPES.INSTALLMENT && p.isPaid) {
        paidInstallments = paidInstallments.plus(amount);
      }

      if (p.isPaid && amount > 0) {
        paid = paid.plus(amount);
      } else if (!p.isPaid && amount > 0 && new Date(p.date) < now) {
        overdue++;
      }
    });

    return {
      totalPaidGross: paid.toNumber(),
      totalRefunded: refunded.toNumber(),
      netPaid: Decimal.max(paid.minus(refunded), new Decimal(0)).toNumber(),
      overdueCount: overdue,
      depositAmount: deposit.toNumber(),
      paidInstallmentsTotal: paidInstallments.toNumber(),
    };
  }, [payments]);

  const remainingBalance = Math.max(0, grandTotal - netPaid);
  const isOverpaid = netPaid > grandTotal + EPSILON && grandTotal > 0;
  const remainingAfterDeposit = Math.max(0, grandTotal - depositAmount);

  // ── Refund lock ──────────────────────────────────────────────────────────
  // Refund exists ONLY to hand back money already collected past the
  // project total — it never changes the project's price. So it stays
  // locked until every deposit/installment on record is marked paid, and
  // it only unlocks automatically once that's true AND there's an actual
  // overpayment to return. (A price change belongs in Credits, above.)
  const collectibleForLock = useMemo(
    () => [...(depositPayment ? [depositPayment] : []), ...installmentPayments],
    [depositPayment, installmentPayments],
  );
  const isFullyPaid = collectibleForLock.length > 0 && collectibleForLock.every((p) => Boolean(p?.isPaid));
  const overpaidAmount = Math.max(0, netPaid - grandTotal);
  const refundReady = isFullyPaid && isOverpaid;

  const installmentStats = useMemo(() => {
    const paid = installmentPayments.filter((p) => p.isPaid);
    const total = installmentPayments.length;
    const paidCount = paid.length;
    let status = "none";
    if (total > 0) {
      if (paidCount === total) status = "completed";
      else if (paidCount === 0) status = "not-started";
      else status = "in-progress";
    }
    const stats = {
      total,
      paid: paidCount,
      totalAmount: installmentPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
      paidAmount: paid.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
      status,
      percentComplete: total > 0 ? (paidCount / total) * 100 : 0,
    };
        return stats;
  }, [installmentPayments]);

  const manuallyAdjustedUnpaidCount = installmentPayments.filter(
    (p) => p.manuallyAdjusted && !p.isPaid,
  ).length;

  // ── Safe payment updater ─────────────────────────────────────────────
  const updatePayments = useCallback(
    (updater) => {
      setSettings((prev) => {
        const current = prev.payments || [];
        const next = typeof updater === "function" ? updater(current) : updater;
        const errors = {};
        let runningNetPaid = 0;
        next.forEach((p, idx) => {
          if (!p) return;
          const amt = parseFloat(p.amount) || 0;
      const type = paymentKind(p);
      if (type === PAYMENT_TYPES.REFUND) {
        runningNetPaid -= amt;
      } else if (p.isPaid) {
            runningNetPaid += amt;
          }
          const errs = validatePayment(p, grandTotal, runningNetPaid);
          if (errs.length) errors[p.id || `p_${idx}`] = errs;
        });
        setValidationErrors(errors);

        return { ...prev, payments: next };
      });
    },
    [setSettings, grandTotal],
  );

  // ────────────────────────────────────────────────────────────────────
  // Deposit mutators
  // ────────────────────────────────────────────────────────────────────
  const commitDeposit = useCallback(() => {
    const num = parseFloat(depositRaw);
    const isEmpty = depositRaw === "" || depositRaw === null || depositRaw === undefined;
    if (isEmpty || isNaN(num) || num < 0) {
      setDepositError("Enter a valid amount (0 or greater)");
      return;
    }
    if (num > grandTotal && grandTotal > 0) {
      setDepositError(`Deposit ($${fmt(num)}) cannot exceed the project total ($${fmt(grandTotal)})`);
      return;
    }
    const hasExisting = payments.some((p) => paymentKind(p) === PAYMENT_TYPES.DEPOSIT || p?.method === 'Deposit');
    if (!depositEditMode && hasExisting) {
      setDepositError("A deposit is already recorded. Delete it first if you need to start over.");
      return;
    }

    setDepositError("");

    updatePayments((prev) => {
      const existing = prev.find((p) => paymentKind(p) === PAYMENT_TYPES.DEPOSIT || p.method === 'Deposit');
      const rest = prev.filter((p) => paymentKind(p) !== PAYMENT_TYPES.DEPOSIT && p.method !== 'Deposit');
      const deposit = {
        ...(existing || {}),
        id: existing?.id || generateId(),
        date: depositDateRaw,
        amount: num.toFixed(2),
        method: depositMethod,
        note: existing?.note || "Initial Deposit",
        isPaid: true,
        status: "Paid",
        type: PAYMENT_TYPES.DEPOSIT,
        paymentType: PAYMENT_TYPES.DEPOSIT,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const withDeposit = [deposit, ...rest];
      // Deposit changed: unpaid installments always reflow to match the
      // new remaining balance, even ones a user previously hand-edited.
      return recalcInstallments(withDeposit, grandTotal, { resetLocks: true });
    });

    setDepositEditMode(false);
  }, [depositRaw, depositDateRaw, depositMethod, payments, depositEditMode, updatePayments, grandTotal]);

  const startDepositEdit = useCallback(() => {
    if (depositPayment) {
      setDepositRaw(depositPayment.amount);
      const dateStr = depositPayment.date ? String(depositPayment.date).split('T')[0] : todayString();
      setDepositDateRaw(dateStr);
      setDepositMethod(depositPayment.method || "Cash");
      setDepositEditMode(true);
      setDepositError("");
    }
  }, [depositPayment]);

  const cancelDepositEdit = useCallback(() => {
    setDepositEditMode(false);
    setDepositError("");
  }, []);

  const requestRemoveDeposit = useCallback(() => {
    const message = hasInstallmentPlan
      ? "Removing the deposit will recalculate unpaid installments against the full project total. Continue?"
      : "Remove the deposit?";
    setConfirmDialog({
      title: "Remove deposit",
      message,
      confirmLabel: "Remove deposit",
      danger: true,
      onConfirm: () => {
        updatePayments((prev) => {
          const withoutDeposit = prev.filter((p) => paymentKind(p) !== PAYMENT_TYPES.DEPOSIT && p.method !== 'Deposit');
          return recalcInstallments(withoutDeposit, grandTotal, { resetLocks: true });
        });
        setDepositRaw("");
        setDepositDateRaw(todayString());
        setDepositMethod("Cash");
        setDepositEditMode(false);
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [updatePayments, hasInstallmentPlan, grandTotal]);

  // ────────────────────────────────────────────────────────────────────
  // One-time payment mutators
  // ────────────────────────────────────────────────────────────────────
  const saveRefund = useCallback(() => {
    if (!refundReady) {
      setRefundError("Refund unlocks automatically once every payment is marked paid and there's an overpayment to return.");
      return;
    }
    const amount = parseFloat(refundPayment.amount);
    if (isNaN(amount) || amount <= 0 || !refundPayment.date) {
      setRefundError("Enter a valid amount and date");
      return;
    }
    if (amount > netPaid + EPSILON) {
      setRefundError(`Refund ($${fmt(amount)}) cannot exceed total amount paid ($${fmt(netPaid)})`);
      return;
    }
    if (amount > overpaidAmount + EPSILON) {
      setRefundError(`Refund ($${fmt(amount)}) cannot exceed the overpaid amount ($${fmt(overpaidAmount)})`);
      return;
    }
    setRefundError("");
    const now = new Date().toISOString();
    updatePayments((prev) =>
      recalcInstallments(
        [
          ...prev,
          {
            ...refundPayment,
            id: generateId(),
            amount: amount.toFixed(2),
            isPaid: true,
            status: "Paid",
            type: PAYMENT_TYPES.REFUND,
            paymentType: PAYMENT_TYPES.REFUND,
            createdAt: now,
            updatedAt: now,
          },
        ],
        grandTotal,
        { resetLocks: true },
      ),
    );
    setRefundPayment(EMPTY_REFUND());
    setShowRefundForm(false);
  }, [refundPayment, netPaid, overpaidAmount, refundReady, updatePayments, grandTotal]);

  // Opens the refund form pre-filled with the exact overpaid amount — staff
  // only need to confirm method/note, not calculate anything by hand.
  const openRefundForm = useCallback(() => {
    if (!refundReady) return;
    setRefundPayment({ ...EMPTY_REFUND(), amount: overpaidAmount.toFixed(2) });
    setRefundError("");
    setShowRefundForm(true);
  }, [refundReady, overpaidAmount]);

  const requestRemoveRefund = useCallback(
    (id) => {
      setConfirmDialog({
        title: "Remove refund",
        message: "Remove this refund entry? This will increase the amount due.",
        confirmLabel: "Remove refund",
        danger: true,
        onConfirm: () => {
          updatePayments((prev) =>
            recalcInstallments(
              prev.filter((p) => p.id !== id),
              grandTotal,
              { resetLocks: true },
            ),
          );
          setConfirmDialog(null);
        },
        onCancel: () => setConfirmDialog(null),
      });
    },
    [updatePayments, grandTotal],
  );

  // ────────────────────────────────────────────────────────────────────
  // Credit / price-adjustment mutators
  // Credits change settings.credits (not settings.payments) — CalculatorEngine
  // subtracts them from the grand total directly. Because grandTotal is about
  // to change, we recalc the installment schedule against the NEW total in
  // the same state update, so the UI never shows a stale/inconsistent number.
  // ────────────────────────────────────────────────────────────────────
  const saveCredit = useCallback(() => {
    const amount = parseFloat(creditEntry.amount);
    if (isNaN(amount) || amount <= 0 || !creditEntry.date) {
      setCreditError("Enter a valid amount and date");
      return;
    }
    if (!creditEntry.reason || !creditEntry.reason.trim()) {
      setCreditError("A reason is required (shows on the customer's estimate)");
      return;
    }
    if (amount > grandTotal + EPSILON) {
      setCreditError(`Credit ($${fmt(amount)}) cannot exceed the current project total ($${fmt(grandTotal)})`);
      return;
    }
    setCreditError("");
    const newGrandTotal = Math.max(0, grandTotal - amount);
    const now = new Date().toISOString();
    const newCredit = {
      ...creditEntry,
      id: generateId(),
      amount: amount.toFixed(2),
      reason: creditEntry.reason.trim(),
      createdAt: now,
      updatedAt: now,
    };

    setSettings((prev) => {
      const nextCredits = [...(prev.credits || []), newCredit];
      const nextPayments = recalcInstallments(prev.payments || [], newGrandTotal, { resetLocks: true });

      const errors = {};
      let runningNetPaid = 0;
      nextPayments.forEach((p, idx) => {
        if (!p) return;
        const amt = parseFloat(p.amount) || 0;
        const type = paymentKind(p);
        if (type === PAYMENT_TYPES.REFUND) runningNetPaid -= amt;
        else if (p.isPaid) runningNetPaid += amt;
        const errs = validatePayment(p, newGrandTotal, runningNetPaid);
        if (errs.length) errors[p.id || `p_${idx}`] = errs;
      });
      setValidationErrors(errors);

      return { ...prev, credits: nextCredits, payments: nextPayments };
    });

    setCreditEntry(EMPTY_CREDIT());
    setShowCreditForm(false);
  }, [creditEntry, grandTotal, setSettings]);

  const requestRemoveCredit = useCallback(
    (id) => {
      const credit = credits.find((c) => c.id === id);
      const amount = parseFloat(credit?.amount) || 0;
      setConfirmDialog({
        title: "Remove credit",
        message: `Remove this credit ($${fmt(amount)})? This will increase the project total back up and re-schedule unpaid installments.`,
        confirmLabel: "Remove credit",
        danger: true,
        onConfirm: () => {
          const newGrandTotal = grandTotal + amount;
          setSettings((prev) => {
            const nextCredits = (prev.credits || []).filter((c) => c.id !== id);
            const nextPayments = recalcInstallments(prev.payments || [], newGrandTotal, { resetLocks: true });
            return { ...prev, credits: nextCredits, payments: nextPayments };
          });
          setConfirmDialog(null);
        },
        onCancel: () => setConfirmDialog(null),
      });
    },
    [credits, grandTotal, setSettings],
  );

  // ────────────────────────────────────────────────────────────────────
  // Installment plan mutators
  // ────────────────────────────────────────────────────────────────────
  const planTargetBalance = remainingAfterDeposit;
  const previewAmount = useMemo(() => {
    const dur = parseInt(installmentDuration, 10);
    if (isNaN(dur) || dur < 1 || planTargetBalance <= 0 || isOverpaid) return "0.00";
    return Decimal.round(new Decimal(planTargetBalance).dividedBy(dur).times(100)).dividedBy(100).toFixed(2);
  }, [installmentDuration, planTargetBalance, isOverpaid]);

  const openPlanForm = useCallback(() => {
    if (hasInstallmentPlan) return;
    setGeneratedInstallments([]);
    setShowPlanForm(true);
  }, [hasInstallmentPlan]);

  const closePlanForm = useCallback(() => {
    setGeneratedInstallments([]);
    setShowPlanForm(false);
  }, []);

  const generateInstallments = useCallback(() => {
    if (hasInstallmentPlan) return;
    const duration = parseInt(installmentDuration, 10);
    if (isNaN(duration) || duration < 1 || duration > MAX_INSTALLMENT_MONTHS) return;
    if (isOverpaid) {
      setConfirmDialog({
        title: "Project is overpaid",
        message: "Cannot create installments while the project is overpaid. Issue a refund first.",
        informational: true,
        onConfirm: () => setConfirmDialog(null),
        onCancel: () => setConfirmDialog(null),
      });
      return;
    }

    if (planTargetBalance <= 0) {
      setConfirmDialog({
        title: "Nothing left to schedule",
        message: "There is no remaining balance to create installments for.",
        informational: true,
        onConfirm: () => setConfirmDialog(null),
        onCancel: () => setConfirmDialog(null),
      });
      return;
    }

    const amounts = splitAmountEvenly(new Decimal(planTargetBalance), duration);
    const start = parseSafeDate(installmentStartDate);
    const now = new Date().toISOString();
    const list = [];

    for (let i = 0; i < duration; i++) {
      const d = addMonthsClamped(start, i);
      list.push({
        id: generateId(),
        date: formatDateForInput(d),
        amount: amounts[i].toFixed(2),
        method: "Cash",
        note: duration === 1 ? "Single payment" : `Installment ${i + 1} of ${duration}`,
        isPaid: false,
        status: "Pending",
        type: PAYMENT_TYPES.INSTALLMENT,
        paymentType: PAYMENT_TYPES.INSTALLMENT,
        paidMethod: null,
        installmentNumber: i + 1,
        totalInstallments: duration,
        createdAt: now,
      });
    }

    setGeneratedInstallments(list);
  }, [hasInstallmentPlan, installmentDuration, installmentStartDate, planTargetBalance, isOverpaid]);

  const applyInstallmentPlan = useCallback(() => {
    if (generatedInstallments.length === 0 || hasInstallmentPlan) return;
    updatePayments((prev) => {
      const nonInstallments = prev.filter((p) => paymentKind(p) !== PAYMENT_TYPES.INSTALLMENT);
      return [...nonInstallments, ...renumberInstallments(generatedInstallments)];
    });
    setGeneratedInstallments([]);
    setShowPlanForm(false);
  }, [generatedInstallments, hasInstallmentPlan, updatePayments]);

  // ── Delete the entire installment plan ────────────────────────────────
  const requestDeleteInstallmentPlan = useCallback(() => {
    const paidCount = installmentPayments.filter((p) => p.isPaid).length;
    const message =
      paidCount > 0
        ? `Delete the entire installment plan? This removes all ${installmentPayments.length} installments, including ${paidCount} already marked as paid. You'll be able to generate a brand new plan afterward.`
        : `Delete the entire installment plan? This removes all ${installmentPayments.length} installments. You'll be able to generate a brand new plan afterward.`;
    setConfirmDialog({
      title: "Delete installment plan",
      message,
      confirmLabel: "Delete plan",
      danger: true,
      onConfirm: () => {
        updatePayments((prev) => prev.filter((p) => paymentKind(p) !== PAYMENT_TYPES.INSTALLMENT));
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [updatePayments, installmentPayments]);

  // ── Delete a single installment ────────────────────────────────────────
  // Removes one row and spreads its share across the remaining unpaid
  // installments so the plan still adds up to the grand total afterward.
  const requestDeleteInstallment = useCallback(
    (paymentId) => {
      const payment = installmentPayments.find((p) => p.id === paymentId);
      if (!payment) return;
      const remainingUnpaidCount = installmentPayments.filter(
        (p) => !p.isPaid && p.id !== paymentId,
      ).length;
      const message = payment.isPaid
        ? `Delete installment #${payment.installmentNumber} ($${fmt(payment.amount)})? It's marked as paid, so this will reduce the total paid and increase the amount still owed.`
        : remainingUnpaidCount > 0
          ? `Delete installment #${payment.installmentNumber} ($${fmt(payment.amount)})? Its amount will be spread across the remaining ${remainingUnpaidCount} unpaid installment${remainingUnpaidCount > 1 ? "s" : ""}.`
          : `Delete installment #${payment.installmentNumber} ($${fmt(payment.amount)})? It's the last unpaid installment, so this amount won't be scheduled anywhere afterward.`;
      setConfirmDialog({
        title: "Delete installment",
        message,
        confirmLabel: "Delete installment",
        danger: true,
        onConfirm: () => {
          updatePayments((prev) =>
            recalcInstallments(
              prev.filter((p) => p.id !== paymentId),
              grandTotal,
              { resetLocks: true },
            ),
          );
          setConfirmDialog(null);
        },
        onCancel: () => setConfirmDialog(null),
      });
    },
    [installmentPayments, updatePayments, grandTotal],
  );

  const toggleInstallmentPaid = useCallback(
    (paymentId, paidMethod) => {
      const now = new Date().toISOString();
      updatePayments((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== paymentId) return p;
          const nowPaid = !p.isPaid;
          return {
            ...p,
            isPaid: nowPaid,
            paidMethod: nowPaid ? paidMethod || p.method || "Cash" : null,
            paidAt: nowPaid ? now : null,
            status: nowPaid ? "Paid" : isPastDate(p.date) ? "Overdue" : "Pending",
            updatedAt: now,
          };
        });
        return recalcInstallments(updated, grandTotal);
      });
    },
    [updatePayments, grandTotal],
  );

  // Update one installment's amount: lock it to the typed value, then let
  // the rest of the unpaid installments absorb the difference.
  const updateInstallmentAmount = useCallback(
    (paymentId, rawAmount) => {
      const num = parseFloat(rawAmount);
      if (isNaN(num) || num < 0) return;

      updatePayments((prev) => {
        const updated = prev.map((p) =>
          p.id === paymentId
            ? {
                ...p,
                amount: num.toFixed(2),
                manuallyAdjusted: !p.isPaid,
                updatedAt: new Date().toISOString(),
              }
            : p,
        );
        return recalcInstallments(updated, grandTotal);
      });
    },
    [updatePayments, grandTotal],
  );

  const resetManualAdjustments = useCallback(() => {
    if (manuallyAdjustedUnpaidCount === 0) {
      setConfirmDialog({
        title: "Nothing to reset",
        message: "No manually adjusted installments to reset.",
        informational: true,
        onConfirm: () => setConfirmDialog(null),
        onCancel: () => setConfirmDialog(null),
      });
      return;
    }
    setConfirmDialog({
      title: "Reset to auto-calculated",
      message: `Reset ${manuallyAdjustedUnpaidCount} manually adjusted installment${manuallyAdjustedUnpaidCount > 1 ? "s" : ""} back to auto-calculated amounts?`,
      confirmLabel: "Reset",
      onConfirm: () => {
        updatePayments((prev) => recalcInstallments(prev, grandTotal, { resetLocks: true }));
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [updatePayments, manuallyAdjustedUnpaidCount, grandTotal]);

  // export functions removed by request

  // ── Header stats ──────────────────────────────────────────────────────
  const headerStats = [
    { icon: "fas fa-dollar-sign", value: `$${fmt(grandTotal)}`, label: "Grand Total" },
    { icon: "fas fa-check-circle", value: `$${fmt(netPaid)}`, label: "Total Paid", valueClassName: styles.paidStatus },
    {
      icon: isOverpaid ? "fas fa-exclamation-circle" : "fas fa-hourglass-half",
      value: isOverpaid ? "OVERPAID" : `$${fmt(remainingBalance)}`,
      label: isOverpaid ? "Overpayment" : "Remaining",
      valueClassName: isOverpaid ? styles.dueStatus : undefined,
      highlight: isOverpaid,
    },
  ];
  const [showReconDetails, setShowReconDetails] = useState(false);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={styles.section}>
      <SectionHeader
        title="Payment Tracking"
        icon="fas fa-credit-card"
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        stats={headerStats}
        disabled={disabled}
      />
      {isExpanded && (
        <div className={styles.content}>
          {confirmDialog && (
            <ConfirmModal
              title={confirmDialog.title}
              message={confirmDialog.message}
              confirmLabel={confirmDialog.confirmLabel}
              danger={confirmDialog.danger}
              informational={confirmDialog.informational}
              onConfirm={confirmDialog.onConfirm}
              onCancel={confirmDialog.onCancel}
            />
          )}

          {/* Export buttons removed */}

          {Object.keys(validationErrors).length > 0 && (
            <div className={styles.errorSummary} role="alert">
              <i className="fas fa-exclamation-triangle" />
              <span>Some payments have validation issues — check amounts and dates.</span>
            </div>
          )}

          {isOverpaid && (
            <div className={`${styles.alert} ${styles.alertWarning}`} role="alert">
              <i className="fas fa-exclamation-circle" />
              <span>
                <strong>Overpayment detected.</strong> Payments recorded (${fmt(netPaid)}) exceed the project
                total (${fmt(grandTotal)}) by ${fmt(netPaid - grandTotal)}.{" "}
                {refundReady
                  ? "Refund is unlocked below."
                  : "Refund will unlock automatically once every payment is marked paid."}
              </span>
            </div>
          )}

          {/* ── Summary cards ─────────────────────────────────────────── */}
          <div className={styles.summaryCompact}>
            <SummaryCard icon="fas fa-wallet" label="Grand Total" amount={grandTotal} />
            <SummaryCard
              icon="fas fa-check-circle"
              label="Total Paid"
              amount={netPaid}
              iconClass={styles.summaryIconSuccess}
              amountClass={styles.summaryAmountSuccess}
            />
            {totalRefunded > 0 && (
              <SummaryCard
                icon="fas fa-undo"
                label="Refunded"
                amount={totalRefunded}
                iconClass={styles.summaryIconError}
                amountClass={styles.summaryAmountError}
              />
            )}
            {totalCredits > 0 && (
              <SummaryCard
                icon="fas fa-tag"
                label="Credits Applied"
                amount={totalCredits}
                iconClass={styles.summaryIconError}
                amountClass={styles.summaryAmountError}
              />
            )}
            <SummaryCard
              icon={isOverpaid ? "fas fa-exclamation-circle" : "fas fa-hourglass-half"}
              label={isOverpaid ? "Overpaid by" : "Remaining"}
              amount={isOverpaid ? netPaid - grandTotal : remainingBalance}
              iconClass={isOverpaid ? styles.summaryIconError : undefined}
              amountClass={styles.summaryAmountError}
              cardClass={styles.summaryCardRemaining}
            />
          </div>

          {/* Reconciliation strip */}
          {(depositPayment || hasInstallmentPlan || totalRefunded > 0 || totalCredits > 0) && (
            <div className={styles.reconciliationStrip}>
              <span> <i className="fas fa-hand-holding-usd" /> Deposit ${fmt(depositAmount)}</span>
              <span>+ Installments paid ${fmt(paidInstallmentsTotal)}</span>
              {totalRefunded > 0 && <span>− Refunded ${fmt(totalRefunded)}</span>}
              <span className={styles.reconciliationTotal}>= ${fmt(netPaid)} net paid</span>
              <button
                type="button"
                className={styles.reconToggle}
                onClick={() => setShowReconDetails((v) => !v)}
                aria-expanded={showReconDetails}
                aria-label="Toggle payment breakdown"
              >
                {showReconDetails ? 'Hide details' : 'Details'}
              </button>
            </div>
          )}

          {showReconDetails && (
            <div className={styles.reconDetails}>
              {/* Deposit detail */}
              <div className={styles.reconDetailItem}>
                <strong>Deposit</strong>
                {depositPayment ? (
                  <span>${fmt(depositPayment.amount)} — {depositPayment.method} • {new Date(depositPayment.date).toLocaleDateString()}</span>
                ) : (
                  <span>None recorded</span>
                )}
              </div>

              {/* Installments detail */}
              <div className={styles.reconDetailItem}>
                <strong>Installments paid</strong>
                {installmentPayments.length > 0 ? (
                  (() => {
                    const paid = installmentPayments.filter((p) => p.isPaid);
                    const paidCount = paid.length;
                    const totalCount = installmentPayments.length;
                    const lastPaidDate = paid.length ? new Date(Math.max(...paid.map((p) => new Date(p.paidAt || p.date).getTime()))) : null;
                    return (
                      <span>
                        ${fmt(paidInstallmentsTotal)} — {paidCount} of {totalCount} paid{lastPaidDate ? ` • last paid ${lastPaidDate.toLocaleDateString()}` : ''}
                      </span>
                    );
                  })()
                ) : (
                  <span>No installments</span>
                )}
              </div>

              {/* Refunds detail */}
              {totalRefunded > 0 && (
                <div className={styles.reconDetailItem}>
                  <strong>Refunds</strong>
                  <span>−${fmt(totalRefunded)} — {refundPayments.length || 0} refund(s)</span>
                </div>
              )}

              {/* Credits detail */}
              {totalCredits > 0 && (
                <div className={styles.reconDetailItem}>
                  <strong>Credits</strong>
                  <span>−${fmt(totalCredits)} off project total — {credits.length} credit(s)</span>
                </div>
              )}
            </div>
          )}

          {overdueCount > 0 && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert">
              <i className="fas fa-clock" />
              <span>
                {overdueCount} payment{overdueCount > 1 ? "s are" : " is"} past due and still unpaid.
              </span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* DEPOSIT                                                       */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className={styles.depositInline}>
            <span className={styles.inlineLabel}>
              <i className="fas fa-hand-holding-usd" /> Initial Deposit
              {depositPayment && (
                <span className={styles.depositStatus}>
                  <i className="fas fa-lock" /> Locked
                </span>
              )}
            </span>

            {depositPayment && !depositEditMode ? (
              <div className={styles.depositLocked}>
                <span className={styles.depositLockedAmount}>
                  <i className="fas fa-check-circle" style={{ color: "var(--success)", fontSize: "0.8em" }} />
                  ${fmt(depositPayment.amount)}
                </span>
                <span className={styles.depositLockedDate}>
                  {new Date(depositPayment.date).toLocaleDateString()}
                </span>
                <span className={styles.depositLockedMethod}>{depositPayment.method}</span>
                {!disabled && (
                  <div className={styles.depositLockedActions}>
                    <button
                      onClick={startDepositEdit}
                      className={`${styles.btnAction} ${styles.btnActionEdit}`}
                      title="Edit deposit"
                      aria-label="Edit deposit"
                    >
                      <i className="fas fa-pencil-alt" />
                    </button>
                    <button
                        onClick={requestRemoveDeposit}
                        className={`${styles.btnAction} ${styles.btnActionDanger}`}
                        title="Remove deposit"
                        aria-label="Remove deposit"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                  </div>
                )}
              </div>
            ) : (
              !disabled && (
                <div className={styles.depositInputGroup}>
                  <div className={styles.inlineFields}>
                    <AmountInput
                      value={depositRaw}
                      onChange={(v) => { setDepositRaw(v); setDepositError(""); }}
                      onEnter={commitDeposit}
                      onEscape={depositEditMode ? cancelDepositEdit : undefined}
                      placeholder={depositEditMode ? "Update deposit amount" : "Amount (e.g. 500)"}
                      error={Boolean(depositError)}
                      autoFocus={depositEditMode}
                      ariaLabel="Deposit amount"
                    />
                    <input
                      type="date"
                      value={depositDateRaw}
                      onChange={(e) => setDepositDateRaw(e.target.value)}
                      className={styles.inlineInput}
                      aria-label="Deposit date"
                    />
                    <select
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value)}
                      className={styles.inlineInput}
                      aria-label="Deposit payment method"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  {depositError && <span className={styles.editError}>{depositError}</span>}
                  <div className={styles.depositFormActions}>
                    <button onClick={commitDeposit} className={styles.btnSubmit} disabled={!depositRaw}>
                      <i className="fas fa-check" />
                      {depositEditMode ? "Update" : "Save"} Deposit
                    </button>
                    {depositEditMode && (
                      <button onClick={cancelDepositEdit} className={styles.btnClear}>
                        <i className="fas fa-times" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* INSTALLMENT PLAN                                              */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className={styles.installmentCompact}>
            <div className={styles.compactHeader}>
              <div className={styles.headerLeft}>
                <i className="fas fa-calendar-alt" />
                <span>Installment Plan</span>
                {hasInstallmentPlan && (
                  <span className={styles.planStatus}>
                    {installmentStats.status === "completed" && (
                      <span className={styles.statusComplete}>
                        <i className="fas fa-check-circle" /> Complete
                      </span>
                    )}
                    {installmentStats.status === "in-progress" && (
                      <span className={styles.statusInProgress}>
                        <i className="fas fa-spinner fa-pulse" /> {installmentStats.paid}/{installmentStats.total} paid
                      </span>
                    )}
                    {installmentStats.status === "not-started" && (
                      <span className={styles.statusNotStarted}>
                        <i className="fas fa-hourglass-start" /> Not started
                      </span>
                    )}
                  </span>
                )}
                {depositPayment && (
                  <span className={styles.balanceInfo}>
                    <i className="fas fa-info-circle" />
                    Remaining after deposit: ${fmt(remainingAfterDeposit)}
                  </span>
                )}
              </div>
              <div className={styles.headerRight}>
                {!disabled && hasInstallmentPlan && manuallyAdjustedUnpaidCount > 0 && (
                  <button
                    onClick={resetManualAdjustments}
                    className={styles.btnReset}
                    title="Reset manually adjusted amounts back to the auto-calculated split"
                    aria-label="Reset manually adjusted installment amounts"
                  >
                    <i className="fas fa-undo" />
                  </button>
                )}
                {!disabled && !isOverpaid && depositPayment && !hasInstallmentPlan && (
                  <button
                    onClick={showPlanForm ? closePlanForm : openPlanForm}
                    className={styles.toggleBtn}
                  >
                    <i className={`fas fa-${showPlanForm ? "minus" : "plus"}`} />
                    {showPlanForm ? "Hide" : "Create Plan"}
                  </button>
                )}
              </div>
            </div>

            {hasInstallmentPlan && (
              <ProgressBar percent={installmentStats.percentComplete} label="Installment plan progress" />
            )}

            {!depositPayment && (
              <div className={styles.planWarning} style={{ borderLeftColor: "var(--warning)" }}>
                <i className="fas fa-exclamation-triangle" style={{ color: "var(--warning)" }} />
                <span>Add a deposit first before creating an installment plan.</span>
              </div>
            )}

            {showPlanForm && depositPayment && !isOverpaid && !hasInstallmentPlan && (
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
                    aria-label="Installment plan start date"
                  />
                  <span className={styles.planAmount}>
                    ${previewAmount}
                    {parseInt(installmentDuration, 10) > 1 ? "/month" : " total"}
                  </span>
                </div>

                <div className={styles.planActions}>
                  <button
                    onClick={generateInstallments}
                    className={styles.btnGenerate}
                    disabled={planTargetBalance <= 0}
                  >
                    <i className="fas fa-calculator" /> Generate
                  </button>
                  {generatedInstallments.length > 0 && (
                    <>
                      <button onClick={applyInstallmentPlan} className={styles.btnApply}>
                        <i className="fas fa-check-double" /> Apply Plan ({generatedInstallments.length} payments)
                      </button>
                      <button onClick={() => setGeneratedInstallments([])} className={styles.btnClear}>
                        <i className="fas fa-times" /> Clear
                      </button>
                    </>
                  )}
                </div>

                {generatedInstallments.length > 0 && (
                  <div className={styles.previewSection}>
                    <div className={styles.previewHeader}>
                      <span>
                        <i className="fas fa-eye" /> Preview ({generatedInstallments.length}{" "}
                        {generatedInstallments.length === 1 ? "payment" : "payments"})
                      </span>
                      <span className={styles.statPaid}>
                        Total: ${fmt(generatedInstallments.reduce((s, p) => s + parseFloat(p.amount), 0))}
                      </span>
                    </div>
                    <div className={styles.previewList}>
                      {generatedInstallments.map((inst) => (
                        <div key={inst.id || inst._id || `gen-${inst.installmentNumber || Math.random()}`} className={styles.previewItem}>
                          <span className={styles.previewNumber}>#{inst.installmentNumber}</span>
                          <span className={styles.previewDate}>{new Date(inst.date).toLocaleDateString()}</span>
                          <span className={styles.previewAmount}>${fmt(inst.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {hasInstallmentPlan && (
              <div className={styles.installmentGroup}>
                <div className={styles.installmentGroupHeader}>
                  <div className={styles.groupHeaderLeft}>
                    <i className="fas fa-calendar-alt" />
                    <span className={styles.groupTitle}>Installment Plan</span>
                    <span className={styles.groupProgress}>
                      {installmentStats.paid}/{installmentStats.total} paid
                    </span>
                    <span className={styles.groupBalance}>
                      Balance: ${fmt(Math.max(0, installmentStats.totalAmount - installmentStats.paidAmount))}
                    </span>
                  </div>
                  <div className={styles.groupHeaderRight}>
                    <span className={styles.groupAmount}>
                      ${fmt(installmentStats.paidAmount)} / ${fmt(installmentStats.totalAmount)}
                    </span>
                    {!disabled && (
                      <button
                        onClick={requestDeleteInstallmentPlan}
                        className={styles.btnRemovePlan}
                        title="Delete the entire installment plan so you can generate a new one"
                        aria-label="Delete entire installment plan"
                      >
                        <i className="fas fa-trash-alt" /> Delete Plan
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.installmentPayments}>
                  {installmentPayments.map((payment, i) => (
                    <InstallmentRow
                      key={payment.id || payment._id || `inst-${i}`}
                      payment={payment}
                      disabled={disabled}
                      onTogglePaid={(method) => toggleInstallmentPaid(payment.id, method)}
                      onAmountChange={(val) => updateInstallmentAmount(payment.id, val)}
                      onDelete={() => requestDeleteInstallment(payment.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* REFUNDS (locked until fully paid, auto-calculated)            */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className={styles.oneTimeSection}>
            <div className={styles.compactHeader}>
              <div className={styles.headerLeft}>
                <i className="fas fa-undo" />
                <span>Refunds</span>
                {refundPayments.length > 0 && <span className={styles.paymentCount}>{refundPayments.length}</span>}
              </div>
              {!disabled && (
                <button
                  onClick={() => (showRefundForm ? setShowRefundForm(false) : openRefundForm())}
                  className={`${styles.toggleBtn} ${showRefundForm ? styles.toggleBtnActive : ""}`}
                  disabled={!refundReady && !showRefundForm}
                  title={
                    refundReady
                      ? undefined
                      : "Refund unlocks once every payment is marked paid and the customer has overpaid."
                  }
                >
                  <i className={`fas fa-${showRefundForm ? "minus" : "plus"}`} />
                  {showRefundForm ? "Hide" : "Add Refund"}
                </button>
              )}
            </div>

            {/* Notification: shows automatically the moment a refund becomes owed */}
            {refundReady && !showRefundForm && (
              <div
                role="status"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-sm)",
                  padding: "var(--spacing-sm) var(--spacing-md)",
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid var(--warning)",
                  borderRadius: "var(--radius-sm, 6px)",
                  color: "var(--warning)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <i className="fas fa-triangle-exclamation" />
                <span style={{ flex: 1 }}>
                  Customer overpaid by <strong>${fmt(overpaidAmount)}</strong> — a refund is ready to issue.
                </span>
                {!disabled && (
                  <button onClick={openRefundForm} className={styles.btnSubmit}>
                    Issue Refund
                  </button>
                )}
              </div>
            )}

            {!refundReady && !showRefundForm && (isOverpaid || (!isFullyPaid && collectibleForLock.length > 0)) && (
              <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--text-light)" }}>
                {isOverpaid
                  ? "There's an overpayment, but refund stays locked until every deposit/installment is marked paid."
                  : "Refund unlocks automatically once the project is fully paid and there's an amount to return."}
              </p>
            )}

            {showRefundForm && !disabled && (
              <div className={styles.oneTimeForm}>
                <div className={styles.formGrid}>
                  <input
                    type="date"
                    value={refundPayment.date}
                    onChange={(e) => { setRefundPayment((p) => ({ ...p, date: e.target.value })); setRefundError(""); }}
                    className={styles.formInput}
                    aria-label="Refund date"
                  />
                  <AmountInput
                    value={refundPayment.amount}
                    onChange={(v) => { setRefundPayment((p) => ({ ...p, amount: v })); setRefundError(""); }}
                    placeholder="Refund amount"
                    error={Boolean(refundError)}
                    className={styles.formInput}
                    ariaLabel="Refund amount"
                  />
                  <select
                    value={refundPayment.method}
                    onChange={(e) => setRefundPayment((p) => ({ ...p, method: e.target.value }))}
                    className={styles.formSelect}
                    aria-label="Refund method"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={refundPayment.note}
                    onChange={(e) => setRefundPayment((p) => ({ ...p, note: e.target.value }))}
                    placeholder="Reason (optional)"
                    className={styles.formInput}
                    aria-label="Refund reason"
                  />
                </div>
                {refundError && <span className={styles.editError}>{refundError}</span>}
                <div className={styles.formFooter}>
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-light)" }}>
                    Auto-calculated overpayment: ${fmt(overpaidAmount)}
                  </span>
                  <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                    <button
                      onClick={saveRefund}
                      className={styles.btnSubmit}
                      disabled={!refundPayment.amount || !refundPayment.date}
                    >
                      <i className="fas fa-check" /> Save Refund
                    </button>
                    <button onClick={() => { setShowRefundForm(false); setRefundError(""); }} className={styles.btnClear}>
                      <i className="fas fa-times" /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {refundPayments.length > 0 && (
              <div className={styles.oneTimeList}>
                {refundPayments.map((payment, i) => (
                  <div 
                    key={payment.id || payment._id || `refund-${i}`}
                    className={`${styles.paymentRow} ${styles.manualRow}`} 
                    style={{ borderLeft: "4px solid var(--warning)" }}
                  >
                    <i className="fas fa-undo" style={{ color: "var(--warning)", flexShrink: 0 }} />
                    <div className={styles.paymentInfo}>
                      <span className={styles.paymentDate}>{new Date(payment.date).toLocaleDateString()}</span>
                      <span className={styles.paymentAmount} style={{ color: "var(--warning)" }}>
                        −${fmt(payment.amount)}
                      </span>
                      <span className={styles.paymentMethod}>{payment.method}</span>
                      {payment.note && (
                        <span className={styles.paymentNote} title={payment.note}>{payment.note}</span>
                      )}
                    </div>
                    {!disabled && (
                      <button
                        onClick={() => requestRemoveRefund(payment.id)}
                        className={`${styles.btnAction} ${styles.btnActionDanger}`}
                        title="Remove refund"
                        aria-label={`Remove refund of $${fmt(payment.amount)}`}
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CREDITS / PRICE ADJUSTMENTS                                    */}
          {/* Reduces the project total itself (via CalculatorEngine), not   */}
          {/* just the amount collected. Use for damaged product, price      */}
          {/* changes, or customer-dissatisfaction adjustments.              */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className={styles.oneTimeSection}>
            <div className={styles.compactHeader}>
              <div className={styles.headerLeft}>
                <i className="fas fa-tag" />
                <span>Credits / Price Adjustments</span>
                {credits.length > 0 && <span className={styles.paymentCount}>{credits.length}</span>}
              </div>
              {!disabled && grandTotal > 0 && (
                <button
                  onClick={() => { setShowCreditForm(!showCreditForm); setCreditError(""); }}
                  className={`${styles.toggleBtn} ${showCreditForm ? styles.toggleBtnActive : ""}`}
                >
                  <i className={`fas fa-${showCreditForm ? "minus" : "plus"}`} />
                  {showCreditForm ? "Hide" : "Add Credit"}
                </button>
              )}
            </div>

            {showCreditForm && !disabled && (
              <div className={styles.oneTimeForm}>
                <div className={styles.formGrid}>
                  <input
                    type="date"
                    value={creditEntry.date}
                    onChange={(e) => { setCreditEntry((c) => ({ ...c, date: e.target.value })); setCreditError(""); }}
                    className={styles.formInput}
                    aria-label="Credit date"
                  />
                  <AmountInput
                    value={creditEntry.amount}
                    onChange={(v) => { setCreditEntry((c) => ({ ...c, amount: v })); setCreditError(""); }}
                    placeholder="Credit amount"
                    error={Boolean(creditError)}
                    className={styles.formInput}
                    ariaLabel="Credit amount"
                  />
                  <input
                    type="text"
                    value={creditEntry.reason}
                    onChange={(e) => { setCreditEntry((c) => ({ ...c, reason: e.target.value })); setCreditError(""); }}
                    placeholder="Reason (required — shown on estimate)"
                    className={styles.formInput}
                    aria-label="Credit reason"
                  />
                </div>
                {creditError && <span className={styles.editError}>{creditError}</span>}
                <div className={styles.formFooter}>
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-light)" }}>
                    Lowers the project total from ${fmt(grandTotal)}. Unpaid installments will be re-scheduled.
                  </span>
                  <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                    <button
                      onClick={saveCredit}
                      className={styles.btnSubmit}
                      disabled={!creditEntry.amount || !creditEntry.date || !creditEntry.reason}
                    >
                      <i className="fas fa-check" /> Save Credit
                    </button>
                    <button onClick={() => { setShowCreditForm(false); setCreditError(""); }} className={styles.btnClear}>
                      <i className="fas fa-times" /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {credits.length > 0 && (
              <div className={styles.oneTimeList}>
                {credits.map((credit, i) => (
                  <div
                    key={credit.id || `credit-${i}`}
                    className={`${styles.paymentRow} ${styles.manualRow}`}
                    style={{ borderLeft: "4px solid var(--info, #3b82f6)" }}
                  >
                    <i className="fas fa-tag" style={{ color: "var(--info, #3b82f6)", flexShrink: 0 }} />
                    <div className={styles.paymentInfo}>
                      <span className={styles.paymentDate}>{new Date(credit.date).toLocaleDateString()}</span>
                      <span className={styles.paymentAmount} style={{ color: "var(--info, #3b82f6)" }}>
                        −${fmt(credit.amount)}
                      </span>
                      {credit.reason && (
                        <span className={styles.paymentNote} title={credit.reason}>{credit.reason}</span>
                      )}
                    </div>
                    {!disabled && (
                      <button
                        onClick={() => requestRemoveCredit(credit.id)}
                        className={`${styles.btnAction} ${styles.btnActionDanger}`}
                        title="Remove credit"
                        aria-label={`Remove credit of $${fmt(credit.amount)}`}
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {!hasInstallmentPlan && !depositPayment && refundPayments.length === 0 && credits.length === 0 && (
            <div className={styles.emptyState}>
              <i className="fas fa-inbox" />
              <p>No payments recorded yet. Add a deposit, or create an installment plan.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}