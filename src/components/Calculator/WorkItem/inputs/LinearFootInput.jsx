// src/components/Calculator/WorkItem/inputs/LinearFootInput.jsx
import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useCategories } from '../../../../context/CategoriesContext';
import styles from './LinearFootInput.module.css';
import commonStyles from '../../../../styles/common.module.css';

export default function LinearFootInput({
  catIndex,
  workIndex,
  surfIndex,
  surface,
  disabled = false,
  showRemove = false,
  categoryKey,
  workType,
  onError,
  minValue = 1,
  maxValue = 10000,
  step = 0.1,
  precision = 1,
}) {
  const { setCategories } = useCategories();
  const [inputValue, setInputValue] = useState('');
  const [hasError, setHasError] = useState(false);

  const linearFt = useMemo(() => {
    const value = surface?.linearFt;
    if (value === null || value === undefined) return minValue;
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(numValue) && numValue >= minValue ? numValue : minValue;
  }, [surface?.linearFt, minValue]);

  const displayValue = useMemo(() => {
    return inputValue || Number(linearFt).toFixed(precision);
  }, [inputValue, linearFt, precision]);

  const validateInput = useCallback((value) => {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return { isValid: false, error: 'Please enter a valid number' };
    }
    
    if (numValue < minValue) {
      return { isValid: false, error: `Value must be at least ${minValue}` };
    }
    
    if (numValue > maxValue) {
      return { isValid: false, error: `Value must be no more than ${maxValue}` };
    }
    
    return { isValid: true, error: null };
  }, [minValue, maxValue]);

  const updateSurface = useCallback((field, value) => {
    if (disabled) return;

    const validation = validateInput(value);
    setHasError(!validation.isValid);
    
    if (!validation.isValid) {
      onError?.(validation.error);
      return;
    }

    const parsedValue = parseFloat(value);
    
    try {
      setCategories((prev) => {
        if (!prev[catIndex]?.workItems?.[workIndex]?.surfaces?.[surfIndex]) {
          throw new Error('Invalid surface reference');
        }

        const newCategories = [...prev];
        const category = { ...newCategories[catIndex] };
        const workItems = [...category.workItems];
        const item = { ...workItems[workIndex] };
        const surfaces = [...item.surfaces];
        
        surfaces[surfIndex] = {
          ...surfaces[surfIndex],
          [field]: parsedValue,
        };
        
        item.surfaces = surfaces;
        workItems[workIndex] = item;
        category.workItems = workItems;
        newCategories[catIndex] = category;
        
        return newCategories;
      });
      
      onError?.(null);
    } catch (error) {
      console.error('Error updating surface:', error);
      onError?.('Failed to update surface data');
      setHasError(true);
    }
  }, [disabled, validateInput, setCategories, catIndex, workIndex, surfIndex, onError]);

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (hasError) {
      setHasError(false);
      onError?.(null);
    }
  }, [hasError, onError]);

  const handleInputBlur = useCallback(() => {
    const value = inputValue || displayValue;
    updateSurface('linearFt', value);
    setInputValue('');
  }, [inputValue, displayValue, updateSurface]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentValue = parseFloat(displayValue) || minValue;
      const increment = step;
      const newValue = e.key === 'ArrowUp' ? 
        currentValue + increment : 
        Math.max(minValue, currentValue - increment);
      
      updateSurface('linearFt', newValue.toString());
    }
  }, [disabled, displayValue, minValue, step, updateSurface]);

  const inputId = `linear-ft-${catIndex}-${workIndex}-${surfIndex}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={`${styles.linearFootInput} ${hasError ? styles.hasError : ''}`}>
      <div className={styles.field}>
        <label htmlFor={inputId} className={styles.label}>
          Linear Feet:
          <span className={styles.required} aria-label="required field">*</span>
        </label>
        
        <div className={`${styles.inputWrapper} ${commonStyles.inputWrapper} ${hasError ? styles.errorInput : ''}`}>
          <i 
            className={`fas fa-ruler ${commonStyles.inputIcon}`} 
            aria-hidden="true"
          ></i>
          
          <input
            id={inputId}
            type="number"
            step={step}
            min={minValue}
            max={maxValue}
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
            placeholder={`${minValue}.0`}
            disabled={disabled}
            aria-label={`Surface ${surfIndex + 1} linear feet`}
            aria-describedby={hasError ? errorId : undefined}
            aria-invalid={hasError}
            className={hasError ? styles.inputError : ''}
          />
          
          <span className={styles.unit} aria-label="unit">ft</span>
        </div>
        
        {hasError && (
          <div 
            id={errorId}
            className={styles.errorMessage}
            role="alert"
            aria-live="polite"
          >
            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
            Please enter a value between {minValue} and {maxValue}
          </div>
        )}
      </div>
    </div>
  );
}

LinearFootInput.propTypes = {
  catIndex: PropTypes.number.isRequired,
  workIndex: PropTypes.number.isRequired,
  surfIndex: PropTypes.number.isRequired,
  surface: PropTypes.shape({
    linearFt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    measurementType: PropTypes.string,
  }).isRequired,
  disabled: PropTypes.bool,
  showRemove: PropTypes.bool,
  categoryKey: PropTypes.string.isRequired,
  workType: PropTypes.string.isRequired,
  onError: PropTypes.func,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
  step: PropTypes.number,
  precision: PropTypes.number,
};

LinearFootInput.defaultProps = {
  disabled: false,
  showRemove: false,
  onError: null,
  minValue: 1,
  maxValue: 10000,
  step: 0.1,
  precision: 1,
};