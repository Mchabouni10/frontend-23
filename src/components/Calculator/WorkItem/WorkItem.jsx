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
import { useWorkTypeTaxonomy } from "../../../context/WorkTypeTaxonomyContext";
import { CalculatorEngine } from "../engine/CalculatorEngine";
import SurfaceManager from "./SurfaceManager";
import CostInput from "./CostInput";
import styles from "./WorkItem.module.css";
import ErrorBoundary from "../../ErrorBoundary";
import { normalizeMeasurementType } from "../../../constants/measurementTypes";

// ─── Material cost options ─────────────────────────────────────────────────────
// Wide range because materials vary enormously: $1/sqft paint to $50/sqft stone.
const DEFAULT_MATERIAL_OPTIONS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "12", "15", "18", "20", "25", "30", "35", "40", "45", "50",
  "60", "70", "80", "90", "100",
  "125", "150", "175", "200", "250", "300", "400", "500",
  "750", "1000", "1500", "2000", "2500", "3000", "4000", "5000",
  "Custom",
];

// ─── Labor cost options by measurement type ────────────────────────────────────
// Rates reflect real US contractor pricing ranges per measurement unit.
// SF: skilled trade labor runs $1–$25/sqft for most interior work.
// LF: trim/pipe/conduit labor runs $2–$50/lf.
// BY_UNIT: fixture/appliance installs typically run $25–$500/unit.
// Each list is intentionally tighter and more relevant than the material list —
// a contractor shouldn't need to scroll past $5000 when setting labor/sqft.
const LABOR_COST_OPTIONS = {
  SQUARE_FOOT: [
    "1", "1.50", "2", "2.50", "3", "3.50", "4", "4.50",
    "5", "6", "7", "8", "9", "10",
    "12", "15", "18", "20", "25",
    "30", "35", "40", "50",
    "Custom",
  ],
  LINEAR_FOOT: [
    "1", "1.50", "2", "2.50", "3", "4", "5",
    "6", "7", "8", "10", "12", "15",
    "18", "20", "25", "30", "35", "40", "50",
    "Custom",
  ],
  BY_UNIT: [
    "25", "35", "50", "60", "75",
    "100", "125", "150", "175", "200",
    "250", "300", "350", "400", "500",
    "600", "750", "1000",
    "Custom",
  ],
};

// Fallback for unknown / unmapped measurement types
const DEFAULT_LABOR_OPTIONS = [
  "1", "2", "3", "5", "7", "10", "15", "20", "25",
  "30", "40", "50", "75", "100", "150", "200", "300", "500",
  "Custom",
];

// ─── Helper: pick the right labor option list from a measurement type string ──
// Accepts the raw measurementType value from workItem (e.g. "square_foot",
// "SQUARE_FOOT", "sqft") and returns the matching preset list.
function getLaborOptions(measurementType) {
  if (!measurementType) return DEFAULT_LABOR_OPTIONS;
  const upper = String(measurementType).toUpperCase().replace(/[^A-Z_]/g, "_");
  if (upper.includes("SQUARE") || upper === "SQFT" || upper === "SF")
    return LABOR_COST_OPTIONS.SQUARE_FOOT;
  if (upper.includes("LINEAR") || upper.includes("LINEAR_FOOT") || upper === "LF")
    return LABOR_COST_OPTIONS.LINEAR_FOOT;
  if (upper.includes("UNIT") || upper.includes("BY_UNIT") || upper === "EA")
    return LABOR_COST_OPTIONS.BY_UNIT;
  return DEFAULT_LABOR_OPTIONS;
}

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
  materialCostOptions = DEFAULT_MATERIAL_OPTIONS,
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
        materialCostOptions={materialCostOptions}
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
  materialCostOptions = DEFAULT_MATERIAL_OPTIONS,
  onItemChange,
  onItemRemove,
}) {
  const {
    getAllMeasurementTypes,
    getMeasurementTypeLabel,
    getMeasurementTypeUnit,
    getMeasurementTypeIcon,
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
    isCategoryValid,
  } = useWorkType();

  // FIX: Use the shared context instead of calling useWorkTypeTaxonomy() directly.
  // Previously every WorkItem instance triggered its own API fetch on mount,
  // meaning 10 work items = 10 fetches, and subtypes saved in one WorkItem
  // were invisible to all others until a full page reload.
  const {
    getCategoryWorkTypes: getDBWorkTypes,
    getSubtypes: getDBSubtypes,
    createSubtype,
  } = useWorkTypeTaxonomy();

  const { settings } = useSettings();
  const [isExpanded, setIsExpanded] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [customWorkTypeHistory, setCustomWorkTypeHistory] = useState({});

  // Inline "add new subtype" state
  const [addingSubtype, setAddingSubtype] = useState(false);
  const [newSubtypeVal, setNewSubtypeVal] = useState("");
  const [subtypeSaving, setSubtypeSaving] = useState(false);
  const [subtypeFeedback, setSubtypeFeedback] = useState(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const surfaceManagerRef = useRef(null);

  // ── Validation effect ──────────────────────────────────────────────────────

  useEffect(() => {
    const errors = {};
    if (workItem.type === "custom-work-type") {
      if (!workItem.customWorkTypeName?.trim())
        errors.customWorkTypeName = "Custom work type name is required";
    }
    if (
      workItem.type &&
      workItem.type !== "custom-work-type" &&
      !workItem.measurementType
    )
      errors.measurementType = "Please select a measurement method";

    setValidationErrors((prev) => {
      const next = { ...prev };
      if (
        workItem.type !== "custom-work-type" ||
        workItem.customWorkTypeName?.trim()
      )
        delete next.customWorkTypeName;
      if (workItem.measurementType) delete next.measurementType;
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

  // ── Category key normalization ─────────────────────────────────────────────

  const normalizedCategoryKey = useMemo(() => {
    if (!categoryKey) return "";
    if (categoryKey.startsWith("custom_")) return categoryKey;
    return categoryKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "");
  }, [categoryKey]);

  // ── Available work types — from shared DB taxonomy ────────────────────────

  const availableWorkTypes = useMemo(() => {
    try {
      // DB taxonomy returns WorkType objects with .key and .name
      const dbTypes = getDBWorkTypes(normalizedCategoryKey);
      if (dbTypes && dbTypes.length > 0) return dbTypes;
      // Fallback: if category is valid in static context
      if (!normalizedCategoryKey || !isCategoryValid(normalizedCategoryKey))
        return [];
      return [];
    } catch (err) {
      console.warn(`⚠️ Failed to get work types: ${err.message}`);
      return [];
    }
  }, [normalizedCategoryKey, getDBWorkTypes, isCategoryValid]);

  useEffect(() => {
    if (
      workItem.type &&
      workItem.type !== "custom-work-type" &&
      availableWorkTypes.length > 0
    ) {
      const keys = availableWorkTypes.map((wt) =>
        typeof wt === "string" ? wt : wt.key,
      );
      if (!keys.includes(workItem.type)) {
        console.warn(
          `⚠️ WorkItem type "${workItem.type}" not in available types for "${categoryKey}"`,
        );
        setValidationErrors((prev) => ({
          ...prev,
          staleWorkType: `Work type "${workItem.type}" no longer exists. Please re-select.`,
        }));
      }
    }
  }, [workItem.type, availableWorkTypes, categoryKey]);

  // ── Calculator engine ──────────────────────────────────────────────────────

  const calculatorEngine = useMemo(() => {
    try {
      if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
        console.warn("⚠️ Calculator engine dependencies not ready");
        return null;
      }
      return new CalculatorEngine([], settingsRef.current || {}, {
        getMeasurementType,
        isValidSubtype,
        getWorkTypeDetails,
      });
    } catch (err) {
      console.warn("⚠️ Calculator engine init error:", err.message);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // ── Derived UI data ────────────────────────────────────────────────────────

  // Work type dropdown options — DB objects have .key/.name
  const workTypeOptions = useMemo(
    () =>
      availableWorkTypes.map((wt) => {
        if (typeof wt === "string") {
          return {
            value: wt,
            label: wt
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" "),
          };
        }
        return { value: wt.key, label: wt.name };
      }),
    [availableWorkTypes],
  );

  // Subtype options — from shared DB taxonomy (includes custom subtypes)
  const subtypeOptions = useMemo(() => {
    if (!workItem.type || workItem.type === "custom-work-type") return [];
    try {
      const dbSubs = getDBSubtypes(workItem.type);
      if (dbSubs && dbSubs.length > 0) {
        return dbSubs.map((s) => ({
          value: s.value,
          label: s.value,
          isDefault: s.isDefault,
          isCustom: s.isCustom,
        }));
      }
      return [];
    } catch (err) {
      console.warn(`⚠️ Failed subtype options: ${err.message}`);
      return [];
    }
  }, [workItem.type, getDBSubtypes]);

  const derivedName = useMemo(() => {
    if (workItem.name && workItem.name !== "New Work Item")
      return workItem.name;
    if (
      workItem.type === "custom-work-type" &&
      workItem.customWorkTypeName?.trim()
    )
      return workItem.customWorkTypeName;
    if (workItem.type) {
      const dbType = workTypeOptions.find((opt) => opt.value === workItem.type);
      let typeName = dbType ? dbType.label : "";
      if (!typeName) {
        typeName = workItem.type
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
      return workItem.subtype ? `${typeName} - ${workItem.subtype}` : typeName;
    }
    return "New Work Item";
  }, [
    workItem.name,
    workItem.type,
    workItem.subtype,
    workItem.customWorkTypeName,
    workTypeOptions,
  ]);

  const sanitizedWorkItem = useMemo(() => {
    const item = { ...workItem };
    item.materialCost = ensureNumber(item.materialCost);
    item.laborCost = ensureNumber(item.laborCost);
    item.surfaces = Array.isArray(item.surfaces) ? item.surfaces : [];
    return item;
  }, [workItem]);

  // Labor options are derived from the selected measurement type so they always
  // show the relevant rate range (e.g. $/sqft vs $/unit vs $/lf).
  // Re-computed whenever measurementType changes — zero extra overhead.
  const laborCostOptions = useMemo(
    () => getLaborOptions(sanitizedWorkItem.measurementType),
    [sanitizedWorkItem.measurementType],
  );

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

  // ── updateWorkItem ─────────────────────────────────────────────────────────

  const updateWorkItem = useCallback(
    (field, value) => {
      if (disabled) return;

      if (field === "measurementType") {
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
        if (!value) return;
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

  // ── Inline add subtype ─────────────────────────────────────────────────────

  const handleSaveNewSubtype = useCallback(async () => {
    if (
      !newSubtypeVal.trim() ||
      !workItem.type ||
      workItem.type === "custom-work-type"
    )
      return;
    setSubtypeSaving(true);
    try {
      // createSubtype comes from the shared context — the new subtype is
      // immediately visible in every other WorkItem and in TaxonomyManager
      await createSubtype({
        workTypeKey: workItem.type,
        value: newSubtypeVal.trim(),
      });
      updateWorkItem("subtype", newSubtypeVal.trim());
      setSubtypeFeedback({
        type: "success",
        msg: `"${newSubtypeVal.trim()}" added!`,
      });
      setNewSubtypeVal("");
      setAddingSubtype(false);
      setTimeout(() => setSubtypeFeedback(null), 3000);
    } catch (err) {
      setSubtypeFeedback({
        type: "error",
        msg: err.message || "Could not save subtype.",
      });
      setTimeout(() => setSubtypeFeedback(null), 4000);
    } finally {
      setSubtypeSaving(false);
    }
  }, [newSubtypeVal, workItem.type, createSubtype, updateWorkItem]);

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
                <option value="custom-work-type">＋ Custom Work Type</option>
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

            {/* Subtype — with inline "add new" capability */}
            {subtypeOptions.length > 0 &&
              sanitizedWorkItem.type !== "custom-work-type" && (
                <div className={styles.field}>
                  <label htmlFor={`subtype-${catIndex}-${workIndex}`}>
                    <i className="fas fa-tags" /> Subtype
                  </label>

                  {!addingSubtype ? (
                    <>
                      <div className={styles.subtypeRow}>
                        <select
                          id={`subtype-${catIndex}-${workIndex}`}
                          value={sanitizedWorkItem.subtype}
                          onChange={(e) =>
                            updateWorkItem("subtype", e.target.value)
                          }
                          disabled={disabled}
                          className={styles.select}
                        >
                          <option value="">Select Subtype</option>
                          {subtypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                              {opt.isDefault ? " ★" : ""}
                              {opt.isCustom ? " (custom)" : ""}
                            </option>
                          ))}
                        </select>
                        {!disabled && (
                          <button
                            type="button"
                            className={styles.addSubtypeBtn}
                            onClick={() => {
                              setAddingSubtype(true);
                              setNewSubtypeVal("");
                            }}
                            title="Add a new custom subtype"
                          >
                            <i className="fas fa-plus" />
                          </button>
                        )}
                      </div>

                      {subtypeFeedback && (
                        <small
                          className={`${styles.subtypeFeedback} ${
                            styles[`feedback_${subtypeFeedback.type}`]
                          }`}
                        >
                          <i
                            className={`fas fa-${
                              subtypeFeedback.type === "success"
                                ? "check"
                                : "exclamation-circle"
                            }`}
                          />{" "}
                          {subtypeFeedback.msg}
                        </small>
                      )}
                    </>
                  ) : (
                    /* Inline add subtype form */
                    <div className={styles.inlineSubtypeForm}>
                      <input
                        autoFocus
                        type="text"
                        value={newSubtypeVal}
                        onChange={(e) => setNewSubtypeVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveNewSubtype();
                          if (e.key === "Escape") {
                            setAddingSubtype(false);
                            setNewSubtypeVal("");
                          }
                        }}
                        placeholder="New subtype name…"
                        className={styles.inlineSubtypeInput}
                        disabled={subtypeSaving}
                      />
                      <button
                        type="button"
                        className={styles.saveSubtypeBtn}
                        onClick={handleSaveNewSubtype}
                        disabled={subtypeSaving || !newSubtypeVal.trim()}
                      >
                        {subtypeSaving ? (
                          <i className="fas fa-spinner fa-spin" />
                        ) : (
                          <i className="fas fa-check" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.cancelSubtypeBtn}
                        onClick={() => {
                          setAddingSubtype(false);
                          setNewSubtypeVal("");
                        }}
                        disabled={subtypeSaving}
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* No subtypes yet — still offer to add one */}
            {subtypeOptions.length === 0 &&
              sanitizedWorkItem.type &&
              sanitizedWorkItem.type !== "custom-work-type" &&
              !disabled && (
                <div className={styles.field}>
                  <label>
                    <i className="fas fa-tags" /> Subtype
                  </label>
                  {!addingSubtype ? (
                    <button
                      type="button"
                      className={styles.addSubtypeEmptyBtn}
                      onClick={() => {
                        setAddingSubtype(true);
                        setNewSubtypeVal("");
                      }}
                    >
                      <i className="fas fa-plus" /> Add First Subtype
                    </button>
                  ) : (
                    <div className={styles.inlineSubtypeForm}>
                      <input
                        autoFocus
                        type="text"
                        value={newSubtypeVal}
                        onChange={(e) => setNewSubtypeVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveNewSubtype();
                          if (e.key === "Escape") {
                            setAddingSubtype(false);
                            setNewSubtypeVal("");
                          }
                        }}
                        placeholder="New subtype name…"
                        className={styles.inlineSubtypeInput}
                        disabled={subtypeSaving}
                      />
                      <button
                        type="button"
                        className={styles.saveSubtypeBtn}
                        onClick={handleSaveNewSubtype}
                        disabled={subtypeSaving || !newSubtypeVal.trim()}
                      >
                        {subtypeSaving ? (
                          <i className="fas fa-spinner fa-spin" />
                        ) : (
                          <i className="fas fa-check" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.cancelSubtypeBtn}
                        onClick={() => {
                          setAddingSubtype(false);
                          setNewSubtypeVal("");
                        }}
                        disabled={subtypeSaving}
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  )}
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
                      options={materialCostOptions}
                      field="materialCost"
                      measurementType={sanitizedWorkItem.measurementType}
                      quantity={calculationResults.totalUnits}
                    />
                    <CostInput
                      label="Labor Cost"
                      value={workItem.laborCost}
                      onChange={(v) => updateWorkItem("laborCost", v)}
                      disabled={disabled}
                      options={laborCostOptions}
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
                <span className={styles.costItemTotal} title="Total Cost">
                  <i className="fas fa-receipt" />$
                  {(
                    calculationResults.totalMaterialCost +
                    calculationResults.totalLaborCost
                  ).toFixed(2)}
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