// src/components/Calculator/WorkItem/inputs/ByUnitInput.jsx
import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useCategories } from "../../../../context/CategoriesContext";
import styles from "./ByUnitInput.module.css";
import commonStyles from "../../../../styles/common.module.css";

export default function ByUnitInput({
  catIndex,
  workIndex,
  surfIndex,
  surface,
  disabled = false,
  showRemove = false,
  categoryKey,
  workType,
  onError,
  minValue = 1,
  maxValue = 9999,
  unitLabel = "Units",
  unitAbbreviation = "units",
  allowDecimals = false,
}) {
  const { setCategories } = useCategories();
  const [inputValue, setInputValue] = useState("");
  const [hasError, setHasError] = useState(false);

  const units = useMemo(() => {
    const value = surface?.units;
    if (value === null || value === undefined) return minValue;

    const numValue =
      typeof value === "string"
        ? allowDecimals
          ? parseFloat(value)
          : parseInt(value, 10)
        : value;

    return !isNaN(numValue) && numValue >= minValue ? numValue : minValue;
  }, [surface?.units, minValue, allowDecimals]);

  const displayValue = useMemo(() => {
    if (inputValue) return inputValue;
    return allowDecimals
      ? Number(units).toString()
      : Math.floor(units).toString();
  }, [inputValue, units, allowDecimals]);

  const validateInput = useCallback(
    (value) => {
      const numValue = allowDecimals ? parseFloat(value) : parseInt(value, 10);

      if (isNaN(numValue)) {
        return { isValid: false, error: "Please enter a valid number" };
      }

      if (numValue < minValue) {
        return { isValid: false, error: `Value must be at least ${minValue}` };
      }

      if (numValue > maxValue) {
        return {
          isValid: false,
          error: `Value must be no more than ${maxValue}`,
        };
      }

      if (!allowDecimals && numValue !== Math.floor(numValue)) {
        return { isValid: false, error: "Please enter a whole number" };
      }

      return { isValid: true, error: null };
    },
    [minValue, maxValue, allowDecimals],
  );

  const updateSurface = useCallback(
    (field, value) => {
      if (disabled) return;

      const validation = validateInput(value);
      setHasError(!validation.isValid);

      if (!validation.isValid) {
        onError?.(validation.error);
        return;
      }

      const parsedValue = allowDecimals
        ? parseFloat(value)
        : parseInt(value, 10);

      try {
        setCategories((prev) => {
          if (!prev[catIndex]?.workItems?.[workIndex]?.surfaces?.[surfIndex]) {
            throw new Error("Invalid surface reference");
          }

          const newCategories = [...prev];
          const category = { ...newCategories[catIndex] };
          const workItems = [...category.workItems];
          const item = { ...workItems[workIndex] };
          const surfaces = [...item.surfaces];

          surfaces[surfIndex] = {
            ...surfaces[surfIndex],
            [field]: parsedValue,
          };

          item.surfaces = surfaces;
          workItems[workIndex] = item;
          category.workItems = workItems;
          newCategories[catIndex] = category;

          return newCategories;
        });

        onError?.(null);
      } catch (error) {
        console.error("Error updating surface:", error);
        onError?.("Failed to update surface data");
        setHasError(true);
      }
    },
    [
      disabled,
      validateInput,
      setCategories,
      catIndex,
      workIndex,
      surfIndex,
      onError,
      allowDecimals,
    ],
  );

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;

      if (!allowDecimals && value.includes(".")) {
        return;
      }

      setInputValue(value);

      if (hasError) {
        setHasError(false);
        onError?.(null);
      }
    },
    [hasError, onError, allowDecimals],
  );

  const handleInputBlur = useCallback(() => {
    const value = inputValue || displayValue;
    updateSurface("units", value);
    setInputValue("");
  }, [inputValue, displayValue, updateSurface]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }

      if (!allowDecimals && e.key === ".") {
        e.preventDefault();
      }
    },
    [allowDecimals],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (disabled) return;

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentValue = parseFloat(displayValue) || minValue;
        const increment = allowDecimals ? 0.1 : 1;
        const newValue =
          e.key === "ArrowUp"
            ? currentValue + increment
            : Math.max(minValue, currentValue - increment);

        updateSurface("units", newValue.toString());
      }
    },
    [disabled, displayValue, minValue, allowDecimals, updateSurface],
  );

  const inputId = `units-${catIndex}-${workIndex}-${surfIndex}`;
  const errorId = `${inputId}-error`;
  const step = allowDecimals ? "0.1" : "1";

  return (
    <div className={`${styles.byUnitInput} ${hasError ? styles.hasError : ""}`}>
      <div className={styles.inputRow}>
        <label htmlFor={inputId} className={styles.inlineLabel}>
          {unitLabel}
          <span className={styles.required}>*</span>
        </label>

        <div className={styles.inputGroup}>
          <div
            className={`${styles.inputWrapper} ${commonStyles.inputWrapper} ${
              hasError ? styles.errorInput : ""
            }`}
          >
            <i
              className={`fas fa-cube ${commonStyles.inputIcon}`}
              aria-hidden="true"
            ></i>

            <input
              id={inputId}
              type="number"
              step={step}
              min={minValue}
              max={maxValue}
              value={displayValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onFocus={(e) => e.target.select()}
              onKeyPress={handleKeyPress}
              onKeyDown={handleKeyDown}
              placeholder={minValue.toString()}
              disabled={disabled}
              aria-label={`Surface ${surfIndex + 1} ${unitLabel.toLowerCase()}`}
              aria-describedby={hasError ? errorId : undefined}
              aria-invalid={hasError}
            />

            <span className={styles.unit}>
              {units === 1
                ? unitAbbreviation.replace(/s$/, "")
                : unitAbbreviation}
            </span>
          </div>

          {hasError && (
            <div
              id={errorId}
              className={styles.errorMessage}
              role="alert"
              aria-live="polite"
            >
              <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
              Please enter a {allowDecimals
                ? "number"
                : "whole number"} between {minValue} and {maxValue}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ByUnitInput.propTypes = {
  catIndex: PropTypes.number.isRequired,
  workIndex: PropTypes.number.isRequired,
  surfIndex: PropTypes.number.isRequired,
  surface: PropTypes.shape({
    units: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    measurementType: PropTypes.string,
  }).isRequired,
  disabled: PropTypes.bool,
  showRemove: PropTypes.bool,
  categoryKey: PropTypes.string.isRequired,
  workType: PropTypes.string.isRequired,
  onError: PropTypes.func,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
  unitLabel: PropTypes.string,
  unitAbbreviation: PropTypes.string,
  allowDecimals: PropTypes.bool,
};

ByUnitInput.defaultProps = {
  disabled: false,
  showRemove: false,
  onError: null,
  minValue: 1,
  maxValue: 9999,
  unitLabel: "Units",
  unitAbbreviation: "units",
  allowDecimals: false,
};
