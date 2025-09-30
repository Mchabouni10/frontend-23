// src/components/Calculator/engine/CalculatorEngine.js
import Decimal from 'decimal.js';

export const PRECISION_CONFIG = {
  CURRENCY: 2,
  AREA: 2,
  LINEAR: 2,
  UNITS: 0,
  RATES: 4,
  INTERNAL: 6,
};

export const CALCULATION_LIMITS = {
  MAX_UNITS: 50000,
  MAX_COST: 10000000,
  MIN_UNIT_VALUE: 0.01,
  MAX_SURFACES_PER_ITEM: 100,
  MAX_ITEMS_PER_CATEGORY: 200,
  MAX_CATEGORIES: 50,
  MAX_TAX_RATE: 0.25,
  MAX_MARKUP_RATE: 5.0,
  MAX_WASTE_FACTOR: 0.50,
};

export const MEASUREMENT_TYPES = {
  SQUARE_FOOT: 'square-foot',
  SINGLE_SURFACE: 'single-surface',
  LINEAR_FOOT: 'linear-foot',
  BY_UNIT: 'by-unit'
};

export class CalculatorEngine {
  constructor(categories = [], settings = {}, workTypeFunctions = {}, options = {}) {
    this.options = {
      enableCaching: true,
      enableAuditTrail: false,
      strictValidation: false,
      timeoutMs: 30000,
      maxCacheSize: 1000,
      ...options
    };

    this.errors = new Map();
    this.warnings = new Map();
    this.calculationCache = new Map();
    this.cacheStats = { hits: 0, misses: 0 };

    this.categories = this._validateCategories(categories);
    this.settings = this._validateSettings(settings);
    this.workTypeFunctions = workTypeFunctions || {};
    
    this._setupDecimalConfig();
  }

  _setupDecimalConfig() {
    Decimal.set({
      precision: PRECISION_CONFIG.INTERNAL * 2,
      rounding: Decimal.ROUND_HALF_UP,
      toExpNeg: -10,
      toExpPos: 20,
      modulo: Decimal.ROUND_FLOOR
    });
  }

  _validateCategories(categories) {
    if (!Array.isArray(categories)) {
      this.addError('Categories must be an array');
      return [];
    }
    return categories.filter(cat => cat && typeof cat === 'object' && cat.name);
  }

  _validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      this.addError('Invalid settings configuration');
      return {
        taxRate: 0,
        laborDiscount: 0,
        wasteFactor: 0,
        markup: 0,
        transportationFee: 0,
        miscFees: []
      };
    }
    return {
      taxRate: 0,
      laborDiscount: 0,
      wasteFactor: 0,
      markup: 0,
      transportationFee: 0,
      miscFees: [],
      ...settings
    };
  }

  addError(message, code = 'CALCULATION_ERROR', details = {}) {
    const errorId = `${code}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errorObj = {
      id: errorId,
      message,
      code,
      timestamp: new Date().toISOString(),
      context: details
    };

    this.errors.set(errorId, errorObj);
    return errorId;
  }

  addWarning(message, code = 'CALCULATION_WARNING', details = {}) {
    const warningId = `${code}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const warningObj = {
      id: warningId,
      message,
      code,
      timestamp: new Date().toISOString(),
      context: details
    };

    this.warnings.set(warningId, warningObj);
    return warningId;
  }

  getErrors() {
    return Array.from(this.errors.values()).map(error => ({
      message: error.message,
      code: error.code,
      context: error.context
    }));
  }

  getWarnings() {
    return Array.from(this.warnings.values());
  }

  clearErrors() {
    this.errors.clear();
    this.warnings.clear();
  }

  calculateWorkUnits(item) {
    this.clearErrors();
    
    if (!item || typeof item !== 'object') {
      this.addError('Invalid work item');
      return { units: 0, label: 'units', errors: this.getErrors() };
    }

    const measurementType = item.measurementType;
    const surfaces = Array.isArray(item.surfaces) ? item.surfaces : [];
    
    if (surfaces.length === 0) {
      return this._calculateDirectUnits(item);
    }

    let totalUnits = 0;
    let label = this._getUnitLabel(measurementType);
    let hasValidSurfaces = false;

    try {
      surfaces.forEach((surface, index) => {
        if (!surface || typeof surface !== 'object') {
          this.addWarning(`Surface ${index + 1} is invalid`, 'INVALID_SURFACE', { surface, index });
          return;
        }

        let surfaceUnits = 0;

        switch (measurementType) {
          case MEASUREMENT_TYPES.SQUARE_FOOT:
          case MEASUREMENT_TYPES.SINGLE_SURFACE:
            if (surface.sqft && surface.sqft > 0) {
              surfaceUnits = parseFloat(surface.sqft) || 0;
            } else if (surface.width && surface.height) {
              const width = parseFloat(surface.width) || 0;
              const height = parseFloat(surface.height) || 0;
              surfaceUnits = width * height;
            }
            break;
            
          case MEASUREMENT_TYPES.LINEAR_FOOT:
            surfaceUnits = parseFloat(surface.linearFt) || 0;
            break;
            
          case MEASUREMENT_TYPES.BY_UNIT:
            surfaceUnits = parseInt(surface.units) || 0;
            break;
            
          default:
            this.addWarning(`Unknown measurement type: ${measurementType}`, 'UNKNOWN_MEASUREMENT_TYPE', { measurementType, surface, index });
            surfaceUnits = 0;
            break;
        }

        if (surfaceUnits > 0) {
          hasValidSurfaces = true;
          totalUnits += surfaceUnits;
        }
      });

      if (!hasValidSurfaces) {
        this.addError('No valid surfaces found for calculation', 'NO_VALID_SURFACES', { item });
      }

    } catch (error) {
      this.addError(`Error calculating surface units: ${error.message}`, 'SURFACE_CALCULATION_ERROR', { item, error: error.message });
      totalUnits = 0;
    }

    if (totalUnits < 0) {
      this.addError('Units cannot be negative', 'NEGATIVE_UNITS', { totalUnits });
      totalUnits = 0;
    }
    
    if (totalUnits > CALCULATION_LIMITS.MAX_UNITS) {
      this.addError(`Units exceed maximum limit: ${totalUnits}`, 'UNITS_EXCEED_LIMIT', { totalUnits });
      totalUnits = CALCULATION_LIMITS.MAX_UNITS;
    }

    const finalUnits = Math.max(0, totalUnits);
    
    return { 
      units: Number(finalUnits.toFixed(PRECISION_CONFIG.AREA)),
      label,
      errors: this.getErrors(),
      warnings: this.getWarnings()
    };
  }

  _calculateDirectUnits(item) {
    const measurementType = item.measurementType;
    let totalUnits = 0;
    let label = this._getUnitLabel(measurementType);

    try {
      switch (measurementType) {
        case MEASUREMENT_TYPES.SQUARE_FOOT:
        case MEASUREMENT_TYPES.SINGLE_SURFACE:
          if (item.sqft && item.sqft > 0) {
            totalUnits = parseFloat(item.sqft) || 0;
          } else if (item.width && item.height) {
            const width = parseFloat(item.width) || 0;
            const height = parseFloat(item.height) || 0;
            totalUnits = width * height;
          }
          break;
          
        case MEASUREMENT_TYPES.LINEAR_FOOT:
          totalUnits = parseFloat(item.linearFt) || 0;
          break;
          
        case MEASUREMENT_TYPES.BY_UNIT:
          totalUnits = parseInt(item.units) || 0;
          break;
          
        default:
          if (item.sqft > 0 || (item.width > 0 && item.height > 0)) {
            totalUnits = item.sqft || (parseFloat(item.width || 0) * parseFloat(item.height || 0));
            label = 'sqft';
          } else if (item.linearFt > 0) {
            totalUnits = parseFloat(item.linearFt) || 0;
            label = 'linear ft';
          } else if (item.units > 0) {
            totalUnits = parseInt(item.units) || 0;
            label = 'units';
          }
          break;
      }
    } catch (error) {
      this.addError(`Error calculating direct units: ${error.message}`, 'DIRECT_CALCULATION_ERROR', { item, error: error.message });
      totalUnits = 0;
    }

    return { 
      units: Number(Math.max(0, totalUnits).toFixed(PRECISION_CONFIG.AREA)),
      label,
      errors: this.getErrors(),
      warnings: this.getWarnings()
    };
  }

  _getUnitLabel(measurementType) {
    switch (measurementType) {
      case MEASUREMENT_TYPES.SQUARE_FOOT:
      case MEASUREMENT_TYPES.SINGLE_SURFACE:
        return 'sqft';
      case MEASUREMENT_TYPES.LINEAR_FOOT:
        return 'linear ft';
      case MEASUREMENT_TYPES.BY_UNIT:
        return 'units';
      default:
        return 'units';
    }
  }

  calculateWorkCost(item) {
    this.clearErrors();
    
    if (!item || typeof item !== 'object') {
      this.addError('Invalid work item');
      return this._getDefaultCostResponse();
    }

    const materialCost = this._parseCost(item.materialCost, 'material cost');
    const laborCost = this._parseCost(item.laborCost, 'labor cost');
    
    if (materialCost === null || laborCost === null) {
      return this._getDefaultCostResponse();
    }

    const { units, label } = this.calculateWorkUnits(item);
    
    if (units === 0) {
      return {
        units: 0,
        unitLabel: label,
        materialCost: '0.00',
        laborCost: '0.00', 
        totalCost: '0.00',
        errors: this.getErrors(),
        warnings: this.getWarnings(),
        metadata: {
          units: 0,
          materialCostPerUnit: materialCost.toFixed(PRECISION_CONFIG.RATES),
          laborCostPerUnit: laborCost.toFixed(PRECISION_CONFIG.RATES),
          measurementType: item.measurementType,
          calculatedAt: new Date().toISOString()
        }
      };
    }

    try {
      const materialCostDecimal = new Decimal(materialCost);
      const laborCostDecimal = new Decimal(laborCost);
      const unitsDecimal = new Decimal(units);

      const totalMaterialCost = materialCostDecimal.times(unitsDecimal);
      const totalLaborCost = laborCostDecimal.times(unitsDecimal);
      const totalCost = totalMaterialCost.plus(totalLaborCost);

      return {
        units,
        unitLabel: label,
        materialCost: totalMaterialCost.toFixed(PRECISION_CONFIG.CURRENCY),
        laborCost: totalLaborCost.toFixed(PRECISION_CONFIG.CURRENCY),
        totalCost: totalCost.toFixed(PRECISION_CONFIG.CURRENCY),
        errors: this.getErrors(),
        warnings: this.getWarnings(),
        metadata: {
          units,
          materialCostPerUnit: materialCostDecimal.toFixed(PRECISION_CONFIG.RATES),
          laborCostPerUnit: laborCostDecimal.toFixed(PRECISION_CONFIG.RATES),
          measurementType: item.measurementType,
          calculatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.addError(`Cost calculation error: ${error.message}`, 'COST_CALCULATION_ERROR', { item, originalError: error.message });
      return this._getDefaultCostResponse();
    }
  }

  _parseCost(cost, fieldName) {
    if (cost === null || cost === undefined || cost === '') return 0;
    
    let numValue;
    if (typeof cost === 'string') {
      numValue = parseFloat(cost.replace(/[^0-9.-]/g, ''));
    } else if (typeof cost === 'number') {
      numValue = cost;
    } else {
      this.addError(`Invalid ${fieldName}: must be a number or string`, 'INVALID_COST_TYPE', { cost, fieldName });
      return null;
    }
    
    if (isNaN(numValue)) {
      this.addError(`Invalid ${fieldName}: must be a valid number`, 'INVALID_COST', { cost, fieldName });
      return null;
    }
    
    if (numValue < 0) {
      this.addError(`Invalid ${fieldName}: cannot be negative`, 'NEGATIVE_COST', { cost: numValue, fieldName });
      return null;
    }
    
    if (numValue > CALCULATION_LIMITS.MAX_COST) {
      this.addError(`${fieldName} exceeds maximum limit`, 'COST_EXCEEDS_LIMIT', { cost: numValue, fieldName });
      return null;
    }
    
    return numValue;
  }

  _getDefaultCostResponse() {
    return {
      units: 0,
      unitLabel: 'units',
      materialCost: '0.00',
      laborCost: '0.00',
      totalCost: '0.00',
      errors: this.getErrors(),
      warnings: this.getWarnings(),
      metadata: {
        units: 0,
        materialCostPerUnit: '0.0000',
        laborCostPerUnit: '0.0000',
        measurementType: null,
        calculatedAt: new Date().toISOString()
      }
    };
  }

  calculateCategoryBreakdowns() {
    this.clearErrors();
    
    const breakdowns = this.categories.map((category, index) => {
      if (!category || !category.name) {
        this.addError(`Invalid category at index ${index}`, 'INVALID_CATEGORY', { category, index });
        return this._getDefaultCategoryResponse(`Category ${index}`);
      }

      let materialCost = new Decimal(0);
      let laborCost = new Decimal(0);
      let totalUnits = 0;
      let itemCount = 0;
      let validItemCount = 0;

      const workItems = category.workItems || [];
      
      workItems.forEach((item, itemIndex) => {
        itemCount++;
        
        try {
          const costResult = this.calculateWorkCost(item);
          
          if (costResult.errors.length === 0) {
            validItemCount++;
            materialCost = materialCost.plus(new Decimal(costResult.materialCost));
            laborCost = laborCost.plus(new Decimal(costResult.laborCost));
            totalUnits += costResult.units || 0;
          } else {
            this.addWarning(`Item ${itemIndex + 1} in ${category.name} has calculation errors`, 'ITEM_CALCULATION_ERROR', { 
              categoryName: category.name, 
              itemIndex, 
              item: item.name || 'Unnamed Item',
              errors: costResult.errors 
            });
          }
        } catch (error) {
          this.addError(`Error calculating item ${itemIndex + 1} in ${category.name}: ${error.message}`, 'ITEM_PROCESSING_ERROR', { 
            categoryName: category.name, 
            itemIndex, 
            error: error.message 
          });
        }
      });

      const subtotal = materialCost.plus(laborCost);

      return {
        name: category.name,
        key: category.key,
        materialCost: materialCost.toFixed(PRECISION_CONFIG.CURRENCY),
        laborCost: laborCost.toFixed(PRECISION_CONFIG.CURRENCY),
        subtotal: subtotal.toFixed(PRECISION_CONFIG.CURRENCY),
        totalUnits: Number(totalUnits.toFixed(PRECISION_CONFIG.AREA)),
        itemCount,
        validItemCount,
        calculatedAt: new Date().toISOString(),
        hasErrors: validItemCount < itemCount
      };
    });

    return { 
      breakdowns, 
      errors: this.getErrors(),
      warnings: this.getWarnings(),
      summary: {
        totalCategories: this.categories.length,
        validCategories: breakdowns.filter(b => !b.hasErrors).length,
        totalItems: breakdowns.reduce((sum, b) => sum + b.itemCount, 0),
        validItems: breakdowns.reduce((sum, b) => sum + b.validItemCount, 0),
        calculatedAt: new Date().toISOString()
      }
    };
  }

  _getDefaultCategoryResponse(name) {
    return { 
      name, 
      key: 'invalid',
      materialCost: '0.00', 
      laborCost: '0.00', 
      subtotal: '0.00',
      totalUnits: 0,
      itemCount: 0,
      validItemCount: 0,
      calculatedAt: new Date().toISOString(),
      hasErrors: true
    };
  }

  calculateTotals() {
    this.clearErrors();
    
    let materialCost = new Decimal(0);
    let laborCost = new Decimal(0);
    let totalItems = 0;
    let validItems = 0;
    let totalUnits = 0;

    this.categories.forEach((category) => {
      if (!category || !category.workItems) return;
      
      category.workItems.forEach((item, itemIndex) => {
        totalItems++;
        try {
          const costResult = this.calculateWorkCost(item);
          
          if (costResult.errors.length === 0) {
            validItems++;
            materialCost = materialCost.plus(new Decimal(costResult.materialCost));
            laborCost = laborCost.plus(new Decimal(costResult.laborCost));
            totalUnits += costResult.units || 0;
          } else {
            this.addWarning(`Item calculation failed: ${item.name || 'Unnamed'}`, 'ITEM_CALCULATION_FAILED', {
              categoryName: category.name,
              itemIndex,
              errors: costResult.errors
            });
          }
        } catch (error) {
          this.addError(`Error processing item: ${error.message}`, 'ITEM_PROCESSING_ERROR', {
            categoryName: category.name,
            itemIndex,
            error: error.message
          });
        }
      });
    });

    const adjustments = this._calculateAdjustments(materialCost, laborCost);

    return {
      materialCost: materialCost.toFixed(PRECISION_CONFIG.CURRENCY),
      laborCost: adjustments.adjustedLaborCost.toFixed(PRECISION_CONFIG.CURRENCY),
      laborCostBeforeDiscount: laborCost.toFixed(PRECISION_CONFIG.CURRENCY),
      laborDiscount: adjustments.laborDiscountAmount.toFixed(PRECISION_CONFIG.CURRENCY),
      wasteCost: adjustments.wasteCost.toFixed(PRECISION_CONFIG.CURRENCY),
      taxAmount: adjustments.taxAmount.toFixed(PRECISION_CONFIG.CURRENCY),
      markupAmount: adjustments.markupAmount.toFixed(PRECISION_CONFIG.CURRENCY),
      miscFeesTotal: adjustments.miscFeesTotal.toFixed(PRECISION_CONFIG.CURRENCY),
      transportationFee: adjustments.transportationFee.toFixed(PRECISION_CONFIG.CURRENCY),
      subtotal: adjustments.subtotal.toFixed(PRECISION_CONFIG.CURRENCY),
      total: adjustments.grandTotal.toFixed(PRECISION_CONFIG.CURRENCY),
      totalUnits: Number(totalUnits.toFixed(PRECISION_CONFIG.AREA)),
      errors: this.getErrors(),
      warnings: this.getWarnings(),
      summary: {
        totalItems,
        validItems,
        invalidItems: totalItems - validItems,
        totalCategories: this.categories.length,
        calculatedAt: new Date().toISOString()
      }
    };
  }

  _calculateAdjustments(materialCost, laborCost) {
    const laborDiscount = new Decimal(Math.max(0, Math.min(1, parseFloat(this.settings.laborDiscount) || 0)));
    const wasteFactor = new Decimal(Math.max(0, Math.min(CALCULATION_LIMITS.MAX_WASTE_FACTOR, parseFloat(this.settings.wasteFactor) || 0)));
    const taxRate = new Decimal(Math.max(0, Math.min(CALCULATION_LIMITS.MAX_TAX_RATE, parseFloat(this.settings.taxRate) || 0)));
    const markup = new Decimal(Math.max(0, Math.min(CALCULATION_LIMITS.MAX_MARKUP_RATE, parseFloat(this.settings.markup) || 0)));
    const transportationFee = new Decimal(Math.max(0, parseFloat(this.settings.transportationFee) || 0));

    const laborDiscountAmount = laborCost.times(laborDiscount);
    const adjustedLaborCost = laborCost.minus(laborDiscountAmount);
    
    const wasteCost = materialCost.times(wasteFactor);
    const materialCostWithWaste = materialCost.plus(wasteCost);
    
    const subtotal = materialCostWithWaste.plus(adjustedLaborCost);
    const taxAmount = subtotal.times(taxRate);
    const markupAmount = subtotal.times(markup);
    
    const miscFeesTotal = Array.isArray(this.settings.miscFees) 
      ? this.settings.miscFees.reduce((sum, fee) => {
          const amount = parseFloat(fee.amount) || 0;
          return sum.plus(new Decimal(Math.max(0, amount)));
        }, new Decimal(0))
      : new Decimal(0);

    const grandTotal = subtotal
      .plus(markupAmount)
      .plus(taxAmount)
      .plus(miscFeesTotal)
      .plus(transportationFee);

    return {
      laborDiscountAmount,
      adjustedLaborCost,
      wasteCost,
      materialCostWithWaste,
      markupAmount,
      taxAmount,
      miscFeesTotal,
      transportationFee,
      subtotal,
      grandTotal
    };
  }

  calculatePaymentDetails() {
    this.clearErrors();
    
    try {
      const { total: grandTotalStr } = this.calculateTotals();
      const grandTotal = new Decimal(grandTotalStr || '0');
      
      // Get payments from settings (deposit is now a payment with method: 'Deposit')
      const payments = Array.isArray(this.settings.payments) ? this.settings.payments : [];
      let totalPaid = new Decimal(0);
      let overduePayments = new Decimal(0);
      let depositAmount = new Decimal(0);
      
      const currentDate = new Date();
      
      payments.forEach((payment, index) => {
        try {
          const amount = parseFloat(payment.amount) || 0;
          const paymentDate = new Date(payment.date);
          const isPaid = Boolean(payment.isPaid);
          
          if (isPaid) {
            totalPaid = totalPaid.plus(new Decimal(amount));
            // Track deposit separately for display
            if (payment.method === 'Deposit') {
              depositAmount = depositAmount.plus(new Decimal(amount));
            }
          } else {
            if (paymentDate < currentDate) {
              overduePayments = overduePayments.plus(new Decimal(amount));
            }
          }
        } catch (error) {
          this.addWarning(`Error processing payment ${index + 1}: ${error.message}`, 'PAYMENT_PROCESSING_ERROR', { payment, index });
        }
      });
      
      const totalDue = grandTotal.minus(totalPaid);
      const finalTotalDue = Decimal.max(totalDue, new Decimal(0));
      
      return {
        totalPaid: totalPaid.toFixed(PRECISION_CONFIG.CURRENCY),
        totalDue: finalTotalDue.toFixed(PRECISION_CONFIG.CURRENCY),
        overduePayments: overduePayments.toFixed(PRECISION_CONFIG.CURRENCY),
        grandTotal: grandTotal.toFixed(PRECISION_CONFIG.CURRENCY),
        deposit: depositAmount.toFixed(PRECISION_CONFIG.CURRENCY), // Return actual deposit amount
        errors: this.getErrors(),
        warnings: this.getWarnings(),
        summary: {
          totalPayments: payments.length,
          paidPayments: payments.filter(p => p.isPaid).length,
          overduePayments: payments.filter(p => !p.isPaid && new Date(p.date) < currentDate).length,
          calculatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.addError(`Payment calculation error: ${error.message}`, 'PAYMENT_CALCULATION_ERROR', { originalError: error.message });
      
      return {
        totalPaid: '0.00',
        totalDue: '0.00', 
        overduePayments: '0.00',
        grandTotal: '0.00',
        deposit: '0.00',
        errors: this.getErrors(),
        warnings: this.getWarnings(),
        summary: {
          totalPayments: 0,
          paidPayments: 0,
          overduePayments: 0,
          calculatedAt: new Date().toISOString()
        }
      };
    }
  }

  calculateBreakdowns() {
    return this.calculateCategoryBreakdowns();
  }

  clearCache() {
    this.calculationCache.clear();
    this.cacheStats = { hits: 0, misses: 0 };
  }

  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : '0.00';
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      cacheSize: this.calculationCache.size
    };
  }

  getEngineStatus() {
    return {
      isReady: this.errors.size === 0,
      errorCount: this.errors.size,
      warningCount: this.warnings.size,
      categories: this.categories.length,
      settings: Object.keys(this.settings).length,
      lastCalculation: new Date().toISOString()
    };
  }

  reset() {
    this.clearErrors();
    this.clearCache();
  }
}