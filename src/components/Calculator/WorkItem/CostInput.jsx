// src/components/Calculator/WorkItem/CostInput.jsx
import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './CostInput.module.css';
import commonStyles from '../../../styles/common.module.css';
import { MEASUREMENT_TYPES } from '../../../context/WorkTypeContext';

export default function CostInput({ 
  label, 
  value, 
  onChange, 
  disabled = false, 
  options, 
  field, 
  measurementType,
  onError 
}) {
  const numericValue = useMemo(() => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(parsed) ? 0 : parsed;
  }, [value]);

  const [isCustom, setIsCustom] = useState(() => {
    return !options.some(opt => {
      if (opt === 'Custom') return false;
      const optValue = parseFloat(opt);
      return !isNaN(optValue) && Math.abs(optValue - numericValue) < 0.001;
    });
  });

  const [customInputValue, setCustomInputValue] = useState('');
  
  const unitLabel = useMemo(() => {
    if (!measurementType) return '';
    
    const type = measurementType.toLowerCase();
    
    if (type.includes('square') || type === 'sqft') {
      return '/sqft';
    } else if (type.includes('linear') || type.includes('foot')) {
      return '/ft';
    } else if (type.includes('unit') || type.includes('piece') || type.includes('each')) {
      return '/unit';
    }
    
    switch (measurementType) {
      case MEASUREMENT_TYPES.SQUARE_FOOT:
        return '/sqft';
      case MEASUREMENT_TYPES.LINEAR_FOOT:
        return '/ft';
      case MEASUREMENT_TYPES.BY_UNIT:
        return '/unit';
      default:
        return '';
    }
  }, [measurementType]);

  const validateCost = useCallback((inputValue) => {
    if (inputValue === null || inputValue === undefined || inputValue === '') {
      return { isValid: true, error: null, value: 0 };
    }
    
    const numValue = typeof inputValue === 'string' ? parseFloat(inputValue) : inputValue;
    
    if (isNaN(numValue)) {
      return { isValid: false, error: 'Please enter a valid number', value: 0 };
    }
    
    if (numValue < 0) {
      return { isValid: false, error: 'Cost cannot be negative', value: 0 };
    }
    
    if (numValue > 999999) {
      return { isValid: false, error: 'Cost must be less than $999,999', value: numValue };
    }
    
    return { isValid: true, error: null, value: numValue };
  }, []);

  const handleSelectChange = useCallback((selected) => {
    if (selected === 'Custom') {
      setIsCustom(true);
      setCustomInputValue(numericValue > 0 ? numericValue.toString() : '');
      onError?.(null);
    } else {
      const validation = validateCost(selected);
      if (validation.isValid) {
        setIsCustom(false);
        setCustomInputValue('');
        onChange(validation.value);
        onError?.(null);
      } else {
        onError?.(validation.error);
      }
    }
  }, [numericValue, onChange, validateCost, onError]);

  const handleCustomInputChange = useCallback((e) => {
    const inputValue = e.target.value;
    setCustomInputValue(inputValue); // Always update local state
    
    if (inputValue === '') {
      onChange(0);
      onError?.(null);
      return;
    }
    
    const validation = validateCost(inputValue);
    
    if (validation.isValid) {
      onChange(validation.value);
      onError?.(null);
    } else {
      onError?.(validation.error);
    }
  }, [onChange, validateCost, onError]);

  const handleCustomInputBlur = useCallback((e) => {
    const inputValue = e.target.value;
    
    if (inputValue === '') {
      onChange(0);
      setCustomInputValue('');
      return;
    }
    
    const validation = validateCost(inputValue);
    if (validation.isValid) {
      onChange(validation.value);
      setCustomInputValue(validation.value.toString());
      
      // Check if final value matches a preset and switch modes
      const matchesOption = options.some(opt => {
        if (opt === 'Custom') return false;
        const optValue = parseFloat(opt);
        return !isNaN(optValue) && Math.abs(optValue - validation.value) < 0.001;
      });
      if (matchesOption) {
        setIsCustom(false);
        setCustomInputValue('');
      }
    } else {
      setCustomInputValue(numericValue.toString());
    }
  }, [onChange, validateCost, numericValue, options]);

  React.useEffect(() => {
    const matchesOption = options.some(opt => {
      if (opt === 'Custom') return false;
      const optValue = parseFloat(opt);
      return !isNaN(optValue) && Math.abs(optValue - numericValue) < 0.001;
    });
    
    // Only switch TO custom if needed; no auto-switch OFF during external changes
    if (!matchesOption && !isCustom && numericValue !== 0) {
      setIsCustom(true);
      setCustomInputValue(numericValue.toString());
    }
  }, [numericValue, options, isCustom]);

  const selectValue = useMemo(() => {
    if (isCustom) return 'Custom';
    
    const matchingOption = options.find(opt => {
      if (opt === 'Custom') return false;
      const optValue = parseFloat(opt);
      return !isNaN(optValue) && Math.abs(optValue - numericValue) < 0.001;
    });
    
    return matchingOption || 'Custom';
  }, [isCustom, options, numericValue]);

  const inputId = `cost-input-${field}`;
  const selectId = `cost-select-${field}`;

  return (
    <div className={styles.costInput}>
      <label htmlFor={selectId} className={styles.label}>
        {label} {unitLabel}
        <span className={styles.required} aria-label="required field">*</span>
      </label>
      
      <div className={styles.inputGroup}>
        <select
          id={selectId}
          value={selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          disabled={disabled}
          aria-label={`${field} selection`}
          className={styles.select}
        >
          {options.filter(opt => opt !== 'Custom').map((option) => (
            <option key={option} value={option}>
              ${option}
            </option>
          ))}
          <option value="Custom">Custom</option>
        </select>
        
        <div className={`${styles.inputWrapper} ${commonStyles.inputWrapper || ''}`}>
          <i className={`fas fa-dollar-sign ${commonStyles.inputIcon || styles.inputIcon}`} aria-hidden="true"></i>
          <input
            id={inputId}
            type="number"
            step="0.01"
            min="0"
            max="999999"
            value={isCustom ? customInputValue : numericValue}
            onChange={handleCustomInputChange}
            onBlur={handleCustomInputBlur}
            placeholder="0.00"
            disabled={disabled || !isCustom}
            aria-label={`${field} ${unitLabel}`}
            className={!isCustom ? styles.disabledInput : ''}
          />
        </div>
      </div>
    </div>
  );
}

CostInput.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  field: PropTypes.string.isRequired,
  measurementType: PropTypes.string,
  onError: PropTypes.func,
};