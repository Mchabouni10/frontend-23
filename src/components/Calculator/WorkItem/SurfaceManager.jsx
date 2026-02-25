// src/components/Calculator/SurfaceManager/SurfaceManager.jsx

import {
  useEffect,
  useCallback,
  useState,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import PropTypes from "prop-types";
import styles from "./SurfaceManager.module.css";
import SquareFootageInput from "./inputs/SquareFootageInput";
import LinearFootInput from "./inputs/LinearFootInput";
import ByUnitInput from "./inputs/ByUnitInput";
import {
  MEASUREMENT_TYPES,
  normalizeMeasurementType,
  getMeasurementTypeUnit,
} from "../../../constants/measurementTypes";

// ─── FIX #2: Monotonic ID counter — no collisions even in tight loops ─────────
let _surfaceIdCounter = 0;
const generateSurfaceId = () => `surface_${Date.now()}_${++_surfaceIdCounter}`;

// ─── Validation ───────────────────────────────────────────────────────────────

const validateSurface = (surface, measurementType) => {
  if (!surface || typeof surface !== "object")
    return { isValid: false, error: "Surface must be an object" };

  const normalizedType = normalizeMeasurementType(measurementType);

  if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) {
    const hasValidDimensions =
      (typeof surface.width === "number" &&
        surface.width >= 0 &&
        typeof surface.height === "number" &&
        surface.height >= 0) ||
      (typeof surface.sqft === "number" && surface.sqft >= 0);
    if (!hasValidDimensions)
      return {
        isValid: false,
        error: "Square foot surface must have valid width/height or sqft",
      };
  } else if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
    if (typeof surface.linearFt !== "number" || surface.linearFt < 0)
      return {
        isValid: false,
        error: "Linear foot surface must have valid linearFt",
      };
  } else if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
    if (typeof surface.units !== "number" || surface.units < 0)
      return {
        isValid: false,
        error: "Unit surface must have valid units value",
      };
  }

  return { isValid: true, error: null };
};

// ─── Surface name helpers ─────────────────────────────────────────────────────

const getSurfaceName = (measurementType, index) => {
  const normalizedType = normalizeMeasurementType(measurementType);
  if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) return `Unit ${index}`;
  if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT)
    return `Linear Section ${index}`;
  return `Surface ${index}`;
};

// ─── createCleanSurface ───────────────────────────────────────────────────────

const createCleanSurface = (measurementType, index, existingSurface = {}) => {
  const normalizedType = normalizeMeasurementType(measurementType);
  // FIX #2: Use monotonic generator instead of Date.now() + random
  const surfaceId = existingSurface.id || generateSurfaceId();

  const safeName =
    typeof existingSurface.name === "string"
      ? existingSurface.name
      : getSurfaceName(normalizedType, index);

  const safeSubtype =
    typeof existingSurface.subtype === "string" ? existingSurface.subtype : "";

  const baseSurface = {
    id: surfaceId,
    name: safeName,
    measurementType: normalizedType,
    subtype: safeSubtype,
  };

  if (normalizedType === MEASUREMENT_TYPES.SQUARE_FOOT) {
    const manualSqft = existingSurface.manualSqft || false;
    if (manualSqft) {
      const sqft =
        typeof existingSurface.sqft === "number" && existingSurface.sqft >= 0
          ? existingSurface.sqft
          : 25;
      return { ...baseSurface, sqft, manualSqft: true };
    } else {
      const width =
        typeof existingSurface.width === "number" && existingSurface.width >= 0
          ? existingSurface.width
          : 5;
      const height =
        typeof existingSurface.height === "number" &&
        existingSurface.height >= 0
          ? existingSurface.height
          : 5;
      const sqft =
        typeof existingSurface.sqft === "number" && existingSurface.sqft >= 0
          ? existingSurface.sqft
          : width * height;
      return { ...baseSurface, width, height, sqft, manualSqft: false };
    }
  }

  if (normalizedType === MEASUREMENT_TYPES.LINEAR_FOOT) {
    return {
      ...baseSurface,
      linearFt:
        typeof existingSurface.linearFt === "number" &&
        existingSurface.linearFt >= 0
          ? existingSurface.linearFt
          : 10,
    };
  }

  if (normalizedType === MEASUREMENT_TYPES.BY_UNIT) {
    return {
      ...baseSurface,
      units:
        typeof existingSurface.units === "number" && existingSurface.units >= 0
          ? existingSurface.units
          : 1,
    };
  }

  return { ...baseSurface, width: 5, height: 5, sqft: 25, manualSqft: false };
};

// ─── Type-mismatch validator (runs on mount only) ─────────────────────────────

const validateSurfacesForType = (surfaces, expectedType) => {
  if (!Array.isArray(surfaces) || surfaces.length === 0) return [];
  const normalizedExpected = normalizeMeasurementType(expectedType);
  return surfaces
    .map((s, i) => {
      if (!s) return `Surface ${i + 1}: missing data`;
      const surfaceType = normalizeMeasurementType(s.measurementType);
      if (surfaceType && surfaceType !== normalizedExpected)
        return `Surface ${
          i + 1
        }: stored as "${surfaceType}" but expects "${normalizedExpected}"`;
      return null;
    })
    .filter(Boolean);
};

// ─── Component ────────────────────────────────────────────────────────────────

const SurfaceManager = forwardRef(function SurfaceManagerInner(
  {
    workItem,
    onChange,
    disabled = false,
    onError,
    categoryKey = "",
    workType = "",
    catIndex = 0,
    workIndex = 0,
  },
  ref,
) {
  const [validationErrors, setValidationErrors] = useState({});

  const surfaces = useMemo(
    () => (Array.isArray(workItem.surfaces) ? workItem.surfaces : []),
    [workItem.surfaces],
  );

  // FIX #1: Track the last surfaces array *we* emitted so we can distinguish
  // "we caused this render" from "something external changed surfaces".
  // Using JSON string as a cheap stable key; surfaces objects are small.
  const lastEmittedSurfacesRef = useRef(null);

  // ── Sanitization helper ───────────────────────────────────────────────────

  const sanitizeSurfaces = useCallback(
    (rawSurfaces, measurementType) => {
      if (!Array.isArray(rawSurfaces)) return [];
      const normalizedType = normalizeMeasurementType(measurementType);
      const sanitizedSurfaces = [];
      const errors = {};

      rawSurfaces.forEach((surface, index) => {
        try {
          const cleanSurface = createCleanSurface(
            normalizedType,
            index + 1,
            surface,
          );
          const validation = validateSurface(cleanSurface, normalizedType);
          if (validation.isValid) {
            sanitizedSurfaces.push(cleanSurface);
          } else {
            console.warn(`Surface ${index + 1} invalid:`, validation.error);
            errors[index] = validation.error;
            sanitizedSurfaces.push(
              createCleanSurface(normalizedType, index + 1, surface),
            );
          }
        } catch (error) {
          console.error(`Error processing surface ${index + 1}:`, error);
          errors[index] = error.message;
          sanitizedSurfaces.push(
            createCleanSurface(normalizedType, index + 1, surface),
          );
        }
      });

      setValidationErrors(errors);
      if (Object.keys(errors).length > 0 && onError) {
        onError(`Surface validation: ${Object.values(errors).join("; ")}`);
      }
      return sanitizedSurfaces;
    },
    [onError],
  );

  // ── FIX #1: Circular-loop-safe sanitisation effect ────────────────────────
  // We only call onChange when the incoming surfaces are NOT just an echo of
  // the last update we ourselves emitted.
  useEffect(() => {
    if (!workItem?.measurementType || disabled) return;

    const currentSurfaces = Array.isArray(workItem.surfaces)
      ? workItem.surfaces
      : [];
    if (currentSurfaces.length === 0) return;

    const currentKey = JSON.stringify(currentSurfaces);

    // Skip if these are surfaces we just emitted (echo from parent re-render)
    if (lastEmittedSurfacesRef.current === currentKey) return;

    const sanitized = sanitizeSurfaces(
      currentSurfaces,
      workItem.measurementType,
    );
    const sanitizedKey = JSON.stringify(sanitized);

    // Only propagate if sanitisation actually changed something
    if (sanitizedKey !== currentKey) {
      lastEmittedSurfacesRef.current = sanitizedKey;
      onChange({ ...workItem, surfaces: sanitized });
    }
    // Intentionally excludes onChange and sanitizeSurfaces:
    // - onChange identity changes every parent render; including it restarts the loop
    // - sanitizeSurfaces is useCallback-stable; safe to exclude
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItem, disabled]);

  // ── Mount-only: warn about imported type-mismatched surfaces ──────────────
  useEffect(() => {
    if (!workItem.measurementType || surfaces.length === 0) return;
    const warnings = validateSurfacesForType(
      surfaces,
      workItem.measurementType,
    );
    if (warnings.length > 0 && onError) {
      onError(
        `Surface type mismatch (possibly imported): ${warnings.join("; ")}`,
      );
    }
    // Runs only once on mount — intentional omission of reactive deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── FIX #2 (atomic measurement-type change) ───────────────────────────────

  const handleMeasurementTypeChange = useCallback(
    (newMeasurementType) => {
      if (disabled) return;
      const normalizedType = normalizeMeasurementType(newMeasurementType);
      const resetSurfaces = surfaces.map((s, i) =>
        createCleanSurface(normalizedType, i + 1, { name: s.name, id: s.id }),
      );
      const finalSurfaces =
        resetSurfaces.length > 0
          ? resetSurfaces
          : [createCleanSurface(normalizedType, 1)];

      const updated = {
        ...workItem,
        measurementType: normalizedType,
        surfaces: finalSurfaces,
      };
      const emittedKey = JSON.stringify(finalSurfaces);
      lastEmittedSurfacesRef.current = emittedKey;
      onChange(updated);
      onError?.(null);
    },
    [disabled, surfaces, workItem, onChange, onError],
  );

  useImperativeHandle(ref, () => ({ handleMeasurementTypeChange }), [
    handleMeasurementTypeChange,
  ]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getMeasurementUnit = useCallback(
    () => getMeasurementTypeUnit(workItem.measurementType),
    [workItem.measurementType],
  );

  const getAddButtonText = useCallback((measurementType) => {
    const t = normalizeMeasurementType(measurementType);
    if (t === MEASUREMENT_TYPES.SQUARE_FOOT) return "Add Surface";
    if (t === MEASUREMENT_TYPES.LINEAR_FOOT) return "Add Linear Section";
    if (t === MEASUREMENT_TYPES.BY_UNIT) return "Add Unit";
    return "Add Item";
  }, []);

  const addSurface = useCallback(() => {
    if (disabled || surfaces.length >= 50) return;
    try {
      const newSurface = createCleanSurface(
        workItem.measurementType,
        surfaces.length + 1,
      );
      const newSurfaces = [...surfaces, newSurface];
      lastEmittedSurfacesRef.current = JSON.stringify(newSurfaces);
      onChange({ ...workItem, surfaces: newSurfaces });
      onError?.(null);
    } catch (error) {
      console.error("Error adding surface:", error);
      onError?.(`Failed to add surface: ${error.message}`);
    }
  }, [disabled, surfaces, workItem, onChange, onError]);

  const removeSurface = useCallback(
    (indexToRemove) => {
      if (disabled || indexToRemove < 0 || indexToRemove >= surfaces.length)
        return;

      if (surfaces.length === 1) {
        const confirmRemove = window.confirm(
          `This will remove the last ${getMeasurementUnit().toLowerCase()}. Are you sure?`,
        );
        if (!confirmRemove) return;
      }

      try {
        const updatedSurfaces = surfaces
          .filter((_, i) => i !== indexToRemove)
          .map((surface, i) => ({
            ...surface,
            name:
              surface.name || getSurfaceName(workItem.measurementType, i + 1),
          }));

        lastEmittedSurfacesRef.current = JSON.stringify(updatedSurfaces);
        onChange({ ...workItem, surfaces: updatedSurfaces });

        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[indexToRemove];
          return newErrors;
        });

        onError?.(null);
      } catch (error) {
        console.error("Error removing surface:", error);
        onError?.(`Failed to remove surface: ${error.message}`);
      }
    },
    [disabled, surfaces, workItem, onChange, onError, getMeasurementUnit],
  );

  // ── Header info ───────────────────────────────────────────────────────────

  const headerInfo = useMemo(() => {
    const t = normalizeMeasurementType(workItem.measurementType);
    if (t === MEASUREMENT_TYPES.SQUARE_FOOT)
      return {
        text: "Surfaces",
        emptyText: "No surfaces added yet. Add a surface to start.",
        icon: "fas fa-ruler-combined",
        emptyIcon: "fas fa-ruler",
      };
    if (t === MEASUREMENT_TYPES.LINEAR_FOOT)
      return {
        text: "Linear Sections",
        emptyText: "No linear sections added yet. Add a section to start.",
        icon: "fas fa-ruler-horizontal",
        emptyIcon: "fas fa-ruler-horizontal",
      };
    if (t === MEASUREMENT_TYPES.BY_UNIT)
      return {
        text: "Units",
        emptyText: "No units added yet. Add a unit to start.",
        icon: "fas fa-cube",
        emptyIcon: "fas fa-cube",
      };
    return {
      text: "Items",
      emptyText: "No items added yet.",
      icon: "fas fa-ruler-combined",
      emptyIcon: "fas fa-ruler",
    };
  }, [workItem.measurementType]);

  // ── Surface input renderer ────────────────────────────────────────────────

  const renderSurfaceInputs = useCallback(
    (surface, index) => {
      const validation = validateSurface(surface, workItem.measurementType);
      if (!validation.isValid) {
        return (
          <div className={styles.errorState}>
            Surface data error: {validation.error}
          </div>
        );
      }

      const t = normalizeMeasurementType(workItem.measurementType);

      if (t === MEASUREMENT_TYPES.SQUARE_FOOT)
        return (
          <SquareFootageInput
            catIndex={catIndex}
            workIndex={workIndex}
            surfIndex={index}
            surface={surface}
            disabled={disabled}
            categoryKey={categoryKey}
            workType={workType}
            onError={onError}
          />
        );
      if (t === MEASUREMENT_TYPES.LINEAR_FOOT)
        return (
          <LinearFootInput
            catIndex={catIndex}
            workIndex={workIndex}
            surfIndex={index}
            surface={surface}
            disabled={disabled}
            categoryKey={categoryKey}
            workType={workType}
            onError={onError}
          />
        );
      if (t === MEASUREMENT_TYPES.BY_UNIT)
        return (
          <ByUnitInput
            catIndex={catIndex}
            workIndex={workIndex}
            surfIndex={index}
            surface={surface}
            disabled={disabled}
            categoryKey={categoryKey}
            workType={workType}
            onError={onError}
          />
        );

      return (
        <div className={styles.errorState}>
          <i className="fas fa-question-circle" />
          <span>Unknown measurement type: {t}</span>
        </div>
      );
    },
    [
      workItem.measurementType,
      catIndex,
      workIndex,
      disabled,
      categoryKey,
      workType,
      onError,
    ],
  );

  // ── Total units ───────────────────────────────────────────────────────────

  const getTotalUnits = useCallback(() => {
    try {
      return surfaces.reduce((total, surface) => {
        if (!surface) return total;
        const t = normalizeMeasurementType(workItem.measurementType);
        if (t === MEASUREMENT_TYPES.SQUARE_FOOT)
          return (
            total +
            (parseFloat(surface.sqft) ||
              parseFloat(surface.width || 0) * parseFloat(surface.height || 0))
          );
        if (t === MEASUREMENT_TYPES.LINEAR_FOOT)
          return total + (parseFloat(surface.linearFt) || 0);
        if (t === MEASUREMENT_TYPES.BY_UNIT)
          return total + (parseInt(surface.units, 10) || 0);
        return total;
      }, 0);
    } catch {
      return 0;
    }
  }, [surfaces, workItem.measurementType]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.surfaceManager}>
      {Object.keys(validationErrors).length > 0 && (
        <div className={styles.validationWarning}>
          <i className="fas fa-exclamation-triangle" />
          Some surfaces had validation issues and were auto-corrected.
        </div>
      )}

      <div className={styles.header}>
        <h4 className={styles.title}>
          <i className={headerInfo.icon} />
          {headerInfo.text} ({surfaces.length}/50)
          {surfaces.length > 0 && (
            <span className={styles.totalUnits}>
              Total: {getTotalUnits().toFixed(2)} {getMeasurementUnit()}
            </span>
          )}
        </h4>
      </div>

      <div className={styles.surfaceList}>
        {surfaces.length === 0 ? (
          <div className={styles.emptyState}>
            <i className={headerInfo.emptyIcon} />
            <p>{headerInfo.emptyText}</p>
          </div>
        ) : (
          surfaces.map((surface, index) => (
            <div key={surface.id || index} className={styles.surfaceItem}>
              <div className={styles.surfaceHeader}>
                <input
                  type="text"
                  value={
                    surface.name ||
                    getSurfaceName(workItem.measurementType, index + 1)
                  }
                  onChange={(e) => {
                    const updatedSurfaces = surfaces.map((s, i) =>
                      i === index ? { ...s, name: e.target.value } : s,
                    );
                    lastEmittedSurfacesRef.current =
                      JSON.stringify(updatedSurfaces);
                    onChange({ ...workItem, surfaces: updatedSurfaces });
                  }}
                  disabled={disabled}
                  className={styles.surfaceName}
                  placeholder={getSurfaceName(
                    workItem.measurementType,
                    index + 1,
                  )}
                />
              </div>
              {!disabled && (
                <button
                  onClick={() => removeSurface(index)}
                  className={styles.removeButton}
                  title="Remove"
                >
                  <i className="fas fa-times" />
                </button>
              )}
              <div className={styles.surfaceContent}>
                {renderSurfaceInputs(surface, index)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.addButtons}>
        {!disabled && surfaces.length < 50 && (
          <button onClick={addSurface} className={styles.addButton}>
            <i className="fas fa-plus" />{" "}
            {getAddButtonText(workItem.measurementType)}
          </button>
        )}
      </div>
    </div>
  );
});

SurfaceManager.displayName = "SurfaceManager";

SurfaceManager.propTypes = {
  workItem: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  onError: PropTypes.func,
  categoryKey: PropTypes.string,
  workType: PropTypes.string,
  catIndex: PropTypes.number,
  workIndex: PropTypes.number,
};

SurfaceManager.defaultProps = {
  disabled: false,
  onError: null,
  categoryKey: "",
  workType: "",
  catIndex: 0,
  workIndex: 0,
};

export default SurfaceManager;
