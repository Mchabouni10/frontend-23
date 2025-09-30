//src/components/CustomersListTable/CustomersListTable.jsx

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faEye,
  faEdit,
  faTrashAlt,
  faSort,
  faSortUp,
  faSortDown,
  faTimes,
  faPlusCircle,
  faExclamationTriangle,
  faCheckCircle,
  faUser,
  faAddressCard,
  faPhone,
  faTasks,
  faCalendarAlt,
  faDollarSign,
  faSpinner,
  faDownload,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./CustomersList.module.css";

export default function CustomersListTable({
  searchQuery,
  setSearchQuery,
  paginatedCustomers,
  totalPages,
  currentPage,
  setCurrentPage,
  isLoading,
  error,
  lastUpdated,
  totals,
  notifications,
  isNotificationsOpen,
  setIsNotificationsOpen,
  handleSort,
  handleDetails,
  handleEdit,
  handleDelete,
  handleNewProject,
  handleExportCSV,
  sortConfig,
  formatPhoneNumber,
  formatDate,
  navigate,
}) {
  const getSortIcon = (key) =>
    sortConfig.key === key
      ? sortConfig.direction === "asc"
        ? faSortUp
        : faSortDown
      : faSort;

  const formatDateWithoutTime = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        })
      : "N/A";

  // Calculate payment progress percentage
  const getPaymentProgress = (customer) => {
    const total = customer.totalGrandTotal || 0;
    const remaining = customer.totalAmountRemaining || 0;
    const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
    return { progress: progress.toFixed(0) };
  };

  return (
    <>
      <h1 className={styles.title}>Customers</h1>
      <div className={styles.searchSection}>
        <div className={styles.searchWrapper}>
          <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or status..."
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className={styles.clearButton}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      </div>
      {notifications.length > 0 && (
        <div className={styles.notificationsSection}>
          <div
            className={styles.notificationsHeader}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          >
            <h3>
              Notifications{" "}
              <span className={styles.notificationCount}>
                ({notifications.length})
              </span>
            </h3>
            <FontAwesomeIcon
              icon={isNotificationsOpen ? faChevronUp : faChevronDown}
              className={styles.toggleIcon}
            />
          </div>
          {isNotificationsOpen && (
            <ul>
              {notifications.map((note, index) => (
                <li
                  key={index}
                  className={note.overdue ? styles.overdue : styles.nearDue}
                >
                  <FontAwesomeIcon
                    icon={note.overdue ? faExclamationTriangle : faCheckCircle}
                  />{" "}
                  {note.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {isLoading ? (
        <div className={styles.loading}>
          <FontAwesomeIcon icon={faSpinner} spin /> Loading customers...
        </div>
      ) : paginatedCustomers.length > 0 ? (
        <div className={styles.tableWrapper}>
          <div className={styles.tableHeaderActions}>
            <button
              onClick={handleExportCSV}
              className={styles.exportButton}
              title="Export as CSV"
            >
              <FontAwesomeIcon icon={faDownload} /> Export
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">
                  <FontAwesomeIcon icon={faUser} /> First
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("lastName")}
                  className={styles.sortable}
                >
                  <FontAwesomeIcon icon={faAddressCard} /> Last{" "}
                  <FontAwesomeIcon icon={getSortIcon("lastName")} />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faPhone} /> Phone
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faTasks} /> Projects
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("startDate")}
                  className={styles.sortable}
                >
                  <FontAwesomeIcon icon={faCalendarAlt} /> Start{" "}
                  <FontAwesomeIcon icon={getSortIcon("startDate")} />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faCalendarAlt} /> Finish
                </th>
                <th scope="col">Status</th>
                <th
                  scope="col"
                  onClick={() => handleSort("amountRemaining")}
                  className={styles.sortable}
                >
                  <FontAwesomeIcon icon={faDollarSign} /> Remaining{" "}
                  <FontAwesomeIcon icon={getSortIcon("amountRemaining")} />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faDollarSign} /> Total
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer) => {
                const hasMultipleProjects = customer.projects.length > 1;
                const { progress } = getPaymentProgress(customer);
                return (
                  <tr
                    key={`${customer.customerInfo.lastName}-${customer.customerInfo.phone}`}
                  >
                    <td>{customer.customerInfo.firstName || "N/A"}</td>
                    <td>{customer.customerInfo.lastName || "N/A"}</td>
                    <td>{formatPhoneNumber(customer.customerInfo.phone)}</td>
                    <td>
                      <span>{customer.projects.length}</span>
                    </td>
                    <td>{formatDateWithoutTime(customer.earliestStartDate)}</td>
                    <td>{formatDateWithoutTime(customer.latestFinishDate)}</td>
                    <td>
                      <span
                        className={`${styles.status} ${
                          styles[customer.status.toLowerCase().replace(" ", "")]
                        }`}
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
                        <div className={styles.progressBarContainer}>
                          <div
                            className={styles.progressBar}
                            style={{ width: `${progress}%` }}
                          ></div>
                          <span className={styles.progressText}>
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
                      >
                        <FontAwesomeIcon icon={faEye} />
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
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleNewProject(customer.customerInfo)}
                        className={`${styles.actionButton} ${styles.newProjectButton}`}
                        title="Add New Project"
                      >
                        <FontAwesomeIcon icon={faPlusCircle} />
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
                      >
                        <FontAwesomeIcon icon={faTrashAlt} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
          <div className={styles.totalsSection}>
            <p>
              Total Grand Total:{" "}
              <span className={styles.grandTotal}>
                ${totals.grandTotal.toFixed(2)}
              </span>
            </p>
            <p>
              Total Amount Remaining:{" "}
              <span className={styles.remaining}>
                ${totals.amountRemaining.toFixed(2)}
              </span>
            </p>
            <p className={styles.lastUpdated}>
              Last Updated: {formatDate(lastUpdated)}
            </p>
          </div>
        </div>
      ) : (
        <p className={styles.noResults}>
          No customers found.{" "}
          <button
            onClick={() => navigate("/home/customer")}
            className={styles.inlineButton}
          >
            Add a new customer
          </button>
          .
        </p>
      )}
    </>
  );
}