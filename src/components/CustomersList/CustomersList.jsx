// src/components/CustomersList/CustomersList.jsx
import React, { useState, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTable, faTh } from '@fortawesome/free-solid-svg-icons';
import { useCustomers } from './useCustomers';
import CustomersListTable from './CustomersListTable';
import CustomersListCards from './CustomersListCards';
import styles from './CustomersList.module.css';

// View mode constants for better maintainability
const VIEW_MODES = {
  TABLE: 'table',
  CARDS: 'cards',
};

export default function CustomersList() {
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);
  
  // Custom hook to manage customer data
  const customerData = useCustomers({ viewMode });

  // Memoize view mode handlers to prevent unnecessary re-renders
  const handleTableView = useCallback(() => {
    setViewMode(VIEW_MODES.TABLE);
  }, []);

  const handleCardsView = useCallback(() => {
    setViewMode(VIEW_MODES.CARDS);
  }, []);

  // Determine if table view is active
  const isTableView = viewMode === VIEW_MODES.TABLE;

  // Memoize the active component to prevent unnecessary re-renders
  const ActiveView = useMemo(() => {
    if (isTableView) {
      return (
        <CustomersListTable
          {...customerData}
          setIsLoading={customerData.setIsLoading}
        />
      );
    }
    return <CustomersListCards {...customerData} />;
  }, [isTableView, customerData]);

  return (
    <main className={styles.mainContent} role="main">
      <div className={styles.container}>
        {/* View Toggle Controls */}
        <nav className={styles.viewToggle} aria-label="View mode selection">
          <button
            onClick={handleTableView}
            className={`${styles.toggleButton} ${isTableView ? styles.active : ''}`}
            aria-pressed={isTableView}
            aria-label="Switch to table view"
            type="button"
          >
            <FontAwesomeIcon icon={faTable} aria-hidden="true" />
            <span> Table View</span>
          </button>
          <button
            onClick={handleCardsView}
            className={`${styles.toggleButton} ${!isTableView ? styles.active : ''}`}
            aria-pressed={!isTableView}
            aria-label="Switch to card view"
            type="button"
          >
            <FontAwesomeIcon icon={faTh} aria-hidden="true" />
            <span> Card View</span>
          </button>
        </nav>

        {/* Dynamic View Content */}
        <div className={styles.viewContent}>
          {ActiveView}
        </div>
      </div>
    </main>
  );
}