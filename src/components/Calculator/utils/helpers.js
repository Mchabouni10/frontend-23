//src/components/Calculator/utils/helpers.js

import { calculateTotal } from '../calculations/costCalculations';
export const projectTotals = (project) => {
    const totals = calculateTotal(
      project.categories || [],
      project.settings?.taxRate || 0,
      project.settings?.transportationFee || 0,
      project.settings?.wasteFactor || 0,
      project.settings?.miscFees || [],
      project.settings?.markup || 0
    );
    const grandTotal = totals.total || 0;
    return {
      grandTotal,
      amountRemaining: Math.max(0, Math.max(0, grandTotal - (project.settings?.deposit || 0)) - (project.settings?.amountPaid || 0))
    };
  };
  
  export const formatDate = (date) => date ? date.toLocaleDateString() : 'N/A';
  export const formatTimestamp = (date) => date ? date.toLocaleString() : 'N/A';