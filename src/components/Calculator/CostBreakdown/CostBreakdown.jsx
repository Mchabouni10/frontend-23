import { useState, useMemo, useEffect, useContext } from "react";
import { CategoriesContext } from "../../../context/CategoriesContext";
import { SettingsContext } from "../../../context/SettingsContext";
import { CalculationContext } from "../../../context/CalculationContext";
import { useError } from "../../../context/ErrorContext";
import { useWorkType } from "../../../context/WorkTypeContext";
import { CalculatorEngine } from "../engine/CalculatorEngine";
import styles from "./CostBreakdown.module.css";

// ─── CostBreakdown ────────────────────────────────────────────────────────────
//
// Two rendering modes, selected automatically:
//
//  1. CONTEXT MODE  – when rendered inside CalculationProvider (e.g. HomePage).
//     Reads pre-computed results directly from CalculationContext.
//     No second CalculatorEngine is created; zero duplicate work.
//
//  2. STANDALONE MODE – when rendered outside CalculationProvider / outside
//     CategoriesProvider+SettingsProvider (e.g. CustomerProjects expanded row).
//     Receives `categories` and `settings` as props and creates its own engine.
//
// Rule-of-hooks: all three context reads are unconditional useContext() calls
// (never inside try/catch).  When a provider is absent the context value is
// null and we fall back to props / defaults.
// ─────────────────────────────────────────────────────────────────────────────

export default function CostBreakdown({
  categories: propCategories,
  settings: propSettings,
}) {
  // ── Unconditional context reads (never wrapped in try/catch) ──────────────
  const calcCtx = useContext(CalculationContext); // null outside provider
  const categoryCtx = useContext(CategoriesContext); // null outside provider
  const settingsCtx = useContext(SettingsContext); // null outside provider

  // useError is always available (ErrorProvider wraps the whole app)
  const { addError } = useError();

  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } =
    useWorkType();

  // ── Resolve categories & settings ────────────────────────────────────────
  // Priority: context → props → empty defaults
  const categories = useMemo(
    () => categoryCtx?.categories ?? propCategories ?? [],
    [categoryCtx?.categories, propCategories],
  );

  const settings = useMemo(
    () => settingsCtx?.settings ?? propSettings ?? {},
    [settingsCtx?.settings, propSettings],
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showMaterialDetails, setShowMaterialDetails] = useState(false);
  const [showLaborDetails, setShowLaborDetails] = useState(false);
  const [showMiscDetails, setShowMiscDetails] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showWasteDetails, setShowWasteDetails] = useState(false);
  const [materialBreakdown, setMaterialBreakdown] = useState([]);
  const [laborBreakdown, setLaborBreakdown] = useState([]);
  const [isProcessingBreakdowns, setIsProcessingBreakdowns] = useState(false);

  // ── Waste entries total (always derived from settings directly) ───────────
  const wasteEntriesTotal = useMemo(() => {
    const wasteEntries = settings.wasteEntries || [];
    return wasteEntries.reduce((total, entry) => {
      const surfaceCost = parseFloat(entry.surfaceCost) || 0;
      const wasteFactor = parseFloat(entry.wasteFactor) || 0;
      return total + surfaceCost * wasteFactor;
    }, 0);
  }, [settings.wasteEntries]);

  // ── Engine (only created in standalone mode) ──────────────────────────────
  // When calcCtx is present we reuse its already-computed results and skip
  // building a second engine entirely.
  const standaloneEngine = useMemo(() => {
    if (calcCtx) return null; // context mode — no engine needed here
    if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails)
      return null;
    try {
      return new CalculatorEngine(
        categories || [],
        settings || {},
        { getMeasurementType, isValidSubtype, getWorkTypeDetails },
        { enableCaching: true, strictValidation: false, timeoutMs: 30000 },
      );
    } catch (err) {
      console.warn("CostBreakdown: standalone engine init error:", err);
      return null;
    }
  }, [
    calcCtx,
    categories,
    settings,
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
  ]);

  // ── Calculations ──────────────────────────────────────────────────────────
  const EMPTY_TOTALS = {
    total: "0.00",
    materialCost: "0.00",
    laborCost: "0.00",
    laborCostBeforeDiscount: "0.00",
    laborDiscount: "0.00",
    wasteCost: "0.00",
    taxAmount: "0.00",
    markupAmount: "0.00",
    transportationFee: "0.00",
    miscFeesTotal: "0.00",
    subtotal: "0.00",
    errors: [],
  };
  const EMPTY_PAYMENTS = {
    totalPaid: "0.00",
    totalDue: "0.00",
    overduePayments: "0.00",
    deposit: "0.00",
    summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
    errors: [],
  };

  const calculations = useMemo(() => {
    // ── MODE 1: context mode — reuse already-computed values ─────────────
    if (calcCtx) {
      return {
        totals: calcCtx.totals,
        payments: calcCtx.paymentDetails,
        categoryBreakdowns: calcCtx.categoryBreakdowns?.breakdowns ?? [],
      };
    }

    // ── MODE 2: standalone mode — run engine from props ──────────────────
    if (!standaloneEngine) {
      const msg = "Calculator engine not available";
      addError(msg);
      return {
        totals: { ...EMPTY_TOTALS, errors: [msg] },
        payments: { ...EMPTY_PAYMENTS, errors: [msg] },
        categoryBreakdowns: [],
      };
    }

    try {
      const totals = standaloneEngine.calculateTotals();
      const payments = standaloneEngine.calculatePaymentDetails(totals.total);
      const categoryBreakdownResult =
        standaloneEngine.calculateCategoryBreakdowns();
      return {
        totals,
        payments,
        categoryBreakdowns: categoryBreakdownResult.breakdowns || [],
      };
    } catch (err) {
      const msg = err?.message || String(err) || "Calculation error";
      addError(msg);
      return {
        totals: { ...EMPTY_TOTALS, errors: [msg] },
        payments: { ...EMPTY_PAYMENTS, errors: [msg] },
        categoryBreakdowns: [],
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcCtx, standaloneEngine, addError]);

  // ── Engine reference used for per-item detail breakdowns ─────────────────
  // In context mode the engine lives inside CalculationContext; we can't
  // access it directly, so we build a lightweight standalone engine just for
  // the detail rows (calculateWorkUnits / calculateWorkCost).  This engine is
  // only created when the detail panel is actually opened (lazy via the effect
  // below), so it doesn't duplicate the main calculation pass.
  const detailEngine = useMemo(() => {
    if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails)
      return null;
    if (!categories?.length) return null;
    try {
      return (
        standaloneEngine ??
        new CalculatorEngine(
          categories,
          settings,
          { getMeasurementType, isValidSubtype, getWorkTypeDetails },
          { enableCaching: true, strictValidation: false, timeoutMs: 30000 },
        )
      );
    } catch {
      return null;
    }
  }, [
    standaloneEngine,
    categories,
    settings,
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
  ]);

  // ── Work-type display helper ──────────────────────────────────────────────
  const getWorkTypeDisplayName = (item) => {
    if (item.type === "custom-work-type") {
      return item.customWorkTypeName || item.name || "Custom Work";
    }
    const typeDisplay = item.type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return item.subtype ? `${typeDisplay} (${item.subtype})` : typeDisplay;
  };

  // ── Per-item breakdown effect ─────────────────────────────────────────────
  useEffect(() => {
    const processBreakdowns = async () => {
      if (!categories || categories.length === 0 || !detailEngine) {
        setMaterialBreakdown([]);
        setLaborBreakdown([]);
        return;
      }

      setIsProcessingBreakdowns(true);

      try {
        const materialItems = [];
        const laborItems = [];
        let itemCounter = 1;

        categories.forEach((category) => {
          (category.workItems || []).forEach((item) => {
            try {
              const { units } = detailEngine.calculateWorkUnits(item);
              const { materialCost, laborCost } =
                detailEngine.calculateWorkCost(item);

              const unitLabel =
                item.measurementType === "linear-foot"
                  ? "LF"
                  : item.measurementType === "by-unit"
                  ? "unit"
                  : "SF";

              const workTypeDisplay = getWorkTypeDisplayName(item);

              if (parseFloat(materialCost) > 0) {
                materialItems.push({
                  itemNumber: itemCounter,
                  category: category.name,
                  workType: workTypeDisplay,
                  quantity: units,
                  unitType: unitLabel,
                  costPerUnit: parseFloat(item.materialCost) || 0,
                  total: materialCost,
                  units,
                });
              }

              if (parseFloat(laborCost) > 0) {
                laborItems.push({
                  itemNumber: itemCounter,
                  category: category.name,
                  workType: workTypeDisplay,
                  description: item.description || "",
                  quantity: units,
                  unitType: unitLabel,
                  costPerUnit: parseFloat(item.laborCost) || 0,
                  total: laborCost,
                  units,
                });
              }

              itemCounter++;
            } catch (error) {
              console.error("Error processing item for breakdown:", error);
              addError(`Error processing item: ${error.message}`);
            }
          });
        });

        setMaterialBreakdown(materialItems);
        setLaborBreakdown(laborItems);
      } catch (error) {
        console.error("Error processing breakdowns:", error);
        addError(`Error processing breakdowns: ${error.message}`);
        setMaterialBreakdown([]);
        setLaborBreakdown([]);
      } finally {
        setIsProcessingBreakdowns(false);
      }
    };

    processBreakdowns();
  }, [categories, detailEngine, addError]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(value) || 0);

  // ── Early exit ────────────────────────────────────────────────────────────
  if (!categories || !Array.isArray(categories)) {
    return (
      <div className={styles.error}>
        <h3>Data Loading Issue</h3>
        <p>Categories data is not available or invalid format.</p>
      </div>
    );
  }

  const hasData = categories.some((cat) => cat.workItems?.length > 0);
  const wasteEntries = settings.wasteEntries || [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.costBreakdown}>
      <h3 className={styles.sectionTitle}>Comprehensive Cost Analysis</h3>

      {!hasData && (
        <div className={styles.noDataMessage}>
          <h4>No Cost Data Available</h4>
          <p>Add some work items to see cost calculations here.</p>
        </div>
      )}

      {(calculations.totals.errors?.length > 0 ||
        calculations.payments.errors?.length > 0) && (
        <div className={styles.errorSection} role="alert">
          <h4>Calculation Issues</h4>
          <ul>
            {[
              ...(calculations.totals.errors || []),
              ...(calculations.payments.errors || []),
            ].map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {calculations.categoryBreakdowns.length > 0 && (
        <section className={styles.categorySection}>
          <h4 className={styles.subSectionTitle}>Category Summary</h4>
          <table className={styles.breakdownTable}>
            <thead>
              <tr>
                <th>Category</th>
                <th className={styles.centerAlign}>Items</th>
                <th className={styles.rightAlign}>Material</th>
                <th className={styles.rightAlign}>Labor</th>
                <th className={styles.rightAlign}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {calculations.categoryBreakdowns.map((cat, index) => (
                <tr key={index} className={styles.categoryRow}>
                  <td>{cat.name}</td>
                  <td className={styles.centerAlign}>{cat.itemCount}</td>
                  <td className={styles.rightAlign}>
                    {formatCurrency(cat.materialCost)}
                  </td>
                  <td className={styles.rightAlign}>
                    {formatCurrency(cat.laborCost)}
                  </td>
                  <td className={`${styles.rightAlign} ${styles.subtotal}`}>
                    {formatCurrency(cat.subtotal)}
                  </td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td>
                  <strong>Total</strong>
                </td>
                <td className={styles.centerAlign}>
                  <strong>
                    {calculations.categoryBreakdowns.reduce(
                      (sum, cat) => sum + cat.itemCount,
                      0,
                    )}
                  </strong>
                </td>
                <td className={styles.rightAlign}>
                  <strong>
                    {formatCurrency(calculations.totals.materialCost)}
                  </strong>
                </td>
                <td className={styles.rightAlign}>
                  <strong>
                    {formatCurrency(calculations.totals.laborCost)}
                  </strong>
                </td>
                <td className={`${styles.rightAlign} ${styles.subtotal}`}>
                  <strong>
                    {formatCurrency(calculations.totals.subtotal)}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <section className={styles.totalSection}>
        <h4 className={styles.subSectionTitle}>Detailed Cost Breakdown</h4>
        <table className={styles.breakdownTable}>
          <tbody>
            {/* ── Material costs ── */}
            <tr className={styles.detailRow}>
              <td>
                <div className={styles.labelWithButton}>
                  <span>Material Costs</span>
                  <button
                    className={styles.toggleButton}
                    onClick={() => setShowMaterialDetails(!showMaterialDetails)}
                  >
                    {showMaterialDetails ? "▼ Hide" : "▶ Show"} Details
                  </button>
                </div>
              </td>
              <td className={styles.rightAlign}>
                <span className={styles.totalValue}>
                  {formatCurrency(calculations.totals.materialCost)}
                </span>
              </td>
            </tr>
            {showMaterialDetails && (
              <tr>
                <td colSpan="2">
                  <div className={styles.detailBreakdown}>
                    {isProcessingBreakdowns ? (
                      <p className={styles.loadingText}>
                        Loading material details...
                      </p>
                    ) : materialBreakdown.length > 0 ? (
                      <table className={styles.innerTable}>
                        <thead>
                          <tr>
                            <th>Item #</th>
                            <th>Category</th>
                            <th>Work Type</th>
                            <th className={styles.rightAlign}>Quantity</th>
                            <th className={styles.rightAlign}>Rate</th>
                            <th className={styles.rightAlign}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materialBreakdown.map((item, index) => (
                            <tr key={index}>
                              <td className={styles.itemNumber}>
                                #{item.itemNumber}
                              </td>
                              <td>{item.category}</td>
                              <td className={styles.workTypeCell}>
                                {item.workType}
                              </td>
                              <td className={styles.rightAlign}>
                                {(item.quantity || 0).toFixed(2)}{" "}
                                {item.unitType}
                              </td>
                              <td className={styles.rightAlign}>
                                {formatCurrency(item.costPerUnit || 0)}/
                                {item.unitType}
                              </td>
                              <td className={styles.rightAlign}>
                                <strong>
                                  {formatCurrency(item.total || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                          <tr className={styles.subtotalRow}>
                            <td colSpan="5" className={styles.rightAlign}>
                              <strong>Total Materials:</strong>
                            </td>
                            <td className={styles.rightAlign}>
                              <strong>
                                {formatCurrency(
                                  calculations.totals.materialCost,
                                )}
                              </strong>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className={styles.emptyText}>
                        No material costs recorded.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* ── Labor costs ── */}
            <tr className={styles.detailRow}>
              <td>
                <div className={styles.labelWithButton}>
                  <span>Labor Costs</span>
                  <button
                    className={styles.toggleButton}
                    onClick={() => setShowLaborDetails(!showLaborDetails)}
                  >
                    {showLaborDetails ? "▼ Hide" : "▶ Show"} Details
                  </button>
                </div>
              </td>
              <td className={styles.rightAlign}>
                <span className={styles.totalValue}>
                  {formatCurrency(calculations.totals.laborCostBeforeDiscount)}
                </span>
              </td>
            </tr>
            {showLaborDetails && (
              <tr>
                <td colSpan="2">
                  <div className={styles.detailBreakdown}>
                    {isProcessingBreakdowns ? (
                      <p className={styles.loadingText}>
                        Loading labor details...
                      </p>
                    ) : laborBreakdown.length > 0 ? (
                      <table className={styles.innerTable}>
                        <thead>
                          <tr>
                            <th>Item #</th>
                            <th>Category</th>
                            <th>Work Type</th>
                            <th>Description</th>
                            <th className={styles.rightAlign}>Quantity</th>
                            <th className={styles.rightAlign}>Rate</th>
                            <th className={styles.rightAlign}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {laborBreakdown.map((item, index) => (
                            <tr key={index}>
                              <td className={styles.itemNumber}>
                                #{item.itemNumber}
                              </td>
                              <td>{item.category}</td>
                              <td className={styles.workTypeCell}>
                                {item.workType}
                              </td>
                              <td className={styles.descriptionCell}>
                                {item.description || (
                                  <span className={styles.emptyText}>—</span>
                                )}
                              </td>
                              <td className={styles.rightAlign}>
                                {(item.quantity || 0).toFixed(2)}{" "}
                                {item.unitType}
                              </td>
                              <td className={styles.rightAlign}>
                                {formatCurrency(item.costPerUnit || 0)}/
                                {item.unitType}
                              </td>
                              <td className={styles.rightAlign}>
                                <strong>
                                  {formatCurrency(item.total || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                          <tr className={styles.subtotalRow}>
                            <td colSpan="6" className={styles.rightAlign}>
                              <strong>Total Labor:</strong>
                            </td>
                            <td className={styles.rightAlign}>
                              <strong>
                                {formatCurrency(
                                  calculations.totals.laborCostBeforeDiscount,
                                )}
                              </strong>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className={styles.emptyText}>
                        No labor costs recorded.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* ── Labor discount ── */}
            {parseFloat(calculations.totals.laborDiscount) > 0 && (
              <tr className={styles.discountRow}>
                <td>
                  Labor Discount (
                  {((settings?.laborDiscount || 0) * 100).toFixed(1)}%)
                </td>
                <td className={styles.rightAlign}>
                  -{formatCurrency(calculations.totals.laborDiscount)}
                </td>
              </tr>
            )}

            {/* ── Base subtotal ── */}
            <tr className={styles.subtotalRow}>
              <td>
                <strong>Base Subtotal</strong>
              </td>
              <td className={styles.rightAlign}>
                <strong>{formatCurrency(calculations.totals.subtotal)}</strong>
              </td>
            </tr>

            {/* ── Waste by surface ── */}
            {wasteEntries.length > 0 && (
              <>
                <tr className={styles.detailRow}>
                  <td>
                    <div className={styles.labelWithButton}>
                      <span>Waste Factor by Surface</span>
                      <button
                        className={styles.toggleButton}
                        onClick={() => setShowWasteDetails(!showWasteDetails)}
                      >
                        {showWasteDetails ? "▼ Hide" : "▶ Show"} Details
                      </button>
                    </div>
                  </td>
                  <td className={styles.rightAlign}>
                    <span className={styles.totalValue}>
                      {formatCurrency(wasteEntriesTotal)}
                    </span>
                  </td>
                </tr>
                {showWasteDetails && (
                  <tr>
                    <td colSpan="2">
                      <div className={styles.detailBreakdown}>
                        <table className={styles.innerTable}>
                          <thead>
                            <tr>
                              <th>Surface Name</th>
                              <th className={styles.rightAlign}>
                                Material Cost
                              </th>
                              <th className={styles.rightAlign}>Waste %</th>
                              <th className={styles.rightAlign}>Waste Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wasteEntries.map((entry, index) => {
                              const surfaceCost =
                                parseFloat(entry.surfaceCost) || 0;
                              const wasteFactor =
                                parseFloat(entry.wasteFactor) || 0;
                              const wasteCost = surfaceCost * wasteFactor;
                              return (
                                <tr key={index}>
                                  <td>
                                    <strong>
                                      {entry.surfaceName ||
                                        `Surface ${index + 1}`}
                                    </strong>
                                  </td>
                                  <td className={styles.rightAlign}>
                                    {formatCurrency(surfaceCost)}
                                  </td>
                                  <td className={styles.rightAlign}>
                                    {(wasteFactor * 100).toFixed(1)}%
                                  </td>
                                  <td className={styles.rightAlign}>
                                    <strong>{formatCurrency(wasteCost)}</strong>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className={styles.subtotalRow}>
                              <td colSpan="3" className={styles.rightAlign}>
                                <strong>Total Waste:</strong>
                              </td>
                              <td className={styles.rightAlign}>
                                <strong>
                                  {formatCurrency(wasteEntriesTotal)}
                                </strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )}

            {/* ── Tax, markup, transportation ── */}
            <tr>
              <td>Tax ({((settings?.taxRate || 0) * 100).toFixed(1)}%)</td>
              <td className={styles.rightAlign}>
                {formatCurrency(calculations.totals.taxAmount)}
              </td>
            </tr>
            <tr>
              <td>Markup ({((settings?.markup || 0) * 100).toFixed(1)}%)</td>
              <td className={styles.rightAlign}>
                {formatCurrency(calculations.totals.markupAmount)}
              </td>
            </tr>
            <tr>
              <td>Transportation Fee</td>
              <td className={styles.rightAlign}>
                {formatCurrency(calculations.totals.transportationFee)}
              </td>
            </tr>

            {/* ── Misc fees ── */}
            {parseFloat(calculations.totals.miscFeesTotal) > 0 && (
              <>
                <tr className={styles.detailRow}>
                  <td>
                    <div className={styles.labelWithButton}>
                      <span>Miscellaneous Fees</span>
                      <button
                        className={styles.toggleButton}
                        onClick={() => setShowMiscDetails(!showMiscDetails)}
                      >
                        {showMiscDetails ? "▼ Hide" : "▶ Show"} Details
                      </button>
                    </div>
                  </td>
                  <td className={styles.rightAlign}>
                    <span className={styles.totalValue}>
                      {formatCurrency(calculations.totals.miscFeesTotal)}
                    </span>
                  </td>
                </tr>
                {showMiscDetails && (
                  <tr>
                    <td colSpan="2">
                      <div className={styles.detailBreakdown}>
                        <table className={styles.innerTable}>
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th className={styles.rightAlign}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(settings?.miscFees || []).map((fee, i) => (
                              <tr key={i}>
                                <td>
                                  <strong>{fee.name || "Unnamed Fee"}</strong>
                                </td>
                                <td className={styles.rightAlign}>
                                  {formatCurrency(fee.amount)}
                                </td>
                              </tr>
                            ))}
                            <tr className={styles.subtotalRow}>
                              <td className={styles.rightAlign}>
                                <strong>Total Misc Fees:</strong>
                              </td>
                              <td className={styles.rightAlign}>
                                <strong>
                                  {formatCurrency(
                                    calculations.totals.miscFeesTotal,
                                  )}
                                </strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )}

            {/* ── Grand total ── */}
            <tr className={styles.grandTotalRow}>
              <td>
                <strong>Grand Total</strong>
              </td>
              <td className={styles.rightAlign}>
                <strong>{formatCurrency(calculations.totals.total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Payment summary ── */}
      <section className={styles.paymentSection}>
        <h4 className={styles.subSectionTitle}>
          <span>Payment Summary</span>
          <button
            className={styles.toggleButton}
            onClick={() => setShowPaymentDetails(!showPaymentDetails)}
          >
            {showPaymentDetails ? "▼ Hide" : "▶ Show"} Details
          </button>
        </h4>
        <table className={styles.breakdownTable}>
          <tbody>
            <tr>
              <td>Project Total</td>
              <td className={styles.rightAlign}>
                {formatCurrency(calculations.totals.total)}
              </td>
            </tr>
            <tr className={styles.paidRow}>
              <td>Total Paid</td>
              <td className={styles.rightAlign}>
                -{formatCurrency(calculations.payments.totalPaid)}
              </td>
            </tr>
            {parseFloat(calculations.payments.overduePayments) > 0 && (
              <tr className={styles.overdueRow}>
                <td>⚠ Overdue Payments</td>
                <td className={styles.rightAlign}>
                  {formatCurrency(calculations.payments.overduePayments)}
                </td>
              </tr>
            )}
            <tr className={styles.remainingBalanceRow}>
              <td>
                <strong>Remaining Balance</strong>
              </td>
              <td className={styles.rightAlign}>
                <strong>
                  {formatCurrency(calculations.payments.totalDue)}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>

        {showPaymentDetails && (
          <div className={styles.detailBreakdown}>
            <h5 className={styles.paymentDetailsTitle}>Payment History</h5>
            {!settings?.payments?.length && !settings?.deposit ? (
              <p className={styles.emptyText}>No payments recorded yet.</p>
            ) : (
              <table className={styles.innerTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th className={styles.rightAlign}>Amount</th>
                    <th>Method</th>
                    <th>Note</th>
                    <th className={styles.centerAlign}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settings?.deposit > 0 && (
                    <tr className={styles.depositRow}>
                      <td>
                        {settings.depositDate
                          ? new Date(settings.depositDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <i
                          className="fas fa-hand-holding-usd"
                          style={{
                            marginRight: "6px",
                            color: "var(--primary)",
                          }}
                        />
                        <strong>Deposit</strong>
                      </td>
                      <td className={styles.rightAlign}>
                        <strong>{formatCurrency(settings.deposit)}</strong>
                      </td>
                      <td>—</td>
                      <td>Initial Project Deposit</td>
                      <td className={styles.centerAlign}>
                        <span className={styles.paidBadge}>✓ Paid</span>
                      </td>
                    </tr>
                  )}
                  {(settings?.payments || []).map((payment, index) => (
                    <tr key={index}>
                      <td>
                        {payment.date
                          ? new Date(payment.date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>Payment</td>
                      <td className={styles.rightAlign}>
                        <strong>{formatCurrency(payment.amount)}</strong>
                      </td>
                      <td>{payment.method || "—"}</td>
                      <td>{payment.note || "—"}</td>
                      <td className={styles.centerAlign}>
                        {payment.isPaid ? (
                          <span className={styles.paidBadge}>✓ Paid</span>
                        ) : (
                          <span className={styles.dueBadge}>⏳ Due</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
