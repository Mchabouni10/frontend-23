// src/constants/financialCalculator.js
/**
 * ================================================================
 * FINANCIAL CALCULATOR — SINGLE SOURCE OF TRUTH
 * ================================================================
 *
 * All formulas here are intentionally aligned with CalculatorEngine.js:
 *
 *   subtotal = (materialCost + waste) + adjustedLaborCost
 *   tax      = subtotal × taxRate
 *   markup   = subtotal × markupRate          ← waste IS in the base
 *   grandTotal = subtotal + markup + tax + transportation + miscFees
 *
 * Deposit is stored by PaymentTracking.jsx as a payment entry inside
 * settings.payments[] with type === "Deposit" and isPaid === true.
 * The flat settings.deposit field is legacy — never rely on it alone.
 * ================================================================
 */

// ─── CORE: single project cost calculator ────────────────────────────────────

/**
 * Calculate all costs, fees, and the grand total for one project.
 * Matches CalculatorEngine._calculateAdjustments exactly.
 */
export const calculateProjectCosts = (project) => {
  const categories = project.categories || [];
  let materialCost = 0;
  let laborCost = 0;
  const materialBreakdown = [];
  const laborBreakdown = [];

  categories.forEach((cat) => {
    (cat.workItems || []).forEach((item) => {
      // Match CalculatorEngine.calculateWorkUnits exactly:
      // surfaces use sqft OR width×height (SQUARE_FOOT), linearFt, or units.
      // Without this, items stored as width/height get 0 units → wrong totals.
      const surfaces = item.surfaces || [];
      let units = 0;

      if (surfaces.length > 0) {
        const mType = (item.measurementType || "").toLowerCase();
        const isLinear = mType.includes("linear") || mType === "linearfoot";
        const isByUnit = mType.includes("unit") || mType.includes("piece") || mType.includes("each");

        units = surfaces.reduce((sum, surf) => {
          if (isLinear) {
            return sum + (parseFloat(surf.linearFt) || 0);
          } else if (isByUnit) {
            return sum + (parseInt(surf.units) || 0);
          } else {
            // SQUARE_FOOT: prefer sqft, fall back to width × height
            const sqft = parseFloat(surf.sqft) || 0;
            if (sqft > 0) return sum + sqft;
            const w = parseFloat(surf.width) || 0;
            const h = parseFloat(surf.height) || 0;
            return sum + (w * h);
          }
        }, 0);
      }

      // No surfaces — read direct item-level measurement fields
      if (units === 0) {
        units =
          parseFloat(item.sqft) ||
          parseFloat(item.linearFt) ||
          parseInt(item.units) ||
          0;
      }

      const itemMaterial = (parseFloat(item.materialCost) || 0) * units;
      const itemLabor = (parseFloat(item.laborCost) || 0) * units;

      materialCost += itemMaterial;
      laborCost += itemLabor;

      if (itemMaterial > 0) {
        materialBreakdown.push({
          category: cat.name,
          workType: item.type || item.customWorkName || "Unknown",
          units,
          costPerUnit: parseFloat(item.materialCost) || 0,
          total: itemMaterial,
        });
      }
      if (itemLabor > 0) {
        laborBreakdown.push({
          category: cat.name,
          workType: item.type || item.customWorkName || "Unknown",
          units,
          costPerUnit: parseFloat(item.laborCost) || 0,
          total: itemLabor,
        });
      }
    });
  });

  // Labor discount
  const laborDiscountRate = parseFloat(project.settings?.laborDiscount) || 0;
  const laborDiscountAmount = laborCost * laborDiscountRate;
  const adjustedLaborCost = laborCost - laborDiscountAmount;

  // Waste — uses wasteEntries[] when available, falls back to flat wasteFactor
  // Applied to materialCost ONLY, matching CalculatorEngine._calculateWaste
  let waste = 0;
  if ((project.settings?.wasteEntries || []).length > 0) {
    waste = project.settings.wasteEntries.reduce(
      (sum, entry) =>
        sum +
        (parseFloat(entry.surfaceCost) || 0) *
          (parseFloat(entry.wasteFactor) || 0),
      0
    );
  } else {
    waste = materialCost * (parseFloat(project.settings?.wasteFactor) || 0);
  }

  // Subtotal = (material + waste) + labor  ← CalculatorEngine formula
  const subtotal = materialCost + waste + adjustedLaborCost;

  // Tax & markup applied to subtotal (which includes waste)
  const taxRate = parseFloat(project.settings?.taxRate) || 0;
  const markupRate = parseFloat(project.settings?.markup) || 0;
  const tax = subtotal * taxRate;
  const markup = subtotal * markupRate;

  const transportation = parseFloat(project.settings?.transportationFee) || 0;
  const miscFees = (project.settings?.miscFees || []).reduce(
    (sum, fee) => sum + (parseFloat(fee.amount) || 0),
    0
  );

  const totalProjectValue = subtotal + markup + tax + transportation + miscFees;

  return {
    materialCost,
    laborCost: adjustedLaborCost,
    laborCostBeforeDiscount: laborCost,
    laborDiscountAmount,
    waste,
    tax,
    markup,
    transportation,
    miscFees,
    subtotal,
    totalProjectValue,
    materialBreakdown,
    laborBreakdown,
  };
};

// ─── PAYMENTS ────────────────────────────────────────────────────────────────

/**
 * Calculate all payment metrics for one project.
 *
 * PaymentTracking stores the deposit as a payments[] entry with
 * type === "Deposit" and isPaid === true.
 * We count ALL paid entries (including that deposit entry) then guard
 * against the legacy case where settings.deposit flat field also exists.
 */
export const calculateProjectPayments = (project) => {
  const payments = project.settings?.payments || [];
  const now = new Date();

  // Does a Deposit-type entry already exist in the payments array?
  const hasDepositEntry = payments.some(
    (p) => p.type === "Deposit" || (p.method || "").toLowerCase() === "deposit"
  );

  // Only read the flat deposit field when no payment entry holds it
  // (avoids double-counting legacy vs new format)
  const flatDeposit = hasDepositEntry
    ? 0
    : parseFloat(project.settings?.deposit) || 0;

  // Canonical deposit value for display
  const depositEntry = payments.find(
    (p) => p.type === "Deposit" || (p.method || "").toLowerCase() === "deposit"
  );
  const deposit = hasDepositEntry
    ? parseFloat(depositEntry?.amount || 0)
    : flatDeposit;

  let totalPaid = flatDeposit;
  const paidPayments = [];
  const pendingPayments = [];
  const overduePayments = [];

  payments.forEach((p) => {
    const amount = parseFloat(p.amount) || 0;
    const dueDate = p.date ? new Date(p.date) : null;

    if (p.isPaid) {
      totalPaid += amount;
      paidPayments.push({ ...p, amount });
    } else {
      pendingPayments.push({ ...p, amount });
      if (dueDate && dueDate < now) {
        overduePayments.push({ ...p, amount });
      }
    }
  });

  const { totalProjectValue } = calculateProjectCosts(project);
  const remainingBalance = Math.max(0, totalProjectValue - totalPaid);

  return {
    deposit,
    totalPaid,
    remainingBalance,
    totalProjectValue,
    paidPayments,
    pendingPayments,
    overduePayments,
    isFullyPaid: remainingBalance <= 0.01,
  };
};

// ─── PROFIT ──────────────────────────────────────────────────────────────────

/**
 * Project Expenses (COGS) = material + waste + tax
 * Labor is treated as profit / owner value, NOT an expense.
 *
 * Gross Profit  = collections - COGS
 * Net Profit    = collections - totalProjectValue
 *   (net is negative when project hasn't been fully paid yet)
 */
export const calculateProjectProfit = (project) => {
  const costs = calculateProjectCosts(project);
  const payments = calculateProjectPayments(project);

  const cogs = costs.materialCost + costs.waste + costs.tax;
  const grossProfit = payments.totalPaid - cogs;
  const netProfit = payments.totalPaid - costs.totalProjectValue;

  return {
    revenue: payments.totalPaid,
    cogs,
    grossProfit,
    netProfit,
    grossProfitMargin:
      payments.totalPaid > 0 ? (grossProfit / payments.totalPaid) * 100 : 0,
    netProfitMargin:
      payments.totalPaid > 0 ? (netProfit / payments.totalPaid) * 100 : 0,
  };
};

// ─── ADDITIONAL REVENUE ───────────────────────────────────────────────────────

/**
 * Additional Revenue = markup + transportation — ONLY for fully-paid projects.
 * Returns zeroes when project is not fully paid.
 */
export const calculateAdditionalRevenue = (project) => {
  const payments = calculateProjectPayments(project);
  if (!payments.isFullyPaid) return { markup: 0, transportation: 0, total: 0 };

  const costs = calculateProjectCosts(project);
  return {
    markup: costs.markup,
    transportation: costs.transportation,
    total: costs.markup + costs.transportation,
  };
};

// ─── AGGREGATION ─────────────────────────────────────────────────────────────

/**
 * Aggregate financials across an array of projects with optional date filter.
 */
export const calculateAggregatedFinancials = (projects, dateFilter = null) => {
  const result = {
    // Collections
    totalCollections: 0,
    totalDeposits: 0,
    totalGrandValue: 0,       // sum of all project grand totals (what's owed)

    // Costs (ALL projects regardless of payment status)
    totalMaterialCost: 0,
    totalLaborCost: 0,
    totalWaste: 0,
    totalTax: 0,
    totalCOGS: 0,             // material + waste + tax

    // Fees
    totalMarkup: 0,
    totalTransportation: 0,
    totalMiscFees: 0,

    // Additional Revenue (fully-paid projects only)
    additionalRevenue: { markup: 0, transportation: 0, total: 0 },

    // Profit
    totalGrossProfit: 0,
    totalNetProfit: 0,

    // Project counts
    totalProjects: 0,
    fullyPaidProjects: 0,
    projectsWithBalance: 0,

    // Payment method breakdown
    paymentMethods: {},

    // Breakdowns for charts
    materialBreakdown: {},
    laborBreakdown: {},

    // Outstanding / overdue
    totalOutstanding: 0,
    totalOverdue: 0,
  };

  if (!Array.isArray(projects)) return result;

  projects.forEach((project) => {
    // Only apply date filter when a specific range is selected.
    // When type === "all" (or no filter), include every project regardless
    // of whether customerInfo.startDate exists — the old check was silently
    // skipping projects with no startDate, causing the Grand Total to be
    // lower than the customer list total.
    if (dateFilter && dateFilter.type && dateFilter.type !== "all") {
      const projectDate = project.customerInfo?.startDate;
      if (!projectDate || !isDateInFilter(projectDate, dateFilter)) return;
    }

    result.totalProjects++;

    const costs = calculateProjectCosts(project);
    const payments = calculateProjectPayments(project);
    const profit = calculateProjectProfit(project);
    const addRev = calculateAdditionalRevenue(project);

    // Grand value (total owed by customer)
    result.totalGrandValue += costs.totalProjectValue;

    // Collections (money actually received)
    result.totalCollections += payments.totalPaid;
    result.totalDeposits += payments.deposit;

    // Costs — ALL projects
    result.totalMaterialCost += costs.materialCost;
    result.totalLaborCost += costs.laborCost;
    result.totalWaste += costs.waste;
    result.totalTax += costs.tax;
    result.totalCOGS += costs.materialCost + costs.waste + costs.tax;

    // Fees — ALL projects
    result.totalMarkup += costs.markup;
    result.totalTransportation += costs.transportation;
    result.totalMiscFees += costs.miscFees;

    // Additional Revenue — fully-paid only
    result.additionalRevenue.markup += addRev.markup;
    result.additionalRevenue.transportation += addRev.transportation;
    result.additionalRevenue.total += addRev.total;

    // Profit
    result.totalGrossProfit += profit.grossProfit;
    result.totalNetProfit += profit.netProfit;

    // Project status
    if (payments.isFullyPaid) {
      result.fullyPaidProjects++;
    } else {
      result.projectsWithBalance++;
      result.totalOutstanding += payments.remainingBalance;
    }

    // Overdue (unpaid-project balances only)
    if (!payments.isFullyPaid) {
      result.totalOverdue += payments.overduePayments.reduce(
        (s, p) => s + p.amount,
        0
      );
    }

    // Payment method breakdown
    // Deposit bucket from canonical deposit value (de-duped)
    if (payments.deposit > 0) {
      result.paymentMethods["Deposit"] =
        (result.paymentMethods["Deposit"] || 0) + payments.deposit;
    }
    payments.paidPayments.forEach((p) => {
      // Skip deposit entries — already counted above
      if (
        p.type === "Deposit" ||
        (p.method || "").toLowerCase() === "deposit"
      )
        return;
      const method = p.method || "Cash";
      result.paymentMethods[method] =
        (result.paymentMethods[method] || 0) + p.amount;
    });

    // Material breakdown
    costs.materialBreakdown.forEach((item) => {
      const key = `${item.category} — ${item.workType}`;
      result.materialBreakdown[key] =
        (result.materialBreakdown[key] || 0) + item.total;
    });

    // Labor breakdown
    costs.laborBreakdown.forEach((item) => {
      const key = `${item.category} — ${item.workType}`;
      result.laborBreakdown[key] =
        (result.laborBreakdown[key] || 0) + item.total;
    });
  });

  return result;
};

// ─── MONTHLY TIME-SERIES ──────────────────────────────────────────────────────

export const generateMonthlyData = (
  projects,
  companyExpenses,
  dateFilter = null
) => {
  const monthlyData = {};

  const getMonthKey = (date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Collect all relevant dates to build the month range
  const allDates = [];
  projects.forEach((p) => {
    if (p.customerInfo?.startDate) allDates.push(new Date(p.customerInfo.startDate));
    (p.settings?.payments || []).forEach((pay) => {
      if (pay.date && pay.isPaid) allDates.push(new Date(pay.date));
    });
  });
  companyExpenses.forEach((e) => {
    if (e.date) allDates.push(new Date(e.date));
  });

  if (allDates.length === 0) return {};
  const validDates = allDates.filter((d) => !isNaN(d.getTime()));
  if (validDates.length === 0) return {};

  const sorted = [...validDates].sort((a, b) => a - b);
  const cur = new Date(sorted[0]);
  cur.setDate(1);
  const end = sorted[sorted.length - 1];

  while (cur <= end) {
    const key = getMonthKey(cur);
    if (key) {
      monthlyData[key] = {
        label: cur.toLocaleString("default", { month: "short", year: "numeric" }),
        collections: 0,
        materialCost: 0,
        laborCost: 0,
        projectExpenses: 0,
        companyExpenses: 0,
        profit: 0,
        projectCount: 0,
      };
    }
    cur.setMonth(cur.getMonth() + 1);
  }

  projects.forEach((project) => {
    if (dateFilter && dateFilter.type && dateFilter.type !== "all") {
      const projectDate = project.customerInfo?.startDate;
      if (!projectDate || !isDateInFilter(projectDate, dateFilter)) return;
    }

    const costs = calculateProjectCosts(project);
    const payments = calculateProjectPayments(project);

    // All paid payments by their own date (includes deposit entry)
    payments.paidPayments.forEach((payment) => {
      if (payment.date) {
        const mk = getMonthKey(payment.date);
        if (mk && monthlyData[mk]) {
          monthlyData[mk].collections += payment.amount;
        }
      }
    });

    // Costs allocated to project start month
    if (project.customerInfo?.startDate) {
      const mk = getMonthKey(project.customerInfo.startDate);
      if (mk && monthlyData[mk]) {
        monthlyData[mk].materialCost += costs.materialCost;
        monthlyData[mk].laborCost += costs.laborCost;
        monthlyData[mk].projectExpenses +=
          costs.materialCost + costs.waste + costs.tax;
        monthlyData[mk].projectCount++;
      }
    }
  });

  companyExpenses.forEach((expense) => {
    if (expense.date) {
      const mk = getMonthKey(expense.date);
      if (mk && monthlyData[mk]) {
        monthlyData[mk].companyExpenses += parseFloat(expense.amount) || 0;
      }
    }
  });

  Object.keys(monthlyData).forEach((key) => {
    const d = monthlyData[key];
    d.profit = d.collections - d.projectExpenses - d.companyExpenses;
  });

  return monthlyData;
};

// ─── COMPANY EXPENSES ────────────────────────────────────────────────────────

export const aggregateCompanyExpenses = (companyExpenses, dateFilter = null) => {
  const categoryTotals = {};
  let total = 0;

  if (!Array.isArray(companyExpenses)) return { categoryTotals, total };

  companyExpenses.forEach((expense) => {
    if (dateFilter && expense.date && !isDateInFilter(expense.date, dateFilter))
      return;
    const amount = parseFloat(expense.amount) || 0;
    const category = expense.category || "other";
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    total += amount;
  });

  return { categoryTotals, total };
};

// ─── DATE FILTER ─────────────────────────────────────────────────────────────

const isDateInFilter = (date, filter) => {
  if (!date || !filter) return true;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;

  if (filter.type === "year") {
    return d.getFullYear() === (filter.year || new Date().getFullYear());
  }
  if (filter.type === "custom" && filter.startDate && filter.endDate) {
    const start = new Date(filter.startDate);
    const end = new Date(filter.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  return true;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export const formatCurrency = (amount) =>
  (parseFloat(amount) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatPercentage = (value, decimals = 1) =>
  `${(parseFloat(value) || 0).toFixed(decimals)}%`;

export const getCategoryName = (catId) => {
  const map = {
    fuel: "Fuel / Van",
    vehicle_maint: "Vehicle Maintenance",
    phone: "Phone Bill",
    website: "Website / Hosting",
    software: "Software / Subscriptions",
    marketing: "Marketing / Ads",
    insurance: "Insurance",
    tools: "Tools",
    material: "Materials",
    subcontractors: "Subcontractors",
    permits: "Permits / Licenses",
    office: "Office Supplies",
    rent: "Rent / Utilities",
    disposal: "Waste Disposal",
    taxes: "Taxes / Fees",
    meals: "Meals / Entertainment",
    other: "Other",
  };
  return map[catId] || catId;
};