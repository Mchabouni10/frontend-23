import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEdit,
  faTrashAlt,
  faSort,
  faSortUp,
  faSortDown,
  faPlusCircle,
  faUser,
  faAddressCard,
  faPhone,
  faTasks,
  faCalendarAlt,
  faDollarSign,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./CustomersList.module.css";

export default function CustomersListTable({
  paginatedCustomers,
  handleSort,
  handleDetails,
  handleEdit,
  handleDelete,
  handleNewProject,
  handleExportCSV,
  sortConfig,
  formatPhoneNumber,
  navigate,
}) {
  // Get sort icon based on current sort state
  const getSortIcon = (key) =>
    sortConfig.key === key
      ? sortConfig.direction === "asc"
        ? faSortUp
        : faSortDown
      : faSort;

  // Format date without time
  const formatDateDisplay = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        })
      : "N/A";

  // Calculate payment progress percentage - memoized to avoid recalculation
  const getPaymentProgress = useMemo(
    () => (customer) => {
      const total = customer.totalGrandTotal || 0;
      const remaining = customer.totalAmountRemaining || 0;
      const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
      return Math.round(progress);
    },
    []
  );

  return (
    <>
      {paginatedCustomers.length > 0 ? (
        <div className={styles.tableWrapper}>
          {/* Table Header Actions */}
          <div className={styles.tableHeaderActions}>
            <button
              onClick={handleExportCSV}
              className={styles.exportButton}
              title="Export customers to CSV"
              aria-label="Export customers to CSV"
            >
              <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
              <span>Export</span>
            </button>
          </div>

          {/* Customers Table */}
          <table className={styles.table} role="table">
            <thead>
              <tr>
                <th scope="col">
                  <FontAwesomeIcon icon={faUser} aria-hidden="true" /> First
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("lastName")}
                  className={styles.sortable}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSort("lastName");
                    }
                  }}
                  aria-label={`Sort by last name. Currently ${
                    sortConfig.key === "lastName"
                      ? sortConfig.direction === "asc"
                        ? "sorted ascending"
                        : "sorted descending"
                      : "not sorted"
                  }`}
                >
                  <FontAwesomeIcon icon={faAddressCard} aria-hidden="true" /> Last{" "}
                  <FontAwesomeIcon icon={getSortIcon("lastName")} aria-hidden="true" />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faPhone} aria-hidden="true" /> Phone
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faTasks} aria-hidden="true" /> Projects
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("startDate")}
                  className={styles.sortable}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSort("startDate");
                    }
                  }}
                  aria-label={`Sort by start date. Currently ${
                    sortConfig.key === "startDate"
                      ? sortConfig.direction === "asc"
                        ? "sorted ascending"
                        : "sorted descending"
                      : "not sorted"
                  }`}
                >
                  <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" /> Start{" "}
                  <FontAwesomeIcon icon={getSortIcon("startDate")} aria-hidden="true" />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" /> Finish
                </th>
                <th scope="col">Status</th>
                <th
                  scope="col"
                  onClick={() => handleSort("amountRemaining")}
                  className={styles.sortable}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSort("amountRemaining");
                    }
                  }}
                  aria-label={`Sort by amount remaining. Currently ${
                    sortConfig.key === "amountRemaining"
                      ? sortConfig.direction === "asc"
                        ? "sorted ascending"
                        : "sorted descending"
                      : "not sorted"
                  }`}
                >
                  <FontAwesomeIcon icon={faDollarSign} aria-hidden="true" /> Remaining{" "}
                  <FontAwesomeIcon icon={getSortIcon("amountRemaining")} aria-hidden="true" />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faDollarSign} aria-hidden="true" /> Total
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer, index) => {
                const hasMultipleProjects = customer.projects.length > 1;
                const progress = getPaymentProgress(customer);
                const customerId = customer.projects[0]?._id || `customer-${index}`;
                
                return (
                  <tr key={customerId}>
                    <td>{customer.customerInfo.firstName || "N/A"}</td>
                    <td>{customer.customerInfo.lastName || "N/A"}</td>
                    <td>
                      <a 
                        href={`tel:${customer.customerInfo.phone}`}
                        className={styles.phoneLink}
                        aria-label={`Call ${customer.customerInfo.firstName} ${customer.customerInfo.lastName}`}
                      >
                        {formatPhoneNumber(customer.customerInfo.phone)}
                      </a>
                    </td>
                    <td>
                      <span aria-label={`${customer.projects.length} projects`}>
                        {customer.projects.length}
                      </span>
                    </td>
                    <td>{formatDateDisplay(customer.earliestStartDate)}</td>
                    <td>{formatDateDisplay(customer.latestFinishDate)}</td>
                    <td>
                      <span
                        className={`${styles.status} ${
                          styles[customer.status.toLowerCase().replace(/\s+/g, "")]
                        }`}
                        data-tooltip={customer.status}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td
                      className={
                        customer.totalAmountRemaining > 0
                          ? styles.amountDue
                          : styles.amountPaid
                      }
                    >
                      <div className={styles.progressContainer}>
                        <div 
                          className={styles.progressBarContainer}
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-label={`Payment progress: ${progress}%`}
                        >
                          <div
                            className={styles.progressBar}
                            style={{ width: `${progress}%` }}
                          />
                          <span className={styles.progressText} aria-hidden="true">
                            {progress}%
                          </span>
                        </div>
                        <span className={styles.amountDisplay}>
                          ${customer.totalAmountRemaining.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className={styles.grandTotal}>
                      ${customer.totalGrandTotal.toFixed(2)}
                    </td>
                    <td className={styles.actions}>
                      <button
                        onClick={() => handleDetails(customer.projects)}
                        className={styles.actionButton}
                        title="View Details"
                        aria-label={`View details for ${customer.customerInfo.firstName} ${customer.customerInfo.lastName}`}
                      >
                        <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleEdit(customer.projects[0]._id)}
                        className={`${styles.actionButton} ${styles.editButton}`}
                        disabled={hasMultipleProjects}
                        title={
                          hasMultipleProjects
                            ? "View details to edit specific project"
                            : "Edit Project"
                        }
                        aria-label={
                          hasMultipleProjects
                            ? "Multiple projects - view details to edit"
                            : `Edit project for ${customer.customerInfo.firstName} ${customer.customerInfo.lastName}`
                        }
                      >
                        <FontAwesomeIcon icon={faEdit} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleNewProject(customer.customerInfo)}
                        className={`${styles.actionButton} ${styles.newProjectButton}`}
                        title="Add New Project"
                        aria-label={`Add new project for ${customer.customerInfo.firstName} ${customer.customerInfo.lastName}`}
                      >
                        <FontAwesomeIcon icon={faPlusCircle} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.projects[0]._id)}
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        disabled={hasMultipleProjects}
                        title={
                          hasMultipleProjects
                            ? "View details to delete specific project"
                            : "Delete Project"
                        }
                        aria-label={
                          hasMultipleProjects
                            ? "Multiple projects - view details to delete"
                            : `Delete project for ${customer.customerInfo.firstName} ${customer.customerInfo.lastName}`
                        }
                      >
                        <FontAwesomeIcon icon={faTrashAlt} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.noResults}>
          No customers found.{" "}
          <button
            onClick={() => navigate("/home/customer")}
            className={styles.inlineButton}
            aria-label="Add a new customer"
          >
            Add a new customer
          </button>
          .
        </p>
      )}
    </>
  );
}