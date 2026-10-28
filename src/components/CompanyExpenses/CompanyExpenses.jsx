// src/components/CompanyExpenses/CompanyExpenses.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faReceipt,
  faCalendarAlt,
  faFileInvoiceDollar,
  faSpinner,
  faFilter,
  faDownload,
  faChartLine,
  faChartPie,
  faMoneyBillWave,
  faTimes,
  faSearch,
  faWallet,
  faInfoCircle,
  faTriangleExclamation,
  faArrowUp,
  faArrowDown,
  faUsers,
  faHardHat,
} from "@fortawesome/free-solid-svg-icons";
import * as expensesAPI from "../../utilities/expenses-api";
import * as workersAPI from "../../utilities/workers-api";
import { getProjects } from "../../services/projectService";
import {
  calculateAdditionalRevenue,
  isProjectFullyPaid,
  getProjectAdditionalRevenue,
} from "../../constants/additionalRevenueCalculator";
import ProjectProfit from "./ProjectProfit";
import Workers from "./Workers";
import {
  CATEGORIES,
  PAYMENT_METHODS,
  JOB_CATEGORIES,
  getCategory,
  money,
  percent,
  toDateKey,
  getLocalDateKey,
  formatDate,
  formatWeekday,
  formatMonthLabel,
  getProjectLabel,
  sortProjectsNewestFirst,
} from "./expenseShared";
import styles from "./CompanyExpenses.module.css";

// Normalise one expense coming from the API.
const normalizeExpense = (exp) => ({ ...exp, date: toDateKey(exp.date) });

// Newest first; same-day entries fall back to creation order so the list
// never shuffles between renders.
const compareExpensesNewestFirst = (a, b) => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const aStamp = a.createdAt || a._id || "";
  const bStamp = b.createdAt || b._id || "";
  return String(bStamp).localeCompare(String(aStamp));
};

const EMPTY_FORM = () => ({
  date: getLocalDateKey(),
  category: "fuel",
  amount: "",
  description: "",
  projectId: "",
  workerId: "",
  paymentMethod: "Cash",
});

export default function CompanyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // FIX #4: validation error separate from network error
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Job costing: workers + the agreed amount per worker per project
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showNewWorker, setShowNewWorker] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [selectedProject, setSelectedProject] = useState("all"); // all | none | <id>
  const [selectedWorker, setSelectedWorker] = useState("all");

  // Advanced filtering state
  const [filterType, setFilterType] = useState("all"); // 'all', 'month', 'year', 'custom'
  const [selectedMonth, setSelectedMonth] = useState(
    getLocalDateKey().slice(0, 7),
  ); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(),
  );
  // FIX #6: separate state for the coverage analysis year selector
  const [coverageYear, setCoverageYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
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

      // Workers are optional: if that endpoint fails, expenses still load.
      const [expensesData, projectsData, workersData, assignmentsData] =
        await Promise.all([
          expensesAPI.getAllExpenses(),
          getProjects(),
          workersAPI.getWorkers().catch(() => []),
          workersAPI.getAssignments().catch(() => []),
        ]);

      setExpenses((expensesData || []).map(normalizeExpense));
      setProjects(projectsData || []);
      setWorkers(workersData || []);
      setAssignments(assignmentsData || []);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Worker pay and worker-specific meals may carry a worker.
      if (name === "category" && !JOB_CATEGORIES.includes(value))
        next.workerId = "";
      return next;
    });
    // Clear validation error when user starts typing
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // FIX #4: show validation feedback instead of silently returning
    if (!formData.date) {
      setFormError("Please select a date.");
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setFormError("Please enter a valid amount greater than $0.");
      return;
    }

    if (JOB_CATEGORIES.includes(formData.category) && !formData.projectId) {
      setFormError("Worker pay and crew meals must be linked to a project.");
      return;
    }
    if (formData.category === "worker_pay" && !formData.workerId) {
      setFormError("Worker Pay needs a worker and a project.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setFormError(null);

      const expenseData = {
        date: formData.date,
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
        projectId: formData.projectId || null,
        workerId: JOB_CATEGORIES.includes(formData.category)
          ? formData.workerId || null
          : null,
        paymentMethod: formData.paymentMethod,
      };

      // FIX #1: optimistically update local state instead of refetching everything
      const createdExpense = await expensesAPI.createExpense(expenseData);
      setExpenses((prev) => [...prev, normalizeExpense(createdExpense)]);

      // Keep the date + payment method: entering several receipts in a row
      // is the common case.
      setFormData((prev) => ({
        ...EMPTY_FORM(),
        date: prev.date,
        paymentMethod: prev.paymentMethod,
      }));
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
      // FIX #1: remove from local state instead of refetching everything
      setExpenses((prev) => prev.filter((exp) => exp._id !== id));
    } catch (err) {
      console.error("Error deleting expense:", err);
      setError("Failed to delete expense. Please try again.");
    }
  };

  const handleCreateWorker = async () => {
    const name = newWorkerName.trim();
    if (!name) return;
    try {
      setFormError(null);
      const worker = await workersAPI.createWorker({ name });
      setWorkers((prev) =>
        [...prev, worker].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFormData((prev) => ({ ...prev, workerId: worker._id }));
      setNewWorkerName("");
      setShowNewWorker(false);
    } catch (err) {
      console.error("Error creating worker:", err);
      setFormError("Could not add the worker. Please try again.");
    }
  };

  const getCategoryColor = (catId) => getCategory(catId).color;
  const getCategoryName = (catId) => getCategory(catId).name;
  const getCategoryIcon = (catId) => getCategory(catId).icon;

  // Lookups for the worker / project links on each expense
  const workerNameById = useMemo(
    () => Object.fromEntries(workers.map((w) => [w._id, w.name])),
    [workers],
  );
  const projectLabelById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p._id, getProjectLabel(p)])),
    [projects],
  );
  const projectOptions = useMemo(
    () => sortProjectsNewestFirst(projects),
    [projects],
  );

  // "Ahmed → George Smith — Kitchen"
  const getExpenseLinkLabel = useCallback(
    (exp) =>
      [
        exp.workerId && (workerNameById[exp.workerId] || "Removed worker"),
        exp.projectId && (projectLabelById[exp.projectId] || "Deleted project"),
      ]
        .filter(Boolean)
        .join(" → "),
    [workerNameById, projectLabelById],
  );

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

    // Payment method filtering
    if (selectedMethod !== "all") {
      filtered = filtered.filter((exp) => exp.paymentMethod === selectedMethod);
    }

    // Project / worker filtering
    if (selectedProject === "none") {
      filtered = filtered.filter((exp) => !exp.projectId);
    } else if (selectedProject !== "all") {
      filtered = filtered.filter((exp) => exp.projectId === selectedProject);
    }
    if (selectedWorker !== "all") {
      filtered = filtered.filter((exp) => exp.workerId === selectedWorker);
    }

    // Search filtering
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          getCategoryName(exp.category).toLowerCase().includes(search) ||
          (exp.description && exp.description.toLowerCase().includes(search)) ||
          getExpenseLinkLabel(exp).toLowerCase().includes(search) ||
          exp.amount.toString().includes(search),
      );
    }

    return filtered.sort(compareExpensesNewestFirst);
  }, [
    expenses,
    filterType,
    selectedMonth,
    selectedYear,
    customDateRange,
    selectedCategory,
    selectedMethod,
    selectedProject,
    selectedWorker,
    searchTerm,
    getExpenseLinkLabel,
  ]);

  // Calculate filtered statistics
  const filteredStats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const count = filteredExpenses.length;
    const average = count > 0 ? total / count : 0;

    const categoryBreakdown = {};
    const methodBreakdown = {};
    let jobTotal = 0;
    let largest = null;
    filteredExpenses.forEach((exp) => {
      categoryBreakdown[exp.category] =
        (categoryBreakdown[exp.category] || 0) + exp.amount;
      const method = exp.paymentMethod || "Other";
      methodBreakdown[method] = (methodBreakdown[method] || 0) + exp.amount;
      if (exp.projectId) jobTotal += exp.amount;
      if (!largest || exp.amount > largest.amount) largest = exp;
    });

    return {
      total,
      count,
      average,
      categoryBreakdown,
      methodBreakdown,
      jobTotal,
      overheadTotal: total - jobTotal,
      largest,
    };
  }, [filteredExpenses]);

  // Top-of-page KPIs (always all data — independent from the filters below)
  const kpis = useMemo(() => {
    const today = getLocalDateKey();
    const thisMonth = today.slice(0, 7);
    const thisYear = today.slice(0, 4);
    const [y, m] = thisMonth.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevMonth = `${prev.getFullYear()}-${String(
      prev.getMonth() + 1,
    ).padStart(2, "0")}`;

    const out = {
      month: 0,
      monthCount: 0,
      prevMonth: 0,
      ytd: 0,
      ytdJob: 0,
      ytdOverhead: 0,
      ytdCash: 0,
      topCategory: null,
    };
    const ytdCat = {};
    expenses.forEach((e) => {
      if (e.date.startsWith(thisMonth)) {
        out.month += e.amount;
        out.monthCount += 1;
      } else if (e.date.startsWith(prevMonth)) {
        out.prevMonth += e.amount;
      }
      if (e.date.startsWith(thisYear)) {
        out.ytd += e.amount;
        if (e.projectId) out.ytdJob += e.amount;
        else out.ytdOverhead += e.amount;
        if (e.paymentMethod === "Cash") out.ytdCash += e.amount;
        ytdCat[e.category] = (ytdCat[e.category] || 0) + e.amount;
      }
    });
    const top = Object.entries(ytdCat).sort((a, b) => b[1] - a[1])[0];
    if (top) out.topCategory = { id: top[0], amount: top[1] };
    out.monthDelta =
      out.prevMonth > 0
        ? ((out.month - out.prevMonth) / out.prevMonth) * 100
        : null;
    out.year = thisYear;
    return out;
  }, [expenses]);

  // Category bars for the "Spending breakdown" panel (top 6 + rest)
  const categoryBars = useMemo(() => {
    const rows = Object.entries(filteredStats.categoryBreakdown).sort(
      (a, b) => b[1] - a[1],
    );
    const top = rows.slice(0, 6).map(([id, amount]) => ({ id, amount }));
    const restAmount = rows.slice(6).reduce((sum, [, amt]) => sum + amt, 0);
    if (restAmount > 0) top.push({ id: "__rest", amount: restAmount });
    return top;
  }, [filteredStats]);

  // Live "agreed / paid / left" for the worker + project picked in the form
  const formWorkerInfo = useMemo(() => {
    if (formData.category !== "worker_pay") return null;
    if (!formData.workerId || !formData.projectId) return null;
    const assignment = assignments.find(
      (a) =>
        a.workerId === formData.workerId && a.projectId === formData.projectId,
    );
    const paid = expenses
      .filter(
        (e) =>
          e.category === "worker_pay" &&
          e.workerId === formData.workerId &&
          e.projectId === formData.projectId,
      )
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      agreed: assignment ? assignment.agreedAmount : null,
      paid,
      left: assignment ? assignment.agreedAmount - paid : null,
    };
  }, [
    formData.category,
    formData.workerId,
    formData.projectId,
    assignments,
    expenses,
  ]);

  // Group the (already sorted) history by month with a subtotal per month
  const groupedExpenses = useMemo(() => {
    const groups = [];
    filteredExpenses.forEach((exp) => {
      const monthKey = exp.date.slice(0, 7);
      let group = groups[groups.length - 1];
      if (!group || group.key !== monthKey) {
        group = {
          key: monthKey,
          label: formatMonthLabel(monthKey),
          total: 0,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(exp);
      group.total += exp.amount;
    });
    return groups;
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
  // FIX #6: uses coverageYear instead of selectedYear so it's
  //         independent from the filter section year selector
  // ============================================================

  // Get additional revenue for COVERAGE year only (from fully paid projects completed in that year)
  const yearSpecificRevenue = useMemo(() => {
    return calculateAdditionalRevenue(projects, {
      year: parseInt(coverageYear),
    });
  }, [projects, coverageYear]);

  // Overhead = expenses NOT linked to a project. Job costs (worker pay, crew
  // meals, project materials) are paid out of the project itself, so they are
  // shown on Project Profit instead of counting against markup + transportation.
  const overheadExpenses = useMemo(
    () => expenses.filter((exp) => !exp.projectId),
    [expenses],
  );

  // Get expenses for COVERAGE year only
  const yearSpecificExpenses = useMemo(() => {
    return overheadExpenses
      .filter((exp) => exp.date.startsWith(coverageYear))
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [overheadExpenses, coverageYear]);

  // FIX #3: year-specific category breakdown — computed from raw expenses
  //         for the coverage year, not from filteredStats (which reflects
  //         whatever the user has active in the filter section)
  const yearSpecificCategoryBreakdown = useMemo(() => {
    const breakdown = {};
    overheadExpenses
      .filter((exp) => exp.date.startsWith(coverageYear))
      .forEach((exp) => {
        if (!breakdown[exp.category]) breakdown[exp.category] = 0;
        breakdown[exp.category] += exp.amount;
      });
    return breakdown;
  }, [overheadExpenses, coverageYear]);

  // Get projects completed in coverage year (for detailed breakdown)
  // FIX #5: uses lastPaymentDate (or equivalent final-payment field) when
  //         available so a project started in one year but paid in another
  //         is attributed to the correct year. Falls back to startDate.
  const projectsCompletedInYear = useMemo(() => {
    return projects.filter((p) => {
      if (!isProjectFullyPaid(p)) return false;
      // Prefer the date the project was fully paid if your data has it;
      // fall back to startDate otherwise.
      const relevantDate =
        p.customerInfo?.lastPaymentDate || p.customerInfo?.startDate;
      if (!relevantDate) return false;
      const projectYear = new Date(relevantDate).getFullYear();
      return projectYear === parseInt(coverageYear);
    });
  }, [projects, coverageYear]);

  // Calculate year-over-year trend data
  const yearOverYearData = useMemo(() => {
    const years = availableYears.slice(0, 5); // Last 5 years max
    return years.map((year) => {
      const revenue = calculateAdditionalRevenue(projects, {
        year: parseInt(year),
      });
      const expenses_yr = overheadExpenses
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
  }, [projects, overheadExpenses, availableYears]);

  // A partial year should be averaged over the months that have happened.
  const monthsElapsed =
    coverageYear === String(new Date().getFullYear())
      ? new Date().getMonth() + 1
      : 12;

  const isCovered = yearSpecificRevenue.total >= yearSpecificExpenses;
  const difference = Math.abs(yearSpecificRevenue.total - yearSpecificExpenses);
  const coveragePercentage =
    yearSpecificExpenses > 0
      ? (yearSpecificRevenue.total / yearSpecificExpenses) * 100
      : 0;

  const handleExportCSV = () => {
    const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Date",
      "Category",
      "Description",
      "Project",
      "Worker",
      "Paid By",
      "Amount",
    ];
    const rows = filteredExpenses.map((exp) => [
      exp.date,
      csvCell(getCategoryName(exp.category)),
      csvCell(exp.description),
      csvCell(
        exp.projectId
          ? projectLabelById[exp.projectId] || "Deleted project"
          : "",
      ),
      csvCell(
        exp.workerId ? workerNameById[exp.workerId] || "Removed worker" : "",
      ),
      csvCell(exp.paymentMethod),
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
    // FIX #7: release the blob URL to avoid memory leak
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    filterType !== "all" ||
    selectedCategory !== "all" ||
    selectedMethod !== "all" ||
    selectedProject !== "all" ||
    selectedWorker !== "all" ||
    Boolean(searchTerm);

  const isJobCategory = JOB_CATEGORIES.includes(formData.category);

  const clearFilters = () => {
    setFilterType("all");
    setSelectedCategory("all");
    setSelectedMethod("all");
    setSelectedProject("all");
    setSelectedWorker("all");
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

      {/* KPI strip — always all-time data, independent from the filters */}
      <div className={styles.dashboard}>
        <div className={styles.card}>
          <div
            className={styles.cardIcon}
            style={{
              background:
                "linear-gradient(135deg, var(--primary), var(--primary-dark))",
            }}
          >
            <FontAwesomeIcon icon={faCalendarAlt} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>This month</span>
            <span className={styles.cardAmount}>{money(kpis.month)}</span>
            <span className={styles.cardSub}>
              {kpis.monthDelta === null ? (
                `${kpis.monthCount} ${
                  kpis.monthCount === 1 ? "expense" : "expenses"
                }`
              ) : (
                <>
                  <span
                    className={
                      kpis.monthDelta > 0 ? styles.trendUp : styles.trendDown
                    }
                  >
                    <FontAwesomeIcon
                      icon={kpis.monthDelta > 0 ? faArrowUp : faArrowDown}
                    />{" "}
                    {Math.abs(kpis.monthDelta).toFixed(0)}%
                  </span>{" "}
                  vs last month ({money(kpis.prevMonth)})
                </>
              )}
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <div
            className={styles.cardIcon}
            style={{
              background:
                "linear-gradient(135deg, var(--secondary), var(--secondary-dark))",
            }}
          >
            <FontAwesomeIcon icon={faChartLine} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>{kpis.year} to date</span>
            <span className={styles.cardAmount}>{money(kpis.ytd)}</span>
            <span className={styles.cardSub}>
              {money(kpis.ytdCash)} paid in cash
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <div
            className={styles.cardIcon}
            style={{ background: "linear-gradient(135deg, #1abc9c, #16a085)" }}
          >
            <FontAwesomeIcon icon={faHardHat} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>Job costs {kpis.year}</span>
            <span className={styles.cardAmount}>{money(kpis.ytdJob)}</span>
            <span className={styles.cardSub}>
              Overhead {money(kpis.ytdOverhead)} ·{" "}
              {percent(kpis.ytdJob, kpis.ytd)}% on jobs
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <div
            className={styles.cardIcon}
            style={{
              background: kpis.topCategory
                ? getCategoryColor(kpis.topCategory.id)
                : "var(--muted)",
            }}
          >
            <FontAwesomeIcon
              icon={
                kpis.topCategory
                  ? getCategoryIcon(kpis.topCategory.id)
                  : faReceipt
              }
            />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>Top category {kpis.year}</span>
            <span className={styles.cardAmount}>
              {kpis.topCategory ? money(kpis.topCategory.amount) : "—"}
            </span>
            <span className={styles.cardSub}>
              {kpis.topCategory
                ? getCategoryName(kpis.topCategory.id)
                : "No expenses yet"}
            </span>
          </div>
        </div>
      </div>

      {/* Add Expense Form */}
      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>
          <FontAwesomeIcon icon={faPlus} />
          Add New Expense
        </h2>

        {/* FIX #4: show validation error inline above the form */}
        {formError && (
          <div className={styles.errorMessage}>
            <p>{formError}</p>
            <button type="button" onClick={() => setFormError(null)}>
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.fDate}`}>
              <label className={styles.label} htmlFor="exp-date">
                Date
              </label>
              <input
                id="exp-date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className={styles.input}
                disabled={submitting}
                required
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fCategory}`}>
              <label className={styles.label} htmlFor="exp-category">
                Category
              </label>
              <select
                id="exp-category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={styles.select}
                disabled={submitting}
              >
                <optgroup label="Company overhead">
                  {CATEGORIES.filter((c) => !JOB_CATEGORIES.includes(c.id)).map(
                    (cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ),
                  )}
                </optgroup>
                <optgroup label="Job costs (need a project)">
                  {CATEGORIES.filter((c) => JOB_CATEGORIES.includes(c.id)).map(
                    (cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ),
                  )}
                </optgroup>
              </select>
            </div>

            <div className={`${styles.formGroup} ${styles.fAmount}`}>
              <label className={styles.label} htmlFor="exp-amount">
                Amount ($)
              </label>
              <input
                id="exp-amount"
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

            <div className={`${styles.formGroup} ${styles.fPaidBy}`}>
              <label className={styles.label} htmlFor="exp-method">
                Paid By
              </label>
              <select
                id="exp-method"
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleInputChange}
                className={styles.select}
                disabled={submitting}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.formGroup} ${styles.fDescription}`}>
              <label className={styles.label} htmlFor="exp-desc">
                Description
              </label>
              <input
                id="exp-desc"
                type="text"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="e.g. Shell Gas Station"
                disabled={submitting}
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fProject}`}>
              <label className={styles.label} htmlFor="exp-project">
                Project{isJobCategory ? "" : " (optional)"}
              </label>
              <select
                id="exp-project"
                name="projectId"
                value={formData.projectId}
                onChange={handleInputChange}
                className={styles.select}
                disabled={submitting}
              >
                <option value="">
                  {isJobCategory
                    ? "Select project…"
                    : "No project (company overhead)"}
                </option>
                {projectOptions.map((p) => (
                  <option key={p._id} value={p._id}>
                    {getProjectLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            {isJobCategory && (
              <div className={`${styles.formGroup} ${styles.fWorker}`}>
                <label className={styles.label} htmlFor="exp-worker">
                  Worker
                  {formData.category === "crew_meals" ? " (optional)" : ""}
                </label>
                <select
                  id="exp-worker"
                  name="workerId"
                  value={formData.workerId}
                  onChange={handleInputChange}
                  className={styles.select}
                  disabled={submitting}
                >
                  <option value="">Select worker…</option>
                  {workers
                    .filter(
                      (w) => w.active !== false || w._id === formData.workerId,
                    )
                    .map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))}
                </select>
                {showNewWorker ? (
                  <div className={styles.inlineRow}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="New worker's full name"
                      value={newWorkerName}
                      onChange={(e) => setNewWorkerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateWorker();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={handleCreateWorker}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() => {
                        setShowNewWorker(false);
                        setNewWorkerName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setShowNewWorker(true)}
                  >
                    + New worker
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={styles.formFooter}>
            {formWorkerInfo && formWorkerInfo.agreed !== null ? (
              <div className={styles.formHint}>
                <FontAwesomeIcon icon={faInfoCircle} />
                <span>
                  Agreed <strong>{money(formWorkerInfo.agreed)}</strong> · paid{" "}
                  <strong>{money(formWorkerInfo.paid)}</strong> ·{" "}
                  {formWorkerInfo.left >= 0 ? (
                    <>
                      <strong>{money(formWorkerInfo.left)}</strong> left
                    </>
                  ) : (
                    <>
                      <strong>{money(Math.abs(formWorkerInfo.left))}</strong>{" "}
                      already overpaid
                    </>
                  )}
                </span>
                {formWorkerInfo.left > 0 && (
                  <button
                    type="button"
                    className={styles.quickFill}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        amount: formWorkerInfo.left.toFixed(2),
                      }))
                    }
                  >
                    Fill {money(formWorkerInfo.left)}
                  </button>
                )}
              </div>
            ) : formWorkerInfo ? (
              <div className={`${styles.formHint} ${styles.formHintWarn}`}>
                <FontAwesomeIcon icon={faTriangleExclamation} />
                <span>
                  No agreed amount for this worker on this project yet. Set it
                  in Project Profit to track what is still owed.
                </span>
              </div>
            ) : isJobCategory ? (
              <div className={styles.formHint}>
                <FontAwesomeIcon icon={faUsers} />
                <span>
                  Job cost: counted against this project’s profit, not company
                  overhead.
                </span>
              </div>
            ) : formData.projectId ? (
              <div className={styles.formHint}>
                <FontAwesomeIcon icon={faHardHat} />
                <span>
                  Linked to a project: counted in its job costs, not company
                  overhead.
                </span>
              </div>
            ) : (
              <div className={styles.formHint}>
                <FontAwesomeIcon icon={faInfoCircle} />
                <span>
                  Company overhead: counts toward the Overhead Coverage
                  analysis.
                </span>
              </div>
            )}

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
          </div>
        </form>
      </section>

      {/* Advanced Filters Section */}
      <section className={styles.filtersSection}>
        <div className={styles.filtersHeader}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faFilter} />
            Advanced Filters
          </h2>
          {hasActiveFilters && (
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
              {/* FIX #6: this selector only controls the filter, not the coverage section */}
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

          {/* Project */}
          <div className={styles.filterGroup}>
            <label className={styles.label}>Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Projects</option>
              <option value="none">Overhead only (no project)</option>
              {projectOptions.map((p) => (
                <option key={p._id} value={p._id}>
                  {getProjectLabel(p)}
                </option>
              ))}
            </select>
          </div>

          {/* Worker */}
          <div className={styles.filterGroup}>
            <label className={styles.label}>Worker</label>
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Workers</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment method */}
          <div className={styles.filterGroup}>
            <label className={styles.label}>Paid By</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className={styles.select}
            >
              <option value="all">Any method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className={`${styles.filterGroup} ${styles.filterSearch}`}>
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
              {money(filteredStats.total)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Average:</span>
            <span className={styles.statValue}>
              {money(filteredStats.average)}
            </span>
          </div>
        </div>
      </section>

      {/* Spending breakdown — follows the active filters */}
      <section className={styles.insightsSection}>
        <h2 className={styles.sectionTitle}>
          <FontAwesomeIcon icon={faChartPie} />
          Spending Breakdown
          {hasActiveFilters && (
            <span className={styles.cardSub}>&nbsp;(filtered)</span>
          )}
        </h2>

        {filteredStats.count === 0 ? (
          <p className={styles.emptyNote}>
            Nothing to break down for the current filters.
          </p>
        ) : (
          <div className={styles.insightsGrid}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>By category</h3>
              {categoryBars.map((row) => {
                const isRest = row.id === "__rest";
                const cat = getCategory(row.id);
                const share = percent(row.amount, filteredStats.total);
                return (
                  <div className={styles.barRow} key={row.id}>
                    <div className={styles.barLabel}>
                      {!isRest && (
                        <FontAwesomeIcon
                          icon={cat.icon}
                          style={{ color: cat.color }}
                        />
                      )}
                      <span>{isRest ? "Other categories" : cat.name}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${share}%`,
                          background: isRest ? "var(--muted)" : cat.color,
                        }}
                      />
                    </div>
                    <div className={styles.barValue}>
                      {money(row.amount)}
                      <small>{share}%</small>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Overhead vs job costs</h3>
              <div className={styles.splitBar}>
                <div
                  style={{
                    width: `${percent(
                      filteredStats.overheadTotal,
                      filteredStats.total,
                    )}%`,
                    background: "var(--secondary)",
                  }}
                />
                <div
                  style={{
                    width: `${percent(
                      filteredStats.jobTotal,
                      filteredStats.total,
                    )}%`,
                    background: "#1abc9c",
                  }}
                />
              </div>
              <div className={styles.legend}>
                <div className={styles.legendRow}>
                  <span>
                    <i
                      className={styles.dot}
                      style={{ background: "var(--secondary)" }}
                    />
                    Company overhead
                  </span>
                  <span className={styles.legendValue}>
                    {money(filteredStats.overheadTotal)}
                    <small>
                      {percent(
                        filteredStats.overheadTotal,
                        filteredStats.total,
                      )}
                      %
                    </small>
                  </span>
                </div>
                <div className={styles.legendRow}>
                  <span>
                    <i
                      className={styles.dot}
                      style={{ background: "#1abc9c" }}
                    />
                    Job costs
                  </span>
                  <span className={styles.legendValue}>
                    {money(filteredStats.jobTotal)}
                    <small>
                      {percent(filteredStats.jobTotal, filteredStats.total)}%
                    </small>
                  </span>
                </div>
              </div>

              <div className={styles.panelDivider} />

              <h3 className={styles.panelTitle}>By payment method</h3>
              <div className={styles.legend}>
                {Object.entries(filteredStats.methodBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, amount]) => (
                    <div className={styles.legendRow} key={method}>
                      <span>{method}</span>
                      <span className={styles.legendValue}>
                        {money(amount)}
                        <small>{percent(amount, filteredStats.total)}%</small>
                      </span>
                    </div>
                  ))}
              </div>

              {filteredStats.largest && (
                <>
                  <div className={styles.panelDivider} />
                  <h3 className={styles.panelTitle}>Largest expense</h3>
                  <div className={styles.legendRow}>
                    <span>
                      {filteredStats.largest.description ||
                        getCategoryName(filteredStats.largest.category)}
                    </span>
                    <span className={styles.legendValue}>
                      {money(filteredStats.largest.amount)}
                      <small>{formatDate(filteredStats.largest.date)}</small>
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Expense History */}
      <section className={styles.listSection}>
        <div className={styles.controls}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faReceipt} />
            Expense History
          </h2>
          <button
            type="button"
            onClick={handleExportCSV}
            className={styles.exportButton}
          >
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
                <th>Paid By</th>
                <th className={styles.amountHead}>Amount</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className={styles.emptyCell}>
                    No expenses found matching your filters.
                  </td>
                </tr>
              ) : (
                groupedExpenses.map((group) => (
                  <React.Fragment key={group.key}>
                    <tr className={styles.groupRow}>
                      <td colSpan="6">
                        <span>{group.label}</span>
                        <span className={styles.groupMeta}>
                          {group.items.length}{" "}
                          {group.items.length === 1 ? "expense" : "expenses"}
                          {" · "}
                          {money(group.total)}
                        </span>
                      </td>
                    </tr>
                    {group.items.map((exp) => {
                      const cat = getCategory(exp.category);
                      return (
                        <tr key={exp._id}>
                          <td className={styles.dateCell}>
                            <span className={styles.weekday}>
                              {formatWeekday(exp.date)}
                            </span>
                            {formatDate(exp.date)}
                          </td>
                          <td>
                            <span
                              className={styles.categoryTag}
                              style={{
                                backgroundColor: `${cat.color}20`,
                                color: cat.color,
                                borderLeft: `3px solid ${cat.color}`,
                              }}
                            >
                              <FontAwesomeIcon icon={cat.icon} />
                              {cat.name}
                            </span>
                          </td>
                          <td>
                            <div className={styles.descMain}>
                              {exp.description || "—"}
                            </div>
                            {(exp.workerId || exp.projectId) && (
                              <div className={styles.descMeta}>
                                {exp.workerId && (
                                  <span className={styles.linkChip}>
                                    <FontAwesomeIcon icon={faUsers} />
                                    {workerNameById[exp.workerId] ||
                                      "Removed worker"}
                                  </span>
                                )}
                                {exp.projectId && (
                                  <span
                                    className={`${styles.linkChip} ${styles.linkChipProject}`}
                                  >
                                    <FontAwesomeIcon icon={faHardHat} />
                                    {projectLabelById[exp.projectId] ||
                                      "Deleted project"}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={styles.methodTag}>
                              {exp.paymentMethod || "—"}
                            </span>
                          </td>
                          <td className={styles.amountCell}>
                            {money(exp.amount)}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleDelete(exp._id)}
                              className={styles.deleteButton}
                              title="Delete expense"
                              aria-label="Delete expense"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length > 0 && (
          <div className={styles.listFooter}>
            <span>
              Showing {filteredStats.count} of {expenses.length} expenses
            </span>
            <span>
              Total <strong>{money(filteredStats.total)}</strong>
            </span>
          </div>
        )}
      </section>

      <Workers
        workers={workers}
        assignments={assignments}
        expenses={expenses}
        projects={projects}
        onWorkerSaved={(saved) =>
          setWorkers((prev) =>
            (prev.some((w) => w._id === saved._id)
              ? prev.map((w) => (w._id === saved._id ? saved : w))
              : [...prev, saved]
            ).sort((a, b) => a.name.localeCompare(b.name)),
          )
        }
        onWorkerRemoved={(id) => {
          setWorkers((prev) => prev.filter((w) => w._id !== id));
          setAssignments((prev) => prev.filter((a) => a.workerId !== id));
          setSelectedWorker((current) => (current === id ? "all" : current));
        }}
      />

      <ProjectProfit
        projects={projects}
        workers={workers}
        assignments={assignments}
        expenses={expenses}
        onAssignmentSaved={(saved) =>
          setAssignments((prev) =>
            prev.some((a) => a._id === saved._id)
              ? prev.map((a) => (a._id === saved._id ? saved : a))
              : [...prev, saved],
          )
        }
        onAssignmentDeleted={(id) =>
          setAssignments((prev) => prev.filter((a) => a._id !== id))
        }
      />

      {/* ============================================================ */}
      {/* YEAR-SPECIFIC OVERHEAD COVERAGE ANALYSIS                     */}
      {/* FIX #6: uses coverageYear — independent from the filter year */}
      {/* ============================================================ */}
      <section className={styles.coverageSection}>
        <div className={styles.coverageHeader}>
          <h2 className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faChartLine} />
            Overhead Coverage Analysis
          </h2>

          {/* FIX #6: Year Selector controls coverageYear only */}
          <div className={styles.coverageYearSelector}>
            <label htmlFor="coverage-year">Select Year:</label>
            <select
              id="coverage-year"
              value={coverageYear}
              onChange={(e) => setCoverageYear(e.target.value)}
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
          {/* Additional Revenue Card - Coverage Year Specific */}
          <div className={styles.coverageCard}>
            <div
              className={styles.coverageHeader}
              style={{
                background: "linear-gradient(135deg, #1abc9c, #16a085)",
              }}
            >
              <FontAwesomeIcon icon={faWallet} />
              <span>Additional Revenue ({coverageYear})</span>
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

          {/* Company Expenses Card - Coverage Year Specific */}
          <div className={styles.coverageCard}>
            <div
              className={styles.coverageHeader}
              style={{
                background: "linear-gradient(135deg, #e74c3c, #c0392b)",
              }}
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
              <span>Overhead Expenses ({coverageYear})</span>
            </div>
            <div className={styles.coverageBody}>
              <div className={styles.coverageAmount}>
                ${yearSpecificExpenses.toFixed(2)}
              </div>
              <div className={styles.coverageLabel}>
                {
                  overheadExpenses.filter((e) =>
                    e.date.startsWith(coverageYear),
                  ).length
                }{" "}
                overhead entries (job costs are on Project Profit)
              </div>
              {/* FIX #3: use yearSpecificCategoryBreakdown, not filteredStats.categoryBreakdown */}
              {yearSpecificExpenses > 0 && (
                <div className={styles.coverageBreakdown}>
                  {Object.entries(yearSpecificCategoryBreakdown)
                    .sort((a, b) => b[1] - a[1])
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

          {/* Net Position Card - Coverage Year Specific */}
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
              {/* FIX #8: replaced faEye with faInfoCircle for the "no data" state */}
              <FontAwesomeIcon
                icon={
                  isCovered
                    ? faChartLine
                    : yearSpecificExpenses === 0
                    ? faInfoCircle
                    : faMoneyBillWave
                }
              />
              <span>Net Position ({coverageYear})</span>
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
                  // FIX #6: clicking a YoY card updates coverageYear, not selectedYear
                  onClick={() => setCoverageYear(data.year)}
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

        {/* Projects List for Coverage Year */}
        {projectsCompletedInYear.length > 0 && (
          <div className={styles.projectsList}>
            <h4 className={styles.projectsListTitle}>
              <FontAwesomeIcon icon={faWallet} />
              Fully Paid Projects in {coverageYear} (
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

        {/* Pricing Guidance - Coverage Year Specific */}
        {yearSpecificExpenses > 0 && yearSpecificRevenue.projectCount > 0 && (
          <div className={styles.pricingGuidance}>
            <h3 className={styles.pricingTitle}>
              <FontAwesomeIcon icon={faChartLine} />
              Pricing Guidance for {coverageYear}
            </h3>
            <div className={styles.pricingContent}>
              <div className={styles.pricingMetric}>
                <span className={styles.pricingLabel}>
                  Monthly Overhead Average
                  {monthsElapsed < 12 ? ` (${monthsElapsed} mo so far)` : ""}:
                </span>
                <span className={styles.pricingValue}>
                  ${(yearSpecificExpenses / monthsElapsed).toFixed(2)}
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
                      const avgMarkupPerProject =
                        n > 0 ? yearSpecificRevenue.totalMarkup / n : 0;

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
                                — no markup data yet for {coverageYear}
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
