// src/components/Calculator/WorkItem/WorkItem.jsx

import React, {
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { useWorkType } from "../../../context/WorkTypeContext";
import { useSettings } from "../../../context/SettingsContext";
import { CalculatorEngine } from "../engine/CalculatorEngine";
import SurfaceManager from "./SurfaceManager";
import CostInput from "./CostInput";
import styles from "./WorkItem.module.css";
import ErrorBoundary from "../../ErrorBoundary";
import { normalizeMeasurementType } from "../../../constants/measurementTypes";

const DEFAULT_COST_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "60",
  "70",
  "80",
  "90",
  "100",
  "150",
  "200",
  "250",
  "300",
  "400",
  "500",
  "750",
  "1000",
  "1500",
  "2000",
  "2500",
  "3000",
  "4000",
  "5000",
  "Custom",
];

const ensureNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === "")
    return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export default function WorkItem({
  catIndex,
  workIndex,
  workItem,
  disabled = false,
  categoryKey = "",
  showCostBreakdown = true,
  costOptions = DEFAULT_COST_OPTIONS,
  onItemChange,
  onItemRemove,
}) {
  if (!workItem || typeof workItem !== "object") {
    return (
      <div className={styles.workItem}>
        <div className={styles.errorMessage}>Invalid work item data</div>
      </div>
    );
  }

  return (
    <ErrorBoundary boundaryName={`WorkItem-${catIndex}-${workIndex}`}>
      <WorkItemContent
        catIndex={catIndex}
        workIndex={workIndex}
        workItem={workItem}
        disabled={disabled}
        categoryKey={categoryKey}
        showCostBreakdown={showCostBreakdown}
        costOptions={costOptions}
        onItemChange={onItemChange}
        onItemRemove={onItemRemove}
      />
    </ErrorBoundary>
  );
}

function WorkItemContent({
  catIndex,
  workIndex,
  workItem,
  disabled = false,
  categoryKey = "",
  showCostBreakdown = true,
  costOptions = DEFAULT_COST_OPTIONS,
  onItemChange,
  onItemRemove,
}) {
  const {
    getCategoryWorkTypes,
    getSubtypeOptions,
    getAllMeasurementTypes,
    getMeasurementTypeLabel,
    getMeasurementTypeUnit,
    getMeasurementTypeIcon,
    isCategoryValid,
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
  } = useWorkType();

  const { settings } = useSettings();
  const [isExpanded, setIsExpanded] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [customWorkTypeHistory, setCustomWorkTypeHistory] = useState({});

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const surfaceManagerRef = useRef(null);

  // ── Validation effect ──────────────────────────────────────────────────────

  useEffect(() => {
    const errors = {};

    if (workItem.type === "custom-work-type") {
      if (!workItem.customWorkTypeName?.trim()) {
        errors.customWorkTypeName = "Custom work type name is required";
      }
    }

    if (
      workItem.type &&
      workItem.type !== "custom-work-type" &&
      !workItem.measurementType
    )
      errors.measurementType = "Please select a measurement method";

    setValidationErrors((prev) => {
      const next = { ...prev };

      // Clear field errors when they become valid again
      if (
        workItem.type !== "custom-work-type" ||
        workItem.customWorkTypeName?.trim()
      ) {
        delete next.customWorkTypeName;
      }
      if (workItem.measurementType) delete next.measurementType;

      // Clear stale-work-type warning once a new type is selected
      if (workItem.type) delete next.staleWorkType;

      return { ...next, ...errors };
    });
  }, [workItem.type, workItem.customWorkTypeName, workItem.measurementType]);

  // ── Custom work type history ───────────────────────────────────────────────

  useEffect(() => {
    if (
      workItem.type === "custom-work-type" &&
      workItem.customWorkTypeName?.trim()
    ) {
      setCustomWorkTypeHistory((prev) => ({
        ...prev,
        [workItem.type]: workItem.customWorkTypeName,
      }));
    }
  }, [workItem.type, workItem.customWorkTypeName]);

  useEffect(() => {
    console.log("📊 WorkItem props:", {
      catIndex,
      workIndex,
      type: workItem.type,
      customWorkTypeName: workItem.customWorkTypeName,
    });
  }, [workItem, catIndex, workIndex]);

  // ── Category + work type resolution ───────────────────────────────────────

  const normalizedCategoryKey = useMemo(() => {
    if (!categoryKey) return "";
    if (categoryKey.startsWith("custom_")) return categoryKey;
    return categoryKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "");
  }, [categoryKey]);

  const availableWorkTypes = useMemo(() => {
    try {
      if (!normalizedCategoryKey || !isCategoryValid(normalizedCategoryKey))
        return [];
      return getCategoryWorkTypes(normalizedCategoryKey);
    } catch (err) {
      console.warn(`⚠️ Failed to get work types: ${err.message}`);
      return [];
    }
  }, [normalizedCategoryKey, getCategoryWorkTypes, isCategoryValid]);

  useEffect(() => {
    if (
      workItem.type &&
      workItem.type !== "custom-work-type" &&
      availableWorkTypes.length > 0 &&
      !availableWorkTypes.includes(workItem.type)
    ) {
      console.warn(
        `⚠️ WorkItem type "${workItem.type}" not in available types for "${categoryKey}"`,
      );
      setValidationErrors((prev) => ({
        ...prev,
        staleWorkType: `Work type "${workItem.type}" no longer exists. Please re-select.`,
      }));
    }
  }, [workItem.type, availableWorkTypes, categoryKey]);

  // ── FIX #2: Calculator engine – stable, does not depend on settings object ─

  const calculatorEngine = useMemo(() => {
    try {
      if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
        console.warn("⚠️ Calculator engine dependencies not ready");
        return null;
      }
      // settingsRef.current is always current without being a dep
      return new CalculatorEngine([], settingsRef.current || {}, {
        getMeasurementType,
        isValidSubtype,
        getWorkTypeDetails,
      });
    } catch (err) {
      console.warn("⚠️ Calculator engine init error:", err.message);
      return null;
    }
    // FIX #2: Do NOT include `settings` — use settingsRef.current instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // ── Derived UI data ────────────────────────────────────────────────────────

  const workTypeOptions = useMemo(
    () =>
      availableWorkTypes.map((type) => ({
        value: type,
        label: type
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      })),
    [availableWorkTypes],
  );

  const subtypeOptions = useMemo(() => {
    if (!workItem.type) return [];
    try {
      const opts = getSubtypeOptions(workItem.type);
      return (opts || []).map((opt) => ({ value: opt, label: opt }));
    } catch (err) {
      console.warn(`⚠️ Failed subtype options: ${err.message}`);
      return [];
    }
  }, [workItem.type, getSubtypeOptions]);

  const derivedName = useMemo(() => {
    if (workItem.name && workItem.name !== "New Work Item")
      return workItem.name;
    if (
      workItem.type === "custom-work-type" &&
      workItem.customWorkTypeName?.trim()
    )
      return workItem.customWorkTypeName;
    if (workItem.type) {
      const typeName = workItem.type
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return workItem.subtype ? `${typeName} - ${workItem.subtype}` : typeName;
    }
    return "New Work Item";
  }, [
    workItem.name,
    workItem.type,
    workItem.subtype,
    workItem.customWorkTypeName,
  ]);

  // ── FIX #1: sanitizedWorkItem does NOT recreate legacy measurement fields ──
  const sanitizedWorkItem = useMemo(() => {
    const item = { ...workItem };
    item.materialCost = ensureNumber(item.materialCost);
    item.laborCost = ensureNumber(item.laborCost);
    // surfaces[] is the only measurement source — do NOT add units/linearFt/sqft/width/height
    item.surfaces = Array.isArray(item.surfaces) ? item.surfaces : [];
    return item;
  }, [workItem]);

  const availableMeasurementTypes = useMemo(() => {
    try {
      const allTypes = getAllMeasurementTypes();
      return allTypes.map((type) => ({
        value: type,
        label: getMeasurementTypeLabel(type),
        unit: getMeasurementTypeUnit(type),
        icon: getMeasurementTypeIcon(type),
      }));
    } catch (err) {
      console.warn(`⚠️ Failed measurement types: ${err.message}`);
      return [];
    }
  }, [
    getAllMeasurementTypes,
    getMeasurementTypeLabel,
    getMeasurementTypeUnit,
    getMeasurementTypeIcon,
  ]);

  const calculationResults = useMemo(() => {
    const res = {
      totalUnits: 0,
      totalMaterialCost: 0,
      totalLaborCost: 0,
      totalCost: 0,
      unitLabel: "",
      warnings: [],
      canCalculate: false,
    };

    try {
      if (!sanitizedWorkItem.type || !sanitizedWorkItem.measurementType)
        return res;
      if (
        sanitizedWorkItem.type === "custom-work-type" &&
        !sanitizedWorkItem.customWorkTypeName?.trim()
      )
        return res;
      if (!calculatorEngine) {
        res.warnings.push("Calculation engine not initialized");
        return res;
      }

      const units = calculatorEngine.calculateWorkUnits(sanitizedWorkItem);
      const costs = calculatorEngine.calculateWorkCost(sanitizedWorkItem);

      res.totalUnits = units.units;
      res.totalMaterialCost = parseFloat(costs.materialCost);
      res.totalLaborCost = parseFloat(costs.laborCost);
      res.totalCost = parseFloat(costs.totalCost);
      res.unitLabel = units.label;
      res.canCalculate = true;

      if (units.units === 0)
        res.warnings.push("Total units is zero — verify measurements");
    } catch (err) {
      console.warn(`⚠️ Calculation error: ${err.message}`);
      res.warnings.push(`Calculation error: ${err.message}`);
    }

    return res;
  }, [sanitizedWorkItem, calculatorEngine]);

  const validationErrorList = useMemo(
    () =>
      Object.entries(validationErrors).map(([field, message]) => ({
        field,
        message,
      })),
    [validationErrors],
  );

  // ── FIX #3: updateWorkItem normalises measurementType before forwarding ────

  const updateWorkItem = useCallback(
    (field, value) => {
      if (disabled) return;

      if (field === "measurementType") {
        // FIX #3: Normalize so "sqft" → MEASUREMENT_TYPES.SQUARE_FOOT etc.
        const normalizedType = normalizeMeasurementType(value);
        if (surfaceManagerRef.current?.handleMeasurementTypeChange) {
          surfaceManagerRef.current.handleMeasurementTypeChange(normalizedType);
        } else {
          const updatedItem = {
            ...sanitizedWorkItem,
            measurementType: normalizedType,
          };
          onItemChange?.(catIndex, workIndex, updatedItem);
        }
        return;
      }

      const updates = { [field]: value };

      if (field === "type") {
        if (value !== "custom-work-type") {
          updates.customWorkTypeName = "";
        } else if (customWorkTypeHistory["custom-work-type"]) {
          updates.customWorkTypeName =
            customWorkTypeHistory["custom-work-type"];
        }
        updates.subtype = "";
        updates.measurementType = "";
      }

      if (
        field === "subtype" &&
        !isValidSubtype(sanitizedWorkItem.type, value)
      ) {
        console.warn("⚠️ Invalid subtype selected");
        return;
      }

      const updatedItem = { ...sanitizedWorkItem, ...updates };

      try {
        onItemChange?.(catIndex, workIndex, updatedItem);
      } catch (err) {
        console.error("❌ Error updating work item:", err);
      }
    },
    [
      disabled,
      sanitizedWorkItem,
      onItemChange,
      catIndex,
      workIndex,
      isValidSubtype,
      customWorkTypeHistory,
    ],
  );

  const handleSurfaceUpdate = useCallback(
    (fullUpdatedItem) => {
      if (disabled) return;
      try {
        onItemChange?.(catIndex, workIndex, fullUpdatedItem);
      } catch (err) {
        console.error("❌ Error updating surfaces:", err);
      }
    },
    [disabled, onItemChange, catIndex, workIndex],
  );

  const handleRemove = useCallback(() => {
    if (disabled) return;
    if (window.confirm(`Remove "${derivedName}"?`)) {
      try {
        onItemRemove?.(catIndex, workIndex);
      } catch (err) {
        console.error("❌ Error removing work item:", err);
      }
    }
  }, [disabled, derivedName, onItemRemove, catIndex, workIndex]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`${styles.workItem} ${disabled ? styles.disabled : ""} ${
        !isExpanded ? styles.collapsed : ""
      }`}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setIsExpanded((v) => !v)}
          disabled={disabled}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <i className={`fas fa-chevron-${isExpanded ? "down" : "right"}`} />
        </button>

        <div className={styles.workItemBadge}>
          <span className={styles.numberCircle}>{catIndex + 1}</span>
          <span className={styles.numberSeparator}>-</span>
          <span className={styles.numberCircle}>{workIndex + 1}</span>
        </div>

        <h3 className={styles.workTitle}>
          <i className="fas fa-hammer" />
          {derivedName}
        </h3>

        {calculationResults.canCalculate &&
          calculationResults.totalCost > 0 && (
            <div className={styles.headerTotalCost} title="Total Cost">
              <i className="fas fa-dollar-sign" />
              {calculationResults.totalCost.toFixed(2)}
            </div>
          )}

        <button
          type="button"
          className={styles.removeButton}
          onClick={handleRemove}
          disabled={disabled}
          title="Remove work item"
          aria-label={`Remove ${derivedName}`}
        >
          <i className="fas fa-trash-alt" />
        </button>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          <div className={styles.row}>
            {validationErrors.staleWorkType && (
              <div className={styles.validationErrors} role="alert">
                <i className="fas fa-exclamation-triangle" />
                {validationErrors.staleWorkType}
              </div>
            )}

            {/* Work Type */}
            <div className={styles.field}>
              <label htmlFor={`type-${catIndex}-${workIndex}`}>
                <i className="fas fa-sitemap" /> Work Type *
              </label>
              <select
                id={`type-${catIndex}-${workIndex}`}
                value={sanitizedWorkItem.type}
                onChange={(e) => updateWorkItem("type", e.target.value)}
                disabled={disabled}
                className={`${styles.select} ${
                  !sanitizedWorkItem.type ? styles.required : ""
                }`}
                required
              >
                <option value="">Select Work Type</option>
                {workTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="custom-work-type">Custom Work Type</option>
              </select>
              {!sanitizedWorkItem.type && (
                <small className={styles.errorText}>
                  <i className="fas fa-exclamation-circle" /> Please select a
                  work type
                </small>
              )}
            </div>

            {/* Custom Work Type Name */}
            {sanitizedWorkItem.type === "custom-work-type" && (
              <div className={styles.field}>
                <label htmlFor={`custom-work-name-${catIndex}-${workIndex}`}>
                  <i className="fas fa-pencil-alt" /> Custom Work Name *
                </label>
                <input
                  id={`custom-work-name-${catIndex}-${workIndex}`}
                  type="text"
                  value={sanitizedWorkItem.customWorkTypeName || ""}
                  onChange={(e) =>
                    updateWorkItem("customWorkTypeName", e.target.value)
                  }
                  disabled={disabled}
                  className={`${styles.input} ${
                    validationErrors.customWorkTypeName ? styles.invalid : ""
                  }`}
                  placeholder="Enter custom work type name"
                  required
                />
                {validationErrors.customWorkTypeName && (
                  <small className={styles.errorText}>
                    <i className="fas fa-exclamation-circle" />{" "}
                    {validationErrors.customWorkTypeName}
                  </small>
                )}
              </div>
            )}

            {/* Subtype */}
            {subtypeOptions.length > 0 && (
              <div className={styles.field}>
                <label htmlFor={`subtype-${catIndex}-${workIndex}`}>
                  <i className="fas fa-tags" /> Subtype
                </label>
                <select
                  id={`subtype-${catIndex}-${workIndex}`}
                  value={sanitizedWorkItem.subtype}
                  onChange={(e) => updateWorkItem("subtype", e.target.value)}
                  disabled={disabled}
                  className={styles.select}
                >
                  <option value="">Select Subtype</option>
                  {subtypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Measurement Type */}
          {sanitizedWorkItem.type &&
            (sanitizedWorkItem.type !== "custom-work-type" ||
              sanitizedWorkItem.customWorkTypeName) && (
              <div className={styles.field}>
                <label htmlFor={`measurement-${catIndex}-${workIndex}`}>
                  <i className="fas fa-ruler-combined" /> How to Measure *
                </label>
                <select
                  id={`measurement-${catIndex}-${workIndex}`}
                  value={sanitizedWorkItem.measurementType}
                  onChange={(e) =>
                    updateWorkItem("measurementType", e.target.value)
                  }
                  disabled={disabled}
                  className={`${styles.select} ${
                    !sanitizedWorkItem.measurementType ? styles.required : ""
                  }`}
                  required
                >
                  <option value="">Select Measurement Method</option>
                  {availableMeasurementTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} ({t.unit})
                    </option>
                  ))}
                </select>
                {validationErrors.measurementType && (
                  <small className={styles.errorText}>
                    <i className="fas fa-exclamation-circle" />{" "}
                    {validationErrors.measurementType}
                  </small>
                )}
              </div>
            )}

          {/* Surface Manager */}
          {sanitizedWorkItem.type &&
            sanitizedWorkItem.measurementType &&
            (sanitizedWorkItem.type !== "custom-work-type" ||
              sanitizedWorkItem.customWorkTypeName) && (
              <SurfaceManager
                ref={surfaceManagerRef}
                workItem={sanitizedWorkItem}
                onChange={handleSurfaceUpdate}
                disabled={disabled}
                categoryKey={normalizedCategoryKey}
                workType={sanitizedWorkItem.type}
                catIndex={catIndex}
                workIndex={workIndex}
              />
            )}

          {/* Description & Costs */}
          {sanitizedWorkItem.type &&
            sanitizedWorkItem.measurementType &&
            (sanitizedWorkItem.type !== "custom-work-type" ||
              sanitizedWorkItem.customWorkTypeName) && (
              <>
                <div className={styles.field}>
                  <label htmlFor={`description-${catIndex}-${workIndex}`}>
                    <i className="fas fa-file-alt" /> Work Description
                  </label>
                  <textarea
                    id={`description-${catIndex}-${workIndex}`}
                    className={styles.textarea}
                    value={workItem.description || ""}
                    onChange={(e) =>
                      updateWorkItem("description", e.target.value)
                    }
                    disabled={disabled}
                    placeholder="Describe the specific work to be done..."
                    rows="3"
                  />
                </div>

                <div className={styles.costInputsContainer}>
                  <h4>
                    <i className="fas fa-dollar-sign" /> Cost Per Unit
                  </h4>
                  <div className={styles.costInputs}>
                    <CostInput
                      label="Material Cost"
                      value={workItem.materialCost}
                      onChange={(v) => updateWorkItem("materialCost", v)}
                      disabled={disabled}
                      options={costOptions}
                      field="materialCost"
                      measurementType={sanitizedWorkItem.measurementType}
                      quantity={calculationResults.totalUnits}
                    />
                    <CostInput
                      label="Labor Cost"
                      value={workItem.laborCost}
                      onChange={(v) => updateWorkItem("laborCost", v)}
                      disabled={disabled}
                      options={costOptions}
                      field="laborCost"
                      measurementType={sanitizedWorkItem.measurementType}
                      quantity={calculationResults.totalUnits}
                    />
                  </div>
                </div>
              </>
            )}

          {/* Cost Summary */}
          {calculationResults.canCalculate && showCostBreakdown && (
            <div className={styles.costDisplay}>
              <div className={styles.costSummary}>
                <span className={styles.costItem} title="Total Units">
                  <i className="fas fa-cube" />{" "}
                  {calculationResults.totalUnits.toFixed(2)}
                  <small>{calculationResults.unitLabel}</small>
                </span>
                <span className={styles.costItem} title="Material Cost">
                  <i className="fas fa-box" />$
                  {calculationResults.totalMaterialCost.toFixed(2)}
                </span>
                <span className={styles.costItem} title="Labor Cost">
                  <i className="fas fa-hammer" />$
                  {calculationResults.totalLaborCost.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Warnings */}
          {calculationResults.warnings.length > 0 && (
            <div className={styles.warningSection} role="alert">
              <h4>
                <i className="fas fa-exclamation-triangle" /> Calculation
                Warnings:
              </h4>
              {calculationResults.warnings.map((w, i) => (
                <div key={i} className={styles.warningMessage}>
                  <i className="fas fa-info-circle" /> {w}
                </div>
              ))}
            </div>
          )}

          {/* Validation Errors */}
          {validationErrorList.length > 0 && (
            <div className={styles.validationErrors} role="alert">
              <h4>
                <i className="fas fa-exclamation-triangle" /> Please fix these
                issues:
              </h4>
              {validationErrorList.map((err, i) => (
                <div key={i} className={styles.errorMessage}>
                  <i className="fas fa-exclamation-circle" /> {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
