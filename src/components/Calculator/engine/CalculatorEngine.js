// src/components/Calculator/engine/CalculatorEngine.js
import Decimal from 'decimal.js';
import { MEASUREMENT_TYPES, normalizeMeasurementType } from '../../../constants/measurementTypes';

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
  MAX_UNIT_COST: 10000,   // per-unit rate cap enforced in the UI (CostInput)
  MIN_UNIT_VALUE: 0.01,
  MAX_SURFACES_PER_ITEM: 100,
  MAX_ITEMS_PER_CATEGORY: 200,
  MAX_CATEGORIES: 50,
  MAX_TAX_RATE: 0.25,
  MAX_MARKUP_RATE: 5.0,
  MAX_WASTE_FACTOR: 0.50,
};

// Re-export for backwards compatibility
export { MEASUREMENT_TYPES };

// ─── Shared utilities ────────────────────────────────────────────────────────
// Exported so every component uses the exact same logic as the engine.
// Never redefine parseNumber or formatCurrency locally in a component.

/**
 * Safely converts any value to a finite number.
 * Handles strings, numbers, null, undefined, and currency-formatted strings.
 * Returns 0 for anything that cannot be parsed.
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Single Intl.NumberFormat instance — creating it is expensive; reusing is free.
const _currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a number as a USD currency string, e.g. "$1,234.56".
 * Always uses en-US locale for consistency across all browsers and regions.
 * Safely handles string input via parseNumber.
 */
export function formatCurrency(value) {
  return _currencyFormatter.format(parseNumber(value));
}
// ─────────────────────────────────────────────────────────────────────────────

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
        wasteEntries: [],
        markup: 0,
        transportationFee: 0,
        miscFees: [],
        payments: [],
        credits: []
      };
    }
    return {
      taxRate: 0,
      laborDiscount: 0,
      wasteFactor: 0,
      wasteEntries: [],
      markup: 0,
      transportationFee: 0,
      miscFees: [],
      payments: [],
      credits: [],
      ...settings
    };
  }

  addError(message, code = 'CALCULATION_ERROR', details = {}) {
    const errorId = `${code}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.errors.set(errorId, {
      id: errorId,
      message,
      code,
      timestamp: new Date().toISOString(),
      context: details
    });
    return errorId;
  }

  addWarning(message, code = 'CALCULATION_WARNING', details = {}) {
    const warningId = `${code}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.warnings.set(warningId, {
      id: warningId,
      message,
      code,
      timestamp: new Date().toISOString(),
      context: details
    });
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

  _makeCacheKey(prefix) {
    try {
      return `${prefix}::${JSON.stringify(this.categories)}::${JSON.stringify(this.settings)}`;
    } catch {
      return null;
    }
  }

  calculateWorkUnits(item) {
    this.clearErrors();

    if (!item || typeof item !== 'object') {
      this.addError('Invalid work item');
      return { units: 0, label: 'units', errors: this.getErrors() };
    }

    const measurementType = normalizeMeasurementType(item.measurementType);
    const surfaces = Array.isArray(item.surfaces) ? item.surfaces : [];

    if (surfaces.length === 0) {
      return this._calculateDirectUnits(item, measurementType);
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
            surfaceUnits = parseFloat(surface.units) || 0;
            break;
          default:
            this.addWarning(`Unknown measurement type: ${measurementType}`, 'UNKNOWN_MEASUREMENT_TYPE', { measurementType, surface, index });
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

    return {
      units: Number(Math.max(0, totalUnits).toFixed(PRECISION_CONFIG.AREA)),
      label,
      errors: this.getErrors(),
      warnings: this.getWarnings()
    };
  }

  _calculateDirectUnits(item, measurementType = null) {
    const normalizedType = measurementType || normalizeMeasurementType(item.measurementType);
    let totalUnits = 0;
    let label = this._getUnitLabel(normalizedType);

    try {
      switch (normalizedType) {
        case MEASUREMENT_TYPES.SQUARE_FOOT:
          if (item.sqft && item.sqft > 0) {
            totalUnits = parseFloat(item.sqft) || 0;
          } else if (item.width && item.height) {
            totalUnits = (parseFloat(item.width) || 0) * (parseFloat(item.height) || 0);
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
      case MEASUREMENT_TYPES.SQUARE_FOOT: return 'sqft';
      case MEASUREMENT_TYPES.LINEAR_FOOT: return 'linear ft';
      case MEASUREMENT_TYPES.BY_UNIT: return 'units';
      default: return 'units';
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
        measurementType: normalizeMeasurementType(item.measurementType),
        errors: this.getErrors(),
        warnings: this.getWarnings(),
        metadata: {
          units: 0,
          materialCostPerUnit: materialCost.toFixed(PRECISION_CONFIG.RATES),
          laborCostPerUnit: laborCost.toFixed(PRECISION_CONFIG.RATES),
          measurementType: normalizeMeasurementType(item.measurementType),
          calculatedAt: new Date().toISOString()
        }
      };
    }

    try {
      const matDec = new Decimal(materialCost);
      const labDec = new Decimal(laborCost);
      const unitsDec = new Decimal(units);

      const totalMaterial = matDec.times(unitsDec);
      const totalLabor = labDec.times(unitsDec);
      const totalCost = totalMaterial.plus(totalLabor);
      const measurementType = normalizeMeasurementType(item.measurementType);

      return {
        units,
        unitLabel: label,
        materialCost: totalMaterial.toFixed(PRECISION_CONFIG.CURRENCY),
        laborCost: totalLabor.toFixed(PRECISION_CONFIG.CURRENCY),
        totalCost: totalCost.toFixed(PRECISION_CONFIG.CURRENCY),
        // INDUSTRY FIX: expose measurementType so calculateTotals() can
        // separate wasteable (SF/LF) from non-wasteable (BY_UNIT) costs.
        measurementType,
        errors: this.getErrors(),
        warnings: this.getWarnings(),
        metadata: {
          units,
          materialCostPerUnit: matDec.toFixed(PRECISION_CONFIG.RATES),
          laborCostPerUnit: labDec.toFixed(PRECISION_CONFIG.RATES),
          measurementType,
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
      measurementType: null,
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

      (category.workItems || []).forEach((item, itemIndex) => {
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
    // Try cache first
    if (this.options.enableCaching) {
      const key = this._makeCacheKey('totals');
      if (key && this.calculationCache.has(key)) {
        this.cacheStats.hits++;
        return this.calculationCache.get(key);
      }
      this.cacheStats.misses++;
    }

    this.clearErrors();

    let totalMaterialCost = new Decimal(0);    // all material (SF + LF + EA)
    let wasteableMaterialCost = new Decimal(0); // only SF + LF material
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
            const itemMaterial = new Decimal(costResult.materialCost);
            totalMaterialCost = totalMaterialCost.plus(itemMaterial);
            laborCost = laborCost.plus(new Decimal(costResult.laborCost));
            totalUnits += costResult.units || 0;

            // INDUSTRY FIX #1: Only SF and LF items are wasteable.
            // BY_UNIT items (faucets, fixtures, etc.) are never wasted —
            // a contractor buys exactly what they need.
            const mt = costResult.measurementType;
            if (
              mt === MEASUREMENT_TYPES.SQUARE_FOOT ||
              mt === MEASUREMENT_TYPES.LINEAR_FOOT
            ) {
              wasteableMaterialCost = wasteableMaterialCost.plus(itemMaterial);
            }
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

    const adjustments = this._calculateAdjustments(
      totalMaterialCost,
      wasteableMaterialCost,
      laborCost
    );

    const result = {
      materialCost: totalMaterialCost.toFixed(PRECISION_CONFIG.CURRENCY),
      laborCost: adjustments.adjustedLaborCost.toFixed(PRECISION_CONFIG.CURRENCY),
      laborCostBeforeDiscount: laborCost.toFixed(PRECISION_CONFIG.CURRENCY),
      laborDiscount: adjustments.laborDiscountAmount.toFixed(PRECISION_CONFIG.CURRENCY),
      wasteCost: adjustments.wasteCost.toFixed(PRECISION_CONFIG.CURRENCY),
      taxAmount: adjustments.taxAmount.toFixed(PRECISION_CONFIG.CURRENCY),
      markupAmount: adjustments.markupAmount.toFixed(PRECISION_CONFIG.CURRENCY),
      miscFeesTotal: adjustments.miscFeesTotal.toFixed(PRECISION_CONFIG.CURRENCY),
      creditsTotal: adjustments.creditsTotal.toFixed(PRECISION_CONFIG.CURRENCY),
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

    // Store in cache
    if (this.options.enableCaching) {
      const key = this._makeCacheKey('totals');
      if (key) {
        if (this.calculationCache.size >= this.options.maxCacheSize) {
          const firstKey = this.calculationCache.keys().next().value;
          this.calculationCache.delete(firstKey);
        }
        this.calculationCache.set(key, result);
      }
    }

    return result;
  }

  // INDUSTRY FIX #1: Waste is calculated only on the wasteable material cost
  // (SF + LF items) passed in — BY_UNIT items are excluded upstream in
  // calculateTotals(). This prevents inflating the price of faucets, toilets,
  // fixtures, and any other item purchased as a whole unit.
  _calculateWaste(wasteableMaterialCost) {
    const wasteEntries = Array.isArray(this.settings.wasteEntries)
      ? this.settings.wasteEntries
      : [];

    if (wasteEntries.length > 0) {
      // Per-surface waste: sum each entry's (surfaceCost × wasteFactor)
      const wasteTotal = wasteEntries.reduce((sum, entry) => {
        const surfaceCost = Math.max(0, parseFloat(entry.surfaceCost) || 0);
        const factor = Math.max(
          0,
          Math.min(
            CALCULATION_LIMITS.MAX_WASTE_FACTOR,
            parseFloat(entry.wasteFactor) || 0
          )
        );
        return sum.plus(new Decimal(surfaceCost).times(new Decimal(factor)));
      }, new Decimal(0));
      return wasteTotal;
    }

    // Global waste factor fallback — still applied only to wasteable materials
    const wasteFactor = new Decimal(
      Math.max(
        0,
        Math.min(
          CALCULATION_LIMITS.MAX_WASTE_FACTOR,
          parseFloat(this.settings.wasteFactor) || 0
        )
      )
    );
    return wasteableMaterialCost.times(wasteFactor);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Order of operations (industry-standard for US contractors):
  //
  //  1. Raw material cost (all types)
  //  2. + Waste             → on SF/LF materials only (not BY_UNIT)
  //  3. = Adjusted material cost
  //  4. − Labor discount
  //  5. = Job subtotal      (adjusted materials + discounted labor)
  //
  //  INDUSTRY FIX #2: Tax on materials ONLY (not labor).
  //  In Illinois and most US states, contractors collect / remit Use Tax
  //  on physical materials installed. Labor is a service and is NOT taxed.
  //  6. + Tax               → on adjusted material cost only
  //
  //  INDUSTRY FIX #3: Cost-plus markup on the full job subtotal.
  //  Formula: subtotal × (1 + markup%)
  //  This is the standard small-contractor formula. The markup is applied
  //  to the pre-tax subtotal so the contractor earns their margin on the
  //  whole job, and tax is a separate pass-through.
  //  7. + Markup            → on job subtotal (pre-tax)
  //
  //  8. + Misc fees + Transportation (flat pass-through, not taxed/marked-up)
  //  9. = Grand total
  // ─────────────────────────────────────────────────────────────────────────
  _calculateAdjustments(totalMaterialCost, wasteableMaterialCost, laborCost) {
    const laborDiscount = new Decimal(
      Math.max(0, Math.min(1, parseFloat(this.settings.laborDiscount) || 0))
    );
    const taxRate = new Decimal(
      Math.max(
        0,
        Math.min(CALCULATION_LIMITS.MAX_TAX_RATE, parseFloat(this.settings.taxRate) || 0)
      )
    );
    const markup = new Decimal(
      Math.max(
        0,
        Math.min(CALCULATION_LIMITS.MAX_MARKUP_RATE, parseFloat(this.settings.markup) || 0)
      )
    );
    const transportationFee = new Decimal(
      Math.max(0, parseFloat(this.settings.transportationFee) || 0)
    );

    // Step 1-2: Waste on SF/LF materials only
    const wasteCost = this._calculateWaste(wasteableMaterialCost);
    const adjustedMaterialCost = totalMaterialCost.plus(wasteCost);

    // Step 3-4: Labor discount
    const laborDiscountAmount = laborCost.times(laborDiscount);
    const adjustedLaborCost = laborCost.minus(laborDiscountAmount);

    // Step 5: Pre-tax job subtotal
    const subtotal = adjustedMaterialCost.plus(adjustedLaborCost);

    // Step 6 — INDUSTRY FIX #2: Tax on materials only, not labor.
    // Applying tax to labor would cause the contractor to over-collect
    // Illinois Use Tax, creating a compliance risk.
    const taxAmount = adjustedMaterialCost.times(taxRate);

    // Step 7 — INDUSTRY FIX #3: Cost-plus markup.
    // Formula: subtotal × markup%  (the grand total becomes subtotal × (1 + markup%)).
    // Markup is on the pre-tax subtotal so the contractor profits on the
    // full job cost, and tax is a separate government pass-through.
    const markupAmount = subtotal.times(markup);

    // Step 8: Misc fees (flat, no tax, no markup)
    const miscFeesTotal = Array.isArray(this.settings.miscFees)
      ? this.settings.miscFees.reduce((sum, fee) => {
          const amount = parseFloat(fee.amount) || 0;
          return sum.plus(new Decimal(Math.max(0, amount)));
        }, new Decimal(0))
      : new Decimal(0);

    // Step 8b — Credits / price adjustments (e.g. damaged product, price
    // change, customer dissatisfaction). Unlike a refund, a credit reduces
    // the contract price itself, not just the amount collected. Each entry's
    // magnitude is stored positive and always SUBTRACTED here — this is the
    // one place in the app that lowers the grand total, so every other
    // screen (cost breakdown, estimate/contract, payment tracking) stays in
    // sync automatically once it reads `total` from this engine.
    const creditsTotal = Array.isArray(this.settings.credits)
      ? this.settings.credits.reduce((sum, credit) => {
          const amount = parseFloat(credit.amount) || 0;
          return sum.plus(new Decimal(Math.max(0, amount)));
        }, new Decimal(0))
      : new Decimal(0);

    // Step 9: Grand total
    const preCreditTotal = subtotal
      .plus(markupAmount)
      .plus(taxAmount)
      .plus(miscFeesTotal)
      .plus(transportationFee);

    const grandTotal = Decimal.max(preCreditTotal.minus(creditsTotal), new Decimal(0));

    return {
      laborDiscountAmount,
      adjustedLaborCost,
      wasteCost,
      adjustedMaterialCost,
      markupAmount,
      taxAmount,
      miscFeesTotal,
      creditsTotal,
      transportationFee,
      subtotal,
      grandTotal
    };
  }

  calculatePaymentDetails(precomputedGrandTotal = null) {
    this.clearErrors();

    try {
      const grandTotalStr = precomputedGrandTotal !== null
        ? String(precomputedGrandTotal)
        : this.calculateTotals().total;

      const grandTotal = new Decimal(grandTotalStr || '0');

      const payments = Array.isArray(this.settings.payments) ? this.settings.payments : [];
      let totalPaid = new Decimal(0);
      let totalRefunded = new Decimal(0);
      let overduePayments = new Decimal(0);
      let depositTotal = new Decimal(0);

      const currentDate = new Date();

      payments.forEach((payment, index) => {
        try {
          if (!payment || typeof payment !== 'object') {
            this.addWarning(`Invalid payment at index ${index}`, 'INVALID_PAYMENT', { payment, index });
            return;
          }

          const amount = parseFloat(payment.amount) || 0;
          const paymentDate = new Date(payment.date);
          const isPaid = Boolean(payment.isPaid);
          const paymentType = (payment.type || payment.paymentType || '').toLowerCase();
          const paymentMethod = (payment.method || '').toLowerCase();
          const paymentNote = (payment.note || payment.description || '').toLowerCase();

          if (paymentType === 'refund') {
            totalRefunded = totalRefunded.plus(new Decimal(amount));
            return;
          }

          if (isPaid && amount > 0) {
            totalPaid = totalPaid.plus(new Decimal(amount));

            if (
              paymentType === 'deposit' ||
              paymentMethod === 'deposit' ||
              paymentNote.includes('deposit')
            ) {
              depositTotal = depositTotal.plus(new Decimal(amount));
            }
          } else if (!isPaid && amount > 0) {
            if (paymentDate < currentDate) {
              overduePayments = overduePayments.plus(new Decimal(amount));
            }
          }
        } catch (error) {
          this.addWarning(`Error processing payment ${index + 1}: ${error.message}`, 'PAYMENT_PROCESSING_ERROR', { payment, index, error: error.message });
        }
      });

      const netPaid = Decimal.max(totalPaid.minus(totalRefunded), new Decimal(0));
      const totalDue = grandTotal.minus(netPaid);
      const finalTotalDue = Decimal.max(totalDue, new Decimal(0));
      const collectiblePayments = payments.filter(p => {
        const paymentType = (p?.type || p?.paymentType || '').toLowerCase();
        return p && paymentType !== 'refund';
      });

      // Refund is intentionally locked behind "everything scheduled has
      // actually been paid" — it exists only to hand back money the
      // customer already fully paid in past the project total, never to
      // change the project's price (that's what credits are for).
      const isFullyPaid = collectiblePayments.length > 0 &&
        collectiblePayments.every(p => Boolean(p?.isPaid));
      const overpaidAmount = Decimal.max(netPaid.minus(grandTotal), new Decimal(0));
      const isOverpaid = overpaidAmount.greaterThan(0);
      const refundReady = isFullyPaid && isOverpaid;

      const creditsTotal = Array.isArray(this.settings.credits)
        ? this.settings.credits.reduce((sum, credit) => {
            const amount = parseFloat(credit.amount) || 0;
            return sum.plus(new Decimal(Math.max(0, amount)));
          }, new Decimal(0))
        : new Decimal(0);

      return {
        totalPaid: netPaid.toFixed(PRECISION_CONFIG.CURRENCY),
        totalRefunded: totalRefunded.toFixed(PRECISION_CONFIG.CURRENCY),
        totalCredits: creditsTotal.toFixed(PRECISION_CONFIG.CURRENCY),
        totalDue: finalTotalDue.toFixed(PRECISION_CONFIG.CURRENCY),
        overduePayments: overduePayments.toFixed(PRECISION_CONFIG.CURRENCY),
        grandTotal: grandTotal.toFixed(PRECISION_CONFIG.CURRENCY),
        deposit: depositTotal.toFixed(PRECISION_CONFIG.CURRENCY),
        isFullyPaid,
        isOverpaid,
        overpaidAmount: overpaidAmount.toFixed(PRECISION_CONFIG.CURRENCY),
        refundReady,
        errors: this.getErrors(),
        warnings: this.getWarnings(),
        summary: {
          totalPayments: collectiblePayments.length,
          paidPayments: collectiblePayments.filter(p => p && p.isPaid).length,
          refundedPayments: payments.filter(p => {
            const paymentType = (p?.type || p?.paymentType || '').toLowerCase();
            return paymentType === 'refund';
          }).length,
          overduePayments: collectiblePayments.filter(p => p && !p.isPaid && new Date(p.date) < currentDate).length,
          calculatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.addError(`Payment calculation error: ${error.message}`, 'PAYMENT_CALCULATION_ERROR', { originalError: error.message });
      return {
        totalPaid: '0.00',
        totalRefunded: '0.00',
        totalCredits: '0.00',
        totalDue: '0.00',
        overduePayments: '0.00',
        grandTotal: '0.00',
        deposit: '0.00',
        isFullyPaid: false,
        isOverpaid: false,
        overpaidAmount: '0.00',
        refundReady: false,
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