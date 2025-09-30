// src/components/Context/CategoriesContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { WORK_TYPES, MEASUREMENT_TYPES, MEASUREMENT_TYPE_UNITS } from '../components/Calculator/data/workTypes';

const CategoriesContext = createContext();

// ---------------- SANITIZER ----------------
function sanitizeCategory(category) {
  if (!category) return category;

  // Handle legacy "items" -> migrate to "workItems"
  const rawItems = category.workItems || category.items || [];

  return {
    ...category,
    workItems: rawItems.map((item) => {
      let fixedType = item.measurementType;

      // If missing or invalid â†’ fix to square-foot
      if (!MEASUREMENT_TYPE_UNITS[fixedType]) {
        console.warn(
          `âš ï¸ Fixed invalid measurementType "${fixedType}" â†’ "${MEASUREMENT_TYPES.SQUARE_FOOT}"`
        );
        fixedType = MEASUREMENT_TYPES.SQUARE_FOOT;
      }

      return {
        ...item,
        measurementType: fixedType,
      };
    }),
  };
}

export function CategoriesProvider({ children, initialCategories = [] }) {
  const [categories, setCategoriesState] = useState(
    initialCategories.map((c) => sanitizeCategory(c))
  );

  // safe wrapper around setCategories
  const setCategories = useCallback((updater) => {
    setCategoriesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next.map((c) => sanitizeCategory(c));
    });
  }, []);

  // Remove a category by index
  const removeCategory = useCallback((index) => {
    setCategories((prev) => {
      if (index < 0 || index >= prev.length) {
        console.warn(`Invalid category index: ${index}`);
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  }, [setCategories]);

  // Add a new category, validating its key
  const addCategory = useCallback((category) => {
    if (!category || typeof category !== 'object' || !category.key || !category.name) {
      console.warn('Invalid category object: Must include key and name', category);
      return;
    }

    if (!category.key.startsWith('custom_') && !WORK_TYPES[category.key]) {
      console.warn(`Category key "${category.key}" is not a valid WORK_TYPES key or custom key`);
      return;
    }

    setCategories((prev) => [...prev, sanitizeCategory(category)]);
  }, [setCategories]);

  // Update a category by index
  const updateCategory = useCallback((index, updates) => {
    setCategories((prev) => {
      if (index < 0 || index >= prev.length) {
        console.warn(`Invalid category index: ${index}`);
        return prev;
      }

      if (updates.key && !updates.key.startsWith('custom_') && !WORK_TYPES[updates.key]) {
        console.warn(`Updated category key "${updates.key}" is not a valid WORK_TYPES key or custom key`);
        return prev;
      }

      return prev.map((category, i) =>
        i === index ? sanitizeCategory({ ...category, ...updates }) : category
      );
    });
  }, [setCategories]);

  // Clear all categories
  const clearCategories = useCallback(() => {
    setCategories([]);
  }, [setCategories]);

  // Get a category by ID
  const getCategoryById = useCallback((id) => {
    return categories.find(category => category.id === id) || null;
  }, [categories]);

  // Get a category by index
  const getCategoryByIndex = useCallback((index) => {
    if (index < 0 || index >= categories.length) {
      return null;
    }
    return categories[index];
  }, [categories]);

  const value = {
    categories,
    setCategories,
    removeCategory,
    addCategory,
    updateCategory,
    clearCategories,
    getCategoryById,
    getCategoryByIndex,
    categoryCount: categories.length,
    hasCategories: categories.length > 0
  };

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

CategoriesProvider.propTypes = {
  children: PropTypes.node.isRequired,
  initialCategories: PropTypes.array,
};

// Custom hook to access CategoriesContext
export const useCategories = () => {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
};



