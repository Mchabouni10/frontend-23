import React, { useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEdit,
  faTrashAlt,
  faPlusCircle,
  faExclamationCircle,
  faPhone,
  faTasks,
  faCalendarAlt,
  faDollarSign,
  faUser,
  faCheckCircle,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./CustomersListCards.module.css";

export default function CustomersListCards({
  paginatedCustomers,
  projectErrors = new Map(),
  handleDetails,
  handleEdit,
  handleDelete,
  handleNewProject,
  formatPhoneNumber = (phone) => phone || "N/A",
  navigate,
}) {
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedErrors, setSelectedErrors] = useState([]);

  const getPaymentProgress = useCallback((customer = {}) => {
    const total = customer.totalGrandTotal ?? 0;
    const remaining = customer.totalAmountRemaining ?? 0;
    return total > 0 ? ((total - remaining) / total) * 100 : 0;
  }, []);

  const formatDateWithoutTime = useCallback(
    (dateString) =>
      dateString
        ? new Date(dateString).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })
        : "N/A",
    [],
  );

  const handleCardAction = useCallback(
    (action, customer = {}, e) => {
      e?.stopPropagation();
      const projects = customer.projects ?? [];

      if (!projects.length) {
        alert("No projects available for this customer.");
        return;
      }

      const firstProject = projects[0] ?? {};
      const hasMultipleProjects = projects.length > 1;

      switch (action) {
        case "view":
          handleDetails?.(projects);
          break;
        case "edit":
          if (!hasMultipleProjects && firstProject?._id) {
            handleEdit?.(firstProject._id);
          }
          break;
        case "delete":
          if (!hasMultipleProjects && firstProject?._id) {
            if (
              window.confirm(
                `Are you sure you want to delete ${
                  customer.customerInfo?.firstName ?? "this customer"
                }'s project? This action cannot be undone.`,
              )
            ) {
              handleDelete?.(firstProject._id);
            }
          }
          break;
        case "new":
          handleNewProject?.(customer.customerInfo ?? {});
          break;
        default:
          break;
      }
    },
    [handleDetails, handleEdit, handleDelete, handleNewProject],
  );

  const showErrorsForCustomer = useCallback(
    (customer = {}) => {
      const customerErrors = [];
      (customer.projects ?? []).forEach((project = {}) => {
        const projectId =
          project.id ?? JSON.stringify(project.customerInfo ?? {});
        if (projectErrors.has(projectId)) {
          customerErrors.push(...projectErrors.get(projectId));
        }
      });
      setSelectedErrors(customerErrors);
      setShowErrorModal(true);
    },
    [projectErrors],
  );

  return (
    <div className={styles.container}>
      {paginatedCustomers.length > 0 ? (
        <>
          <div className={styles.cardsWrapper} role="list">
            {paginatedCustomers.map((customer = {}) => {
              const customerInfo = customer.customerInfo ?? {};
              const projects = customer.projects ?? [];
              const hasMultipleProjects = projects.length > 1;
              const progress = getPaymentProgress(customer);
              const customerKey = `${customerInfo.lastName ?? "unknown"}-${
                customerInfo.phone ?? "unknown"
              }`;
              const hasErrors = projects.some((project = {}) => {
                const projectId =
                  project.id ?? JSON.stringify(project.customerInfo ?? {});
                return projectErrors.has(projectId);
              });
              const fullName =
                `${customerInfo.firstName ?? ""} ${
                  customerInfo.lastName ?? ""
                }`.trim() || "Unknown Customer";

              return (
                <article
                  key={customerKey}
                  className={styles.customerCard}
                  tabIndex={0}
                  aria-label={`Customer card for ${fullName}. Status: ${
                    customer.status ?? "Unknown"
                  }. ${projects.length} projects.`}
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
                            <FontAwesomeIcon
                              icon={faExclamationCircle}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </span>
                    </h3>
                    <span
                      className={`${styles.statusBadge} ${
                        styles[
                          (customer.status ?? "Unknown")
                            .toLowerCase()
                            .replace(/\s+/g, "")
                        ] || styles.unknown
                      }`}
                      aria-label={`Status: ${customer.status ?? "Unknown"}`}
                    >
                      {customer.status ?? "Unknown"}
                    </span>
                  </div>

                  <div className={styles.cardContent}>
                    <p>
                      <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
                      <span className={styles.label}>Phone:</span>{" "}
                      {formatPhoneNumber(customerInfo.phone)}
                    </p>
                    <p className={styles.projectCount}>
                      <FontAwesomeIcon icon={faTasks} aria-hidden="true" />
                      <span className={styles.label}>Projects:</span>{" "}
                      <span className={styles.projectBadge}>
                        {projects.length}
                      </span>
                    </p>
                    <p>
                      <FontAwesomeIcon
                        icon={faCalendarAlt}
                        aria-hidden="true"
                      />
                      <span className={styles.label}>Start:</span>{" "}
                      {formatDateWithoutTime(customer.earliestStartDate)}
                    </p>
                    <p>
                      <FontAwesomeIcon
                        icon={faCalendarAlt}
                        aria-hidden="true"
                      />
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
                        aria-label={`Payment progress: ${Math.round(
                          progress,
                        )} percent complete`}
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
                          <FontAwesomeIcon
                            icon={faDollarSign}
                            aria-hidden="true"
                          />
                          <span className={styles.label}>Due:</span> $
                          {(customer.totalAmountRemaining ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                        <span className={styles.amountTotal}>
                          <FontAwesomeIcon
                            icon={faDollarSign}
                            aria-hidden="true"
                          />
                          <span className={styles.label}>Total:</span> $
                          {(customer.totalGrandTotal ?? 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardMeta}>
                    {/* Deposit indicator */}
                    <span
                      className={`${styles.depositBadge} ${
                        customer.depositPaid
                          ? styles.depositPaid
                          : styles.depositPending
                      }`}
                      title={
                        customer.depositPaid
                          ? "Deposit received"
                          : "No deposit on record"
                      }
                    >
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        aria-hidden="true"
                      />
                      {customer.depositPaid ? "Deposit ✓" : "No Deposit"}
                    </span>

                    {/* Scope summary */}
                    {(customer.totalCategories > 0 ||
                      customer.totalWorkItems > 0) && (
                      <span
                        className={styles.scopeBadge}
                        title={`${customer.totalCategories} categories, ${customer.totalWorkItems} work items`}
                      >
                        <FontAwesomeIcon
                          icon={faLayerGroup}
                          aria-hidden="true"
                        />
                        {customer.totalCategories}c · {customer.totalWorkItems}w
                      </span>
                    )}

                    {/* Installment fraction */}
                    {customer.totalInstallments > 0 && (
                      <span
                        className={styles.installmentBadge}
                        title={`${customer.paidInstallments} of ${customer.totalInstallments} installments paid`}
                      >
                        {customer.paidInstallments}/{customer.totalInstallments}{" "}
                        paid
                      </span>
                    )}
                  </div>

                  <div
                    className={styles.cardActions}
                    role="group"
                    aria-label="Customer actions"
                  >
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
        </>
      ) : (
        <div className={styles.noResults} role="status">
          <p>
            No customers found.{" "}
            <button
              onClick={() => navigate?.("/home/customer")}
              className={styles.inlineButton}
              aria-label="Add a new customer"
              type="button"
            >
              Add a new customer
            </button>
          </p>
        </div>
      )}

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
            <ul>
              {selectedErrors.map((error, index) => (
                <li key={`error-${index}`}>
                  {error.message || "Unknown error"}
                </li>
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
