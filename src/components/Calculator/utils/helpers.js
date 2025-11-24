//src/components/Calculator/utils/helpers.js

// Simple calculation helper to avoid circular dependencies or missing files
export const projectTotals = (project) => {
  const categories = project.categories || [];
  const settings = project.settings || {};

  // Calculate base costs
  let materialCost = 0;
  let laborCost = 0;

  categories.forEach(cat => {
    (cat.workItems || []).forEach(item => {
      // Calculate units based on measurement type
      let units = 0;
      if (item.measurementType === 'square-foot') {
        units = parseFloat(item.sqft) || (parseFloat(item.width || 0) * parseFloat(item.height || 0));
      } else if (item.measurementType === 'linear-foot') {
        units = parseFloat(item.linearFt) || 0;
      } else {
        units = parseFloat(item.units) || 0;
      }

      materialCost += (parseFloat(item.materialCost) || 0) * units;
      laborCost += (parseFloat(item.laborCost) || 0) * units;
    });
  });

  // Apply adjustments
  const laborDiscount = Math.max(0, Math.min(1, parseFloat(settings.laborDiscount) || 0));
  const adjustedLabor = laborCost * (1 - laborDiscount);

  const wasteFactor = parseFloat(settings.wasteFactor) || 0;
  const materialWithWaste = materialCost * (1 + wasteFactor);

  const subtotal = materialWithWaste + adjustedLabor;

  const taxRate = parseFloat(settings.taxRate) || 0;
  const markup = parseFloat(settings.markup) || 0;
  const transportation = parseFloat(settings.transportationFee) || 0;

  const miscFees = (settings.miscFees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);

  const grandTotal = subtotal * (1 + markup) * (1 + taxRate) + transportation + miscFees;

  return {
    grandTotal,
    amountRemaining: Math.max(0, grandTotal - (parseFloat(settings.deposit) || 0) - (parseFloat(settings.amountPaid) || 0))
  };
};

export const formatDate = (date) => date ? date.toLocaleDateString() : 'N/A';
export const formatTimestamp = (date) => date ? date.toLocaleString() : 'N/A';