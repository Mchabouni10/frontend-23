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

  // Initialize CalculatorEngine with stable dependencies
  const calculator = useMemo(() => {
    return new CalculatorEngine(categories, settings);
  }, [categories, settings]);

  // Calculate totals to derive monetary values
  const totals = useMemo(() => {
    try {
      return calculator.calculateTotals();
    } catch (error) {
      console.error('Error calculating totals:', error);
      return {
        taxAmount: '0.00',
        markupAmount: '0.00',
        laborDiscount: '0.00',
        total: '0.00',
        miscFeesTotal: '0.00'
      };
    }
  }, [calculator]);

  // Calculate waste cost from waste entries
  const wasteEntriesCost = useMemo(() => {
    const wasteEntries = settings.wasteEntries || [];
    return wasteEntries.reduce((total, entry) => {
      const surfaceCost = parseFloat(entry.surfaceCost) || 0;
      const wasteFactor = parseFloat(entry.wasteFactor) || 0;
      return total + (surfaceCost * wasteFactor);
    }, 0);
  }, [settings.wasteEntries]);

  // Calculate additional costs summary
  const additionalCostsSummary = useMemo(() => {
    const waste = wasteEntriesCost;
    const tax = parseFloat(totals.taxAmount) || 0;
    const markup = parseFloat(totals.markupAmount) || 0;
    const transportation = parseFloat(settings.transportationFee) || 0;
    const misc = parseFloat(totals.miscFeesTotal) || 0;
    const totalAdditional = waste + tax + markup + transportation + misc;
    const percentage = totals.total ? (totalAdditional / parseFloat(totals.total) * 100).toFixed(1) : 0;
    return { totalAdditional: totalAdditional.toFixed(2), percentage: `${percentage}%` };
  }, [wasteEntriesCost, totals, settings.transportationFee]);

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

    if (['laborDiscount', 'markup', 'taxRate'].includes(field)) {
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

  // Waste Entry handlers
  const handleWasteEntryChange = (index, field, value) => {
    if (disabled) return;
    
    if (field === 'surfaceCost') {
      const num = validateNumber(value, `Waste entry ${index + 1} cost`, 0, 1000000);
      if (num === false) return;
      
      setSettings((prev) => ({
        ...prev,
        wasteEntries: (prev.wasteEntries || []).map((entry, i) =>
          i === index ? { ...entry, surfaceCost: num } : entry
        ),
      }));
    } else if (field === 'wasteFactor') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 0.30) {
        addError(`Waste factor must be between 0% and 30%.`);
        return;
      }
      
      setSettings((prev) => ({
        ...prev,
        wasteEntries: (prev.wasteEntries || []).map((entry, i) =>
          i === index ? { ...entry, wasteFactor: num } : entry
        ),
      }));
    } else if (field === 'surfaceName') {
      if (!value.trim()) {
        addError(`Waste entry ${index + 1} name cannot be empty.`);
        return;
      }
      
      setSettings((prev) => ({
        ...prev,
        wasteEntries: (prev.wasteEntries || []).map((entry, i) =>
          i === index ? { ...entry, surfaceName: value } : entry
        ),
      }));
    }
  };

  const addWasteEntry = () => {
    if (disabled) return;
    
    setSettings((prev) => ({
      ...prev,
      wasteEntries: [
        ...(prev.wasteEntries || []),
        { 
          surfaceName: `Surface ${(prev.wasteEntries?.length || 0) + 1}`, 
          surfaceCost: 0,
          wasteFactor: 0
        }
      ],
    }));
  };

  const removeWasteEntry = (index) => {
    if (disabled) return;
    
    setSettings((prev) => ({
      ...prev,
      wasteEntries: (prev.wasteEntries || []).filter((_, i) => i !== index),
    }));
  };

  // Tooltip helper for modern UX
  const renderTooltip = (text, children) => (
    <div className={styles.tooltipWrapper}>
      {children}
      <span className={styles.tooltip}>{text}</span>
    </div>
  );

  // Safe settings with proper defaults
  const safeSettings = {
    transportationFee: 0,
    taxRate: 0,
    markup: 0,
    laborDiscount: 0,
    miscFees: [],
    wasteEntries: [],
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
        <div className={styles.totalCost}>
          <span className={styles.additionalInline}> +${additionalCostsSummary.totalAdditional} ({additionalCostsSummary.percentage})</span>
        </div>
      </div>
      {expandedSections.additionalCosts && (
        <div className={styles.settingsContent}>
          {/* Waste Entries - Material Surface Waste Factor */}
          <div className={styles.wasteSection}>
            {renderTooltip('Add waste factors for material surfaces. Enter the material cost and select waste percentage.', 
              <label>
                <i className="fas fa-recycle" /> Waste Factors by Surface:
              </label>
            )}
            {(safeSettings.wasteEntries || []).map((entry, index) => {
              const surfaceCost = parseFloat(entry.surfaceCost) || 0;
              const wasteFactor = parseFloat(entry.wasteFactor) || 0;
              const wasteCost = surfaceCost * wasteFactor;
              
              return (
                <div key={index} className={styles.wasteEntryRow}>
                  <div className={styles.inputWrapper}>
                    <i className={`fas fa-tag ${styles.inputIcon}`} />
                    <input
                      type="text"
                      value={entry.surfaceName}
                      onChange={(e) => handleWasteEntryChange(index, 'surfaceName', e.target.value)}
                      placeholder="Surface name (e.g., Kitchen Floor)"
                      disabled={disabled}
                      className={styles.surfaceNameInput}
                      title="Name of the material surface"
                    />
                  </div>
                  <div className={styles.inputWrapper}>
                    <i className={`fas fa-dollar-sign ${styles.inputIcon}`} />
                    <input
                      type="number"
                      value={entry.surfaceCost}
                      onChange={(e) => handleWasteEntryChange(index, 'surfaceCost', e.target.value)}
                      placeholder="Material Cost ($)"
                      min="0"
                      step="0.01"
                      max="1000000"
                      disabled={disabled}
                      className={styles.costInput}
                      title="Total material cost for this surface"
                    />
                  </div>
                  <div className={styles.inputWrapper}>
                    <i className={`fas fa-percentage ${styles.inputIcon}`} />
                    <select
                      value={(wasteFactor * 100).toFixed(0)}
                      onChange={(e) => handleWasteEntryChange(index, 'wasteFactor', parseFloat(e.target.value) / 100)}
                      disabled={disabled}
                      className={styles.wasteSelect}
                      title="Waste percentage"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="10">10%</option>
                      <option value="15">15%</option>
                      <option value="20">20%</option>
                      <option value="25">25%</option>
                      <option value="30">30%</option>
                    </select>
                  </div>
                  <span className={styles.wasteCostDisplay} title="Calculated waste cost">
                    = ${wasteCost.toFixed(2)}
                  </span>
                  {!disabled && (
                    <button
                      onClick={() => removeWasteEntry(index)}
                      className={styles.removeButton}
                      title="Remove this waste entry"
                    >
                      <i className="fas fa-trash-alt" />
                    </button>
                  )}
                </div>
              );
            })}
            {(safeSettings.wasteEntries || []).length > 0 && (
              <div className={styles.wasteTotalRow}>
                <strong>Total Waste Cost:</strong>
                <span className={styles.wasteTotalAmount}>${wasteEntriesCost.toFixed(2)}</span>
              </div>
            )}
            {!disabled && (
              <button
                onClick={addWasteEntry}
                className={styles.addButton}
                title="Add Waste Entry"
              >
                <i className="fas fa-plus" /> Add Waste Entry
              </button>
            )}
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

          {/* Deposit info if available */}
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