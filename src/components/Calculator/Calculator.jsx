// src/components/Calculator/Calculator.jsx
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useCategories } from '../../context/CategoriesContext';
import { useSettings } from '../../context/SettingsContext';
import { useWorkType } from '../../context/WorkTypeContext';
import { CalculatorEngine } from './engine/CalculatorEngine';
import CategoryList from './Category/CategoryList';
import LaborPricingSheet from './LaborPricingSheet/LaborPricingSheet';
import CostSummary from './Category/CostSummary';
import PaymentTracking from './Category/PaymentTracking';
import AdditionalCosts from './Category/AdditionalCosts';
import styles from './Calculator.module.css';

export default function Calculator({ disabled = false }) {
  const [activeView, setActiveView] = useState('calculator'); // 'calculator', 'pricing'
  
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  // Create memoized CalculatorEngine instance for performance
  const calculatorEngine = useMemo(() => {
    try {
      if (getMeasurementType && isValidSubtype && getWorkTypeDetails) {
        return new CalculatorEngine(
          categories || [],
          settings || {},
          { getMeasurementType, isValidSubtype, getWorkTypeDetails }
        );
      }
      return null;
    } catch (error) {
      console.error('Failed to create CalculatorEngine:', error);
      return null;
    }
  }, [categories, settings, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // Provide quick access to calculation results for child components
  const calculationResults = useMemo(() => {
    if (!calculatorEngine) {
      return {
        totals: null,
        paymentDetails: null,
        categoryBreakdowns: null,
        breakdowns: null,
        errors: ['Calculator engine not available']
      };
    }

    try {
      const totals = calculatorEngine.calculateTotals();
      const paymentDetails = calculatorEngine.calculatePaymentDetails();
      const categoryBreakdowns = calculatorEngine.calculateCategoryBreakdowns();
      const breakdowns = calculatorEngine.calculateBreakdowns();

      const allErrors = [
        ...(totals.errors || []),
        ...(paymentDetails.errors || []),
        ...(categoryBreakdowns.errors || []),
        ...(breakdowns.errors || [])
      ];

      return {
        totals,
        paymentDetails,
        categoryBreakdowns,
        breakdowns,
        errors: allErrors
      };
    } catch (error) {
      console.error('Calculation error:', error);
      return {
        totals: null,
        paymentDetails: null,
        categoryBreakdowns: null,
        breakdowns: null,
        errors: [error.message || 'Unknown calculation error']
      };
    }
  }, [calculatorEngine]);

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  // Show engine status for debugging
  const engineStatus = useMemo(() => {
    if (!calculatorEngine) return 'Engine not available';
    if (calculationResults.errors.length > 0) return 'Engine has errors';
    return 'Engine ready';
  }, [calculatorEngine, calculationResults.errors]);

  // Determine engine status color
  const engineStatusColor = useMemo(() => {
    if (!calculatorEngine) return 'red';
    if (calculationResults.errors.length > 0) return 'orange';
    return 'green';
  }, [calculatorEngine, calculationResults.errors]);

  return (
    <div className={styles.calculator}>
      {/* Professional Header with Navigation */}
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>Professional Remodeling Calculator</h1>
            <p className={styles.subtitle}>Complete project estimation and management</p>
          </div>
        </div>

        {/* Professional Navigation Tabs */}
        <nav className={styles.navigation}>
          <button
            className={`${styles.navTab} ${activeView === 'calculator' ? styles.navTabActive : ''}`}
            onClick={() => handleViewChange('calculator')}
            disabled={disabled}
          >
            <i className="fas fa-calculator"></i>
            <span>Calculator</span>
          </button>
          
          <button
            className={`${styles.navTab} ${activeView === 'pricing' ? styles.navTabActive : ''}`}
            onClick={() => handleViewChange('pricing')}
            disabled={disabled}
          >
            <i className="fas fa-dollar-sign"></i>
            <span>Labor Pricing Guide</span>
          </button>

          <div 
            className={styles.debugInfo} 
            title={`Categories: ${categories?.length || 0}, Engine: ${engineStatus}`}
            style={{ color: engineStatusColor }}
          >
            <i className={`fas ${calculatorEngine ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
            <span className={styles.debugText}>{engineStatus}</span>
          </div>
        </nav>
      </header>

      {/* Error Display */}
      {calculationResults.errors.length > 0 && (
        <div className={styles.errorSummary} role="alert">
          <div className={styles.errorHeader}>
            <i className="fas fa-exclamation-triangle"></i>
            <h4>Calculation Issues ({calculationResults.errors.length})</h4>
          </div>
          <details className={styles.errorDetails}>
            <summary>View Details</summary>
            <ul className={styles.errorList}>
              {calculationResults.errors.slice(0, 5).map((error, index) => (
                <li key={index}>
                  {typeof error === 'string' ? error : error.message || 'Unknown error'}
                </li>
              ))}
              {calculationResults.errors.length > 5 && (
                <li>...and {calculationResults.errors.length - 5} more</li>
              )}
            </ul>
          </details>
        </div>
      )}

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {activeView === 'pricing' && (
          <div className={styles.contentPanel}>
            <LaborPricingSheet />
          </div>
        )}
        
        {activeView === 'calculator' && (
          <div className={styles.contentPanel}>
            <CategoryList disabled={disabled} />
            <AdditionalCosts disabled={disabled} />
            <CostSummary />
            <PaymentTracking disabled={disabled} />
          </div>
        )}
      </main>
    </div>
  );
}

Calculator.propTypes = {
  disabled: PropTypes.bool,
};