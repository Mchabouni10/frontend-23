// src/components/Calculator/Category/CostSummary.jsx

import React, { useState, useMemo } from "react";
import { useCalculation } from "../../../context/CalculationContext";
import { useSettings } from "../../../context/SettingsContext";
import { useCategories } from "../../../context/CategoriesContext";
import SectionHeader from "./SectionHeader";
import styles from "./CostSummary.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PaymentProgress({ paid, total, overdue }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className={styles.paymentProgress}>
      <div className={styles.progressBar}>
        <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.progressLabels}>
        <span className={styles.progressLabel}>
          {paid} / {total} paid
        </span>
        {overdue > 0 && (
          <span className={styles.overdueLabel}>{overdue} overdue</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CostSummary() {
  const { paymentDetails, derived, hasErrors, isReady } = useCalculation();
  const { settings } = useSettings();
  const { categories } = useCategories();

  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    labor: false,
    adjustments: false,
  });

  const toggleSection = (key) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Category stats for the header
  const categoryStats = useMemo(() => {
    if (!Array.isArray(categories)) return { total: 0, items: 0 };
    return {
      total: categories.length,
      items: categories.reduce((s, c) => s + (c.workItems?.length || 0), 0),
    };
  }, [categories]);

  const hasLaborDiscount = derived.discountAmount > 0;
  const hasAdjustments = derived.totalAdjustments > 0;
  const depositPayment = settings.payments?.find(
    (p) => p.type === "Deposit" || p.method === "Deposit",
  );

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return (
      <div className={styles.section}>
        <SectionHeader
          title="Cost Summary"
          icon="fas fa-chart-bar"
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          stats={[
            { icon: "fas fa-folder", value: 0, label: "Categories" },
            { icon: "fas fa-check-circle", value: 0, label: "Items" },
          ]}
        />
        <div className={styles.summaryContent}>
          <div className={styles.emptyState}>
            <div className={styles.helpMessage}>
              <i className="fas fa-chart-line" />
              <h4>No Categories Yet</h4>
              <p>Add categories and work items to see your cost summary.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.section}>
      <SectionHeader
        title="Cost Summary"
        icon="fas fa-chart-bar"
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        stats={[
          {
            icon: "fas fa-layer-group",
            value: categoryStats.total,
            label: "Categories",
          },
          {
            icon: "fas fa-cube",
            value: categoryStats.items,
            label: "Total Items",
          },
          {
            icon: "fas fa-coins",
            value: `$${fmt(derived.grandTotal)}`,
            label: "Grand Total",
            highlight: true,
          },
        ]}
      />

      {isExpanded && (
        <div className={styles.summaryContent}>
          {/* Engine error notice */}
          {!isReady && (
            <div className={styles.errorSection}>
              <i className="fas fa-exclamation-triangle" /> Calculator engine
              unavailable — check context setup.
            </div>
          )}
          {isReady && hasErrors && (
            <div className={styles.errorSection}>
              <i className="fas fa-exclamation-triangle" /> Some items have
              calculation issues. Review work item data.
            </div>
          )}

          {/* Key metrics row */}
          <div className={styles.metricsRow}>
            <div className={`${styles.metricItem} ${styles.materialMetric}`}>
              <i className="fas fa-cubes" />
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>
                  ${fmt(derived.material)}
                </span>
                <small>Materials</small>
              </div>
            </div>
            <div className={`${styles.metricItem} ${styles.laborMetric}`}>
              <i className="fas fa-tools" />
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>
                  ${fmt(derived.labor)}
                </span>
                <small>Labor</small>
              </div>
            </div>
            <div className={`${styles.metricItem} ${styles.totalMetric}`}>
              <i className="fas fa-receipt" />
              <div className={styles.metricContent}>
                <span className={styles.metricValue}>
                  ${fmt(derived.grandTotal)}
                </span>
                <small>Total</small>
              </div>
            </div>
          </div>

          {/* Summary table */}
          <div className={styles.summaryGrid}>
            <div className={styles.stickyHeader}>
              <span className={styles.summaryLabel}>Description</span>
              <span className={styles.summaryValue}>Amount</span>
            </div>

            {/* Materials */}
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-cubes" /> Materials Cost
              </span>
              <span className={styles.summaryValue}>
                ${fmt(derived.material)}
              </span>
            </div>

            {/* Labor — collapsible */}
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <button
                  className={styles.detailToggle}
                  onClick={() => toggleSection("labor")}
                >
                  <i className="fas fa-tools" /> Labor Cost
                  <i
                    className={`fas ${
                      expandedSections.labor
                        ? "fa-chevron-up"
                        : "fa-chevron-down"
                    } ${styles.toggleIcon}`}
                  />
                </button>
              </span>
              <span className={styles.summaryValue}>
                ${fmt(derived.labor)}
                {hasLaborDiscount && (
                  <small className={styles.discountBadge}>
                    −${fmt(derived.discountAmount)}
                  </small>
                )}
              </span>
            </div>

            {expandedSections.labor && (
              <div className={styles.detailsSection}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Before Discount:</span>
                  <span className={styles.detailValue}>
                    ${fmt(derived.laborBeforeDiscount)}
                  </span>
                </div>
                {hasLaborDiscount && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>
                      Discount ({(derived.discountPct * 100).toFixed(1)}%):
                    </span>
                    <span
                      className={`${styles.detailValue} ${styles.discount}`}
                    >
                      −${fmt(derived.discountAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Subtotal */}
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-subscript" /> Subtotal
              </span>
              <span className={styles.summaryValue}>
                ${fmt(derived.material + derived.labor)}
              </span>
            </div>

            {/* Adjustments — collapsible */}
            {hasAdjustments && (
              <>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>
                    <button
                      className={styles.detailToggle}
                      onClick={() => toggleSection("adjustments")}
                    >
                      <i className="fas fa-chart-line" /> Adjustments
                      <i
                        className={`fas ${
                          expandedSections.adjustments
                            ? "fa-chevron-up"
                            : "fa-chevron-down"
                        } ${styles.toggleIcon}`}
                      />
                    </button>
                  </span>
                  <span className={styles.summaryValue}>
                    ${fmt(derived.totalAdjustments)}
                  </span>
                </div>

                {expandedSections.adjustments && (
                  <div className={styles.detailsSection}>
                    {derived.waste > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>
                          <i className="fas fa-recycle" /> Waste Factor
                        </span>
                        <span className={styles.detailValue}>
                          ${fmt(derived.waste)}
                        </span>
                      </div>
                    )}
                    {derived.transportation > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>
                          <i className="fas fa-truck" /> Transportation
                        </span>
                        <span className={styles.detailValue}>
                          ${fmt(derived.transportation)}
                        </span>
                      </div>
                    )}
                    {derived.markup > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>
                          <i className="fas fa-chart-line" /> Markup
                        </span>
                        <span className={styles.detailValue}>
                          ${fmt(derived.markup)}
                        </span>
                      </div>
                    )}
                    {derived.tax > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>
                          <i className="fas fa-percentage" /> Tax
                        </span>
                        <span className={styles.detailValue}>
                          ${fmt(derived.tax)}
                        </span>
                      </div>
                    )}
                    {derived.misc > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>
                          <i className="fas fa-money-bill-wave" /> Misc Fees
                        </span>
                        <span className={styles.detailValue}>
                          ${fmt(derived.misc)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Grand Total */}
            <div className={`${styles.summaryItem} ${styles.total}`}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-receipt" /> Grand Total
              </span>
              <span className={styles.summaryValue}>
                ${fmt(derived.grandTotal)}
              </span>
            </div>

            {/* Payment info */}
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-credit-card" /> Total Paid
              </span>
              <span className={styles.summaryValue}>
                ${fmt(derived.totalPaid)}
              </span>
            </div>

            {depositPayment && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-hand-holding-usd" /> Deposit
                </span>
                <span className={`${styles.summaryValue} ${styles.paid}`}>
                  −${fmt(derived.deposit)}
                </span>
              </div>
            )}

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-file-invoice" /> Payment Status
              </span>
              <span className={styles.summaryValue}>
                <PaymentProgress
                  paid={paymentDetails.summary.paidPayments}
                  total={paymentDetails.summary.totalPayments}
                  overdue={paymentDetails.summary.overduePayments}
                />
              </span>
            </div>

            {/* Balance */}
            <div
              className={`${styles.summaryItem} ${
                derived.hasOverpayment ? styles.overpayment : styles.amountDue
              }`}
            >
              <span className={styles.summaryLabel}>
                {derived.hasOverpayment ? (
                  <>
                    <i className="fas fa-gift" /> Overpayment
                  </>
                ) : (
                  <>
                    <i className="fas fa-money-bill" /> Amount Due
                  </>
                )}
              </span>
              <span className={styles.summaryValue}>
                $
                {fmt(
                  derived.hasOverpayment
                    ? derived.overpayment
                    : derived.totalDue,
                )}
              </span>
            </div>
          </div>

          {/* Notices */}
          {derived.hasOverpayment && (
            <div className={styles.overpaymentNotice}>
              <i className="fas fa-gift" />
              <div className={styles.noticeContent}>
                <strong>Overpayment: ${fmt(derived.overpayment)}</strong>
                <p>Consider a refund or credit toward future work.</p>
              </div>
            </div>
          )}

          {!derived.hasOverpayment && derived.totalDue > 0 && (
            <div className={styles.dueAmountNotice}>
              <i className="fas fa-exclamation-circle" />
              <div className={styles.noticeContent}>
                <strong>Due: ${fmt(derived.totalDue)}</strong>
                <p>Follow up with customer for payment.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
