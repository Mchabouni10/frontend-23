//src/components/CustomerProjects/CustomerProjects.jsx
import React, { useState, useMemo } from "react";
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
} from "@fortawesome/free-solid-svg-icons";
import { deleteProject } from "../../services/projectService";
import { CalculatorEngine } from "../Calculator/engine/CalculatorEngine";
import { useWorkType } from "../../context/WorkTypeContext";
import { formatPhoneNumber } from "../Calculator/utils/customerhelper";
import CostBreakdown from "../Calculator/CostBreakdown/CostBreakdown";
import styles from "./CustomerProjects.module.css";

export default function CustomerProjects() {
  const location = useLocation();
  const navigate = useNavigate();
  const projects = location.state?.projects || [];
  const [expandedProject, setExpandedProject] = useState(null);
  
  // Get work type functions from context
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  const handleBack = () => navigate("/home/customers");
  const handleDetails = (projectId) => navigate(`/home/customer/${projectId}`);
  const handleEdit = (projectId) => navigate(`/home/edit/${projectId}`);
  const handleDelete = async (projectId) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteProject(projectId);
        alert("Project deleted successfully!");
        navigate("/home/customers");
      } catch (err) {
        console.error("Error deleting project:", err);
        alert("Failed to delete project.");
      }
    }
  };

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        })
      : "N/A";

  // Memoized calculation helper - prioritize stored values
  const projectCalculations = useMemo(() => {
    return projects.reduce((acc, project) => {
      try {
        // First check if we have stored calculation results
        if (project.totals && project.paymentDetails) {
          // Use stored values from database for accuracy
          const grandTotal = parseFloat(project.totals.total || project.totals.grandTotal || 0);
          const totalPaid = parseFloat(project.paymentDetails.totalPaid || 0);
          const totalDue = parseFloat(project.paymentDetails.totalDue || 0);
          const overduePayments = parseFloat(project.paymentDetails.overduePayments || 0);
          const deposit = project.settings?.deposit || 0;
          
          acc[project._id] = {
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
          
          acc[project._id] = {
            grandTotal: parseFloat(total) || 0,
            totalPaid: parseFloat(totalPaid) || 0,
            totalDue: parseFloat(totalDue) || 0,
            overduePayments: parseFloat(overduePayments) || 0,
            deposit: project.settings?.deposit || 0,
          };
        }
      } catch (error) {
        console.error(`Failed to calculate for project ${project._id}:`, error);
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

  const getProjectStatus = (project) => {
    const today = new Date();
    const startDate = new Date(project.customerInfo?.startDate);
    const finishDate = new Date(project.customerInfo?.finishDate);
    const calculations = projectCalculations[project._id];
    
    if (!calculations) return "Unknown";
    
    const amountRemaining = Math.max(0, calculations.grandTotal - calculations.totalPaid);

    if (amountRemaining === 0 && finishDate < today) return "Completed";
    if (finishDate < today && amountRemaining > 0) return "Overdue";
    if (startDate > today) return "Pending";
    if (startDate <= today && finishDate >= today) return "In Progress";
    return "Unknown";
  };

  const toggleProjectDetails = (projectId) => {
    setExpandedProject(expandedProject === projectId ? null : projectId);
  };

  const exportProjectSummary = (project) => {
    const calculations = projectCalculations[project._id];
    if (!calculations) {
      alert("Unable to calculate project summary");
      return;
    }
    
    const amountRemaining = Math.max(0, calculations.grandTotal - calculations.totalPaid);
    
    const summary = `
      Project: ${project.customerInfo?.projectName || "Unnamed Project"}
      Customer: ${project.customerInfo?.firstName} ${project.customerInfo?.lastName}
      Phone: ${formatPhoneNumber(project.customerInfo?.phone)}
      Start Date: ${formatDate(project.customerInfo?.startDate)}
      Finish Date: ${formatDate(project.customerInfo?.finishDate)}
      Grand Total: ${calculations.grandTotal.toFixed(2)}
      Amount Remaining: ${amountRemaining.toFixed(2)}
      Status: ${getProjectStatus(project)}
    `;
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      project.customerInfo?.projectName || "project"
    }_summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const customerInfo = projects[0]?.customerInfo || {};

  // Calculate summary totals
  const summaryTotals = useMemo(() => {
    const totalGrandTotal = Object.values(projectCalculations).reduce(
      (sum, calc) => sum + calc.grandTotal, 0
    );
    const totalAmountRemaining = Object.values(projectCalculations).reduce(
      (sum, calc) => sum + Math.max(0, calc.grandTotal - calc.totalPaid), 0
    );
    
    return { totalGrandTotal, totalAmountRemaining };
  }, [projectCalculations]);

  return (
    <main className={styles.mainContent}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          <div>{`${customerInfo.firstName || "Customer"} ${
            customerInfo.lastName || ""
          } Projects`}</div>
          <div>Phone Number: {formatPhoneNumber(customerInfo.phone)}</div>
        </h1>
        <button
          onClick={handleBack}
          className={styles.backButtonEnhanced}
          title="Back to Customers List"
        >
          <FontAwesomeIcon icon={faArrowLeft} /> Back to Customers
        </button>

        {/* Customer Info Summary */}
        <section className={styles.customerSummary}>
          <h2 className={styles.subTitle}>Customer Details</h2>
          <div className={styles.infoGrid}>
            <p>
              <strong>Address:</strong> {customerInfo.street || "N/A"}{" "}
              {customerInfo.unit ? `, ${customerInfo.unit}` : ""},{" "}
              {customerInfo.state || "N/A"} {customerInfo.zipCode || "N/A"}
            </p>
            <p>
              <strong>Email:</strong> {customerInfo.email || "N/A"}
            </p>
            <p>
              <strong>Type:</strong> {customerInfo.type || "Residential"}
            </p>
            <p>
              <strong>Payment Type:</strong>{" "}
              {customerInfo.paymentType || "Cash"}
            </p>
            {customerInfo.notes && (
              <p>
                <strong>Notes:</strong> <FontAwesomeIcon icon={faStickyNote} />{" "}
                {customerInfo.notes}
              </p>
            )}
          </div>
        </section>

        {/* Projects List */}
        {projects.length > 0 ? (
          <div className={styles.tableWrapper}>
            <h2 className={styles.subTitle}>Project List</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <FontAwesomeIcon icon={faProjectDiagram} /> Project Name
                  </th>
                  <th>
                    <FontAwesomeIcon icon={faCalendarAlt} /> Start Date
                  </th>
                  <th>
                    <FontAwesomeIcon icon={faCalendarAlt} /> Finish Date
                  </th>
                  <th>Status</th>
                  <th>
                    <FontAwesomeIcon icon={faDollarSign} /> Amount Remaining
                  </th>
                  <th>
                    <FontAwesomeIcon icon={faDollarSign} /> Grand Total
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const calculations = projectCalculations[project._id];
                  const amountRemaining = calculations 
                    ? Math.max(0, calculations.grandTotal - calculations.totalPaid)
                    : 0;
                  const status = getProjectStatus(project);
                  const isExpanded = expandedProject === project._id;

                  return (
                    <React.Fragment key={project._id}>
                      <tr className={isExpanded ? styles.expandedRow : ""}>
                        <td>
                          <button
                            className={styles.expandButton}
                            onClick={() => toggleProjectDetails(project._id)}
                            aria-expanded={isExpanded}
                          >
                            <FontAwesomeIcon
                              icon={isExpanded ? faChevronUp : faChevronDown}
                            />
                          </button>
                          {project.customerInfo?.projectName ||
                            "Unnamed Project"}
                        </td>
                        <td>{formatDate(project.customerInfo?.startDate)}</td>
                        <td>{formatDate(project.customerInfo?.finishDate)}</td>
                        <td>
                          <span
                            className={`${styles.status} ${
                              styles[status.toLowerCase()]
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td
                          className={`${styles.currency} ${
                            amountRemaining > 0
                              ? styles.amountDue
                              : styles.amountPaid
                          }`}
                          title={calculations ? `Deposit: ${calculations.deposit.toFixed(
                            2
                          )}, Paid: ${calculations.totalPaid.toFixed(2)}` : 'Calculation unavailable'}
                        >
                          ${amountRemaining.toFixed(2)}
                          {amountRemaining > 0 ? (
                            <span className={styles.statusIndicator}>
                              {" "}
                              (Due)
                            </span>
                          ) : (
                            <span className={styles.statusIndicator}>
                              {" "}
                              (Paid)
                            </span>
                          )}
                        </td>
                        <td className={styles.grandTotal}>
                          ${calculations ? calculations.grandTotal.toFixed(2) : '0.00'}
                        </td>
                        <td className={styles.actions}>
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
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={styles.detailRow}>
                          <td colSpan="7">
                            <div className={styles.projectDetails}>
                              <h3>Project Details</h3>
                              {/* Customer Info for this Project */}
                              <div className={styles.detailSection}>
                                <h4>Customer Info</h4>
                                <p>
                                  <strong>Address:</strong>{" "}
                                  {project.customerInfo.street || "N/A"}{" "}
                                  {project.customerInfo.unit
                                    ? `, ${project.customerInfo.unit}`
                                    : ""}
                                  , {project.customerInfo.state || "N/A"}{" "}
                                  {project.customerInfo.zipCode || "N/A"}
                                </p>
                                <p>
                                  <strong>Email:</strong>{" "}
                                  {project.customerInfo.email || "N/A"}
                                </p>
                                <p>
                                  <strong>Notes:</strong>{" "}
                                  {project.customerInfo.notes || "None"}
                                </p>
                              </div>
                              {/* Cost Breakdown */}
                              <div className={styles.detailSection}>
                                <CostBreakdown
                                  categories={project.categories}
                                  settings={project.settings}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {/* Summary Totals */}
            <div className={styles.totalsSection}>
              <p>Total Projects: {projects.length}</p>
              <p>
                Total Grand Total: $
                {summaryTotals.totalGrandTotal.toFixed(2)}
              </p>
              <p>
                Total Amount Remaining: $
                {summaryTotals.totalAmountRemaining.toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
          <p className={styles.noResults}>
            No projects found for this customer.
          </p>
        )}
      </div>
    </main>
  );
}
