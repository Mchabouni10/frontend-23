//src/components/CustomerProjects/CustomerProjects.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  faSync,
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
  const params = useParams();
  
  const [projects, setProjects] = useState(location.state?.projects || []);
  const [expandedProject, setExpandedProject] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  // Fetch projects from server to ensure fresh data
  const fetchProjects = async (phoneNumber) => {
    if (!phoneNumber) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/projects/customer/${phoneNumber}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        setLastRefresh(Date.now());
      } else {
        console.error("Failed to fetch projects");
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Refresh projects when component mounts or when returning from edit
  useEffect(() => {
    const customerPhone = location.state?.projects?.[0]?.customerInfo?.phone;
    
    // If we have a phone number, fetch fresh data
    if (customerPhone) {
      fetchProjects(customerPhone);
    } else if (location.state?.projects) {
      // Fallback to location state if available
      setProjects(location.state.projects);
    }
  }, [location.state?.refreshKey]); // Refresh when a key changes

  const handleBack = () => navigate("/home/customers");
  
  const handleDetails = (projectId) => navigate(`/home/customer/${projectId}`);
  
  const handleEdit = (projectId) => {
    // Pass a refresh key so we know to refresh when returning
    navigate(`/home/edit/${projectId}`, {
      state: { 
        returnPath: location.pathname,
        refreshKey: Date.now() 
      }
    });
  };
  
  const handleDelete = async (projectId) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteProject(projectId);
        alert("Project deleted successfully!");
        
        // Refresh the projects list after deletion
        const customerPhone = projects[0]?.customerInfo?.phone;
        if (customerPhone) {
          await fetchProjects(customerPhone);
        } else {
          navigate("/home/customers");
        }
      } catch (err) {
        console.error("Error deleting project:", err);
        alert("Failed to delete project.");
      }
    }
  };

  const handleRefresh = () => {
    const customerPhone = projects[0]?.customerInfo?.phone;
    if (customerPhone) {
      fetchProjects(customerPhone);
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

  // Recalculate whenever projects or lastRefresh changes
  const projectCalculations = useMemo(() => {
    console.log("Recalculating project totals...", { 
      projectCount: projects.length,
      lastRefresh: new Date(lastRefresh).toISOString()
    });
    
    return projects.reduce((acc, project) => {
      try {
        // Always recalculate from scratch to ensure fresh data
        const engine = new CalculatorEngine(
          project.categories || [],
          project.settings || {},
          { getMeasurementType, isValidSubtype, getWorkTypeDetails }
        );
        
        const totalsResult = engine.calculateTotals();
        const paymentsResult = engine.calculatePaymentDetails();
        
        // Log any calculation errors
        if (totalsResult.errors?.length > 0 || paymentsResult.errors?.length > 0) {
          console.warn(`Calculation errors for project ${project._id}:`, {
            totalsErrors: totalsResult.errors,
            paymentsErrors: paymentsResult.errors
          });
        }
        
        const grandTotal = parseFloat(totalsResult.total) || 0;
        const totalPaid = parseFloat(paymentsResult.totalPaid) || 0;
        const totalDue = parseFloat(paymentsResult.totalDue) || 0;
        const overduePayments = parseFloat(paymentsResult.overduePayments) || 0;
        const deposit = parseFloat(project.settings?.deposit) || 0;
        
        console.log(`Project ${project._id} calculations:`, {
          grandTotal,
          totalPaid,
          totalDue,
          deposit,
          categoriesCount: project.categories?.length || 0,
          itemsCount: project.categories?.reduce((sum, cat) => sum + (cat.workItems?.length || 0), 0) || 0
        });
        
        acc[project._id] = {
          grandTotal,
          totalPaid,
          totalDue,
          overduePayments,
          deposit,
        };
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
  }, [projects, lastRefresh, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

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
Grand Total: $${calculations.grandTotal.toFixed(2)}
Total Paid: $${calculations.totalPaid.toFixed(2)}
Amount Remaining: $${amountRemaining.toFixed(2)}
Status: ${getProjectStatus(project)}
    `.trim();
    
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      project.customerInfo?.projectName?.replace(/[^a-z0-9]/gi, '_') || "project"
    }_summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const customerInfo = projects[0]?.customerInfo || {};

  const summaryTotals = useMemo(() => {
    const totalGrandTotal = Object.values(projectCalculations).reduce(
      (sum, calc) => sum + calc.grandTotal, 0
    );
    const totalAmountRemaining = Object.values(projectCalculations).reduce(
      (sum, calc) => sum + Math.max(0, calc.grandTotal - calc.totalPaid), 0
    );
    
    return { totalGrandTotal, totalAmountRemaining };
  }, [projectCalculations]);

  if (projects.length === 0 && !isRefreshing) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <h1 className={styles.title}>Customer Projects</h1>
          <button
            onClick={handleBack}
            className={styles.backButtonEnhanced}
            title="Back to Customers List"
          >
            <FontAwesomeIcon icon={faArrowLeft} /> Back to Customers
          </button>
          <p className={styles.noResults}>
            No projects found for this customer.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.mainContent}>
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <h1 className={styles.title}>
            <div>{`${customerInfo.firstName || "Customer"} ${
              customerInfo.lastName || ""
            } Projects`}</div>
            <div>Phone Number: {formatPhoneNumber(customerInfo.phone)}</div>
          </h1>
          <button
            onClick={handleRefresh}
            className={`${styles.refreshButton} ${isRefreshing ? styles.spinning : ''}`}
            title="Refresh Projects"
            disabled={isRefreshing}
          >
            <FontAwesomeIcon icon={faSync} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        <button
          onClick={handleBack}
          className={styles.backButtonEnhanced}
          title="Back to Customers List"
        >
          <FontAwesomeIcon icon={faArrowLeft} /> Back to Customers
        </button>

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
                            styles[status.toLowerCase().replace(' ', '')]
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
                        title={calculations ? `Deposit: $${calculations.deposit.toFixed(
                          2
                        )}, Paid: $${calculations.totalPaid.toFixed(2)}` : 'Calculation unavailable'}
                      >
                        ${amountRemaining.toFixed(2)}
                        {amountRemaining > 0 ? (
                          <span className={styles.statusIndicator}>
                            {" "}(Due)
                          </span>
                        ) : (
                          <span className={styles.statusIndicator}>
                            {" "}(Paid)
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
                            <div className={styles.detailSection}>
                              <CostBreakdown
                                key={`${project._id}-${lastRefresh}`}
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
      </div>
    </main>
  );
}
