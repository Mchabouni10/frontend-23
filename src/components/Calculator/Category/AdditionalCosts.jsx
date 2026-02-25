// src/components/Calculator/Category/AdditionalCosts.jsx
import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { useSettings } from "../../../context/SettingsContext";
import { useCalculation } from "../../../context/CalculationContext";
import SectionHeader from "./SectionHeader";
import styles from "./AdditionalCosts.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value) {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdditionalCosts({ disabled = false }) {
  const { settings, setSettings } = useSettings();
  const { totals, derived } = useCalculation();

  const [useManualMarkup, setUseManualMarkup] = useState(false);
  const [useManualLaborDiscount, setUseManualLaborDiscount] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    additionalCosts: true,
    waste: true,
  });

  const toggleSection = (key) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Safe settings with defaults
  const safe = {
    transportationFee: 0,
    taxRate: 0,
    markup: 0,
    laborDiscount: 0,
    miscFees: [],
    wasteEntries: [],
    ...settings,
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const parseValidated = useCallback((value, min, max) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
  }, []);

  // ── Settings mutators ──────────────────────────────────────────────────────

  const handleSettingsChange = useCallback(
    (field, rawValue) => {
      if (disabled) return;

      let num;
      if (["laborDiscount", "markup", "taxRate"].includes(field)) {
        const max = field === "laborDiscount" ? 100 : 500;
        num = parseValidated(rawValue, 0, max);
        if (num === null) return;
        setSettings((prev) => ({ ...prev, [field]: num / 100 }));
      } else {
        const max = field === "transportationFee" ? 100000 : Infinity;
        num = parseValidated(rawValue, 0, max);
        if (num === null) return;
        setSettings((prev) => ({ ...prev, [field]: num }));
      }
    },
    [disabled, parseValidated, setSettings],
  );

  // Misc Fees
  const handleMiscFeeChange = useCallback(
    (index, field, value) => {
      if (disabled) return;
      if (field === "amount") {
        const num = parseValidated(value, 0, 100000);
        if (num === null) return;
        setSettings((prev) => ({
          ...prev,
          miscFees: prev.miscFees.map((fee, i) =>
            i === index ? { ...fee, amount: num } : fee,
          ),
        }));
      } else {
        if (!value.trim()) return;
        setSettings((prev) => ({
          ...prev,
          miscFees: prev.miscFees.map((fee, i) =>
            i === index ? { ...fee, name: value } : fee,
          ),
        }));
      }
    },
    [disabled, parseValidated, setSettings],
  );

  const addMiscFee = useCallback(() => {
    if (disabled) return;
    setSettings((prev) => ({
      ...prev,
      miscFees: [
        ...(prev.miscFees || []),
        { name: `Fee ${(prev.miscFees?.length || 0) + 1}`, amount: 0 },
      ],
    }));
  }, [disabled, setSettings]);

  const removeMiscFee = useCallback(
    (index) => {
      if (disabled) return;
      setSettings((prev) => ({
        ...prev,
        miscFees: prev.miscFees.filter((_, i) => i !== index),
      }));
    },
    [disabled, setSettings],
  );

  // Waste Entries — written to settings.wasteEntries; engine reads them
  const handleWasteEntryChange = useCallback(
    (index, field, value) => {
      if (disabled) return;
      let parsed = value;

      if (field === "surfaceCost") {
        const num = parseValidated(value, 0, 1000000);
        if (num === null) return;
        parsed = num;
      } else if (field === "wasteFactor") {
        // already converted to decimal (0–0.5) by the select onChange
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 0.5) return;
        parsed = num;
      }

      setSettings((prev) => ({
        ...prev,
        wasteEntries: (prev.wasteEntries || []).map((entry, i) =>
          i === index ? { ...entry, [field]: parsed } : entry,
        ),
      }));
    },
    [disabled, parseValidated, setSettings],
  );

  const addWasteEntry = useCallback(() => {
    if (disabled) return;
    setSettings((prev) => ({
      ...prev,
      wasteEntries: [
        ...(prev.wasteEntries || []),
        {
          surfaceName: `Surface ${(prev.wasteEntries?.length || 0) + 1}`,
          surfaceCost: 0,
          wasteFactor: 0,
        },
      ],
    }));
  }, [disabled, setSettings]);

  const removeWasteEntry = useCallback(
    (index) => {
      if (disabled) return;
      setSettings((prev) => ({
        ...prev,
        wasteEntries: prev.wasteEntries.filter((_, i) => i !== index),
      }));
    },
    [disabled, setSettings],
  );

  // ── Tooltip helper ─────────────────────────────────────────────────────────

  const withTooltip = (label, tip) => (
    <div className={styles.tooltipWrapper}>
      {label}
      <span className={styles.tooltip}>{tip}</span>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.section}>
      <SectionHeader
        title="Additional Costs"
        icon="fas fa-cogs"
        isExpanded={expandedSections.additionalCosts}
        onToggle={() => toggleSection("additionalCosts")}
        disabled={disabled}
        stats={[
          {
            value: `$${fmt(derived.totalAdjustments)}`,
            label: "Additional Costs Total",
            highlight: true,
          },
        ]}
      />

      {expandedSections.additionalCosts && (
        <div className={styles.settingsContent}>
          {/* ── Waste Entries ─────────────────────────────────────────────── */}
          <div className={styles.wasteSection}>
            <div className={styles.wasteHeader}>
              <button
                className={styles.wasteToggle}
                onClick={() => toggleSection("waste")}
              >
                <i
                  className={`fas fa-chevron-${
                    expandedSections.waste ? "down" : "right"
                  }`}
                />
                <i className="fas fa-recycle" />
                <span>Waste Factors by Surface:</span>
              </button>
              {!disabled && (
                <button
                  onClick={addWasteEntry}
                  className={styles.headerAddButton}
                  title="Add Waste Entry"
                >
                  <i className="fas fa-plus" /> Add Entry
                </button>
              )}
            </div>

            {expandedSections.waste && (
              <div className={styles.wasteContent}>
                {safe.wasteEntries.map((entry, index) => {
                  // Per-row preview only — the authoritative total is totals.wasteCost
                  const rowCost =
                    (parseFloat(entry.surfaceCost) || 0) *
                    (parseFloat(entry.wasteFactor) || 0);

                  return (
                    <div key={index} className={styles.wasteEntryRow}>
                      <div className={styles.inputWrapper}>
                        <i className={`fas fa-tag ${styles.inputIcon}`} />
                        <input
                          type="text"
                          value={entry.surfaceName}
                          onChange={(e) =>
                            handleWasteEntryChange(
                              index,
                              "surfaceName",
                              e.target.value,
                            )
                          }
                          placeholder="Surface (e.g., Kitchen Floor)"
                          disabled={disabled}
                          className={styles.surfaceNameInput}
                        />
                      </div>
                      <div className={styles.inputWrapper}>
                        <i
                          className={`fas fa-dollar-sign ${styles.inputIcon}`}
                        />
                        <input
                          type="number"
                          value={entry.surfaceCost}
                          onChange={(e) =>
                            handleWasteEntryChange(
                              index,
                              "surfaceCost",
                              e.target.value,
                            )
                          }
                          placeholder="Cost ($)"
                          min="0"
                          step="0.01"
                          disabled={disabled}
                          className={styles.costInput}
                        />
                      </div>
                      <div className={styles.inputWrapper}>
                        <i
                          className={`fas fa-percentage ${styles.inputIcon}`}
                        />
                        <select
                          value={(
                            (parseFloat(entry.wasteFactor) || 0) * 100
                          ).toFixed(0)}
                          onChange={(e) =>
                            handleWasteEntryChange(
                              index,
                              "wasteFactor",
                              parseFloat(e.target.value) / 100,
                            )
                          }
                          disabled={disabled}
                          className={styles.wasteSelect}
                        >
                          {[0, 5, 10, 15, 20, 25, 30].map((pct) => (
                            <option key={pct} value={pct}>
                              {pct}%
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className={styles.wasteCostDisplay}>
                        ${rowCost.toFixed(2)}
                      </span>
                      {!disabled && (
                        <button
                          onClick={() => removeWasteEntry(index)}
                          className={styles.removeButton}
                          title="Remove"
                        >
                          <i className="fas fa-trash-alt" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {safe.wasteEntries.length > 0 && (
                  <div className={styles.wasteTotalRow}>
                    <span>Total Waste Cost:</span>
                    {/* Engine is the authority — read from context */}
                    <span className={styles.wasteTotalAmount}>
                      ${fmt(totals.wasteCost)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Transportation Fee ────────────────────────────────────────── */}
          <div className={styles.field}>
            {withTooltip(
              <label>
                <i className="fas fa-truck" /> Transportation Fee ($):
              </label>,
              "Flat fee for transportation and delivery",
            )}
            <input
              type="number"
              value={safe.transportationFee}
              onChange={(e) =>
                handleSettingsChange("transportationFee", e.target.value)
              }
              min="0"
              max="100000"
              disabled={disabled}
            />
          </div>

          {/* ── Tax Rate ─────────────────────────────────────────────────── */}
          <div className={styles.field}>
            <div className={styles.fieldRow}>
              {withTooltip(
                <label>
                  <i className="fas fa-percentage" /> Tax Rate (%):
                </label>,
                "Sales tax rate applied to subtotal",
              )}
              <input
                type="number"
                value={(safe.taxRate * 100).toFixed(1)}
                onChange={(e) =>
                  handleSettingsChange("taxRate", e.target.value)
                }
                min="0"
                max="500"
                step="0.1"
                disabled={disabled}
              />
            </div>
            <span className={styles.costDisplay}>
              (${fmt(totals.taxAmount)})
            </span>
          </div>

          {/* ── Markup ───────────────────────────────────────────────────── */}
          <div className={styles.field}>
            <div className={styles.fieldRow}>
              {withTooltip(
                <label>
                  <i className="fas fa-chart-line" /> Markup (%):
                </label>,
                "Profit margin percentage applied to subtotal",
              )}
              {useManualMarkup ? (
                <input
                  type="number"
                  value={(safe.markup * 100).toFixed(1)}
                  onChange={(e) =>
                    handleSettingsChange("markup", e.target.value)
                  }
                  min="0"
                  max="500"
                  step="0.1"
                  disabled={disabled}
                  autoFocus
                />
              ) : (
                <select
                  value={(safe.markup * 100).toFixed(0)}
                  onChange={(e) =>
                    handleSettingsChange("markup", e.target.value)
                  }
                  disabled={disabled}
                >
                  <option value="" disabled>
                    Select Markup
                  </option>
                  {Array.from({ length: 21 }, (_, i) => i * 5).map((val) => (
                    <option key={val} value={val}>
                      {val}%
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.costDisplay}>
                (${fmt(totals.markupAmount)})
              </span>
              {!disabled && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={useManualMarkup}
                    onChange={() => setUseManualMarkup((v) => !v)}
                  />
                  <i className="fas fa-edit" /> Manual
                </label>
              )}
            </div>
          </div>

          {/* ── Labor Discount ───────────────────────────────────────────── */}
          <div className={styles.field}>
            <div className={styles.fieldRow}>
              {withTooltip(
                <label>
                  <i className="fas fa-cut" /> Labor Discount (%):
                </label>,
                "Discount applied to total labor costs",
              )}
              {useManualLaborDiscount ? (
                <input
                  type="number"
                  value={(safe.laborDiscount * 100).toFixed(1)}
                  onChange={(e) =>
                    handleSettingsChange("laborDiscount", e.target.value)
                  }
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={disabled}
                  autoFocus
                />
              ) : (
                <select
                  value={(safe.laborDiscount * 100).toFixed(0)}
                  onChange={(e) =>
                    handleSettingsChange("laborDiscount", e.target.value)
                  }
                  disabled={disabled}
                >
                  <option value="" disabled>
                    Select Discount
                  </option>
                  {Array.from({ length: 21 }, (_, i) => i * 5).map((val) => (
                    <option key={val} value={val}>
                      {val}%
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.costDisplay}>
                (${fmt(totals.laborDiscount)})
              </span>
              {!disabled && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={useManualLaborDiscount}
                    onChange={() => setUseManualLaborDiscount((v) => !v)}
                  />
                  <i className="fas fa-edit" /> Manual
                </label>
              )}
            </div>
          </div>

          {/* ── Misc Fees ────────────────────────────────────────────────── */}
          <div className={styles.miscFees}>
            {withTooltip(
              <label>
                <i className="fas fa-money-bill-wave" /> Miscellaneous Fees:
              </label>,
              "Additional one-time fees (e.g., permits, inspections)",
            )}
            {safe.miscFees.map((fee, index) => (
              <div key={index} className={styles.miscFeeRow}>
                <div className={styles.inputWrapper}>
                  <i className={`fas fa-tag ${styles.inputIcon}`} />
                  <input
                    type="text"
                    value={fee.name}
                    onChange={(e) =>
                      handleMiscFeeChange(index, "name", e.target.value)
                    }
                    placeholder="Fee Name"
                    disabled={disabled}
                  />
                </div>
                <div className={styles.inputWrapper}>
                  <i className={`fas fa-dollar-sign ${styles.inputIcon}`} />
                  <input
                    type="number"
                    value={fee.amount}
                    onChange={(e) =>
                      handleMiscFeeChange(index, "amount", e.target.value)
                    }
                    min="0"
                    max="100000"
                    disabled={disabled}
                  />
                </div>
                {!disabled && (
                  <button
                    onClick={() => removeMiscFee(index)}
                    className={styles.removeButton}
                    title="Remove Fee"
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button onClick={addMiscFee} className={styles.addButton}>
                <i className="fas fa-plus" /> Add Fee
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

AdditionalCosts.propTypes = {
  disabled: PropTypes.bool,
};
