import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context for error handling
const ErrorContext = createContext();

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Error categories
export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  CALCULATION: 'calculation',
  AUTHENTICATION: 'auth',
  SYSTEM: 'system',
  USER_INPUT: 'user_input',
};

export function ErrorProvider({ children, suppressErrors = false }) {
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Track recent error messages to prevent duplicates
  const recentErrorsRef = useRef(new Set());
  const cleanupTimeoutRef = useRef(null);

  // Track user interaction to control toast display
  useEffect(() => {
    const handleInteraction = () => setHasInteracted(true);
    if (!hasInteracted) {
      window.addEventListener('click', handleInteraction, { once: true });
      window.addEventListener('keydown', handleInteraction, { once: true });
      return () => {
        window.removeEventListener('click', handleInteraction);
        window.removeEventListener('keydown', handleInteraction);
      };
    }
  }, [hasInteracted]);

  // Enhanced auto-clear with duplicate prevention
  useEffect(() => {
    if (cleanupTimeoutRef.current) {
      clearInterval(cleanupTimeoutRef.current);
    }

    cleanupTimeoutRef.current = setInterval(() => {
      const now = Date.now();
      
      setErrors((prevErrors) => {
        const filtered = prevErrors.filter((error) => {
          const age = now - new Date(error.timestamp).getTime();
          
          // More aggressive cleanup for low-severity errors
          if (error.severity === ERROR_SEVERITY.LOW && age > 5000) {
            return false;
          }
          
          // Standard cleanup for medium errors
          if (error.severity === ERROR_SEVERITY.MEDIUM && age > 15000) {
            return false;
          }
          
          // Keep high and critical errors longer
          if ((error.severity === ERROR_SEVERITY.HIGH || error.severity === ERROR_SEVERITY.CRITICAL) && age > 30000) {
            return false;
          }
          
          return true;
        });
        
        // Clean up recent errors tracking
        if (filtered.length < prevErrors.length) {
          setTimeout(() => {
            recentErrorsRef.current.clear();
          }, 1000);
        }
        
        return filtered;
      });
    }, 2000); // More frequent cleanup

    return () => {
      if (cleanupTimeoutRef.current) {
        clearInterval(cleanupTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced duplicate detection
  const isDuplicateError = useCallback((errorInfo) => {
    const errorKey = `${errorInfo.message}-${errorInfo.category}-${errorInfo.severity}`;
    
    if (recentErrorsRef.current.has(errorKey)) {
      return true;
    }
    
    // Add to recent errors and auto-remove after delay
    recentErrorsRef.current.add(errorKey);
    setTimeout(() => {
      recentErrorsRef.current.delete(errorKey);
    }, 3000);
    
    return false;
  }, []);

  // Enhanced add error with better duplicate prevention and rate limiting
  const addError = useCallback((error, options = {}) => {
    if (!error) return;
    
    const errorInfo = extractErrorInfo(error, options);
    
    // Enhanced duplicate detection
    if (isDuplicateError(errorInfo)) {
      return; // Silently ignore duplicates
    }
    
    // Rate limiting for calculation errors
    if (errorInfo.category === ERROR_CATEGORIES.CALCULATION) {
      const recentCalculationErrors = errors.filter(e => 
        e.category === ERROR_CATEGORIES.CALCULATION && 
        (Date.now() - new Date(e.timestamp).getTime()) < 5000
      );
      
      if (recentCalculationErrors.length >= 3) {
        return; // Rate limit calculation errors
      }
    }
    
    // Filter out common non-critical surface errors for new items
    if (errorInfo.category === ERROR_CATEGORIES.CALCULATION && 
        errorInfo.severity === ERROR_SEVERITY.LOW &&
        errorInfo.message.includes('no square footage')) {
      
      // Only add if this is likely a real error (not from a new/empty surface)
      const hasValidContext = errorInfo.context && 
        (errorInfo.context.userInteracted || errorInfo.context.hasValidInput);
      
      if (!hasValidContext) {
        return; // Skip surface errors for new items
      }
    }

    const errorEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      ...errorInfo,
    };
    
    setErrors((prevErrors) => {
      // More aggressive deduplication at state level
      const existingError = prevErrors.find(e => 
        e.message === errorInfo.message && 
        e.category === errorInfo.category &&
        (Date.now() - new Date(e.timestamp).getTime()) < 10000 // 10 second window
      );
      
      if (existingError) {
        return prevErrors; // Don't add duplicate
      }
      
      // Keep only the most recent 15 errors (reduced from 20)
      return [...prevErrors.slice(-14), errorEntry];
    });
    
    // More conservative toast notifications
    const shouldShowToast =
      !suppressErrors &&
      (hasInteracted || errorInfo.severity === ERROR_SEVERITY.HIGH || errorInfo.severity === ERROR_SEVERITY.CRITICAL) &&
      errorInfo.category !== ERROR_CATEGORIES.CALCULATION; // Don't show toasts for calculation errors
    
    if (shouldShowToast) {
      showToastNotification(errorInfo);
    }
    
    // Reduced logging for low-severity errors
    if (errorInfo.severity !== ERROR_SEVERITY.LOW) {
      logError(errorInfo);
    }
    
    if (options.onError) {
      options.onError(errorInfo);
    }
  }, [suppressErrors, hasInteracted, isDuplicateError, errors]);

  // Clear a specific error
  const clearError = useCallback((errorId) => {
    setErrors((prevErrors) => prevErrors.filter((error) => error.id !== errorId));
    toast.dismiss(errorId);
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
    toast.dismiss();
    recentErrorsRef.current.clear();
  }, []);

  // Enhanced clear errors by category with rate limiting
  const clearErrorsByCategory = useCallback((category) => {
    setErrors((prevErrors) => prevErrors.filter((error) => error.category !== category));
    
    // Don't immediately clear recent errors tracking for this category
    // to prevent immediate re-addition of the same errors
    setTimeout(() => {
      const keysToDelete = Array.from(recentErrorsRef.current).filter(key => 
        key.includes(`-${category}-`)
      );
      keysToDelete.forEach(key => recentErrorsRef.current.delete(key));
    }, 1000);
  }, []);

  // Enhanced async error handling wrapper
  const withErrorHandling = useCallback(
    async (asyncOperation, options = {}) => {
      try {
        setIsLoading(true);
        return await asyncOperation();
      } catch (error) {
        // Only add system errors to global context if they're critical
        const severity = error.severity || 
          (error.name === 'NetworkError' ? ERROR_SEVERITY.HIGH : ERROR_SEVERITY.MEDIUM);
        
        if (severity === ERROR_SEVERITY.HIGH || severity === ERROR_SEVERITY.CRITICAL) {
          addError(error, {
            category: options.category || ERROR_CATEGORIES.SYSTEM,
            severity,
            ...options,
          });
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [addError]
  );

  const hasErrors = errors.length > 0;
  const hasCriticalErrors = errors.some((error) => error.severity === ERROR_SEVERITY.CRITICAL);
  const recentErrors = errors.slice(-5); // Reduced from 10

  const contextValue = {
    errors,
    addError,
    clearError,
    clearErrors,
    clearErrorsByCategory,
    withErrorHandling,
    isLoading,
    hasErrors,
    hasCriticalErrors,
    recentErrors,
    errorCount: errors.length,
  };

  return <ErrorContext.Provider value={contextValue}>{children}</ErrorContext.Provider>;
}

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

function extractErrorInfo(error, options = {}) {
  let message = 'An unexpected error occurred';
  let details = null;
  
  if (error instanceof Error) {
    message = error.message;
    details = { name: error.name, stack: error.stack };
  } else if (typeof error === 'string') {
    message = error;
  } else if (error?.response) {
    message = error.response.data?.message || error.response.statusText || message;
    details = {
      status: error.response.status,
      statusText: error.response.statusText,
    };
  } else if (error?.message) {
    message = error.message;
  }
  
  return {
    message,
    details,
    category: options.category || ERROR_CATEGORIES.SYSTEM,
    severity: options.severity || ERROR_SEVERITY.MEDIUM,
    component: options.component || getCallerComponent(),
    context: options.context || {},
  };
}

// More conservative toast notifications
function showToastNotification(errorInfo) {
  const baseOptions = {
    position: 'top-right',
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    toastId: `${errorInfo.category}-${errorInfo.severity}`, // Prevent duplicate toasts
  };
  
  switch (errorInfo.severity) {
    case ERROR_SEVERITY.CRITICAL:
      toast.error(`🚨 Critical: ${errorInfo.message}`, {
        ...baseOptions,
        autoClose: false,
        className: 'error-critical',
      });
      break;
    case ERROR_SEVERITY.HIGH:
      toast.error(`⚠️ ${errorInfo.message}`, {
        ...baseOptions,
        autoClose: 8000,
        className: 'error-high',
      });
      break;
    case ERROR_SEVERITY.MEDIUM:
      toast.error(errorInfo.message, {
        ...baseOptions,
        autoClose: 5000,
      });
      break;
    case ERROR_SEVERITY.LOW:
      // Don't show toast for low severity errors
      break;
    default:
      toast.error(errorInfo.message, baseOptions);
  }
}

// Reduced logging for better performance
function logError(errorInfo) {
  // Skip logging for certain categories in production
  if (process.env.NODE_ENV === 'production' && 
      errorInfo.category === ERROR_CATEGORIES.CALCULATION && 
      errorInfo.severity === ERROR_SEVERITY.LOW) {
    return;
  }
  
  const logData = {
    timestamp: errorInfo.timestamp,
    message: errorInfo.message,
    category: errorInfo.category,
    severity: errorInfo.severity,
    component: errorInfo.component,
    details: errorInfo.details,
  };
  
  switch (errorInfo.severity) {
    case ERROR_SEVERITY.CRITICAL:
    case ERROR_SEVERITY.HIGH:
      console.error('🚨 Error:', logData);
      break;
    case ERROR_SEVERITY.MEDIUM:
      console.error('⚠️ Error:', logData);
      break;
    case ERROR_SEVERITY.LOW:
      console.warn('⚠️ Warning:', logData);
      break;
    default:
      console.error('Error:', logData);
  }
}

function getCallerComponent() {
  const stack = new Error().stack;
  if (stack) {
    const lines = stack.split('\n');
    const callerLine = lines[3] || lines[2];
    const match = callerLine.match(/at (\w+)/);
    return match ? match[1] : 'Unknown';
  }
  return 'Unknown';
}

export function useFormErrors() {
  const { addError } = useError();
  const addValidationError = useCallback(
    (field, message, context = {}) => {
      addError(`${field}: ${message}`, {
        category: ERROR_CATEGORIES.VALIDATION,
        severity: ERROR_SEVERITY.LOW,
        context: { field, ...context },
      });
    },
    [addError]
  );
  return { addValidationError };
}