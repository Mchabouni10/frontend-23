// src/components/Context/CategoriesContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { WORK_TYPES, MEASUREMENT_TYPES, MEASUREMENT_TYPE_UNITS } from '../components/Calculator/data/workTypes';

const CategoriesContext = createContext();

// ✅ ENHANCED: Sanitizer with explicit custom work type preservation
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

      // ✅ CRITICAL FIX: Ensure costs are numbers, not undefined
      const materialCost = item.materialCost !== undefined && item.materialCost !== null 
        ? Number(item.materialCost) 
        : 0;
      const laborCost = item.laborCost !== undefined && item.laborCost !== null 
        ? Number(item.laborCost) 
        : 0;

      // ✅ FIX #1: Explicitly preserve ALL item properties including customWorkTypeName
      return {
        ...item, // Preserve all original properties first
        measurementType: fixedType,
        materialCost: isNaN(materialCost) ? 0 : materialCost,
        laborCost: isNaN(laborCost) ? 0 : laborCost,
        // ✅ Ensure critical fields exist with defaults
        name: item.name || 'Unnamed Work Item',
        type: item.type || '',
        customWorkTypeName: item.customWorkTypeName || '', // Explicitly preserve
        subtype: item.subtype || '',
        description: item.description || '',
        surfaces: Array.isArray(item.surfaces) ? item.surfaces : [],
        notes: item.notes || '',
      };
    }),
  };
}

// ✅ NEW: Validate work item completeness
function validateWorkItem(item, categoryKey) {
  const errors = [];
  
  if (!item.type || item.type.trim() === '') {
    errors.push('Work item is missing a work type');
  }
  
  if (item.type === 'custom-work-type') {
    if (!item.customWorkTypeName || item.customWorkTypeName.trim() === '') {
      errors.push('Custom work type is missing a name');
    }
  }
  
  if (!item.measurementType) {
    errors.push('Work item is missing measurement type');
  }
  
  return errors;
}

export function CategoriesProvider({ children, initialCategories = [] }) {
  const [categories, setCategoriesState] = useState(
    initialCategories.map((c) => sanitizeCategory(c))
  );

  // ✅ NEW: Track validation warnings
  const [validationWarnings, setValidationWarnings] = useState([]);

  // ✅ FIX #2: Monitor categories for data integrity issues
  useEffect(() => {
    const warnings = [];
    
    categories.forEach((category, catIndex) => {
      if (!category.key || !category.name) {
        warnings.push(`Category at index ${catIndex} is missing key or name`);
      }
      
      category.workItems?.forEach((item, itemIndex) => {
        const itemErrors = validateWorkItem(item, category.key);
        if (itemErrors.length > 0) {
          warnings.push(
            `Category "${category.name}" (${catIndex}), Item ${itemIndex}: ${itemErrors.join(', ')}`
          );
        }
        
        // Check for custom work types without names
        if (item.type === 'custom-work-type' && !item.customWorkTypeName) {
          console.warn(
            `⚠️ Found custom work type without name in category "${category.name}", item ${itemIndex}`
          );
        }
      });
    });
    
    if (warnings.length > 0 && warnings.join() !== validationWarnings.join()) {
      setValidationWarnings(warnings);
      console.warn('⚠️ Categories validation warnings:', warnings);
    } else if (warnings.length === 0 && validationWarnings.length > 0) {
      setValidationWarnings([]);
    }
  }, [categories, validationWarnings]);

  // ✅ ENHANCED: Safe wrapper around setCategories with logging
  const setCategories = useCallback((updater) => {
    setCategoriesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      
      // Sanitize all categories
      const sanitized = next.map((c) => sanitizeCategory(c));
      
      // Log what changed
      if (prev.length !== sanitized.length) {
        console.log(`📊 Categories count changed: ${prev.length} → ${sanitized.length}`);
      }
      
      return sanitized;
    });
  }, []);

  // ✅ ENHANCED: Remove category with confirmation logging
  const removeCategory = useCallback((index) => {
    setCategories((prev) => {
      if (index < 0 || index >= prev.length) {
        console.warn(`⚠️ Invalid category index: ${index}`);
        return prev;
      }
      
      const removed = prev[index];
      console.log(`🗑️ Removing category: "${removed.name}" (${removed.key})`);
      
      return prev.filter((_, i) => i !== index);
    });
  }, [setCategories]);

  // ✅ ENHANCED: Add category with better validation
  const addCategory = useCallback((category) => {
    if (!category || typeof category !== 'object' || !category.key || !category.name) {
      console.warn('⚠️ Invalid category object: Must include key and name', category);
      return;
    }

    if (!category.key.startsWith('custom_') && !WORK_TYPES[category.key]) {
      console.warn(`⚠️ Category key "${category.key}" is not a valid WORK_TYPES key or custom key`);
      return;
    }

    console.log(`➕ Adding category: "${category.name}" (${category.key})`);
    setCategories((prev) => [...prev, sanitizeCategory(category)]);
  }, [setCategories]);

  // ✅ FIX #3: Enhanced updateCategory with explicit data preservation
  const updateCategory = useCallback((index, updates) => {
    setCategoriesState((prev) => {
      if (index < 0 || index >= prev.length) {
        console.warn(`⚠️ Invalid category index: ${index}`);
        return prev;
      }

      if (updates.key && !updates.key.startsWith('custom_') && !WORK_TYPES[updates.key]) {
        console.warn(`⚠️ Updated category key "${updates.key}" is not a valid WORK_TYPES key or custom key`);
        return prev;
      }

      // Create new array with updated category
      const newCategories = prev.map((category, i) => {
        if (i !== index) return category;
        
        const oldCategory = category;
        
        // ✅ CRITICAL: Explicit deep merge for work items
        let mergedWorkItems = oldCategory.workItems || [];
        
        if (updates.workItems) {
          console.log(`🔄 Updating work items for category "${oldCategory.name}"`);
          
          mergedWorkItems = updates.workItems.map((item, itemIndex) => {
            const oldItem = oldCategory.workItems?.[itemIndex];
            
            // ✅ Start with old item to preserve all fields
            const baseItem = oldItem ? { ...oldItem } : {};
            
            // ✅ Merge new updates
            const mergedItem = { ...baseItem, ...item };
            
            // ✅ CRITICAL: Explicitly preserve customWorkTypeName
            if (item.customWorkTypeName !== undefined) {
              mergedItem.customWorkTypeName = item.customWorkTypeName;
            } else if (oldItem?.customWorkTypeName) {
              mergedItem.customWorkTypeName = oldItem.customWorkTypeName;
            }
            
            // Ensure measurement type is valid
            const measurementType = MEASUREMENT_TYPE_UNITS[mergedItem.measurementType] 
              ? mergedItem.measurementType 
              : MEASUREMENT_TYPES.SQUARE_FOOT;
            
            // ✅ CRITICAL: Convert costs to numbers and handle all edge cases
            const materialCost = mergedItem.materialCost !== undefined && mergedItem.materialCost !== null
              ? Number(mergedItem.materialCost)
              : 0;
            const laborCost = mergedItem.laborCost !== undefined && mergedItem.laborCost !== null
              ? Number(mergedItem.laborCost)
              : 0;

            // ✅ FIX #4: Explicit field preservation
            const sanitizedItem = {
              ...mergedItem, // Start with merged item
              measurementType,
              materialCost: isNaN(materialCost) ? 0 : Math.max(0, materialCost),
              laborCost: isNaN(laborCost) ? 0 : Math.max(0, laborCost),
              // Ensure required fields exist
              name: mergedItem.name || 'Unnamed Work Item',
              type: mergedItem.type || '',
              customWorkTypeName: mergedItem.customWorkTypeName || '',
              subtype: mergedItem.subtype || '',
              description: mergedItem.description || '',
              surfaces: Array.isArray(mergedItem.surfaces) ? mergedItem.surfaces : [],
              notes: mergedItem.notes || '',
              categoryKey: oldCategory.key,
            };
            
            // ✅ Log custom work type updates
            if (sanitizedItem.type === 'custom-work-type') {
              if (!sanitizedItem.customWorkTypeName) {
                console.warn(
                  `⚠️ Custom work type at item ${itemIndex} is missing customWorkTypeName after update`
                );
              } else {
                console.log(
                  `✅ Custom work type preserved: "${sanitizedItem.customWorkTypeName}"`
                );
              }
            }
            
            return sanitizedItem;
          });
        }
        
        // ✅ Merge category-level updates
        const updatedCategory = {
          ...oldCategory,
          ...updates,
          workItems: mergedWorkItems,
        };
        
        console.log(`✅ Updated category "${updatedCategory.name}": ${mergedWorkItems.length} work items`);
        
        return updatedCategory;
      });

      return newCategories;
    });
  }, []);

  // ✅ ENHANCED: Clear categories with logging
  const clearCategories = useCallback(() => {
    console.log('🗑️ Clearing all categories');
    setCategories([]);
  }, [setCategories]);

  // Get a category by ID
  const getCategoryById = useCallback((id) => {
    const category = categories.find(cat => cat.id === id);
    if (!category) {
      console.warn(`⚠️ Category not found with ID: ${id}`);
    }
    return category || null;
  }, [categories]);

  // Get a category by index
  const getCategoryByIndex = useCallback((index) => {
    if (index < 0 || index >= categories.length) {
      console.warn(`⚠️ Invalid category index: ${index} (total: ${categories.length})`);
      return null;
    }
    return categories[index];
  }, [categories]);

  // ✅ NEW: Get all incomplete work items across all categories
  const getIncompleteWorkItems = useCallback(() => {
    const incomplete = [];
    
    categories.forEach((category, catIndex) => {
      category.workItems?.forEach((item, itemIndex) => {
        const errors = validateWorkItem(item, category.key);
        if (errors.length > 0) {
          incomplete.push({
            categoryIndex: catIndex,
            categoryName: category.name,
            itemIndex,
            itemName: item.name || 'Unnamed',
            errors,
          });
        }
      });
    });
    
    return incomplete;
  }, [categories]);

  // ✅ NEW: Validate all categories
  const validateAllCategories = useCallback(() => {
    const errors = [];
    
    if (categories.length === 0) {
      errors.push('Project must have at least one category');
      return { valid: false, errors };
    }
    
    categories.forEach((category, catIndex) => {
      if (!category.key || !category.name) {
        errors.push(`Category at index ${catIndex} is missing required fields`);
      }
      
      if (!category.workItems || category.workItems.length === 0) {
        errors.push(`Category "${category.name}" has no work items`);
      }
      
      category.workItems?.forEach((item, itemIndex) => {
        const itemErrors = validateWorkItem(item, category.key);
        if (itemErrors.length > 0) {
          errors.push(
            `Category "${category.name}", Item ${itemIndex}: ${itemErrors.join(', ')}`
          );
        }
      });
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: validationWarnings,
    };
  }, [categories, validationWarnings]);

  // ✅ NEW: Auto-repair corrupted data
  const repairCategories = useCallback(() => {
    console.log('🔧 Running category repair...');
    
    let repairsMade = 0;
    
    const repairedCategories = categories.map((category) => {
      const repairedWorkItems = category.workItems.map((item) => {
        let needsRepair = false;
        const repairedItem = { ...item };
        
        // Repair custom work types without names
        if (item.type === 'custom-work-type' && !item.customWorkTypeName) {
          console.warn(`⚠️ Repairing custom work type in "${category.name}"`);
          repairedItem.customWorkTypeName = 'Unnamed Custom Work';
          needsRepair = true;
        }
        
        // Repair missing measurement types
        if (!item.measurementType) {
          console.warn(`⚠️ Adding default measurement type to item in "${category.name}"`);
          repairedItem.measurementType = MEASUREMENT_TYPES.SQUARE_FOOT;
          needsRepair = true;
        }
        
        // Repair negative costs
        if (item.materialCost < 0) {
          console.warn(`⚠️ Fixing negative material cost in "${category.name}"`);
          repairedItem.materialCost = 0;
          needsRepair = true;
        }
        
        if (item.laborCost < 0) {
          console.warn(`⚠️ Fixing negative labor cost in "${category.name}"`);
          repairedItem.laborCost = 0;
          needsRepair = true;
        }
        
        if (needsRepair) {
          repairsMade++;
        }
        
        return repairedItem;
      });
      
      return {
        ...category,
        workItems: repairedWorkItems,
      };
    });
    
    if (repairsMade > 0) {
      console.log(`✅ Repaired ${repairsMade} work items`);
      setCategories(repairedCategories);
    } else {
      console.log('✅ No repairs needed');
    }
    
    return { repaired: repairsMade };
  }, [categories, setCategories]);

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
    hasCategories: categories.length > 0,
    // ✅ NEW: Additional utility functions
    getIncompleteWorkItems,
    validateAllCategories,
    repairCategories,
    validationWarnings,
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


