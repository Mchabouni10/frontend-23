// src/components/Calculator/WorkItem/WorkItem.jsx
import React, { useCallback, useState, useMemo } from 'react';
import { useWorkType } from '../../../context/WorkTypeContext';
import { useSettings } from '../../../context/SettingsContext';
import { CalculatorEngine } from '../engine/CalculatorEngine';
import SurfaceManager from './SurfaceManager';
import CostInput from './CostInput';
import styles from './WorkItem.module.css';
import ErrorBoundary from '../../ErrorBoundary'; // Add error boundary

const DEFAULT_COST_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '15', '20'];

const ensureNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export default function WorkItem({
  catIndex,
  workIndex,
  workItem,
  disabled = false,
  categoryKey = '',
  showCostBreakdown = true,
  costOptions = DEFAULT_COST_OPTIONS,
  onItemChange,
  onItemRemove,
}) {
  // Wrap with error boundary
  return (
    <ErrorBoundary boundaryName={`WorkItem-${catIndex}-${workIndex}`}>
      <WorkItemContent 
        catIndex={catIndex}
        workIndex={workIndex}
        workItem={workItem}
        disabled={disabled}
        categoryKey={categoryKey}
        showCostBreakdown={showCostBreakdown}
        costOptions={costOptions}
        onItemChange={onItemChange}
        onItemRemove={onItemRemove}
      />
    </ErrorBoundary>
  );
}

function WorkItemContent({
  catIndex,
  workIndex,
  workItem,
  disabled = false,
  categoryKey = '',
  showCostBreakdown = true,
  costOptions = DEFAULT_COST_OPTIONS,
  onItemChange,
  onItemRemove,
}) {
  const {
    getCategoryWorkTypes,
    getSubtypeOptions,
    getDefaultSubtype,
    getAllMeasurementTypes,
    getMeasurementTypeLabel,
    getMeasurementTypeUnit,
    getMeasurementTypeIcon,
    isCategoryValid,
    getMeasurementType, // This is now properly available
    isValidSubtype,
    getWorkTypeDetails,
  } = useWorkType();

  const { settings } = useSettings();
  const [isExpanded, setIsExpanded] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});

  // CalculatorEngine instance - ensure it's created properly
  const calculatorEngine = useMemo(() => {
    try {
      if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
        console.warn('Calculator engine dependencies not ready');
        return null;
      }
      return new CalculatorEngine([], settings || {}, {
        getMeasurementType,
        isValidSubtype,
        getWorkTypeDetails,
      });
    } catch (err) {
      console.warn('Calculator engine init error:', err.message);
      return null;
    }
  }, [settings, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // Normalize category key
  const normalizedCategoryKey = useMemo(() => {
    if (!categoryKey) return '';
    if (categoryKey.startsWith('custom_')) return categoryKey;
    return categoryKey.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '');
  }, [categoryKey]);

  // Valid work types for this category
  const availableWorkTypes = useMemo(() => {
    try {
      if (!normalizedCategoryKey || !isCategoryValid(normalizedCategoryKey)) return [];
      return getCategoryWorkTypes(normalizedCategoryKey);
    } catch (err) {
      console.warn(`Failed to get work types: ${err.message}`);
      return [];
    }
  }, [normalizedCategoryKey, getCategoryWorkTypes, isCategoryValid]);

  const workTypeOptions = useMemo(
    () =>
      availableWorkTypes.map(type => ({
        value: type,
        label: type
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
      })),
    [availableWorkTypes]
  );

  const subtypeOptions = useMemo(() => {
    if (!workItem.type) return [];
    try {
      const opts = getSubtypeOptions(workItem.type);
      return (opts || []).map(opt => ({ value: opt, label: opt }));
    } catch (err) {
      console.warn(`Failed subtype options: ${err.message}`);
      return [];
    }
  }, [workItem.type, getSubtypeOptions]);

  // Display name
  const derivedName = useMemo(() => {
    const workTypeLabel = workTypeOptions.find(opt => opt.value === workItem.type)?.label;
    const subtypeLabel = subtypeOptions.find(opt => opt.value === workItem.subtype)?.label;
    if (!workTypeLabel) return 'Unnamed Work Item';
    return subtypeLabel ? `${workTypeLabel} (${subtypeLabel})` : workTypeLabel;
  }, [workItem.type, workItem.subtype, workTypeOptions, subtypeOptions]);

  // Normalize work item before calculations
  const sanitizedWorkItem = useMemo(() => ({
    ...workItem,
    categoryKey: normalizedCategoryKey,
    materialCost: ensureNumber(workItem.materialCost, 0),
    laborCost: ensureNumber(workItem.laborCost, 0),
    type: workItem.type || '',
    subtype: workItem.subtype || '',
    measurementType: workItem.measurementType || '',
    name: derivedName,
    surfaces: Array.isArray(workItem.surfaces) ? workItem.surfaces : [],
  }), [workItem, normalizedCategoryKey, derivedName]);

  // CRITICAL FIX: Auto-detect measurement type when work type changes
  const updateWorkItem = useCallback((field, value) => {
    if (disabled) return;
    const updatedItem = { ...sanitizedWorkItem };

    if (field === 'type') {
      updatedItem.type = value;
      updatedItem.subtype = getDefaultSubtype(value) || '';
      // AUTO-SET MEASUREMENT TYPE BASED ON WORK TYPE
      updatedItem.measurementType = getMeasurementType(normalizedCategoryKey, value);
      updatedItem.surfaces = [];
      setValidationErrors({});
    } else if (field === 'measurementType') {
      updatedItem.measurementType = value;
      updatedItem.surfaces = [];
    } else if (field === 'subtype') {
      updatedItem.subtype = value;
    } else if (field === 'surfaces') {
      updatedItem.surfaces = value;
    } else {
      updatedItem[field] = value;
    }

    // Update name when type or subtype changes
    if (field === 'type' || field === 'subtype') {
      const wtLabel = workTypeOptions.find(opt => opt.value === updatedItem.type)?.label;
      const stLabel = subtypeOptions.find(opt => opt.value === updatedItem.subtype)?.label;
      updatedItem.name = wtLabel ? (stLabel ? `${wtLabel} (${stLabel})` : wtLabel) : updatedItem.name;
    }

    onItemChange?.(catIndex, workIndex, updatedItem);
  }, [disabled, catIndex, workIndex, sanitizedWorkItem, getDefaultSubtype, getMeasurementType, normalizedCategoryKey, onItemChange, workTypeOptions, subtypeOptions]);

  // Remove handler
  const handleRemoveWorkItem = useCallback(() => {
    if (disabled) return;
    onItemRemove?.(catIndex, workIndex, sanitizedWorkItem);
  }, [disabled, catIndex, workIndex, onItemRemove, sanitizedWorkItem]);

  // Surface update
  const handleSurfaceUpdate = useCallback(updated => {
    updateWorkItem('surfaces', updated.surfaces);
  }, [updateWorkItem]);

  // CalculatorEngine calculations
  const calculationResults = useMemo(() => {
    if (!calculatorEngine) {
      return { 
        canCalculate: false, 
        totalUnits: 0, 
        unitLabel: 'units', 
        totalMaterialCost: 0, 
        totalLaborCost: 0, 
        totalCost: 0, 
        errors: ['Calculator not ready'], 
        warnings: [] 
      };
    }
    try {
      const units = calculatorEngine.calculateWorkUnits(sanitizedWorkItem);
      const costs = calculatorEngine.calculateWorkCost(sanitizedWorkItem);
      const errors = [...(units.errors || []), ...(costs.errors || [])];
      const warnings = [...(units.warnings || []), ...(costs.warnings || [])];

      if (errors.length > 0) {
        setValidationErrors(prev => ({ ...prev, calculation: errors.join('; ') }));
      } else {
        setValidationErrors(prev => {
          const { calculation, ...rest } = prev;
          return rest;
        });
      }

      const canCalculate = units.units > 0 && 
                          sanitizedWorkItem.materialCost >= 0 && 
                          sanitizedWorkItem.laborCost >= 0 && 
                          errors.length === 0;

      return {
        canCalculate,
        totalUnits: units.units,
        unitLabel: units.label,
        totalMaterialCost: parseFloat(costs.materialCost),
        totalLaborCost: parseFloat(costs.laborCost),
        totalCost: parseFloat(costs.totalCost),
        errors,
        warnings
      };
    } catch (err) {
      setValidationErrors(prev => ({ ...prev, calculation: `Calculation error: ${err.message}` }));
      return { 
        canCalculate: false, 
        totalUnits: 0, 
        unitLabel: 'units', 
        totalMaterialCost: 0, 
        totalLaborCost: 0, 
        totalCost: 0, 
        errors: [err.message], 
        warnings: [] 
      };
    }
  }, [calculatorEngine, sanitizedWorkItem]);

  const availableMeasurementTypes = useMemo(() => {
    return getAllMeasurementTypes().map(type => ({
      value: type,
      label: getMeasurementTypeLabel(type),
      unit: getMeasurementTypeUnit(type),
      icon: getMeasurementTypeIcon(type),
    }));
  }, [getAllMeasurementTypes, getMeasurementTypeLabel, getMeasurementTypeUnit, getMeasurementTypeIcon]);

  const validationErrorList = useMemo(() => {
    return Object.entries(validationErrors).filter(([_, e]) => e).map(([field, msg]) => ({ field, message: msg }));
  }, [validationErrors]);

  // Check if context is ready
  const isContextReady = useMemo(() => {
    return getMeasurementType && isValidSubtype && getWorkTypeDetails && getAllMeasurementTypes;
  }, [getMeasurementType, isValidSubtype, getWorkTypeDetails, getAllMeasurementTypes]);

  if (!isContextReady) {
    return (
      <div className={styles.workItem}>
        <div className={styles.loading}>Loading work type data...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.workItem} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.header}>
        <button 
          className={styles.toggleButton} 
          onClick={() => setIsExpanded(!isExpanded)} 
          title={isExpanded ? 'Collapse' : 'Expand'}
          aria-expanded={isExpanded}
        >
          <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
        </button>
        <h3 className={styles.workTitle}>
          <i className="fas fa-tools" /> {sanitizedWorkItem.name}
        </h3>
        {!disabled && (
          <button 
            onClick={handleRemoveWorkItem} 
            className={styles.removeButton} 
            aria-label={`Remove ${sanitizedWorkItem.name}`}
            title="Remove Work Item"
          >
            <i className="fas fa-trash-alt" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className={styles.content}>
          {/* Type + Subtype */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor={`type-${catIndex}-${workIndex}`}>
                <i className="fas fa-sitemap" /> Work Type *
              </label>
              <select 
                id={`type-${catIndex}-${workIndex}`} 
                value={sanitizedWorkItem.type} 
                onChange={e => updateWorkItem('type', e.target.value)} 
                disabled={disabled} 
                className={styles.select} 
                required
              >
                <option value="">Select Work Type</option>
                {workTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {subtypeOptions.length > 0 && (
              <div className={styles.field}>
                <label htmlFor={`subtype-${catIndex}-${workIndex}`}>
                  <i className="fas fa-tags" /> Subtype
                </label>
                <select 
                  id={`subtype-${catIndex}-${workIndex}`} 
                  value={sanitizedWorkItem.subtype} 
                  onChange={e => updateWorkItem('subtype', e.target.value)} 
                  disabled={disabled} 
                  className={styles.select}
                >
                  <option value="">Select Subtype</option>
                  {subtypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Measurement */}
          {sanitizedWorkItem.type && (
            <div className={styles.field}>
              <label htmlFor={`measurement-${catIndex}-${workIndex}`}>
                <i className="fas fa-ruler-combined" /> How to Measure *
              </label>
              <select 
                id={`measurement-${catIndex}-${workIndex}`} 
                value={sanitizedWorkItem.measurementType} 
                onChange={e => updateWorkItem('measurementType', e.target.value)} 
                disabled={disabled} 
                className={styles.select} 
                required
              >
                <option value="">Select Measurement Method</option>
                {availableMeasurementTypes.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label} ({t.unit})
                  </option>
                ))}
              </select>
              <small className={styles.helpText}>
                Choose the measurement method that best fits your work
              </small>
            </div>
          )}

          {/* Surfaces */}
          {sanitizedWorkItem.type && sanitizedWorkItem.measurementType && (
            <SurfaceManager 
              workItem={sanitizedWorkItem} 
              onChange={handleSurfaceUpdate} 
              disabled={disabled} 
              categoryKey={normalizedCategoryKey} 
              workType={sanitizedWorkItem.type} 
              catIndex={catIndex} 
              workIndex={workIndex} 
            />
          )}

          {/* Costs */}
          {sanitizedWorkItem.type && sanitizedWorkItem.measurementType && (
            <div className={styles.costInputsContainer}>
              <h4><i className="fas fa-dollar-sign" /> Cost Per Unit</h4>
              <div className={styles.costInputs}>
                <CostInput 
                  label="Material Cost" 
                  value={sanitizedWorkItem.materialCost} 
                  onChange={v => updateWorkItem('materialCost', v)} 
                  disabled={disabled} 
                  options={costOptions} 
                  field="materialCost" 
                  measurementType={sanitizedWorkItem.measurementType} 
                />
                <CostInput 
                  label="Labor Cost" 
                  value={sanitizedWorkItem.laborCost} 
                  onChange={v => updateWorkItem('laborCost', v)} 
                  disabled={disabled} 
                  options={costOptions} 
                  field="laborCost" 
                  measurementType={sanitizedWorkItem.measurementType} 
                />
              </div>
            </div>
          )}

          {/* Summary */}
          {calculationResults.canCalculate && showCostBreakdown && (
            <div className={styles.costDisplay}>
              <h4><i className="fas fa-calculator" /> Summary</h4>
              <div className={styles.costSummary}>
                <span className={styles.costItem}>
                  <i className="fas fa-cube" /> {calculationResults.totalUnits.toFixed(2)} {calculationResults.unitLabel}
                </span>
                <span className={styles.costItem}>
                  <i className="fas fa-box" /> ${calculationResults.totalMaterialCost.toFixed(2)}
                </span>
                <span className={styles.costItem}>
                  <i className="fas fa-hammer" /> ${calculationResults.totalLaborCost.toFixed(2)}
                </span>
                <span className={`${styles.costItem} ${styles.totalCost}`}>
                  <i className="fas fa-dollar-sign" /> ${calculationResults.totalCost.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Warnings */}
          {calculationResults.warnings.length > 0 && (
            <div className={styles.warningSection} role="alert">
              <h4><i className="fas fa-exclamation-triangle" /> Calculation Warnings:</h4>
              {calculationResults.warnings.map((w, i) => (
                <div key={i} className={styles.warningMessage}>
                  <i className="fas fa-info-circle" /> {w}
                </div>
              ))}
            </div>
          )}

          {/* Validation errors */}
          {validationErrorList.length > 0 && (
            <div className={styles.validationErrors} role="alert">
              <h4><i className="fas fa-exclamation-triangle" /> Please fix these issues:</h4>
              {validationErrorList.map((err, i) => (
                <div key={i} className={styles.errorMessage}>
                  <i className="fas fa-exclamation-circle" /> {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}