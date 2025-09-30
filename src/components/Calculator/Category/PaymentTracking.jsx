// src/components/Calculator/PaymentTracking/PaymentTracking.jsx
import { useState, useMemo, useEffect } from 'react';
import { useCategories } from '../../../context/CategoriesContext';
import { useSettings } from '../../../context/SettingsContext';
import { useWorkType } from '../../../context/WorkTypeContext';
import { useError } from '../../../context/ErrorContext';
import { CalculatorEngine } from '../engine/CalculatorEngine';
import styles from './PaymentTracking.module.css';

// Helper function to safely convert error to string
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
  const [expandedPayments, setExpandedPayments] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Create single calculator engine instance (shared approach)
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
  }, [categories, settings, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // Calculate totals and payments using shared engine
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
          summary: { paidPayments: 0, totalPayments: 0, overduePayments: 0 },
          errors: [`Payment calculation failed: ${errorMessage}`],
        }
      };
    }
  }, [calculatorEngine]);

  // Handle calculation errors safely - only surface serious errors
  useEffect(() => {
    const allErrors = [...(calculations.totals.errors || []), ...(calculations.payments.errors || [])];
    
    if (allErrors.length > 0) {
      // Only add serious errors to global context, filter out "not available" warnings
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

  // Calculate overpayment safely
  const overpayment = useMemo(() => {
    try {
      const paid = parseFloat(calculations.payments.totalPaid) || 0;
      const total = parseFloat(calculations.totals.total) || 0;
      return paid > total ? (paid - total).toFixed(2) : '0.00';
    } catch (err) {
      return '0.00';
    }
  }, [calculations.payments.totalPaid, calculations.totals.total]);

  // Format currency helper
  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Find deposit payment
  const depositPayment = useMemo(() => {
    return settings.payments?.find(p => p.method === 'Deposit') || null;
  }, [settings.payments]);

  // Safe settings defaults
  const safeSettings = {
    payments: [],
    ...settings,
  };

  // Calculate total payments count (excluding deposit)
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

  // Update deposit payment in settings
  const updateDepositPayment = (amount, date) => {
    setSettings(prev => {
      const payments = [...(prev.payments || [])];
      const depositIndex = payments.findIndex(p => p.method === 'Deposit');

      const depositAmount = parseFloat(amount);
      if (isNaN(depositAmount) || depositAmount < 0) {
        addError('Deposit amount must be valid and non-negative.');
        return prev;
      }
      if (depositAmount > 100000) {
        addError('Deposit cannot exceed $100,000.');
        return prev;
      }

      const depositDate = date ? new Date(date).toISOString() : new Date().toISOString();

      if (depositAmount === 0) {
        // Remove deposit payment if amount is 0
        if (depositIndex !== -1) {
          payments.splice(depositIndex, 1);
        }
      } else {
        if (depositIndex === -1) {
          // Add new deposit payment
          payments.push({
            date: depositDate,
            amount: depositAmount,
            method: 'Deposit',
            note: 'Initial Deposit',
            isPaid: true,
          });
        } else {
          // Update existing deposit payment
          payments[depositIndex] = {
            ...payments[depositIndex],
            amount: depositAmount,
            date: depositDate,
          };
        }
      }

      return { ...prev, payments };
    });
  };

  // Handle deposit amount change
  const handleDepositAmountChange = (value) => {
    const currentDeposit = settings.payments?.find(p => p.method === 'Deposit');
    const depositDate = currentDeposit?.date || new Date().toISOString();
    updateDepositPayment(value, depositDate);
  };

  // Handle deposit date change
  const handleDepositDateChange = (value) => {
    const currentDeposit = settings.payments?.find(p => p.method === 'Deposit');
    const depositAmount = currentDeposit?.amount || 0;
    updateDepositPayment(depositAmount, value);
  };

  const handleNewPaymentChange = (field, value) => {
    setNewPayment((prev) => ({ ...prev, [field]: value }));
  };

  const addPayment = () => {
    if (disabled) return;

    // Prevent adding manual "Deposit" payments
    if (newPayment.method === 'Deposit') {
      addError('Please use the Deposit field above to record deposit payments.');
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
      
      // Reset form
      setNewPayment({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        method: 'Cash',
        note: '',
        isPaid: true,
      });
      
      setShowAddPayment(false);
      addError(`Payment of $${formatCurrency(payment.amount)} added successfully.`, 'success');
    } catch (err) {
      addError('Failed to add payment. Please try again.');
    }
  };

  const togglePaymentStatus = (index) => {
    if (disabled) return;
    
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
    
    const payment = settings.payments[index];
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

    // Prevent editing to "Deposit" method
    if (editedPayment.method === 'Deposit') {
      addError('Cannot change payment method to Deposit. Please use the Deposit field above.');
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
      addError('Payment updated successfully.', 'success');
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
    
    const remaining = parseFloat(calculations.payments.totalDue) || 0;
    if (remaining <= 0) {
      addError('No remaining balance to pay.');
      return;
    }

    // Pre-fill the add payment form with remaining amount
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
      // Reset form when closing
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
          <i className={`fas ${expandedPayments ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
        </button>
        <h3 className={styles.sectionTitle}>
          <i className="fas fa-wallet" /> Payment Tracking
          {totalPaymentsCount > 0 && (
            <span className={styles.paymentCount}>({totalPaymentsCount})</span>
          )}
        </h3>
      </div>

      {expandedPayments && (
        <div className={styles.content}>
          {/* Compact Summary - Essential Info Only */}
          <div className={styles.summary}>
            <div className={`${styles.summaryRow} ${styles.grandTotal}`}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-receipt" /> Grand Total
              </span>
              <span className={styles.summaryValue}>
                ${formatCurrency(calculations.totals.total)}
              </span>
            </div>

            {depositPayment && (
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>
                  <i className="fas fa-money-check" /> Deposit
                </span>
                <span className={`${styles.summaryValue} ${styles.deposit}`}>
                  -${formatCurrency(depositPayment.amount)}
                </span>
              </div>
            )}

            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>
                <i className="fas fa-credit-card" /> Total Paid
              </span>
              <span className={styles.summaryValue}>
                ${formatCurrency(calculations.payments.totalPaid)}
              </span>
            </div>

            <div className={`${styles.summaryRow} ${styles.balance}`}>
              <span className={styles.summaryLabel}>
                {parseFloat(overpayment) > 0 ? (
                  <>
                    <i className={`fas fa-gift ${styles.overpaidIcon}`} /> Overpaid by
                  </>
                ) : (
                  <>
                    <i className="fas fa-money-bill" /> Amount Due
                  </>
                )}
              </span>
              <span className={styles.summaryValue}>
                ${formatCurrency(parseFloat(overpayment) > 0 ? overpayment : calculations.payments.totalDue)}
              </span>
            </div>

            {/* Overdue Warning */}
            {parseFloat(calculations.payments.overduePayments || 0) > 0 && (
              <div className={styles.overdueWarning}>
                <i className="fas fa-exclamation-triangle" />
                <span>Overdue: ${formatCurrency(calculations.payments.overduePayments)}</span>
              </div>
            )}
          </div>

          {/* Deposit Controls */}
          {!disabled && (
            <div className={styles.depositSection}>
              <h4 className={styles.sectionSubtitle}>
                <i className="fas fa-hand-holding-usd" /> Deposit Information
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

          {/* Quick Actions */}
          {!disabled && (
            <div className={styles.quickActions}>
              {parseFloat(calculations.payments.totalDue) > 0 && (
                <button
                  onClick={addQuickPayment}
                  className={styles.quickButton}
                  title="Pre-fill form with remaining balance"
                  disabled={disabled}
                >
                  <i className="fas fa-check-circle" /> Clear Balance (${formatCurrency(calculations.payments.totalDue)})
                </button>
              )}
              <button
                onClick={toggleAddPayment}
                className={`${styles.addPaymentToggle} ${showAddPayment ? styles.addPaymentActive : ''}`}
                title={showAddPayment ? 'Cancel adding payment' : 'Add new payment'}
                disabled={disabled}
              >
                <i className={showAddPayment ? 'fas fa-times' : 'fas fa-plus'} />
                {showAddPayment ? 'Cancel' : 'Add Payment'}
              </button>
            </div>
          )}

          {/* Add Payment Form */}
          {!disabled && showAddPayment && (
            <div className={styles.addPaymentSection}>
              <h4 className={styles.sectionSubtitle}>
                <i className="fas fa-plus-circle" /> New Payment
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
                  <i className="fas fa-plus" /> Add Payment (${formatCurrency(newPayment.amount || 0)})
                </button>
              </div>
            </div>
          )}

          {/* Payment Entries Table */}
          {totalPaymentsCount > 0 && (
            <div className={styles.paymentEntries}>
              <h4 className={styles.sectionSubtitle}>
                <i className="fas fa-list" /> Payment History ({totalPaymentsCount})
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
                                <i className="fas fa-check" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className={styles.cancelButton}
                                title="Cancel Edit"
                                aria-label="Cancel Editing"
                              >
                                <i className="fas fa-times" />
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
                                  <i className="fas fa-edit" />
                                </button>
                                <button
                                  onClick={() => removePayment(actualIndex)}
                                  className={styles.removeButton}
                                  title="Remove Payment"
                                  aria-label="Remove Payment"
                                >
                                  <i className="fas fa-trash-alt" />
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
              <i className="fas fa-wallet fa-2x" />
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