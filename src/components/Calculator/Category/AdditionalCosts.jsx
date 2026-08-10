// src/components/Calculator/Category/AdditionalCosts.jsx
import React, { useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { useSettings } from "../../../context/SettingsContext";
import { useCalculation } from "../../../context/CalculationContext";
import { useCategories } from "../../../context/CategoriesContext";
import { useWorkTypeTaxonomy } from "../../../context/WorkTypeTaxonomyContext";
import { MEASUREMENT_TYPES } from "../../../constants/measurementTypes";
import SectionHeader from "./SectionHeader";
import styles from "./AdditionalCosts.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value) {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
}

/** "crown-molding" → "Crown Molding" — fallback when the taxonomy lookup misses. */
function toTitleCase(slug) {
  return String(slug)
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function normalizeCategoryKey(categoryKey) {
  if (!categoryKey) return "";
  if (categoryKey.startsWith("custom_")) return categoryKey;
  return categoryKey.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "");
}

// ─── Industry-standard waste defaults by measurement type ─────────────────────
// SF/LF materials (tile, flooring, trim, pipe) are cut to fit — off-cuts are
// discarded, so a waste buffer is essential. BY_UNIT items (fixtures, faucets,
// appliances) are purchased as exact-count whole units: zero waste.

const WASTE_DEFAULTS = {
  [MEASUREMENT_TYPES.SQUARE_FOOT]: {
    defaultWaste: 0.10,   // 10% — tile, flooring, drywall, paint
    max: 0.50,
    label: "SF",
    description: "Tile, flooring, drywall — 10% typical",
  },
  [MEASUREMENT_TYPES.LINEAR_FOOT]: {
    defaultWaste: 0.10,   // 10% — trim, pipe, conduit
    max: 0.30,
    label: "LF",
    description: "Trim, pipe, conduit — 10% typical",
  },
  [MEASUREMENT_TYPES.BY_UNIT]: {
    defaultWaste: 0,      // 0% — exact-count items; waste doesn't apply
    max: 0,
    label: "EA",
    description: "Fixtures, appliances — no waste",
  },
};

/** Returns the industry-default waste factor for a given measurement type. */
function getDefaultWaste(measurementType) {
  return WASTE_DEFAULTS[measurementType]?.defaultWaste ?? 0.10;
}

/** Returns true if the measurement type supports waste (SF or LF only). */
function isWasteable(measurementType) {
  return (
    measurementType === MEASUREMENT_TYPES.SQUARE_FOOT ||
    measurementType === MEASUREMENT_TYPES.LINEAR_FOOT
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdditionalCosts({ disabled = false }) {
  const { settings, setSettings } = useSettings();
  const { totals, derived } = useCalculation();
  const { categories } = useCategories();
  const { getCategoryWorkTypes } = useWorkTypeTaxonomy();

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
    wasteFactor: 0,
    ...settings,
  };

  // ── Resolve a human-readable work-type label the same way WorkItem.jsx's
  //    `derivedName` does, so waste-entry labels never show the generic
  //    "New Work Item" placeholder when a real name is resolvable. ──────────

  const getWorkTypeLabel = useCallback(
    (categoryKey, typeValue) => {
      if (!typeValue) return "";
      try {
        const dbTypes = getCategoryWorkTypes(normalizeCategoryKey(categoryKey)) || [];
        const match = dbTypes.find(
          (wt) => (typeof wt === "string" ? wt : wt.key) === typeValue,
        );
        if (match) return typeof match === "string" ? toTitleCase(match) : match.name;
      } catch (err) {
        console.warn(`⚠️ Failed to resolve work type label: ${err.message}`);
      }
      return toTitleCase(typeValue);
    },
    [getCategoryWorkTypes],
  );

  const getWorkItemDisplayName = useCallback(
    (item, categoryKey) => {
      // 1. Custom work type always wins — user named it explicitly.
      if (item.type === "custom-work-type" && item.customWorkTypeName?.trim())
        return item.customWorkTypeName;

      // 2. Resolve from taxonomy so customers see the real work type name
      //    (e.g. "Hardwood Flooring") instead of a slug or "New Work Item".
      if (item.type) {
        const typeName = getWorkTypeLabel(categoryKey, item.type);
        // Only append subtype when it adds meaningful detail for the customer
        // (e.g. "Tile Flooring - Ceramic").
        const withSubtype = item.subtype ? `${typeName} — ${item.subtype}` : typeName;

        // Prefer a user-given name when it's not the generic placeholder,
        // but still append the type context so the customer knows what it is.
        if (item.name && item.name !== "New Work Item" && item.name !== typeName) {
          return `${item.name} (${withSubtype})`;
        }
        return withSubtype;
      }

      // 3. Non-empty custom name, no type resolved yet.
      if (item.name && item.name !== "New Work Item") return item.name;

      return "Work Item";
    },
    [getWorkTypeLabel],
  );

  // ── Get all available surfaces from work items ──────────────────────────────

  const availableSurfaces = useMemo(() => {
    const result = [];
    if (!Array.isArray(categories)) return result;

    categories.forEach((category, catIndex) => {
      if (!category.workItems) return;
      category.workItems.forEach((item, workIndex) => {
        if (!item.surfaces) return;
        // Use material cost ONLY — labor is never wasted (you don't cut or break
        // a worker). item.materialCost is the per-unit material rate from the engine.
        const materialCostPerUnit = parseFloat(item.materialCost) || 0;
        // Keep labor separate so it's visible in the tooltip but never in waste math.
        const laborCostPerUnit = parseFloat(item.laborCost) || 0;
        const measurementType = item.measurementType;
        // Matches the "1-1", "4-2" numbering shown in the category list,
        // so a waste row can be cross-referenced at a glance.
        const itemNumber = `${catIndex + 1}-${workIndex + 1}`;
        const workItemDisplayName = getWorkItemDisplayName(item, category.key);

        item.surfaces.forEach((surface) => {
          // FIX: Use the stable surface.id if available, fallback to _id if present,
          // or generate a new one. This ensures waste entries can re-link after reload.
          const surfaceId = surface.id || surface._id?.toString() || `surface_${Date.now()}_${Math.random()}`;
          
          // Resolve the measurement quantity for this surface
          let quantity = 0;
          let unitLabel = "";
          if (measurementType === MEASUREMENT_TYPES.SQUARE_FOOT) {
            quantity =
              parseFloat(surface.sqft) ||
              (parseFloat(surface.width) || 0) * (parseFloat(surface.height) || 0);
            unitLabel = "sqft";
          } else if (measurementType === MEASUREMENT_TYPES.LINEAR_FOOT) {
            quantity = parseFloat(surface.linearFt) || 0;
            unitLabel = "lin ft";
          } else if (measurementType === MEASUREMENT_TYPES.BY_UNIT) {
            quantity = parseFloat(surface.units) || 0;
            unitLabel = "units";
          }

          // surfaceMaterialCost = material rate × quantity ONLY.
          // Waste is applied only to this value — labor is never included.
          const surfaceMaterialCost = materialCostPerUnit * quantity;
          const surfaceLaborCost = laborCostPerUnit * quantity;

          result.push({
            id: surfaceId,
            name: surface.name || "Unnamed Surface",
            categoryName: category.name || "Unnamed Category",
            workItemName: workItemDisplayName,
            itemNumber,
            quantity,
            unitLabel,
            // materialCost = per-unit material rate (for display)
            materialCost: materialCostPerUnit,
            laborCost: laborCostPerUnit,
            // surfaceCost = total material cost for this surface = what waste is applied to
            surfaceCost: surfaceMaterialCost,
            surfaceLaborCost,
            measurementType,
            wasteable: isWasteable(measurementType),
          });
        });
      });
    });
    return result;
  }, [categories, getWorkItemDisplayName]);

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
      } else if (field === "wasteFactor") {
        const pct = parseFloat(rawValue);
        if (isNaN(pct) || pct < 0 || pct > 50) return;
        setSettings((prev) => ({ ...prev, [field]: pct / 100 }));
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

  // ── Waste Entries ──────────────────────────────────────────────────────────

  const handleWasteEntryChange = useCallback(
    (index, field, value) => {
      if (disabled) return;
      let parsed = value;

      if (field === "surfaceCost") {
        const num = parseValidated(value, 0, 1000000);
        if (num === null) return;
        parsed = num;
      } else if (field === "wasteFactor") {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 0.5) return;
        parsed = num;
      } else if (field === "surfaceId") {
        // When a surface is selected, auto-fill cost and set the correct
        // default waste factor based on measurement type:
        //   SF/LF → 10% industry default   |   BY_UNIT → 0% (not wasteable)
        const selectedSurface = availableSurfaces.find(s => s.id === value);
        if (selectedSurface) {
          const defaultWaste = getDefaultWaste(selectedSurface.measurementType);
          setSettings((prev) => ({
            ...prev,
            wasteEntries: (prev.wasteEntries || []).map((entry, i) => {
              if (i !== index) return entry;
              return {
                ...entry,
                surfaceId: value,
                surfaceName: `${selectedSurface.itemNumber} · ${selectedSurface.categoryName} → ${selectedSurface.workItemName} → ${selectedSurface.name}`,
                surfaceCost: selectedSurface.surfaceCost,
                measurementType: selectedSurface.measurementType,
                wasteable: selectedSurface.wasteable,
                // Picking a (new) surface clears any manual $ override so the
                // row goes back to tracking the surface's live cost.
                manualOverride: false,
                // Honour an existing user override only if it's still valid
                // for the new type; otherwise apply the type default.
                wasteFactor: selectedSurface.wasteable
                  ? (entry.wasteFactor > 0 ? entry.wasteFactor : defaultWaste)
                  : 0,
              };
            }),
          }));
          return;
        }
        parsed = value;
      }

      setSettings((prev) => ({
        ...prev,
        wasteEntries: (prev.wasteEntries || []).map((entry, i) =>
          i === index
            ? {
                ...entry,
                [field]: parsed,
                // A manual $ edit pins this row to that value so it stops
                // tracking the live surface cost until a new surface is picked.
                ...(field === "surfaceCost" ? { manualOverride: true } : {}),
              }
            : entry,
        ),
      }));
    },
    [disabled, parseValidated, setSettings, availableSurfaces],
  );

  const addWasteEntry = useCallback(() => {
    if (disabled) return;
    setSettings((prev) => ({
      ...prev,
      wasteEntries: [
        ...(prev.wasteEntries || []),
        {
          surfaceName: `Surface ${(prev.wasteEntries?.length || 0) + 1}`,
          surfaceId: "",
          surfaceCost: 0,
          measurementType: null,
          wasteable: null,   // unknown until a surface is picked
          wasteFactor: 0,    // stays 0 until a surface (and thus a type) is selected
          manualOverride: false,
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

  // ── Auto-generate waste entries from all surfaces ──────────────────────────

  const autoGenerateWasteEntries = useCallback(() => {
    if (disabled || availableSurfaces.length === 0) return;

    const newEntries = availableSurfaces.map((surface) => ({
      surfaceName: `${surface.itemNumber} · ${surface.categoryName} → ${surface.workItemName} → ${surface.name}`,
      surfaceId: surface.id,
      surfaceCost: surface.surfaceCost,
      measurementType: surface.measurementType,
      wasteable: surface.wasteable,
      // Industry-correct default: SF/LF → 10%, BY_UNIT → 0%
      wasteFactor: getDefaultWaste(surface.measurementType),
      manualOverride: false,
    }));

    setSettings((prev) => ({
      ...prev,
      wasteEntries: newEntries,
    }));
  }, [disabled, availableSurfaces, setSettings]);

  // ── Tooltip helper ─────────────────────────────────────────────────────────

  const withTooltip = (label, tip) => (
    <div className={styles.tooltipWrapper}>
      {label}
      <span className={styles.tooltip}>{tip}</span>
    </div>
  );

  // ── Live-synced waste entries ────────────────────────────────────────────
  // A waste entry only durably stores a `surfaceId` reference (plus an
  // optional manual $ override). Cost, measurement type, and wasteable-ness
  // are re-derived from the live `availableSurfaces` list on *every* render,
  // so editing a work item's material cost, quantity, or measurement type
  // after a waste row was created/auto-generated is reflected immediately —
  // instead of silently freezing at whatever the values were at that moment.
  const liveWasteEntries = useMemo(() => {
    return (safe.wasteEntries || []).map((entry) => {
      // FIX: Try to find by surfaceId, but also try matching by surfaceName as a fallback
      // for legacy entries that might have lost their surfaceId.
      let linked = availableSurfaces.find((s) => s.id === entry.surfaceId);
      
      // Fallback: if surfaceId doesn't match but we have a surfaceName, try to find
      // by matching the itemNumber part of the name.
      if (!linked && entry.surfaceName) {
        // Try to extract itemNumber from surfaceName (e.g., "1-1 · Kitchen → ...")
        const itemNumberMatch = entry.surfaceName.match(/^(\d+-\d+)/);
        if (itemNumberMatch) {
          linked = availableSurfaces.find((s) => s.itemNumber === itemNumberMatch[1]);
        }
      }
      
      if (!linked) return entry; // surface was removed/renamed — keep last-known values
      return {
        ...entry,
        surfaceCost: entry.manualOverride ? entry.surfaceCost : linked.surfaceCost,
        measurementType: linked.measurementType,
        wasteable: linked.wasteable,
        // Keep the descriptive label current too — if the work item is
        // renamed or its type changes after this row was generated, the
        // persisted label shouldn't silently go stale.
        surfaceName: `${linked.itemNumber} · ${linked.categoryName} → ${linked.workItemName} → ${linked.name}`,
      };
    });
  }, [safe.wasteEntries, availableSurfaces]);

  // ── Derived totals ──────────────────────────────────────────────────────────

  const totalWasteCost = useMemo(() => {
    return liveWasteEntries.reduce((sum, entry) => {
      const cost = parseFloat(entry.surfaceCost) || 0;
      const factor = parseFloat(entry.wasteFactor) || 0;
      return sum + cost * factor;
    }, 0);
  }, [liveWasteEntries]);

  const materialCost = useMemo(() => {
    return parseFloat(totals.materialCost) || 0;
  }, [totals.materialCost]);

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
          {
            value: `$${fmt(totalWasteCost)}`,
            label: "Waste Total",
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
                <span className={styles.wasteBadge}>
                  {safe.wasteEntries.length} entries
                </span>
              </button>
              <div className={styles.wasteHeaderActions}>
                {!disabled && availableSurfaces.length > 0 && (
                  <button
                    onClick={autoGenerateWasteEntries}
                    className={styles.autoGenerateBtn}
                    title="Auto-generate from all work item surfaces"
                  >
                    <i className="fas fa-magic" /> Auto-generate
                  </button>
                )}
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
            </div>

            {expandedSections.waste && (
              <div className={styles.wasteContent}>
                {/* Global waste factor fallback — shown when no entries exist */}
                {safe.wasteEntries.length === 0 && (
                  <div className={styles.globalWasteField}>
                    <div className={styles.fieldRow}>
                      {withTooltip(
                        <label>
                          <i className="fas fa-globe" /> Global Waste Factor (%)
                        </label>,
                        "Applied to all material costs when no specific waste entries are defined.",
                      )}
                      <select
                        value={(safe.wasteFactor * 100).toFixed(0)}
                        onChange={(e) =>
                          handleSettingsChange("wasteFactor", e.target.value)
                        }
                        disabled={disabled}
                        className={styles.wasteSelect}
                      >
                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((pct) => (
                          <option key={pct} value={pct}>
                            {pct}%
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className={styles.helpText}>
                      <i className="fas fa-info-circle" />
                      No specific waste entries defined. Using global waste factor.
                    </span>
                  </div>
                )}

                {liveWasteEntries.map((entry, index) => {
                  const rowCost =
                    (parseFloat(entry.surfaceCost) || 0) *
                    (parseFloat(entry.wasteFactor) || 0);

                  // Resolve surface metadata — prefer stored type, fall back to live lookup
                  const linkedSurface = availableSurfaces.find(
                    (s) => s.id === entry.surfaceId,
                  );
                  const entryType =
                    entry.measurementType ||
                    linkedSurface?.measurementType ||
                    null;
                  const entryWasteable =
                    entry.wasteable ?? linkedSurface?.wasteable ?? null;
                  // quantityLabel was unused; surface quantity is displayed inline in the selector instead.

                  // BY_UNIT entries: waste factor is always 0 — locked
                  const wasteFactorLocked = entryWasteable === false;

                  // Badge shown next to the surface selector
                  const typeBadge =
                    entryType === MEASUREMENT_TYPES.SQUARE_FOOT
                      ? { label: "SF", title: "Square-foot material — waste applies" }
                      : entryType === MEASUREMENT_TYPES.LINEAR_FOOT
                        ? { label: "LF", title: "Linear-foot material — waste applies" }
                        : entryType === MEASUREMENT_TYPES.BY_UNIT
                          ? { label: "EA", title: "Unit-count item — waste is 0% (exact count)" }
                          : null;

                  // Tooltip for the surface select: show material cost breakdown
                  // so contractor knows exactly what the waste applies to.
                  const materialTooltip = linkedSurface
                    ? `Material only: $${linkedSurface.materialCost.toFixed(2)}/${linkedSurface.unitLabel} × ${linkedSurface.quantity.toFixed(1)} ${linkedSurface.unitLabel} = $${linkedSurface.surfaceCost.toFixed(2)}${linkedSurface.laborCost > 0 ? ` (labor $${linkedSurface.surfaceLaborCost.toFixed(2)} excluded from waste)` : ""}`
                    : "Waste applies to material cost only — labor is excluded";

                  return (
                    <div
                      key={entry.surfaceId || index}
                      className={`${styles.wasteEntryRow} ${
                        wasteFactorLocked ? styles.wasteEntryLocked : ""
                      }`}
                    >
                      {/* Compact single-row: [#badge] [surface select] [type badge] [waste%] [waste$] [delete] */}

                      {linkedSurface?.itemNumber ? (
                        <span
                          className={styles.itemNumberBadge}
                          title={`${linkedSurface.categoryName} → ${linkedSurface.workItemName}`}
                        >
                          {linkedSurface.itemNumber}
                        </span>
                      ) : (
                        <span className={styles.itemNumberBadgeEmpty} aria-hidden="true" />
                      )}

                      {/* Surface selector — full readable name for the customer */}
                      <div className={styles.inputWrapper} title={materialTooltip}>
                        <i className={`fas fa-layer-group ${styles.inputIcon}`} />
                        <select
                          value={entry.surfaceId || ""}
                          onChange={(e) =>
                            handleWasteEntryChange(index, "surfaceId", e.target.value)
                          }
                          disabled={disabled}
                          className={styles.surfaceSelect}
                        >
                          <option value="">Select a surface…</option>
                          {availableSurfaces.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.workItemName} — {s.name} ({s.quantity.toFixed(1)} {s.unitLabel})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Type badge */}
                      {typeBadge ? (
                        <span
                          className={`${styles.typeBadge} ${
                            wasteFactorLocked ? styles.typeBadgeLocked : styles.typeBadgeActive
                          }`}
                          title={typeBadge.title}
                        >
                          {typeBadge.label}
                        </span>
                      ) : (
                        <span className={styles.typeBadgeEmpty} aria-hidden="true" />
                      )}

                      {/* Waste factor select — locked for BY_UNIT */}
                      <div
                        title={
                          wasteFactorLocked
                            ? "Unit items (fixtures, appliances) are counted exactly — no material waste"
                            : "Industry standard: 10–15% for cuts & breakage on SF/LF materials"
                        }
                      >
                        {wasteFactorLocked ? (
                          <select
                            value="0"
                            disabled
                            className={`${styles.wasteSelect} ${styles.wasteSelectLocked}`}
                          >
                            <option value="0">N/A</option>
                          </select>
                        ) : (
                          <select
                            value={((parseFloat(entry.wasteFactor) || 0) * 100).toFixed(0)}
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
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((pct) => (
                              <option key={pct} value={pct}>
                                {pct}%
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Waste cost result — read-only text, no extra input */}
                      {wasteFactorLocked ? (
                        <span
                          className={`${styles.wasteCostDisplay} ${styles.wasteCostNA}`}
                          title="No waste on unit-count items"
                        >
                          N/A
                        </span>
                      ) : (
                        <span
                          className={styles.wasteCostDisplay}
                          title={materialTooltip}
                        >
                          +${rowCost.toFixed(2)}
                        </span>
                      )}

                      {!disabled && (
                        <button
                          onClick={() => removeWasteEntry(index)}
                          className={styles.removeButton}
                          title="Remove waste entry"
                        >
                          <i className="fas fa-trash-alt" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {safe.wasteEntries.length > 0 && (() => {
                  const wasteableCount = liveWasteEntries.filter(
                    (e) => e.wasteable !== false,
                  ).length;
                  const lockedCount = liveWasteEntries.length - wasteableCount;
                  return (
                    <div className={styles.wasteTotalRow}>
                      <span>
                        Total Waste Cost
                        <small className={styles.wasteTotalDetail}>
                          ({wasteableCount} wasteable
                          {lockedCount > 0 ? `, ${lockedCount} unit` : ""}
                          {safe.wasteEntries.length > 1 ? " surfaces" : " surface"})
                        </small>
                      </span>
                      <span className={styles.wasteTotalAmount}>
                        ${fmt(totalWasteCost)}
                        {materialCost > 0 && (
                          <small className={styles.wastePercent}>
                            ({((totalWasteCost / materialCost) * 100).toFixed(1)}% of materials)
                          </small>
                        )}
                      </span>
                    </div>
                  );
                })()}
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