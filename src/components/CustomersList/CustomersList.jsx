// src/components/CustomersList/CustomersList.jsx
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTable, faTh } from '@fortawesome/free-solid-svg-icons';
import { useCustomers } from './useCustomers';
import CustomersListTable from './CustomersListTable';
import CustomersListCards from './CustomersListCards';
import styles from './CustomersList.module.css';

export default function CustomersList() {
  const [viewMode, setViewMode] = useState('table');
  const customerData = useCustomers({ viewMode });

  return (
    <main className={styles.mainContent}>
      <div className={styles.container}>
        <div className={styles.viewToggle}>
          <button
            onClick={() => setViewMode('table')}
            className={`${styles.toggleButton} ${viewMode === 'table' ? styles.active : ''}`}
          >
            <FontAwesomeIcon icon={faTable} /> Table View
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`${styles.toggleButton} ${viewMode === 'cards' ? styles.active : ''}`}
          >
            <FontAwesomeIcon icon={faTh} /> Card View
          </button>
        </div>
        {viewMode === 'table' ? (
          <CustomersListTable
            {...customerData}
            setIsLoading={customerData.setIsLoading}
          />
        ) : (
          <CustomersListCards {...customerData} />
        )}
      </div>
    </main>
  );
}