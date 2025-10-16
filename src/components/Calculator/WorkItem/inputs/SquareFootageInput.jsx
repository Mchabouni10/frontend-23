// src/components/Calculator/WorkItem/inputs/SquareFootageInput.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useCategories } from '../../../../context/CategoriesContext';
import styles from './SquareFootageInput.module.css';
import commonStyles from '../../../../styles/common.module.css';
import { validateNumber } from '../../utils/validation';

const MIN_DIMENSION = 0.1;
const MAX_DIMENSION = 1000;
const DEFAULT_DIMENSION = 5;
const MIN_SQFT = 0.1;
const MAX_SQFT = 1000000;

export default function SquareFootageInput({
  catIndex,
  workIndex,
  surfIndex,
  surface,
  disabled = false,
  categoryKey,
  workType,
  onError,
  subtypeOptions = [],
  defaultSubtype,
}) {
  const { setCategories } = useCategories();
  const [widthInputValue, setWidthInputValue] = useState('');
  const [heightInputValue, setHeightInputValue] = useState('');
  const [sqftInputValue, setSqftInputValue] = useState('');
  // FIXED: Use manualSqft flag from surface if it exists, otherwise detect from data structure
  const [isManual, setIsManual] = useState(
    surface.manualSqft !== undefined 
      ? surface.manualSqft 
      : !!(surface.sqft && (!surface.width && !surface.height))
  );
  const [errors, setErrors] = useState({ width: null, height: null, sqft: null });
  const [selectedSubtype, setSelectedSubtype] = useState(surface.subtype || defaultSubtype || '');

  // FIXED: Only update input values, don't change isManual from external updates
  useEffect(() => {
    if (surface?.width !== undefined) setWidthInputValue(surface.width.toString());
    if (surface?.height !== undefined) setHeightInputValue(surface.height.toString());
    if (surface?.sqft !== undefined) setSqftInputValue(surface.sqft.toString());
    // FIXED: Only set isManual if manualSqft flag exists in surface
    if (surface?.manualSqft !== undefined) {
      setIsManual(surface.manualSqft);
    }
  }, [surface?.width, surface?.height, surface?.sqft, surface?.manualSqft]);

  const validateDimension = useCallback((value, field) => {
    const config = field === 'sqft' 
      ? { min: MIN_SQFT, max: MAX_SQFT, decimals: true }
      : { min: MIN_DIMENSION, max: MAX_DIMENSION, decimals: true };
    
    const validation = validateNumber(value, config);
    return {
      isValid: validation.isValid,
      message: validation.isValid ? null : validation.error.replace('Value', field.charAt(0).toUpperCase() + field.slice(1))
    };
  }, []);

  const updateSurfaceInContext = useCallback((updates, manualMode) => {
    if (disabled) return;

    try {
      setCategories(prevCategories => {
        if (!prevCategories?.[catIndex]?.workItems?.[workIndex]?.surfaces?.[surfIndex]) {
          throw new Error('Invalid category/workItem/surface path');
        }

        const newCategories = [...prevCategories];
        const newCategory = { ...newCategories[catIndex] };
        const newWorkItems = [...newCategory.workItems];
        const newItem = { ...newWorkItems[workIndex] };
        const newSurfaces = [...newItem.surfaces];
        
        const baseFields = {
          id: newSurfaces[surfIndex].id,
          name: newSurfaces[surfIndex].name,
          measurementType: 'sqft',
          subtype: selectedSubtype
        };

        // FIXED: Always set manualSqft flag so we know the mode
        newSurfaces[surfIndex] = manualMode ? {
          ...baseFields,
          sqft: updates.sqft,
          manualSqft: true
        } : {
          ...baseFields,
          width: updates.width,
          height: updates.height,
          sqft: updates.sqft,
          manualSqft: false
        };

        newItem.surfaces = newSurfaces;
        newWorkItems[workIndex] = newItem;
        newCategory.workItems = newWorkItems;
        newCategories[catIndex] = newCategory;
        
        return newCategories;
      });
    } catch (error) {
      console.error('Error updating surface:', error);
      onError?.(`Failed to update surface: ${error.message}`);
    }
  }, [catIndex, workIndex, surfIndex, setCategories, disabled, selectedSubtype, onError]);

  const handleDimensionChange = useCallback((field, value) => {
    if (!value) {
      setErrors(prev => ({ ...prev, [field]: null }));
      onError?.(null);
      return;
    }

    const validation = validateDimension(value, field);
    setErrors(prev => ({ ...prev, [field]: validation.message }));
    onError?.(validation.message);

    if (!validation.isValid) return;

    const parsedValue = parseFloat(value);
    if (isManual) {
      updateSurfaceInContext({ sqft: parsedValue }, true);
    } else {
      const currentSurface = {
        width: field === 'width' ? parsedValue : parseFloat(surface?.width) || DEFAULT_DIMENSION,
        height: field === 'height' ? parsedValue : parseFloat(surface?.height) || DEFAULT_DIMENSION
      };
      
      updateSurfaceInContext({
        width: currentSurface.width,
        height: currentSurface.height,
        sqft: parseFloat((currentSurface.width * currentSurface.height).toFixed(2))
      }, false);
    }
  }, [validateDimension, isManual, updateSurfaceInContext, surface?.width, surface?.height, onError]);

  // FIXED: When toggling, immediately update the surface with the correct structure
  const handleToggleChange = useCallback(() => {
    const newManualMode = !isManual;
    setIsManual(newManualMode);
    
    // Immediately update the surface structure to match the new mode
    if (newManualMode) {
      // Switching to manual mode - keep sqft, clear dimensions
      const currentSqft = parseFloat(surface?.sqft) || (parseFloat(surface?.width || 0) * parseFloat(surface?.height || 0)) || 25;
      updateSurfaceInContext({ sqft: currentSqft }, true);
    } else {
      // Switching to dimension mode - set default dimensions if needed
      const width = parseFloat(surface?.width) || DEFAULT_DIMENSION;
      const height = parseFloat(surface?.height) || DEFAULT_DIMENSION;
      const sqft = parseFloat((width * height).toFixed(2));
      updateSurfaceInContext({ width, height, sqft }, false);
    }
  }, [isManual, surface, updateSurfaceInContext]);

  const handleSubtypeChange = useCallback((e) => {
    const newSubtype = e.target.value;
    setSelectedSubtype(newSubtype);
    
    setCategories(prevCategories => {
      if (!prevCategories?.[catIndex]?.workItems?.[workIndex]?.surfaces?.[surfIndex]) {
        return prevCategories;
      }

      const newCategories = [...prevCategories];
      const newCategory = { ...newCategories[catIndex] };
      const newWorkItems = [...newCategory.workItems];
      const newItem = { ...newWorkItems[workIndex] };
      const newSurfaces = [...newItem.surfaces];
      
      newSurfaces[surfIndex] = { ...newSurfaces[surfIndex], subtype: newSubtype };
      newItem.surfaces = newSurfaces;
      newWorkItems[workIndex] = newItem;
      newCategory.workItems = newWorkItems;
      newCategories[catIndex] = newCategory;
      
      return newCategories;
    });
  }, [catIndex, workIndex, surfIndex, setCategories]);

  const handleInputChange = useCallback((setter) => (e) => setter(e.target.value), []);
  const handleBlur = useCallback((field, value) => () => {
    if (value) handleDimensionChange(field, value);
  }, [handleDimensionChange]);

  const currentWidth = useMemo(() => {
    const w = parseFloat(surface?.width);
    return !isNaN(w) && w >= MIN_DIMENSION ? w : DEFAULT_DIMENSION;
  }, [surface?.width]);

  const currentHeight = useMemo(() => {
    const h = parseFloat(surface?.height);
    return !isNaN(h) && h >= MIN_DIMENSION ? h : DEFAULT_DIMENSION;
  }, [surface?.height]);

  const currentSqft = useMemo(() => {
    const sqft = parseFloat(surface?.sqft);
    return !isNaN(sqft) && sqft >= MIN_SQFT ? sqft : (currentWidth * currentHeight);
  }, [surface?.sqft, currentWidth, currentHeight]);

  const widthDisplayValue = widthInputValue || currentWidth.toString();
  const heightDisplayValue = heightInputValue || currentHeight.toString();
  const sqftDisplayValue = sqftInputValue || currentSqft.toString();

  const inputProps = (field, value, errorId) => ({
    type: 'number',
    step: '0.1',
    min: field === 'sqft' ? MIN_SQFT : MIN_DIMENSION,
    max: field === 'sqft' ? MAX_SQFT : MAX_DIMENSION,
    value,
    onChange: handleInputChange(field === 'sqft' ? setSqftInputValue : field === 'width' ? setWidthInputValue : setHeightInputValue),
    onBlur: handleBlur(field, value),
    onKeyPress: (e) => e.key === 'Enter' && e.target.blur(),
    placeholder: (field === 'sqft' ? MIN_SQFT : MIN_DIMENSION).toString(),
    disabled,
    'aria-label': `Surface ${surfIndex + 1} ${field}`,
    'aria-describedby': errors[field] ? errorId : undefined,
    'aria-invalid': !!errors[field],
    className: `${styles.input} ${errors[field] ? styles.inputError : ''}`
  });

  return (
    <div className={styles.squareFootageInput}>
      {subtypeOptions.length > 0 && (
        <div className={styles.field}>
          <label htmlFor={`subtype-${catIndex}-${workIndex}-${surfIndex}`} className={styles.label}>
            Subtype:
          </label>
          <select
            id={`subtype-${catIndex}-${workIndex}-${surfIndex}`}
            value={selectedSubtype}
            onChange={handleSubtypeChange}
            disabled={disabled}
            className={`${styles.select} ${styles.input}`}
          >
            <option value="">Select Subtype</option>
            {subtypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.toggleContainer}>
        <div className={styles.toggleSwitch}>
          <input
            type="checkbox"
            checked={isManual}
            onChange={handleToggleChange}
            disabled={disabled}
            id={`toggle-${catIndex}-${workIndex}-${surfIndex}`}
            className={styles.toggleInput}
          />
          <label
            htmlFor={`toggle-${catIndex}-${workIndex}-${surfIndex}`}
            className={styles.toggleLabel}
          >
            <span className={styles.toggleSlider}></span>
            <span className={styles.toggleText}>Enter square footage directly</span>
          </label>
        </div>
      </div>

      {isManual ? (
        <div className={styles.field}>
          <label htmlFor={`sqft-${catIndex}-${workIndex}-${surfIndex}`} className={styles.label}>
            Square Feet:
            <span className={styles.required} aria-label="required field">*</span>
          </label>
          <div className={`${styles.inputWrapper} ${commonStyles.inputWrapper} ${errors.sqft ? styles.errorInput : ''}`}>
            <i className={`fas fa-ruler-combined ${commonStyles.inputIcon}`} aria-hidden="true"></i>
            <input
              id={`sqft-${catIndex}-${workIndex}-${surfIndex}`}
              {...inputProps('sqft', sqftDisplayValue, `sqft-error-${catIndex}-${workIndex}-${surfIndex}`)}
            />
            <span className={styles.unit} aria-label="unit">sqft</span>
          </div>
          {errors.sqft && (
            <div id={`sqft-error-${catIndex}-${workIndex}-${surfIndex}`} className={styles.errorMessage} role="alert" aria-live="polite">
              <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
              {errors.sqft}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.dimensions}>
          <div className={styles.field}>
            <label htmlFor={`width-${catIndex}-${workIndex}-${surfIndex}`} className={styles.label}>
              Width:
              <span className={styles.required} aria-label="required field">*</span>
            </label>
            <div className={`${styles.inputWrapper} ${commonStyles.inputWrapper} ${errors.width ? styles.errorInput : ''}`}>
              <i className={`fas fa-ruler-horizontal ${commonStyles.inputIcon}`} aria-hidden="true"></i>
              <input
                id={`width-${catIndex}-${workIndex}-${surfIndex}`}
                {...inputProps('width', widthDisplayValue, `width-error-${catIndex}-${workIndex}-${surfIndex}`)}
              />
              <span className={styles.unit} aria-label="unit">ft</span>
            </div>
            {errors.width && (
              <div id={`width-error-${catIndex}-${workIndex}-${surfIndex}`} className={styles.errorMessage} role="alert" aria-live="polite">
                <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                {errors.width}
              </div>
            )}
          </div>

          <span className={styles.multiply}>×</span>

          <div className={styles.field}>
            <label htmlFor={`height-${catIndex}-${workIndex}-${surfIndex}`} className={styles.label}>
              Height:
              <span className={styles.required} aria-label="required field">*</span>
            </label>
            <div className={`${styles.inputWrapper} ${commonStyles.inputWrapper} ${errors.height ? styles.errorInput : ''}`}>
              <i className={`fas fa-ruler-vertical ${commonStyles.inputIcon}`} aria-hidden="true"></i>
              <input
                id={`height-${catIndex}-${workIndex}-${surfIndex}`}
                {...inputProps('height', heightDisplayValue, `height-error-${catIndex}-${workIndex}-${surfIndex}`)}
              />
              <span className={styles.unit} aria-label="unit">ft</span>
            </div>
            {errors.height && (
              <div id={`height-error-${catIndex}-${workIndex}-${surfIndex}`} className={styles.errorMessage} role="alert" aria-live="polite">
                <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                {errors.height}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

SquareFootageInput.propTypes = {
  catIndex: PropTypes.number.isRequired,
  workIndex: PropTypes.number.isRequired,
  surfIndex: PropTypes.number.isRequired,
  surface: PropTypes.shape({
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sqft: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    measurementType: PropTypes.string,
    subtype: PropTypes.string,
    manualSqft: PropTypes.bool,
  }).isRequired,
  disabled: PropTypes.bool,
  categoryKey: PropTypes.string.isRequired,
  workType: PropTypes.string.isRequired,
  onError: PropTypes.func,
  subtypeOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  defaultSubtype: PropTypes.string,
};

SquareFootageInput.defaultProps = {
  disabled: false,
  onError: null,
  subtypeOptions: [],
  defaultSubtype: '',
};