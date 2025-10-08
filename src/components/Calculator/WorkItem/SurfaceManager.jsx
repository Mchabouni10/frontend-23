// src/components/Calculator/SurfaceManager/SurfaceManager.jsx
import { useEffect, useCallback, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './SurfaceManager.module.css';
import SquareFootageInput from './inputs/SquareFootageInput';
import LinearFootInput from './inputs/LinearFootInput';
import ByUnitInput from './inputs/ByUnitInput';
import { 
  MEASUREMENT_TYPES, 
  normalizeMeasurementType,
  getMeasurementTypeUnit 
} from '../../../constants/measurementTypes';

// Validate surface object structure
const validateSurface = (surface, measurementType) => {
  if (!surface || typeof surface !== 'object') {
    return { isValid: false, error: 'Surface must be an object' };
  }

  // FIXED: Use normalized measurement type
  const normalizedType = normalizeMeasurementType(measurementType);
  
  if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) {
    const hasValidDimensions = (
      (typeof surface.width === 'number' && surface.width >= 0 && 
       typeof surface.height === 'number' && surface.height >= 0) ||
      (typeof surface.sqft === 'number' && surface.sqft >= 0)
    );
    if (!hasValidDimensions) {
      return { isValid: false, error: 'Square foot surface must have valid width/height or sqft value' };
    }
  } else if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
    if (typeof surface.linearFt !== 'number' || surface.linearFt < 0) {
      return { isValid: false, error: 'Linear foot surface must have valid linearFt value' };
    }
  } else if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
    if (typeof surface.units !== 'number' || surface.units < 0) {
      return { isValid: false, error: 'Unit surface must have valid units value' };
    }
  }

  return { isValid: true, error: null };
};

const getSurfaceName = (measurementType, index) => {
  const normalizedType = normalizeMeasurementType(measurementType);
  if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
    return `Unit ${index}`;
  } else if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
    return `Linear Section ${index}`;
  } else {
    return `Surface ${index}`;
  }
};

// FIXED: Create clean surface with normalized measurement type
const createCleanSurface = (measurementType, index, existingSurface = {}) => {
  const normalizedType = normalizeMeasurementType(measurementType);
  const surfaceId = existingSurface.id || `surface_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const safeName = (typeof existingSurface.name === 'string')
    ? existingSurface.name
    : getSurfaceName(normalizedType, index);

  const safeSubtype = (typeof existingSurface.subtype === 'string')
    ? existingSurface.subtype
    : '';

  const baseSurface = {
    id: surfaceId,
    name: safeName,
    measurementType: normalizedType, // FIXED: Store normalized type
    subtype: safeSubtype
  };

  if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) {
    const width = typeof existingSurface.width === 'number' ? existingSurface.width : 5;
    const height = typeof existingSurface.height === 'number' ? existingSurface.height : 5;
    const sqft = typeof existingSurface.sqft === 'number' ? existingSurface.sqft : (width * height);
    
    return { ...baseSurface, width, height, sqft };
  } else if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
    return { ...baseSurface, linearFt: typeof existingSurface.linearFt === 'number' ? existingSurface.linearFt : 10 };
  } else if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
    return { ...baseSurface, units: typeof existingSurface.units === 'number' ? existingSurface.units : 1 };
  }

  return { ...baseSurface, width: 5, height: 5, sqft: 25 };
};

export default function SurfaceManager({ 
  workItem, 
  onChange, 
  disabled = false, 
  onError, 
  categoryKey = '', 
  workType = '',
  catIndex = 0,
  workIndex = 0
}) {
  const [validationErrors, setValidationErrors] = useState({});

  const surfaces = useMemo(() => Array.isArray(workItem.surfaces) ? workItem.surfaces : [], [workItem.surfaces]);

  // FIXED: Sanitize with normalized measurement types
  const sanitizeSurfaces = useCallback((surfaces, measurementType) => {
    if (!Array.isArray(surfaces)) {
      console.warn('Surfaces is not an array, creating empty array');
      return [];
    }

    const normalizedType = normalizeMeasurementType(measurementType);
    const sanitizedSurfaces = [];
    const errors = {};

    surfaces.forEach((surface, index) => {
      try {
        const cleanSurface = createCleanSurface(normalizedType, index + 1, surface);
        const validation = validateSurface(cleanSurface, normalizedType);
        if (validation.isValid) {
          sanitizedSurfaces.push(cleanSurface);
        } else {
          console.warn(`Surface ${index + 1} validation failed:`, validation.error);
          errors[index] = validation.error;
          sanitizedSurfaces.push(createCleanSurface(normalizedType, index + 1));
        }
      } catch (error) {
        console.error(`Error processing surface ${index + 1}:`, error);
        errors[index] = error.message;
        sanitizedSurfaces.push(createCleanSurface(normalizedType, index + 1));
      }
    });

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0 && onError) {
      onError(`Surface validation errors: ${Object.values(errors).join('; ')}`);
    }

    return sanitizedSurfaces;
  }, [onError]);

  // Only sanitize existing surfaces
  useEffect(() => {
    if (!workItem || !workItem.measurementType || disabled) return;

    try {
      const currentSurfaces = Array.isArray(workItem.surfaces) ? workItem.surfaces : [];
      if (currentSurfaces.length > 0) {
        const sanitizedSurfaces = sanitizeSurfaces(currentSurfaces, workItem.measurementType);
        if (JSON.stringify(sanitizedSurfaces) !== JSON.stringify(currentSurfaces)) {
          const updatedWorkItem = { ...workItem, surfaces: sanitizedSurfaces };
          onChange(updatedWorkItem);
        }
      }
    } catch (error) {
      console.error('Error in SurfaceManager useEffect:', error);
      onError?.(`Failed to initialize surfaces: ${error.message}`);
    }
  }, [workItem, disabled, sanitizeSurfaces, onChange, onError]);

  // FIXED: Use helper function from constants
  const getMeasurementUnit = useCallback(() => {
    return getMeasurementTypeUnit(workItem.measurementType);
  }, [workItem.measurementType]);

  const getAddButtonText = useCallback((measurementType) => {
    const normalizedType = normalizeMeasurementType(measurementType);
    if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) return 'Add Surface';
    if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) return 'Add Linear Section';
    if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) return 'Add Unit';
    return 'Add Item';
  }, []);

  const addSurface = useCallback(() => {
    if (disabled || surfaces.length >= 50) return;

    try {
      const newSurface = createCleanSurface(workItem.measurementType, surfaces.length + 1);
      const updatedSurfaces = [...surfaces, newSurface];
      const updatedWorkItem = { ...workItem, surfaces: updatedSurfaces };
      onChange(updatedWorkItem);
      onError?.(null);
    } catch (error) {
      console.error('Error adding surface:', error);
      onError?.(`Failed to add surface: ${error.message}`);
    }
  }, [disabled, surfaces, workItem, onChange, onError]);

  const removeSurface = useCallback((indexToRemove) => {
    if (disabled || indexToRemove < 0 || indexToRemove >= surfaces.length) return;

    if (surfaces.length === 1) {
      const confirmRemove = window.confirm(
        `This will remove the last ${getMeasurementUnit().toLowerCase()}. Are you sure? You can always add it back.`
      );
      if (!confirmRemove) return;
    }

    try {
      const updatedSurfaces = surfaces.filter((_, index) => index !== indexToRemove);
      
      const reindexedSurfaces = updatedSurfaces.map((surface, index) => ({
        ...surface,
        name: surface.name || getSurfaceName(workItem.measurementType, index + 1)
      }));

      const updatedWorkItem = { ...workItem, surfaces: reindexedSurfaces };
      onChange(updatedWorkItem);

      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[indexToRemove];
        return newErrors;
      });

      onError?.(null);
    } catch (error) {
      console.error('Error removing surface:', error);
      onError?.(`Failed to remove surface: ${error.message}`);
    }
  }, [disabled, surfaces, workItem, onChange, onError, getMeasurementUnit]);

  const headerInfo = useMemo(() => {
    const normalizedType = normalizeMeasurementType(workItem.measurementType);
    if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) {
      return { 
        text: 'Surfaces', 
        emptyText: 'No surfaces added yet. Add a surface to start.', 
        icon: 'fas fa-ruler-combined', 
        emptyIcon: 'fas fa-ruler' 
      };
    }
    if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
      return { 
        text: 'Linear Sections', 
        emptyText: 'No linear sections added yet. Add a section to start.', 
        icon: 'fas fa-ruler-horizontal', 
        emptyIcon: 'fas fa-ruler-horizontal' 
      };
    }
    if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
      return { 
        text: 'Units', 
        emptyText: 'No units added yet. Add a unit to start.', 
        icon: 'fas fa-cube', 
        emptyIcon: 'fas fa-cube' 
      };
    }
    return { 
      text: 'Items', 
      emptyText: 'No items added yet. Add an item to start.', 
      icon: 'fas fa-ruler-combined', 
      emptyIcon: 'fas fa-ruler' 
    };
  }, [workItem.measurementType]);

  const renderSurfaceInputs = useCallback((surface, index) => {
    const validation = validateSurface(surface, workItem.measurementType);
    if (!validation.isValid) {
      return (
        <div className={styles.errorState}>
          <i className="fas fa-exclamation-triangle"></i>
          <span>Surface data error: {validation.error}</span>
        </div>
      );
    }

    const normalizedType = normalizeMeasurementType(workItem.measurementType);
    if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) {
      return <SquareFootageInput 
        catIndex={catIndex} 
        workIndex={workIndex} 
        surfIndex={index} 
        surface={surface} 
        disabled={disabled} 
        categoryKey={categoryKey} 
        workType={workType} 
        onError={onError} 
      />;
    }
    if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
      return <LinearFootInput 
        catIndex={catIndex} 
        workIndex={workIndex} 
        surfIndex={index} 
        surface={surface} 
        disabled={disabled} 
        categoryKey={categoryKey} 
        workType={workType} 
        onError={onError} 
      />;
    }
    if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
      return <ByUnitInput 
        catIndex={catIndex} 
        workIndex={workIndex} 
        surfIndex={index} 
        surface={surface} 
        disabled={disabled} 
        categoryKey={categoryKey} 
        workType={workType} 
        onError={onError} 
      />;
    }
    return (
      <div className={styles.errorState}>
        <i className="fas fa-question-circle"></i>
        <span>Unknown measurement type: {normalizedType}</span>
      </div>
    );
  }, [workItem.measurementType, catIndex, workIndex, disabled, categoryKey, workType, onError]);

  const getTotalUnits = useCallback(() => {
    try {
      return surfaces.reduce((total, surface) => {
        if (!surface) return total;
        const normalizedType = normalizeMeasurementType(workItem.measurementType);
        if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) {
          return total + (parseFloat(surface.sqft) || (parseFloat(surface.width || 0) * parseFloat(surface.height || 0)));
        }
        if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
          return total + (parseFloat(surface.linearFt) || 0);
        }
        if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
          return total + (parseInt(surface.units) || 0);
        }
        return total;
      }, 0);
    } catch {
      return 0;
    }
  }, [surfaces, workItem.measurementType]);

  return (
    <div className={styles.surfaceManager}>
      {Object.keys(validationErrors).length > 0 && (
        <div className={styles.validationWarning}>
          <i className="fas fa-exclamation-triangle"></i>
          <span>Some surfaces had validation issues and were auto-corrected</span>
        </div>
      )}

      <div className={styles.header}>
        <h4 className={styles.title}>
          <i className={headerInfo.icon}></i> 
          {headerInfo.text} ({surfaces.length}/50)
          {surfaces.length > 0 && (
            <span className={styles.totalUnits}>
              Total: {getTotalUnits().toFixed(2)} {getMeasurementUnit()}
            </span>
          )}
        </h4>
      </div>

      {surfaces.length === 0 && (
        <div className={styles.emptyState}>
          <i className={headerInfo.emptyIcon}></i>
          <p>{headerInfo.emptyText}</p>
        </div>
      )}

      <div className={styles.surfaceList}>
        {surfaces.map((surface, index) => (
          <div key={surface.id || index} className={styles.surfaceItem}>
            <div className={styles.surfaceHeader}>
              <input
                type="text"
                value={surface.name || getSurfaceName(workItem.measurementType, index + 1)}
                onChange={(e) => {
                  const updatedSurfaces = [...surfaces];
                  updatedSurfaces[index] = { ...updatedSurfaces[index], name: e.target.value };
                  onChange({ ...workItem, surfaces: updatedSurfaces });
                }}
                disabled={disabled}
                className={`${styles.surfaceName} ${styles.input}`}
                placeholder={getSurfaceName(workItem.measurementType, index + 1)}
              />
              {!disabled && (
                <button 
                  onClick={() => removeSurface(index)} 
                  className={`${styles.removeButton} ${styles.button} ${styles['button--error']}`}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
            <div className={styles.surfaceContent}>
              {renderSurfaceInputs(surface, index)}
            </div>
          </div>
        ))}
      </div>

      {!disabled && surfaces.length < 50 && (
        <div className={styles.addButtons}>
          <button 
            onClick={addSurface} 
            className={`${styles.addButton} ${styles.button} ${styles['button--secondary']}`}
          >
            <i className="fas fa-plus"></i> {getAddButtonText(workItem.measurementType)}
          </button>
        </div>
      )}
    </div>
  );
}

SurfaceManager.propTypes = {
  workItem: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  onError: PropTypes.func,
  categoryKey: PropTypes.string,
  workType: PropTypes.string,
  catIndex: PropTypes.number,
  workIndex: PropTypes.number,
};

SurfaceManager.defaultProps = {
  disabled: false,
  onError: null,
  categoryKey: '',
  workType: '',
  catIndex: 0,
  workIndex: 0,
};
