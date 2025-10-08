// src/constants/measurementTypes.js
// ============================================================================
// SINGLE SOURCE OF TRUTH FOR MEASUREMENT TYPES
// ============================================================================
// This file defines all measurement type constants used throughout the app.
// Import from here to ensure consistency across all components.
// ============================================================================

export const MEASUREMENT_TYPES = {
  SQUARE_FOOT: 'square-foot',
  LINEAR_FOOT: 'linear-foot',
  BY_UNIT: 'by-unit'
};

// Labels for display purposes
export const MEASUREMENT_TYPE_LABELS = {
  [MEASUREMENT_TYPES.SQUARE_FOOT]: 'Square Foot',
  [MEASUREMENT_TYPES.LINEAR_FOOT]: 'Linear Foot',
  [MEASUREMENT_TYPES.BY_UNIT]: 'By Unit'
};

// Units for display
export const MEASUREMENT_TYPE_UNITS = {
  [MEASUREMENT_TYPES.SQUARE_FOOT]: 'sq ft',
  [MEASUREMENT_TYPES.LINEAR_FOOT]: 'linear ft',
  [MEASUREMENT_TYPES.BY_UNIT]: 'units'
};

// Icons for UI
export const MEASUREMENT_TYPE_ICONS = {
  [MEASUREMENT_TYPES.SQUARE_FOOT]: 'fas fa-ruler-combined',
  [MEASUREMENT_TYPES.LINEAR_FOOT]: 'fas fa-ruler-horizontal',
  [MEASUREMENT_TYPES.BY_UNIT]: 'fas fa-cube'
};

/**
 * Normalizes various measurement type formats to the standard constant value
 * Handles legacy formats and common variations
 * @param {string} type - The measurement type to normalize
 * @returns {string} - Standardized measurement type constant
 */
export const normalizeMeasurementType = (type) => {
  if (!type) return MEASUREMENT_TYPES.SQUARE_FOOT;
  
  const typeStr = String(type).toLowerCase().trim();
  
  // Square foot variations
  if (typeStr === 'square-foot' || 
      typeStr === 'sqft' || 
      typeStr === 'sq ft' ||
      typeStr === 'square foot' ||
      typeStr === 'square foot (sqft)' ||
      typeStr === 'single-surface') {
    return MEASUREMENT_TYPES.SQUARE_FOOT;
  }
  
  // Linear foot variations
  if (typeStr === 'linear-foot' || 
      typeStr === 'linear ft' ||
      typeStr === 'linearft' ||
      typeStr === 'linear foot') {
    return MEASUREMENT_TYPES.LINEAR_FOOT;
  }
  
  // By unit variations
  if (typeStr === 'by-unit' || 
      typeStr === 'by unit' ||
      typeStr === 'unit' ||
      typeStr === 'units') {
    return MEASUREMENT_TYPES.BY_UNIT;
  }
  
  // Default fallback
  console.warn(`Unknown measurement type: ${type}, defaulting to SQUARE_FOOT`);
  return MEASUREMENT_TYPES.SQUARE_FOOT;
};

/**
 * Validates if a measurement type is valid
 * @param {string} type - The measurement type to validate
 * @returns {boolean} - True if valid
 */
export const isValidMeasurementType = (type) => {
  return Object.values(MEASUREMENT_TYPES).includes(type);
};

/**
 * Gets the display label for a measurement type
 * @param {string} measurementType - The measurement type
 * @returns {string} - Display label
 */
export const getMeasurementTypeLabel = (measurementType) => {
  const normalized = normalizeMeasurementType(measurementType);
  return MEASUREMENT_TYPE_LABELS[normalized] || 'Unknown';
};

/**
 * Gets the unit string for a measurement type
 * @param {string} measurementType - The measurement type
 * @returns {string} - Unit string
 */
export const getMeasurementTypeUnit = (measurementType) => {
  const normalized = normalizeMeasurementType(measurementType);
  return MEASUREMENT_TYPE_UNITS[normalized] || '';
};

/**
 * Gets the icon class for a measurement type
 * @param {string} measurementType - The measurement type
 * @returns {string} - Icon class string
 */
export const getMeasurementTypeIcon = (measurementType) => {
  const normalized = normalizeMeasurementType(measurementType);
  return MEASUREMENT_TYPE_ICONS[normalized] || 'fas fa-question';
};

// Export all values as an array for iteration
export const ALL_MEASUREMENT_TYPES = Object.values(MEASUREMENT_TYPES);