// src/context/WorkTypeContext.jsx
import React, { createContext, useContext, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  WORK_TYPES, 
  MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_TYPE_UNITS,
  MEASUREMENT_TYPE_ICONS,
  getCategoryWorkTypes,
  getSubtypeOptions,
  getDefaultSubtype,
  isCategoryValid 
} from '../components/Calculator/data/workTypes';

const WorkTypeContext = createContext({
  getCategoryWorkTypes: () => [],
  getSubtypeOptions: () => [],
  getDefaultSubtype: () => null,
  isCategoryValid: () => false,
  isValidWorkType: () => false,
  getMeasurementType: () => null,
  getAllMeasurementTypes: () => [],
  getMeasurementTypeLabel: () => '',
  getMeasurementTypeUnit: () => '',
  getMeasurementTypeIcon: () => '',
  isValidMeasurementType: () => false,
  isValidSubtype: () => true,
  getWorkTypeDetails: () => null,
  workTypesData: {},
  categories: [],
  measurementTypes: [],
});

export function WorkTypeProvider({ children }) {
  const isValidWorkType = useCallback(
    (categoryKey, workType) => {
      if (!categoryKey || !workType) return false;
      const types = WORK_TYPES[categoryKey] || [];
      return types.includes(workType);
    },
    []
  );

  const getWorkTypeCategory = useCallback((workType) => {
    for (const [category, types] of Object.entries(WORK_TYPES)) {
      if (types.includes(workType)) {
        return category;
      }
    }
    return null;
  }, []);

  const getWorkTypeDetails = useCallback(
    (workType) => {
      if (!workType) return null;
      return {
        type: workType,
        category: getWorkTypeCategory(workType),
        subtypes: getSubtypeOptions(workType) || [],
        defaultSubtype: getDefaultSubtype(workType) || null,
      };
    },
    [getWorkTypeCategory]
  );

  const isValidSubtype = useCallback(
    (workType, subtype) => {
      if (!workType || !subtype) return true;
      const options = getSubtypeOptions(workType);
      return options ? options.includes(subtype) : true;
    },
    []
  );

  const getAllMeasurementTypes = useCallback(
    () => Object.values(MEASUREMENT_TYPES),
    []
  );

  const getMeasurementTypeLabel = useCallback(
    (measurementType) =>
      MEASUREMENT_TYPE_LABELS[measurementType] || measurementType || 'Unknown',
    []
  );

  const getMeasurementTypeUnit = useCallback(
    (measurementType) => MEASUREMENT_TYPE_UNITS[measurementType] || '',
    []
  );

  const getMeasurementTypeIcon = useCallback(
    (measurementType) => MEASUREMENT_TYPE_ICONS[measurementType] || 'fas fa-question',
    []
  );

  // Enhanced getMeasurementType function with better business logic
  const getMeasurementType = useCallback((categoryName, workType) => {
    if (!categoryName || !workType) return 'single-surface';
    
    const lowerWorkType = workType.toLowerCase();
    
    // Flooring and surface work typically use square footage
    if (lowerWorkType.includes('flooring') || 
        lowerWorkType.includes('tile') ||
        lowerWorkType.includes('carpet') ||
        lowerWorkType.includes('countertop') ||
        lowerWorkType.includes('backsplash') ||
        lowerWorkType.includes('ceiling') ||
        lowerWorkType.includes('walls') ||
        lowerWorkType.includes('surface')) {
      return 'single-surface';
    }
    
    // Linear measurements for trim, molding, pipes, etc.
    if (lowerWorkType.includes('trim') || 
        lowerWorkType.includes('molding') ||
        lowerWorkType.includes('baseboard') ||
        lowerWorkType.includes('crown') ||
        lowerWorkType.includes('edge') ||
        lowerWorkType.includes('pipe') ||
        lowerWorkType.includes('strip')) {
      return 'linear-foot';
    }
    
    // Unit-based for individual items
    if (lowerWorkType.includes('outlet') || 
        lowerWorkType.includes('switch') ||
        lowerWorkType.includes('appliance') ||
        lowerWorkType.includes('fixture') ||
        lowerWorkType.includes('sink') ||
        lowerWorkType.includes('toilet') ||
        lowerWorkType.includes('door') ||
        lowerWorkType.includes('window') ||
        lowerWorkType.includes('fan') ||
        lowerWorkType.includes('bar') ||
        lowerWorkType.includes('mirror') ||
        lowerWorkType.includes('hardware') ||
        lowerWorkType.includes('organizer') ||
        lowerWorkType.includes('lighting')) {
      return 'by-unit';
    }
    
    // Category-specific defaults
    if (categoryName) {
      const lowerCategory = categoryName.toLowerCase();
      if (lowerCategory.includes('electric')) return 'by-unit';
      if (lowerCategory.includes('plumb')) return 'by-unit';
    }
    
    // Default fallback
    return 'single-surface';
  }, []);

  const isValidMeasurementType = useCallback(
    (measurementType) => Object.values(MEASUREMENT_TYPES).includes(measurementType),
    []
  );

  const contextValue = useMemo(
    () => ({
      getCategoryWorkTypes,
      getSubtypeOptions,
      getDefaultSubtype,
      isCategoryValid,
      isValidWorkType,
      isValidSubtype,
      getWorkTypeDetails,
      getMeasurementType,
      isValidMeasurementType,
      getAllMeasurementTypes,
      getMeasurementTypeLabel,
      getMeasurementTypeUnit,
      getMeasurementTypeIcon,
      workTypesData: WORK_TYPES,
      categories: Object.keys(WORK_TYPES),
      measurementTypes: Object.values(MEASUREMENT_TYPES),
    }),
    [
      isValidWorkType,
      isValidSubtype,
      getWorkTypeDetails,
      getMeasurementType,
      isValidMeasurementType,
      getAllMeasurementTypes,
      getMeasurementTypeLabel,
      getMeasurementTypeUnit,
      getMeasurementTypeIcon,
    ]
  );

  return (
    <WorkTypeContext.Provider value={contextValue}>
      {children}
    </WorkTypeContext.Provider>
  );
}

WorkTypeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useWorkType = () => {
  const context = useContext(WorkTypeContext);
  if (!context) {
    throw new Error('useWorkType must be used within a WorkTypeProvider');
  }
  return context;
};

export { MEASUREMENT_TYPES };
