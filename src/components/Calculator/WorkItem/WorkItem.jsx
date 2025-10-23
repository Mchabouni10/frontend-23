// src/components/Calculator/WorkItem/WorkItem.jsx
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { useWorkType } from '../../../context/WorkTypeContext';
import { useSettings } from '../../../context/SettingsContext';
import { CalculatorEngine } from '../engine/CalculatorEngine';
import SurfaceManager from './SurfaceManager';
import CostInput from './CostInput';
import styles from './WorkItem.module.css';
import ErrorBoundary from '../../ErrorBoundary';

const DEFAULT_COST_OPTIONS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '15', '20', '25', '30', '35', '40', '45', '50',
  '60', '70', '80', '90', '100',
  '150', '200', '250', '300', '400', '500',
  '750', '1000', '1500', '2000',
  '2500', '3000', '4000', '5000',
  'Custom'
];

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
  if (!workItem || typeof workItem !== 'object') {
    return (
      <div className={styles.workItem}>
        <div className={styles.errorMessage}>Invalid work item data</div>
      </div>
    );
  }

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
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
  } = useWorkType();

  const { settings } = useSettings();
  const [isExpanded, setIsExpanded] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  
  const prevWorkItemRef = useRef(workItem);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // CRITICAL DEBUG: Log the incoming workItem to see if customWorkTypeName is present
  useEffect(() => {
    console.log('WorkItem received props:', {
      catIndex,
      workIndex,
      name: workItem.name,
      type: workItem.type,
      customWorkTypeName: workItem.customWorkTypeName,
      hasCustomName: !!workItem.customWorkTypeName,
    });
  }, [workItem, catIndex, workIndex]);

  const calculatorEngine = useMemo(() => {
    try {
      if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
        console.warn('Calculator engine dependencies not ready');
        return null;
      }
      return new CalculatorEngine([], settingsRef.current || {}, {
        getMeasurementType,
        isValidSubtype,
        getWorkTypeDetails,
      });
    } catch (err) {
      console.warn('Calculator engine init error:', err.message);
      return null;
    }
  }, [getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  const normalizedCategoryKey = useMemo(() => {
    if (!categoryKey) return '';
    if (categoryKey.startsWith('custom_')) return categoryKey;
    return categoryKey.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '');
  }, [categoryKey]);

  const isCustomCategory = useMemo(() => {
    return normalizedCategoryKey.startsWith('custom_');
  }, [normalizedCategoryKey]);

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

  const derivedName = useMemo(() => {
    if (workItem.name && workItem.name !== 'New Work Item' && workItem.name !== 'Unnamed Work Item') {
        return workItem.name;
    }

    if (isCustomCategory && workItem.type === 'custom-work-type' && workItem.customWorkTypeName) {
        const subtypeLabel = subtypeOptions.find(opt => opt.value === workItem.subtype)?.label;
        return subtypeLabel ? `${workItem.customWorkTypeName} (${subtypeLabel})` : workItem.customWorkTypeName;
    }
    
    const workTypeLabel = workTypeOptions.find(opt => opt.value === workItem.type)?.label;
    const subtypeLabel = subtypeOptions.find(opt => opt.value === workItem.subtype)?.label;

    if (workTypeLabel) {
        return subtypeLabel ? `${workTypeLabel} (${subtypeLabel})` : workTypeLabel;
    }
    
    return 'Unnamed Work Item';
  }, [workItem.name, workItem.type, workItem.subtype, workItem.customWorkTypeName, workTypeOptions, subtypeOptions, isCustomCategory]);

  const updateWorkItem = useCallback((field, value) => {
    if (disabled) return;
    
    // CRITICAL FIX: Always start with ALL fields from workItem
    const updatedItem = {
      ...workItem, // Spread FIRST to get all existing fields
      categoryKey: normalizedCategoryKey,
    };

    console.log('🔧 updateWorkItem called:', { 
      field, 
      value, 
      beforeUpdate: {
        type: updatedItem.type,
        customWorkTypeName: updatedItem.customWorkTypeName
      }
    });

    // Now update the specific field
    if (field === 'type') {
      updatedItem.type = value;
      if (value !== 'custom-work-type') {
        // Switching away from custom work type - clear custom name
        updatedItem.customWorkTypeName = '';
        updatedItem.subtype = getDefaultSubtype(value) || '';
        updatedItem.measurementType = getMeasurementType(normalizedCategoryKey, value);
      } else {
        // Switching TO custom work type - keep existing customWorkTypeName if it exists
        updatedItem.subtype = '';
        updatedItem.measurementType = '';
      }
      updatedItem.surfaces = [];
      setValidationErrors({});
    } else if (field === 'customWorkTypeName') {
      updatedItem.customWorkTypeName = value;
    } else if (field === 'measurementType') {
      updatedItem.measurementType = value;
      updatedItem.surfaces = [];
    } else if (field === 'subtype') {
      updatedItem.subtype = value;
    } else if (field === 'surfaces') {
      updatedItem.surfaces = value;
    } else if (field === 'materialCost' || field === 'laborCost') {
      updatedItem[field] = typeof value === 'number' ? value : parseFloat(value) || 0;
    } else if (field === 'description') {
      updatedItem.description = value;
    } else {
      updatedItem[field] = value;
    }

    // Update the name if needed
    if (field === 'type' || field === 'subtype' || field === 'customWorkTypeName') {
      if (updatedItem.type === 'custom-work-type' && updatedItem.customWorkTypeName) {
        const stLabel = subtypeOptions.find(opt => opt.value === updatedItem.subtype)?.label;
        updatedItem.name = stLabel ? `${updatedItem.customWorkTypeName} (${stLabel})` : updatedItem.customWorkTypeName;
      } else {
        const wtLabel = workTypeOptions.find(opt => opt.value === updatedItem.type)?.label;
        const stLabel = subtypeOptions.find(opt => opt.value === updatedItem.subtype)?.label;
        updatedItem.name = wtLabel ? (stLabel ? `${wtLabel} (${stLabel})` : wtLabel) : updatedItem.name;
      }
    }

    console.log('✅ After update:', {
      name: updatedItem.name,
      type: updatedItem.type,
      customWorkTypeName: updatedItem.customWorkTypeName,
    });

    prevWorkItemRef.current = updatedItem;
    onItemChange?.(catIndex, workIndex, updatedItem);
  }, [
    disabled, 
    catIndex, 
    workIndex, 
    workItem, 
    normalizedCategoryKey,
    getDefaultSubtype, 
    getMeasurementType, 
    onItemChange, 
    workTypeOptions, 
    subtypeOptions
  ]);

  const handleRemoveWorkItem = useCallback(() => {
    if (disabled) return;
    onItemRemove?.(catIndex, workIndex, workItem);
  }, [disabled, catIndex, workIndex, workItem, onItemRemove]);

  const handleSurfaceUpdate = useCallback(updated => {
    updateWorkItem('surfaces', updated.surfaces);
  }, [updateWorkItem]);

  const sanitizedWorkItem = useMemo(() => {
    const sanitized = {
      ...workItem,
      categoryKey: normalizedCategoryKey,
      materialCost: ensureNumber(workItem.materialCost, 0),
      laborCost: ensureNumber(workItem.laborCost, 0),
      type: workItem.type || '',
      subtype: workItem.subtype || '',
      measurementType: workItem.measurementType || '',
      name: derivedName,
      surfaces: Array.isArray(workItem.surfaces) ? workItem.surfaces : [],
      description: workItem.description || '',
      customWorkTypeName: workItem.customWorkTypeName || '',
    };
    
    console.log('📦 Sanitized work item:', {
      name: sanitized.name,
      type: sanitized.type,
      customWorkTypeName: sanitized.customWorkTypeName,
      hasCustomName: !!sanitized.customWorkTypeName
    });
    
    return sanitized;
  }, [workItem, normalizedCategoryKey, derivedName]);

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
                {isCustomCategory && (
                  <option value="custom-work-type">Custom Work Type</option>
                )}
              </select>
            </div>
            
            {isCustomCategory && sanitizedWorkItem.type === 'custom-work-type' && (
              <div className={styles.field}>
                <label htmlFor={`custom-work-name-${catIndex}-${workIndex}`}>
                  <i className="fas fa-pencil-alt" /> Custom Work Name *
                </label>
                <input
                  id={`custom-work-name-${catIndex}-${workIndex}`}
                  type="text"
                  value={sanitizedWorkItem.customWorkTypeName || ''}
                  onChange={e => updateWorkItem('customWorkTypeName', e.target.value)}
                  disabled={disabled}
                  className={styles.input}
                  placeholder="Enter custom work type name"
                  required
                />
              </div>
            )}
            
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

          {sanitizedWorkItem.type && (sanitizedWorkItem.type !== 'custom-work-type' || sanitizedWorkItem.customWorkTypeName) && (
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

          {sanitizedWorkItem.type && sanitizedWorkItem.measurementType && (sanitizedWorkItem.type !== 'custom-work-type' || sanitizedWorkItem.customWorkTypeName) && (
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

          {sanitizedWorkItem.type && sanitizedWorkItem.measurementType && (sanitizedWorkItem.type !== 'custom-work-type' || sanitizedWorkItem.customWorkTypeName) && (
            <>
              <div className={styles.field}>
                <label htmlFor={`description-${catIndex}-${workIndex}`}>
                  <i className="fas fa-file-alt" /> Work Description
                </label>
                <textarea
                  id={`description-${catIndex}-${workIndex}`}
                  className={styles.textarea}
                  value={workItem.description || ''}
                  onChange={e => updateWorkItem('description', e.target.value)}
                  disabled={disabled}
                  placeholder="Describe the specific work to be done..."
                  rows="3"
                />
                <small className={styles.helpText}>
                  Add details about the specific work you'll be performing
                </small>
              </div>

              <div className={styles.costInputsContainer}>
                <h4><i className="fas fa-dollar-sign" /> Cost Per Unit</h4>
                <div className={styles.costInputs}>
                  <CostInput 
                    label="Material Cost" 
                    value={workItem.materialCost}
                    onChange={v => updateWorkItem('materialCost', v)} 
                    disabled={disabled} 
                    options={costOptions} 
                    field="materialCost" 
                    measurementType={sanitizedWorkItem.measurementType} 
                  />
                  <CostInput 
                    label="Labor Cost" 
                    value={workItem.laborCost}
                    onChange={v => updateWorkItem('laborCost', v)} 
                    disabled={disabled} 
                    options={costOptions} 
                    field="laborCost" 
                    measurementType={sanitizedWorkItem.measurementType} 
                  />
                </div>
              </div>
            </>
          )}

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