// src/components/CustomerProjects/CustomerProjects.jsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faEye,
  faEdit,
  faTrashAlt,
  faDollarSign,
  faCalendarAlt,
  faProjectDiagram,
  faChevronDown,
  faChevronUp,
  faStickyNote,
  faDownload,
  faPhone,
  faEnvelope,
  faMapMarkerAlt,
  faCreditCard,
  faBuilding,
  faCheckCircle,
  faExclamationTriangle,
  faHourglassHalf,
  faClock,
  faCoins,
  faWallet,
  faLayerGroup,
  faTable,
  faTh,
} from "@fortawesome/free-solid-svg-icons";
import { deleteProject } from "../../services/projectService";
import { CalculatorEngine } from "../Calculator/engine/CalculatorEngine";
import { useWorkType } from "../../context/WorkTypeContext";
import { formatPhoneNumber } from "../Calculator/utils/customerhelper";
import CostBreakdown from "../Calculator/CostBreakdown/CostBreakdown";
import CustomerProjectCard from "./CustomerProjectCard";
import styles from "./CustomerProjects.module.css";

// Maps status string → CSS class & icon
const STATUS_CONFIG = {
  Completed: {
    icon: faCheckCircle,
    cssClass: "completed",
    accentColor: "#38a169",
  },
  Overdue: {
    icon: faExclamationTriangle,
    cssClass: "overdue",
    accentColor: "#e53e3e",
  },
  "In Progress": {
    icon: faHourglassHalf,
    cssClass: "inprogress",
    accentColor: "#3498db",
  },
  Pending: { icon: faClock, cssClass: "pending", accentColor: "#d97706" },
  Unknown: { icon: faClock, cssClass: "unknown", accentColor: "#6b7280" },
};

// Determines which statIcon CSS class to use per stat type
const STAT_ICON_CLASSES = {
  total: styles.statIconPrimary,
  paid: styles.statIconSuccess,
  remaining: styles.statIconError,
  overdue: styles.statIconWarning,
  Completed: styles.statIconSuccess,
  "In Progress": styles.statIconInfo,
  Pending: styles.statIconWarning,
  Overdue: styles.statIconError,
  Unknown: styles.statIconMuted,
};

export default function CustomerProjects() {
  const location = useLocation();
  const navigate = useNavigate();

  const [projects, setProjects] = useState(location.state?.projects || []);
  const [expandedProject, setExpandedProject] = useState(null);
  const [viewMode, setViewMode] = useState("table");

  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } =
    useWorkType();

  useEffect(() => {
    if (location.state?.projects?.length > 0) {
      setProjects(location.state.projects);
    }
  }, [location.state?.projects]);

  const handleBack = () => navigate("/home/customers");
  const handleDetails = (id) => navigate(`/home/customer/${id}`);
  const handleEdit = (id) =>
    navigate(`/home/edit/${id}`, {
      state: { returnPath: location.pathname, refreshKey: Date.now() },
    });

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this project?"))
      return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
    } catch {
      alert("Failed to delete project.");
    }
  };

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "N/A";

  const fmt = (n) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ── Calculations ───────────────────────────────────────────────
  // Always recalculate from categories/settings via the engine so numbers
  // stay in sync with CostBreakdown and the customers list.
  const projectCalculations = useMemo(() => {
    return projects.reduce((acc, project) => {
      try {
        const engine = new CalculatorEngine(
          project.categories || [],
          project.settings || {},
          { getMeasurementType, isValidSubtype, getWorkTypeDetails },
        );
        const { total } = engine.calculateTotals();
        const { totalPaid, totalDue, overduePayments } =
          engine.calculatePaymentDetails();
        acc[project._id] = {
          grandTotal: parseFloat(total) || 0,
          totalPaid: parseFloat(totalPaid) || 0,
          totalDue: parseFloat(totalDue) || 0,
          overduePayments: parseFloat(overduePayments) || 0,
          deposit: parseFloat(project.settings?.deposit) || 0,
        };
      } catch {
        acc[project._id] = {
          grandTotal: 0,
          totalPaid: 0,
          totalDue: 0,
          overduePayments: 0,
          deposit: 0,
        };
      }
      return acc;
    }, {});
  }, [projects, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  const getStatus = useCallback(
    (project) => {
      const today = new Date();
      const startDate = new Date(project.customerInfo?.startDate);
      const finishDate = new Date(project.customerInfo?.finishDate);
      const calc = projectCalculations[project._id];
      if (!calc) return "Unknown";
      const remaining = Math.max(0, calc.grandTotal - calc.totalPaid);
      if (remaining === 0 && finishDate < today) return "Completed";
      if (finishDate < today && remaining > 0) return "Overdue";
      if (startDate > today) return "Pending";
      if (startDate <= today && finishDate >= today) return "In Progress";
      return "Unknown";
    },
    [projectCalculations],
  );

  const exportProjectSummary = (project) => {
    const calc = projectCalculations[project._id];
    if (!calc) return alert("Unable to calculate project summary");
    const remaining = Math.max(0, calc.grandTotal - calc.totalPaid);
    const summary = `Project: ${project.customerInfo?.projectName || "Unnamed"}
Customer: ${project.customerInfo?.firstName} ${project.customerInfo?.lastName}
Phone: ${formatPhoneNumber(project.customerInfo?.phone)}
Start: ${formatDate(project.customerInfo?.startDate)}
Finish: ${formatDate(project.customerInfo?.finishDate)}
Grand Total: $${calc.grandTotal.toFixed(2)}
Total Paid: $${calc.totalPaid.toFixed(2)}
Remaining: $${remaining.toFixed(2)}
Status: ${getStatus(project)}`.trim();

    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${
        project.customerInfo?.projectName?.replace(/[^a-z0-9]/gi, "_") ||
        "project"
      }_summary.txt`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const summaryTotals = useMemo(() => {
    const vals = Object.values(projectCalculations);
    return {
      grandTotal: vals.reduce((s, c) => s + c.grandTotal, 0),
      totalPaid: vals.reduce((s, c) => s + c.totalPaid, 0),
      totalRemaining: vals.reduce(
        (s, c) => s + Math.max(0, c.grandTotal - c.totalPaid),
        0,
      ),
      overduePayments: vals.reduce((s, c) => s + c.overduePayments, 0),
    };
  }, [projectCalculations]);

  const statusCounts = useMemo(() => {
    const counts = { Completed: 0, "In Progress": 0, Pending: 0, Overdue: 0 };
    projects.forEach((p) => {
      const s = getStatus(p);
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [projects, getStatus]);

  const customerInfo = projects[0]?.customerInfo || {};
  const customerName =
    `${customerInfo.firstName || ""} ${customerInfo.lastName || ""}`.trim() ||
    "Customer";

  // ── Empty State ────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <button onClick={handleBack} className={styles.backBtn}>
            <FontAwesomeIcon icon={faArrowLeft} /> Back to Customers
          </button>
          <div className={styles.emptyState}>
            <FontAwesomeIcon icon={faProjectDiagram} />
            <h2>No Projects Found</h2>
            <p>This customer doesn't have any projects yet.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.mainContent}>
      <div className={styles.container}>
        {/* ── Top Nav ─────────────────────────────────────── */}
        <nav className={styles.topNav}>
          <button onClick={handleBack} className={styles.backBtn}>
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Back to Customers</span>
          </button>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${
                viewMode === "table" ? styles.viewBtnActive : ""
              }`}
              onClick={() => setViewMode("table")}
            >
              <FontAwesomeIcon icon={faTable} />
              <span>Table</span>
            </button>
            <button
              className={`${styles.viewBtn} ${
                viewMode === "cards" ? styles.viewBtnActive : ""
              }`}
              onClick={() => setViewMode("cards")}
            >
              <FontAwesomeIcon icon={faTh} />
              <span>Cards</span>
            </button>
          </div>
        </nav>

        {/* ── Customer Hero ────────────────────────────────── */}
        <header className={styles.customerHero}>
          <div className={styles.heroAvatar}>
            {customerName.charAt(0).toUpperCase()}
          </div>

          <div className={styles.heroInfo}>
            <h1 className={styles.heroName}>{customerName}</h1>
            <div className={styles.heroMeta}>
              {customerInfo.phone && (
                <span>
                  <FontAwesomeIcon icon={faPhone} />
                  {formatPhoneNumber(customerInfo.phone)}
                </span>
              )}
              {customerInfo.email && (
                <span>
                  <FontAwesomeIcon icon={faEnvelope} />
                  {customerInfo.email}
                </span>
              )}
              {customerInfo.street && (
                <span>
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  {customerInfo.street}, {customerInfo.state}{" "}
                  {customerInfo.zipCode}
                </span>
              )}
              {customerInfo.type && (
                <span>
                  <FontAwesomeIcon icon={faBuilding} />
                  {customerInfo.type}
                </span>
              )}
              {customerInfo.paymentType && (
                <span>
                  <FontAwesomeIcon icon={faCreditCard} />
                  {customerInfo.paymentType}
                </span>
              )}
            </div>
            {customerInfo.notes && (
              <p className={styles.heroNotes}>
                <FontAwesomeIcon icon={faStickyNote} />
                {customerInfo.notes}
              </p>
            )}
          </div>

          <div className={styles.heroProjectCount}>
            <span className={styles.countNum}>{projects.length}</span>
            <span className={styles.countLabel}>
              {projects.length === 1 ? "Project" : "Projects"}
            </span>
          </div>
        </header>

        {/* ── Stats Dashboard ───────────────────────────────── */}
        <section className={styles.statsDashboard}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
              <FontAwesomeIcon icon={faCoins} />
            </div>
            <div className={styles.statBody}>
              <span className={styles.statLabel}>Total Value</span>
              <span className={styles.statValue}>
                ${fmt(summaryTotals.grandTotal)}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconSuccess}`}>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className={styles.statBody}>
              <span className={styles.statLabel}>Total Paid</span>
              <span
                className={`${styles.statValue}`}
                style={{ color: "var(--success)" }}
              >
                ${fmt(summaryTotals.totalPaid)}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconError}`}>
              <FontAwesomeIcon icon={faWallet} />
            </div>
            <div className={styles.statBody}>
              <span className={styles.statLabel}>Outstanding</span>
              <span
                className={styles.statValue}
                style={{
                  color:
                    summaryTotals.totalRemaining > 0
                      ? "var(--error)"
                      : "var(--success)",
                }}
              >
                ${fmt(summaryTotals.totalRemaining)}
              </span>
            </div>
          </div>

          {summaryTotals.overduePayments > 0 && (
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconWarning}`}>
                <FontAwesomeIcon icon={faExclamationTriangle} />
              </div>
              <div className={styles.statBody}>
                <span className={styles.statLabel}>Overdue Payments</span>
                <span
                  className={styles.statValue}
                  style={{ color: "var(--warning)" }}
                >
                  ${fmt(summaryTotals.overduePayments)}
                </span>
              </div>
            </div>
          )}

          {Object.entries(statusCounts)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => {
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Unknown;
              const iconClass =
                STAT_ICON_CLASSES[status] || styles.statIconMuted;
              return (
                <div key={status} className={styles.statCard}>
                  <div className={`${styles.statIcon} ${iconClass}`}>
                    <FontAwesomeIcon icon={cfg.icon} />
                  </div>
                  <div className={styles.statBody}>
                    <span className={styles.statLabel}>{status}</span>
                    <span
                      className={styles.statValue}
                      style={{ color: cfg.accentColor }}
                    >
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
        </section>

        {/* ── Section Header ────────────────────────────────── */}
        <div className={styles.sectionHeader}>
          <FontAwesomeIcon icon={faLayerGroup} />
          <h2>Project History</h2>
          <div className={styles.sectionLine} />
        </div>

        {/* ── TABLE VIEW ────────────────────────────────────── */}
        {viewMode === "table" && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>
                    <FontAwesomeIcon icon={faProjectDiagram} /> Project
                  </th>
                  <th>
                    <FontAwesomeIcon icon={faCalendarAlt} /> Timeline
                  </th>
                  <th>Status</th>
                  <th>
                    <FontAwesomeIcon icon={faDollarSign} /> Total
                  </th>
                  <th>
                    <FontAwesomeIcon icon={faCheckCircle} /> Paid
                  </th>
                  <th>
                    <FontAwesomeIcon icon={faWallet} /> Remaining
                  </th>
                  <th>Progress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const calc = projectCalculations[project._id] || {};
                  const remaining = Math.max(
                    0,
                    (calc.grandTotal || 0) - (calc.totalPaid || 0),
                  );
                  const progress =
                    calc.grandTotal > 0
                      ? Math.min(100, (calc.totalPaid / calc.grandTotal) * 100)
                      : 0;
                  const status = getStatus(project);
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Unknown;
                  const isExpanded = expandedProject === project._id;

                  const progressFillClass =
                    progress >= 100
                      ? styles.miniProgressHigh
                      : progress >= 50
                      ? styles.miniProgressMid
                      : styles.miniProgressLow;

                  return (
                    <React.Fragment key={project._id}>
                      <tr
                        className={`${styles.tableRow} ${
                          isExpanded ? styles.rowExpanded : ""
                        }`}
                      >
                        <td>
                          <button
                            className={styles.expandBtn}
                            onClick={() =>
                              setExpandedProject(
                                isExpanded ? null : project._id,
                              )
                            }
                            aria-expanded={isExpanded}
                          >
                            <FontAwesomeIcon
                              icon={isExpanded ? faChevronUp : faChevronDown}
                            />
                          </button>
                        </td>
                        <td className={styles.projectNameCell}>
                          {project.customerInfo?.projectName ||
                            "Unnamed Project"}
                        </td>
                        <td className={styles.timelineCell}>
                          <div>
                            <span className={styles.dateFrom}>
                              {formatDate(project.customerInfo?.startDate)}
                            </span>
                            <span className={styles.dateArrow}>→</span>
                            <span className={styles.dateTo}>
                              {formatDate(project.customerInfo?.finishDate)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusChip} ${
                              styles[cfg.cssClass]
                            }`}
                          >
                            <FontAwesomeIcon icon={cfg.icon} />
                            {status}
                          </span>
                        </td>
                        <td className={styles.moneyCell}>
                          ${fmt(calc.grandTotal || 0)}
                        </td>
                        <td
                          className={`${styles.moneyCell} ${styles.moneyCellPaid}`}
                        >
                          ${fmt(calc.totalPaid || 0)}
                        </td>
                        <td
                          className={`${styles.moneyCell} ${
                            remaining > 0
                              ? styles.moneyCellDue
                              : styles.moneyCellSettled
                          }`}
                        >
                          ${fmt(remaining)}
                        </td>
                        <td className={styles.progressCell}>
                          <div className={styles.miniProgressTrack}>
                            <div
                              className={`${styles.miniProgressFill} ${progressFillClass}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className={styles.progressLabel}>
                            {Math.round(progress)}%
                          </span>
                        </td>
                        <td className={styles.actionsCell}>
                          <button
                            onClick={() => handleDetails(project._id)}
                            className={`${styles.actionBtn} ${styles.viewBtnAction}`}
                            title="View Details"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          <button
                            onClick={() => handleEdit(project._id)}
                            className={`${styles.actionBtn} ${styles.editBtnAction}`}
                            title="Edit"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => exportProjectSummary(project)}
                            className={`${styles.actionBtn} ${styles.downloadBtnAction}`}
                            title="Export"
                          >
                            <FontAwesomeIcon icon={faDownload} />
                          </button>
                          <button
                            onClick={() => handleDelete(project._id)}
                            className={`${styles.actionBtn} ${styles.deleteBtnAction}`}
                            title="Delete"
                          >
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className={styles.detailRow}>
                          <td colSpan="9">
                            <div className={styles.expandedContent}>
                              <div className={styles.expandedDetailsGrid}>
                                <div className={styles.expandedDetail}>
                                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                                  <div>
                                    <span className={styles.expandedLabel}>
                                      Address
                                    </span>
                                    <span className={styles.expandedValue}>
                                      {project.customerInfo?.street || "N/A"}
                                      {project.customerInfo?.unit
                                        ? `, ${project.customerInfo.unit}`
                                        : ""}
                                      , {project.customerInfo?.state}{" "}
                                      {project.customerInfo?.zipCode}
                                    </span>
                                  </div>
                                </div>
                                <div className={styles.expandedDetail}>
                                  <FontAwesomeIcon icon={faEnvelope} />
                                  <div>
                                    <span className={styles.expandedLabel}>
                                      Email
                                    </span>
                                    <span className={styles.expandedValue}>
                                      {project.customerInfo?.email || "N/A"}
                                    </span>
                                  </div>
                                </div>
                                {project.customerInfo?.notes && (
                                  <div className={styles.expandedDetail}>
                                    <FontAwesomeIcon icon={faStickyNote} />
                                    <div>
                                      <span className={styles.expandedLabel}>
                                        Notes
                                      </span>
                                      <span className={styles.expandedValue}>
                                        {project.customerInfo.notes}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {calc.deposit > 0 && (
                                  <div className={styles.expandedDetail}>
                                    <FontAwesomeIcon icon={faDollarSign} />
                                    <div>
                                      <span className={styles.expandedLabel}>
                                        Deposit
                                      </span>
                                      <span className={styles.expandedValue}>
                                        ${fmt(calc.deposit)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <CostBreakdown
                                key={project._id}
                                categories={project.categories}
                                settings={project.settings}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Footer totals */}
            <div className={styles.tableTotalsRow}>
              <span>
                {projects.length} project{projects.length !== 1 ? "s" : ""}
              </span>
              <div className={styles.tableTotalsFinancials}>
                <span>
                  Total: <strong>${fmt(summaryTotals.grandTotal)}</strong>
                </span>
                <span style={{ color: "var(--success)" }}>
                  Paid: <strong>${fmt(summaryTotals.totalPaid)}</strong>
                </span>
                <span
                  style={{
                    color:
                      summaryTotals.totalRemaining > 0
                        ? "var(--error)"
                        : "var(--success)",
                  }}
                >
                  Outstanding:{" "}
                  <strong>${fmt(summaryTotals.totalRemaining)}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── CARDS VIEW ────────────────────────────────────── */}
        {viewMode === "cards" && (
          <div className={styles.cardsGrid}>
            {projects.map((project) => (
              <CustomerProjectCard
                key={project._id}
                project={project}
                formatDate={formatDate}
                handleDetails={handleDetails}
                handleEdit={handleEdit}
                handleDelete={handleDelete}
                exportProjectSummary={exportProjectSummary}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}