// src/components/Context/CategoriesContext.jsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import PropTypes from "prop-types";

import {
  MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_UNITS,
} from "../constants/measurementTypes";

// Exported so components can call useContext(CategoriesContext) directly when
// they need to handle the "outside provider" case gracefully (returns null).
export const CategoriesContext = createContext(null);

// Legacy top-level measurement fields that should ONLY live inside surfaces[].
// We strip them during sanitisation to eliminate the dual-data-source bug.
const LEGACY_MEASUREMENT_FIELDS = [
  "units",
  "linearFt",
  "sqft",
  "width",
  "height",
];

function sanitizeCategory(category) {
  if (!category) return category;

  const rawItems = category.workItems || category.items || [];

  return {
    ...category,
    workItems: rawItems.map((item) => {
      // Fix invalid measurement type
      let fixedType = item.measurementType;
      if (!MEASUREMENT_TYPE_UNITS[fixedType]) {
        console.warn(
          `⚠️ Fixed invalid measurementType "${fixedType}" → "${MEASUREMENT_TYPES.SQUARE_FOOT}"`,
        );
        fixedType = MEASUREMENT_TYPES.SQUARE_FOOT;
      }

      const materialCost =
        item.materialCost !== undefined && item.materialCost !== null
          ? Number(item.materialCost)
          : 0;
      const laborCost =
        item.laborCost !== undefined && item.laborCost !== null
          ? Number(item.laborCost)
          : 0;

      const sanitized = {
        ...item,
        measurementType: fixedType,
        materialCost: isNaN(materialCost) ? 0 : materialCost,
        laborCost: isNaN(laborCost) ? 0 : laborCost,
        name: item.name || "Unnamed Work Item",
        type: item.type || "",
        customWorkTypeName: item.customWorkTypeName || "",
        subtype: item.subtype || "",
        description: item.description || "",
        surfaces: Array.isArray(item.surfaces) ? item.surfaces : [],
        notes: item.notes || "",
      };

      // Drop every legacy key so only surfaces[] is the source of truth
      LEGACY_MEASUREMENT_FIELDS.forEach((k) => delete sanitized[k]);

      return sanitized;
    }),
  };
}

function validateWorkItem(item) {
  const errors = [];
  if (!item.type || item.type.trim() === "")
    errors.push("Work item is missing a work type");
  if (item.type === "custom-work-type" && !item.customWorkTypeName?.trim())
    errors.push("Custom work type is missing a name");
  if (!item.measurementType)
    errors.push("Work item is missing measurement type");
  return errors;
}

/**
 * Returns true if a category key looks valid.
 *
 * Previously this checked against a static WORK_TYPES import, which caused
 * every DB-seeded category key (e.g. "basement", "garage", "walk-in-closet")
 * to be silently rejected because those keys weren't present in the static
 * file. Now we accept any non-empty string — validation of what keys actually
 * exist is the taxonomy API's responsibility.
 */
function isValidCategoryKey(key) {
  if (!key || typeof key !== "string") return false;
  return key.trim().length > 0;
}

export function CategoriesProvider({ children, initialCategories = [] }) {
  const [categories, setCategoriesState] = useState(
    initialCategories.map((c) => sanitizeCategory(c)),
  );
  const [validationWarnings, setValidationWarnings] = useState([]);

  const prevWarningsRef = useRef([]);

  useEffect(() => {
    const warnings = [];
    categories.forEach((category, catIndex) => {
      if (!category.key || !category.name)
        warnings.push(`Category at index ${catIndex} is missing key or name`);

      category.workItems?.forEach((item, itemIndex) => {
        const itemErrors = validateWorkItem(item);
        if (itemErrors.length > 0) {
          warnings.push(
            `Category "${
              category.name
            }" (${catIndex}), Item ${itemIndex}: ${itemErrors.join(", ")}`,
          );
        }
      });
    });

    const warningsString = warnings.join("|");
    const prevString = prevWarningsRef.current.join("|");
    if (warningsString !== prevString) {
      prevWarningsRef.current = warnings;
      setValidationWarnings(warnings);
      if (warnings.length > 0) {
        console.warn("⚠️ Categories validation warnings:", warnings);
      }
    }
  }, [categories]);

  // Every write is funnelled through setCategories (with sanitisation)
  const setCategories = useCallback((updater) => {
    setCategoriesState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const sanitized = next.map((c) => sanitizeCategory(c));
      if (prev.length !== sanitized.length) {
        console.log(
          `📊 Categories count changed: ${prev.length} → ${sanitized.length}`,
        );
      }
      return sanitized;
    });
  }, []);

  const removeCategory = useCallback(
    (index) => {
      setCategories((prev) => {
        if (index < 0 || index >= prev.length) {
          console.warn(`⚠️ Invalid category index: ${index}`);
          return prev;
        }
        const removed = prev[index];
        console.log(`🗑️ Removing category: "${removed.name}" (${removed.key})`);
        return prev.filter((_, i) => i !== index);
      });
    },
    [setCategories],
  );

  const addCategory = useCallback(
    (category) => {
      if (
        !category ||
        typeof category !== "object" ||
        !category.key ||
        !category.name
      ) {
        console.warn("⚠️ Invalid category object:", category);
        return;
      }

      // FIX: The old guard checked the static WORK_TYPES map which did NOT
      // contain DB-seeded keys (basement, garage, walk-in-closet, etc.), so
      // every real DB category was silently dropped here. We now accept any
      // well-formed key string — the taxonomy API owns key validation.
      if (!isValidCategoryKey(category.key)) {
        console.warn(`⚠️ Category key "${category.key}" is not a valid key`);
        return;
      }

      console.log(`➕ Adding category: "${category.name}" (${category.key})`);
      setCategories((prev) => [...prev, sanitizeCategory(category)]);
    },
    [setCategories],
  );

  const updateCategory = useCallback(
    (index, updates) => {
      setCategories((prev) => {
        if (index < 0 || index >= prev.length) {
          console.warn(`⚠️ Invalid category index: ${index}`);
          return prev;
        }

        // FIX: Same guard problem applied to key updates — removed static check.
        if (updates.key && !isValidCategoryKey(updates.key)) {
          console.warn(`⚠️ Updated category key "${updates.key}" is not valid`);
          return prev;
        }

        return prev.map((category, i) => {
          if (i !== index) return category;

          let mergedWorkItems = category.workItems || [];

          if (updates.workItems) {
            mergedWorkItems = updates.workItems.map((item, itemIndex) => {
              const oldItem = category.workItems?.[itemIndex];
              const baseItem = oldItem ? { ...oldItem } : {};
              const mergedItem = { ...baseItem, ...item };

              // Preserve customWorkTypeName explicitly
              if (item.customWorkTypeName !== undefined) {
                mergedItem.customWorkTypeName = item.customWorkTypeName;
              } else if (oldItem?.customWorkTypeName) {
                mergedItem.customWorkTypeName = oldItem.customWorkTypeName;
              }

              // Validate / fix measurement type
              const measurementType = MEASUREMENT_TYPE_UNITS[
                mergedItem.measurementType
              ]
                ? mergedItem.measurementType
                : MEASUREMENT_TYPES.SQUARE_FOOT;

              const materialCost =
                mergedItem.materialCost !== undefined &&
                mergedItem.materialCost !== null
                  ? Number(mergedItem.materialCost)
                  : 0;
              const laborCost =
                mergedItem.laborCost !== undefined &&
                mergedItem.laborCost !== null
                  ? Number(mergedItem.laborCost)
                  : 0;

              const sanitizedItem = {
                ...mergedItem,
                measurementType,
                materialCost: isNaN(materialCost)
                  ? 0
                  : Math.max(0, materialCost),
                laborCost: isNaN(laborCost) ? 0 : Math.max(0, laborCost),
                name: mergedItem.name || "Unnamed Work Item",
                type: mergedItem.type || "",
                customWorkTypeName: mergedItem.customWorkTypeName || "",
                subtype: mergedItem.subtype || "",
                description: mergedItem.description || "",
                surfaces: Array.isArray(mergedItem.surfaces)
                  ? mergedItem.surfaces
                  : [],
                notes: mergedItem.notes || "",
                categoryKey: category.key,
              };

              // Drop legacy measurement keys
              LEGACY_MEASUREMENT_FIELDS.forEach((k) => delete sanitizedItem[k]);

              return sanitizedItem;
            });
          }

          const updatedCategory = {
            ...category,
            ...updates,
            workItems: mergedWorkItems,
          };

          console.log(
            `✅ Updated category "${updatedCategory.name}": ${mergedWorkItems.length} work items`,
          );
          return updatedCategory;
        });
      });
    },
    [setCategories],
  );

  const clearCategories = useCallback(() => {
    console.log("🗑️ Clearing all categories");
    setCategories([]);
  }, [setCategories]);

  const getCategoryById = useCallback(
    (id) => {
      const category = categories.find((cat) => cat.id === id);
      if (!category) console.warn(`⚠️ Category not found with ID: ${id}`);
      return category || null;
    },
    [categories],
  );

  const getCategoryByIndex = useCallback(
    (index) => {
      if (index < 0 || index >= categories.length) {
        console.warn(`⚠️ Invalid category index: ${index}`);
        return null;
      }
      return categories[index];
    },
    [categories],
  );

  const getIncompleteWorkItems = useCallback(() => {
    const incomplete = [];
    categories.forEach((category, catIndex) => {
      category.workItems?.forEach((item, itemIndex) => {
        const errors = validateWorkItem(item);
        if (errors.length > 0) {
          incomplete.push({
            categoryIndex: catIndex,
            categoryName: category.name,
            itemIndex,
            itemName: item.name || "Unnamed",
            errors,
          });
        }
      });
    });
    return incomplete;
  }, [categories]);

  const validateAllCategories = useCallback(() => {
    const errors = [];
    if (categories.length === 0) {
      errors.push("Project must have at least one category");
      return { valid: false, errors };
    }
    categories.forEach((category, catIndex) => {
      if (!category.key || !category.name)
        errors.push(`Category at index ${catIndex} is missing required fields`);
      if (!category.workItems || category.workItems.length === 0)
        errors.push(`Category "${category.name}" has no work items`);
      category.workItems?.forEach((item, itemIndex) => {
        const itemErrors = validateWorkItem(item);
        if (itemErrors.length > 0) {
          errors.push(
            `Category "${category.name}", Item ${itemIndex}: ${itemErrors.join(
              ", ",
            )}`,
          );
        }
      });
    });
    return { valid: errors.length === 0, errors, warnings: validationWarnings };
  }, [categories, validationWarnings]);

  const repairCategories = useCallback(() => {
    console.log("🔧 Running category repair...");
    let repairsMade = 0;
    const repairedCategories = categories.map((category) => ({
      ...category,
      workItems: category.workItems.map((item) => {
        const repairedItem = { ...item };
        let needsRepair = false;

        if (item.type === "custom-work-type" && !item.customWorkTypeName) {
          repairedItem.customWorkTypeName = "Unnamed Custom Work";
          needsRepair = true;
        }
        if (!item.measurementType) {
          repairedItem.measurementType = MEASUREMENT_TYPES.SQUARE_FOOT;
          needsRepair = true;
        }
        if (item.materialCost < 0) {
          repairedItem.materialCost = 0;
          needsRepair = true;
        }
        if (item.laborCost < 0) {
          repairedItem.laborCost = 0;
          needsRepair = true;
        }

        if (needsRepair) repairsMade++;
        return repairedItem;
      }),
    }));

    if (repairsMade > 0) {
      console.log(`✅ Repaired ${repairsMade} work items`);
      setCategories(repairedCategories);
    } else {
      console.log("✅ No repairs needed");
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

export const useCategories = () => {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories must be used within a CategoriesProvider");
  }
  return context;
};
