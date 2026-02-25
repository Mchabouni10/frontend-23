// src/components/Calculator/Calculator.jsx
import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { CalculationProvider } from "../../context/CalculationContext";
import { useCalculation } from "../../context/CalculationContext";
import { useCategories } from "../../context/CategoriesContext";
import CategoryList from "./Category/CategoryList";
import LaborPricingSheet from "./LaborPricingSheet/LaborPricingSheet";
import CostSummary from "./Category/CostSummary";
import PaymentTracking from "./Category/PaymentTracking";
import AdditionalCosts from "./Category/AdditionalCosts";
import CompanyLogo from "../../assets/CompanyLogo.png";
import styles from "./Calculator.module.css";

// ─── Inner component — can safely use useCalculation() because it's
//     rendered inside <CalculationProvider> below ────────────────────────────

function CalculatorInner({ disabled }) {
  const [activeView, setActiveView] = useState("calculator");
  const { categories } = useCategories();
  const { totals, paymentDetails, categoryBreakdowns, isReady, hasErrors } =
    useCalculation();

  // Collect all engine errors for the error display banner
  const allErrors = useMemo(() => {
    return [
      ...(totals.errors || []),
      ...(paymentDetails.errors || []),
      ...(categoryBreakdowns.errors || []),
    ];
  }, [totals.errors, paymentDetails.errors, categoryBreakdowns.errors]);

  const engineStatus = isReady
    ? hasErrors
      ? "Engine has errors"
      : "Engine ready"
    : "Engine not available";

  const engineStatusColor = !isReady
    ? "#ef4444"
    : hasErrors
    ? "#f59e0b"
    : "#10b981";

  return (
    <div className={styles.calculator}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.brandSection}>
            <div className={styles.logoWrapper}>
              <img
                src={CompanyLogo}
                alt="Company Logo"
                className={styles.logo}
              />
            </div>
            <div className={styles.brandInfo}>
              <h1 className={styles.brandTitle}>
                Professional Remodeling Calculator
              </h1>
              <p className={styles.brandTagline}>
                Complete Project Estimation & Management
              </p>
            </div>
          </div>

          <div className={styles.statusIndicator}>
            <div
              className={styles.statusBadge}
              style={{ "--status-color": engineStatusColor }}
              title={`Categories: ${
                categories?.length || 0
              }, Engine: ${engineStatus}`}
            >
              <span className={styles.statusDot}></span>
              <span className={styles.statusText}>
                System {isReady ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <nav className={styles.headerNav}>
          <div className={styles.navContainer}>
            <button
              className={`${styles.navButton} ${
                activeView === "calculator" ? styles.navButtonActive : ""
              }`}
              onClick={() => setActiveView("calculator")}
              disabled={disabled}
            >
              <div className={styles.navIconWrapper}>
                <i className="fas fa-calculator"></i>
              </div>
              <div className={styles.navContent}>
                <span className={styles.navLabel}>Calculator</span>
                <span className={styles.navDescription}>
                  Project estimation
                </span>
              </div>
            </button>

            <button
              className={`${styles.navButton} ${
                activeView === "pricing" ? styles.navButtonActive : ""
              }`}
              onClick={() => setActiveView("pricing")}
              disabled={disabled}
            >
              <div className={styles.navIconWrapper}>
                <i className="fas fa-dollar-sign"></i>
              </div>
              <div className={styles.navContent}>
                <span className={styles.navLabel}>Labor Pricing Guide</span>
                <span className={styles.navDescription}>Rate schedules</span>
              </div>
            </button>
          </div>
        </nav>
      </header>

      {/* Error banner — only shown when engine produces errors */}
      {allErrors.length > 0 && (
        <div className={styles.errorSummary} role="alert">
          <div className={styles.errorHeader}>
            <i className="fas fa-exclamation-triangle"></i>
            <h4>Calculation Issues ({allErrors.length})</h4>
          </div>
          <details className={styles.errorDetails}>
            <summary>View Details</summary>
            <ul className={styles.errorList}>
              {allErrors.slice(0, 5).map((error, index) => (
                <li key={index}>
                  {typeof error === "string"
                    ? error
                    : error.message || "Unknown error"}
                </li>
              ))}
              {allErrors.length > 5 && (
                <li>...and {allErrors.length - 5} more</li>
              )}
            </ul>
          </details>
        </div>
      )}

      {/* Main content */}
      <main className={styles.mainContent}>
        {activeView === "pricing" && (
          <div className={styles.contentPanel}>
            <LaborPricingSheet />
          </div>
        )}

        {activeView === "calculator" && (
          <div className={styles.contentPanel}>
            <CategoryList disabled={disabled} />
            <AdditionalCosts disabled={disabled} />
            <CostSummary />
            <PaymentTracking disabled={disabled} />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Public export — wraps CalculatorInner in CalculationProvider ─────────────
//     CalculationProvider must be a child of CategoriesProvider, SettingsProvider,
//     and WorkTypeProvider (all of which are set up higher in the tree by HomePage).

export default function Calculator({ disabled = false }) {
  return (
    <CalculationProvider>
      <CalculatorInner disabled={disabled} />
    </CalculationProvider>
  );
}

Calculator.propTypes = {
  disabled: PropTypes.bool,
};
