// src/components/Calculator/CostBreakdown/CostBreakdown.jsx
import { useState, useMemo, useEffect } from 'react';
import { useCategories } from '../../../context/CategoriesContext';
import { useSettings } from '../../../context/SettingsContext';
import { useError } from '../../../context/ErrorContext';
import { useWorkType } from '../../../context/WorkTypeContext';
import { CalculatorEngine } from '../engine/CalculatorEngine';
import styles from './CostBreakdown.module.css';

export default function CostBreakdown({ categories: propCategories, settings: propSettings }) {
  // Try to use context first, fall back to props
  let categories, settings, addError;
  
  try {
    const categoryContext = useCategories();
    categories = categoryContext.categories;
  } catch {
    categories = propCategories || [];
  }
  
  try {
    const settingsContext = useSettings();
    settings = settingsContext.settings;
  } catch {
    settings = propSettings || {};
  }
  
  try {
    const errorContext = useError();
    addError = errorContext.addError;
  } catch {
    addError = (error) => console.error('Error:', error);
  }

  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();
  
  const [showMaterialDetails, setShowMaterialDetails] = useState(false);
  const [showLaborDetails, setShowLaborDetails] = useState(false);
  const [showMiscDetails, setShowMiscDetails] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [materialBreakdown, setMaterialBreakdown] = useState([]);
  const [laborBreakdown, setLaborBreakdown] = useState([]);
  const [isProcessingBreakdowns, setIsProcessingBreakdowns] = useState(false);

  // Create Calculator Engine instance - EXACTLY like CostSummary does
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
      console.warn('Calculator engine initialization error:', err);
      return null;
    }
  }, [categories, settings, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // Calculate required totals using Calculator Engine
  const calculations = useMemo(() => {
    console.log('Starting calculations with engine:', !!calculatorEngine);
    console.log('Categories for calculation:', categories);
    
    if (!calculatorEngine) {
      console.warn('No calculator engine available');
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
          transportationFee: '0.00',
          miscFeesTotal: '0.00',
          subtotal: '0.00',
          errors: ['Calculator engine not available'] 
        },
        payments: { 
          totalPaid: '0.00', 
          totalDue: '0.00',
          overduePayments: '0.00',
          deposit: '0.00',
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: ['Calculator engine not available'] 
        },
        categoryBreakdowns: []
      };
    }

    try {
      console.log('Calculating totals...');
      const totals = calculatorEngine.calculateTotals();
      console.log('Totals result:', totals);
      
      console.log('Calculating payments...');
      const payments = calculatorEngine.calculatePaymentDetails();
      console.log('Payments result:', payments);
      
      console.log('Calculating category breakdowns...');
      const categoryBreakdownResult = calculatorEngine.calculateCategoryBreakdowns();
      console.log('Category breakdowns result:', categoryBreakdownResult);
      
      return { 
        totals, 
        payments, 
        categoryBreakdowns: categoryBreakdownResult.breakdowns || []
      };
    } catch (err) {
      console.error('Calculation error:', err);
      const errorMessage = err?.message || String(err) || 'Calculation error';
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
          transportationFee: '0.00',
          miscFeesTotal: '0.00',
          subtotal: '0.00',
          errors: [errorMessage] 
        },
        payments: { 
          totalPaid: '0.00', 
          totalDue: '0.00',
          overduePayments: '0.00',
          deposit: '0.00',
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: [errorMessage] 
        },
        categoryBreakdowns: []
      };
    }
  }, [calculatorEngine]); // <-- CORRECTED DEPENDENCY ARRAY

  // Process detailed breakdowns
  useEffect(() => {
    const processBreakdowns = async () => {
      if (!categories || categories.length === 0 || !calculatorEngine) {
        setMaterialBreakdown([]);
        setLaborBreakdown([]);
        return;
      }

      setIsProcessingBreakdowns(true);

      try {
        const materialItems = [];
        const laborItems = [];

        // Process each category and item directly from context
        categories.forEach((category) => {
          (category.workItems || []).forEach((item) => {
            try {
              const { units } = calculatorEngine.calculateWorkUnits(item);
              const { materialCost, laborCost } = calculatorEngine.calculateWorkCost(item);

              const unitLabel = item.measurementType === 'linear-foot' ? 'linear ft' :
                               item.measurementType === 'by-unit' ? 'units' : 'sqft';

              if (parseFloat(materialCost) > 0) {
                materialItems.push({
                  item: item.name,
                  category: category.name,
                  type: item.type,
                  subtype: item.subtype || '',
                  quantity: units,
                  unitType: unitLabel,
                  costPerUnit: (parseFloat(item.materialCost) || 0).toFixed(4),
                  total: materialCost,
                  units
                });
              }

              if (parseFloat(laborCost) > 0) {
                laborItems.push({
                  item: item.name,
                  category: category.name,
                  type: item.type,
                  subtype: item.subtype || '',
                  quantity: units,
                  unitType: unitLabel,
                  costPerUnit: (parseFloat(item.laborCost) || 0).toFixed(4),
                  total: laborCost,
                  units
                });
              }
            } catch (error) {
              console.error('Error processing item for breakdown:', error);
            }
          });
        });

        setMaterialBreakdown(materialItems);
        setLaborBreakdown(laborItems);
      } catch (error) {
        console.error('Error processing breakdowns:', error);
        setMaterialBreakdown([]);
        setLaborBreakdown([]);
      } finally {
        setIsProcessingBreakdowns(false);
      }
    };

    processBreakdowns();
  }, [categories, calculatorEngine]);

  // Format currency
  const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  // Error handling
  if (!categories || !Array.isArray(categories)) {
    return (
      <div className={styles.error}>
        <h3>Data Loading Issue</h3>
        <p>Categories data is not available or invalid format.</p>
      </div>
    );
  }

  const hasData = categories.some(cat => cat.workItems?.length > 0);

  return (
    <div className={styles.costBreakdown}>
      <h3 className={styles.sectionTitle}>Comprehensive Cost Analysis</h3>

      {/* Debug Information */}
      <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f0f0f0', fontSize: '0.8rem' }}>
        <strong>Debug Info:</strong> Categories: {categories.length}, 
        Total Items: {categories.reduce((sum, cat) => sum + (cat.workItems?.length || 0), 0)}, 
        Has Data: {hasData ? 'Yes' : 'No'},
        Engine Available: {calculatorEngine ? 'Yes' : 'No'}
      </div>

      {!hasData && (
        <div className={styles.noDataMessage}>
          <h4>No Cost Data Available</h4>
          <p>Add some work items to see cost calculations here.</p>
        </div>
      )}

      {/* Error Display */}
      {(calculations.totals.errors?.length > 0 || calculations.payments.errors?.length > 0) && (
        <div className={styles.errorSection} role="alert">
          <h4>Calculation Issues</h4>
          <ul>
            {[...(calculations.totals.errors || []), ...(calculations.payments.errors || [])].map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Category Breakdown Section */}
      {calculations.categoryBreakdowns.length > 0 && (
        <section className={styles.categorySection}>
          <h4 className={styles.subSectionTitle}>Category Breakdown</h4>
          <table className={styles.breakdownTable}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Items</th>
                <th>Material Cost</th>
                <th>Labor Cost</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {calculations.categoryBreakdowns.map((cat, index) => (
                <tr key={index} className={styles.categoryRow}>
                  <td>{cat.name}</td>
                  <td>{cat.itemCount}</td>
                  <td>{formatCurrency(cat.materialCost)}</td>
                  <td>{formatCurrency(cat.laborCost)}</td>
                  <td className={styles.subtotal}>{formatCurrency(cat.subtotal)}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td>Total</td>
                <td>{calculations.categoryBreakdowns.reduce((sum, cat) => sum + cat.itemCount, 0)}</td>
                <td>{formatCurrency(calculations.totals.materialCost)}</td>
                <td>{formatCurrency(calculations.totals.laborCost)}</td>
                <td className={styles.subtotal}>{formatCurrency(calculations.totals.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Detailed Cost Calculation Section */}
      <section className={styles.totalSection}>
        <h4 className={styles.subSectionTitle}>Cost Calculation</h4>
        <table className={styles.breakdownTable}>
          <tbody>
            <tr className={styles.detailRow}>
              <td>
                Base Material Cost
                <button
                  className={styles.toggleButton}
                  onClick={() => setShowMaterialDetails(!showMaterialDetails)}
                >
                  {showMaterialDetails ? 'Hide' : 'Show'} Details
                </button>
              </td>
              <td>
                <span className={styles.totalValue}>{formatCurrency(calculations.totals.materialCost)}</span>
                {showMaterialDetails && (
                  <div className={styles.detailBreakdown}>
                    {isProcessingBreakdowns ? (
                      <p>Loading material details...</p>
                    ) : materialBreakdown.length > 0 ? (
                      <table className={styles.innerTable}>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Unit Cost</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materialBreakdown.map((item, index) => (
                            <tr key={index}>
                              <td>{item.item}</td>
                              <td>{item.category}</td>
                              <td>{item.type}{item.subtype ? ` - ${item.subtype}` : ''}</td>
                              <td>{(item.quantity || 0).toFixed(2)} {item.unitType || 'units'}</td>
                              <td>{formatCurrency(item.costPerUnit || 0)}</td>
                              <td>{formatCurrency(item.total || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No material cost details available.</p>
                    )}
                  </div>
                )}
              </td>
            </tr>
            <tr className={styles.detailRow}>
              <td>
                Base Labor Cost
                <button
                  className={styles.toggleButton}
                  onClick={() => setShowLaborDetails(!showLaborDetails)}
                >
                  {showLaborDetails ? 'Hide' : 'Show'} Details
                </button>
              </td>
              <td>
                <span className={styles.totalValue}>{formatCurrency(calculations.totals.laborCostBeforeDiscount)}</span>
                {showLaborDetails && (
                  <div className={styles.detailBreakdown}>
                    {isProcessingBreakdowns ? (
                      <p>Loading labor details...</p>
                    ) : laborBreakdown.length > 0 ? (
                      <table className={styles.innerTable}>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Unit Cost</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {laborBreakdown.map((item, index) => (
                            <tr key={index}>
                              <td>{item.item}</td>
                              <td>{item.category}</td>
                              <td>{item.type}{item.subtype ? ` - ${item.subtype}` : ''}</td>
                              <td>{(item.quantity || 0).toFixed(2)} {item.unitType || 'units'}</td>
                              <td>{formatCurrency(item.costPerUnit || 0)}</td>
                              <td>{formatCurrency(item.total || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No labor cost details available.</p>
                    )}
                  </div>
                )}
              </td>
            </tr>
            {parseFloat(calculations.totals.laborDiscount) > 0 && (
              <tr className={styles.discountRow}>
                <td>Labor Discount ({((settings?.laborDiscount || 0) * 100).toFixed(1)}%)</td>
                <td>-{formatCurrency(calculations.totals.laborDiscount)}</td>
              </tr>
            )}
            <tr className={styles.subtotalRow}>
              <td>Base Subtotal</td>
              <td>{formatCurrency(calculations.totals.subtotal)}</td>
            </tr>
            <tr>
              <td>Waste Cost ({((settings?.wasteFactor || 0) * 100).toFixed(1)}%)</td>
              <td>{formatCurrency(calculations.totals.wasteCost)}</td>
            </tr>
            <tr>
              <td>Tax ({((settings?.taxRate || 0) * 100).toFixed(1)}%)</td>
              <td>{formatCurrency(calculations.totals.taxAmount)}</td>
            </tr>
            <tr>
              <td>Markup ({((settings?.markup || 0) * 100).toFixed(1)}%)</td>
              <td>{formatCurrency(calculations.totals.markupAmount)}</td>
            </tr>
            <tr>
              <td>Transportation Fee</td>
              <td>{formatCurrency(calculations.totals.transportationFee)}</td>
            </tr>
            {parseFloat(calculations.totals.miscFeesTotal) > 0 && (
              <tr className={styles.detailRow}>
                <td>
                  Miscellaneous Fees
                  <button
                    className={styles.toggleButton}
                    onClick={() => setShowMiscDetails(!showMiscDetails)}
                  >
                    {showMiscDetails ? 'Hide' : 'Show'} Details
                  </button>
                </td>
                <td>
                  <span className={styles.totalValue}>{formatCurrency(calculations.totals.miscFeesTotal)}</span>
                  {showMiscDetails && (
                    <div className={styles.detailBreakdown}>
                      <table className={styles.innerTable}>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(settings?.miscFees || []).map((fee, i) => (
                            <tr key={i}>
                              <td>{fee.name || 'Unnamed Fee'}</td>
                              <td>{formatCurrency(fee.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </td>
              </tr>
            )}
            <tr className={styles.grandTotalRow}>
              <td>Grand Total</td>
              <td>{formatCurrency(calculations.totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Payment Summary Section */}
      <section className={styles.paymentSection}>
        <h4 className={styles.subSectionTitle}>
          Payment Summary
          <button
            className={styles.toggleButton}
            onClick={() => setShowPaymentDetails(!showPaymentDetails)}
          >
            {showPaymentDetails ? 'Hide' : 'Show'} Details
          </button>
        </h4>
        <table className={styles.breakdownTable}>
          <tbody>
            <tr>
              <td>Grand Total</td>
              <td>{formatCurrency(calculations.totals.total)}</td>
            </tr>
            <tr>
              <td>Total Paid</td>
              <td>-{formatCurrency(calculations.payments.totalPaid)}</td>
            </tr>
            <tr className={styles.grandTotalRow}>
              <td>Remaining Balance</td>
              <td className={parseFloat(calculations.payments.totalDue) > 0 ? styles.remaining : styles.paid}>
                {formatCurrency(calculations.payments.totalDue)}
              </td>
            </tr>
            {parseFloat(calculations.payments.overduePayments) > 0 && (
              <tr>
                <td>Overdue Payments</td>
                <td>{formatCurrency(calculations.payments.overduePayments)}</td>
              </tr>
            )}
          </tbody>
        </table>
        {showPaymentDetails && (
          <div className={styles.detailBreakdown}>
            <h5>Payment Details</h5>
            {(!settings?.payments?.length && !settings?.deposit) ? (
              <p>No payments recorded yet.</p>
            ) : (
              <table className={styles.innerTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Note</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settings?.deposit > 0 && (
                    <tr className={styles.depositRow}>
                      <td>{settings.depositDate ? new Date(settings.depositDate).toLocaleDateString() : 'N/A'}</td>
                      <td>{formatCurrency(settings.deposit)}</td>
                      <td>Deposit</td>
                      <td>Initial Deposit</td>
                      <td>Paid</td>
                    </tr>
                  )}
                  {(settings?.payments || []).map((payment, index) => (
                    <tr key={index}>
                      <td>{payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A'}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>{payment.method || 'N/A'}</td>
                      <td>{payment.note || '-'}</td>
                      <td>{payment.isPaid ? 'Paid' : 'Due'}</td>
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