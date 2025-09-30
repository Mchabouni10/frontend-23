//src/components/CustomerProjects/CustomerProjectCard.jsx
import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEdit,
  faTrashAlt,
  faDollarSign,
  faCalendarAlt,
  faChevronDown,
  faChevronUp,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import CostBreakdown from "../Calculator/CostBreakdown/CostBreakdown";
import { CalculatorEngine } from "../Calculator/engine/CalculatorEngine";
import { useWorkType } from "../../context/WorkTypeContext";
import styles from "./CustomerProjectCard.module.css";

export default function CustomerProjectCard({
  project,
  formatDate,
  handleDetails,
  handleEdit,
  handleDelete,
  exportProjectSummary,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get work type functions from context
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  // Memoized calculations - prioritize stored values
  const calculations = useMemo(() => {
    try {
      // First check if we have stored calculation results
      if (project.totals && project.paymentDetails) {
        // Use stored values from database for accuracy
        const grandTotal = parseFloat(project.totals.total || project.totals.grandTotal || 0);
        const totalPaid = parseFloat(project.paymentDetails.totalPaid || 0);
        const totalDue = parseFloat(project.paymentDetails.totalDue || 0);
        const overduePayments = parseFloat(project.paymentDetails.overduePayments || 0);
        const deposit = project.settings?.deposit || 0;
        
        return {
          grandTotal,
          totalPaid,
          totalDue,
          overduePayments,
          deposit,
        };
      } else {
        // Fallback to calculation if no stored totals
        const engine = new CalculatorEngine(
          project.categories || [],
          project.settings || {},
          { getMeasurementType, isValidSubtype, getWorkTypeDetails }
        );
        
        const { total, errors: totalErrors } = engine.calculateTotals();
        const { totalPaid, totalDue, overduePayments, errors: paymentErrors } = engine.calculatePaymentDetails();
        
        if (totalErrors.length > 0 || paymentErrors.length > 0) {
          console.warn(`Calculation errors for project ${project._id}:`, [...totalErrors, ...paymentErrors]);
        }
        
        return {
          grandTotal: parseFloat(total) || 0,
          totalPaid: parseFloat(totalPaid) || 0,
          totalDue: parseFloat(totalDue) || 0,
          overduePayments: parseFloat(overduePayments) || 0,
          deposit: project.settings?.deposit || 0,
        };
      }
    } catch (error) {
      console.error(`Failed to calculate for project ${project._id}:`, error);
      return {
        grandTotal: 0,
        totalPaid: 0,
        totalDue: 0,
        overduePayments: 0,
        deposit: 0,
      };
    }
  }, [project, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  const amountRemaining = Math.max(0, calculations.grandTotal - calculations.totalPaid);
  const progress = calculations.grandTotal > 0 ? 
    (((calculations.totalPaid) / calculations.grandTotal) * 100).toFixed(0) : 0;

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

  return (
    <div className={styles.projectCard}>
      <div className={styles.cardHeader}>
        <div className={styles.headerContent}>
          <button
            className={styles.expandButton}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
          </button>
          <span className={styles.projectName}>
            {project.customerInfo?.projectName || "Unnamed Project"}
          </span>
          <span className={`${styles.statusBadge} ${styles[status.toLowerCase()]}`}>
            {status}
          </span>
        </div>
      </div>
      <div className={styles.cardContent}>
        <p>
          <FontAwesomeIcon icon={faCalendarAlt} /> Start:{" "}
          {formatDate(project.customerInfo?.startDate) || "N/A"}
        </p>
        <p>
          <FontAwesomeIcon icon={faCalendarAlt} /> End:{" "}
          {formatDate(project.customerInfo?.finishDate) || "N/A"}
        </p>
        <div className={styles.progressBar}>
          <span>Paid: {progress}%</span>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <p className={styles.moneyDetails}>
          <FontAwesomeIcon icon={faDollarSign} /> Due: ${amountRemaining.toFixed(2)}
          <span className={styles.amountDisplay}>${amountRemaining.toFixed(2)}</span>
        </p>
        <p>
          <FontAwesomeIcon icon={faDollarSign} /> Total: ${calculations.grandTotal.toFixed(2)}
        </p>
      </div>
      <div className={styles.cardActions}>
        <button
          onClick={() => handleDetails(project._id)}
          className={styles.actionButton}
          title="View Details"
        >
          <FontAwesomeIcon icon={faEye} />
        </button>
        <button
          onClick={() => handleEdit(project._id)}
          className={`${styles.actionButton} ${styles.editButton}`}
          title="Edit"
        >
          <FontAwesomeIcon icon={faEdit} />
        </button>
        <button
          onClick={() => exportProjectSummary(project)}
          className={`${styles.actionButton} ${styles.downloadButton}`}
          title="Download Summary"
        >
          <FontAwesomeIcon icon={faDownload} />
        </button>
        <button
          onClick={() => handleDelete(project._id)}
          className={`${styles.actionButton} ${styles.deleteButton}`}
          title="Delete"
        >
          <FontAwesomeIcon icon={faTrashAlt} />
        </button>
      </div>
      {isExpanded && (
        <div className={styles.detailsSection}>
          <h4>Project Details</h4>
          <div className={styles.detailContent}>
            <p>
              <strong>Address:</strong>{" "}
              {project.customerInfo.street || "N/A"}{" "}
              {project.customerInfo.unit ? `, ${project.customerInfo.unit}` : ""},{" "}
              {project.customerInfo.state || "N/A"} {project.customerInfo.zipCode || "N/A"}
            </p>
            <p>
              <strong>Email:</strong> {project.customerInfo.email || "N/A"}
            </p>
            <p>
              <strong>Notes:</strong> {project.customerInfo.notes || "None"}
            </p>
          </div>
          <CostBreakdown categories={project.categories} settings={project.settings} />
        </div>
      )}
    </div>
  );
}