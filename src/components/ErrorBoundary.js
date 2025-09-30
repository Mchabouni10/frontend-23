// src/components/ErrorBoundary.js
import React from 'react';
import PropTypes from 'prop-types';
import { useError } from '../context/ErrorContext';
import { ERROR_SEVERITY, ERROR_CATEGORIES } from '../context/ErrorContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Extract component name from component stack
    const componentName = errorInfo.componentStack
      .split('\n')[1]
      ?.replace(/^\s*at\s+(\w+).*$/, '$1') || 'Unknown';
    
    // Convert error to safe string for reporting
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    
    this.props.addError(errorMessage, {
      severity: ERROR_SEVERITY.CRITICAL,
      category: ERROR_CATEGORIES.SYSTEM,
      component: componentName,
      context: {
        componentStack: errorInfo.componentStack,
        isErrorBoundary: true
      }
    });

    // Log detailed error information
    console.groupCollapsed(`ErrorBoundary caught error in ${componentName}`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI - render a simple error message instead of crashing
      const errorMessage = this.state.error?.message || 'Something went wrong';
      return (
        <div style={{
          padding: '20px',
          margin: '10px',
          border: '1px solid #ff6b6b',
          borderRadius: '4px',
          backgroundColor: '#ffe6e6',
          color: '#d63031'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
            Error Occurred
          </h3>
          <p style={{ margin: 0 }}>{errorMessage}</p>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default function ErrorBoundaryWrapper({ children, boundaryName = 'App' }) {
  const { addError } = useError();
  
  return (
    <ErrorBoundary 
      addError={addError}
      boundaryName={boundaryName}
    >
      {children}
    </ErrorBoundary>
  );
}

ErrorBoundaryWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  boundaryName: PropTypes.string
};

