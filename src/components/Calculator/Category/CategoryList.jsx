// src/components/Calculator/Category/CategoryList.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useWorkType } from '../../../context/WorkTypeContext';
import { useCategories } from '../../../context/CategoriesContext';
import { useError } from '../../../context/ErrorContext';
import styles from './CategoryList.module.css';
import WorkItem from '../WorkItem/WorkItem';

// --- helpers ---------------------------------------------------------------

const toMessage = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return val.message || JSON.stringify(val);
  try {
    return String(val);
  } catch {
    return 'An error occurred';
  }
};

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
          <i className="fas fa-exclamation-triangle" aria-hidden="true"></i> {msg}
        </div>
      );
    }
    return this.props.children;
  }
}

// SIMPLIFIED: Create basic work item with minimal validation
const createBasicWorkItem = (categoryName, categoryKey) => {
  return {
    name: 'New Work Item',
    category: categoryName,
    categoryKey,
    type: '',
    subtype: '',
    measurementType: '',
    materialCost: 0,
    laborCost: 0,
    surfaces: [],
    // Backward compatibility fields
    units: 1,
    linearFt: 1,
    sqft: 25,
    width: 5,
    height: 5,
    notes: '',
  };
};

// --------------------------------------------------------------------------

export default function CategoryList({ disabled = false }) {
  const { categories, addCategory: addCategoryToContext, removeCategory, updateCategory } =
    useCategories();
  const { addError } = useError();
  const { workTypesData, isCategoryValid } = useWorkType();

  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedSections, setExpandedSections] = useState({ categories: true });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const inputTimeoutRef = useRef(null);

  // Unified error handler - only show serious errors to user
  const handleError = (error, shouldAddToGlobal = false) => {
    const message = toMessage(error);
    setErrorMessage(message);
    if (shouldAddToGlobal) {
      const lowerMessage = message.toLowerCase();
      if (
        !lowerMessage.includes('validation') &&
        !lowerMessage.includes('missing') &&
        !lowerMessage.includes('empty')
      ) {
        addError(error);
      }
    }
  };

  const clearError = () => setErrorMessage('');

  // Sanitize cost values
  const sanitizeCostValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : Math.max(0, value);
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    return 0;
  };

  // Generate category options
  const categoryOptions = useMemo(() => {
    if (!workTypesData || typeof workTypesData !== 'object') {
      return [];
    }
    return Object.keys(workTypesData).map((key) => ({
      value: key,
      label: key
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .replace(/^\w/, (c) => c.toUpperCase()),
    }));
  }, [workTypesData]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
    };
  }, []);

  if (!Array.isArray(categories)) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage} role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
          Failed to load categories. Please refresh the page and try again.
        </div>
      </div>
    );
  }

  // Create category key consistently
  const createCategoryKey = (name, isCustom = false) => {
    if (!name || typeof name !== 'string') return '';
    if (isCustom) {
      return `custom_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    }
    return name.trim();
  };

  const categoryKeyExists = (key) => categories.some((cat) => cat.key === key);

  // Update category name
  const updateCategoryName = (catIndex, value) => {
    if (disabled) return;

    if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
    inputTimeoutRef.current = setTimeout(() => {
      try {
        if (!value.trim()) {
          handleError('Category name cannot be empty.');
          return;
        }

        const currentCategory = categories[catIndex];
        if (!currentCategory) {
          handleError('Invalid category index.');
          return;
        }

        let newKey = currentCategory.key;
        if (currentCategory.key?.startsWith('custom_')) {
          newKey = createCategoryKey(value, true);
          if (newKey !== currentCategory.key && categoryKeyExists(newKey)) {
            handleError('A category with this name already exists.');
            return;
          }
        }

        updateCategory(catIndex, {
          name: value.trim(),
          key: newKey,
        });

        clearError();
      } catch (err) {
        handleError(err, true);
      }
    }, 300);
  };

  // Toggle
  const toggleSection = (section) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const toggleCategory = (catIndex) =>
    setExpandedCategories((prev) => ({ ...prev, [catIndex]: !prev[catIndex] }));

  // Add work item
  const addWorkItem = (catIndex) => {
    if (disabled) return;
    try {
      const category = categories[catIndex];
      if (!category) {
        handleError('Invalid category. Please try again.');
        return;
      }

      const { name: categoryName, key: categoryKey } = category;
      if (!categoryName || !categoryKey) {
        handleError('Invalid category. Please try again.');
        return;
      }

      const newWorkItem = createBasicWorkItem(categoryName, categoryKey);

      const updatedWorkItems = [...(category.workItems || []), newWorkItem];
      updateCategory(catIndex, { workItems: updatedWorkItems });

      clearError();
      setExpandedCategories((prev) => ({ ...prev, [catIndex]: true }));
    } catch (err) {
      handleError(err, true);
    }
  };

  const removeWorkItem = (catIndex, workIndex) => {
    if (disabled) return;
    try {
      const category = categories[catIndex];
      if (!category) {
        handleError('Invalid category.');
        return;
      }

      const updatedWorkItems = (category.workItems || []).filter(
        (_, idx) => idx !== workIndex
      );
      updateCategory(catIndex, { workItems: updatedWorkItems });

      clearError();
    } catch (err) {
      handleError(err, true);
    }
  };

  // Add category
  const addCategory = () => {
    if (disabled) return;
    try {
      let categoryName = '';
      let categoryKey = '';

      if (selectedCategory === 'custom' && customCategory.trim()) {
        categoryName = customCategory.trim();
        categoryKey = createCategoryKey(categoryName, true);

        if (categoryKeyExists(categoryKey)) {
          handleError('A category with this name already exists.');
          return;
        }
      } else if (selectedCategory && selectedCategory !== 'custom') {
        categoryKey = selectedCategory;
        categoryName =
          categoryOptions.find((opt) => opt.value === selectedCategory)?.label ||
          selectedCategory;

        if (categoryKeyExists(categoryKey)) {
          handleError('This category has already been added.');
          return;
        }

        if (!isCategoryValid(categoryKey)) {
          handleError('Invalid category selected.');
          return;
        }
      } else {
        handleError('Please select a category or enter a custom category name.');
        return;
      }

      const newCategory = {
        name: categoryName,
        key: categoryKey,
        workItems: [],
      };

      addCategoryToContext(newCategory);

      setSelectedCategory('');
      setCustomCategory('');
      clearError();
    } catch (err) {
      handleError(err, true);
    }
  };

  // Remove category
  const handleRemoveCategory = (catIndex) => {
    if (disabled) return;
    const category = categories[catIndex];
    if (!category) return;

    if (category.workItems && category.workItems.length > 0) {
      if (
        !window.confirm(
          `Are you sure you want to delete "${category.name}" and all its work items?`
        )
      ) {
        return;
      }
    }

    try {
      removeCategory(catIndex);
      clearError();
    } catch (err) {
      handleError(err, true);
    }
  };

  // Work item change handler
  const handleWorkItemChange = (catIndex, workIndex, updatedItem) => {
    try {
      const category = categories[catIndex];
      if (!category) return;

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
  };

  return (
    <div className={styles.container}>
      {errorMessage && (
        <div className={styles.errorMessage} role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>{' '}
          {errorMessage}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <button
            className={styles.toggleButton}
            onClick={() => toggleSection('categories')}
            title={
              expandedSections.categories
                ? 'Collapse Categories'
                : 'Expand Categories'
            }
            aria-expanded={expandedSections.categories}
            aria-label={
              expandedSections.categories
                ? 'Collapse categories section'
                : 'Expand categories section'
            }
          >
            <i
              className={`fas ${
                expandedSections.categories
                  ? 'fa-chevron-down'
                  : 'fa-chevron-right'
              }`}
              aria-hidden="true"
            ></i>
          </button>
          <h3 className={styles.sectionTitle}>
            <i className="fas fa-list" aria-hidden="true"></i> Categories
          </h3>
          
          {/* NEW: Category Count Badge */}
          <div className={styles.categoryCount}>
            <div className={styles.categoryCountNumber}>
              {categories.length}
            </div>
          </div>
        </div>

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

                {selectedCategory === 'custom' && (
                  <div className={styles.inputWrapper}>
                    <i
                      className={`fas fa-tag ${styles.inputIcon}`}
                      aria-hidden="true"
                    ></i>
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customCategory.trim()) {
                          addCategory();
                        }
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
                    (selectedCategory === 'custom' && !customCategory.trim())
                  }
                  title="Add New Category"
                  aria-label="Add new category"
                >
                  <i className="fas fa-plus" aria-hidden="true"></i> Add Category
                </button>
              </div>
            )}

            {categories.length === 0 && (
              <div className={styles.emptyState}>
                <i className="fas fa-folder-open" aria-hidden="true"></i>
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
                          ? 'Collapse Category'
                          : 'Expand Category'
                      }
                      aria-expanded={!!expandedCategories[catIndex]}
                      aria-label={`Toggle category ${
                        cat.name || 'Unnamed'
                      } expansion`}
                    >
                      <i
                        className={`fas ${
                          expandedCategories[catIndex]
                            ? 'fa-chevron-down'
                            : 'fa-chevron-right'
                        }`}
                        aria-hidden="true"
                      ></i>
                    </button>

                    <input
                      type="text"
                      value={cat.name || ''}
                      onChange={(e) =>
                        updateCategoryName(catIndex, e.target.value)
                      }
                      className={styles.categoryInput}
                      placeholder="Enter room or phase name"
                      disabled={disabled}
                      aria-label={`Edit name for category ${catIndex + 1}`}
                    />

                    <span className={styles.categoryType}>
                      {cat.key?.startsWith('custom_') ? 'Custom' : 'Standard'}
                    </span>

                    {!disabled && (
                      <button
                        onClick={() => handleRemoveCategory(catIndex)}
                        className={styles.removeButton}
                        title="Remove Category"
                        aria-label={`Remove category ${cat.name || 'Unnamed'}`}
                      >
                        <i
                          className="fas fa-trash-alt"
                          aria-hidden="true"
                        ></i>
                      </button>
                    )}
                  </div>

                  {expandedCategories[catIndex] && (
                    <>
                      <div className={styles.workItems}>
                        {(cat.workItems || []).length === 0 && (
                          <div className={styles.emptyWorkItems}>
                            <i className="fas fa-hammer" aria-hidden="true"></i>
                            <p>No work items added yet.</p>
                            {!disabled && (
                              <p className={styles.helpText}>
                                Click "Add Work" below to add your first work
                                item.
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
                            aria-label={`Add work item to category ${
                              cat.name || 'Unnamed'
                            }`}
                          >
                            <i className="fas fa-plus" aria-hidden="true"></i>{' '}
                            Add Work
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

      <SafeBoundary onError={(e) => addError(e)}>
      </SafeBoundary>
    </div>
  );
}

