// src/components/FinanceDashboard/FinanceDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { getProjects } from "../../services/projectService";
import { getAllExpenses } from "../../utilities/expenses-api";
import {
  calculateAggregatedFinancials,
  generateMonthlyData,
  aggregateCompanyExpenses,
  formatCurrency,
  formatPercentage,
  getCategoryName,
  calculateProjectPayments,
} from "../../constants/financialCalculator";
import { Doughnut, Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faDollarSign,
  faPercentage,
  faArrowTrendUp,
  faEye,
  faEyeSlash,
  faSpinner,
  faMoneyBillWave,
  faWallet,
  faTools,
  faPaintRoller,
  faExclamationTriangle,
  faCheckCircle,
  faClipboardList,
  faCalendarAlt,
  faChartPie,
  faChartBar,
  faHandHoldingDollar,
  faClockRotateLeft,
  faFileInvoiceDollar,
  faCoins,
  faArrowUp,
  faArrowDown,
  faShieldHalved,
  faTrophy,
  faFire,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./FinanceDashboard.module.css";

ChartJS.register(
  ArcElement,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
);

export default function FinanceDashboard() {
  const [projects, setProjects] = useState([]);
  const [companyExpenses, setCompanyExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState({
    type: "all",
    year: null,
    startDate: null,
    endDate: null,
  });
  const [visibleCharts, setVisibleCharts] = useState({
    projectStatus: true,
    materialCost: true,
    laborCost: true,
    additionalRevenue: true,
    grandTotalVsPayments: true,
    avgProjectValue: true,
    monthlyCollections: true,
    projectExpenses: true,
    companyExpensesByCategory: true,
    monthlyExpenses: true,
    paymentMethods: true,
    monthlyProfit: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectsData, expensesData] = await Promise.all([
          getProjects(),
          getAllExpenses(),
        ]);
        setProjects(projectsData || []);
        setCompanyExpenses(expensesData || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load financial data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ─── All financial data from the single source of truth ────────────────────
  const financialData = useMemo(() => {
    if (!projects.length && !companyExpenses.length) return null;

    const aggregated = calculateAggregatedFinancials(projects, dateFilter);
    const monthlyData = generateMonthlyData(
      projects,
      companyExpenses,
      dateFilter,
    );
    const expenseData = aggregateCompanyExpenses(companyExpenses, dateFilter);

    // Avg Project Value = sum of all project grand totals / count
    // (NOT collections/count — those are different things)
    const avgProjectValue =
      aggregated.totalProjects > 0
        ? aggregated.totalGrandValue / aggregated.totalProjects
        : 0;

    const collectionRate =
      aggregated.totalProjects > 0
        ? (aggregated.fullyPaidProjects / aggregated.totalProjects) * 100
        : 0;

    const expensePercentage =
      aggregated.totalCollections > 0
        ? (aggregated.totalCOGS / aggregated.totalCollections) * 100
        : 0;

    const grossMargin =
      aggregated.totalCollections > 0
        ? (aggregated.totalGrossProfit / aggregated.totalCollections) * 100
        : 0;

    const netMargin =
      aggregated.totalCollections > 0
        ? (aggregated.totalNetProfit / aggregated.totalCollections) * 100
        : 0;

    return {
      ...aggregated,
      monthlyData,
      companyExpenseCategories: expenseData.categoryTotals,
      totalCompanyExpenses: expenseData.total,
      avgProjectValue,
      collectionRate,
      expensePercentage,
      grossMargin,
      netMargin,
    };
  }, [projects, companyExpenses, dateFilter]);

  const toggleChart = (chartName) =>
    setVisibleCharts((prev) => ({ ...prev, [chartName]: !prev[chartName] }));

  // ─── Loading / Error / Empty states ────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.loading}>
        <FontAwesomeIcon icon={faSpinner} className={styles.loadingIcon} spin />
        <p className={styles.loadingText}>Loading Financial Analytics...</p>
        <p className={styles.loadingSubtext}>
          Preparing your comprehensive financial dashboard
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <FontAwesomeIcon
          icon={faExclamationTriangle}
          className={styles.errorIcon}
        />
        <h3 className={styles.errorText}>Error Loading Data</h3>
        <p className={styles.errorSubtext}>{error}</p>
      </div>
    );
  }

  if (!financialData) {
    return (
      <div className={styles.noData}>
        <FontAwesomeIcon icon={faClipboardList} className={styles.noDataIcon} />
        <h3 className={styles.noDataText}>No Financial Data Available</h3>
        <p className={styles.noDataSubtext}>
          Start by creating projects and adding expenses to unlock comprehensive
          financial insights.
        </p>
      </div>
    );
  }

  // ─── Chart shared config ───────────────────────────────────────────────────
  const premiumChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: "easeOutQuart" },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 10,
          font: { size: 10, weight: "600", family: "'Poppins', sans-serif" },
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          boxHeight: 8,
          color: "#4a5568",
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 20, 35, 0.92)",
        titleColor: "#f0f4ff",
        bodyColor: "#c8d3e8",
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 11, weight: "700", family: "'Poppins', sans-serif" },
        bodyFont: { size: 10, weight: "500", family: "'Poppins', sans-serif" },
        displayColors: true,
        boxPadding: 4,
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || ctx.label || "";
            const value =
              ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
            return `  ${label}: $${formatCurrency(value)}`;
          },
        },
      },
    },
  };

  const lineChartOptions = {
    ...premiumChartOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 9, family: "'Poppins', sans-serif" },
          color: "#718096",
          maxRotation: 35,
        },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(0,0,0,0.04)", drawTicks: false },
        ticks: {
          font: { size: 9, family: "'Poppins', sans-serif" },
          color: "#718096",
          callback: (v) => "$" + (v / 1000).toFixed(0) + "K",
        },
        border: { display: false },
      },
    },
  };

  const barChartOptions = {
    ...premiumChartOptions,
    scales: {
      x: {
        stacked: false,
        grid: { display: false },
        ticks: {
          font: { size: 9, family: "'Poppins', sans-serif" },
          color: "#718096",
          maxRotation: 35,
        },
        border: { display: false },
      },
      y: {
        stacked: false,
        grid: { color: "rgba(0,0,0,0.04)", drawTicks: false },
        ticks: {
          font: { size: 9, family: "'Poppins', sans-serif" },
          color: "#718096",
          callback: (v) => "$" + (v / 1000).toFixed(0) + "K",
        },
        border: { display: false },
      },
    },
  };

  // ─── Color palettes ────────────────────────────────────────────────────────
  const palette = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
  ];

  // ─── Monthly labels ─────────────────────────────────────────────────────────
  const monthlyLabels = Object.values(financialData.monthlyData).map(
    (d) => d.label,
  );

  // ─── Chart datasets ────────────────────────────────────────────────────────

  // 1. Project Status — number of projects, fully paid vs outstanding + customer count
  const projectStatusData = {
    labels: ["Fully Paid", "With Balance"],
    datasets: [
      {
        label: "Projects",
        data: [
          financialData.fullyPaidProjects,
          financialData.projectsWithBalance,
        ],
        backgroundColor: ["#10b981", "#f59e0b"],
        borderWidth: 3,
        borderColor: "#fff",
        hoverOffset: 10,
      },
    ],
  };

  // 2. Total Material Cost (all projects) — includes waste as part of the breakdown
  const materialCostData = {
    labels: ["Material Cost", "Waste Factor"],
    datasets: [
      {
        label: "Amount",
        data: [financialData.totalMaterialCost, financialData.totalWaste],
        backgroundColor: ["#3b82f6", "#f59e0b"],
        borderWidth: 3,
        borderColor: "#fff",
        hoverOffset: 10,
      },
    ],
  };

  // 3. Labor Cost (all projects) — shown as profit value
  const laborCostData = {
    labels: monthlyLabels.length ? monthlyLabels : ["Total"],
    datasets: [
      {
        label: "Labor Value (Profit)",
        data: monthlyLabels.length
          ? Object.values(financialData.monthlyData).map((d) => d.laborCost)
          : [financialData.totalLaborCost],
        borderColor: "#ec4899",
        backgroundColor: "rgba(236,72,153,0.08)",
        fill: true,
        tension: 0.45,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#ec4899",
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        borderWidth: 2,
      },
    ],
  };

  // 4. Additional Revenue — markup + transportation, fully-paid projects only
  const additionalRevenueData = {
    labels: ["Markup", "Transportation"],
    datasets: [
      {
        label: "Additional Revenue",
        data: [
          financialData.additionalRevenue.markup,
          financialData.additionalRevenue.transportation,
        ],
        backgroundColor: ["#6366f1", "#10b981"],
        borderWidth: 3,
        borderColor: "#fff",
        hoverOffset: 10,
      },
    ],
  };

  // 5. Grand Total vs Paid vs Outstanding — one bar per project
  // We build this directly from the projects array so each project
  // is its own group on the x-axis, making the bars clearly visible.
  const grandTotalVsPaymentsLabels = projects.map((p) => {
    const name =
      p.customerInfo?.firstName ||
      p.customerInfo?.name ||
      p.customerInfo?.lastName ||
      "Project";
    const last =
      p.customerInfo?.lastName && p.customerInfo?.firstName
        ? ` ${p.customerInfo.lastName[0]}.`
        : "";
    return `${name}${last}`;
  });

  // Pre-compute per-project payment data using the canonical calculator
  // so Grand Total, Collected, and Outstanding are always consistent.
  const perProjectPayments = projects.map((p) => {
    const pmts = calculateProjectPayments(p);
    return {
      grandTotal: pmts.totalProjectValue,
      collected: pmts.totalPaid,
      outstanding: pmts.remainingBalance,
    };
  });

  const grandTotalVsPaymentsData = {
    labels:
      grandTotalVsPaymentsLabels.length > 0
        ? grandTotalVsPaymentsLabels
        : ["No Projects"],
    datasets: [
      {
        label: "Grand Total (Contract)",
        data: perProjectPayments.map((p) => p.grandTotal),
        backgroundColor: "rgba(99, 102, 241, 0.85)",
        borderColor: "#6366f1",
        borderWidth: 1.5,
        borderRadius: 5,
      },
      {
        label: "Collected",
        data: perProjectPayments.map((p) => p.collected),
        backgroundColor: "rgba(16, 185, 129, 0.85)",
        borderColor: "#10b981",
        borderWidth: 1.5,
        borderRadius: 5,
      },
      {
        label: "Outstanding Balance",
        data: perProjectPayments.map((p) => p.outstanding),
        backgroundColor: "rgba(245, 158, 11, 0.85)",
        borderColor: "#f59e0b",
        borderWidth: 1.5,
        borderRadius: 5,
      },
    ],
  };

  // Dedicated options for this grouped bar chart
  const grandTotalBarOptions = {
    ...barChartOptions,
    plugins: {
      ...barChartOptions.plugins,
      legend: {
        ...barChartOptions.plugins?.legend,
        position: "top",
      },
      tooltip: {
        ...barChartOptions.plugins?.tooltip,
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const value = ctx.parsed.y;
            return `  ${label}: $${formatCurrency(value)}`;
          },
        },
      },
    },
    scales: {
      ...barChartOptions.scales,
      x: {
        ...barChartOptions.scales?.x,
        grouped: true,
      },
    },
  };

  // 6. Avg Project Value — bar showing per-project average
  const avgProjectValueData = {
    labels: ["Avg Project Value", "Avg Collections", "Avg Outstanding"],
    datasets: [
      {
        label: "Amount",
        data: [
          financialData.avgProjectValue,
          financialData.totalProjects > 0
            ? financialData.totalCollections / financialData.totalProjects
            : 0,
          financialData.projectsWithBalance > 0
            ? financialData.totalOutstanding / financialData.projectsWithBalance
            : 0,
        ],
        backgroundColor: ["#6366f1", "#10b981", "#f59e0b"],
        borderWidth: 2,
        borderColor: "#fff",
        borderRadius: 6,
      },
    ],
  };

  // 7. Monthly Collections Trend
  const monthlyCollectionsData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Collections",
        data: Object.values(financialData.monthlyData).map(
          (d) => d.collections,
        ),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.08)",
        fill: true,
        tension: 0.45,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#10b981",
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        borderWidth: 2,
      },
    ],
  };

  // 8. Project Expenses Breakdown — materials + waste + taxes (labor excluded)
  const projectExpensesData = {
    labels: ["Materials", "Waste", "Tax"],
    datasets: [
      {
        label: "Amount",
        data: [
          financialData.totalMaterialCost,
          financialData.totalWaste,
          financialData.totalTax,
        ],
        backgroundColor: ["#3498db", "#f39c12", "#9b59b6"],
        borderWidth: 3,
        borderColor: "#fff",
        hoverOffset: 10,
      },
    ],
  };

  // 9. Company Expenses by Category
  const companyExpensesData = {
    labels: Object.keys(financialData.companyExpenseCategories).map(
      getCategoryName,
    ),
    datasets: [
      {
        label: "Expense Amount",
        data: Object.values(financialData.companyExpenseCategories),
        backgroundColor: palette,
        borderWidth: 3,
        borderColor: "#fff",
        hoverOffset: 10,
      },
    ],
  };

  // 10. Monthly Expenses Comparison
  const monthlyExpensesData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Project Costs",
        data: Object.values(financialData.monthlyData).map(
          (d) => d.projectExpenses,
        ),
        backgroundColor: "#3498db",
        borderWidth: 2,
        borderColor: "#fff",
        borderRadius: 4,
      },
      {
        label: "Company Expenses",
        data: Object.values(financialData.monthlyData).map(
          (d) => d.companyExpenses,
        ),
        backgroundColor: "#e74c3c",
        borderWidth: 2,
        borderColor: "#fff",
        borderRadius: 4,
      },
    ],
  };

  // 11. Payment Methods
  const paymentMethodsData = {
    labels: Object.keys(financialData.paymentMethods).filter(
      (k) => financialData.paymentMethods[k] > 0,
    ),
    datasets: [
      {
        label: "Payment Amount",
        data: Object.keys(financialData.paymentMethods)
          .filter((k) => financialData.paymentMethods[k] > 0)
          .map((k) => financialData.paymentMethods[k]),
        backgroundColor: palette,
        borderWidth: 3,
        borderColor: "#fff",
        hoverOffset: 10,
      },
    ],
  };

  // 12. Monthly Profit Trend
  const monthlyProfitData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Net Profit",
        data: Object.values(financialData.monthlyData).map((d) => d.profit),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99, 102, 241, 0.08)",
        fill: true,
        tension: 0.45,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#6366f1",
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        borderWidth: 2,
      },
    ],
  };

  // ─── Chart render helper ───────────────────────────────────────────────────
  const renderChart = (
    chartName,
    title,
    subtitle,
    ChartComponent,
    data,
    options,
    size = "half",
    icon = faChartPie,
  ) => {
    if (!visibleCharts[chartName]) return null;
    return (
      <div
        className={`${styles.chartCard} ${styles[`size-${size}`]}`}
        key={chartName}
      >
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>
              <FontAwesomeIcon icon={icon} />
              {title}
            </h3>
            {subtitle && <p className={styles.chartSubtitle}>{subtitle}</p>}
          </div>
          <div className={styles.chartActions}>
            <button
              className={styles.chartButton}
              onClick={() => toggleChart(chartName)}
              title="Hide chart"
            >
              <FontAwesomeIcon icon={faEyeSlash} />
            </button>
          </div>
        </div>
        <div className={styles.chartWrapper}>
          <ChartComponent
            data={data}
            options={options || premiumChartOptions}
          />
        </div>
      </div>
    );
  };

  const hiddenCharts = Object.entries(visibleCharts)
    .filter(([, visible]) => !visible)
    .map(([name]) => name);

  // Gross margin for color
  const grossMarginPct = financialData.grossMargin;
  const netMarginPct = financialData.netMargin;

  return (
    <main className={styles.dashboard}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>
          <FontAwesomeIcon icon={faChartLine} />
          Financial Analytics Dashboard
        </h1>
        <p className={styles.dashboardSubtitle}>
          Comprehensive insights into your business performance and financial
          health
        </p>
      </div>

      {/* Date Filter */}
      <div className={styles.filterSection}>
        <div className={styles.filterHeader}>
          <FontAwesomeIcon icon={faCalendarAlt} />
          Date Range Filter
        </div>
        <div className={styles.filterControls}>
          <select
            value={dateFilter.type}
            onChange={(e) =>
              setDateFilter({ ...dateFilter, type: e.target.value })
            }
            className={styles.filterSelect}
          >
            <option value="all">All Time</option>
            <option value="year">Specific Year</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateFilter.type === "year" && (
            <input
              type="number"
              placeholder="Year"
              value={dateFilter.year || new Date().getFullYear()}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, year: parseInt(e.target.value) })
              }
              className={styles.filterInput}
            />
          )}

          {dateFilter.type === "custom" && (
            <>
              <input
                type="date"
                value={dateFilter.startDate || ""}
                onChange={(e) =>
                  setDateFilter({ ...dateFilter, startDate: e.target.value })
                }
                className={styles.filterInput}
              />
              <input
                type="date"
                value={dateFilter.endDate || ""}
                onChange={(e) =>
                  setDateFilter({ ...dateFilter, endDate: e.target.value })
                }
                className={styles.filterInput}
              />
            </>
          )}

          <div className={styles.filterBadge}>
            <FontAwesomeIcon icon={faClipboardList} />
            {financialData.totalProjects} Projects Analyzed
          </div>
          <div className={styles.filterBadge}>
            <FontAwesomeIcon icon={faUsers} />
            {financialData.totalProjects} Customers
          </div>
        </div>
      </div>

      {/* Key Metric Cards */}
      <div className={styles.metricsGrid}>
        {/* Total Collections */}
        <div className={`${styles.metricCard} ${styles.positive}`}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
              }}
            >
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
            <div className={styles.metricTrend}>
              <FontAwesomeIcon icon={faArrowUp} /> Revenue
            </div>
          </div>
          <div className={styles.metricLabel}>Total Collections</div>
          <div className={styles.metricValue}>
            ${formatCurrency(financialData.totalCollections)}
          </div>
          <div className={styles.metricSubtext}>
            From {financialData.totalProjects} total projects
          </div>
          <div className={styles.metricProgress}>
            <div
              className={styles.metricProgressBar}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Material Cost (all projects, includes waste context) */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              }}
            >
              <FontAwesomeIcon icon={faTools} />
            </div>
            <div className={styles.metricTrend}>
              <FontAwesomeIcon icon={faCoins} /> Materials
            </div>
          </div>
          <div className={styles.metricLabel}>Total Material Cost</div>
          <div className={styles.metricValue}>
            ${formatCurrency(financialData.totalMaterialCost)}
          </div>
          <div className={styles.metricSubtext}>
            + ${formatCurrency(financialData.totalWaste)} waste factor — all
            projects
          </div>
          <div className={styles.metricProgress}>
            <div
              className={styles.metricProgressBar}
              style={{
                width: `${
                  financialData.totalCOGS > 0
                    ? (financialData.totalMaterialCost /
                        financialData.totalCOGS) *
                      100
                    : 0
                }%`,
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              }}
            />
          </div>
        </div>

        {/* Labor Cost (all projects) — treated as profit */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)",
              }}
            >
              <FontAwesomeIcon icon={faPaintRoller} />
            </div>
            <div className={styles.metricTrend}>
              <FontAwesomeIcon icon={faHandHoldingDollar} /> Labor
            </div>
          </div>
          <div className={styles.metricLabel}>Labor Value (Profit)</div>
          <div className={styles.metricValue}>
            ${formatCurrency(financialData.totalLaborCost)}
          </div>
          <div className={styles.metricSubtext}>
            {financialData.totalCollections > 0
              ? (
                  (financialData.totalLaborCost /
                    financialData.totalCollections) *
                  100
                ).toFixed(1)
              : "0.0"}
            % of Revenue — all projects
          </div>
          <div className={styles.metricProgress}>
            <div
              className={styles.metricProgressBar}
              style={{
                width: `${
                  financialData.totalCollections > 0
                    ? Math.min(
                        (financialData.totalLaborCost /
                          financialData.totalCollections) *
                          100,
                        100,
                      )
                    : 0
                }%`,
                background: "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)",
              }}
            />
          </div>
        </div>

        {/* Project Expenses */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            >
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className={styles.metricTrend}>Materials & Fees</div>
          </div>
          <div className={styles.metricLabel}>Project Expenses</div>
          <div className={styles.metricValue}>
            ${formatCurrency(financialData.totalCOGS)}
          </div>
          <div className={styles.metricSubtext}>
            {financialData.expensePercentage.toFixed(1)}% of revenue (mat +
            waste + tax)
          </div>
          <div className={styles.metricProgress}>
            <div
              className={styles.metricProgressBar}
              style={{
                width: `${Math.min(financialData.expensePercentage, 100)}%`,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            />
          </div>
        </div>

        {/* Company Expenses */}
        <div className={`${styles.metricCard} ${styles.negative}`}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)",
              }}
            >
              <FontAwesomeIcon icon={faWallet} />
            </div>
            <div className={`${styles.metricTrend} ${styles.negative}`}>
              <FontAwesomeIcon icon={faArrowDown} /> Overhead
            </div>
          </div>
          <div className={styles.metricLabel}>Company Expenses</div>
          <div className={styles.metricValue}>
            ${formatCurrency(financialData.totalCompanyExpenses)}
          </div>
          <div className={styles.metricSubtext}>Operating overhead costs</div>
        </div>

        {/* Gross Profit */}
        <div
          className={`${styles.metricCard} ${
            financialData.totalGrossProfit >= 0
              ? styles.positive
              : styles.negative
          }`}
        >
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background:
                  financialData.totalGrossProfit >= 0
                    ? "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
                    : "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)",
              }}
            >
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
            <div
              className={`${styles.metricTrend} ${
                financialData.totalGrossProfit < 0 ? styles.negative : ""
              }`}
            >
              <FontAwesomeIcon
                icon={
                  financialData.totalGrossProfit >= 0 ? faArrowUp : faArrowDown
                }
              />
              {financialData.totalGrossProfit >= 0 ? "Profitable" : "Loss"}
            </div>
          </div>
          <div className={styles.metricLabel}>Gross Profit</div>
          <div
            className={styles.metricValue}
            style={{
              color:
                financialData.totalGrossProfit >= 0 ? "#27ae60" : "#e74c3c",
            }}
          >
            {financialData.totalGrossProfit < 0 ? "-" : ""}$
            {formatCurrency(Math.abs(financialData.totalGrossProfit))}
          </div>
          <div className={styles.metricSubtext}>Collections minus Expenses</div>
        </div>

        {/* Gross Profit Margin */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            >
              <FontAwesomeIcon icon={faPercentage} />
            </div>
            <div className={styles.metricTrend}>
              <FontAwesomeIcon icon={faTrophy} /> Margin
            </div>
          </div>
          <div className={styles.metricLabel}>Gross Profit Margin</div>
          <div className={styles.metricValue}>
            {formatPercentage(grossMarginPct)}
          </div>
          <div className={styles.metricSubtext}>
            Target: 20-30% industry standard
          </div>
          <div className={styles.metricProgress}>
            <div
              className={styles.metricProgressBar}
              style={{
                width: `${Math.min((grossMarginPct / 30) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Fully Paid Projects — shows customer count */}
        <div className={`${styles.metricCard} ${styles.positive}`}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
              }}
            >
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className={styles.metricTrend}>
              <FontAwesomeIcon icon={faShieldHalved} />
              {financialData.collectionRate.toFixed(0)}%
            </div>
          </div>
          <div className={styles.metricLabel}>Fully Paid Projects</div>
          <div className={styles.metricValue}>
            {financialData.fullyPaidProjects} / {financialData.totalProjects}
          </div>
          <div className={styles.metricSubtext}>
            {financialData.totalProjects} customers —{" "}
            {financialData.collectionRate.toFixed(1)}% collection rate
          </div>
          <div className={styles.metricProgress}>
            <div
              className={styles.metricProgressBar}
              style={{ width: `${financialData.collectionRate}%` }}
            />
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className={`${styles.metricCard} ${styles.warning}`}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)",
              }}
            >
              <FontAwesomeIcon icon={faClockRotateLeft} />
            </div>
            <div className={`${styles.metricTrend} ${styles.negative}`}>
              <FontAwesomeIcon icon={faExclamationTriangle} /> Pending
            </div>
          </div>
          <div className={styles.metricLabel}>Outstanding Balance</div>
          <div className={styles.metricValue} style={{ color: "#e67e22" }}>
            ${formatCurrency(financialData.totalOutstanding)}
          </div>
          <div className={styles.metricSubtext}>
            From {financialData.projectsWithBalance} projects
          </div>
        </div>

        {/* Overdue */}
        <div className={`${styles.metricCard} ${styles.negative}`}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)",
              }}
            >
              <FontAwesomeIcon icon={faFire} />
            </div>
            <div className={`${styles.metricTrend} ${styles.negative}`}>
              <FontAwesomeIcon icon={faExclamationTriangle} /> Urgent
            </div>
          </div>
          <div className={styles.metricLabel}>Overdue Amount</div>
          <div className={styles.metricValue} style={{ color: "#e74c3c" }}>
            ${formatCurrency(financialData.totalOverdue)}
          </div>
          <div className={styles.metricSubtext}>
            Requires immediate attention
          </div>
        </div>

        {/* Additional Revenue — fully-paid only */}
        <div className={`${styles.metricCard} ${styles.positive}`}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
              }}
            >
              <FontAwesomeIcon icon={faArrowUp} />
            </div>
            <div className={styles.metricTrend}>
              <FontAwesomeIcon icon={faHandHoldingDollar} /> Markup + Transport
            </div>
          </div>
          <div className={styles.metricLabel}>Additional Revenue</div>
          <div className={styles.metricValue} style={{ color: "#27ae60" }}>
            ${formatCurrency(financialData.additionalRevenue.total)}
          </div>
          <div className={styles.metricSubtext}>
            From {financialData.fullyPaidProjects} fully paid projects
          </div>
        </div>

        {/* Avg Project Value — based on grand totals, not collections */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <div
              className={styles.metricIcon}
              style={{
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              }}
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
            </div>
            <div className={styles.metricTrend}>
              <FontAwesomeIcon icon={faChartBar} /> Average
            </div>
          </div>
          <div className={styles.metricLabel}>Avg Project Value</div>
          <div className={styles.metricValue}>
            ${formatCurrency(financialData.avgProjectValue)}
          </div>
          <div className={styles.metricSubtext}>
            Based on {financialData.totalProjects} projects
          </div>
        </div>
      </div>

      {/* ─── Charts: Revenue & Collections ─────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <FontAwesomeIcon icon={faMoneyBillWave} />
          Revenue & Collections Analysis
        </h2>
      </div>

      <div className={styles.chartGrid}>
        {renderChart(
          "projectStatus",
          "Projects — Paid vs Outstanding",
          `${financialData.totalProjects} customers total`,
          Doughnut,
          projectStatusData,
          premiumChartOptions,
          "third",
          faUsers,
        )}
        {renderChart(
          "monthlyCollections",
          "Monthly Collections Trend",
          "Revenue timeline and seasonal patterns",
          Line,
          monthlyCollectionsData,
          lineChartOptions,
          "twothirds",
          faChartLine,
        )}
        {renderChart(
          "paymentMethods",
          "Payment Methods Distribution",
          "How customers prefer to pay",
          Doughnut,
          paymentMethodsData,
          premiumChartOptions,
          "third",
          faChartPie,
        )}
      </div>

      {/* Grand Total chart — full width so every project bar is clear */}
      <div className={styles.chartGrid}>
        {renderChart(
          "grandTotalVsPayments",
          "Grand Total vs Collections vs Outstanding",
          "Per-project breakdown — contract value, money collected, and remaining balance",
          Bar,
          grandTotalVsPaymentsData,
          grandTotalBarOptions,
          "full",
          faMoneyBillWave,
        )}
      </div>

      {/* ─── Charts: Cost Analysis ──────────────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <FontAwesomeIcon icon={faDollarSign} />
          Cost Analysis & Breakdown
        </h2>
      </div>

      <div className={styles.chartGrid}>
        {renderChart(
          "materialCost",
          "Total Material Cost (All Projects)",
          "Material costs + waste factor across all projects",
          Doughnut,
          materialCostData,
          premiumChartOptions,
          "third",
          faTools,
        )}
        {renderChart(
          "laborCost",
          "Labor Value (Profit) — All Projects",
          "Monthly labor value trend — counted as owner profit",
          Line,
          laborCostData,
          lineChartOptions,
          "twothirds",
          faPaintRoller,
        )}
        {renderChart(
          "additionalRevenue",
          "Additional Revenue (Fully Paid Only)",
          "Markup + transportation — only from fully paid projects",
          Doughnut,
          additionalRevenueData,
          premiumChartOptions,
          "third",
          faHandHoldingDollar,
        )}
        {renderChart(
          "avgProjectValue",
          "Avg Project Value",
          "Average contract value, collections per project, and avg outstanding",
          Bar,
          avgProjectValueData,
          barChartOptions,
          "twothirds",
          faFileInvoiceDollar,
        )}
        {renderChart(
          "projectExpenses",
          "Project Expenses Breakdown",
          "Materials, waste, and taxes (Labor excluded)",
          Pie,
          projectExpensesData,
          premiumChartOptions,
          "third",
          faChartPie,
        )}
      </div>

      {/* ─── Charts: Company Expenses ───────────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <FontAwesomeIcon icon={faWallet} />
          Company Expenses & Overhead
        </h2>
      </div>

      <div className={styles.chartGrid}>
        {renderChart(
          "companyExpensesByCategory",
          "Company Expenses by Category",
          "Operating overhead breakdown",
          Doughnut,
          companyExpensesData,
          premiumChartOptions,
          "half",
          faWallet,
        )}
        {renderChart(
          "monthlyExpenses",
          "Monthly Expenses Comparison",
          "Project costs vs company overhead",
          Bar,
          monthlyExpensesData,
          barChartOptions,
          "half",
          faChartBar,
        )}
      </div>

      {/* ─── Charts: Profitability ──────────────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <FontAwesomeIcon icon={faArrowTrendUp} />
          Profitability & Performance
        </h2>
      </div>

      <div className={styles.chartGrid}>
        {renderChart(
          "monthlyProfit",
          "Monthly Profit Trend",
          "Track profitability over time",
          Line,
          monthlyProfitData,
          lineChartOptions,
          "full",
          faChartLine,
        )}
      </div>

      {/* ─── Detailed Financial Summary ─────────────────────────────────────── */}
      <div className={styles.summaryGrid}>
        {/* Revenue & Collections */}
        <div className={`${styles.summarySection} ${styles.revenue}`}>
          <h3 className={styles.summaryTitle}>
            <FontAwesomeIcon icon={faMoneyBillWave} />
            Revenue &amp; Collections
          </h3>
          <div className={styles.summaryItems}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Collections</span>
              <span className={`${styles.summaryValue} ${styles.positive}`}>
                ${formatCurrency(financialData.totalCollections)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                Grand Total (All Projects)
              </span>
              <span className={styles.summaryValue}>
                ${formatCurrency(financialData.totalGrandValue)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Deposits</span>
              <span className={styles.summaryValue}>
                ${formatCurrency(financialData.totalDeposits)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Average Project Value</span>
              <span className={styles.summaryValue}>
                ${formatCurrency(financialData.avgProjectValue)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Additional Revenue</span>
              <span className={`${styles.summaryValue} ${styles.positive}`}>
                ${formatCurrency(financialData.additionalRevenue.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Costs & Expenses */}
        <div className={`${styles.summarySection} ${styles.costs}`}>
          <h3 className={styles.summaryTitle}>
            <FontAwesomeIcon icon={faTools} />
            Costs &amp; Expenses
          </h3>
          <div className={styles.summaryItems}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Material Costs</span>
              <span className={styles.summaryValue}>
                ${formatCurrency(financialData.totalMaterialCost)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Labor Value (Profit)</span>
              <span className={`${styles.summaryValue} ${styles.positive}`}>
                ${formatCurrency(financialData.totalLaborCost)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Waste &amp; Tax</span>
              <span className={styles.summaryValue}>
                $
                {formatCurrency(
                  financialData.totalWaste + financialData.totalTax,
                )}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Expenses (COGS)</span>
              <span className={`${styles.summaryValue} ${styles.negative}`}>
                ${formatCurrency(financialData.totalCOGS)}
              </span>
            </div>
          </div>
        </div>

        {/* Profitability */}
        <div className={`${styles.summarySection} ${styles.profit}`}>
          <h3 className={styles.summaryTitle}>
            <FontAwesomeIcon icon={faArrowTrendUp} />
            Profitability
          </h3>
          <div className={styles.summaryItems}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Gross Profit</span>
              <span
                className={`${styles.summaryValue} ${
                  financialData.totalGrossProfit >= 0
                    ? styles.positive
                    : styles.negative
                }`}
              >
                {financialData.totalGrossProfit < 0 ? "-" : ""}$
                {formatCurrency(Math.abs(financialData.totalGrossProfit))}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Gross Margin</span>
              <span className={styles.summaryValue}>
                {formatPercentage(grossMarginPct)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Net Profit</span>
              <span
                className={`${styles.summaryValue} ${
                  financialData.totalNetProfit >= 0
                    ? styles.positive
                    : styles.negative
                }`}
              >
                {financialData.totalNetProfit < 0 ? "-" : ""}$
                {formatCurrency(Math.abs(financialData.totalNetProfit))}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Net Margin</span>
              <span
                className={`${styles.summaryValue} ${
                  netMarginPct >= 0 ? "" : styles.negative
                }`}
              >
                {formatPercentage(netMarginPct)}
              </span>
            </div>
          </div>
        </div>

        {/* Project Status */}
        <div className={`${styles.summarySection} ${styles.status}`}>
          <h3 className={styles.summaryTitle}>
            <FontAwesomeIcon icon={faClipboardList} />
            Project Status
          </h3>
          <div className={styles.summaryItems}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Projects</span>
              <span className={styles.summaryValue}>
                {financialData.totalProjects}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Customers</span>
              <span className={styles.summaryValue}>
                {financialData.totalProjects}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Fully Paid</span>
              <span className={`${styles.summaryValue} ${styles.positive}`}>
                {financialData.fullyPaidProjects}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>With Balance</span>
              <span className={`${styles.summaryValue} ${styles.negative}`}>
                {financialData.projectsWithBalance}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Collection Rate</span>
              <span className={styles.summaryValue}>
                {financialData.collectionRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Extra stat grid */}
      <div className={styles.statGrid} style={{ marginTop: "2rem" }}>
        <div className={`${styles.statCard} ${styles.success}`}>
          <div className={styles.statLabel}>Markup Revenue</div>
          <div className={styles.statValue}>
            ${formatCurrency(financialData.additionalRevenue.markup)}
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.success}`}>
          <div className={styles.statLabel}>Transportation</div>
          <div className={styles.statValue}>
            ${formatCurrency(financialData.additionalRevenue.transportation)}
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.danger}`}>
          <div className={styles.statLabel}>Company Expenses</div>
          <div className={styles.statValue}>
            ${formatCurrency(financialData.totalCompanyExpenses)}
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.danger}`}>
          <div className={styles.statLabel}>Outstanding</div>
          <div className={styles.statValue}>
            ${formatCurrency(financialData.totalOutstanding)}
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.danger}`}>
          <div className={styles.statLabel}>Overdue</div>
          <div className={styles.statValue}>
            ${formatCurrency(financialData.totalOverdue)}
          </div>
        </div>
      </div>

      {/* Hidden charts restore */}
      {hiddenCharts.length > 0 && (
        <div className={styles.hiddenChartsSection}>
          <h3 className={styles.hiddenChartsTitle}>
            <FontAwesomeIcon icon={faEye} />
            Show Hidden Charts ({hiddenCharts.length})
          </h3>
          <div className={styles.hiddenChartsList}>
            {hiddenCharts.map((chartName) => (
              <button
                key={chartName}
                onClick={() => toggleChart(chartName)}
                className={styles.hiddenChartButton}
              >
                <FontAwesomeIcon icon={faEye} />
                {chartName.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overhead Coverage Analysis */}
      <div className={styles.overheadAnalysis}>
        <div className={styles.overheadHeader}>
          <h2 className={styles.overheadTitle}>
            <FontAwesomeIcon
              icon={faShieldHalved}
              style={{ marginRight: "1rem" }}
            />
            Overhead Coverage Analysis
          </h2>
          <p className={styles.overheadSubtitle}>
            Additional Revenue vs Company Expenses
          </p>
        </div>

        <div className={styles.overheadContent}>
          <div className={styles.overheadCard}>
            <h4>Additional Revenue (Fully Paid Projects)</h4>
            <div className={styles.overheadBreakdown}>
              <div className={styles.overheadItem}>
                <span>
                  <span
                    className={styles.overheadColorDot}
                    style={{ background: "#3498db" }}
                  />
                  Markup
                </span>
                <span>
                  ${formatCurrency(financialData.additionalRevenue.markup)}
                </span>
              </div>
              <div className={styles.overheadItem}>
                <span>
                  <span
                    className={styles.overheadColorDot}
                    style={{ background: "#2ecc71" }}
                  />
                  Transportation
                </span>
                <span>
                  $
                  {formatCurrency(
                    financialData.additionalRevenue.transportation,
                  )}
                </span>
              </div>
              <div className={`${styles.overheadItem} ${styles.overheadTotal}`}>
                <span style={{ fontWeight: "700", fontSize: "1.125rem" }}>
                  Total Additional Revenue
                </span>
                <span style={{ fontWeight: "800", fontSize: "1.25rem" }}>
                  ${formatCurrency(financialData.additionalRevenue.total)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.overheadCard}>
            <h4>Company Expenses</h4>
            <div className={styles.overheadBreakdown}>
              <div className={styles.overheadItem}>
                <span>
                  <span
                    className={styles.overheadColorDot}
                    style={{ background: "#e74c3c" }}
                  />
                  Total Overhead
                </span>
                <span>
                  ${formatCurrency(financialData.totalCompanyExpenses)}
                </span>
              </div>
              <div className={`${styles.overheadItem} ${styles.overheadTotal}`}>
                <span style={{ fontWeight: "700", fontSize: "1.125rem" }}>
                  Net Difference
                </span>
                <span
                  style={{
                    fontWeight: "800",
                    fontSize: "1.25rem",
                    color:
                      financialData.additionalRevenue.total >=
                      financialData.totalCompanyExpenses
                        ? "#2ecc71"
                        : "#e74c3c",
                  }}
                >
                  {financialData.additionalRevenue.total >=
                  financialData.totalCompanyExpenses
                    ? "+"
                    : ""}
                  $
                  {formatCurrency(
                    financialData.additionalRevenue.total -
                      financialData.totalCompanyExpenses,
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${styles.overheadStatus} ${
            financialData.additionalRevenue.total >=
            financialData.totalCompanyExpenses
              ? styles.covered
              : styles.deficit
          }`}
        >
          <div className={styles.overheadStatusIcon}>
            {financialData.additionalRevenue.total >=
            financialData.totalCompanyExpenses
              ? "✓"
              : "✗"}
          </div>
          <div className={styles.overheadStatusTitle}>
            {financialData.additionalRevenue.total >=
            financialData.totalCompanyExpenses
              ? "Overhead Fully Covered"
              : "Overhead Not Covered"}
          </div>
          <div className={styles.overheadStatusText}>
            {financialData.additionalRevenue.total >=
            financialData.totalCompanyExpenses
              ? `Surplus: $${formatCurrency(
                  financialData.additionalRevenue.total -
                    financialData.totalCompanyExpenses,
                )}`
              : `Shortfall: $${formatCurrency(
                  financialData.totalCompanyExpenses -
                    financialData.additionalRevenue.total,
                )}`}
          </div>
          <div className={styles.overheadPercentage}>
            {financialData.totalCompanyExpenses > 0
              ? `${(
                  (financialData.additionalRevenue.total /
                    financialData.totalCompanyExpenses) *
                  100
                ).toFixed(1)}% Coverage`
              : "0% Coverage"}
          </div>
        </div>
      </div>
    </main>
  );
}
