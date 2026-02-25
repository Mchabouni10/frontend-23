import React, { useMemo, useState } from "react";
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
  faClock,
  faLayerGroup,
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

  // Relative "time ago / in X days" label for last activity
  const formatRelativeDate = (date) => {
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24));

    // Ultra-compact labels for table (single line)
    if (diffDays === 0) return "0d";
    if (diffDays === 1) return "1d";
    if (diffDays === -1) return "-1d";
    return `${diffDays}d`;
  };

  // Choose a compact "last activity" date based on project dates / installments
  const getLastActivityInfo = (customer) => {
    const { earliestStartDate, latestFinishDate, nextDueInstallment } =
      customer;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const candidates = [];

    if (latestFinishDate instanceof Date) {
      candidates.push({ type: "Last", date: latestFinishDate });
    }
    if (earliestStartDate instanceof Date) {
      candidates.push({ type: "Start", date: earliestStartDate });
    }
    if (nextDueInstallment?.date instanceof Date) {
      candidates.push({ type: "Next", date: nextDueInstallment.date });
    }

    if (!candidates.length) return null;

    // Prefer the most recent past date; if none, the nearest future date
    const past = candidates.filter((c) => c.date <= today);
    const future = candidates.filter((c) => c.date > today);

    const pickClosest = (list) =>
      list.reduce((best, current) => {
        if (!best) return current;
        const diffCurrent = Math.abs(current.date - today);
        const diffBest = Math.abs(best.date - today);
        return diffCurrent < diffBest ? current : best;
      }, null);

    const chosen = past.length ? pickClosest(past) : pickClosest(future);
    if (!chosen) return null;

    const shortLabel = formatRelativeDate(chosen.date);
    if (!shortLabel) return null;

    // Human-readable phrase for tooltip, reusing the existing "today"
    const d = new Date(chosen.date);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24));

    let phrase;
    if (diffDays === 0) {
      phrase = "Today";
    } else if (diffDays === 1) {
      phrase = "Tomorrow";
    } else if (diffDays === -1) {
      phrase = "Yesterday";
    } else if (diffDays > 1) {
      phrase = `in ${diffDays} days`;
    } else {
      phrase = `${Math.abs(diffDays)} days ago`;
    }

    return {
      type: chosen.type,
      label: shortLabel,
      tooltip: `${chosen.type} project date: ${phrase}`,
    };
  };

  // Calculate payment progress percentage - memoized to avoid recalculation
  const getPaymentProgress = useMemo(
    () => (customer) => {
      const total = customer.totalGrandTotal || 0;
      const remaining = customer.totalAmountRemaining || 0;
      const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
      return Math.round(progress);
    },
    [],
  );

  // Build rich payment tooltip data for the remaining column
  const getPaymentTooltipData = (customer) => {
    const total = customer.totalGrandTotal || 0;
    const remaining = customer.totalAmountRemaining || 0;
    const paid = total - remaining;
    const depositPaid = customer.depositPaid;
    const paidInst = customer.paidInstallments || 0;
    const totalInst = customer.totalInstallments || 0;
    const pendingInst = totalInst - paidInst;
    const progress = total > 0 ? Math.round((paid / total) * 100) : 0;
    return {
      total,
      remaining,
      paid,
      depositPaid,
      paidInst,
      totalInst,
      pendingInst,
      progress,
    };
  };

  const [activeTooltip, setActiveTooltip] = useState(null);
  const [tooltipPositions, setTooltipPositions] = useState({});

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
                  <FontAwesomeIcon icon={faAddressCard} aria-hidden="true" />{" "}
                  Last{" "}
                  <FontAwesomeIcon
                    icon={getSortIcon("lastName")}
                    aria-hidden="true"
                  />
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
                  <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" />{" "}
                  Start{" "}
                  <FontAwesomeIcon
                    icon={getSortIcon("startDate")}
                    aria-hidden="true"
                  />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" />{" "}
                  Finish
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
                  <FontAwesomeIcon icon={faDollarSign} aria-hidden="true" />{" "}
                  Remaining{" "}
                  <FontAwesomeIcon
                    icon={getSortIcon("amountRemaining")}
                    aria-hidden="true"
                  />
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faDollarSign} aria-hidden="true" />{" "}
                  Total
                </th>
                <th scope="col">
                  <FontAwesomeIcon icon={faLayerGroup} aria-hidden="true" />{" "}
                  Scope
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer, index) => {
                const hasMultipleProjects = customer.projects.length > 1;
                const progress = getPaymentProgress(customer);
                const customerId =
                  customer.projects[0]?._id || `customer-${index}`;

                return (
                  <tr key={customerId}>
                    <td>{customer.customerInfo.firstName || "N/A"}</td>
                    {/* Last Name with tooltip */}
                    <td>
                      {(() => {
                        const nameTooltipId = `name-tooltip-${customerId}`;
                        const handleNameMouseEnter = (e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPositions((prev) => ({
                            ...prev,
                            [nameTooltipId]: {
                              top: rect.bottom + 8,
                              left: rect.left + rect.width / 2 - 140,
                            },
                          }));
                          setActiveTooltip(nameTooltipId);
                        };

                        const tooltipPos = tooltipPositions[nameTooltipId] || {
                          top: 0,
                          left: 0,
                        };

                        return (
                          <div
                            style={{
                              position: "relative",
                              display: "inline-block",
                            }}
                            onMouseEnter={handleNameMouseEnter}
                            onMouseLeave={() => setActiveTooltip(null)}
                          >
                            <span style={{ cursor: "help" }}>
                              {customer.customerInfo.lastName || "N/A"}
                            </span>
                            {activeTooltip === nameTooltipId && (
                              <div
                                className={styles.nameTooltip}
                                role="tooltip"
                                style={{
                                  top: `${tooltipPos.top}px`,
                                  left: `${tooltipPos.left}px`,
                                }}
                              >
                                <div className={styles.nameTooltipRow}>
                                  <span className={styles.nameTooltipLabel}>
                                    📍 Address
                                  </span>
                                  <span>
                                    {customer.customerInfo.street || "N/A"}
                                    {customer.customerInfo.city &&
                                      `, ${customer.customerInfo.city}`}
                                    {customer.customerInfo.state &&
                                      `, ${customer.customerInfo.state}`}
                                    {customer.customerInfo.zipCode &&
                                      ` ${customer.customerInfo.zipCode}`}
                                  </span>
                                </div>
                                {customer.projects &&
                                  customer.projects.length > 0 && (
                                    <div
                                      className={styles.nameTooltipRow}
                                      style={{ marginTop: "8px" }}
                                    >
                                      <span className={styles.nameTooltipLabel}>
                                        🏢 Projects
                                      </span>
                                      <div className={styles.projectsList}>
                                        {customer.projects.map((proj, idx) => {
                                          const projectName =
                                            proj.projectName ||
                                            proj.customerInfo?.projectName ||
                                            `Project ${idx + 1}`;
                                          return (
                                            <div
                                              key={idx}
                                              className={styles.projectItem}
                                            >
                                              {projectName}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
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
                      <div className={styles.statusCell}>
                        <span
                          className={`${styles.status} ${
                            styles[
                              customer.status.toLowerCase().replace(/\s+/g, "")
                            ]
                          }`}
                          data-tooltip={customer.status}
                        >
                          {customer.status}
                        </span>
                        {(() => {
                          const info = getLastActivityInfo(customer);
                          if (!info) return null;
                          return (
                            <span
                              className={styles.lastActivityChip}
                              title={
                                info.type === "Next"
                                  ? info.tooltip
                                  : info.tooltip
                              }
                            >
                              <FontAwesomeIcon
                                icon={faClock}
                                aria-hidden="true"
                              />
                              <span aria-hidden="true">{info.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td
                      className={
                        customer.totalAmountRemaining > 0
                          ? styles.amountDue
                          : styles.amountPaid
                      }
                    >
                      {(() => {
                        const ttData = getPaymentTooltipData(customer);
                        const tooltipId = `payment-tooltip-${customerId}`;

                        const handlePaymentMouseEnter = (e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPositions((prev) => ({
                            ...prev,
                            [tooltipId]: {
                              top: rect.bottom + 8,
                              left: rect.left + rect.width / 2 - 140,
                            },
                          }));
                          setActiveTooltip(tooltipId);
                        };

                        const tooltipPos = tooltipPositions[tooltipId] || {
                          top: 0,
                          left: 0,
                        };

                        return (
                          <div
                            className={styles.progressContainer}
                            style={{ position: "relative" }}
                            onMouseEnter={handlePaymentMouseEnter}
                            onMouseLeave={() => {
                              // Only hide if we're actually leaving the entire container
                              setTimeout(() => {
                                if (activeTooltip === tooltipId) {
                                  setActiveTooltip(null);
                                }
                              }, 100);
                            }}
                          >
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
                              <span
                                className={styles.progressText}
                                aria-hidden="true"
                              >
                                {progress}%
                              </span>
                            </div>
                            <span className={styles.amountDisplay}>
                              ${customer.totalAmountRemaining.toFixed(2)}
                            </span>

                            {/* Rich payment breakdown tooltip */}
                            {activeTooltip === tooltipId && (
                              <div
                                className={styles.paymentTooltip}
                                role="tooltip"
                                onMouseEnter={() => setActiveTooltip(tooltipId)}
                                onMouseLeave={() => setActiveTooltip(null)}
                                style={{
                                  top: `${tooltipPos.top}px`,
                                  left: `${tooltipPos.left}px`,
                                }}
                              >
                                {/* Grand Total */}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 0",
                                    color: "#333",
                                  }}
                                >
                                  <span style={{ fontWeight: "bold" }}>
                                    Grand Total
                                  </span>
                                  <span style={{ fontWeight: "bold" }}>
                                    ${ttData.total.toFixed(2)}
                                  </span>
                                </div>

                                {/* Total Paid */}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 0",
                                    color: "green",
                                    fontWeight: "bold",
                                  }}
                                >
                                  <span>Total Paid</span>
                                  <span>−${ttData.paid.toFixed(2)}</span>
                                </div>

                                {/* Payment Status */}
                                {ttData.totalInst > 0 && (
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      padding: "4px 0",
                                      borderTop: "1px solid var(--border)",
                                      marginTop: "4px",
                                      paddingTop: "4px",
                                      color: "var(--text-color)",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    <span>Payment Installments</span>
                                    <div style={{ textAlign: "right" }}>
                                      <div>
                                        {ttData.paidInst} received,{" "}
                                        {ttData.pendingInst} due
                                      </div>

                                      {(() => {
                                        let overdueCount = 0;
                                        customer.projects.forEach((project) => {
                                          if (
                                            project.settings &&
                                            project.settings.payments
                                          ) {
                                            project.settings.payments.forEach(
                                              (payment) => {
                                                const pType = (
                                                  payment.type || ""
                                                ).toLowerCase();
                                                const pMethod = (
                                                  payment.method || ""
                                                ).toLowerCase();
                                                const isInst =
                                                  pType === "installment" ||
                                                  pMethod === "installment";

                                                if (
                                                  isInst &&
                                                  new Date(payment.date) <
                                                    new Date() &&
                                                  !payment.isPaid
                                                ) {
                                                  overdueCount++;
                                                }
                                              },
                                            );
                                          }
                                        });
                                        return overdueCount > 0 ? (
                                          <div style={{ color: "red" }}>
                                            {overdueCount} overdue
                                          </div>
                                        ) : null;
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {/* Amount Due */}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 0",
                                    borderTop: "1px solid #ddd",
                                    marginTop: "4px",
                                    paddingTop: "4px",
                                    color: "red",
                                    fontWeight: "bold",
                                  }}
                                >
                                  <span>Amount Due</span>
                                  <span>${ttData.remaining.toFixed(2)}</span>
                                </div>

                                {/* Deposit Status */}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 0",
                                    color: "#333",
                                  }}
                                >
                                  <span>Deposit</span>
                                  <span
                                    style={{
                                      color: ttData.depositPaid
                                        ? "green"
                                        : "red",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {ttData.depositPaid
                                      ? "✓ Received"
                                      : "✗ Pending"}
                                  </span>
                                </div>

                                {/* Individual Installments */}
                                {(() => {
                                  const installments = [];
                                  customer.projects.forEach((project) => {
                                    if (
                                      project.settings &&
                                      project.settings.payments
                                    ) {
                                      project.settings.payments.forEach(
                                        (payment) => {
                                          const pType = (
                                            payment.type || ""
                                          ).toLowerCase();
                                          const pMethod = (
                                            payment.method || ""
                                          ).toLowerCase();
                                          if (
                                            pType === "installment" ||
                                            pMethod === "installment"
                                          ) {
                                            installments.push({
                                              date: new Date(payment.date),
                                              amount: parseFloat(
                                                payment.amount,
                                              ),
                                              isPaid: payment.isPaid || false,
                                            });
                                          }
                                        },
                                      );
                                    }
                                  });

                                  return installments.length > 0 ? (
                                    <>
                                      <div
                                        style={{
                                          borderTop: `1px solid var(--border)`,
                                          margin: "8px 0",
                                          paddingTop: "8px",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: "0.7rem",
                                            fontWeight: "bold",
                                            color: "var(--text-light)",
                                            marginBottom: "6px",
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          Installment Details
                                        </div>
                                        {installments.map((inst, idx) => {
                                          const isPaid = inst.isPaid || false;
                                          const isOverdue =
                                            inst.date < new Date() && !isPaid;
                                          return (
                                            <div
                                              key={idx}
                                              className={`${
                                                styles.paymentTooltipRow
                                              } ${
                                                isPaid
                                                  ? styles.paymentTooltipPaid
                                                  : isOverdue
                                                  ? styles.paymentTooltipDue
                                                  : ""
                                              }`}
                                              style={{ fontSize: "0.73rem" }}
                                            >
                                              <span>
                                                #{idx + 1} -{" "}
                                                {inst.date.toLocaleDateString(
                                                  "en-US",
                                                  {
                                                    month: "short",
                                                    day: "numeric",
                                                  },
                                                )}
                                              </span>
                                              <span>
                                                {isPaid
                                                  ? "✓ "
                                                  : isOverdue
                                                  ? "⚠ "
                                                  : "→ "}
                                                ${inst.amount.toFixed(2)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </>
                                  ) : null;
                                })()}

                                {/* Progress Bar */}
                                <div
                                  className={styles.paymentTooltipProgress}
                                  style={{ marginTop: "10px" }}
                                >
                                  <div
                                    className={
                                      styles.paymentTooltipProgressFill
                                    }
                                    style={{ width: `${ttData.progress}%` }}
                                  />
                                  <span>{ttData.progress}% complete</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className={styles.grandTotal}>
                      ${customer.totalGrandTotal.toFixed(2)}
                    </td>
                    {/* Scope column: categories · work items with hover tooltip */}
                    <td className={styles.scopeCell}>
                      {(() => {
                        const scopeTooltipId = `scope-tooltip-${customerId}`;
                        // Build categories and work types list from projects
                        const categoriesSet = new Set();
                        const workTypesSet = new Set();
                        customer.projects.forEach((project) => {
                          if (project.categories) {
                            project.categories.forEach((cat) => {
                              if (cat.name) categoriesSet.add(cat.name);
                              if (cat.workItems) {
                                cat.workItems.forEach((item) => {
                                  if (
                                    item.type &&
                                    item.type !== "custom-work-type"
                                  ) {
                                    workTypesSet.add(
                                      item.type
                                        .split("-")
                                        .map(
                                          (w) =>
                                            w.charAt(0).toUpperCase() +
                                            w.slice(1),
                                        )
                                        .join(" "),
                                    );
                                  }
                                });
                              }
                            });
                          }
                        });
                        const categories = Array.from(categoriesSet);
                        const workTypes = Array.from(workTypesSet);

                        const handleMouseEnter = (e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPositions((prev) => ({
                            ...prev,
                            [scopeTooltipId]: {
                              top: rect.bottom + 8,
                              left: rect.left + rect.width / 2 - 140,
                            },
                          }));
                          setActiveTooltip(scopeTooltipId);
                        };

                        const tooltipPos = tooltipPositions[scopeTooltipId] || {
                          top: 0,
                          left: 0,
                        };

                        return (
                          <div
                            style={{ position: "relative" }}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={() => setActiveTooltip(null)}
                          >
                            <span className={styles.scopeCount}>
                              {customer.totalCategories}c ·{" "}
                              {customer.totalWorkItems}w
                            </span>
                            {/* Scope details tooltip */}
                            {activeTooltip === scopeTooltipId && (
                              <div
                                className={styles.scopeTooltip}
                                role="tooltip"
                                style={{
                                  top: `${tooltipPos.top}px`,
                                  left: `${tooltipPos.left}px`,
                                }}
                              >
                                {categories.length > 0 && (
                                  <>
                                    <div className={styles.scopeTooltipHeader}>
                                      📋 Categories
                                    </div>
                                    {categories.map((cat, idx) => (
                                      <div
                                        key={idx}
                                        className={styles.scopeTooltipRow}
                                      >
                                        {cat}
                                      </div>
                                    ))}
                                  </>
                                )}
                                {workTypes.length > 0 && (
                                  <>
                                    <div
                                      className={styles.scopeTooltipHeader}
                                      style={{
                                        marginTop:
                                          categories.length > 0 ? 8 : 0,
                                      }}
                                    >
                                      🔧 Work Types
                                    </div>
                                    {workTypes.map((type, idx) => (
                                      <div
                                        key={idx}
                                        className={styles.scopeTooltipRow}
                                      >
                                        {type}
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                        <FontAwesomeIcon
                          icon={faPlusCircle}
                          aria-hidden="true"
                        />
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
