// src/components/CompanyExpenses/CompanyExpenses.jsx
import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faGasPump,
  faPhone,
  faGlobe,
  faTools,
  faHardHat,
  faReceipt,
  faCalendarAlt,
  faTruck,
  faLaptop,
  faBullhorn,
  faShieldAlt,
  faUserTie,
  faClipboardList,
  faPaperclip,
  faBuilding,
  faRecycle,
  faFileInvoiceDollar,
  faUtensils,
  faSpinner,
  faFilter,
  faDownload,
  faChartLine,
  faMoneyBillWave,
  faTimes,
  faSearch,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import * as expensesAPI from "../../utilities/expenses-api";
import { getProjects } from "../../services/projectService";
import {
  calculateAdditionalRevenue,
  calculateYearlyAdditionalRevenue,
  isProjectFullyPaid,
  getProjectAdditionalRevenue,
} from "../../constants/additionalRevenueCalculator";
import styles from "./CompanyExpenses.module.css";

const CATEGORIES = [
  { id: "fuel", name: "Fuel / Van", icon: faGasPump, color: "#e74c3c" },
  {
    id: "vehicle_maint",
    name: "Vehicle Maintenance",
    icon: faTruck,
    color: "#c0392b",
  },
  { id: "phone", name: "Phone Bill", icon: faPhone, color: "#3498db" },
  { id: "website", name: "Website / Hosting", icon: faGlobe, color: "#9b59b6" },
  {
    id: "software",
    name: "Software / Subscriptions",
    icon: faLaptop,
    color: "#8e44ad",
  },
  {
    id: "marketing",
    name: "Marketing / Ads",
    icon: faBullhorn,
    color: "#e67e22",
  },
  { id: "insurance", name: "Insurance", icon: faShieldAlt, color: "#2c3e50" },
  { id: "tools", name: "Tools", icon: faTools, color: "#f39c12" },
  { id: "material", name: "Materials", icon: faHardHat, color: "#2ecc71" },
  {
    id: "subcontractors",
    name: "Subcontractors",
    icon: faUserTie,
    color: "#16a085",
  },
  {
    id: "permits",
    name: "Permits / Licenses",
    icon: faClipboardList,
    color: "#27ae60",
  },
  {
    id: "office",
    name: "Office Supplies",
    icon: faPaperclip,
    color: "#7f8c8d",
  },
  { id: "rent", name: "Rent / Utilities", icon: faBuilding, color: "#34495e" },
  { id: "disposal", name: "Waste Disposal", icon: faRecycle, color: "#795548" },
  {
    id: "taxes",
    name: "Taxes / Fees",
    icon: faFileInvoiceDollar,
    color: "#607d8b",
  },
  {
    id: "meals",
    name: "Meals / Entertainment",
    icon: faUtensils,
    color: "#d35400",
  },
  { id: "other", name: "Other", icon: faReceipt, color: "#95a5a6" },
];

export default function CompanyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to get local date string YYYY-MM-DD
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    date: getLocalDate(),
    category: "fuel",
    amount: "",
    description: "",
  });

  // Advanced filtering state
  const [filterType, setFilterType] = useState("all"); // 'all', 'month', 'year', 'custom'
  const [selectedMonth, setSelectedMonth] = useState(
    getLocalDate().slice(0, 7),
  ); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load expenses and dashboard data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [expensesData, dashboardData, projectsData] = await Promise.all([
        expensesAPI.getAllExpenses(),
        expensesAPI.getDashboard(),
        getProjects(),
      ]);

      setExpenses(expensesData);
      setDashboard(dashboardData);
      setProjects(projectsData);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) return;

    try {
      setSubmitting(true);
      setError(null);

      const expenseData = {
        date: formData.date,
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
      };

      await expensesAPI.createExpense(expenseData);
      await loadData();

      setFormData({
        date: getLocalDate(),
        category: "fuel",
        amount: "",
        description: "",
      });
    } catch (err) {
      console.error("Error creating expense:", err);
      setError("Failed to create expense. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?"))
      return;

    try {
      setError(null);
      await expensesAPI.deleteExpense(id);
      await loadData();
    } catch (err) {
      console.error("Error deleting expense:", err);
      setError("Failed to delete expense. Please try again.");
    }
  };

  const getCategoryColor = (catId) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    return cat ? cat.color : "#95a5a6";
  };

  const getCategoryName = (catId) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  const getCategoryIcon = (catId) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    return cat ? cat.icon : faReceipt;
  };

  // Advanced filtering logic
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    // Date filtering
    if (filterType === "month") {
      filtered = filtered.filter((exp) => exp.date.startsWith(selectedMonth));
    } else if (filterType === "year") {
      filtered = filtered.filter((exp) => exp.date.startsWith(selectedYear));
    } else if (
      filterType === "custom" &&
      customDateRange.start &&
      customDateRange.end
    ) {
      filtered = filtered.filter((exp) => {
        const expDate = exp.date;
        return (
          expDate >= customDateRange.start && expDate <= customDateRange.end
        );
      });
    }

    // Category filtering
    if (selectedCategory !== "all") {
      filtered = filtered.filter((exp) => exp.category === selectedCategory);
    }

    // Search filtering
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          getCategoryName(exp.category).toLowerCase().includes(search) ||
          (exp.description && exp.description.toLowerCase().includes(search)) ||
          exp.amount.toString().includes(search),
      );
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [
    expenses,
    filterType,
    selectedMonth,
    selectedYear,
    customDateRange,
    selectedCategory,
    searchTerm,
  ]);

  // Calculate total additional revenue (Markup + Transportation) - FULLY PAID ONLY
  // Using shared utility to ensure consistency across all pages
  const totalAdditionalRevenue = useMemo(() => {
    const result = calculateAdditionalRevenue(projects);
    return result.total;
  }, [projects]);

  // Calculate yearly additional revenue (Markup + Transportation) - FULLY PAID ONLY
  const currentYear = new Date().getFullYear();
  const yearlyAdditionalRevenue = useMemo(() => {
    const result = calculateYearlyAdditionalRevenue(projects);
    return result.total;
  }, [projects]);

  // Calculate filtered statistics
  const filteredStats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const count = filteredExpenses.length;
    const average = count > 0 ? total / count : 0;

    const categoryBreakdown = {};
    filteredExpenses.forEach((exp) => {
      if (!categoryBreakdown[exp.category]) {
        categoryBreakdown[exp.category] = 0;
      }
      categoryBreakdown[exp.category] += exp.amount;
    });

    return { total, count, average, categoryBreakdown };
  }, [filteredExpenses]);

  // Get available years from expenses
  const availableYears = useMemo(() => {
    const years = new Set();
    expenses.forEach((exp) => {
      const year = exp.date.slice(0, 4);
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const handleExportCSV = () => {
    const headers = ["Date", "Category", "Description", "Amount"];
    const rows = filteredExpenses.map((exp) => [
      exp.date,
      getCategoryName(exp.category),
      `"${exp.description || ""}"`,
      exp.amount.toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    let filename = "expenses";
    if (filterType === "month") filename += `_${selectedMonth}`;
    else if (filterType === "year") filename += `_${selectedYear}`;
    filename += ".csv";

    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setFilterType("all");
    setSelectedCategory("all");
    setSearchTerm("");
    setCustomDateRange({ start: "", end: "" });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <FontAwesomeIcon icon={faSpinner} spin size="3x" />
          <p>Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FontAwesomeIcon icon={faMoneyBillWave} />
            Company Expenses
          </h1>
          <p className={styles.subtitle}>
            Track and manage your business spending with advanced insights
          </p>
        </div>
        <div className={styles.dateDisplay}>
          <FontAwesomeIcon icon={faCalendarAlt} />
          <span>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </header>

      {error && (
        <div className={styles.errorMessage}>
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Dashboard Cards */}
      {dashboard && (
        <div className={styles.dashboard}>
          <div className={styles.card}>
            <div
              className={styles.cardIcon}
              style={{
                background: "linear-gradient(135deg, #3498db, #2980b9)",
              }}
            >
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>Daily Total</span>
              <span className={styles.cardAmount}>
                ${dashboard.periodTotals.daily.toFixed(2)}
              </span>
              <span className={styles.cardTrend}>Today's spending</span>
            </div>
          </div>
          <div className={styles.card}>
            <div
              className={styles.cardIcon}
              style={{
                background: "linear-gradient(135deg, #9b59b6, #8e44ad)",
              }}
            >
              <FontAwesomeIcon icon={faChartLine} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>Weekly Total</span>
              <span className={styles.cardAmount}>
                ${dashboard.periodTotals.weekly.toFixed(2)}
              </span>
              <span className={styles.cardTrend}>This week</span>
            </div>
          </div>
          <div className={styles.card}>
            <div
              className={styles.cardIcon}
              style={{
                background: "linear-gradient(135deg, #e67e22, #d35400)",
              }}
            >
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>Monthly Total</span>
              <span className={styles.cardAmount}>
                ${dashboard.periodTotals.monthly.toFixed(2)}
              </span>
              <span className={styles.cardTrend}>This month</span>
            </div>
          </div>
          <div className={styles.card}>
            <div
              className={styles.cardIcon}
              style={{
                background: "linear-gradient(135deg, #2ecc71, #27ae60)",
              }}
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>Yearly Total</span>
              <span className={styles.cardAmount}>
                ${dashboard.periodTotals.yearly.toFixed(2)}
              </span>
              <span className={styles.cardTrend}>This year</span>
            </div>
          </div>
        </div>
      )}

      {/* Sections Removed as requested */}

      {/* Add Expense Form */}
      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>
          <FontAwesomeIcon icon={faPlus} />
          Add New Expense
        </h2>
        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className={styles.input}
              disabled={submitting}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={styles.select}
              disabled={submitting}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Amount ($)</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              disabled={submitting}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="e.g. Shell Gas Station"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPlus} />
                <span>Add Expense</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Advanced Filters Section */}
      <section className={styles.filtersSection}>
        <div className={styles.filtersHeader}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faFilter} />
            Advanced Filters
          </h2>
          {(filterType !== "all" ||
            selectedCategory !== "all" ||
            searchTerm) && (
            <button onClick={clearFilters} className={styles.clearButton}>
              <FontAwesomeIcon icon={faTimes} />
              Clear All Filters
            </button>
          )}
        </div>

        <div className={styles.filtersGrid}>
          {/* Filter Type Selection */}
          <div className={styles.filterGroup}>
            <label className={styles.label}>Filter By</label>
            <div className={styles.filterTypeButtons}>
              <button
                type="button"
                className={`${styles.filterTypeButton} ${
                  filterType === "all" ? styles.active : ""
                }`}
                onClick={() => setFilterType("all")}
              >
                All Time
              </button>
              <button
                type="button"
                className={`${styles.filterTypeButton} ${
                  filterType === "month" ? styles.active : ""
                }`}
                onClick={() => setFilterType("month")}
              >
                Month
              </button>
              <button
                type="button"
                className={`${styles.filterTypeButton} ${
                  filterType === "year" ? styles.active : ""
                }`}
                onClick={() => setFilterType("year")}
              >
                Year
              </button>
              <button
                type="button"
                className={`${styles.filterTypeButton} ${
                  filterType === "custom" ? styles.active : ""
                }`}
                onClick={() => setFilterType("custom")}
              >
                Custom Range
              </button>
            </div>
          </div>

          {/* Conditional Date Inputs */}
          {filterType === "month" && (
            <div className={styles.filterGroup}>
              <label className={styles.label}>Select Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={styles.input}
              />
            </div>
          )}

          {filterType === "year" && (
            <div className={styles.filterGroup}>
              <label className={styles.label}>Select Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className={styles.select}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
                {!availableYears.includes(
                  new Date().getFullYear().toString(),
                ) && (
                  <option value={new Date().getFullYear()}>
                    {new Date().getFullYear()}
                  </option>
                )}
              </select>
            </div>
          )}

          {filterType === "custom" && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.label}>Start Date</label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) =>
                    setCustomDateRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                  className={styles.input}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.label}>End Date</label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) =>
                    setCustomDateRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }))
                  }
                  className={styles.input}
                  min={customDateRange.start}
                />
              </div>
            </>
          )}

          {/* Category Filter */}
          <div className={styles.filterGroup}>
            <label className={styles.label}>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className={styles.filterGroup}>
            <label className={styles.label}>Search</label>
            <div className={styles.searchInput}>
              <FontAwesomeIcon icon={faSearch} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.input}
                placeholder="Search by description, category, or amount..."
              />
            </div>
          </div>
        </div>

        {/* Filter Statistics */}
        <div className={styles.filterStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Filtered Results:</span>
            <span className={styles.statValue}>
              {filteredStats.count} expenses
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Amount:</span>
            <span className={styles.statValue}>
              ${filteredStats.total.toFixed(2)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Average:</span>
            <span className={styles.statValue}>
              ${filteredStats.average.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Expense History */}
      <section className={styles.listSection}>
        <div className={styles.controls}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faReceipt} />
            Expense History
          </h2>
          <button onClick={handleExportCSV} className={styles.exportButton}>
            <FontAwesomeIcon icon={faDownload} />
            Export to CSV
          </button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles.emptyCell}>
                    No expenses found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp._id}>
                    <td>{new Date(exp.date).toLocaleDateString()}</td>
                    <td>
                      <span
                        className={styles.categoryTag}
                        style={{
                          backgroundColor: `${getCategoryColor(
                            exp.category,
                          )}20`,
                          color: getCategoryColor(exp.category),
                          borderLeft: `3px solid ${getCategoryColor(
                            exp.category,
                          )}`,
                        }}
                      >
                        <FontAwesomeIcon icon={getCategoryIcon(exp.category)} />
                        {getCategoryName(exp.category)}
                      </span>
                    </td>
                    <td>{exp.description || "-"}</td>
                    <td className={styles.amountCell}>
                      ${exp.amount.toFixed(2)}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(exp._id)}
                        className={styles.deleteButton}
                        title="Delete Expense"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Additional Revenue Breakdown Section */}
      {dashboard && (
        <section className={styles.revenueBreakdownSection}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faWallet} />
            Additional Revenue (Fully Paid Projects Only)
          </h2>
          <div className={styles.revenueBreakdownCard}>
            <div className={styles.revenueBreakdownGrid}>
              <div className={styles.revenueItem}>
                <div className={styles.revenueLabel}>
                  <FontAwesomeIcon
                    icon={faChartLine}
                    style={{ color: "#3498db" }}
                  />
                  <span>Total Markup</span>
                </div>
                <div className={styles.revenueAmount}>
                  $
                  {projects
                    .reduce((sum, p) => {
                      if (!isProjectFullyPaid(p)) return sum;
                      return sum + getProjectAdditionalRevenue(p).markup;
                    }, 0)
                    .toFixed(2)}
                </div>
              </div>
              <div className={styles.revenueItem}>
                <div className={styles.revenueLabel}>
                  <FontAwesomeIcon
                    icon={faTruck}
                    style={{ color: "#2ecc71" }}
                  />
                  <span>Total Transportation</span>
                </div>
                <div className={styles.revenueAmount}>
                  $
                  {projects
                    .reduce((sum, p) => {
                      if (!isProjectFullyPaid(p)) return sum;
                      return (
                        sum + getProjectAdditionalRevenue(p).transportation
                      );
                    }, 0)
                    .toFixed(2)}
                </div>
              </div>
              <div className={`${styles.revenueItem} ${styles.revenueTotal}`}>
                <div className={styles.revenueLabel}>
                  <FontAwesomeIcon
                    icon={faWallet}
                    style={{ color: "#1abc9c" }}
                  />
                  <span>Total Additional Revenue</span>
                </div>
                <div
                  className={styles.revenueAmount}
                  style={{ fontSize: "1.5rem", fontWeight: "700" }}
                >
                  ${totalAdditionalRevenue.toFixed(2)}
                </div>
              </div>
            </div>
            <div className={styles.revenueNote}>
              <FontAwesomeIcon icon={faReceipt} />
              <span>
                Only counting markup and transportation fees from projects with
                zero outstanding balance
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Coverage Analysis Section */}
      {dashboard && (
        <section className={styles.coverageSection}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faChartLine} />
            Overhead Coverage Analysis (This Year)
          </h2>
          <div className={styles.coverageGrid}>
            <div className={styles.coverageCard}>
              <div
                className={styles.coverageHeader}
                style={{
                  background: "linear-gradient(135deg, #1abc9c, #16a085)",
                }}
              >
                <FontAwesomeIcon icon={faWallet} />
                <span>Additional Revenue (This Year)</span>
              </div>
              <div className={styles.coverageBody}>
                <div className={styles.coverageAmount}>
                  ${yearlyAdditionalRevenue.toFixed(2)}
                </div>
                <div className={styles.coverageBreakdown}>
                  <div className={styles.coverageBreakdownItem}>
                    <span>Markup:</span>
                    <span>
                      $
                      {projects
                        .reduce((sum, p) => {
                          const projectDateStr = p.customerInfo?.startDate;
                          const projectDate = projectDateStr
                            ? new Date(projectDateStr)
                            : new Date();
                          if (projectDate.getFullYear() !== currentYear)
                            return sum;
                          if (!isProjectFullyPaid(p)) return sum;
                          return sum + getProjectAdditionalRevenue(p).markup;
                        }, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.coverageBreakdownItem}>
                    <span>Transportation:</span>
                    <span>
                      $
                      {projects
                        .reduce((sum, p) => {
                          const projectDateStr = p.customerInfo?.startDate;
                          const projectDate = projectDateStr
                            ? new Date(projectDateStr)
                            : new Date();
                          if (projectDate.getFullYear() !== currentYear)
                            return sum;
                          if (!isProjectFullyPaid(p)) return sum;
                          return (
                            sum + getProjectAdditionalRevenue(p).transportation
                          );
                        }, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.coverageCard}>
              <div
                className={styles.coverageHeader}
                style={{
                  background: "linear-gradient(135deg, #e74c3c, #c0392b)",
                }}
              >
                <FontAwesomeIcon icon={faFileInvoiceDollar} />
                <span>Company Expenses (This Year)</span>
              </div>
              <div className={styles.coverageBody}>
                <div className={styles.coverageAmount}>
                  ${dashboard.periodTotals.yearly.toFixed(2)}
                </div>
                <div className={styles.coverageLabel}>Total Overhead Costs</div>
              </div>
            </div>

            <div className={styles.coverageCard}>
              <div
                className={styles.coverageHeader}
                style={{
                  background:
                    yearlyAdditionalRevenue >= dashboard.periodTotals.yearly
                      ? "linear-gradient(135deg, #2ecc71, #27ae60)"
                      : "linear-gradient(135deg, #e67e22, #d35400)",
                }}
              >
                <FontAwesomeIcon
                  icon={
                    yearlyAdditionalRevenue >= dashboard.periodTotals.yearly
                      ? faChartLine
                      : faMoneyBillWave
                  }
                />
                <span>Net Position</span>
              </div>
              <div className={styles.coverageBody}>
                <div
                  className={styles.coverageAmount}
                  style={{
                    color:
                      yearlyAdditionalRevenue >= dashboard.periodTotals.yearly
                        ? "#2ecc71"
                        : "#e74c3c",
                  }}
                >
                  {yearlyAdditionalRevenue >= dashboard.periodTotals.yearly
                    ? "+"
                    : ""}
                  $
                  {(
                    yearlyAdditionalRevenue - dashboard.periodTotals.yearly
                  ).toFixed(2)}
                </div>
                <div
                  className={styles.coverageStatus}
                  style={{
                    color:
                      yearlyAdditionalRevenue >= dashboard.periodTotals.yearly
                        ? "#2ecc71"
                        : "#e74c3c",
                    fontWeight: "600",
                  }}
                >
                  {yearlyAdditionalRevenue >= dashboard.periodTotals.yearly
                    ? `✓ Expenses Covered (${(
                        (yearlyAdditionalRevenue /
                          dashboard.periodTotals.yearly) *
                        100
                      ).toFixed(1)}% coverage)`
                    : `✗ Shortfall (${(
                        (yearlyAdditionalRevenue /
                          dashboard.periodTotals.yearly) *
                        100
                      ).toFixed(1)}% coverage)`}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Guidance */}
          {dashboard.periodTotals.yearly > 0 && (
            <div className={styles.pricingGuidance}>
              <h3 className={styles.pricingTitle}>
                <FontAwesomeIcon icon={faChartLine} />
                Pricing Guidance for Future Projects
              </h3>
              <div className={styles.pricingContent}>
                <div className={styles.pricingMetric}>
                  <span className={styles.pricingLabel}>
                    Monthly Overhead Average:
                  </span>
                  <span className={styles.pricingValue}>
                    ${(dashboard.periodTotals.yearly / 12).toFixed(2)}
                  </span>
                </div>
                <div className={styles.pricingMetric}>
                  <span className={styles.pricingLabel}>
                    Completed & Paid Projects (This Year):
                  </span>
                  <span className={styles.pricingValue}>
                    {
                      projects.filter((p) => {
                        const projectDateStr = p.customerInfo?.startDate;
                        const projectDate = projectDateStr
                          ? new Date(projectDateStr)
                          : new Date();
                        return (
                          projectDate.getFullYear() === currentYear &&
                          isProjectFullyPaid(p)
                        );
                      }).length
                    }{" "}
                    projects
                  </span>
                </div>
                {projects.filter((p) => {
                  const projectDateStr = p.customerInfo?.startDate;
                  const projectDate = projectDateStr
                    ? new Date(projectDateStr)
                    : new Date();
                  return (
                    projectDate.getFullYear() === currentYear &&
                    isProjectFullyPaid(p)
                  );
                }).length > 0 && (
                  <div className={styles.pricingMetric}>
                    <span className={styles.pricingLabel}>
                      Overhead per Project (Average):
                    </span>
                    <span className={styles.pricingValue}>
                      $
                      {(
                        dashboard.periodTotals.yearly /
                        projects.filter((p) => {
                          const projectDateStr = p.customerInfo?.startDate;
                          const projectDate = projectDateStr
                            ? new Date(projectDateStr)
                            : new Date();
                          return (
                            projectDate.getFullYear() === currentYear &&
                            isProjectFullyPaid(p)
                          );
                        }).length
                      ).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className={styles.pricingRecommendation}>
                  <FontAwesomeIcon icon={faChartLine} />
                  <div>
                    <strong>Recommendation:</strong>
                    <p>
                      {yearlyAdditionalRevenue >= dashboard.periodTotals.yearly
                        ? `Your current pricing structure is working well! Additional revenue is covering all overhead costs with a surplus of $${(
                            yearlyAdditionalRevenue -
                            dashboard.periodTotals.yearly
                          ).toFixed(2)}.`
                        : `Consider increasing markup or transportation fees. You need an additional $${Math.abs(
                            yearlyAdditionalRevenue -
                              dashboard.periodTotals.yearly,
                          ).toFixed(2)} in revenue to cover overhead costs.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
