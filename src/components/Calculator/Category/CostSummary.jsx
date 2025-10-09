// src/components/Calculator/Category/CostSummary.jsx
import React, { useState, useMemo } from "react";
import { useCategories } from "../../../context/CategoriesContext";
import { useSettings } from "../../../context/SettingsContext";
import { useWorkType } from "../../../context/WorkTypeContext";
import { useError } from "../../../context/ErrorContext";
import { CalculatorEngine } from "../engine/CalculatorEngine";
import styles from "./CostSummary.module.css";

// Helper function to safely convert error to string
const errorToString = (error) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    return error.message || error.toString() || "Unknown error";
  }
  return String(error || "Unknown error");
};

// Helper to format number with commas
const formatNumber = (value) => {
  const num = parseFloat(value) || 0;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Progress bar component for payment status
const PaymentProgress = ({ paid, total, overdue }) => {
  const paidPercentage = total > 0 ? (paid / total) * 100 : 0;

  return (
    <div className={styles.paymentProgress}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${paidPercentage}%` }}
        />
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
};

export default function CostSummary() {
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } =
    useWorkType();
  const { addError } = useError();

  const [isExpanded, setIsExpanded] = useState(true);
  const [calculationErrors, setCalculationErrors] = useState([]);
  const [showWasteDetails, setShowWasteDetails] = useState(false);

  // Calculate waste entries total
  const wasteEntriesTotal = useMemo(() => {
    const wasteEntries = settings.wasteEntries || [];
    return wasteEntries.reduce((total, entry) => {
      const surfaceCost = parseFloat(entry.surfaceCost) || 0;
      const wasteFactor = parseFloat(entry.wasteFactor) || 0;
      return total + (surfaceCost * wasteFactor);
    }, 0);
  }, [settings.wasteEntries]);

  // Create Calculator Engine instance
  const calculatorEngine = useMemo(() => {
    try {
      if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
        return null;
      }

      return new CalculatorEngine(
        categories || [],
        settings || {},
        {
          getMeasurementType,
          isValidSubtype,
          getWorkTypeDetails,
        },
        {
          enableCaching: true,
          strictValidation: false,
          timeoutMs: 30000,
        }
      );
    } catch (err) {
      console.warn(
        "Calculator engine initialization error:",
        errorToString(err)
      );
      return null;
    }
  }, [
    categories,
    settings,
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
  ]);

  // Calculate required totals using Calculator Engine
  const calculations = useMemo(() => {
    if (!calculatorEngine) {
      return {
        totals: {
          total: "0.00",
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
          errors: ["Calculator engine not available"],
        },
        payments: {
          totalPaid: "0.00",
          totalDue: "0.00",
          deposit: "0.00",
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: ["Calculator engine not available"],
        },
      };
    }

    try {
      const totals = calculatorEngine.calculateTotals();
      const payments = calculatorEngine.calculatePaymentDetails();

      return { totals, payments };
    } catch (err) {
      const errorMsg = errorToString(err);
      console.error("Calculation error:", errorMsg);
      setCalculationErrors((prev) => [...prev, errorMsg]);
      addError(`Cost summary calculation failed: ${errorMsg}`);

      return {
        totals: {
          total: "0.00",
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
          errors: [errorMsg],
        },
        payments: {
          totalPaid: "0.00",
          totalDue: "0.00",
          deposit: "0.00",
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: [errorMsg],
        },
      };
    }
  }, [calculatorEngine, addError]);

  // Derived values for enhanced display
  const derivedValues = useMemo(() => {
    const total = parseFloat(calculations.totals.total || 0);
    const totalPaid = parseFloat(calculations.payments.totalPaid || 0);
    const totalDue = parseFloat(calculations.payments.totalDue || 0);
    const deposit = parseFloat(calculations.payments.deposit || 0);
    const overdue = parseFloat(calculations.payments.overduePayments || 0);
    const material = parseFloat(calculations.totals.materialCost || 0);
    const labor = parseFloat(calculations.totals.laborCost || 0);
    const laborBeforeDiscount = parseFloat(calculations.totals.laborCostBeforeDiscount || 0);
    const waste = parseFloat(calculations.totals.wasteCost || 0);
    const tax = parseFloat(calculations.totals.taxAmount || 0);
    const markup = parseFloat(calculations.totals.markupAmount || 0);
    const misc = parseFloat(calculations.totals.miscFeesTotal || 0);
    const transportation = parseFloat(calculations.totals.transportationFee || 0);

    // Calculate discount percentage and amount
    const discountAmount = laborBeforeDiscount - labor;
    const discountPercentage = laborBeforeDiscount > 0 
      ? (discountAmount / laborBeforeDiscount) 
      : 0;

    const hasOverpayment = totalPaid > total;
    const overpayment = hasOverpayment ? totalPaid - total : 0;
    const hasDueAmount = totalDue > 0 && !hasOverpayment;

    return {
      total,
      totalPaid,
      totalDue,
      deposit,
      overdue,
      hasOverpayment,
      overpayment,
      hasDueAmount,
      material,
      labor,
      laborBeforeDiscount,
      discountAmount,
      discountPercentage,
      waste,
      wasteEntries: wasteEntriesTotal,
      tax,
      markup,
      misc,
      transportation,
      grandTotal: total,
    };
  }, [calculations, wasteEntriesTotal]);

  // Category stats for header innovation
  const categoryStats = useMemo(() => {
    if (!Array.isArray(categories)) return { total: 0, valid: 0, items: 0 };
    let total = categories.length;
    let valid = categories.filter(
      (cat) => cat && cat.workItems && cat.workItems.length > 0
    ).length;
    let items = categories.reduce(
      (sum, cat) => sum + (cat.workItems?.length || 0),
      0
    );
    return { total, valid, items };
  }, [categories]);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  // Render errors if any
  const renderErrors = () => {
    if (calculationErrors.length === 0) return null;

    return (
      <div className={styles.errorSection}>
        <h4>
          <i className="fas fa-exclamation-triangle" /> Calculation Issues
        </h4>
        <ul>
          {calculationErrors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>
    );
  };

  if (!categories || !Array.isArray(categories)) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <button className={styles.toggleButton} onClick={toggleExpanded}>
            <i
              className={`fas ${
                isExpanded ? "fa-chevron-down" : "fa-chevron-right"
              }`}
            />
          </button>
          <h3 className={styles.sectionTitle}>
            <i className="fas fa-chart-bar" /> Cost Summary
          </h3>
        </div>
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

  const depositPayment = settings.payments?.find((p) => p.method === "Deposit");
  const wasteEntries = settings.wasteEntries || [];

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <button
          className={styles.toggleButton}
          onClick={toggleExpanded}
          title={isExpanded ? "Collapse Summary" : "Expand Summary"}
          aria-expanded={isExpanded}
        >
          <i
            className={`fas ${
              isExpanded ? "fa-chevron-down" : "fa-chevron-right"
            }`}
          />
        </button>
        <h3 className={styles.sectionTitle}>
          <i className="fas fa-chart-bar" /> Cost Summary
        </h3>
        {/* SIMPLIFIED ONE-LINE HEADER: Title + Total + Stats Inline */}
        <div className={styles.headerInline}>
          <span className={styles.headerTotal}>
            ${formatNumber(derivedValues.grandTotal)}
          </span>
          <span className={styles.headerStats}>
            <i className="fas fa-folder" /> {categoryStats.total} cats •
            <i className="fas fa-check-circle" /> {categoryStats.items} items
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.summaryContent}>
          {renderErrors()}

          {/* SIMPLIFIED: Icon-based Metrics Row */}
          <div className={styles.metricsRow}>
            <div className={styles.metricItem}>
              <i className="fas fa-cubes" />
              <span className={styles.metricValue}>
                ${formatNumber(calculations.totals.materialCost)}
              </span>
              <small>Materials</small>
            </div>
            <div className={styles.metricItem}>
              <i className="fas fa-tools" />
              <span className={styles.metricValue}>
                ${formatNumber(calculations.totals.laborCost)}
              </span>
              <small>Labor</small>
            </div>
            <div className={styles.metricItem}>
              <i className="fas fa-chart-line" />
              <span className={styles.metricValue}>
                $
                {formatNumber(
                  derivedValues.wasteEntries +
                    derivedValues.tax +
                    derivedValues.markup +
                    derivedValues.misc +
                    derivedValues.transportation
                )}
              </span>
              <small>Adjustments</small>
            </div>
          </div>

          {/* WIDER: Detailed Summary Table */}
          <div className={styles.summaryGrid}>
            <div className={styles.stickyHeader}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-list" /> Description
              </span>
              <span className={styles.summaryValue}>Amount</span>
            </div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-cubes" /> Materials Cost:
              </span>
              <span className={styles.summaryValue}>
                ${formatNumber(calculations.totals.materialCost)}
              </span>
            </div>

            {/* Labor Cost Details */}
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-tools" /> Labor Cost (Before Discount):
              </span>
              <span className={styles.summaryValue}>
                ${formatNumber(derivedValues.laborBeforeDiscount)}
              </span>
            </div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-percentage" /> Labor Discount ({((derivedValues.discountPercentage || 0) * 100).toFixed(1)}%):
              </span>
              <span className={styles.summaryValue}>
                -${formatNumber(derivedValues.discountAmount)}
              </span>
            </div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-tools" /> Labor Cost (After Discount):
              </span>
              <span className={styles.summaryValue}>
                ${formatNumber(calculations.totals.laborCost)}
              </span>
            </div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-subscript" /> Subtotal:
              </span>
              <span className={styles.summaryValue}>
                ${formatNumber(calculations.totals.subtotal)}
              </span>
            </div>

            {/* Waste Entries Section - NEW */}
            {wasteEntries.length > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-recycle" /> Waste Factor by Surface:
                  <button
                    className={styles.detailToggle}
                    onClick={() => setShowWasteDetails(!showWasteDetails)}
                    title={showWasteDetails ? "Hide Details" : "Show Details"}
                  >
                    {showWasteDetails ? "Hide" : "Show"} Details
                  </button>
                </span>
                <span className={styles.summaryValue}>
                  ${formatNumber(wasteEntriesTotal)}
                </span>
              </div>
            )}

            {/* Waste Details Breakdown */}
            {showWasteDetails && wasteEntries.length > 0 && (
              <div className={styles.wasteDetailsSection}>
                {wasteEntries.map((entry, index) => {
                  const surfaceCost = parseFloat(entry.surfaceCost) || 0;
                  const wasteFactor = parseFloat(entry.wasteFactor) || 0;
                  const wasteCost = surfaceCost * wasteFactor;
                  
                  return (
                    <div key={index} className={styles.wasteDetailRow}>
                      <span className={styles.wasteDetailLabel}>
                        <i className="fas fa-tag" /> {entry.surfaceName}
                        <small>
                          (${formatNumber(surfaceCost)} × {(wasteFactor * 100).toFixed(0)}%)
                        </small>
                      </span>
                      <span className={styles.wasteDetailValue}>
                        ${formatNumber(wasteCost)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {parseFloat(settings.transportationFee || 0) > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-truck" /> Transportation Fee:
                </span>
                <span className={styles.summaryValue}>
                  ${formatNumber(settings.transportationFee)}
                </span>
              </div>
            )}

            {parseFloat(calculations.totals.markupAmount || 0) > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-chart-line" /> Markup (
                  {formatNumber((settings.markup || 0) * 100)}%):
                </span>
                <span className={styles.summaryValue}>
                  ${formatNumber(calculations.totals.markupAmount)}
                </span>
              </div>
            )}

            {parseFloat(calculations.totals.taxAmount || 0) > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-percentage" /> Tax (
                  {formatNumber((settings.taxRate || 0) * 100)}%):
                </span>
                <span className={styles.summaryValue}>
                  ${formatNumber(calculations.totals.taxAmount)}
                </span>
              </div>
            )}

            {settings.miscFees && settings.miscFees.length > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-money-bill-wave" /> Miscellaneous Fees:
                </span>
                <span className={styles.summaryValue}>
                  ${formatNumber(calculations.totals.miscFeesTotal)}
                </span>
              </div>
            )}

            <div className={`${styles.summaryItem} ${styles.total}`}>
              <span
                className={styles.summaryLabel}
                title="Total cost including all fees and taxes"
              >
                <i className="fas fa-receipt" /> Grand Total:
              </span>
              <span className={styles.summaryValue} data-testid="grand-total">
                ${formatNumber(derivedValues.grandTotal)}
              </span>
            </div>

            {/* Payment Information */}
            {depositPayment && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-money-check" /> Deposit Paid:
                </span>
                <span className={`${styles.summaryValue} ${styles.paid}`}>
                  -${formatNumber(derivedValues.deposit)}
                </span>
              </div>
            )}

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-credit-card" /> Total Paid:
              </span>
              <span className={styles.summaryValue}>
                ${formatNumber(derivedValues.totalPaid)}
              </span>
            </div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-file-invoice" /> Payment Status:
              </span>
              <span className={styles.summaryValue}>
                <PaymentProgress
                  paid={calculations.payments.summary.paidPayments}
                  total={calculations.payments.summary.totalPayments}
                  overdue={calculations.payments.summary.overduePayments}
                />
              </span>
            </div>

            <div className={`${styles.summaryItem} ${styles.balance}`}>
              <span
                className={styles.summaryLabel}
                title={
                  derivedValues.hasOverpayment
                    ? "Amount overpaid by customer"
                    : "Remaining amount to be paid"
                }
              >
                {derivedValues.hasOverpayment ? (
                  <>
                    <i className="fas fa-gift" /> Overpaid by:
                  </>
                ) : (
                  <>
                    <i className="fas fa-money-bill" /> Amount Due:
                  </>
                )}
              </span>
              <span
                className={styles.summaryValue}
                data-testid="balance-remaining"
              >
                $
                {formatNumber(
                  derivedValues.hasOverpayment
                    ? derivedValues.overpayment
                    : derivedValues.totalDue
                )}
              </span>
            </div>
          </div>

          {/* Overpayment Notice */}
          {derivedValues.hasOverpayment && (
            <div className={styles.overpaymentNotice}>
              <i className="fas fa-gift" />
              <div>
                <strong>Project Overpaid!</strong>
                <p>
                  Customer has overpaid by $
                  {formatNumber(derivedValues.overpayment)}. Consider issuing a
                  refund or applying credit to future work.
                </p>
              </div>
            </div>
          )}

          {/* Due Amount Notice */}
          {derivedValues.hasDueAmount && !derivedValues.hasOverpayment && (
            <div className={styles.dueAmountNotice}>
              <i className="fas fa-exclamation-circle" />
              <div>
                <strong>Payment Due</strong>
                <p>
                  Outstanding balance of ${formatNumber(derivedValues.totalDue)}{" "}
                  remains. Please follow up with customer for payment.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}