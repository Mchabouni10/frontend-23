// src/components/Calculator/Category/CostSummary.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useCategories } from '../../../context/CategoriesContext';
import { useSettings } from '../../../context/SettingsContext';
import { useWorkType } from '../../../context/WorkTypeContext';
import { useError } from '../../../context/ErrorContext';
import { CalculatorEngine } from '../engine/CalculatorEngine';
import styles from './CostSummary.module.css';

// Helper function to safely convert error to string
const errorToString = (error) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    return error.message || error.toString() || 'Unknown error';
  }
  return String(error || 'Unknown error');
};

// Helper to format currency
const formatCurrency = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

// Helper to format percentage
const formatPercentage = (value) => {
  const num = parseFloat(value) || 0;
  return (num * 100).toFixed(1);
};

// Helper to format number with commas
const formatNumber = (value) => {
  const num = parseFloat(value) || 0;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CostSummary() {
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();
  const { addError } = useError();

  const [isExpanded, setIsExpanded] = useState(true);
  const [calculationErrors, setCalculationErrors] = useState([]);

  // Create Calculator Engine instance
  const calculatorEngine = useMemo(() => {
    try {
      if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
        return null;
      }
      
      return new CalculatorEngine(categories || [], settings || {}, {
        getMeasurementType,
        isValidSubtype,
        getWorkTypeDetails,
      }, {
        enableCaching: true,
        strictValidation: false,
        timeoutMs: 30000,
      });
    } catch (err) {
      console.warn('Calculator engine initialization error:', errorToString(err));
      return null;
    }
  }, [categories, settings, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // Calculate required totals using Calculator Engine
  const calculations = useMemo(() => {
    if (!calculatorEngine) {
      return {
        totals: { 
          total: '0.00', 
          materialCost: '0.00',
          laborCost: '0.00',
          laborCostBeforeDiscount: '0.00',
          laborDiscount: '0.00',
          wasteCost: '0.00',
          taxAmount: '0.00',
          markupAmount: '0.00',
          miscFeesTotal: '0.00',
          transportationFee: '0.00',
          subtotal: '0.00',
          errors: ['Calculator engine not available'] 
        },
        payments: { 
          totalPaid: '0.00', 
          totalDue: '0.00',
          deposit: '0.00',
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: ['Calculator engine not available'] 
        }
      };
    }

    try {
      const totals = calculatorEngine.calculateTotals();
      const payments = calculatorEngine.calculatePaymentDetails();
      return { totals, payments };
    } catch (err) {
      const errorMessage = errorToString(err);
      return {
        totals: { 
          total: '0.00', 
          materialCost: '0.00',
          laborCost: '0.00',
          laborCostBeforeDiscount: '0.00',
          laborDiscount: '0.00',
          wasteCost: '0.00',
          taxAmount: '0.00',
          markupAmount: '0.00',
          miscFeesTotal: '0.00',
          transportationFee: '0.00',
          subtotal: '0.00',
          errors: [errorMessage] 
        },
        payments: { 
          totalPaid: '0.00', 
          totalDue: '0.00',
          deposit: '0.00',
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: [errorMessage] 
        }
      };
    }
  }, [calculatorEngine]);

  // Handle errors
  useEffect(() => {
    const allErrors = [
      ...(calculations.totals.errors || []), 
      ...(calculations.payments.errors || [])
    ];
    
    if (allErrors.length > 0) {
      const safeErrors = allErrors.map(errorToString).filter(Boolean);
      const seriousErrors = safeErrors.filter(error => 
        !error.toLowerCase().includes('no valid') && 
        !error.toLowerCase().includes('missing') &&
        !error.toLowerCase().includes('calculator engine not available')
      );
      
      seriousErrors.forEach(errorMsg => addError(errorMsg));
      setCalculationErrors(safeErrors);
    } else {
      setCalculationErrors([]);
    }
  }, [calculations, addError]);

  // Calculate derived values
  const derivedValues = useMemo(() => {
    const totals = calculations.totals;
    const payments = calculations.payments;
    
    const grandTotal = parseFloat(totals.total) || 0;
    const totalPaid = parseFloat(payments.totalPaid) || 0;
    const totalDue = parseFloat(payments.totalDue) || 0;
    const deposit = parseFloat(payments.deposit) || 0;
    const overpayment = totalPaid > grandTotal ? totalPaid - grandTotal : 0;
    
    return {
      grandTotal: grandTotal.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalDue: totalDue.toFixed(2),
      deposit: deposit.toFixed(2),
      overpayment: overpayment.toFixed(2),
      hasOverpayment: overpayment > 0,
      hasDueAmount: totalDue > 0
    };
  }, [calculations]);

  // Find deposit payment for additional info
  const depositPayment = useMemo(() => {
    return settings.payments?.find(p => p.method === 'Deposit') || null;
  }, [settings.payments]);

  // Debug information
  const debugInfo = useMemo(() => {
    const totalItems = categories.reduce((sum, cat) => sum + (cat.workItems?.length || 0), 0);
    return {
      totalCategories: categories.length,
      totalItems,
      hasData: totalItems > 0,
      engineStatus: calculatorEngine ? 'Ready' : 'Not Available'
    };
  }, [categories, calculatorEngine]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalCategories = categories.length;
    const totalItems = categories.reduce((sum, cat) => sum + (cat.workItems?.length || 0), 0);
    const totalSurfaces = categories.reduce((sum, cat) => 
      sum + (cat.workItems?.reduce((itemSum, item) => 
        itemSum + (item.surfaces?.length || 0), 0) || 0), 0
    );
    
    return {
      totalCategories,
      totalItems,
      totalSurfaces
    };
  }, [categories]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <button 
          className={styles.toggleButton} 
          onClick={() => setIsExpanded(prev => !prev)} 
          aria-expanded={isExpanded}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
        </button>
        <h3 className={styles.sectionTitle}>
          <i className="fas fa-file-invoice-dollar" /> Cost Summary
        </h3>
        {debugInfo.hasData && (
          <div className={styles.headerStats}>
            <span className={styles.statItem}>
              <i className="fas fa-layer-group" /> {summaryStats.totalCategories}
            </span>
            <span className={styles.statItem}>
              <i className="fas fa-tasks" /> {summaryStats.totalItems}
            </span>
            <span className={styles.statItem}>
              <i className="fas fa-vector-square" /> {summaryStats.totalSurfaces}
            </span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={styles.summaryContent}>
          {/* Debug Information */}
          {!debugInfo.hasData && (
            <div className={styles.emptyState} role="status">
              <div className={styles.helpMessage}>
                <i className="fas fa-clipboard-list fa-2x" />
                <div>
                  <h4>Getting Started</h4>
                  <p>Add work items to your categories to see detailed cost calculations here.</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {calculationErrors.length > 0 && (
            <div className={styles.errorSection} role="alert" aria-live="assertive">
              <h4>
                <i className="fas fa-exclamation-triangle" /> Calculation Issues
              </h4>
              <ul>
                {calculationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Main Summary Grid */}
          {debugInfo.hasData && (
            <>
              <div className={styles.summaryGrid} role="grid" aria-label="Cost Summary Details">
                <div className={styles.stickyHeader}>
                  <span className={styles.summaryLabel}>Cost Breakdown</span>
                  <span className={styles.summaryValue}>Amount</span>
                </div>
                {/* Project Costs */}
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>
                    <i className="fas fa-box" /> Material Cost:
                  </span>
                  <span className={styles.summaryValue}>
                    ${formatNumber(calculations.totals.materialCost)}
                  </span>
                </div>

                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>
                    <i className="fas fa-hammer" /> Labor Cost (before discount):
                  </span>
                  <span className={styles.summaryValue}>
                    ${formatNumber(calculations.totals.laborCostBeforeDiscount)}
                  </span>
                </div>

                {parseFloat(calculations.totals.laborDiscount || 0) > 0 && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>
                      <i className="fas fa-percentage" /> Labor Discount ({formatPercentage(settings.laborDiscount || 0)}%):
                    </span>
                    <span className={`${styles.summaryValue} ${styles.discount}`}>
                      -${formatNumber(calculations.totals.laborDiscount)}
                    </span>
                  </div>
                )}

                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>
                    <i className="fas fa-hammer" /> Labor Cost (after discount):
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

                {parseFloat(calculations.totals.wasteCost || 0) > 0 && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>
                      <i className="fas fa-recycle" /> Waste Factor ({formatPercentage(settings.wasteFactor || 0)}%):
                    </span>
                    <span className={styles.summaryValue}>
                      ${formatNumber(calculations.totals.wasteCost)}
                    </span>
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
                      <i className="fas fa-chart-line" /> Markup ({formatPercentage(settings.markup || 0)}%):
                    </span>
                    <span className={styles.summaryValue}>
                      ${formatNumber(calculations.totals.markupAmount)}
                    </span>
                  </div>
                )}

                {parseFloat(calculations.totals.taxAmount || 0) > 0 && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>
                      <i className="fas fa-percentage" /> Tax ({formatPercentage(settings.taxRate || 0)}%):
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
                  <span className={styles.summaryLabel} title="Total cost including all fees and taxes">
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
                    <i className="fas fa-file-invoice" /> Payment Entries:
                  </span>
                  <span className={styles.summaryValue}>
                    {calculations.payments.summary.paidPayments}/{calculations.payments.summary.totalPayments} paid
                    {calculations.payments.summary.overduePayments > 0 && 
                      ` (${calculations.payments.summary.overduePayments} overdue)`
                    }
                  </span>
                </div>

                <div className={`${styles.summaryItem} ${styles.balance}`}>
                  <span className={styles.summaryLabel} title={derivedValues.hasOverpayment ? 'Amount overpaid by customer' : 'Remaining amount to be paid'}>
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
                  <span className={styles.summaryValue} data-testid="balance-remaining">
                    ${formatNumber(derivedValues.hasOverpayment ? derivedValues.overpayment : derivedValues.totalDue)}
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
                      Customer has overpaid by ${formatNumber(derivedValues.overpayment)}. 
                      Consider issuing a refund or applying credit to future work.
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
                      Outstanding balance of ${formatNumber(derivedValues.totalDue)} remains.
                      Please follow up with customer for payment.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}