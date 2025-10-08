// src/components/Calculator/Category/AdditionalCosts.jsx
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../../../context/SettingsContext';
import { useCategories } from '../../../context/CategoriesContext';
import { useError } from '../../../context/ErrorContext';
import { CalculatorEngine } from '../engine/CalculatorEngine';
import styles from './AdditionalCosts.module.css';

export default function AdditionalCosts({ disabled = false }) {
  const { settings, setSettings } = useSettings();
  const { categories } = useCategories();
  const { addError } = useError();

  const [useManualMarkup, setUseManualMarkup] = useState(false);
  const [useManualLaborDiscount, setUseManualLaborDiscount] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ additionalCosts: true });

  // FIX 1: Stabilize dependencies using JSON serialization
  // This prevents calculator from recreating on every render
  const categoriesKey = useMemo(() => JSON.stringify(categories), [categories]);
  const settingsKey = useMemo(() => JSON.stringify(settings), [settings]);

  // Initialize CalculatorEngine with stable dependencies
  const calculator = useMemo(() => {
    return new CalculatorEngine(categories, settings);
  }, [categoriesKey, settingsKey]);

  // Calculate totals to derive monetary values
  const totals = useMemo(() => {
    try {
      return calculator.calculateTotals();
    } catch (error) {
      console.error('Error calculating totals:', error);
      return {
        wasteCost: '0.00',
        taxAmount: '0.00',
        markupAmount: '0.00',
        laborDiscount: '0.00',
        total: '0.00'
      };
    }
  }, [calculator]);

  // NEW: Calculate additional costs summary for innovative breakdown
  const additionalCostsSummary = useMemo(() => {
    const waste = parseFloat(totals.wasteCost) || 0;
    const tax = parseFloat(totals.taxAmount) || 0;
    const markup = parseFloat(totals.markupAmount) || 0;
    const laborDiscount = parseFloat(totals.laborDiscount) || 0;
    const transportation = parseFloat(settings.transportationFee) || 0;
    const misc = parseFloat(totals.miscFeesTotal) || 0;
    const totalAdditional = waste + tax + markup + transportation + misc;
    const percentage = totals.total ? (totalAdditional / parseFloat(totals.total) * 100).toFixed(1) : 0;
    return { totalAdditional: totalAdditional.toFixed(2), percentage: `${percentage}%` };
  }, [totals, settings.transportationFee]);

  // Find deposit payment for display
  const depositPayment = useMemo(() => {
    return settings.payments?.find(p => p.method === 'Deposit') || null;
  }, [settings.payments]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const validateNumber = (value, field, min = 0, max = Infinity) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      addError(`${field} must be a valid number.`);
      return false;
    }
    if (num < min) {
      addError(`${field} cannot be negative.`);
      return false;
    }
    if (num > max) {
      addError(`${field} (${num}) exceeds maximum allowed value (${max}).`);
      return false;
    }
    return num;
  };

  const handleSettingsChange = (field, value) => {
    if (disabled) return;

    if (['laborDiscount', 'markup', 'wasteFactor', 'taxRate'].includes(field)) {
      const max = field === 'laborDiscount' ? 100 : 500;
      const num = validateNumber(value, field.charAt(0).toUpperCase() + field.slice(1), 0, max);
      if (num === false) return;
      
      setSettings((prev) => ({
        ...prev,
        [field]: num / 100,
      }));
    } else {
      const max = field === 'transportationFee' ? 100000 : Infinity;
      const num = validateNumber(value, field.charAt(0).toUpperCase() + field.slice(1), 0, max);
      if (num === false) return;
      
      setSettings((prev) => ({
        ...prev,
        [field]: num,
      }));
    }
  };

  const handleMiscFeeChange = (index, field, value) => {
    if (disabled) return;
    
    if (field === 'amount') {
      const num = validateNumber(value, `Miscellaneous fee ${index + 1}`, 0, 100000);
      if (num === false) return;
      
      setSettings((prev) => ({
        ...prev,
        miscFees: prev.miscFees.map((fee, i) =>
          i === index ? { ...fee, amount: num } : fee
        ),
      }));
    } else {
      if (!value.trim()) {
        addError(`Miscellaneous fee ${index + 1} name cannot be empty.`);
        return;
      }
      
      setSettings((prev) => ({
        ...prev,
        miscFees: prev.miscFees.map((fee, i) =>
          i === index ? { ...fee, name: value } : fee
        ),
      }));
    }
  };

  const addMiscFee = () => {
    if (disabled) return;
    
    setSettings((prev) => ({
      ...prev,
      miscFees: [...(prev.miscFees || []), { name: `Fee ${(prev.miscFees?.length || 0) + 1}`, amount: 0 }],
    }));
  };

  const removeMiscFee = (index) => {
    if (disabled) return;
    
    setSettings((prev) => ({
      ...prev,
      miscFees: prev.miscFees.filter((_, i) => i !== index),
    }));
  };

  // NEW: Innovative tooltip helper for modern UX
  const renderTooltip = (text, children) => (
    <div className={styles.tooltipWrapper}>
      {children}
      <span className={styles.tooltip}>{text}</span>
    </div>
  );

  // Safe settings with proper defaults
  const safeSettings = {
    wasteFactor: 0,
    transportationFee: 0,
    taxRate: 0,
    markup: 0,
    laborDiscount: 0,
    miscFees: [],
    payments: [],
    ...settings,
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <button
          className={styles.toggleButton}
          onClick={() => toggleSection('additionalCosts')}
          title={expandedSections.additionalCosts ? 'Collapse' : 'Expand'}
          aria-expanded={expandedSections.additionalCosts}
        >
          <i className={`fas ${expandedSections.additionalCosts ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
        </button>
        <h3 className={styles.sectionTitle}>
          <i className="fas fa-cogs" /> Additional Costs
        </h3>
        {/* UPDATED: Compact one-line header with Grand Total + Additional (percentage) */}
        <div className={styles.totalCost}>
          <span className={styles.additionalInline}> +${additionalCostsSummary.totalAdditional} ({additionalCostsSummary.percentage})</span>
        </div>
      </div>
      {expandedSections.additionalCosts && (
        <div className={styles.settingsContent}>
          {/* Waste Factor */}
          <div className={styles.field}>
            {renderTooltip('Percentage of material cost added for waste/scrap', 
              <label>
                <i className="fas fa-recycle" /> Waste Factor (%):
              </label>
            )}
            <input
              type="number"
              value={(safeSettings.wasteFactor * 100).toFixed(1)}
              onChange={(e) => handleSettingsChange('wasteFactor', e.target.value)}
              min="0"
              max="500"
              step="0.1"
              disabled={disabled}
            />
            <span className={styles.costDisplay}>
              (${totals.wasteCost})
            </span>
          </div>

          {/* Transportation Fee */}
          <div className={styles.field}>
            {renderTooltip('Flat fee for transportation and delivery', 
              <label>
                <i className="fas fa-truck" /> Transportation Fee ($):
              </label>
            )}
            <input
              type="number"
              value={safeSettings.transportationFee}
              onChange={(e) => handleSettingsChange('transportationFee', e.target.value)}
              min="0"
              max="100000"
              disabled={disabled}
            />
          </div>

          {/* Tax Rate */}
          <div className={styles.field}>
            {renderTooltip('Sales tax rate applied to subtotal', 
              <label>
                <i className="fas fa-percentage" /> Tax Rate (%):
              </label>
            )}
            <input
              type="number"
              value={(safeSettings.taxRate * 100).toFixed(1)}
              onChange={(e) => handleSettingsChange('taxRate', e.target.value)}
              min="0"
              max="500"
              step="0.1"
              disabled={disabled}
            />
            <span className={styles.costDisplay}>
              (${totals.taxAmount})
            </span>
          </div>

          {/* Markup */}
          <div className={styles.field}>
            {renderTooltip('Profit margin percentage applied to subtotal', 
              <label>
                <i className="fas fa-chart-line" /> Markup (%):
              </label>
            )}
            {useManualMarkup ? (
              <input
                type="number"
                value={(safeSettings.markup * 100).toFixed(1)}
                onChange={(e) => handleSettingsChange('markup', e.target.value)}
                min="0"
                max="500"
                step="0.1"
                disabled={disabled}
              />
            ) : (
              <select
                value={(safeSettings.markup * 100).toFixed(0)}
                onChange={(e) => handleSettingsChange('markup', e.target.value)}
                disabled={disabled}
              >
                <option value="" disabled>Select Markup</option>
                {Array.from({ length: 21 }, (_, i) => i * 5).map((val) => (
                  <option key={val} value={val}>{val}%</option>
                ))}
              </select>
            )}
            <span className={styles.costDisplay}>
              (${totals.markupAmount})
            </span>
            {!disabled && (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={useManualMarkup}
                  onChange={() => setUseManualMarkup(!useManualMarkup)}
                />
                <i className="fas fa-edit" /> Manual
              </label>
            )}
          </div>

          {/* Labor Discount */}
          <div className={styles.field}>
            {renderTooltip('Discount applied to total labor costs', 
              <label>
                <i className="fas fa-cut" /> Labor Discount (%):
              </label>
            )}
            {useManualLaborDiscount ? (
              <input
                type="number"
                value={(safeSettings.laborDiscount * 100).toFixed(1)}
                onChange={(e) => handleSettingsChange('laborDiscount', e.target.value)}
                min="0"
                max="100"
                step="0.1"
                disabled={disabled}
              />
            ) : (
              <select
                value={(safeSettings.laborDiscount * 100).toFixed(0)}
                onChange={(e) => handleSettingsChange('laborDiscount', e.target.value)}
                disabled={disabled}
              >
                <option value="" disabled>Select Discount</option>
                {Array.from({ length: 21 }, (_, i) => i * 5).map((val) => (
                  <option key={val} value={val}>{val}%</option>
                ))}
              </select>
            )}
            <span className={styles.costDisplay}>
              (${totals.laborDiscount})
            </span>
            {!disabled && (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={useManualLaborDiscount}
                  onChange={() => setUseManualLaborDiscount(!useManualLaborDiscount)}
                />
                <i className="fas fa-edit" /> Manual
              </label>
            )}
          </div>

          {/* Misc Fees */}
          <div className={styles.miscFees}>
            {renderTooltip('Additional one-time fees (e.g., permits, inspections)', 
              <label>
                <i className="fas fa-money-bill-wave" /> Miscellaneous Fees:
              </label>
            )}
            {(safeSettings.miscFees || []).map((fee, index) => (
              <div key={index} className={styles.miscFeeRow}>
                <div className={styles.inputWrapper}>
                  <i className={`fas fa-tag ${styles.inputIcon}`} />
                  <input
                    type="text"
                    value={fee.name}
                    onChange={(e) => handleMiscFeeChange(index, 'name', e.target.value)}
                    placeholder="Fee Name"
                    disabled={disabled}
                  />
                </div>
                <div className={styles.inputWrapper}>
                  <i className={`fas fa-dollar-sign ${styles.inputIcon}`} />
                  <input
                    type="number"
                    value={fee.amount}
                    onChange={(e) => handleMiscFeeChange(index, 'amount', e.target.value)}
                    min="0"
                    max="100000"
                    disabled={disabled}
                  />
                </div>
                {!disabled && (
                  <button
                    onClick={() => removeMiscFee(index)}
                    className={styles.removeButton}
                    title="Remove Fee"
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button
                onClick={addMiscFee}
                className={styles.addButton}
                title="Add Miscellaneous Fee"
              >
                <i className="fas fa-plus" /> Add Fee
              </button>
            )}
          </div>

          {/* NEW: Deposit info if available, for modern payment preview */}
          {depositPayment && (
            <div className={styles.depositInfo}>
              <i className="fas fa-hand-holding-usd" />
              <span>Deposit Due: ${depositPayment.amount.toFixed(2)}</span>
              <span className={styles.depositStatus}>
                {depositPayment.isPaid ? 'Paid' : 'Pending'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

AdditionalCosts.propTypes = {
  disabled: PropTypes.bool,
};