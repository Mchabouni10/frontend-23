import React, { useState, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faEye,
  faEdit,
  faTrashAlt,
  faPlusCircle,
  faSpinner,
  faExclamationTriangle,
  faClock,
  faInfoCircle,
  faChevronDown,
  faPhone,
  faTasks,
  faCalendarAlt,
  faDollarSign,
  faUser,
  faTimes,
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./CustomersListCards.module.css";

export default function CustomersListCards({
  searchQuery,
  setSearchQuery,
  filteredCustomers,
  isLoading,
  error,
  projectErrors,
  lastUpdated,
  totals,
  notifications,
  isNotificationsOpen,
  setIsNotificationsOpen,
  handleDetails,
  handleEdit,
  handleDelete,
  handleNewProject,
  formatPhoneNumber,
  formatDate,
  navigate,
  statusFilter,
  setStatusFilter,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedErrors, setSelectedErrors] = useState([]);
  const itemsPerPage = 6;

  // Memoize calculations to improve performance
  const getPaymentProgress = useCallback((customer) => {
    const total = customer.totalGrandTotal || 0;
    const remaining = customer.totalAmountRemaining || 0;
    return total > 0 ? ((total - remaining) / total) * 100 : 0;
  }, []);

  const formatDateWithoutTime = useCallback((dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
      : "N/A",
    []
  );

  const handleCardAction = useCallback((action, customer, e) => {
    e?.stopPropagation();
    const { projects } = customer;
    
    if (!projects?.length) {
      alert("No projects available for this customer.");
      return;
    }

    const firstProject = projects[0];
    const hasMultipleProjects = projects.length > 1;

    switch (action) {
      case "view":
        handleDetails(projects);
        break;
      case "edit":
        if (!hasMultipleProjects && firstProject?._id) {
          handleEdit(firstProject._id);
        }
        break;
      case "delete":
        if (!hasMultipleProjects && firstProject?._id) {
          if (
            window.confirm(
              `Are you sure you want to delete ${customer.customerInfo.firstName}'s project? This action cannot be undone.`
            )
          ) {
            handleDelete(firstProject._id);
          }
        }
        break;
      case "new":
        handleNewProject(customer.customerInfo);
        break;
      default:
        break;
    }
  }, [handleDetails, handleEdit, handleDelete, handleNewProject]);

  const statusOptions = useMemo(() => [
    { value: '', label: 'All Statuses' },
    { value: 'Not Started', label: 'Not Started' },
    { value: 'Starting Soon', label: 'Starting Soon' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Due Soon', label: 'Due Soon' },
    { value: 'Overdue', label: 'Overdue' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Unknown', label: 'Unknown' },
  ], []);

  const showErrorsForCustomer = useCallback((customer) => {
    const customerErrors = [];
    customer.projects.forEach((project) => {
      const projectId = project.id || JSON.stringify(project.customerInfo);
      if (projectErrors.has(projectId)) {
        customerErrors.push(...projectErrors.get(projectId));
      }
    });
    setSelectedErrors(customerErrors);
    setShowErrorModal(true);
  }, [projectErrors]);

  const totalPages = useMemo(() => 
    Math.ceil(filteredCustomers.length / itemsPerPage),
    [filteredCustomers.length, itemsPerPage]
  );

  const paginatedCustomers = useMemo(() => 
    filteredCustomers.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    ),
    [filteredCustomers, currentPage, itemsPerPage]
  );

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, [setSearchQuery]);

  const handleNotificationToggle = useCallback(() => {
    setIsNotificationsOpen(!isNotificationsOpen);
  }, [isNotificationsOpen, setIsNotificationsOpen]);

  const handleKeyPress = useCallback((e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Customers</h1>
      
      <div className={styles.searchSection}>
        <div className={styles.searchWrapper}>
          <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or status..."
            className={styles.searchInput}
            aria-label="Search customers by name, phone, or status"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className={styles.clearButton}
              aria-label="Clear search"
              type="button"
            >
              <FontAwesomeIcon icon={faTimes} aria-hidden="true" />
            </button>
          )}
        </div>
        
        <div className={styles.filterWrapper}>
          <label htmlFor="statusFilter" className={styles.visuallyHidden}>
            Filter by status
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusFilter}
            aria-label="Filter customers by status"
          >
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notifications.length > 0 && (
        <div className={styles.notificationPanel}>
          <button
            className={styles.notificationHeader}
            onClick={handleNotificationToggle}
            aria-expanded={isNotificationsOpen}
            aria-controls="notification-list"
            type="button"
          >
            <h2 className={styles.notificationTitle}>
              Notifications
              <span className={styles.notificationCountBadge} aria-label={`${notifications.length} notifications`}>
                ({notifications.length})
              </span>
            </h2>
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`${styles.toggleArrow} ${
                isNotificationsOpen ? styles.open : ""
              }`}
              aria-hidden="true"
            />
          </button>
          
          {isNotificationsOpen && (
            <ul 
              id="notification-list" 
              className={styles.notificationList}
              role="list"
            >
              {notifications.map((note, index) => (
                <li
                  key={`notification-${index}`}
                  className={`${styles.notificationItem} ${
                    note.overdue
                      ? styles.overdue
                      : note.nearDue
                      ? styles.warning
                      : styles.info
                  }`}
                  role="listitem"
                >
                  <FontAwesomeIcon
                    icon={
                      note.overdue
                        ? faExclamationTriangle
                        : note.nearDue
                        ? faClock
                        : faInfoCircle
                    }
                    className={styles.notificationIcon}
                    aria-hidden="true"
                  />
                  <span>{note.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert" aria-live="polite">
          <FontAwesomeIcon icon={faExclamationTriangle} aria-hidden="true" /> {error}
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" /> 
          <span>Loading Customers...</span>
        </div>
      ) : paginatedCustomers.length > 0 ? (
        <>
          <div className={styles.cardsWrapper} role="list">
            {paginatedCustomers.map((customer) => {
              const hasMultipleProjects = customer.projects.length > 1;
              const progress = getPaymentProgress(customer);
              const customerKey = `${customer.customerInfo.lastName}-${customer.customerInfo.phone}`;
              const hasErrors = customer.projects.some((project) => {
                const projectId = project.id || JSON.stringify(project.customerInfo);
                return projectErrors.has(projectId);
              });

              const fullName = `${customer.customerInfo.firstName} ${customer.customerInfo.lastName}`;

              return (
                <article
                  key={customerKey}
                  className={styles.customerCard}
                  onClick={() => handleDetails(customer.projects)}
                  onKeyPress={(e) => handleKeyPress(e, () => handleDetails(customer.projects))}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`Customer card for ${fullName}. Status: ${customer.status}. ${customer.projects.length} projects. Click to view details.`}
                >
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.nameWrapper}>
                        <FontAwesomeIcon
                          icon={faUser}
                          className={styles.nameIcon}
                          aria-hidden="true"
                        />
                        {fullName}
                        {hasErrors && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showErrorsForCustomer(customer);
                            }}
                            className={styles.errorIndicator}
                            title="View calculation errors"
                            aria-label={`View calculation errors for ${fullName}`}
                            type="button"
                          >
                            <FontAwesomeIcon icon={faExclamationCircle} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </h3>
                    <span
                      className={`${styles.statusBadge} ${
                        styles[customer.status.toLowerCase().replace(/\s+/g, "")]
                      }`}
                      aria-label={`Status: ${customer.status}`}
                    >
                      {customer.status}
                    </span>
                  </div>

                  <div className={styles.cardContent}>
                    <p>
                      <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
                      <span className={styles.label}>Phone:</span>{" "}
                      {formatPhoneNumber(customer.customerInfo.phone) || "N/A"}
                    </p>
                    <p className={styles.projectCount}>
                      <FontAwesomeIcon icon={faTasks} aria-hidden="true" />
                      <span className={styles.label}>Projects:</span>{" "}
                      <span className={styles.projectBadge}>
                        {customer.projects.length}
                      </span>
                    </p>
                    <p>
                      <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" />
                      <span className={styles.label}>Start:</span>{" "}
                      {formatDateWithoutTime(customer.earliestStartDate)}
                    </p>
                    <p>
                      <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" />
                      <span className={styles.label}>End:</span>{" "}
                      {formatDateWithoutTime(customer.latestFinishDate)}
                    </p>

                    <div className={styles.progressSection}>
                      <div
                        className={styles.progressBar}
                        role="progressbar"
                        aria-valuenow={Math.round(progress)}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label={`Payment progress: ${Math.round(progress)} percent complete`}
                      >
                        <div
                          className={styles.progressFill}
                          style={{ width: `${progress}%` }}
                        >
                          <span className={styles.progressText}>
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className={styles.amountDetails}>
                        <span className={styles.amountDue}>
                          <FontAwesomeIcon icon={faDollarSign} aria-hidden="true" />
                          <span className={styles.label}>Due:</span> $
                          {customer.totalAmountRemaining.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                        <span className={styles.amountTotal}>
                          <FontAwesomeIcon icon={faDollarSign} aria-hidden="true" />
                          <span className={styles.label}>Total:</span> $
                          {customer.totalGrandTotal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardActions} role="group" aria-label="Customer actions">
                    <button
                      onClick={(e) => handleCardAction("view", customer, e)}
                      className={styles.actionButton}
                      title="View Details"
                      aria-label={`View details for ${fullName}`}
                      type="button"
                    >
                      <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                    </button>
                    <button
                      onClick={(e) => handleCardAction("edit", customer, e)}
                      className={`${styles.actionButton} ${styles.editButton}`}
                      disabled={hasMultipleProjects}
                      title={
                        hasMultipleProjects
                          ? "View details to edit specific project"
                          : "Edit Project"
                      }
                      aria-label={
                        hasMultipleProjects
                          ? `${fullName} has multiple projects. View details to edit specific project`
                          : `Edit project for ${fullName}`
                      }
                      type="button"
                    >
                      <FontAwesomeIcon icon={faEdit} aria-hidden="true" />
                    </button>
                    <button
                      onClick={(e) => handleCardAction("new", customer, e)}
                      className={`${styles.actionButton} ${styles.newProjectButton}`}
                      title="Add New Project"
                      aria-label={`Add new project for ${fullName}`}
                      type="button"
                    >
                      <FontAwesomeIcon icon={faPlusCircle} aria-hidden="true" />
                    </button>
                    <button
                      onClick={(e) => handleCardAction("delete", customer, e)}
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      disabled={hasMultipleProjects}
                      title={
                        hasMultipleProjects
                          ? "View details to delete specific project"
                          : "Delete Project"
                      }
                      aria-label={
                        hasMultipleProjects
                          ? `${fullName} has multiple projects. View details to delete specific project`
                          : `Delete project for ${fullName}`
                      }
                      type="button"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Pagination navigation">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                aria-label="Go to previous page"
                type="button"
              >
                Previous
              </button>
              <span aria-current="page" aria-label={`Page ${currentPage} of ${totalPages}`}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                aria-label="Go to next page"
                type="button"
              >
                Next
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className={styles.noResults} role="status">
          <p>
            No customers found.{" "}
            <button
              onClick={() => navigate("/home/customer")}
              className={styles.inlineButton}
              aria-label="Add a new customer"
              type="button"
            >
              Add a new customer
            </button>
          </p>
        </div>
      )}

      <aside className={styles.totalsSection} aria-label="Financial summary">
        <p>
          <span className={styles.label}>Total Grand Total:</span>{" "}
          <span className={styles.grandTotal} aria-label={`Total grand total: $${totals.grandTotal.toFixed(2)}`}>
            ${totals.grandTotal.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </p>
        <p>
          <span className={styles.label}>Total Amount Remaining:</span>{" "}
          <span className={styles.remaining} aria-label={`Total amount remaining: $${totals.amountRemaining.toFixed(2)}`}>
            ${totals.amountRemaining.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </p>
        <p className={styles.lastUpdated}>
          Last Updated: <time dateTime={lastUpdated}>{formatDate(lastUpdated)}</time>
        </p>
      </aside>

      {showErrorModal && (
        <div 
          className={styles.errorModal} 
          role="dialog" 
          aria-labelledby="error-modal-title"
          aria-modal="true"
          onClick={() => setShowErrorModal(false)}
        >
          <div 
            className={styles.errorModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="error-modal-title">Calculation Errors</h3>
            <ul role="list">
              {selectedErrors.map((error, index) => (
                <li key={`error-${index}`}>{error.message}</li>
              ))}
            </ul>
            <button
              onClick={() => setShowErrorModal(false)}
              className={styles.closeModalButton}
              aria-label="Close error modal"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}