// src/context/WorkTypeContext.jsx
import React, { createContext, useContext, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  WORK_TYPES, 
  getCategoryWorkTypes,
  getSubtypeOptions,
  getDefaultSubtype,
  isCategoryValid 
} from '../components/Calculator/data/workTypes';

// FIXED: Import only what we actually use
import { 
  MEASUREMENT_TYPES,
  isValidMeasurementType as validateMeasurementType,
  getMeasurementTypeLabel as getTypeLabel,
  getMeasurementTypeUnit as getTypeUnit,
  getMeasurementTypeIcon as getTypeIcon,
  ALL_MEASUREMENT_TYPES
} from '../constants/measurementTypes';

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

  // FIXED: Use centralized function
  const getAllMeasurementTypes = useCallback(
    () => ALL_MEASUREMENT_TYPES,
    []
  );

  // FIXED: Use centralized function
  const getMeasurementTypeLabel = useCallback(
    (measurementType) => getTypeLabel(measurementType),
    []
  );

  // FIXED: Use centralized function
  const getMeasurementTypeUnit = useCallback(
    (measurementType) => getTypeUnit(measurementType),
    []
  );

  // FIXED: Use centralized function
  const getMeasurementTypeIcon = useCallback(
    (measurementType) => getTypeIcon(measurementType),
    []
  );

  // FIXED: Enhanced getMeasurementType with consistent constants
  const getMeasurementType = useCallback((categoryName, workType) => {
    if (!categoryName || !workType) return MEASUREMENT_TYPES.SQUARE_FOOT;
    
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
      return MEASUREMENT_TYPES.SQUARE_FOOT;
    }
    
    // Linear measurements for trim, molding, pipes, etc.
    if (lowerWorkType.includes('trim') || 
        lowerWorkType.includes('molding') ||
        lowerWorkType.includes('baseboard') ||
        lowerWorkType.includes('crown') ||
        lowerWorkType.includes('edge') ||
        lowerWorkType.includes('pipe') ||
        lowerWorkType.includes('strip')) {
      return MEASUREMENT_TYPES.LINEAR_FOOT;
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
      return MEASUREMENT_TYPES.BY_UNIT;
    }
    
    // Category-specific defaults
    if (categoryName) {
      const lowerCategory = categoryName.toLowerCase();
      if (lowerCategory.includes('electric')) return MEASUREMENT_TYPES.BY_UNIT;
      if (lowerCategory.includes('plumb')) return MEASUREMENT_TYPES.BY_UNIT;
    }
    
    // Default fallback
    return MEASUREMENT_TYPES.SQUARE_FOOT;
  }, []);

  // FIXED: Use centralized validation function
  const isValidMeasurementType = useCallback(
    (measurementType) => validateMeasurementType(measurementType),
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
      measurementTypes: ALL_MEASUREMENT_TYPES,
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

// FIXED: Re-export MEASUREMENT_TYPES for backwards compatibility
export { MEASUREMENT_TYPES };