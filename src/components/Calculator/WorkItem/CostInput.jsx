// src/components/Calculator/WorkItem/CostInput.jsx

import React, { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./CostInput.module.css";
import commonStyles from "../../../styles/common.module.css";
import { MEASUREMENT_TYPES } from "../../../context/WorkTypeContext";

// FIX #1: Single canonical parser used everywhere in this component
function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  // Strip everything that isn't a digit, a dot or a leading minus
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CostInput({
  label,
  value,
  onChange,
  disabled = false,
  options,
  field,
  measurementType,
  onError,
  quantity = 0,
}) {
  const numericValue = parseNumber(value);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const unitLabel = useMemo(() => {
    if (!measurementType) return "";
    const type = measurementType.toLowerCase();
    if (type.includes("square") || type === "sqft") return "/sqft";
    if (type.includes("linear") || type.includes("foot")) return "/ft";
    if (
      type.includes("unit") ||
      type.includes("piece") ||
      type.includes("each")
    )
      return "/unit";
    switch (measurementType) {
      case MEASUREMENT_TYPES.SQUARE_FOOT:
        return "/sqft";
      case MEASUREMENT_TYPES.LINEAR_FOOT:
        return "/ft";
      case MEASUREMENT_TYPES.BY_UNIT:
        return "/unit";
      default:
        return "";
    }
  }, [measurementType]);

  const totalCost = useMemo(
    () => numericValue * quantity,
    [numericValue, quantity],
  );

  const validateCost = useCallback((inputValue) => {
    if (inputValue === null || inputValue === undefined || inputValue === "")
      return { isValid: true, error: null, value: 0 };

    const numValue = parseNumber(inputValue);

    if (numValue < 0)
      return { isValid: false, error: "Cost cannot be negative", value: 0 };
    if (numValue > 10000)
      return {
        isValid: false,
        error: "Cost must be less than $10,000",
        value: numValue,
      };

    return { isValid: true, error: null, value: numValue };
  }, []);

  const matchesDropdownOption = useCallback(
    (val) =>
      options.some((opt) => {
        if (opt === "Custom") return false;
        return Math.abs(parseNumber(opt) - val) < 0.01;
      }),
    [options],
  );

  const dropdownValue = useMemo(() => {
    if (isCustomMode) return "Custom";
    const match = options.find((opt) => {
      if (opt === "Custom") return false;
      return Math.abs(parseNumber(opt) - numericValue) < 0.01;
    });
    return match || "Custom";
  }, [isCustomMode, numericValue, options]);

  // FIX #2: Single source of truth for what the number input displays
  const numberInputDisplayValue = useMemo(() => {
    if (isCustomMode) return customInput;
    return numericValue || "";
  }, [isCustomMode, customInput, numericValue]);

  const handleDropdownChange = useCallback(
    (e) => {
      const selected = e.target.value;
      if (selected === "Custom") {
        setIsCustomMode(true);
        setCustomInput(numericValue > 0 ? numericValue.toString() : "");
        onError?.(null);
      } else {
        // FIX #1: Use parseNumber (not parseFloat) for consistency
        const validation = validateCost(selected);
        if (validation.isValid) {
          setIsCustomMode(false);
          setCustomInput("");
          onChange(validation.value);
          onError?.(null);
        } else {
          onError?.(validation.error);
        }
      }
    },
    [numericValue, onChange, validateCost, onError],
  );

  const handleCustomInputChange = useCallback(
    (e) => {
      const inputValue = e.target.value;
      setCustomInput(inputValue);

      if (inputValue === "") {
        onChange(0);
        onError?.(null);
        return;
      }

      const validation = validateCost(inputValue);
      // FIX #1: Always use parseNumber result (matches validateCost internally)
      onChange(validation.value);
      onError?.(validation.isValid ? null : validation.error);
    },
    [onChange, validateCost, onError],
  );

  const handleCustomInputBlur = useCallback(() => {
    setIsFocused(false);
    const validation = validateCost(customInput);

    if (validation.isValid) {
      if (matchesDropdownOption(validation.value)) {
        setIsCustomMode(false);
        setCustomInput("");
      } else {
        setCustomInput(validation.value > 0 ? validation.value.toString() : "");
      }
      onChange(validation.value);
      onError?.(null); // FIX #3: unconditional clear on success
    } else {
      setCustomInput(numericValue > 0 ? numericValue.toString() : "");
      onError?.(validation.error);
    }
  }, [
    customInput,
    numericValue,
    validateCost,
    matchesDropdownOption,
    onChange,
    onError,
  ]);

  // Sync external value changes into custom mode if needed
  useEffect(() => {
    if (
      !isCustomMode &&
      numericValue > 0 &&
      !matchesDropdownOption(numericValue)
    ) {
      setIsCustomMode(true);
      setCustomInput(numericValue.toString());
    }
  }, [numericValue, isCustomMode, matchesDropdownOption]);

  const inputId = `cost-input-${field}`;
  const selectId = `cost-select-${field}`;

  return (
    <div className={styles.costInput}>
      <div className={styles.labelRow}>
        <label htmlFor={selectId} className={styles.label}>
          {label}
          {unitLabel && <span className={styles.unitLabel}>{unitLabel}</span>}
          <span className={styles.required}>*</span>
        </label>
        {numericValue > 0 && (
          <span className={styles.unitCost}>
            {formatCurrency(numericValue)}
            {unitLabel}
          </span>
        )}
      </div>

      <div
        className={`${styles.inputGroup} ${isFocused ? styles.focused : ""}`}
      >
        <div className={styles.selectWrapper}>
          <select
            id={selectId}
            value={dropdownValue}
            onChange={handleDropdownChange}
            disabled={disabled}
            aria-label={`${field} selection`}
            className={styles.select}
          >
            {options
              .filter((opt) => opt !== "Custom")
              .map((option) => (
                <option key={option} value={option}>
                  ${option}
                </option>
              ))}
            <option value="Custom">Custom</option>
          </select>
        </div>

        <div
          className={`${styles.inputWrapper} ${
            commonStyles.inputWrapper || ""
          }`}
        >
          <i
            className={`fas fa-dollar-sign ${
              commonStyles.inputIcon || styles.inputIcon
            }`}
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="number"
            step="0.01"
            min="0"
            max="10000"
            // FIX #2: single derived variable — no more flicker on focus
            value={numberInputDisplayValue}
            onChange={handleCustomInputChange}
            onBlur={handleCustomInputBlur}
            onFocus={() => {
              setIsFocused(true);
              if (!isCustomMode) {
                setIsCustomMode(true);
                setCustomInput(numericValue > 0 ? numericValue.toString() : "");
              }
            }}
            placeholder="0.00"
            disabled={disabled}
            aria-label={`${field} ${unitLabel}`}
            className={!isCustomMode ? styles.disabledInput : ""}
          />
        </div>
      </div>

      {quantity > 0 && numericValue > 0 && (
        <div className={styles.costSummary}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total Cost</span>
            <span className={styles.totalValue}>
              {formatCurrency(totalCost)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

CostInput.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  field: PropTypes.string.isRequired,
  measurementType: PropTypes.string,
  onError: PropTypes.func,
  quantity: PropTypes.number,
};
