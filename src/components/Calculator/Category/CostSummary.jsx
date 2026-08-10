// src/components/Calculator/Category/CostSummary.jsx

import React, { useMemo, useState } from "react";
import { useCalculation } from "../../../context/CalculationContext";
import { useCategories } from "../../../context/CategoriesContext";
import { parseNumber, formatCurrency } from "../engine/CalculatorEngine";
import SectionHeader from "./SectionHeader";
import styles from "./CostSummary.module.css";

// useSettings is intentionally removed — the engine's calculatePaymentDetails()
// already exposes deposit, refunded, and all payment counts via paymentDetails.
// Never re-loop over settings.payments in a component.

function MetricCard({ icon, label, value, tone = "neutral" }) {
  return (
    <div className={`${styles.metricCard} ${styles[tone] || ""}`}>
      <span className={styles.metricIcon}>
        <i className={icon} />
      </span>
      <span className={styles.metricBody}>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function SummaryRow({ icon, label, value, valueClass = "", note }) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryLabel}>
        <i className={icon} />
        {label}
        {note && <small>{note}</small>}
      </span>
      <span className={`${styles.summaryValue} ${valueClass}`}>{value}</span>
    </div>
  );
}

function PaymentProgress({ paid, total, overdue }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className={styles.paymentProgress}>
      <div className={styles.progressBar} aria-hidden="true">
        <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.progressLabels}>
        <span>{total > 0 ? `${paid}/${total} paid` : "No scheduled payments"}</span>
        {overdue > 0 && <strong>{overdue} overdue</strong>}
      </div>
    </div>
  );
}

export default function CostSummary() {
  const { paymentDetails, derived, hasErrors, isReady } = useCalculation();
  const { categories } = useCategories();
  const [isExpanded, setIsExpanded] = useState(true);

  const categoryStats = useMemo(() => {
    if (!Array.isArray(categories)) return { total: 0, items: 0 };
    return {
      total: categories.length,
      items: categories.reduce(
        (sum, category) => sum + (category.workItems?.length || 0),
        0,
      ),
    };
  }, [categories]);

  // All values come directly from the engine. No local recalculation.
  // ?? instead of || so a genuine 0 from the engine is respected, not overridden.
  const paymentStats = useMemo(() => ({
    refunded:     parseNumber(paymentDetails.totalRefunded),
    deposit:      parseNumber(paymentDetails.deposit),
    paidCount:    paymentDetails.summary?.paidPayments    ?? 0,
    totalCount:   paymentDetails.summary?.totalPayments   ?? 0,
    overdueCount: paymentDetails.summary?.overduePayments ?? 0,
    refundCount:  paymentDetails.summary?.refundedPayments ?? 0,
  }), [paymentDetails]);

  const hasCategories = Array.isArray(categories) && categories.length > 0;
  const hasWorkItems = categoryStats.items > 0;
  const hasLaborDiscount = derived.discountAmount > 0;
  const hasAdjustments = derived.totalAdjustments > 0;
  const balanceLabel = derived.hasOverpayment ? "Overpayment" : "Amount Due";
  const balanceValue = derived.hasOverpayment ? derived.overpayment : derived.totalDue;
  const balanceTone = derived.hasOverpayment ? "success" : derived.totalDue > 0 ? "danger" : "success";

  return (
    <div className={styles.section}>
      <SectionHeader
        title="Cost Summary"
        icon="fas fa-chart-bar"
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        stats={[
          { icon: "fas fa-layer-group", value: categoryStats.total, label: "Categories" },
          { icon: "fas fa-cube", value: categoryStats.items, label: "Items" },
          {
            icon: "fas fa-coins",
            value: formatCurrency(derived.grandTotal),
            label: "Grand Total",
            highlight: true,
          },
        ]}
      />

      {isExpanded && (
        <div className={styles.summaryContent}>
          {!hasCategories || !hasWorkItems ? (
            <div className={styles.emptyState}>
              <i className="fas fa-chart-line" />
              <div>
                <h4>No Cost Data Yet</h4>
                <p>Add work items to see the project summary.</p>
              </div>
            </div>
          ) : (
            <>
              {!isReady && (
                <div className={styles.errorSection}>
                  <i className="fas fa-exclamation-triangle" />
                  Calculator engine unavailable.
                </div>
              )}

              {isReady && hasErrors && (
                <div className={styles.errorSection}>
                  <i className="fas fa-exclamation-triangle" />
                  Some items have calculation issues.
                </div>
              )}

              <div className={styles.metricsGrid}>
                <MetricCard
                  icon="fas fa-receipt"
                  label="Grand Total"
                  value={formatCurrency(derived.grandTotal)}
                  tone="primary"
                />
                <MetricCard
                  icon={derived.hasOverpayment ? "fas fa-gift" : "fas fa-money-bill"}
                  label={balanceLabel}
                  value={formatCurrency(balanceValue)}
                  tone={balanceTone}
                />
                <MetricCard
                  icon="fas fa-check-circle"
                  label="Net Paid"
                  value={formatCurrency(derived.totalPaid)}
                  tone="success"
                />
                <MetricCard
                  icon="fas fa-clipboard-list"
                  label="Scope"
                  value={`${categoryStats.items} items`}
                  tone="neutral"
                />
              </div>

              <div className={styles.snapshotGrid}>
                <section className={styles.snapshotPanel}>
                  <div className={styles.panelHeader}>
                    <i className="fas fa-calculator" />
                    <h4>Cost Snapshot</h4>
                  </div>

                  <SummaryRow
                    icon="fas fa-cubes"
                    label="Materials"
                    value={formatCurrency(derived.material)}
                  />
                  <SummaryRow
                    icon="fas fa-tools"
                    label="Labor"
                    note={hasLaborDiscount ? `${(derived.discountPct * 100).toFixed(1)}% discount` : null}
                    value={formatCurrency(derived.labor)}
                    valueClass={hasLaborDiscount ? styles.discounted : ""}
                  />
                  {hasLaborDiscount && (
                    <SummaryRow
                      icon="fas fa-tag"
                      label="Labor Savings"
                      value={`-${formatCurrency(derived.discountAmount)}`}
                      valueClass={styles.positiveValue}
                    />
                  )}
                  {hasAdjustments && (
                    <SummaryRow
                      icon="fas fa-sliders-h"
                      label="Adjustments"
                      note={[
                        derived.waste > 0 ? "waste" : null,
                        derived.markup > 0 ? "markup" : null,
                        derived.tax > 0 ? "tax" : null,
                        derived.misc > 0 ? "fees" : null,
                        derived.transportation > 0 ? "transport" : null,
                      ].filter(Boolean).join(", ")}
                      value={formatCurrency(derived.totalAdjustments)}
                    />
                  )}
                </section>

                <section className={styles.snapshotPanel}>
                  <div className={styles.panelHeader}>
                    <i className="fas fa-credit-card" />
                    <h4>Payment Snapshot</h4>
                  </div>

                  <SummaryRow
                    icon="fas fa-check-circle"
                    label="Total Paid"
                    value={formatCurrency(derived.totalPaid)}
                    valueClass={styles.positiveValue}
                  />
                  {paymentStats.deposit > 0 && (
                    <SummaryRow
                      icon="fas fa-hand-holding-usd"
                      label="Deposit Included"
                      value={formatCurrency(paymentStats.deposit)}
                    />
                  )}
                  {paymentStats.refunded > 0 && (
                    <SummaryRow
                      icon="fas fa-undo"
                      label="Refunded"
                      note={`${paymentStats.refundCount || 1} refund${(paymentStats.refundCount || 1) > 1 ? "s" : ""}`}
                      value={`-${formatCurrency(paymentStats.refunded)}`}
                      valueClass={styles.warningValue}
                    />
                  )}
                  <SummaryRow
                    icon={derived.hasOverpayment ? "fas fa-gift" : "fas fa-file-invoice"}
                    label={balanceLabel}
                    value={formatCurrency(balanceValue)}
                    valueClass={derived.hasOverpayment ? styles.positiveValue : styles.dangerValue}
                  />

                  <PaymentProgress
                    paid={paymentStats.paidCount}
                    total={paymentStats.totalCount}
                    overdue={paymentStats.overdueCount}
                  />
                </section>
              </div>

              {derived.hasOverpayment && (
                <div className={styles.overpaymentNotice}>
                  <i className="fas fa-gift" />
                  <strong>Overpayment: {formatCurrency(derived.overpayment)}</strong>
                  <span>Consider a refund or customer credit.</span>
                </div>
              )}

              {!derived.hasOverpayment && derived.totalDue > 0 && (
                <div className={styles.dueAmountNotice}>
                  <i className="fas fa-exclamation-circle" />
                  <strong>Due: {formatCurrency(derived.totalDue)}</strong>
                  <span>Follow up on the remaining balance.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
