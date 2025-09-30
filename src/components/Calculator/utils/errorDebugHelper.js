// src/utils/errorDebugHelper.js

// Debug helper to track ErrorContext usage
export function debugErrorContext() {
  // Check if ErrorProvider is properly set up
  const checkErrorProvider = () => {
    const errorContextElements = document.querySelectorAll('[data-error-provider]');
    console.log('ErrorProvider elements found:', errorContextElements.length);
    
    if (errorContextElements.length === 0) {
      console.warn('⚠️ No ErrorProvider found in DOM. Make sure to wrap your app with <ErrorProvider>');
    }
  };

  // Check for useError hook usage
  const checkUseErrorUsage = () => {
    console.log('🔍 Checking useError hook usage...');
    
    // This is a development-time helper
    if (process.env.NODE_ENV === 'development') {
      console.log('Add this to your calculatorUtils.js to debug:');
      console.log(`
        import { useError } from '../context/ErrorContext';
        
        // At the top of your function or component:
        const { addError } = useError();
        console.log('useError hook result:', { addError });
      `);
    }
  };

  // Check component hierarchy
  const checkComponentHierarchy = () => {
    console.log('🏗️ Component hierarchy check:');
    console.log('Make sure your App.js looks like this:');
    console.log(`
      import { ErrorProvider } from './context/ErrorContext';
      
      function App() {
        return (
          <ErrorProvider>
            <ToastContainer />
            {/* Your other components */}
          </ErrorProvider>
        );
      }
    `);
  };

  // Run all checks
  checkErrorProvider();
  checkUseErrorUsage();
  checkComponentHierarchy();
}

// Temporary error handler for debugging
export function createTempErrorHandler() {
  return {
    addError: (error, options = {}) => {
      console.log('🔧 Temporary error handler called');
      console.log('Error:', error);
      console.log('Options:', options);
      console.error('Original error:', error);
      
      // Show basic alert as fallback
      if (typeof error === 'string') {
        alert(`Error: ${error}`);
      } else if (error && error.message) {
        alert(`Error: ${error.message}`);
      } else {
        alert('An error occurred');
      }
    }
  };
}

// Monkey patch to catch useError calls
export function monkeyPatchUseError() {
  if (process.env.NODE_ENV === 'development') {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0] && args[0].includes && args[0].includes('useError must be used within')) {
        console.log('🚨 useError hook called outside of ErrorProvider!');
        console.log('Stack trace:', new Error().stack);
        debugErrorContext();
      }
      originalConsoleError.apply(console, args);
    };
  }
}

// Quick fix for calculatorUtils.js
export function createQuickErrorFix() {
  console.log('🔧 Quick fix for calculatorUtils.js:');
  console.log(`
    // Add this at the top of calculatorUtils.js
    const { addError } = (() => {
      try {
        const { useError } = require('../context/ErrorContext');
        return useError();
      } catch (e) {
        console.warn('useError hook not available, using fallback');
        return {
          addError: (error) => {
            console.error('Error (fallback):', error);
            alert('Error: ' + (error.message || error.toString()));
          }
        };
      }
    })();
  `);
}

// Initialize debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.debugErrorContext = debugErrorContext;
  window.createTempErrorHandler = createTempErrorHandler;
  monkeyPatchUseError();
}