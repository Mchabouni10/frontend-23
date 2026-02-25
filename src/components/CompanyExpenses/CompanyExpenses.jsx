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
  faEye,
  faArrowUp,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
import * as expensesAPI from "../../utilities/expenses-api";
import { getProjects } from "../../services/projectService";
import {
  calculateAdditionalRevenue,
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

  // Load expenses and projects data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [expensesData, projectsData] = await Promise.all([
        expensesAPI.getAllExpenses(),
        getProjects(),
      ]);

      setExpenses(expensesData || []);
      setProjects(projectsData || []);
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

  // ============================================================
  // YEAR-SPECIFIC OVERHEAD COVERAGE ANALYSIS
  // ============================================================

  // Get additional revenue for SELECTED year only (from fully paid projects completed in that year)
  const yearSpecificRevenue = useMemo(() => {
    return calculateAdditionalRevenue(projects, {
      year: parseInt(selectedYear),
    });
  }, [projects, selectedYear]);

  // Get expenses for SELECTED year only
  const yearSpecificExpenses = useMemo(() => {
    return expenses
      .filter((exp) => exp.date.startsWith(selectedYear))
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses, selectedYear]);

  // Get projects completed in selected year (for detailed breakdown)
  const projectsCompletedInYear = useMemo(() => {
    return projects.filter((p) => {
      const startDate = p.customerInfo?.startDate;
      if (!startDate) return false;
      const projectYear = new Date(startDate).getFullYear();
      return projectYear === parseInt(selectedYear) && isProjectFullyPaid(p);
    });
  }, [projects, selectedYear]);

  // Calculate year-over-year trend data
  const yearOverYearData = useMemo(() => {
    const years = availableYears.slice(0, 5); // Last 5 years max
    return years.map((year) => {
      const revenue = calculateAdditionalRevenue(projects, {
        year: parseInt(year),
      });
      const expenses_yr = expenses
        .filter((e) => e.date.startsWith(year))
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        year,
        revenue: revenue.total,
        expenses: expenses_yr,
        net: revenue.total - expenses_yr,
        isCovered: revenue.total >= expenses_yr,
        projectCount: revenue.projectCount,
      };
    });
  }, [projects, expenses, availableYears]);

  const isCovered = yearSpecificRevenue.total >= yearSpecificExpenses;
  const difference = Math.abs(yearSpecificRevenue.total - yearSpecificExpenses);
  const coveragePercentage =
    yearSpecificExpenses > 0
      ? (yearSpecificRevenue.total / yearSpecificExpenses) * 100
      : 0;

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

      {/* ============================================================ */}
      {/* YEAR-SPECIFIC OVERHEAD COVERAGE ANALYSIS */}
      {/* ============================================================ */}
      <section className={styles.coverageSection}>
        <div className={styles.coverageHeader}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faChartLine} />
            Overhead Coverage Analysis
          </h2>

          {/* Year Selector for Coverage Analysis */}
          <div className={styles.coverageYearSelector}>
            <label htmlFor="coverage-year">Select Year:</label>
            <select
              id="coverage-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className={styles.yearSelect}
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
        </div>

        <div className={styles.coverageGrid}>
          {/* Additional Revenue Card - Year Specific */}
          <div className={styles.coverageCard}>
            <div
              className={styles.coverageHeader}
              style={{
                background: "linear-gradient(135deg, #1abc9c, #16a085)",
              }}
            >
              <FontAwesomeIcon icon={faWallet} />
              <span>Additional Revenue ({selectedYear})</span>
            </div>
            <div className={styles.coverageBody}>
              <div className={styles.coverageAmount}>
                ${yearSpecificRevenue.total.toFixed(2)}
              </div>
              <div className={styles.coverageBreakdown}>
                <div className={styles.coverageBreakdownItem}>
                  <span>Markup:</span>
                  <span>${yearSpecificRevenue.totalMarkup.toFixed(2)}</span>
                </div>
                <div className={styles.coverageBreakdownItem}>
                  <span>Transportation:</span>
                  <span>
                    ${yearSpecificRevenue.totalTransportation.toFixed(2)}
                  </span>
                </div>
                <div className={styles.coverageBreakdownItem}>
                  <span>From:</span>
                  <span>
                    {yearSpecificRevenue.projectCount} fully paid projects
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Company Expenses Card - Year Specific */}
          <div className={styles.coverageCard}>
            <div
              className={styles.coverageHeader}
              style={{
                background: "linear-gradient(135deg, #e74c3c, #c0392b)",
              }}
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
              <span>Company Expenses ({selectedYear})</span>
            </div>
            <div className={styles.coverageBody}>
              <div className={styles.coverageAmount}>
                ${yearSpecificExpenses.toFixed(2)}
              </div>
              <div className={styles.coverageLabel}>
                {expenses.filter((e) => e.date.startsWith(selectedYear)).length}{" "}
                expense entries
              </div>
              {yearSpecificExpenses > 0 && (
                <div className={styles.coverageBreakdown}>
                  {Object.entries(filteredStats.categoryBreakdown)
                    .slice(0, 3)
                    .map(([cat, amount]) => (
                      <div key={cat} className={styles.coverageBreakdownItem}>
                        <span>{getCategoryName(cat)}:</span>
                        <span>${amount.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Net Position Card - Year Specific */}
          <div className={styles.coverageCard}>
            <div
              className={styles.coverageHeader}
              style={{
                background: isCovered
                  ? "linear-gradient(135deg, #2ecc71, #27ae60)"
                  : yearSpecificExpenses === 0
                  ? "linear-gradient(135deg, #95a5a6, #7f8c8d)"
                  : "linear-gradient(135deg, #e67e22, #d35400)",
              }}
            >
              <FontAwesomeIcon
                icon={
                  isCovered
                    ? faChartLine
                    : yearSpecificExpenses === 0
                    ? faEye
                    : faMoneyBillWave
                }
              />
              <span>Net Position ({selectedYear})</span>
            </div>
            <div className={styles.coverageBody}>
              <div
                className={styles.coverageAmount}
                style={{
                  color: isCovered
                    ? "#2ecc71"
                    : yearSpecificExpenses === 0
                    ? "#95a5a6"
                    : "#e74c3c",
                }}
              >
                {yearSpecificExpenses === 0 ? "—" : isCovered ? "+" : "-"}$
                {yearSpecificExpenses === 0 ? "0.00" : difference.toFixed(2)}
              </div>
              <div
                className={styles.coverageStatus}
                style={{
                  color: isCovered
                    ? "#2ecc71"
                    : yearSpecificExpenses === 0
                    ? "#95a5a6"
                    : "#e74c3c",
                }}
              >
                {yearSpecificExpenses === 0
                  ? "No expenses recorded"
                  : isCovered
                  ? `✓ Fully Covered (${coveragePercentage.toFixed(1)}%)`
                  : `✗ Shortfall (${coveragePercentage.toFixed(1)}% covered)`}
              </div>
              {yearSpecificExpenses > 0 &&
                yearSpecificRevenue.projectCount > 0 && (
                  <div className={styles.coverageBreakdown}>
                    <div className={styles.coverageBreakdownItem}>
                      <span>Per Project Avg:</span>
                      <span>
                        $
                        {(
                          yearSpecificExpenses /
                          yearSpecificRevenue.projectCount
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Year-over-Year Trend Comparison */}
        {yearOverYearData.length > 1 && (
          <div className={styles.yoyComparison}>
            <h3 className={styles.yoyTitle}>
              <FontAwesomeIcon icon={faChartLine} />
              Year-over-Year Trend
            </h3>
            <div className={styles.yoyGrid}>
              {yearOverYearData.map((data) => (
                <div
                  key={data.year}
                  className={`${styles.yoyCard} ${
                    data.isCovered ? styles.yoyPositive : styles.yoyNegative
                  }`}
                  onClick={() => setSelectedYear(data.year)}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.yoyYear}>{data.year}</div>
                  <div className={styles.yoyRevenue}>
                    <FontAwesomeIcon
                      icon={faArrowUp}
                      style={{ color: "#2ecc71", fontSize: "0.8rem" }}
                    />
                    ${data.revenue.toFixed(2)}
                  </div>
                  <div className={styles.yoyExpenses}>
                    <FontAwesomeIcon
                      icon={faArrowDown}
                      style={{ color: "#e74c3c", fontSize: "0.8rem" }}
                    />
                    ${data.expenses.toFixed(2)}
                  </div>
                  <div className={styles.yoyNet}>
                    {data.isCovered ? "✓" : "✗"} $
                    {Math.abs(data.net).toFixed(2)}
                  </div>
                  <div className={styles.yoyProjects}>
                    {data.projectCount} projects
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects List for Selected Year */}
        {projectsCompletedInYear.length > 0 && (
          <div className={styles.projectsList}>
            <h4 className={styles.projectsListTitle}>
              <FontAwesomeIcon icon={faWallet} />
              Fully Paid Projects in {selectedYear} (
              {projectsCompletedInYear.length})
            </h4>
            <div className={styles.projectsGrid}>
              {projectsCompletedInYear.map((project, idx) => {
                const revenue = getProjectAdditionalRevenue(project);
                return (
                  <div key={idx} className={styles.projectCard}>
                    <div className={styles.projectName}>
                      {project.customerInfo?.firstName}{" "}
                      {project.customerInfo?.lastName}
                    </div>
                    <div className={styles.projectDetails}>
                      <span>Markup: ${revenue.markup.toFixed(2)}</span>
                      <span>
                        Transport: ${revenue.transportation.toFixed(2)}
                      </span>
                      <span className={styles.projectTotal}>
                        Total: ${revenue.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing Guidance - Year Specific */}
        {yearSpecificExpenses > 0 && yearSpecificRevenue.projectCount > 0 && (
          <div className={styles.pricingGuidance}>
            <h3 className={styles.pricingTitle}>
              <FontAwesomeIcon icon={faChartLine} />
              Pricing Guidance for {selectedYear}
            </h3>
            <div className={styles.pricingContent}>
              <div className={styles.pricingMetric}>
                <span className={styles.pricingLabel}>
                  Monthly Overhead Average:
                </span>
                <span className={styles.pricingValue}>
                  ${(yearSpecificExpenses / 12).toFixed(2)}
                </span>
              </div>

              <div className={styles.pricingMetric}>
                <span className={styles.pricingLabel}>
                  Overhead per Project:
                </span>
                <span className={styles.pricingValue}>
                  $
                  {(
                    yearSpecificExpenses / yearSpecificRevenue.projectCount
                  ).toFixed(2)}
                </span>
              </div>

              <div className={styles.pricingMetric}>
                <span className={styles.pricingLabel}>
                  Current Avg Markup per Project:
                </span>
                <span className={styles.pricingValue}>
                  $
                  {(
                    yearSpecificRevenue.totalMarkup /
                    yearSpecificRevenue.projectCount
                  ).toFixed(2)}
                </span>
              </div>

              <div className={styles.pricingMetric}>
                <span className={styles.pricingLabel}>
                  Current Avg Transport per Project:
                </span>
                <span className={styles.pricingValue}>
                  $
                  {(
                    yearSpecificRevenue.totalTransportation /
                    yearSpecificRevenue.projectCount
                  ).toFixed(2)}
                </span>
              </div>

              <div className={styles.pricingRecommendation}>
                <FontAwesomeIcon icon={faChartLine} />
                <div>
                  <strong>Recommendation:</strong>
                  <p>
                    {isCovered
                      ? `✅ Your markup and transportation fees are covering overhead. 
                         To maintain this, average $${(
                           yearSpecificExpenses /
                           yearSpecificRevenue.projectCount
                         ).toFixed(2)} per project.`
                      : `⚠️ To cover your $${difference.toFixed(
                          2,
                        )} shortfall, you need to:`}
                  </p>
                  {!isCovered &&
                    (() => {
                      const n = yearSpecificRevenue.projectCount;
                      // Per-project shortfall to close the gap
                      const shortfallPerProject = n > 0 ? difference / n : 0;
                      const halfShortfallPerProject = shortfallPerProject / 2;

                      // Average markup already earned per fully-paid project
                      // calculateAdditionalRevenue returns { totalMarkup, totalTransportation, total, projectCount }
                      const avgMarkupPerProject =
                        n > 0 ? yearSpecificRevenue.totalMarkup / n : 0;

                      // "Increase markup by X%" = how much MORE relative to current avg markup per project
                      // Guard: if no markup has been charged yet, show a friendly message instead of NaN
                      const markupIncreasePercent =
                        avgMarkupPerProject > 0
                          ? (shortfallPerProject / avgMarkupPerProject) * 100
                          : null;

                      const markupSplitPercent =
                        avgMarkupPerProject > 0
                          ? (halfShortfallPerProject / avgMarkupPerProject) *
                            100
                          : null;

                      return (
                        <ul className={styles.recommendationList}>
                          <li>
                            Increase markup by{" "}
                            <strong>
                              {markupIncreasePercent !== null
                                ? `${markupIncreasePercent.toFixed(1)}%`
                                : "—"}
                            </strong>{" "}
                            (add ${shortfallPerProject.toFixed(2)} per project)
                            {markupIncreasePercent === null && (
                              <span
                                style={{ fontSize: "0.85em", color: "#e67e22" }}
                              >
                                {" "}
                                — no markup data yet for {selectedYear}
                              </span>
                            )}
                          </li>
                          <li>
                            OR increase transportation fee by{" "}
                            <strong>${shortfallPerProject.toFixed(2)}</strong>{" "}
                            per project
                          </li>
                          <li>
                            OR split between both:{" "}
                            {markupSplitPercent !== null
                              ? `+${markupSplitPercent.toFixed(1)}%`
                              : "—"}{" "}
                            markup and +${halfShortfallPerProject.toFixed(2)}{" "}
                            transport
                          </li>
                        </ul>
                      );
                    })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
