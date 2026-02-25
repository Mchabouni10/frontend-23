// src/components/CustomerProjects/CustomerProjectCard.jsx
import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEdit,
  faTrashAlt,
  faCalendarAlt,
  faChevronDown,
  faChevronUp,
  faDownload,
  faCheckCircle,
  faExclamationTriangle,
  faClock,
  faHourglassHalf,
  faMapMarkerAlt,
  faEnvelope,
  faStickyNote,
  faCoins,
  faWallet,
  faArrowUp,
} from "@fortawesome/free-solid-svg-icons";
import CostBreakdown from "../Calculator/CostBreakdown/CostBreakdown";
import { CalculatorEngine } from "../Calculator/engine/CalculatorEngine";
import { useWorkType } from "../../context/WorkTypeContext";
import styles from "./CustomerProjectCard.module.css";

const STATUS_CONFIG = {
  Completed: {
    icon: faCheckCircle,
    cssClass: "completed",
    accentColor: "#38a169",
    label: "Completed",
  },
  Overdue: {
    icon: faExclamationTriangle,
    cssClass: "overdue",
    accentColor: "#e53e3e",
    label: "Overdue",
  },
  "In Progress": {
    icon: faHourglassHalf,
    cssClass: "inprogress",
    accentColor: "#3498db",
    label: "In Progress",
  },
  Pending: {
    icon: faClock,
    cssClass: "pending",
    accentColor: "#d97706",
    label: "Pending",
  },
  Unknown: {
    icon: faClock,
    cssClass: "unknown",
    accentColor: "#6b7280",
    label: "Unknown",
  },
};

export default function CustomerProjectCard({
  project,
  formatDate,
  handleDetails,
  handleEdit,
  handleDelete,
  exportProjectSummary,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } =
    useWorkType();

  // Always recalculate from categories/settings via the engine so numbers
  // stay in sync with CostBreakdown and the customers list.
  const calculations = useMemo(() => {
    try {
      const engine = new CalculatorEngine(
        project.categories || [],
        project.settings || {},
        { getMeasurementType, isValidSubtype, getWorkTypeDetails },
      );
      const { total } = engine.calculateTotals();
      const { totalPaid, totalDue, overduePayments } =
        engine.calculatePaymentDetails();
      return {
        grandTotal: parseFloat(total) || 0,
        totalPaid: parseFloat(totalPaid) || 0,
        totalDue: parseFloat(totalDue) || 0,
        overduePayments: parseFloat(overduePayments) || 0,
        deposit: parseFloat(project.settings?.deposit) || 0,
      };
    } catch {
      return {
        grandTotal: 0,
        totalPaid: 0,
        totalDue: 0,
        overduePayments: 0,
        deposit: 0,
      };
    }
  }, [project, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  const amountRemaining = Math.max(
    0,
    calculations.grandTotal - calculations.totalPaid,
  );
  const progress =
    calculations.grandTotal > 0
      ? Math.min(100, (calculations.totalPaid / calculations.grandTotal) * 100)
      : 0;

  const getStatus = () => {
    const today = new Date();
    const startDate = new Date(project.customerInfo?.startDate);
    const finishDate = new Date(project.customerInfo?.finishDate);
    if (amountRemaining === 0 && finishDate < today) return "Completed";
    if (finishDate < today && amountRemaining > 0) return "Overdue";
    if (startDate > today) return "Pending";
    if (startDate <= today && finishDate >= today) return "In Progress";
    return "Unknown";
  };

  const status = getStatus();
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.Unknown;

  const daysLeft = () => {
    const today = new Date();
    const finishDate = new Date(project.customerInfo?.finishDate);
    return Math.ceil((finishDate - today) / (1000 * 60 * 60 * 24));
  };
  const days = daysLeft();

  const fmt = (n) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const progressClass =
    progress >= 100
      ? styles.progressHigh
      : progress >= 50
      ? styles.progressMid
      : styles.progressLow;

  const countdownClass =
    days < 0 ? styles.countdownRed : days <= 7 ? styles.countdownAmber : "";

  return (
    <article className={styles.projectCard}>
      {/* Status accent bar */}
      <div
        className={styles.statusAccentBar}
        style={{ background: statusCfg.accentColor }}
      />

      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.headerTop}>
          <span
            className={`${styles.statusPill} ${styles[statusCfg.cssClass]}`}
          >
            <FontAwesomeIcon icon={statusCfg.icon} />
            {statusCfg.label}
          </span>

          {status !== "Completed" && (
            <span className={`${styles.countdown} ${countdownClass}`}>
              {days < 0
                ? `${Math.abs(days)}d overdue`
                : days === 0
                ? "Due today"
                : `${days}d left`}
            </span>
          )}
        </div>

        <h3 className={styles.projectName}>
          {project.customerInfo?.projectName || "Unnamed Project"}
        </h3>

        <div className={styles.dateRow}>
          <span>
            <FontAwesomeIcon icon={faCalendarAlt} />
            {formatDate(project.customerInfo?.startDate) || "TBD"}
          </span>
          <span className={styles.dateSep}>→</span>
          <span>
            <FontAwesomeIcon icon={faCalendarAlt} />
            {formatDate(project.customerInfo?.finishDate) || "TBD"}
          </span>
        </div>
      </div>

      {/* Financials */}
      <div className={styles.financialsGrid}>
        <div className={styles.finCard}>
          <span className={styles.finLabel}>
            <FontAwesomeIcon icon={faCoins} /> Total Value
          </span>
          <span className={styles.finValue}>
            ${fmt(calculations.grandTotal)}
          </span>
        </div>

        <div className={styles.finCard}>
          <span className={styles.finLabel}>
            <FontAwesomeIcon icon={faCheckCircle} /> Paid
          </span>
          <span className={`${styles.finValue} ${styles.finValuePaid}`}>
            ${fmt(calculations.totalPaid)}
          </span>
        </div>

        <div className={styles.finCard}>
          <span className={styles.finLabel}>
            <FontAwesomeIcon icon={faWallet} /> Remaining
          </span>
          <span
            className={`${styles.finValue} ${
              amountRemaining > 0 ? styles.finValueDue : styles.finValueSettled
            }`}
          >
            ${fmt(amountRemaining)}
          </span>
        </div>

        {calculations.deposit > 0 && (
          <div className={styles.finCard}>
            <span className={styles.finLabel}>
              <FontAwesomeIcon icon={faArrowUp} /> Deposit
            </span>
            <span className={`${styles.finValue} ${styles.finValueDeposit}`}>
              ${fmt(calculations.deposit)}
            </span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span>Payment Progress</span>
          <span className={styles.progressPct}>{Math.round(progress)}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressFill} ${progressClass}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {calculations.overduePayments > 0 && (
          <div className={styles.overdueNote}>
            <FontAwesomeIcon icon={faExclamationTriangle} />$
            {fmt(calculations.overduePayments)} overdue
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.cardActions}>
        <button
          onClick={() => handleDetails(project._id)}
          className={`${styles.actionBtn} ${styles.viewBtn}`}
          title="View Details"
        >
          <FontAwesomeIcon icon={faEye} />
          <span>View</span>
        </button>
        <button
          onClick={() => handleEdit(project._id)}
          className={`${styles.actionBtn} ${styles.editBtn}`}
          title="Edit"
        >
          <FontAwesomeIcon icon={faEdit} />
          <span>Edit</span>
        </button>
        <button
          onClick={() => exportProjectSummary(project)}
          className={`${styles.actionBtn} ${styles.downloadBtn}`}
          title="Export"
        >
          <FontAwesomeIcon icon={faDownload} />
          <span>Export</span>
        </button>
        <button
          onClick={() => handleDelete(project._id)}
          className={`${styles.actionBtn} ${styles.deleteBtn}`}
          title="Delete"
        >
          <FontAwesomeIcon icon={faTrashAlt} />
        </button>
      </div>

      {/* Expand toggle */}
      <button
        className={styles.expandToggle}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span>{isExpanded ? "Hide Details" : "Show Details"}</span>
        <FontAwesomeIcon
          icon={isExpanded ? faChevronUp : faChevronDown}
          className={styles.expandIcon}
        />
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className={styles.expandedSection}>
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <FontAwesomeIcon
                icon={faMapMarkerAlt}
                className={styles.detailIcon}
              />
              <div>
                <span className={styles.detailLabel}>Address</span>
                <span className={styles.detailValue}>
                  {project.customerInfo?.street || "N/A"}
                  {project.customerInfo?.unit
                    ? `, ${project.customerInfo.unit}`
                    : ""}
                  , {project.customerInfo?.state || "N/A"}{" "}
                  {project.customerInfo?.zipCode || ""}
                </span>
              </div>
            </div>
            <div className={styles.detailItem}>
              <FontAwesomeIcon
                icon={faEnvelope}
                className={styles.detailIcon}
              />
              <div>
                <span className={styles.detailLabel}>Email</span>
                <span className={styles.detailValue}>
                  {project.customerInfo?.email || "N/A"}
                </span>
              </div>
            </div>
            {project.customerInfo?.notes && (
              <div className={styles.detailItem}>
                <FontAwesomeIcon
                  icon={faStickyNote}
                  className={styles.detailIcon}
                />
                <div>
                  <span className={styles.detailLabel}>Notes</span>
                  <span className={styles.detailValue}>
                    {project.customerInfo.notes}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.costBreakdownWrapper}>
            <CostBreakdown
              categories={project.categories}
              settings={project.settings}
            />
          </div>
        </div>
      )}
    </article>
  );
}