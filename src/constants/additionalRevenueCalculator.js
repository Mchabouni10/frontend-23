// src/components/Calculator/utils/additionalRevenueCalculator.js

/**
 * SHARED ADDITIONAL REVENUE CALCULATOR
 * =====================================
 * This utility ensures consistent additional revenue calculations
 * across all pages: Finance Dashboard, Company Expenses, Customers Table
 * 
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for additional revenue
 */

/**
 * Calculate project's material and labor costs
 * @param {Object} project - Project object
 * @returns {Object} - { materialCost, laborCost, laborCostBeforeDiscount }
 */
const calculateProjectCosts = (project) => {
  let materialCost = 0;
  let laborCost = 0;

  const categories = project.categories || [];
  
  categories.forEach((cat) => {
    const workItems = cat.workItems || [];
    
    workItems.forEach((item) => {
      // Calculate units (sqft, linear ft, or units)
      const units =
        (item.surfaces || []).reduce(
          (sum, surf) => sum + (parseFloat(surf.sqft) || 0),
          0
        ) ||
        parseFloat(item.linearFt) ||
        parseFloat(item.units) ||
        0;

      materialCost += (parseFloat(item.materialCost) || 0) * units;
      laborCost += (parseFloat(item.laborCost) || 0) * units;
    });
  });

  const laborDiscountRate = parseFloat(project.settings?.laborDiscount) || 0;
  const laborDiscountAmount = laborCost * laborDiscountRate;
  const adjustedLaborCost = laborCost - laborDiscountAmount;

  return {
    materialCost,
    laborCost: adjustedLaborCost,
    laborCostBeforeDiscount: laborCost,
    laborDiscountAmount,
  };
};

/**
 * Calculate base subtotal (material + labor after discount)
 * @param {Object} project - Project object
 * @returns {number} - Base subtotal
 */
const calculateBaseSubtotal = (project) => {
  const { materialCost, laborCost } = calculateProjectCosts(project);
  return materialCost + laborCost;
};

/**
 * Calculate total project value including all fees
 * @param {Object} project - Project object
 * @returns {number} - Total project value
 */
export const calculateTotalProjectValue = (project) => {
  const baseSubtotal = calculateBaseSubtotal(project);

  // Waste calculation
  let waste = 0;
  if (project.settings?.wasteEntries?.length > 0) {
    waste = project.settings.wasteEntries.reduce(
      (sum, entry) =>
        sum +
        (parseFloat(entry.surfaceCost) || 0) *
          (parseFloat(entry.wasteFactor) || 0),
      0
    );
  } else {
    waste = baseSubtotal * (project.settings?.wasteFactor || 0);
  }

  const tax = baseSubtotal * (project.settings?.taxRate || 0);
  const markup = baseSubtotal * (project.settings?.markup || 0);
  const transportation = parseFloat(project.settings?.transportationFee) || 0;
  const misc = (project.settings?.miscFees || []).reduce(
    (sum, fee) => sum + (parseFloat(fee.amount) || 0),
    0
  );

  return baseSubtotal + markup + tax + waste + transportation + misc;
};

/**
 * Check if a project is fully paid
 * @param {Object} project - Project object
 * @returns {boolean} - True if fully paid (balance <= $0.01)
 */
export const isProjectFullyPaid = (project) => {
  const payments = project.settings?.payments || [];
  const deposit = project.settings?.deposit || 0;

  // Calculate lifetime collections (all paid payments + deposit)
  const lifetimeCollections =
    payments.reduce(
      (sum, p) => sum + (p.isPaid ? parseFloat(p.amount) || 0 : 0),
      0
    ) + deposit;

  const totalProjectValue = calculateTotalProjectValue(project);
  const remainingBalance = totalProjectValue - lifetimeCollections;

  // Project is fully paid if remaining balance is $0.01 or less (tolerance for rounding)
  return remainingBalance <= 0.01;
};

/**
 * Calculate additional revenue (markup + transportation) for a single project
 * ONLY if the project is fully paid
 * @param {Object} project - Project object
 * @returns {Object} - { markup, transportation, total }
 */
export const getProjectAdditionalRevenue = (project) => {
  const baseSubtotal = calculateBaseSubtotal(project);
  const markup = baseSubtotal * (project.settings?.markup || 0);
  const transportation = parseFloat(project.settings?.transportationFee) || 0;

  return {
    markup,
    transportation,
    total: markup + transportation,
  };
};

/**
 * Calculate total additional revenue from all fully paid projects
 * @param {Array} projects - Array of project objects
 * @param {Object} filters - Optional filters { year, startDate, endDate }
 * @returns {Object} - { totalMarkup, totalTransportation, total, projectCount }
 */
export const calculateAdditionalRevenue = (projects, filters = {}) => {
  if (!Array.isArray(projects)) {
    return { totalMarkup: 0, totalTransportation: 0, total: 0, projectCount: 0 };
  }

  let totalMarkup = 0;
  let totalTransportation = 0;
  let projectCount = 0;

  projects.forEach((project) => {
    // Check if project matches date filters
    if (filters.year || filters.startDate || filters.endDate) {
      const projectDateStr = project.customerInfo?.startDate;
      if (!projectDateStr) return;

      const projectDate = new Date(projectDateStr);

      // Year filter
      if (filters.year && projectDate.getFullYear() !== filters.year) {
        return;
      }

      // Custom date range filter
      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (projectDate < start || projectDate > end) {
          return;
        }
      }
    }

    // CRITICAL: Only count revenue if project is fully paid
    if (!isProjectFullyPaid(project)) return;

    const revenue = getProjectAdditionalRevenue(project);
    totalMarkup += revenue.markup;
    totalTransportation += revenue.transportation;
    projectCount++;
  });

  return {
    totalMarkup,
    totalTransportation,
    total: totalMarkup + totalTransportation,
    projectCount,
  };
};

/**
 * Calculate additional revenue for current year
 * @param {Array} projects - Array of project objects
 * @returns {Object} - { totalMarkup, totalTransportation, total, projectCount }
 */
export const calculateYearlyAdditionalRevenue = (projects) => {
  const currentYear = new Date().getFullYear();
  return calculateAdditionalRevenue(projects, { year: currentYear });
};

/**
 * Calculate additional revenue breakdown by category
 * Useful for detailed analysis
 * @param {Array} projects - Array of project objects
 * @returns {Object} - Breakdown by category
 */
export const calculateAdditionalRevenueBreakdown = (projects) => {
  const result = {
    byStatus: {
      fullyPaid: { count: 0, markup: 0, transportation: 0, total: 0 },
      outstanding: { count: 0, markup: 0, transportation: 0, total: 0 },
    },
    byYear: {},
  };

  if (!Array.isArray(projects)) return result;

  projects.forEach((project) => {
    const revenue = getProjectAdditionalRevenue(project);
    const fullyPaid = isProjectFullyPaid(project);
    
    // By status
    const status = fullyPaid ? 'fullyPaid' : 'outstanding';
    result.byStatus[status].count++;
    
    if (fullyPaid) {
      result.byStatus[status].markup += revenue.markup;
      result.byStatus[status].transportation += revenue.transportation;
      result.byStatus[status].total += revenue.total;
    }

    // By year
    const projectDateStr = project.customerInfo?.startDate;
    if (projectDateStr) {
      const year = new Date(projectDateStr).getFullYear();
      if (!result.byYear[year]) {
        result.byYear[year] = { count: 0, markup: 0, transportation: 0, total: 0 };
      }
      result.byYear[year].count++;
      
      if (fullyPaid) {
        result.byYear[year].markup += revenue.markup;
        result.byYear[year].transportation += revenue.transportation;
        result.byYear[year].total += revenue.total;
      }
    }
  });

  return result;
};

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Get additional revenue summary text for display
 * @param {Array} projects - Array of project objects
 * @param {Object} filters - Optional filters
 * @returns {string} - Summary text (e.g., "+ $1,234.56 Add. Revenue")
 */
export const getAdditionalRevenueSummary = (projects, filters = {}) => {
  const { total } = calculateAdditionalRevenue(projects, filters);
  return `+ $${formatCurrency(total)} Add. Revenue`;
};