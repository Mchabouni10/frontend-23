// src/components/Calculator/utils/helpers.js
// ---------------------------------------------------------------------------
function getUnitsFromSurfaces(item) {
  if (!item || !Array.isArray(item.surfaces)) return 0;

  return item.surfaces.reduce((sum, surface) => {
    if (!surface) return sum;

    // Use the surface's own measurementType first; fall back to the item's.
    // Both are normalised to the canonical strings by the time they reach here.
    const type = (surface.measurementType || item.measurementType || '').toLowerCase();

    let units = 0;

    if (type === 'sqft') {
      // Prefer stored sqft; derive from width × height if absent
      units =
        parseFloat(surface.sqft) ||
        (parseFloat(surface.width || 0) * parseFloat(surface.height || 0));
    } else if (type === 'linear-foot') {
      units = parseFloat(surface.linearFt) || 0;
    } else if (type === 'by-unit') {
      units = parseFloat(surface.units) || 0;
    } else {
      // Unknown type — fall back to sqft derivation so we don't silently zero out
      units =
        parseFloat(surface.sqft) ||
        (parseFloat(surface.width || 0) * parseFloat(surface.height || 0));
    }

    return sum + units;
  }, 0);
}

// ---------------------------------------------------------------------------
// projectTotals — mirrors the frontend CalculatorEngine and backend
// calculateCostsAndTotals() so summary pages show consistent numbers.
// ---------------------------------------------------------------------------
export const projectTotals = (project) => {
  const categories = project.categories || [];
  const settings = project.settings || {};

  let materialCost = 0;
  let laborCost = 0;

  categories.forEach((cat) => {
    (cat.workItems || []).forEach((item) => {
      // FIX #1: read units from surfaces[], not top-level legacy fields
      const units = getUnitsFromSurfaces(item);
      materialCost += (parseFloat(item.materialCost) || 0) * units;
      laborCost += (parseFloat(item.laborCost) || 0) * units;
    });
  });

  // Apply adjustments — logic unchanged from original
  const laborDiscount = Math.max(
    0,
    Math.min(1, parseFloat(settings.laborDiscount) || 0),
  );
  const adjustedLabor = laborCost * (1 - laborDiscount);

  const wasteFactor = parseFloat(settings.wasteFactor) || 0;
  const materialWithWaste = materialCost * (1 + wasteFactor);

  const subtotal = materialWithWaste + adjustedLabor;

  const taxRate = parseFloat(settings.taxRate) || 0;
  const markup = parseFloat(settings.markup) || 0;
  const transportation = parseFloat(settings.transportationFee) || 0;

  const miscFees = (settings.miscFees || []).reduce(
    (sum, fee) => sum + (parseFloat(fee.amount) || 0),
    0,
  );

  const grandTotal =
    subtotal * (1 + markup) * (1 + taxRate) + transportation + miscFees;

  const totalPaid = (settings.payments || []).reduce((sum, p) => {
    return p && p.isPaid ? sum + (parseFloat(p.amount) || 0) : sum;
  }, 0);

  return {
    grandTotal,
    amountRemaining: Math.max(
      0,
      grandTotal -
        (parseFloat(settings.deposit) || 0) -
        totalPaid,
    ),
  };
};

export const formatDate = (date) =>
  date ? date.toLocaleDateString() : 'N/A';

export const formatTimestamp = (date) =>
  date ? date.toLocaleString() : 'N/A';