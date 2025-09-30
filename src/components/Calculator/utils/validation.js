/**
 * Validation utilities for numeric inputs
 * @file src/components/Calculator/utils/validation.js
 */
import { CALCULATION_LIMITS, PRECISION_CONFIG } from './calculatorUtils';
import { ERROR_CATEGORIES, ERROR_SEVERITY } from '../../../context/ErrorContext';

/**
 * Validates a numeric value against specified constraints
 * @param {string|number} value - Value to validate
 * @param {Object} options - Validation options
 * @param {number} [options.min=MIN_UNIT_VALUE] - Minimum allowed value
 * @param {number} [options.max=MAX_UNITS] - Maximum allowed value
 * @param {boolean} [options.decimals=true] - Allow decimal values
 * @param {number} [options.precision=AREA] - Decimal precision
 * @param {string} [options.field='Value'] - Field name for error messages
 * @returns {Object} Validation result with isValid, error, code, category, severity, and value
 */
export const validateNumber = (value, {
  min = CALCULATION_LIMITS.MIN_UNIT_VALUE,
  max = CALCULATION_LIMITS.MAX_UNITS,
  decimals = true,
  precision = PRECISION_CONFIG.AREA,
  field = 'Value',
} = {}) => {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      error: `${field} is required`,
      code: 'REQUIRED_FIELD',
      category: ERROR_CATEGORIES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      value: null,
    };
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: `${field} must be a valid number`,
      code: 'INVALID_NUMBER',
      category: ERROR_CATEGORIES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      value: null,
    };
  }

  if (numValue < min) {
    return {
      isValid: false,
      error: `${field} must be at least ${min}`,
      code: 'MIN_VALUE_VIOLATION',
      category: ERROR_CATEGORIES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      value: numValue,
    };
  }

  if (numValue > max) {
    return {
      isValid: false,
      error: `${field} must be no more than ${max}`,
      code: 'MAX_VALUE_VIOLATION',
      category: ERROR_CATEGORIES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      value: numValue,
    };
  }

  if (!decimals && numValue !== Math.floor(numValue)) {
    return {
      isValid: false,
      error: `${field} must be a whole number`,
      code: 'DECIMAL_NOT_ALLOWED',
      category: ERROR_CATEGORIES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      value: numValue,
    };
  }

  const formattedValue = Number(numValue.toFixed(precision));
  return {
    isValid: true,
    error: null,
    code: null,
    category: null,
    severity: null,
    value: formattedValue,
  };
};