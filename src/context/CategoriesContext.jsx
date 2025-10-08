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

      // If missing or invalid → fix to square-foot
      if (!MEASUREMENT_TYPE_UNITS[fixedType]) {
        console.warn(
          `⚠️ Fixed invalid measurementType "${fixedType}" → "${MEASUREMENT_TYPES.SQUARE_FOOT}"`
        );
        fixedType = MEASUREMENT_TYPES.SQUARE_FOOT;
      }

      // CRITICAL FIX: Ensure costs are numbers, not undefined
      const materialCost = item.materialCost !== undefined && item.materialCost !== null 
        ? Number(item.materialCost) 
        : 0;
      const laborCost = item.laborCost !== undefined && item.laborCost !== null 
        ? Number(item.laborCost) 
        : 0;

      // Preserve ALL item properties with explicit cost handling
      return {
        ...item,
        measurementType: fixedType,
        materialCost: isNaN(materialCost) ? 0 : materialCost,
        laborCost: isNaN(laborCost) ? 0 : laborCost,
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

  // CRITICAL FIX: Update category with robust cost preservation
  const updateCategory = useCallback((index, updates) => {
    setCategoriesState((prev) => {
      if (index < 0 || index >= prev.length) {
        console.warn(`Invalid category index: ${index}`);
        return prev;
      }

      if (updates.key && !updates.key.startsWith('custom_') && !WORK_TYPES[updates.key]) {
        console.warn(`Updated category key "${updates.key}" is not a valid WORK_TYPES key or custom key`);
        return prev;
      }

      // Create new array with updated category
      const newCategories = prev.map((category, i) => {
        if (i !== index) return category;
        
        // Merge updates with existing category
        const updatedCategory = { ...category, ...updates };
        
        // If workItems are being updated, sanitize them properly
        if (updates.workItems) {
          updatedCategory.workItems = updates.workItems.map(item => {
            // Ensure measurement type is valid
            const measurementType = MEASUREMENT_TYPE_UNITS[item.measurementType] 
              ? item.measurementType 
              : MEASUREMENT_TYPES.SQUARE_FOOT;
            
            // CRITICAL: Convert costs to numbers and handle all edge cases
            const materialCost = item.materialCost !== undefined && item.materialCost !== null
              ? Number(item.materialCost)
              : 0;
            const laborCost = item.laborCost !== undefined && item.laborCost !== null
              ? Number(item.laborCost)
              : 0;

            return {
              ...item,
              measurementType,
              materialCost: isNaN(materialCost) ? 0 : Math.max(0, materialCost),
              laborCost: isNaN(laborCost) ? 0 : Math.max(0, laborCost),
            };
          });
        }
        
        return updatedCategory;
      });

      return newCategories;
    });
  }, []);

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


