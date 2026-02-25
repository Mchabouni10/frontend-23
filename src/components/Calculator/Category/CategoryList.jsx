// src/components/Calculator/Category/CategoryList.jsx

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useWorkType } from "../../../context/WorkTypeContext";
import { useCategories } from "../../../context/CategoriesContext";
import { useError } from "../../../context/ErrorContext";
import styles from "./CategoryList.module.css";
import SectionHeader from "./SectionHeader";
import WorkItem from "../WorkItem/WorkItem";

// ─── helpers ──────────────────────────────────────────────────────────────────

const toMessage = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") return val.message || JSON.stringify(val);
  try {
    return String(val);
  } catch {
    return "An error occurred";
  }
};

// FIX #2: Moved outside component so it is never recreated on re-render
const sanitizeCostValue = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : Math.max(0, value);
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  return 0;
};

// FIX #1: createBasicWorkItem NO LONGER creates legacy top-level measurement
// fields (units, linearFt, sqft, width, height).  All measurement data lives
// in the surfaces[] array managed by SurfaceManager.
const createBasicWorkItem = (categoryName, categoryKey) => ({
  name: "New Work Item",
  customWorkTypeName: "",
  category: categoryName,
  categoryKey,
  type: "",
  subtype: "",
  measurementType: "",
  materialCost: 0,
  laborCost: 0,
  surfaces: [], // ← single source of truth; SurfaceManager populates this
  notes: "",
  description: "",
});

// Error boundary to prevent child render crashes
class SafeBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    if (this.props.onError) this.props.onError(err, info);
  }
  render() {
    if (this.state.hasError) {
      const msg = toMessage(this.state.err);
      return (
        <div className={styles.errorMessage} role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true" /> {msg}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export default function CategoryList({ disabled = false }) {
  const {
    categories,
    addCategory: addCategoryToContext,
    removeCategory,
    updateCategory,
  } = useCategories();
  const { addError } = useError();
  const { workTypesData } = useWorkType();

  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    categories: true,
  });
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const inputTimeoutRef = useRef(null);

  // Unified error handler
  const handleError = useCallback(
    (error, shouldAddToGlobal = false) => {
      const message = toMessage(error);
      setErrorMessage(message);
      if (shouldAddToGlobal) {
        const lowerMessage = message.toLowerCase();
        if (
          !lowerMessage.includes("validation") &&
          !lowerMessage.includes("missing") &&
          !lowerMessage.includes("empty")
        ) {
          addError(error);
        }
      }
    },
    [addError],
  );

  const clearError = useCallback(() => setErrorMessage(""), []);

  // FIX #3: Cleanup only the timeout, not a stale ref value
  useEffect(() => {
    return () => {
      if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
    };
  }, []);

  // Category key helpers
  const createCategoryKey = useCallback((name, isCustom = false) => {
    if (!name || typeof name !== "string") return "";
    if (isCustom) {
      return `custom_${name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")}`;
    }
    return name.trim();
  }, []);

  const categoryKeyExists = useCallback(
    (key) => categories.some((cat) => cat.key === key),
    [categories],
  );

  // Generate dropdown options
  const categoryOptions = useMemo(() => {
    if (!workTypesData || typeof workTypesData !== "object") return [];
    return Object.keys(workTypesData).map((key) => ({
      value: key,
      label: key
        .replace(/([A-Z])/g, " $1")
        .trim()
        .replace(/^\w/, (c) => c.toUpperCase()),
    }));
  }, [workTypesData]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const addCategory = useCallback(() => {
    if (disabled) return;
    try {
      if (!selectedCategory) {
        handleError("Please select a category.");
        return;
      }

      let key, name;

      if (selectedCategory === "custom") {
        const trimmed = customCategory.trim();
        if (!trimmed) {
          handleError("Please enter a category name.");
          return;
        }
        key = createCategoryKey(trimmed, true);
        name = trimmed;
      } else {
        key = selectedCategory;
        name = categoryOptions.find((o) => o.value === key)?.label || key;
      }

      if (categoryKeyExists(key)) {
        handleError("This category has already been added.");
        return;
      }

      addCategoryToContext({
        key,
        name,
        workItems: [],
      });

      setSelectedCategory("");
      setCustomCategory("");
      clearError();
    } catch (err) {
      handleError(err, true);
    }
  }, [
    disabled,
    selectedCategory,
    customCategory,
    categoryOptions,
    createCategoryKey,
    categoryKeyExists,
    addCategoryToContext,
    handleError,
    clearError,
  ]);

  const handleRemoveCategory = useCallback(
    (catIndex) => {
      if (disabled) return;
      removeCategory(catIndex);
    },
    [disabled, removeCategory],
  );

  const updateCategoryName = useCallback(
    (catIndex, value) => {
      if (disabled) return;
      if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
      inputTimeoutRef.current = setTimeout(() => {
        try {
          if (!value.trim()) {
            handleError("Category name cannot be empty.");
            return;
          }
          const currentCategory = categories[catIndex];
          if (!currentCategory) {
            handleError("Invalid category index.");
            return;
          }
          let newKey = currentCategory.key;
          if (currentCategory.key?.startsWith("custom_")) {
            newKey = createCategoryKey(value, true);
            if (newKey !== currentCategory.key && categoryKeyExists(newKey)) {
              handleError("A category with this name already exists.");
              return;
            }
          }
          updateCategory(catIndex, { name: value.trim(), key: newKey });
          clearError();
        } catch (err) {
          handleError(err, true);
        }
      }, 300);
    },
    [
      disabled,
      categories,
      createCategoryKey,
      categoryKeyExists,
      updateCategory,
      handleError,
      clearError,
    ],
  );

  const addWorkItem = useCallback(
    (catIndex) => {
      if (disabled) return;
      try {
        const category = categories[catIndex];
        if (!category?.name || !category?.key) {
          handleError("Invalid category. Please try again.");
          return;
        }
        const newWorkItem = createBasicWorkItem(category.name, category.key);
        const updatedWorkItems = [...(category.workItems || []), newWorkItem];
        updateCategory(catIndex, { workItems: updatedWorkItems });
        clearError();
      } catch (err) {
        handleError(err, true);
      }
    },
    [disabled, categories, updateCategory, handleError, clearError],
  );

  const removeWorkItem = useCallback(
    (catIndex, workIndex) => {
      if (disabled) return;
      try {
        const category = categories[catIndex];
        if (!category) return;
        const updatedWorkItems = (category.workItems || []).filter(
          (_, i) => i !== workIndex,
        );
        updateCategory(catIndex, { workItems: updatedWorkItems });
      } catch (err) {
        handleError(err, true);
      }
    },
    [disabled, categories, updateCategory, handleError],
  );

  const handleWorkItemChange = useCallback(
    (catIndex, workIndex, updatedItem) => {
      if (disabled) return;
      try {
        const category = categories[catIndex];
        if (!category) return;

        // FIX #1: Only sanitize cost fields; do NOT re-add legacy measurement
        // fields here. updatedItem already carries surfaces[] from SurfaceManager.
        const sanitizedItem = {
          ...updatedItem,
          materialCost: sanitizeCostValue(updatedItem.materialCost),
          laborCost: sanitizeCostValue(updatedItem.laborCost),
        };

        const updatedWorkItems = [...(category.workItems || [])];
        updatedWorkItems[workIndex] = sanitizedItem;
        updateCategory(catIndex, { workItems: updatedWorkItems });
      } catch (err) {
        handleError(err, true);
      }
    },
    [disabled, categories, updateCategory, handleError],
  );

  // Toggle helpers
  const toggleSection = useCallback(
    (section) =>
      setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] })),
    [],
  );

  const toggleCategory = useCallback(
    (catIndex) =>
      setExpandedCategories((prev) => ({
        ...prev,
        [catIndex]: !prev[catIndex],
      })),
    [],
  );

  // ── Guard ────────────────────────────────────────────────────────────────────

  if (!Array.isArray(categories)) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage} role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true" />
          Failed to load categories. Please refresh the page and try again.
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {errorMessage && (
        <div className={styles.errorMessage} role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true" />{" "}
          {errorMessage}
        </div>
      )}

      <div className={styles.section}>
        <SectionHeader
          title="Categories"
          icon="fas fa-list"
          isExpanded={expandedSections.categories}
          onToggle={() => toggleSection("categories")}
          disabled={disabled}
          stats={[
            {
              icon: "fas fa-layer-group",
              value: categories.length,
              label: "Total Categories",
            },
          ]}
        />

        {expandedSections.categories && (
          <div className={styles.categories}>
            {!disabled && (
              <div className={styles.categoryInputWrapper}>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.categorySelect}
                  aria-label="Select a category"
                >
                  <option value="">Select Category</option>
                  {categoryOptions
                    .filter((option) => !categoryKeyExists(option.value))
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  <option value="custom">Custom Category</option>
                </select>

                {selectedCategory === "custom" && (
                  <div className={styles.inputWrapper}>
                    <i
                      className={`fas fa-tag ${styles.inputIcon}`}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customCategory.trim())
                          addCategory();
                      }}
                      placeholder="Enter custom category name"
                      className={styles.categoryInput}
                      aria-label="Enter custom category name"
                    />
                  </div>
                )}

                <button
                  onClick={addCategory}
                  className={styles.addButton}
                  disabled={
                    !selectedCategory ||
                    (selectedCategory === "custom" && !customCategory.trim())
                  }
                  title="Add New Category"
                  aria-label="Add new category"
                >
                  <i className="fas fa-plus" aria-hidden="true" /> Add Category
                </button>
              </div>
            )}

            {categories.length === 0 && (
              <div className={styles.emptyState}>
                <i className="fas fa-folder-open" aria-hidden="true" />
                <p>
                  No categories added yet. Add your first category to get
                  started.
                </p>
              </div>
            )}

            <SafeBoundary onError={(e) => addError(e)}>
              {categories.map((cat, catIndex) => (
                <div
                  key={cat.key || `cat-${catIndex}`}
                  className={styles.category}
                >
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryNumber}>
                      {catIndex + 1}
                    </span>
                    <button
                      className={styles.toggleButton}
                      onClick={() => toggleCategory(catIndex)}
                      disabled={disabled}
                      title={
                        expandedCategories[catIndex]
                          ? "Collapse Category"
                          : "Expand Category"
                      }
                      aria-expanded={!!expandedCategories[catIndex]}
                      aria-label={`Toggle category ${cat.name || "Unnamed"}`}
                    >
                      <i
                        className={`fas ${
                          expandedCategories[catIndex]
                            ? "fa-chevron-down"
                            : "fa-chevron-right"
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <input
                      type="text"
                      defaultValue={cat.name || ""}
                      onChange={(e) =>
                        updateCategoryName(catIndex, e.target.value)
                      }
                      className={styles.categoryInput}
                      placeholder="Enter room or phase name"
                      disabled={disabled}
                      aria-label={`Edit name for category ${catIndex + 1}`}
                    />

                    <span className={styles.categoryType}>
                      {cat.key?.startsWith("custom_") ? "Custom" : "Standard"}
                    </span>

                    {!disabled && (
                      <button
                        onClick={() => handleRemoveCategory(catIndex)}
                        className={styles.removeButton}
                        title="Remove Category"
                        aria-label={`Remove category ${cat.name || "Unnamed"}`}
                      >
                        <i className="fas fa-trash-alt" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {expandedCategories[catIndex] && (
                    <>
                      <div className={styles.workItems}>
                        {(cat.workItems || []).length === 0 && (
                          <div className={styles.emptyWorkItems}>
                            <i className="fas fa-hammer" aria-hidden="true" />
                            <p>No work items added yet.</p>
                            {!disabled && (
                              <p className={styles.helpText}>
                                Click "Add Work" to add your first work item.
                              </p>
                            )}
                          </div>
                        )}
                        {(cat.workItems || []).map((item, workIndex) => (
                          <SafeBoundary
                            key={`${catIndex}-${workIndex}`}
                            onError={(e) => addError(e)}
                          >
                            <WorkItem
                              catIndex={catIndex}
                              workIndex={workIndex}
                              workItem={item}
                              disabled={disabled}
                              categoryKey={cat.key}
                              onItemChange={handleWorkItemChange}
                              onItemRemove={removeWorkItem}
                              showCostBreakdown={true}
                            />
                          </SafeBoundary>
                        ))}
                      </div>

                      {!disabled && (
                        <div className={styles.workControls}>
                          <button
                            onClick={() => addWorkItem(catIndex)}
                            className={styles.addButton}
                            title="Add New Work Item"
                            aria-label={`Add work item to ${
                              cat.name || "Unnamed"
                            }`}
                          >
                            <i className="fas fa-plus" aria-hidden="true" /> Add
                            Work
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </SafeBoundary>
          </div>
        )}
      </div>
    </div>
  );
}
