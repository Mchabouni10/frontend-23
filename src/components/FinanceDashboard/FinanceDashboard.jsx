import React, { useState, useEffect, useMemo } from "react";
import { getProjects } from "../../services/projectService";
import { getAllExpenses } from "../../utilities/expenses-api";
import { Doughnut, Line, Bar } from "react-chartjs-2";
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
  faChartPie,
  faChartLine,
  faChartBar,
  faDollarSign,
  faPercentage,
  faArrowTrendUp,
  faEye,
  faEyeSlash,
  faTimes,
  faSpinner,
  faCalendarAlt,
  faMoneyBillWave,
  faWallet,
  faArrowUp,
  faArrowDown,
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
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [dateFilter, setDateFilter] = useState({
    type: "all",
    year: null,
    startDate: null,
    endDate: null,
  });
  const [visibleCharts, setVisibleCharts] = useState({
    paymentMethods: true,
    collections: true,
    materialTypes: true,
    expenses: true,
    detailedExpenses: true,
    profit: true,
    expensesByCategory: true,
    incomeVsExpenses: true,
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

  // Helper to check if a date is within the selected range
  const isDateInFilter = useMemo(() => {
    return (date) => {
      if (!date) return false;
      const d = new Date(date);
      if (isNaN(d.getTime())) return false;

      if (dateFilter.type === "year") {
        const year = dateFilter.year || new Date().getFullYear();
        return d.getFullYear() === year;
      }

      if (
        dateFilter.type === "custom" &&
        dateFilter.startDate &&
        dateFilter.endDate
      ) {
        const start = new Date(dateFilter.startDate);
        const end = new Date(dateFilter.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
      }

      return true; // All time
    };
  }, [dateFilter]);

  // Generate chart labels based on filtered data range
  const chartLabels = useMemo(() => {
    const allDates = [];

    // Collect dates from projects
    projects.forEach((p) => {
      if (p.customerInfo?.startDate)
        allDates.push(new Date(p.customerInfo.startDate));
      (p.settings?.payments || []).forEach((pay) => {
        if (pay.date) allDates.push(new Date(pay.date));
      });
    });

    // Collect dates from company expenses
    companyExpenses.forEach((e) => {
      if (e.date) allDates.push(new Date(e.date));
    });

    if (allDates.length === 0) return [];

    const sortedDates = allDates.sort((a, b) => a - b);
    const start = sortedDates[0];
    const end = sortedDates[sortedDates.length - 1];

    // If specific year selected, show all months of that year
    if (dateFilter.type === "year") {
      const year = dateFilter.year || new Date().getFullYear();
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(year, i, 1);
        return d.toLocaleString("default", { month: "short", year: "numeric" });
      });
    }

    // Otherwise generate months between start and end
    const labels = [];
    const current = new Date(start);
    current.setDate(1); // Start of month

    while (current <= end) {
      labels.push(
        current.toLocaleString("default", { month: "short", year: "numeric" }),
      );
      current.setMonth(current.getMonth() + 1);
    }
    return labels;
  }, [projects, companyExpenses, dateFilter]);

  // Helper function to map expense category IDs to readable names
  const getCategoryNameFromId = (catId) => {
    const categoryMap = {
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
    return categoryMap[catId] || catId;
  };

  // Calculate aggregated financial data
  const financialData = useMemo(() => {
    if (!projects.length && !companyExpenses.length) return null;

    const collectionsByMonth = chartLabels.reduce(
      (acc, label) => ({ ...acc, [label]: 0 }),
      {},
    );
    const projectExpensesByMonth = chartLabels.reduce(
      (acc, label) => ({ ...acc, [label]: 0 }),
      {},
    );
    const overheadByMonth = chartLabels.reduce(
      (acc, label) => ({ ...acc, [label]: 0 }),
      {},
    );

    const paymentMethods = {
      Cash: 0,
      Credit: 0,
      Debit: 0,
      Check: 0,
      Zelle: 0,
      Deposit: 0,
    };
    const materialTypes = {};
    const expenseCategories = { Material: 0, Labor: 0, Tax: 0, Fees: 0 };
    const overheadCategories = {};

    const profitByProject = [];

    let totalCollections = 0;
    let totalProjectExpenses = 0; // COGS
    let totalOverhead = 0; // Company Expenses

    // Process Projects (Revenue & COGS)
    projects.forEach((project) => {
      const payments = project.settings?.payments || [];
      const deposit = project.settings?.deposit || 0;

      // Handle Deposit
      if (
        deposit > 0 &&
        project.settings?.depositDate &&
        isDateInFilter(project.settings.depositDate)
      ) {
        const date = new Date(project.settings.depositDate);
        const label = date.toLocaleString("default", {
          month: "short",
          year: "numeric",
        });
        if (collectionsByMonth[label] !== undefined)
          collectionsByMonth[label] += deposit;
        paymentMethods.Deposit += deposit;
        totalCollections += deposit;
      }

      // Handle Payments
      payments.forEach((payment) => {
        if (payment.isPaid && payment.date && isDateInFilter(payment.date)) {
          const date = new Date(payment.date);
          const label = date.toLocaleString("default", {
            month: "short",
            year: "numeric",
          });
          if (collectionsByMonth[label] !== undefined)
            collectionsByMonth[label] += payment.amount;
          paymentMethods[payment.method] =
            (paymentMethods[payment.method] || 0) + payment.amount;
          totalCollections += payment.amount;
        }
      });

      // Project Expenses
      const projectDate = project.customerInfo?.startDate
        ? new Date(project.customerInfo.startDate)
        : new Date();
      if (isDateInFilter(projectDate)) {
        const label = projectDate.toLocaleString("default", {
          month: "short",
          year: "numeric",
        });

        let pMat = 0,
          pLab = 0;
        (project.categories || []).forEach((cat) => {
          (cat.workItems || []).forEach((item) => {
            const units =
              (item.surfaces || []).reduce(
                (sum, surf) => sum + (parseFloat(surf.sqft) || 0),
                0,
              ) ||
              parseFloat(item.linearFt) ||
              parseFloat(item.units) ||
              0;
            const matCost = (parseFloat(item.materialCost) || 0) * units;
            const labCost = (parseFloat(item.laborCost) || 0) * units;
            pMat += matCost;
            pLab += labCost;
            const subtype = item.subtype || "Other";
            materialTypes[subtype] = (materialTypes[subtype] || 0) + matCost;
          });
        });

        const baseSubtotal = pMat + pLab;
        const waste = baseSubtotal * (project.settings?.wasteFactor || 0);
        const tax = baseSubtotal * (project.settings?.taxRate || 0);
        const trans = project.settings?.transportationFee || 0;
        const misc = (project.settings?.miscFees || []).reduce(
          (sum, fee) => sum + (parseFloat(fee.amount) || 0),
          0,
        );

        const projectCost = pMat + pLab + tax + waste + trans + misc;

        if (projectExpensesByMonth[label] !== undefined)
          projectExpensesByMonth[label] += projectCost;

        totalProjectExpenses += projectCost;

        expenseCategories.Material += pMat;
        expenseCategories.Labor += pLab;
        expenseCategories.Tax += tax;
        expenseCategories.Fees += trans + misc;

        const lifetimeCollections =
          payments.reduce(
            (sum, p) => sum + (p.isPaid ? parseFloat(p.amount) || 0 : 0),
            0,
          ) + deposit;
        const profit = lifetimeCollections - projectCost;

        profitByProject.push({
          name: project.customerInfo?.projectName || `Project ${project._id}`,
          profit,
          details: {
            customer: `${project.customerInfo?.firstName || ""} ${
              project.customerInfo?.lastName || ""
            }`.trim(),
            collections: lifetimeCollections,
            expenses: projectCost,
            categories: project.categories || [],
            payments: payments,
            deposit,
          },
        });
      }
    });

    // Process Company Expenses (Overhead)
    companyExpenses.forEach((exp) => {
      if (exp.date && isDateInFilter(exp.date)) {
        const date = new Date(exp.date);
        const label = date.toLocaleString("default", {
          month: "short",
          year: "numeric",
        });

        if (overheadByMonth[label] !== undefined)
          overheadByMonth[label] += exp.amount;

        totalOverhead += exp.amount;

        // Map category ID to readable name
        const categoryName = getCategoryNameFromId(exp.category);
        overheadCategories[categoryName] =
          (overheadCategories[categoryName] || 0) + exp.amount;
      }
    });

    // Calculate Totals
    const totalExpenses = totalProjectExpenses + totalOverhead;
    const netProfit = totalCollections - totalExpenses;
    const profitMargin =
      totalCollections > 0 ? (netProfit / totalCollections) * 100 : 0;

    return {
      labels: chartLabels,
      collectionsByMonth: Object.values(collectionsByMonth),
      projectExpensesByMonth: Object.values(projectExpensesByMonth),
      overheadByMonth: Object.values(overheadByMonth),

      paymentMethods,
      materialTypes,
      expenseCategories, // Project Expenses
      overheadCategories, // Company Expenses

      profitByProject: profitByProject.sort((a, b) => b.profit - a.profit),

      totalCollections,
      totalProjectExpenses,
      totalOverhead,
      totalExpenses, // Project + Overhead

      totalProfit: netProfit,
      profitMargin,
    };
  }, [projects, companyExpenses, chartLabels, isDateInFilter]);

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          font: { family: "Poppins", size: 12, weight: 500 },
          padding: 15,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        bodyFont: { family: "Poppins", size: 12 },
        titleFont: { family: "Poppins", size: 14, weight: 600 },
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: $${
              context.parsed.y?.toLocaleString() ||
              context.parsed.toLocaleString()
            }`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          font: { family: "Poppins", size: 11 },
          maxRotation: 45,
        },
        grid: {
          display: false,
        },
      },
      y: {
        ticks: {
          font: { family: "Poppins", size: 11 },
          callback: (value) => `$${value.toLocaleString()}`,
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          font: { family: "Poppins", size: 12, weight: 500 },
          padding: 15,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: (context) => `$${context.parsed.toLocaleString()}`,
        },
      },
    },
    cutout: "60%",
  };

  // Generate chart data
  const getChartData = () => {
    if (!financialData) return {};

    return {
      paymentMethodData: {
        labels: Object.keys(financialData.paymentMethods).filter(
          (method) => financialData.paymentMethods[method] > 0,
        ),
        datasets: [
          {
            data: Object.values(financialData.paymentMethods).filter(
              (amount) => amount > 0,
            ),
            backgroundColor: [
              "#3498db",
              "#e74c3c",
              "#f39c12",
              "#2ecc71",
              "#9b59b6",
              "#1abc9c",
            ],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },

      collectionsData: {
        labels: financialData.labels,
        datasets: [
          {
            label: "Income",
            data: financialData.collectionsByMonth,
            borderColor: "#2ecc71",
            backgroundColor: "rgba(46, 204, 113, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
          },
          {
            label: "Total Expenses",
            data: financialData.labels.map(
              (_, i) =>
                financialData.projectExpensesByMonth[i] +
                financialData.overheadByMonth[i],
            ),
            borderColor: "#e74c3c",
            backgroundColor: "rgba(231, 76, 60, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
          },
        ],
      },

      materialTypeData: {
        labels: Object.keys(financialData.materialTypes).filter(
          (type) => financialData.materialTypes[type] > 0,
        ),
        datasets: [
          {
            data: Object.values(financialData.materialTypes).filter(
              (amount) => amount > 0,
            ),
            backgroundColor: [
              "#e74c3c",
              "#3498db",
              "#f39c12",
              "#2ecc71",
              "#9b59b6",
              "#1abc9c",
              "#34495e",
              "#e67e22",
            ],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },

      expenseCategoryData: {
        labels: ["Project Costs", "Overhead"],
        datasets: [
          {
            data: [
              financialData.totalProjectExpenses,
              financialData.totalOverhead,
            ],
            backgroundColor: ["#3498db", "#95a5a6"],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },

      detailedExpensesData: {
        labels: financialData.labels,
        datasets: [
          {
            label: "Project Costs",
            data: financialData.projectExpensesByMonth,
            backgroundColor: "#3498db",
            stack: "Stack 0",
          },
          {
            label: "Overhead",
            data: financialData.overheadByMonth,
            backgroundColor: "#95a5a6",
            stack: "Stack 0",
          },
        ],
      },

      profitData: {
        labels: financialData.profitByProject.map((p) => p.name).slice(0, 10),
        datasets: [
          {
            label: "Profit",
            data: financialData.profitByProject
              .map((p) => p.profit)
              .slice(0, 10),
            backgroundColor: financialData.profitByProject
              .map((p) => (p.profit >= 0 ? "#2ecc71" : "#e74c3c"))
              .slice(0, 10),
            borderColor: financialData.profitByProject
              .map((p) => (p.profit >= 0 ? "#27ae60" : "#c0392b"))
              .slice(0, 10),
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },

      // NEW CHART 1: Detailed Company Expenses by Category
      expensesByCategoryData: {
        labels: Object.keys(financialData.overheadCategories).filter(
          (cat) => financialData.overheadCategories[cat] > 0,
        ),
        datasets: [
          {
            data: Object.values(financialData.overheadCategories).filter(
              (amount) => amount > 0,
            ),
            backgroundColor: [
              "#e74c3c",
              "#3498db",
              "#f39c12",
              "#2ecc71",
              "#9b59b6",
              "#1abc9c",
              "#34495e",
              "#e67e22",
              "#95a5a6",
              "#c0392b",
              "#8e44ad",
              "#d35400",
              "#16a085",
              "#27ae60",
              "#2c3e50",
              "#795548",
              "#607d8b",
            ],
            borderWidth: 0,
            hoverOffset: 10,
          },
        ],
      },

      // NEW CHART 2: Monthly Income vs Expenses Comparison
      incomeVsExpensesData: {
        labels: financialData.labels,
        datasets: [
          {
            label: "Income",
            data: financialData.collectionsByMonth,
            backgroundColor: "rgba(46, 204, 113, 0.8)",
            borderColor: "#2ecc71",
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            label: "Project Costs",
            data: financialData.projectExpensesByMonth,
            backgroundColor: "rgba(52, 152, 219, 0.8)",
            borderColor: "#3498db",
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            label: "Company Expenses",
            data: financialData.overheadByMonth,
            backgroundColor: "rgba(231, 76, 60, 0.8)",
            borderColor: "#e74c3c",
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
    };
  };

  const chartData = getChartData();
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);

  const toggleChartVisibility = (chartKey) => {
    setVisibleCharts((prev) => ({
      ...prev,
      [chartKey]: !prev[chartKey],
    }));
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className="container">
          <div className={styles.loading}>
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className={styles.loadingIcon}
            />
            <span>Loading financial data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className="container">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!financialData) {
    return (
      <div className={styles.dashboard}>
        <div className="container">
          <div className={styles.noData}>
            <FontAwesomeIcon icon={faChartPie} className={styles.noDataIcon} />
            <h3>No Financial Data Available</h3>
            <p>Add some projects with payments to see financial analytics.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.dashboard}>
      <div className="container">
        <header className="header">
          <div>
            <h1 className="title">
              <FontAwesomeIcon icon={faChartPie} />
              Finance Dashboard
            </h1>
            <p className="subtitle">
              Comprehensive financial analytics and insights
            </p>
          </div>
          <div className={styles.controls}>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <FontAwesomeIcon
                icon={faCalendarAlt}
                style={{ marginRight: "0.5rem", color: "#718096" }}
              />

              <select
                value={dateFilter.type}
                onChange={(e) =>
                  setDateFilter({ ...dateFilter, type: e.target.value })
                }
                className="select"
                style={{ width: "auto" }}
              >
                <option value="all">All Time</option>
                <option value="year">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>

              {dateFilter.type === "year" && (
                <select
                  value={dateFilter.year || new Date().getFullYear()}
                  onChange={(e) =>
                    setDateFilter({
                      ...dateFilter,
                      year: parseInt(e.target.value),
                    })
                  }
                  className="select"
                  style={{ width: "auto" }}
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) => new Date().getFullYear() - i + 1,
                  )
                    .reverse()
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  {Array.from(
                    { length: 10 },
                    (_, i) => new Date().getFullYear() - i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}

              {dateFilter.type === "custom" && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="date"
                    value={
                      dateFilter.startDate
                        ? new Date(dateFilter.startDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setDateFilter({
                        ...dateFilter,
                        startDate: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                    className="input"
                    style={{
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #dcdfe6",
                    }}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={
                      dateFilter.endDate
                        ? new Date(dateFilter.endDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setDateFilter({
                        ...dateFilter,
                        endDate: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                    className="input"
                    style={{
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #dcdfe6",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Key Metrics */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className={styles.metricContent}>
              <h3>Total Revenue</h3>
              <p className={styles.metricValue}>
                {formatCurrency(financialData.totalCollections)}
              </p>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
            <div className={styles.metricContent}>
              <h3>Total Expenses</h3>
              <p className={styles.metricValue}>
                {formatCurrency(financialData.totalExpenses)}
              </p>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faWallet} />
            </div>
            <div className={styles.metricContent}>
              <h3>Net Profit</h3>
              <p
                className={`${styles.metricValue} ${
                  financialData.totalProfit >= 0
                    ? styles.positive
                    : styles.negative
                }`}
              >
                {formatCurrency(financialData.totalProfit)}
                <FontAwesomeIcon
                  icon={
                    financialData.totalProfit >= 0 ? faArrowUp : faArrowDown
                  }
                  style={{ fontSize: "0.7em", marginLeft: "8px" }}
                />
              </p>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faPercentage} />
            </div>
            <div className={styles.metricContent}>
              <h3>Profit Margin</h3>
              <p
                className={`${styles.metricValue} ${
                  financialData.profitMargin >= 0
                    ? styles.positive
                    : styles.negative
                }`}
              >
                {financialData.profitMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faChartLine} />
            </div>
            <div className={styles.metricContent}>
              <h3>Project Costs</h3>
              <p className={styles.metricValue}>
                {formatCurrency(financialData.totalProjectExpenses)}
              </p>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
            <div className={styles.metricContent}>
              <h3>Company Expenses</h3>
              <p className={styles.metricValue}>
                {formatCurrency(financialData.totalOverhead)}
              </p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className={styles.chartGrid}>
          {visibleCharts.paymentMethods && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartPie} />
                  Payment Methods
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("paymentMethods")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Doughnut
                  data={chartData.paymentMethodData}
                  options={donutOptions}
                />
              </div>
            </div>
          )}

          {visibleCharts.collections && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartLine} />
                  Revenue & Expense Trends
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("collections")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Line data={chartData.collectionsData} options={chartOptions} />
              </div>
            </div>
          )}

          {visibleCharts.materialTypes && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartPie} />
                  Material Types
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("materialTypes")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Doughnut
                  data={chartData.materialTypeData}
                  options={donutOptions}
                />
              </div>
            </div>
          )}

          {visibleCharts.expenses && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartPie} />
                  Expense Categories
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("expenses")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Doughnut
                  data={chartData.expenseCategoryData}
                  options={donutOptions}
                />
              </div>
            </div>
          )}

          {visibleCharts.detailedExpenses && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartBar} />
                  Monthly Expenses Breakdown
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("detailedExpenses")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Bar
                  data={chartData.detailedExpensesData}
                  options={chartOptions}
                />
              </div>
            </div>
          )}

          {visibleCharts.profit && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartBar} />
                  Top 10 Projects by Profit
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("profit")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Bar
                  data={chartData.profitData}
                  options={{
                    ...chartOptions,
                    onClick: (event, elements) => {
                      if (elements.length > 0) {
                        const index = elements[0].index;
                        setModalData(
                          financialData.profitByProject[index].details,
                        );
                        setShowModal(true);
                      }
                    },
                  }}
                />
              </div>
            </div>
          )}

          {/* NEW CHART 1: Company Expenses by Category */}
          {visibleCharts.expensesByCategory && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartPie} />
                  Company Expenses by Category
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("expensesByCategory")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Doughnut
                  data={chartData.expensesByCategoryData}
                  options={donutOptions}
                />
              </div>
            </div>
          )}

          {/* NEW CHART 2: Income vs Expenses Comparison */}
          {visibleCharts.incomeVsExpenses && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartBar} />
                  Income vs Expenses Analysis
                </h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility("incomeVsExpenses")}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Bar
                  data={chartData.incomeVsExpensesData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      tooltip: {
                        ...chartOptions.plugins.tooltip,
                        callbacks: {
                          footer: (tooltipItems) => {
                            const index = tooltipItems[0].dataIndex;
                            const income =
                              financialData.collectionsByMonth[index];
                            const projectCosts =
                              financialData.projectExpensesByMonth[index];
                            const overhead =
                              financialData.overheadByMonth[index];
                            const netProfit = income - projectCosts - overhead;
                            return `Net Profit: $${netProfit.toLocaleString()}`;
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Hidden Charts Toggle */}
        {Object.values(visibleCharts).includes(false) && (
          <section className={styles.hiddenCharts}>
            <h3>Show Hidden Charts</h3>
            <div className={styles.hiddenChartsList}>
              {Object.entries(visibleCharts).map(
                ([key, visible]) =>
                  !visible && (
                    <button
                      key={key}
                      className="button button--secondary"
                      onClick={() => toggleChartVisibility(key)}
                    >
                      <FontAwesomeIcon icon={faEye} />
                      Show {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                    </button>
                  ),
              )}
            </div>
          </section>
        )}
      </div>

      {/* Modal */}
      {showModal && modalData && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Project Details</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.projectInfo}>
                <h4>Customer: {modalData.customer}</h4>
                <div className={styles.financialSummary}>
                  <div className={styles.summaryItem}>
                    <span>Total Collections:</span>
                    <span>{formatCurrency(modalData.collections)}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span>Total Expenses:</span>
                    <span>{formatCurrency(modalData.expenses)}</span>
                  </div>
                  <div className={`${styles.summaryItem} ${styles.profitItem}`}>
                    <span>Net Profit:</span>
                    <span
                      className={
                        modalData.collections - modalData.expenses >= 0
                          ? styles.positive
                          : styles.negative
                      }
                    >
                      {formatCurrency(
                        modalData.collections - modalData.expenses,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {modalData.payments.length > 0 && (
                <div className={styles.paymentsSection}>
                  <h5>Payment History</h5>
                  <div className={styles.tableWrapper}>
                    <table className={styles.modalTable}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData.deposit > 0 && (
                          <tr className={styles.depositRow}>
                            <td>Initial</td>
                            <td>{formatCurrency(modalData.deposit)}</td>
                            <td>Deposit</td>
                            <td>
                              <span className={styles.statusPaid}>Paid</span>
                            </td>
                            <td>Project deposit</td>
                          </tr>
                        )}
                        {modalData.payments.map((payment, i) => (
                          <tr key={i}>
                            <td>
                              {new Date(payment.date).toLocaleDateString()}
                            </td>
                            <td>{formatCurrency(payment.amount)}</td>
                            <td>{payment.method || "N/A"}</td>
                            <td>
                              <span
                                className={
                                  payment.isPaid
                                    ? styles.statusPaid
                                    : styles.statusPending
                                }
                              >
                                {payment.isPaid ? "Paid" : "Pending"}
                              </span>
                            </td>
                            <td>{payment.note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                className="button button--secondary"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
