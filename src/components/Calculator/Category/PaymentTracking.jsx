// src/components/Calculator/PaymentTracking/PaymentTracking.jsx
import { useState, useMemo, useEffect } from 'react';
import { useCategories } from '../../../context/CategoriesContext';
import { useSettings } from '../../../context/SettingsContext';
import { useWorkType } from '../../../context/WorkTypeContext';
import { useError } from '../../../context/ErrorContext';
import { CalculatorEngine } from '../engine/CalculatorEngine';
import styles from './PaymentTracking.module.css';

const errorToString = (error) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    return error.message || error.toString() || 'Unknown error';
  }
  return String(error || 'Unknown error');
};

export default function PaymentTracking({ disabled = false }) {
  const { categories } = useCategories();
  const { settings, setSettings } = useSettings();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();
  const { addError } = useError();
  
  const [newPayment, setNewPayment] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'Cash',
    note: '',
    isPaid: true,
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedPayment, setEditedPayment] = useState(null);
  const [expandedPayments, setExpandedPayments] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);

  const safeSettings = useMemo(() => ({
    payments: [],
    ...settings,
  }), [settings]);

  const categoriesKey = useMemo(() => JSON.stringify(categories), [categories]);
  const settingsKey = useMemo(() => JSON.stringify(settings), [settings]);

  const calculatorEngine = useMemo(() => {
    if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
      return null;
    }
    return new CalculatorEngine(categories, settings, {
      getMeasurementType,
      isValidSubtype,
      getWorkTypeDetails,
    }, {
      enableCaching: true,
      strictValidation: false,
      timeoutMs: 30000,
    });
  }, [categoriesKey, settingsKey, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  const calculations = useMemo(() => {
    if (!calculatorEngine) {
      return {
        totals: {
          total: '0.00',
          errors: ['Calculator engine not available.'],
        },
        payments: {
          totalPaid: '0.00',
          totalDue: '0.00',
          overduePayments: '0.00',
          deposit: '0.00',
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: ['Calculator engine not available.'],
        }
      };
    }

    try {
      const totals = calculatorEngine.calculateTotals();
      const payments = calculatorEngine.calculatePaymentDetails();
      
      return { totals, payments };
    } catch (err) {
      console.error('Calculation error:', err);
      const errorMessage = errorToString(err);
      return {
        totals: {
          total: '0.00',
          errors: [`Cost calculation failed: ${errorMessage}`],
        },
        payments: {
          totalPaid: '0.00',
          totalDue: '0.00',
          overduePayments: '0.00',
          deposit: '0.00',
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: [`Payment calculation failed: ${errorMessage}`],
        }
      };
    }
  }, [calculatorEngine]);

  useEffect(() => {
    const allErrors = [...(calculations.totals.errors || []), ...(calculations.payments.errors || [])];
    
    if (allErrors.length > 0) {
      const seriousErrors = allErrors.filter(error => {
        const lowerError = errorToString(error).toLowerCase();
        return !lowerError.includes('not available') && 
               !lowerError.includes('no valid') &&
               lowerError.includes('failed');
      });
      
      seriousErrors.forEach(error => {
        const safeError = errorToString(error);
        addError(safeError);
      });
    }
  }, [calculations.totals.errors, calculations.payments.errors, addError]);

  // FIX: Calculate amounts properly separating deposit from other payments
  const paymentBreakdown = useMemo(() => {
    const grandTotal = parseFloat(calculations.totals.total) || 0;
    const totalPaid = parseFloat(calculations.payments.totalPaid) || 0;
    const depositAmount = parseFloat(calculations.payments.deposit) || 0;
    const otherPayments = totalPaid - depositAmount; // Non-deposit payments
    const totalDue = parseFloat(calculations.payments.totalDue) || 0;
    const overpayment = totalPaid > grandTotal ? (totalPaid - grandTotal) : 0;

    return {
      grandTotal,
      depositAmount,
      otherPayments,
      totalPaid,
      totalDue,
      overpayment,
      balanceAfterDeposit: grandTotal - depositAmount, // What remains after deposit
    };
  }, [calculations.totals.total, calculations.payments.totalPaid, calculations.payments.deposit, calculations.payments.totalDue]);

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const depositPayment = useMemo(() => {
    return safeSettings.payments?.find(p => p.method === 'Deposit') || null;
  }, [safeSettings.payments]);

  const paidPayments = useMemo(() => {
    return safeSettings.payments?.filter(p => p.method !== 'Deposit' && p.isPaid) || [];
  }, [safeSettings.payments]);

  const totalPaymentsCount = useMemo(() => {
    return safeSettings.payments?.filter(p => p.method !== 'Deposit').length || 0;
  }, [safeSettings.payments]);

  const validatePayment = (payment) => {
    if (!payment.date || isNaN(Date.parse(payment.date))) {
      return 'Please select a valid date.';
    }
    const amount = parseFloat(payment.amount);
    if (isNaN(amount) || amount <= 0) {
      return 'Payment amount must be greater than zero.';
    }
    if (amount > 100000) {
      return 'Payment amount cannot exceed $100,000.';
    }
    return null;
  };

  const updateDepositPayment = (amount, date) => {
    setSettings(prev => {
      const payments = [...(prev.payments || [])];
      const depositIndex = payments.findIndex(p => p.method === 'Deposit');

      const depositAmountValue = parseFloat(amount);
      if (isNaN(depositAmountValue) || depositAmountValue < 0) {
        addError('Deposit amount must be valid and non-negative.');
        return prev;
      }
      if (depositAmountValue > 100000) {
        addError('Deposit cannot exceed $100,000.');
        return prev;
      }

      const depositDate = date ? new Date(date) : new Date();
      if (isNaN(depositDate.getTime())) {
        addError('Invalid deposit date.');
        return prev;
      }
      
      const depositDateISO = depositDate.toISOString();

      if (depositAmountValue === 0) {
        if (depositIndex !== -1) {
          payments.splice(depositIndex, 1);
        }
      } else {
        const depositPayment = {
          date: depositDateISO,
          amount: depositAmountValue,
          method: 'Deposit',
          note: 'Initial Deposit',
          isPaid: true,
        };
        
        if (depositIndex === -1) {
          payments.push(depositPayment);
        } else {
          payments[depositIndex] = depositPayment;
        }
      }

      return { ...prev, payments };
    });
  };

  const handleDepositAmountChange = (value) => {
    const currentDeposit = safeSettings.payments?.find(p => p.method === 'Deposit');
    const depositDate = currentDeposit?.date || new Date().toISOString();
    updateDepositPayment(value, depositDate);
  };

  const handleDepositDateChange = (value) => {
    const currentDeposit = safeSettings.payments?.find(p => p.method === 'Deposit');
    const depositAmount = currentDeposit?.amount || 0;
    updateDepositPayment(depositAmount, value);
  };

  const handleNewPaymentChange = (field, value) => {
    setNewPayment((prev) => ({ ...prev, [field]: value }));
  };

  const addPayment = () => {
    if (disabled) return;

    if (newPayment.method === 'Deposit') {
      addError('Cannot create payments with "Deposit" method. Please use the Deposit section to record deposit payments.');
      return;
    }

    const validationError = validatePayment(newPayment);
    if (validationError) {
      addError(validationError);
      return;
    }

    try {
      const payment = {
        date: new Date(newPayment.date).toISOString(),
        amount: parseFloat(newPayment.amount),
        method: newPayment.method || 'Cash',
        note: newPayment.note.trim() || '',
        isPaid: newPayment.isPaid,
      };
      
      setSettings((prev) => ({
        ...prev,
        payments: [...(prev.payments || []), payment],
      }));
      
      setNewPayment({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        method: 'Cash',
        note: '',
        isPaid: true,
      });
      
      setShowAddPayment(false);
    } catch (err) {
      addError('Failed to add payment. Please try again.');
    }
  };

  const togglePaymentStatus = (index) => {
    if (disabled) return;
    
    const payment = safeSettings.payments[index];
    if (payment.method === 'Deposit') {
      addError('Cannot change deposit payment status. Deposits are always marked as paid.');
      return;
    }
    
    try {
      setSettings((prev) => ({
        ...prev,
        payments: prev.payments.map((payment, i) =>
          i === index ? { ...payment, isPaid: !payment.isPaid } : payment,
        ),
      }));
    } catch (err) {
      addError('Failed to update payment status. Please try again.');
    }
  };

  const removePayment = (index) => {
    if (disabled) return;
    
    const payment = safeSettings.payments[index];
    if (payment.method === 'Deposit') {
      addError('Cannot remove deposit payment here. Set deposit amount to $0 in the Deposit section to remove it.');
      return;
    }
    
    try {
      setSettings((prev) => ({
        ...prev,
        payments: prev.payments.filter((_, i) => i !== index),
      }));
    } catch (err) {
      addError('Failed to remove payment. Please try again.');
    }
  };

  const startEditing = (index) => {
    if (disabled) return;
    
    const payment = safeSettings.payments[index];
    
    if (payment.method === 'Deposit') {
      addError('Deposit payments cannot be edited here. Please use the Deposit section above.');
      return;
    }
    
    setEditingIndex(index);
    setEditedPayment({
      ...payment,
      date: new Date(payment.date).toISOString().split('T')[0],
      amount: payment.amount.toString(),
    });
  };

  const handleEditChange = (field, value) => {
    setEditedPayment((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveEdit = (index) => {
    if (disabled) return;

    if (editedPayment.method === 'Deposit') {
      addError('Cannot change payment method to "Deposit". Please use the Deposit section for deposit payments.');
      return;
    }
    
    const originalPayment = safeSettings.payments[index];
    if (originalPayment.method === 'Deposit') {
      addError('Cannot edit deposit payment. Please use the Deposit section above.');
      cancelEdit();
      return;
    }

    const validationError = validatePayment(editedPayment);
    if (validationError) {
      addError(validationError);
      return;
    }

    try {
      setSettings((prev) => ({
        ...prev,
        payments: prev.payments.map((payment, i) =>
          i === index
            ? {
                ...editedPayment,
                date: new Date(editedPayment.date).toISOString(),
                amount: parseFloat(editedPayment.amount),
                method: editedPayment.method || 'Cash',
                note: editedPayment.note?.trim() || '',
              }
            : payment,
        ),
      }));
      
      setEditingIndex(null);
      setEditedPayment(null);
    } catch (err) {
      addError('Failed to save payment. Please try again.');
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditedPayment(null);
  };

  const addQuickPayment = () => {
    if (disabled) return;
    
    const remaining = paymentBreakdown.totalDue;
    if (remaining <= 0) {
      addError('No remaining balance to pay.');
      return;
    }

    setNewPayment(prev => ({
      ...prev,
      amount: remaining.toString(),
      note: `Final payment - cleared balance of $${formatCurrency(remaining)}`,
      isPaid: true,
    }));
    
    setShowAddPayment(true);
  };

  const toggleAddPayment = () => {
    if (showAddPayment) {
      setNewPayment({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        method: 'Cash',
        note: '',
        isPaid: true,
      });
    }
    setShowAddPayment(!showAddPayment);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <button
          className={styles.toggleButton}
          onClick={() => setExpandedPayments(!expandedPayments)}
          title={expandedPayments ? 'Collapse' : 'Expand'}
          aria-expanded={expandedPayments}
        >
          <i className={`fas ${expandedPayments ? 'fa-chevron-down' : 'fa-chevron-right'}`} aria-hidden="true" />
        </button>
        <h3 className={styles.sectionTitle}>
          <i className="fas fa-wallet" aria-hidden="true" /> Payment Tracking
        </h3>
        <div className={styles.totalPaid}>
          <span className={styles.paidLabel}>Paid: ${formatCurrency(paymentBreakdown.totalPaid)}</span>
        </div>
      </div>

      {expandedPayments && (
        <div className={styles.content}>
          {/* FIX: Clearer payment breakdown showing the flow of money */}
          <div className={styles.summary}>
            <div className={`${styles.summaryRow} ${styles.grandTotal}`}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-receipt" aria-hidden="true" /> Project Total
              </span>
              <span className={styles.summaryValue}>
                ${formatCurrency(paymentBreakdown.grandTotal)}
              </span>
            </div>

            {/* Show deposit if exists */}
            {paymentBreakdown.depositAmount > 0 && (
              <>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>
                    <i className="fas fa-hand-holding-usd" aria-hidden="true" /> Deposit Paid
                  </span>
                  <span className={styles.summaryValue}>
                    ${formatCurrency(paymentBreakdown.depositAmount)}
                  </span>
                </div>
                <div className={`${styles.summaryRow} ${styles.afterDeposit}`}>
                  <span className={styles.summaryLabel}>
                    Balance After Deposit
                  </span>
                  <span className={styles.summaryValue}>
                    ${formatCurrency(paymentBreakdown.balanceAfterDeposit)}
                  </span>
                </div>
              </>
            )}

            {/* Show other payments if any */}
            {paymentBreakdown.otherPayments > 0 && (
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-credit-card" aria-hidden="true" /> Additional Payments ({paidPayments.length})
                </span>
                <span className={styles.summaryValue}>
                  ${formatCurrency(paymentBreakdown.otherPayments)}
                </span>
              </div>
            )}

            {/* Total paid summary */}
            <div className={`${styles.summaryRow} ${styles.totalPaidRow}`}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-check-circle" aria-hidden="true" /> Total Paid
              </span>
              <span className={styles.summaryValue}>
                ${formatCurrency(paymentBreakdown.totalPaid)}
              </span>
            </div>

            {/* Balance or overpayment */}
            <div className={`${styles.summaryRow} ${styles.balance}`}>
              <span className={styles.summaryLabel}>
                {paymentBreakdown.overpayment > 0 ? (
                  <>
                    <i className={`fas fa-gift ${styles.overpaidIcon}`} aria-hidden="true" /> Overpaid
                  </>
                ) : (
                  <>
                    <i className="fas fa-money-bill" aria-hidden="true" /> Remaining Balance
                  </>
                )}
              </span>
              <span className={styles.summaryValue}>
                ${formatCurrency(paymentBreakdown.overpayment > 0 ? paymentBreakdown.overpayment : paymentBreakdown.totalDue)}
              </span>
            </div>

            {parseFloat(calculations.payments.overduePayments || 0) > 0 && (
              <div className={styles.overdueWarning}>
                <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                <span>Overdue: ${formatCurrency(calculations.payments.overduePayments)}</span>
              </div>
            )}
          </div>

          {!disabled && (
            <div className={styles.depositSection}>
              <h4 className={styles.sectionSubtitle}>
                <i className="fas fa-hand-holding-usd" aria-hidden="true" /> Deposit Information
              </h4>
              <div className={styles.depositFields}>
                <div className={styles.field}>
                  <label htmlFor="deposit-amount">Amount:</label>
                  <input
                    id="deposit-amount"
                    type="number"
                    value={depositPayment?.amount || ''}
                    onChange={(e) => handleDepositAmountChange(e.target.value)}
                    min="0"
                    max="100000"
                    step="0.01"
                    placeholder="0.00"
                    aria-label="Deposit Amount"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="deposit-date">Date:</label>
                  <input
                    id="deposit-date"
                    type="date"
                    value={depositPayment?.date ? new Date(depositPayment.date).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleDepositDateChange(e.target.value)}
                    aria-label="Deposit Date"
                  />
                </div>
              </div>
            </div>
          )}

          {!disabled && (
            <div className={styles.quickActions}>
              {paymentBreakdown.totalDue > 0 && (
                <button
                  onClick={addQuickPayment}
                  className={styles.quickButton}
                  title="Pre-fill form with remaining balance"
                  disabled={disabled}
                >
                  <i className="fas fa-check-circle" aria-hidden="true" /> Clear Balance (${formatCurrency(paymentBreakdown.totalDue)})
                </button>
              )}
              <button
                onClick={toggleAddPayment}
                className={`${styles.addPaymentToggle} ${showAddPayment ? styles.addPaymentActive : ''}`}
                title={showAddPayment ? 'Cancel adding payment' : 'Add new payment'}
                disabled={disabled}
              >
                <i className={showAddPayment ? 'fas fa-times' : 'fas fa-plus'} aria-hidden="true" />
                {showAddPayment ? 'Cancel' : 'Add Payment'}
              </button>
            </div>
          )}

          {!disabled && showAddPayment && (
            <div className={styles.addPaymentSection}>
              <h4 className={styles.sectionSubtitle}>
                <i className="fas fa-plus-circle" aria-hidden="true" /> New Payment
              </h4>
              <div className={styles.addPaymentFields}>
                <div className={styles.field}>
                  <label htmlFor="payment-date">Date:</label>
                  <input
                    id="payment-date"
                    type="date"
                    value={newPayment.date}
                    onChange={(e) => handleNewPaymentChange('date', e.target.value)}
                    aria-label="Payment Date"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="payment-amount">Amount:</label>
                  <input
                    id="payment-amount"
                    type="number"
                    value={newPayment.amount}
                    onChange={(e) => handleNewPaymentChange('amount', e.target.value)}
                    min="0.01"
                    max="100000"
                    step="0.01"
                    placeholder="0.00"
                    aria-label="Payment Amount"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="payment-method">Method:</label>
                  <select
                    id="payment-method"
                    value={newPayment.method}
                    onChange={(e) => handleNewPaymentChange('method', e.target.value)}
                    aria-label="Payment Method"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Credit">Credit</option>
                    <option value="Debit">Debit</option>
                    <option value="Check">Check</option>
                    <option value="Zelle">Zelle</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="payment-note">Note:</label>
                  <input
                    id="payment-note"
                    type="text"
                    value={newPayment.note}
                    onChange={(e) => handleNewPaymentChange('note', e.target.value)}
                    placeholder="Payment note (optional)"
                    aria-label="Payment Note"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={newPayment.isPaid}
                      onChange={(e) => handleNewPaymentChange('isPaid', e.target.checked)}
                      aria-label="Mark as Paid"
                    />
                    <span>Mark as Paid</span>
                  </label>
                </div>
              </div>
              <div className={styles.addPaymentActions}>
                <button
                  onClick={addPayment}
                  className={styles.addButton}
                  disabled={!newPayment.amount || parseFloat(newPayment.amount) <= 0 || !newPayment.date}
                >
                  <i className="fas fa-plus" aria-hidden="true" /> Add Payment (${formatCurrency(newPayment.amount || 0)})
                </button>
              </div>
            </div>
          )}

          {totalPaymentsCount > 0 && (
            <div className={styles.paymentEntries}>
              <h4 className={styles.sectionSubtitle}>
                <i className="fas fa-list" aria-hidden="true" /> Payment History ({totalPaymentsCount})
              </h4>
              <div className={styles.tableContainer}>
                <table className={styles.paymentTable} aria-label="Payment History">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Note</th>
                      <th>Status</th>
                      {!disabled && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {safeSettings.payments
                      .filter(payment => payment.method !== 'Deposit')
                      .map((payment, index) => {
                        const actualIndex = safeSettings.payments.findIndex(p => p === payment);
                        return editingIndex === actualIndex ? (
                          <tr key={actualIndex}>
                            <td>
                              <input
                                type="date"
                                value={editedPayment.date}
                                onChange={(e) => handleEditChange('date', e.target.value)}
                                aria-label="Edit Payment Date"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={editedPayment.amount}
                                onChange={(e) => handleEditChange('amount', e.target.value)}
                                min="0.01"
                                max="100000"
                                step="0.01"
                                placeholder="0.00"
                                aria-label="Edit Payment Amount"
                                required
                              />
                            </td>
                            <td>
                              <select
                                value={editedPayment.method}
                                onChange={(e) => handleEditChange('method', e.target.value)}
                                aria-label="Edit Payment Method"
                              >
                                <option value="Cash">Cash</option>
                                <option value="Credit">Credit</option>
                                <option value="Debit">Debit</option>
                                <option value="Check">Check</option>
                                <option value="Zelle">Zelle</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editedPayment.note || ''}
                                onChange={(e) => handleEditChange('note', e.target.value)}
                                placeholder="Payment note"
                                aria-label="Edit Payment Note"
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={editedPayment.isPaid}
                                onChange={(e) => handleEditChange('isPaid', e.target.checked)}
                                aria-label="Edit Payment Status"
                              />
                              {editedPayment.isPaid ? ' Paid' : ' Due'}
                            </td>
                            <td className={styles.actionsCell}>
                              <button
                                onClick={() => saveEdit(actualIndex)}
                                className={styles.saveButton}
                                title="Save Changes"
                                disabled={!editedPayment.amount || !editedPayment.date}
                                aria-label="Save Edited Payment"
                              >
                                <i className="fas fa-check" aria-hidden="true" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className={styles.cancelButton}
                                title="Cancel Edit"
                                aria-label="Cancel Editing"
                              >
                                <i className="fas fa-times" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={actualIndex}
                            className={
                              payment.isPaid
                                ? styles.paidRow
                                : new Date(payment.date) < new Date()
                                ? styles.overdueRow
                                : ''
                            }
                          >
                            <td>{new Date(payment.date).toLocaleDateString()}</td>
                            <td className={styles.amountCell}>${parseFloat(payment.amount).toFixed(2)}</td>
                            <td>{payment.method || 'N/A'}</td>
                            <td className={styles.noteCell}>{payment.note || '-'}</td>
                            <td>
                              <input
                                type="checkbox"
                                checked={payment.isPaid}
                                onChange={() => togglePaymentStatus(actualIndex)}
                                disabled={disabled}
                                aria-label={`Toggle ${payment.isPaid ? 'Paid' : 'Due'} Status`}
                              />
                              <span className={styles.statusText}>
                                {payment.isPaid ? ' Paid' : ' Due'}
                              </span>
                            </td>
                            {!disabled && (
                              <td className={styles.actionsCell}>
                                <button
                                  onClick={() => startEditing(actualIndex)}
                                  className={styles.editButton}
                                  title="Edit Payment"
                                  aria-label="Edit Payment"
                                >
                                  <i className="fas fa-edit" aria-hidden="true" />
                                </button>
                                <button
                                  onClick={() => removePayment(actualIndex)}
                                  className={styles.removeButton}
                                  title="Remove Payment"
                                  aria-label="Remove Payment"
                                >
                                  <i className="fas fa-trash-alt" aria-hidden="true" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {totalPaymentsCount === 0 && !showAddPayment && !disabled && (
            <div className={styles.emptyState}>
              <i className="fas fa-wallet fa-2x" aria-hidden="true" />
              <div>
                <h4>No Payments Recorded</h4>
                <p>Click "Add Payment" to record your first payment or use the deposit fields above.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}