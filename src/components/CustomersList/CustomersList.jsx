import React, { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTable, 
  faTh, 
  faSearch, 
  faTimes, 
  faChevronDown, 
  faChevronUp, 
  faExclamationTriangle, 
  faCheckCircle,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { useCustomers } from './useCustomers';
import CustomersListTable from './CustomersListTable';
import CustomersListCards from './CustomersListCards';
import styles from './CustomersList.module.css';

// View mode constants
const VIEW_MODES = {
  TABLE: 'table',
  CARDS: 'cards',
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
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);
  
  // Custom hook to manage customer data
  const customerData = useCustomers({ viewMode });
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    notifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    totals,
    isLoading,
    error,
    totalPages,
    currentPage,
    setCurrentPage
  } = customerData;

  const handleTableView = useCallback(() => setViewMode(VIEW_MODES.TABLE), []);
  const handleCardsView = useCallback(() => setViewMode(VIEW_MODES.CARDS), []);
  const isTableView = viewMode === VIEW_MODES.TABLE;

  return (
    <main className={styles.mainContent} role="main">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Customers</h1>
          
          {/* View Toggle Controls */}
          <nav className={styles.viewToggle} aria-label="View mode selection">
            <button
              onClick={handleTableView}
              className={`${styles.toggleButton} ${isTableView ? styles.active : ''}`}
              aria-pressed={isTableView}
              type="button"
            >
              <FontAwesomeIcon icon={faTable} />
              <span> Table</span>
            </button>
            <button
              onClick={handleCardsView}
              className={`${styles.toggleButton} ${!isTableView ? styles.active : ''}`}
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
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0' }}
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
          </div>

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className={styles.notificationsSection}>
              <div
                className={styles.notificationsHeader}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <h3>
                  Notifications <span style={{ color: '#e53e3e' }}>({notifications.length})</span>
                </h3>
                <FontAwesomeIcon icon={isNotificationsOpen ? faChevronUp : faChevronDown} />
              </div>
              {isNotificationsOpen && (
                <ul className={styles.notificationList}>
                  {notifications.map((note, index) => (
                    <li key={index} className={`${styles.notificationItem} ${note.overdue ? styles.overdue : styles.warning}`}>
                      <FontAwesomeIcon icon={note.overdue ? faExclamationTriangle : faCheckCircle} />
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
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </nav>
        )}

        {/* Totals */}
        {!isLoading && (
          <div className={styles.totalsSection}>
            <div className={styles.totalItem}>
              <span className={styles.totalLabel}>Grand Total</span>
              <span className={styles.totalValue}>${totals.grandTotal.toFixed(2)}</span>
            </div>
            <div className={styles.totalItem}>
              <span className={styles.totalLabel}>Outstanding</span>
              <span className={`${styles.totalValue} ${styles.remaining}`}>${totals.amountRemaining.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}