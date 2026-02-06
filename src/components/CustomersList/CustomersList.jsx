import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTable,
  faTh,
  faSearch,
  faTimes,
  faCalendarAlt,
  faChevronDown,
  faChevronUp,
  faExclamationTriangle,
  faCheckCircle,
  faSpinner,
  faPlus,
  faWallet,
  faArrowTrendUp,
  faCoins,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { useCustomers } from "./useCustomers";
import CustomersListTable from "./CustomersListTable";
import CustomersListCards from "./CustomersListCards";
import styles from "./CustomersList.module.css";

// View mode constants
const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Not Started", label: "Not Started" },
  { value: "Starting Soon", label: "Starting Soon" },
  { value: "In Progress", label: "In Progress" },
  { value: "Due Soon", label: "Due Soon" },
  { value: "Overdue", label: "Overdue" },
  { value: "Completed", label: "Completed" },
  { value: "Unknown", label: "Unknown" },
];

export default function CustomersList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);

  // Custom hook to manage customer data
  const customerData = useCustomers({ viewMode });
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    notifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    totals,
    isLoading,
    error,
    totalPages,
    currentPage,
    setCurrentPage,
  } = customerData;

  const handleTableView = useCallback(() => setViewMode(VIEW_MODES.TABLE), []);
  const handleCardsView = useCallback(() => setViewMode(VIEW_MODES.CARDS), []);
  const isTableView = viewMode === VIEW_MODES.TABLE;

  return (
    <main className={styles.mainContent} role="main">
      <div className={styles.container}>
        <div className={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h1 className={styles.title}>Customers</h1>
            <button
              onClick={() => navigate("/home/new-customer-project")}
              className={styles.toggleButton}
              style={{
                backgroundColor: "#2ecc71",
                color: "white",
                border: "none",
                gap: "0.5rem",
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>New Customer</span>
            </button>
          </div>

          {/* View Toggle Controls */}
          <nav className={styles.viewToggle} aria-label="View mode selection">
            <button
              onClick={handleTableView}
              className={`${styles.toggleButton} ${
                isTableView ? styles.active : ""
              }`}
              aria-pressed={isTableView}
              type="button"
            >
              <FontAwesomeIcon icon={faTable} />
              <span> Table</span>
            </button>
            <button
              onClick={handleCardsView}
              className={`${styles.toggleButton} ${
                !isTableView ? styles.active : ""
              }`}
              aria-pressed={!isTableView}
              type="button"
            >
              <FontAwesomeIcon icon={faTh} />
              <span> Cards</span>
            </button>
          </nav>
        </div>

        {/* Centralized Controls */}
        <section className={styles.controlsSection}>
          <div className={styles.searchFilterRow}>
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
                  style={{
                    position: "absolute",
                    right: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#a0aec0",
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>

            <div className={styles.filterWrapper}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.statusFilter}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter Controls */}
            <div
              className={styles.filterWrapper}
              style={{
                marginLeft: "1rem",
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <FontAwesomeIcon
                icon={faCalendarAlt}
                className={styles.searchIcon}
                style={{ marginRight: "0.5rem", color: "#718096" }}
              />

              <select
                value={dateFilter.type}
                onChange={(e) =>
                  setDateFilter({ ...dateFilter, type: e.target.value })
                }
                className={styles.statusFilter}
              >
                <option value="all">All Time</option>
                <option value="year">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>

              {dateFilter.type === "year" && (
                <select
                  value={dateFilter.year || new Date().getFullYear()}
                  onChange={(e) =>
                    setDateFilter({
                      ...dateFilter,
                      year: parseInt(e.target.value),
                    })
                  }
                  className={styles.statusFilter}
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) => new Date().getFullYear() - i + 1,
                  )
                    .reverse()
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  {Array.from(
                    { length: 10 },
                    (_, i) => new Date().getFullYear() - i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}

              {dateFilter.type === "custom" && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="date"
                    value={
                      dateFilter.startDate
                        ? new Date(dateFilter.startDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setDateFilter({
                        ...dateFilter,
                        startDate: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                    className={styles.searchInput}
                    style={{ paddingLeft: "0.5rem", width: "auto" }}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={
                      dateFilter.endDate
                        ? new Date(dateFilter.endDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setDateFilter({
                        ...dateFilter,
                        endDate: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                    className={styles.searchInput}
                    style={{ paddingLeft: "0.5rem", width: "auto" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className={styles.notificationsSection}>
              <div
                className={styles.notificationsHeader}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <h3>
                  Notifications{" "}
                  <span style={{ color: "#e53e3e" }}>
                    ({notifications.length})
                  </span>
                </h3>
                <FontAwesomeIcon
                  icon={isNotificationsOpen ? faChevronUp : faChevronDown}
                />
              </div>
              {isNotificationsOpen && (
                <ul className={styles.notificationList}>
                  {notifications.map((note, index) => (
                    <li
                      key={index}
                      className={`${styles.notificationItem} ${
                        note.overdue ? styles.overdue : styles.warning
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={
                          note.overdue ? faExclamationTriangle : faCheckCircle
                        }
                      />
                      {note.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Error & Loading */}
        {error && <div className={styles.error}>{error}</div>}
        {isLoading && (
          <div className={styles.loading}>
            <FontAwesomeIcon icon={faSpinner} spin /> Loading customers...
          </div>
        )}

        {/* Dynamic View Content */}
        {!isLoading && (
          <div className={styles.viewContent}>
            {isTableView ? (
              <CustomersListTable {...customerData} />
            ) : (
              <CustomersListCards {...customerData} />
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <nav className={styles.pagination}>
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
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </nav>
        )}

        {/* Compact Premium Totals Section */}
        {!isLoading && (
          <section className={styles.premiumTotalsSection}>
            <div className={styles.revenueCompositionCard}>
              <div className={styles.cardGlow}></div>

              <div className={styles.compositionItems}>
                {/* Grand Total & Add. Revenue Stack */}
                <div className={styles.compositionItem}>
                  <div className={styles.itemLabel}>
                    <FontAwesomeIcon
                      icon={faCoins}
                      className={styles.labelIcon}
                    />
                    <span>Grand Total</span>
                    <div className={styles.tooltip}>
                      <FontAwesomeIcon icon={faInfoCircle} />
                      <span className={styles.tooltipText}>
                        Total project values including materials, labor, and all
                        fees
                      </span>
                    </div>
                  </div>
                  <div className={styles.itemValue}>
                    $
                    {totals.grandTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  {totals.additionalRevenue > 0 && (
                    <div className={styles.stackedAddRevenue}>
                      <FontAwesomeIcon icon={faArrowTrendUp} />
                      <span>
                        Inc. $
                        {totals.additionalRevenue.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        Earned Add. Revenue
                      </span>
                      <div className={styles.tooltip}>
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <span className={styles.tooltipText}>
                          Markup & Transportation from fully paid projects
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Outstanding Item */}
                <div
                  className={`${styles.compositionItem} ${styles.dangerItem}`}
                >
                  <div className={styles.itemLabel}>
                    <FontAwesomeIcon
                      icon={faWallet}
                      className={styles.labelIcon}
                    />
                    <span>Outstanding</span>
                  </div>
                  <div className={styles.itemValue}>
                    $
                    {totals.amountRemaining.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
