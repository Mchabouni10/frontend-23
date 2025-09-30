
// src/components/Calculator/utils/calculatorUtils.js

import {
  WORK_TYPES,
  MEASUREMENT_TYPES,
  SUBTYPE_OPTIONS,
  DEFAULT_CUSTOM_WORK_TYPES,
} from '../data/workTypes';
import { ERROR_CATEGORIES, ERROR_SEVERITY } from '../../../context/ErrorContext';
import { validateNumber } from './validation';

/**
 * Configuration for calculation precision
 * @constant {Object}
 */
export const PRECISION_CONFIG = {
  CURRENCY: 2,
  AREA: 2,
  LINEAR: 2,
  UNITS: 0,
  RATES: 4,
  PERCENTAGE: 4,
  INTERNAL: 6,
};

/**
 * Calculation limits with context
 * @constant {Object}
 */
export const CALCULATION_LIMITS = {
  MAX_UNITS: 50000,
  MAX_COST: 10000000,
  MAX_PAYMENT: 1000000,
  MIN_UNIT_VALUE: 0.01,
  MAX_SURFACES_PER_ITEM: 100,
  MAX_ITEMS_PER_CATEGORY: 200,
  MAX_CATEGORIES: 50,
  MAX_TAX_RATE: 0.25,
  MAX_MARKUP_RATE: 5.0,
  MAX_WASTE_FACTOR: 0.50,
};

/**
 * Error messages with codes
 * @constant {Object}
 */
export const ERROR_MESSAGES = {
  INVALID_ITEM: 'Invalid work item structure',
  MISSING_SURFACES: 'No valid surfaces found',
  INVALID_MEASUREMENT_TYPE: 'Invalid measurement type',
  INVALID_SUBTYPE: 'Invalid subtype for work type',
  NEGATIVE_COSTS: 'Negative costs not allowed',
  EXCEEDS_LIMIT: 'Value exceeds maximum limit',
  INVALID_CATEGORY: 'Invalid category structure',
  INVALID_DATE: 'Invalid date format',
  CALCULATION_OVERFLOW: 'Calculation result too large',
  CALCULATION_UNDERFLOW: 'Calculation result too small',
  DIVISION_BY_ZERO: 'Division by zero attempted',
  INVALID_PRECISION: 'Invalid precision in calculation',
  DATA_CORRUPTION: 'Data corruption detected',
  INCONSISTENT_STATE: 'Inconsistent calculation state',
  MISSING_DEPENDENCIES: 'Required calculation dependencies missing',
  MEMORY_LIMIT: 'Calculation memory limit exceeded',
  TIMEOUT: 'Calculation timeout exceeded',
  UNKNOWN_ERROR: 'Unknown calculation error',
  INVALID_SETTINGS: 'Invalid settings configuration',
  INVALID_COST: 'Invalid cost value',
};

/**
 * Validation schemas for type safety
 * @constant {Object}
 */
export const VALIDATION_SCHEMAS = {
  workItem: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    type: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    measurementType: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    materialCost: { required: false, type: 'number', min: 0, max: CALCULATION_LIMITS.MAX_COST },
    laborCost: { required: false, type: 'number', min: 0, max: CALCULATION_LIMITS.MAX_COST },
    surfaces: { required: true, type: 'array', minLength: 1, maxLength: CALCULATION_LIMITS.MAX_SURFACES_PER_ITEM },
  },
  surface: {
    sqft: { required: false, type: 'number', min: CALCULATION_LIMITS.MIN_UNIT_VALUE, max: CALCULATION_LIMITS.MAX_UNITS },
    width: { required: false, type: 'number', min: CALCULATION_LIMITS.MIN_UNIT_VALUE, max: 1000 },
    height: { required: false, type: 'number', min: CALCULATION_LIMITS.MIN_UNIT_VALUE, max: 1000 },
    linearFt: { required: false, type: 'number', min: CALCULATION_LIMITS.MIN_UNIT_VALUE, max: CALCULATION_LIMITS.MAX_UNITS },
    units: { required: false, type: 'number', min: 1, max: CALCULATION_LIMITS.MAX_UNITS },
    subtype: { required: false, type: 'string', minLength: 1, maxLength: 50 },
  },
  settings: {
    currency: { required: true, type: 'string', minLength: 3, maxLength: 3 },
    taxRate: { required: false, type: 'number', min: 0, max: CALCULATION_LIMITS.MAX_TAX_RATE },
    laborMultiplier: { required: false, type: 'number', min: 0, max: CALCULATION_LIMITS.MAX_MARKUP_RATE },
    materialMarkup: { required: false, type: 'number', min: 0, max: CALCULATION_LIMITS.MAX_MARKUP_RATE },
    showAdvancedOptions: { required: false, type: 'boolean' },
    theme: { required: false, type: 'string', minLength: 1, maxLength: 20 },
    autoSave: { required: false, type: 'boolean' },
    notifications: { required: false, type: 'boolean' },
  },
  category: {
    key: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    items: { required: false, type: 'array', minLength: 0, maxLength: CALCULATION_LIMITS.MAX_ITEMS_PER_CATEGORY },
  },
};

/**
 * Cached work types
 * @constant {Array}
 */
export const ALL_WORK_TYPES = Object.values(WORK_TYPES).reduce((acc, category) => {
  return [
    ...acc,
    ...(category.surfaceBased || []),
    ...(category.linearFtBased || []),
    ...(category.unitBased || []),
  ];
}, []);

/**
 * Default surface values by measurement type
 * @constant {Object}
 */
const DEFAULT_SURFACE_VALUES = {
  [MEASUREMENT_TYPES.SINGLE_SURFACE]: { width: 5, height: 5, sqft: 25 },
  [MEASUREMENT_TYPES.LINEAR_FOOT]: { linearFt: 1 },
  [MEASUREMENT_TYPES.BY_UNIT]: { units: 1 },
};

/**
 * Collects and formats error objects
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @param {Function} addError - Optional error callback
 * @returns {Object} Formatted error object
 */
export function collectError(message, code = 'VALIDATION_ERROR', details = {}, addError) {
  const errorObj = {
    message,
    code,
    category: ERROR_CATEGORIES.VALIDATION,
    severity: ERROR_SEVERITY.LOW,
    details,
  };
  if (typeof addError === 'function') {
    addError(errorObj.message, {
      category: errorObj.category,
      severity: errorObj.severity,
      context: details,
    });
  }
  return errorObj;
}

/**
 * Validates data against a schema
 * @param {Object} data - Data to validate
 * @param {string} schemaKey - Schema key (e.g., 'workItem', 'surface')
 * @param {string} context - Context for error messages
 * @param {Function} addError - Error callback
 * @returns {Object} Validation result with isValid and errors
 */
export function validateBySchema(data, schemaKey, context = '', addError) {
  const schema = VALIDATION_SCHEMAS[schemaKey];
  if (!schema) {
    return {
      isValid: false,
      errors: [
        collectError(
          `No validation schema found for ${schemaKey}`,
          'MISSING_SCHEMA',
          { schemaKey, context },
          addError
        ),
      ],
    };
  }

  const errors = [];
  const contextPrefix = context ? `${context}: ` : '';

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(
        collectError(
          `${contextPrefix}${field} is required`,
          'REQUIRED_FIELD',
          { field, context, data },
          addError
        )
      );
      continue;
    }

    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (rules.type && typeof value !== rules.type && !(rules.type === 'array' && Array.isArray(value))) {
      errors.push(
        collectError(
          `${contextPrefix}${field} must be of type ${rules.type}`,
          'INVALID_TYPE',
          { field, expectedType: rules.type, actualType: typeof value, value, context },
          addError
        )
      );
      continue;
    }

    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(
          collectError(
            `${contextPrefix}${field} must be at least ${rules.minLength} characters`,
            'MIN_LENGTH_VIOLATION',
            { field, minLength: rules.minLength, actualLength: value.length, context },
            addError
          )
        );
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(
          collectError(
            `${contextPrefix}${field} must be at most ${rules.maxLength} characters`,
            'MAX_LENGTH_VIOLATION',
            { field, maxLength: rules.maxLength, actualLength: value.length, context },
            addError
          )
        );
      }
    }

    if (rules.type === 'number') {
      const validation = validateNumber(value, {
        min: rules.min,
        max: rules.max,
        decimals: field !== 'units',
        field: field.charAt(0).toUpperCase() + field.slice(1),
      });
      if (!validation.isValid) {
        errors.push(
          collectError(
            `${contextPrefix}${validation.error}`,
            validation.code,
            { field, value, context },
            addError
          )
        );
      }
    }

    if (rules.type === 'array') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(
          collectError(
            `${contextPrefix}${field} must have at least ${rules.minLength} items`,
            'MIN_LENGTH_VIOLATION',
            { field, minLength: rules.minLength, actualLength: value.length, context },
            addError
          )
        );
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(
          collectError(
            `${contextPrefix}${field} must have at most ${rules.maxLength} items`,
            'MAX_LENGTH_VIOLATION',
            { field, maxLength: rules.maxLength, actualLength: value.length, context },
            addError
          )
        );
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a category
 * @param {Object} category - Category to validate
 * @param {Function} addError - Error callback
 * @param {Function} addWarning - Warning callback
 * @returns {Object} Validated category or null
 */
export function validateCategories(categories, addError, addWarning) {
  if (!Array.isArray(categories)) {
    addError?.(
      'Categories must be an array',
      { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.MEDIUM, context: { categories } }
    );
    return [];
  }

  if (categories.length > CALCULATION_LIMITS.MAX_CATEGORIES) {
    addError?.(
      `Too many categories: ${categories.length} exceeds limit of ${CALCULATION_LIMITS.MAX_CATEGORIES}`,
      { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.MEDIUM, context: { categories } }
    );
    return categories.slice(0, CALCULATION_LIMITS.MAX_CATEGORIES);
  }

  const validatedCategories = categories.map((category, index) => {
    const validation = validateBySchema(category, 'category', `Category ${index + 1}`, addError);
    if (!validation.isValid) {
      validation.errors.forEach((error) => {
        addError?.(error.message, {
          category: error.category,
          severity: error.severity,
          context: { ...error.details, categoryIndex: index },
        });
      });
      return null;
    }

    const categoryData = WORK_TYPES[category.key] || (category.key.startsWith('custom_') ? DEFAULT_CUSTOM_WORK_TYPES : null);
    if (!categoryData) {
      addError?.(
        `Invalid category key: ${category.key}`,
        { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.MEDIUM, context: { category, categoryIndex: index } }
      );
      return null;
    }

    if (Array.isArray(category.items)) {
      if (category.items.length > CALCULATION_LIMITS.MAX_ITEMS_PER_CATEGORY) {
        addWarning?.(
          `Category ${category.name} has too many items: ${category.items.length} exceeds limit of ${CALCULATION_LIMITS.MAX_ITEMS_PER_CATEGORY}`,
          { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW, context: { category, categoryIndex: index } }
        );
      }

      const validatedItems = category.items.map((item, itemIndex) => {
        const itemValidation = validateWorkItem(item, (message, details) => {
          addError?.(message, {
            category: ERROR_CATEGORIES.VALIDATION,
            severity: ERROR_SEVERITY.LOW,
            context: { ...details, categoryIndex: index, itemIndex },
          });
        });
        return itemValidation.isValid ? item : null;
      }).filter(item => item !== null);

      return { ...category, items: validatedItems };
    }

    return category;
  }).filter(category => category !== null);

  return validatedCategories;
}

/**
 * Validates settings object
 * @param {Object} settings - Settings to validate
 * @param {Function} addError - Error callback
 * @returns {Object} Validated settings
 */
export function validateSettings(settings, addError) {
  if (!settings || typeof settings !== 'object') {
    addError?.(
      ERROR_MESSAGES.INVALID_SETTINGS,
      { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.MEDIUM, context: { settings } }
    );
    return {};
  }

  const validation = validateBySchema(settings, 'settings', 'Settings', addError);
  if (!validation.isValid) {
    validation.errors.forEach((error) => {
      addError?.(error.message, {
        category: error.category,
        severity: error.severity,
        context: error.details,
      });
    });
  }

  return validation.isValid ? settings : {};
}

/**
 * Sanitizes surface data
 * @param {Object} surface - Surface to sanitize
 * @param {string} measurementType - Measurement type
 * @param {Function} addError - Error callback
 * @returns {Object} Sanitized surface
 */
export function sanitizeSurface(surface, measurementType, addError) {
  if (!surface || typeof surface !== 'object') {
    addError?.(
      'Invalid surface structure',
      { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW, context: { surface } }
    );
    return {};
  }

  const sanitized = {};
  const validation = validateBySchema(surface, 'surface', 'Surface', addError);
  if (!validation.isValid) {
    validation.errors.forEach((error) => {
      addError?.(error.message, {
        category: error.category,
        severity: error.severity,
        context: error.details,
      });
    });
    return {};
  }

  const defaultValues = DEFAULT_SURFACE_VALUES[measurementType] || {};
  switch (measurementType) {
    case MEASUREMENT_TYPES.SINGLE_SURFACE:
      sanitized.sqft = parseFloat(surface.sqft) || parseFloat((surface.width || defaultValues.width) * (surface.height || defaultValues.height)) || defaultValues.sqft || 0;
      sanitized.width = parseFloat(surface.width) || defaultValues.width || 0;
      sanitized.height = parseFloat(surface.height) || defaultValues.height || 0;
      break;
    case MEASUREMENT_TYPES.LINEAR_FOOT:
      sanitized.linearFt = parseFloat(surface.linearFt) || defaultValues.linearFt || 0;
      break;
    case MEASUREMENT_TYPES.BY_UNIT:
      sanitized.units = parseFloat(surface.units) || defaultValues.units || 0;
      break;
    default:
      addError?.(
        `Unknown measurement type: ${measurementType}`,
        { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW, context: { measurementType } }
      );
      return {};
  }

  if (surface.subtype) {
    sanitized.subtype = String(surface.subtype);
  }

  return sanitized;
}

/**
 * Wrapper for calculateItemUnits to maintain backward compatibility
 * @param {Object} item - Work item
 * @param {Function} addError - Error callback
 * @returns {Object} Units and errors
 */
export function getUnits(item, addError) {
  return calculateItemUnits(item, addError);
}

/**
 * Parses and validates a cost value
 * @param {string|number} cost - Cost value
 * @param {string} field - Field name for error messages
 * @param {Function} addError - Error callback
 * @returns {Object} Validation result with isValid and value
 */
export function parseAndValidateCost(cost, field = 'Cost', addError) {
  const validation = validateNumber(cost, {
    min: 0,
    max: CALCULATION_LIMITS.MAX_COST,
    decimals: true,
    precision: PRECISION_CONFIG.CURRENCY,
    field,
  });

  if (!validation.isValid) {
    addError?.(validation.error, {
      category: ERROR_CATEGORIES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      context: { cost, field },
    });
  }

  return validation;
}

/**
 * Calculates total units for a work item
 * @param {Object} item - Work item
 * @param {Function} addError - Error callback
 * @returns {Object} Total units and errors
 */
export function calculateItemUnits(item, addError) {
  if (!item || !Array.isArray(item.surfaces)) {
    return {
      units: 0,
      errors: [
        collectError(
          ERROR_MESSAGES.INVALID_ITEM,
          'INVALID_ITEM',
          { item },
          addError
        ),
      ],
    };
  }

  const errors = [];
  let totalUnits = 0;
  const measurementType = item.measurementType || MEASUREMENT_TYPES.SINGLE_SURFACE;
  const defaultValues = DEFAULT_SURFACE_VALUES[measurementType] || {};

  item.surfaces.forEach((surface, surfaceIndex) => {
    let surfaceUnits = 0;

    try {
      switch (measurementType) {
        case MEASUREMENT_TYPES.LINEAR_FOOT: {
          const linearFt = parseFloat(surface.linearFt) || defaultValues.linearFt || 0;
          const validation = validateNumber(linearFt, {
            min: CALCULATION_LIMITS.MIN_UNIT_VALUE,
            max: CALCULATION_LIMITS.MAX_UNITS,
            decimals: true,
            field: `Linear feet (surface ${surfaceIndex + 1})`,
          });

          if (!validation.isValid) {
            errors.push(
              collectError(
                validation.error,
                validation.code,
                { itemName: item.name, surfaceIndex, linearFt },
                addError
              )
            );
            break;
          }

          surfaceUnits = validation.value;
          break;
        }

        case MEASUREMENT_TYPES.BY_UNIT: {
          const units = parseFloat(surface.units) || defaultValues.units || 0;
          const validation = validateNumber(units, {
            min: 1,
            max: CALCULATION_LIMITS.MAX_UNITS,
            decimals: false,
            field: `Units (surface ${surfaceIndex + 1})`,
          });

          if (!validation.isValid) {
            errors.push(
              collectError(
                validation.error,
                validation.code,
                { itemName: item.name, surfaceIndex, units },
                addError
              )
            );
            break;
          }

          surfaceUnits = validation.value;
          break;
        }

        case MEASUREMENT_TYPES.SINGLE_SURFACE: {
          const width = parseFloat(surface.width) || defaultValues.width || 0;
          const height = parseFloat(surface.height) || defaultValues.height || 0;
          const sqft = parseFloat(surface.sqft) || width * height || defaultValues.sqft || 0;

          const validation = validateNumber(sqft, {
            min: CALCULATION_LIMITS.MIN_UNIT_VALUE,
            max: CALCULATION_LIMITS.MAX_UNITS,
            decimals: true,
            field: `Square footage (surface ${surfaceIndex + 1})`,
          });

          if (!validation.isValid) {
            errors.push(
              collectError(
                validation.error,
                validation.code,
                { itemName: item.name, surfaceIndex, sqft, width, height },
                addError
              )
            );
            break;
          }

          surfaceUnits = validation.value;
          break;
        }

        default: {
          errors.push(
            collectError(
              `Surface ${surfaceIndex + 1} has unknown measurement type: ${measurementType}`,
              'UNKNOWN_MEASUREMENT_TYPE',
              { itemName: item.name, surfaceIndex, measurementType },
              addError
            )
          );
          surfaceUnits = 0;
          break;
        }
      }
    } catch (error) {
      errors.push(
        collectError(
          `Error processing surface ${surfaceIndex + 1}: ${error.message}`,
          'PROCESSING_ERROR',
          { itemName: item.name, surfaceIndex, originalError: error.message },
          addError
        )
      );
    }

    totalUnits += surfaceUnits;
  });

  const finalUnits = Number(Math.max(0, totalUnits).toFixed(PRECISION_CONFIG.AREA));

  if (finalUnits > CALCULATION_LIMITS.MAX_UNITS) {
    errors.push(
      collectError(
        `Total units (${finalUnits}) exceed maximum limit`,
        'TOTAL_EXCEEDS_LIMIT',
        { itemName: item.name, totalUnits: finalUnits, limit: CALCULATION_LIMITS.MAX_UNITS },
        addError
      )
    );
    return { units: CALCULATION_LIMITS.MAX_UNITS, errors };
  }

  return { units: finalUnits, errors };
}

/**
 * Gets unit label for a measurement type
 * @param {string} measurementType - Measurement type
 * @param {Function} addError - Error callback
 * @returns {Object} Label and errors
 */
export function getUnitLabel(measurementType, addError) {
  const errors = [];
  if (!measurementType) {
    errors.push(
      collectError(
        'Measurement type is required for label',
        'MISSING_MEASUREMENT_TYPE',
        {},
        addError
      )
    );
    return { label: 'sqft', errors };
  }

  const normalizedType = measurementType.toLowerCase().trim();
  let label = 'sqft';

  switch (normalizedType) {
    case MEASUREMENT_TYPES.LINEAR_FOOT:
      label = 'linear ft';
      break;
    case MEASUREMENT_TYPES.BY_UNIT:
      label = 'units';
      break;
    case MEASUREMENT_TYPES.SINGLE_SURFACE:
      label = 'sqft';
      break;
    default:
      errors.push(
        collectError(
          `Unknown measurement type for label: ${measurementType}`,
          'UNKNOWN_MEASUREMENT_TYPE',
          { measurementType: normalizedType },
          addError
        )
      );
      break;
  }

  return { label, errors };
}

/**
 * Convenience function for getting unit label
 * @param {string} measurementTypeString - Measurement type
 * @param {Function} addError - Error callback
 * @returns {Object} Label and errors
 */
export function getUnitLabelForItem(measurementTypeString, addError) {
  return getUnitLabel(measurementTypeString, addError);
}

/**
 * Validates a work item
 * @param {Object} item - Work item to validate
 * @param {Function} addError - Error callback
 * @returns {Object} Validation result with isValid and errors
 */
export function validateWorkItem(item, addError) {
  const errors = [];
  if (!item || typeof item !== 'object') {
    errors.push(
      collectError(
        ERROR_MESSAGES.INVALID_ITEM,
        'INVALID_ITEM_TYPE',
        { item },
        addError
      )
    );
    return { isValid: false, errors };
  }

  const schemaValidation = validateBySchema(item, 'workItem', 'Work item', addError);
  if (!schemaValidation.isValid) {
    errors.push(...schemaValidation.errors);
  }

  if (Array.isArray(item.surfaces)) {
    item.surfaces.forEach((surface, index) => {
      const surfaceValidation = validateBySchema(surface, 'surface', `Surface ${index + 1}`, addError);
      if (!surfaceValidation.isValid) {
        errors.push(...surfaceValidation.errors);
      }

      if (surface.subtype && SUBTYPE_OPTIONS[item.type]) {
        if (!SUBTYPE_OPTIONS[item.type].includes(surface.subtype)) {
          errors.push(
            collectError(
              `Surface ${index + 1} has invalid subtype: ${surface.subtype}`,
              'INVALID_SUBTYPE',
              { itemName: item.name, surfaceIndex: index, subtype: surface.subtype },
              addError
            )
          );
        }
      }
    });
  }

  return { isValid: errors.length === 0, errors };
}